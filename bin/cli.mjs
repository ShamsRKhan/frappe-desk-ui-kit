#!/usr/bin/env node
// ============================================================================
// frappe-desk-ui-kit  ·  interactive installer for a Frappe Desk design system
// ----------------------------------------------------------------------------
// Drops a theme-safe form-UI toolkit + dashboard CSS into ANY Frappe app, and
// re-brands it on the way in (your namespace, your CSS prefix, your colour).
//
// It works by COPYING the template bundles and doing a careful find-replace —
// so it always ships every primitive in the source bundle, nothing to maintain
// twice. Zero npm dependencies on purpose: it uses only Node built-ins, so it
// runs from a plain unzipped folder with no `npm install`.
//
// RUN IT (any of these):
//   npx .                       # from inside this folder
//   node bin/cli.mjs            # explicit
//   npm i -g . && frappe-desk-ui-kit # install the command globally
//
// NON-INTERACTIVE (great for "let my AI run it" or CI):
//   node bin/cli.mjs --company="Acme" --ns=acme --prefix=acm \
//                    --brand="#2563EB" --app=apps/acme_app --yes
// ============================================================================

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(HERE, "..", "templates");

// — tiny ANSI helpers (no chalk dependency) —
const c = {
	bold: (s) => `\x1b[1m${s}\x1b[0m`,
	dim: (s) => `\x1b[2m${s}\x1b[0m`,
	cyan: (s) => `\x1b[36m${s}\x1b[0m`,
	green: (s) => `\x1b[32m${s}\x1b[0m`,
	yellow: (s) => `\x1b[33m${s}\x1b[0m`,
	red: (s) => `\x1b[31m${s}\x1b[0m`,
};

// ----------------------------------------------------------------------------
// arg parsing  ·  --key=value  and bare flags like --yes
// ----------------------------------------------------------------------------
function parseArgs(argv) {
	const out = {};
	for (const a of argv) {
		const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
		if (m) out[m[1]] = m[2] === undefined ? true : m[2];
	}
	return out;
}
const ARGS = parseArgs(process.argv.slice(2));
const AUTO = !!ARGS.yes || !stdin.isTTY; // skip prompts if --yes or piped input
const DRY = !!ARGS["dry-run"]; // preview only — write nothing, touch nothing

// ----------------------------------------------------------------------------
// prompt helpers
// ----------------------------------------------------------------------------
const rl = readline.createInterface({ input: stdin, output: stdout });

async function ask(question, def, { validate, transform } = {}) {
	// CLI flag wins; in AUTO mode we never block on input.
	while (true) {
		let raw;
		const flagKey = question.key;
		if (flagKey && ARGS[flagKey] !== undefined && ARGS[flagKey] !== true) {
			raw = String(ARGS[flagKey]);
		} else if (AUTO) {
			raw = def ?? "";
		} else {
			const hint = def ? c.dim(` (${def})`) : "";
			raw = (await rl.question(`${c.cyan("?")} ${question.label}${hint}: `)).trim();
			if (!raw) raw = def ?? "";
		}
		if (transform) raw = transform(raw);
		const err = validate ? validate(raw) : null;
		if (err) {
			if (AUTO) throw new Error(`Invalid ${flagKey}: ${err}`);
			console.log(`  ${c.red("✗")} ${err}`);
			continue;
		}
		return raw;
	}
}

async function confirm(label, def = true) {
	if (AUTO) return true;
	const ans = (await rl.question(`${c.cyan("?")} ${label} ${c.dim(def ? "(Y/n)" : "(y/N)")}: `)).trim().toLowerCase();
	if (!ans) return def;
	return ans === "y" || ans === "yes";
}

// ----------------------------------------------------------------------------
// validators
// ----------------------------------------------------------------------------
const isIdent = (s) => (/^[a-z][a-z0-9_]*$/.test(s) ? null : "lowercase letters/digits/underscore, must start with a letter");
const isPrefix = (s) => (/^[a-z][a-z0-9]*$/.test(s) ? null : "lowercase letters/digits only (used in CSS class names)");
const isHex = (s) => (/^#[0-9a-fA-F]{6}$/.test(s) ? null : "a 6-digit hex colour like #2563EB");

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
async function main() {
	console.log(`
${c.bold("frappe-desk-ui-kit")} ${c.dim("· Desk design-system installer")}
${c.dim("Re-brands a theme-safe form-UI toolkit + dashboard CSS into your Frappe app.")}
`);

	// 1. gather answers ------------------------------------------------------
	const company = await ask({ key: "company", label: "Company / brand name" }, "Acme");
	const nsDefault = company.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^[^a-z]+/, "") || "acme";
	const ns = await ask(
		{ key: "ns", label: "JS namespace (global object, e.g. acme.ui)" },
		nsDefault.slice(0, 12),
		{ transform: (s) => s.toLowerCase(), validate: isIdent }
	);
	const prefix = await ask(
		{ key: "prefix", label: "CSS class prefix (e.g. orn → .orn-ui- / .orn-dash-)" },
		ns.slice(0, 3),
		{ transform: (s) => s.toLowerCase(), validate: isPrefix }
	);
	const brand = await ask(
		{ key: "brand", label: "Brand accent colour (hex)" },
		"#2563EB",
		{ validate: isHex }
	);
	const appDir = await ask(
		{ key: "app", label: "Path to your Frappe app (e.g. apps/your_app — any name)" },
		".",
		{ validate: (s) => (s ? null : "required") }
	);

	const appRoot = resolve(process.cwd(), appDir);
	const year = new Date().getFullYear(); // stamped into the copyright header

	// 2. resolve the Frappe app layout --------------------------------------
	// Frappe apps are double-nested: apps/<app>/<app>/. Assets (public/) and
	// hooks.py live in the INNER module dir; docs/ sits in the OUTER repo dir.
	// We make NO assumption about the app's name — we locate the module dir by
	// finding hooks.py (at appRoot, or one level down). So pointing at either
	// the repo dir or the module dir works for any app.
	const { moduleDir, repoRoot, hooksPath, appName, guessed } = await resolveLayout(appRoot);

	// 3. files: assets → module dir, docs → repo root -----------------------
	const files = [
		[`public/css/__PREFIX___ui.bundle.css`, moduleDir, `public/css/${prefix}_ui.bundle.css`],
		[`public/css/__PREFIX___dashboard.bundle.css`, moduleDir, `public/css/${prefix}_dashboard.bundle.css`],
		[`public/js/__PREFIX___ui.bundle.js`, moduleDir, `public/js/${prefix}_ui.bundle.js`],
		[`docs/README.md`, repoRoot, `docs/design-system/README.md`],
	];

	console.log(`
${c.bold("Plan")}${DRY ? c.yellow("   (DRY RUN — nothing will be written)") : ""}
  Company .......... ${c.green(company)}
  JS namespace ..... ${c.green(ns + ".ui.*")}
  CSS prefix ....... ${c.green("." + prefix + "-ui-")} / ${c.green("." + prefix + "-dash-")}
  Brand accent ..... ${c.green(brand)}
  App name ......... ${c.green(appName)}
  Module dir ....... ${c.green(moduleDir)} ${c.dim("(assets + hooks.py)")}
  Repo dir ......... ${c.green(repoRoot)} ${c.dim("(docs)")}

${c.bold("Files to write")} ${c.dim("(absolute)")}`);
	for (const [, base, dest] of files) console.log(`  + ${join(base, dest)}`);

	if (guessed) {
		console.log(`\n  ${c.yellow("!")} No hooks.py found yet — assuming module dir ${c.green(moduleDir)}.
       If that's wrong, Ctrl-C and re-run with --app pointing at the right folder.`);
	}
	if (!(await confirm("\nProceed?"))) {
		console.log(c.dim("Aborted."));
		rl.close();
		return;
	}

	// 3. build the substitution table ---------------------------------------
	// The templates ship with NEUTRAL placeholders (no origin brand anywhere) —
	// we just fill them in. ORDER MATTERS: __COMPANY_UC__ before __COMPANY__ so
	// the shorter token can't partially match the longer one.
	const subs = [
		[/__COMPANY_UC__/g, company.toUpperCase()], // all-caps comment banner
		[/__COMPANY__/g, company], // headings / copyright / prose
		[/__NS__/g, ns], // JS global + every call site + frappe.provide(...)
		[/__PREFIX__/g, prefix], // CSS class + token prefix, and bundle filenames
		[/__BRAND__/g, brand], // dashboard brand accent
	];

	function transform(text, isDoc) {
		let out = text;
		for (const [re, rep] of subs) out = out.replace(re, rep);
		// stamp the copyright year on source files (not docs)
		if (!isDoc) out = out.replace(/Copyright \(c\) \d{4}/g, `Copyright (c) ${year}`);
		return out;
	}

	// 4. write everything (or, in dry-run, just report) ----------------------
	for (const [tplRel, base, destRel] of files) {
		const src = join(TEMPLATES, tplRel);
		const dest = join(base, destRel);
		const isDoc = destRel.startsWith("docs/");
		const out = transform(await readFile(src, "utf8"), isDoc);
		if (DRY) {
			console.log(`  ${c.yellow("○")} would write ${dest} ${c.dim(`(${out.length} bytes)`)}`);
			continue;
		}
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, out);
		console.log(`  ${c.green("✓")} ${dest}`);
	}

	// 5. wire up hooks.py ----------------------------------------------------
	await wireHooks(hooksPath, prefix);

	// 6. next steps ----------------------------------------------------------
	if (DRY) {
		console.log(`\n${c.yellow(c.bold("Dry run complete."))} Nothing was written. Re-run without --dry-run to apply.\n`);
		rl.close();
		return;
	}
	console.log(`
${c.green(c.bold("Done."))}  Next:

  1. Build assets:        ${c.cyan(`bench build --app ${appName}`)}
  2. Clear cache:         ${c.cyan(`bench --site <your.site> clear-cache`)}
  3. Hard-reload Desk, open any form, and try in a client script:

       ${c.dim(`${ns}.ui.banner("success", "${company} design system is live");`)}

  Docs landed in ${c.cyan(`docs/design-system/`)} — start with README.md.
  Tip: rename your status→colour map in ${c.cyan(`${prefix}_ui.bundle.js`)} (STATUS_VARIANT)
       and tune the brand shades (--color-brand-deep / -tint) in the dashboard CSS.
`);
	rl.close();
}

// ----------------------------------------------------------------------------
// hooks.py — only ever ADD asset entries; never silently rewrite the user's file
// ----------------------------------------------------------------------------
async function wireHooks(hooksPath, prefix) {
	const cssEntries = `["${prefix}_dashboard.bundle.css", "${prefix}_ui.bundle.css"]`;
	const jsEntries = `["${prefix}_ui.bundle.js"]`;

	if (!hooksPath) {
		console.log(`
  ${c.yellow("!")} Couldn't find hooks.py automatically. Add these to it by hand:
       ${c.dim(`app_include_css = ${cssEntries}`)}
       ${c.dim(`app_include_js  = ${jsEntries}`)}`);
		return;
	}

	const text = await readFile(hooksPath, "utf8");
	const hasCss = /^\s*app_include_css\s*=/m.test(text);
	const hasJs = /^\s*app_include_js\s*=/m.test(text);

	if (hasCss || hasJs) {
		// Respect an existing config — show what to merge rather than risk it.
		console.log(`
  ${c.yellow("!")} ${basename(hooksPath)} already defines app_include_* — merge these in yourself:
       ${c.dim(`app_include_css += ${cssEntries}`)}
       ${c.dim(`app_include_js  += ${jsEntries}`)}`);
		return;
	}

	if (DRY) {
		console.log(`
  ${c.yellow("○")} would append to ${basename(hooksPath)}:
       ${c.dim(`app_include_css = ${cssEntries}`)}
       ${c.dim(`app_include_js = ${jsEntries}`)}`);
		return;
	}
	if (!(await confirm(`Append asset hooks to ${hooksPath}?`))) {
		console.log(c.dim("  Skipped hooks.py — add app_include_css / app_include_js manually."));
		return;
	}
	const block = `\n# --- design system assets (added by frappe-desk-ui-kit) ---\napp_include_css = ${cssEntries}\napp_include_js = ${jsEntries}\n`;
	await writeFile(hooksPath, text.replace(/\s*$/, "\n") + block);
	console.log(`  ${c.green("✓")} appended app_include_css / app_include_js to ${basename(hooksPath)}`);
}

// ----------------------------------------------------------------------------
// resolveLayout — figure out WHERE to write, for any app name.
//   moduleDir : holds hooks.py + public/  (the inner apps/<app>/<app> dir)
//   repoRoot  : holds docs/               (the dir the user pointed at)
//   appName   : the Frappe app name (basename of moduleDir) — used in `bench build`
//   guessed   : true if we couldn't find hooks.py and had to assume a location
// We never hardcode "truck_erp"/any name — the module dir is wherever hooks.py is.
// ----------------------------------------------------------------------------
async function resolveLayout(appRoot) {
	const repoRoot = appRoot;
	// 1) hooks.py directly under appRoot → appRoot IS the module dir.
	if (existsSync(join(appRoot, "hooks.py"))) {
		return { moduleDir: appRoot, repoRoot, hooksPath: join(appRoot, "hooks.py"), appName: basename(appRoot), guessed: false };
	}
	// 2) Frappe convention: appRoot/<same-name>/hooks.py, then any subdir/hooks.py.
	const candidates = [];
	try {
		const here = basename(appRoot);
		if (existsSync(join(appRoot, here, "hooks.py"))) candidates.push(here); // apps/<app>/<app>
		for (const entry of await readdir(appRoot)) {
			if (entry !== here && existsSync(join(appRoot, entry, "hooks.py"))) {
				if ((await stat(join(appRoot, entry))).isDirectory()) candidates.push(entry);
			}
		}
	} catch {
		/* appRoot may not exist yet */
	}
	if (candidates.length) {
		const mod = candidates[0];
		return { moduleDir: join(appRoot, mod), repoRoot, hooksPath: join(appRoot, mod, "hooks.py"), appName: mod, guessed: false };
	}
	// 3) No hooks.py anywhere — assume the conventional inner dir by app-folder name.
	const guessMod = join(appRoot, basename(appRoot));
	return { moduleDir: guessMod, repoRoot, hooksPath: null, appName: basename(appRoot), guessed: true };
}

main().catch((e) => {
	console.error(`\n${c.red("Error:")} ${e.message}`);
	rl.close();
	process.exit(1);
});
