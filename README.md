# frappe-desk-ui-kit

An interactive installer that drops a **theme-safe Desk design system** into any
Frappe / ERPNext app — and re-brands it on the way in (your namespace, your CSS
prefix, your colour).

> **Note:** this is for the classic **Frappe Desk** (jinja + vanilla JS client
> scripts). It is unrelated to the official Vue component library `frappe-ui`.

It ships two things, lifted from a production Frappe app:

- **A form-UI toolkit** — `<ns>.ui.*` JavaScript builders (`banner`, `pill`,
  `table`, `panel`, `resultTable`, `bulkDialog`, …) plus a `.<prefix>-ui-` CSS
  bundle. For custom sections inside Desk **forms, lists and dialogs**. Every
  colour is a token bound to a Frappe theme variable, so it follows Desk
  light/dark automatically and survives the v16 re-skin — no hardcoded hex.
- **A dashboard CSS system** — `.<prefix>-dash-` classes for standalone
  CEO/HTML dashboard **Pages**.

> Philosophy (read `docs/design-system/README.md` after install): **Frappe
> defaults come first.** This is for the bespoke sections Frappe has no built-in
> for — not a reason to avoid List View / Report View / native fields.

## Run it

No `npm install` needed — the installer is pure Node built-ins (requires Node 18+).

```bash
# straight from GitHub — nothing to clone (recommended for sharing)
npx github:<your-gh-user>/frappe-desk-ui-kit

# …or from a local copy of this folder
npx .
node bin/cli.mjs
npm i -g . && frappe-desk-ui-kit
```

It asks five questions (company, JS namespace, CSS prefix, brand colour, target
app path), shows the plan, then writes the re-branded bundles into your app and
offers to wire up `hooks.py`.

### Preview first — `--dry-run`

```bash
node bin/cli.mjs --dry-run        # prints exactly what it WOULD write; touches nothing
```

Always safe to run. Use it to confirm the resolved paths before committing.

### Non-interactive (let your AI / a script run it)

```bash
node bin/cli.mjs \
  --company="Acme" --ns=acme --prefix=acm \
  --brand="#2563EB" --app=apps/acme_app --yes
```

### Where it writes (works for ANY app name)

Frappe apps are double-nested — `apps/<app>/<app>/`. The installer makes **no
assumption about your app's name**: it locates the inner *module dir* by finding
`hooks.py` (whether you point `--app` at the outer repo dir or the inner one),
then places files the Frappe way:

| File | Goes to | Why |
|---|---|---|
| `<prefix>_ui.bundle.css` / `_dashboard.bundle.css` / `_ui.bundle.js` | `apps/<app>/<app>/public/css\|js/` (module dir) | where `bench build` collects assets |
| `README.md` | `apps/<app>/docs/design-system/` (repo dir) | docs live at repo root |
| `app_include_css` / `app_include_js` | appended to the module dir's `hooks.py` | only if absent — never overwrites |

If no `hooks.py` exists yet (brand-new app), it assumes the conventional inner
dir and prints the two `hooks.py` lines for you to add by hand.

### How to test without touching your real bench

Point it at a throwaway folder — it only ever writes under `--app`:

```bash
mkdir -p /tmp/test/myapp/myapp && printf 'app_name="myapp"\n' > /tmp/test/myapp/myapp/hooks.py
node bin/cli.mjs --app=/tmp/test/myapp --dry-run     # preview
node bin/cli.mjs --app=/tmp/test/myapp --yes         # apply into the sandbox
```

## After it runs

```bash
bench build --app <your_app>
bench --site <your.site> clear-cache
```

Hard-reload Desk and try in any client script:

```js
acme.ui.banner("success", "Acme design system is live");
```

## How it works (the teachable bit)

`bin/cli.mjs` is one dependency-free file. The bundles in `templates/` ship with
**neutral placeholders** — `__NS__`, `__PREFIX__`, `__COMPANY__`, `__COMPANY_UC__`,
`__BRAND__` — and no brand names anywhere. The installer simply fills those in
from your answers:

| Placeholder | Becomes | Example |
|---|---|---|
| `__NS__` | JS namespace | `acme` → `acme.ui.*` |
| `__PREFIX__` | CSS class + token prefix, bundle filenames | `acm` → `.acm-ui-`, `--acm-*` |
| `__COMPANY__` / `__COMPANY_UC__` | brand name (title / upper) | `Acme` / `ACME` |
| `__BRAND__` | dashboard accent colour | `#2563EB` |

Read the `subs` table in `cli.mjs` — it's five lines. Because the templates carry
every primitive verbatim (just tokenised), the kit always ships the full toolkit
with nothing to maintain twice.
