// Copyright (c) 2026, __COMPANY__ and contributors
// For license information, please see license.txt

// ============================================================================
// __COMPANY_UC__ FORM-UI TOOLKIT  ·  __NS__.ui.*
//
// Shared, theme-safe builders for CUSTOM UI inside Desk forms / lists / dialogs.
// Loaded globally via hooks.app_include_js, so every client script can call
// __NS__.ui.* with no import.
//
// PHILOSOPHY (see docs/design-system/):
//   Frappe defaults first — List View, Report View, native fields,
//   frappe.DataTable, frm.dashboard. Use these helpers ONLY where a bespoke
//   section is genuinely required. They exist to STOP the copy-pasted banners /
//   pills / tables drifting apart, not to replace the framework.
//
// CONTRACT:
//   • Most builders return an HTML STRING (compose freely: panel(t, table(...))).
//   • All caller/record data is escaped. Pass pre-built HTML only through the
//     documented `render` / `html` escape hatches.
//   • Colours come from __PREFIX___ui.bundle.css tokens — never hardcode here either.
//
// Live demo / QA harness: build a Desk Page that renders these primitives for visual QA.
// ============================================================================

frappe.provide("__NS__.ui");

(function (ui) {
	ui.version = "1.2.0";

	// ========================================================================
	// INTERNAL HELPERS
	// ========================================================================
	const esc = (s) => frappe.utils.escape_html(s == null ? "" : String(s));
	const DASH = "—";

	function slug(doctype) {
		if (frappe.router && typeof frappe.router.slug === "function") {
			return frappe.router.slug(doctype);
		}
		return String(doctype).toLowerCase().replace(/ /g, "-");
	}

	/**
	 * Safe icon — returns "" if the name is missing from Frappe's sprite.
	 * @param {string} name  icon id without the "icon-" prefix
	 * @param {string} [size="sm"]
	 * @returns {string} HTML
	 */
	ui.icon = function (name, size) {
		try {
			return frappe.utils.icon(name, size || "sm");
		} catch (e) {
			return "";
		}
	};

	/**
	 * Format a date for display, honouring the site's Date Format.
	 * Set System Settings → Date Format to "dd-mm-yyyy" to get that style
	 * everywhere (Frappe-wide AND in every toolkit table) — don't hardcode it.
	 * @param {string} value  e.g. "2026-05-01"
	 * @returns {string}
	 */
	ui.fmtDate = function (value) {
		if (!value) return DASH;
		try {
			return frappe.datetime.str_to_user(value) || esc(value);
		} catch (e) {
			return esc(value);
		}
	};

	// ========================================================================
	// STATUS → VARIANT  (the ONE place status colours are decided)
	// ========================================================================
	const STATUS_VARIANT = {
		// success
		won: "success", active: "success", completed: "success", renewed: "success",
		paid: "success", approved: "success", success: "success", valid: "success",
		passed: "success",
		// danger
		lost: "danger", cancelled: "danger", canceled: "danger", expired: "danger",
		failed: "danger", rejected: "danger", error: "danger", overdue: "danger",
		// warning
		suspended: "warning", pending: "warning", "on hold": "warning",
		warning: "warning", "due soon": "warning",
		// info
		"in progress": "info", progress: "info", open: "info", draft: "info",
		new: "info", info: "info", scheduled: "info",
		// neutral (explicit, so they don't fall through silently)
		deferred: "neutral", skipped: "neutral",
	};

	/**
	 * Map any status string to a pill/banner variant. Unknown → "neutral".
	 * Edit STATUS_VARIANT (above) to change a mapping app-wide.
	 * @param {string} status
	 * @returns {"success"|"danger"|"warning"|"info"|"neutral"}
	 */
	ui.variantFor = function (status) {
		if (!status) return "neutral";
		return STATUS_VARIANT[String(status).trim().toLowerCase()] || "neutral";
	};

	// ========================================================================
	// BANNER  —  info / success / warning / danger callout
	// ========================================================================
	const BANNER_TYPES = ["info", "success", "warning", "danger"];
	// Verified to exist in Frappe's icon sprite.
	const BANNER_ICON = {
		info: "solid-info", success: "solid-success",
		warning: "solid-warning", danger: "solid-error",
	};
	// a11y: danger is assertive (role=alert), the rest are polite (role=status).
	const BANNER_ROLE = {
		info: "status", success: "status", warning: "status", danger: "alert",
	};

	/**
	 * Info/success/warning/danger callout.
	 * @param {"info"|"success"|"warning"|"danger"} type
	 * @param {string} message  escaped unless opts.html
	 * @param {object} [opts]
	 * @param {boolean} [opts.html=false]  trust a pre-built HTML message
	 * @param {string|false} [opts.icon]   override icon id, or false to omit
	 * @param {string} [opts.role]         override the ARIA live role
	 * @returns {string} HTML
	 */
	ui.banner = function (type, message, opts) {
		opts = opts || {};
		type = BANNER_TYPES.indexOf(type) !== -1 ? type : "info";
		const body = opts.html ? (message || "") : esc(message);
		const iconName = opts.icon === false ? null : (opts.icon || BANNER_ICON[type]);
		const icon = iconName
			? `<span class="__PREFIX__-ui-banner__icon" aria-hidden="true">${ui.icon(iconName, "sm")}</span>`
			: "";
		const role = opts.role || BANNER_ROLE[type];
		return `<div class="__PREFIX__-ui-banner __PREFIX__-ui-banner--${type}" role="${role}">${icon}` +
			`<div class="__PREFIX__-ui-banner__body">${body}</div></div>`;
	};

	// ========================================================================
	// PILL / BADGE  —  small inline status indicator
	// ========================================================================
	/**
	 * Inline status indicator.
	 *   pill("Won")                       → variant inferred from label
	 *   pill(doc.status, {status: ...})   → infer from a different field
	 *   pill("Custom", {variant: "info"}) → forced variant
	 * @param {string} label
	 * @param {object} [opts]
	 * @param {string} [opts.status]   status text to infer the variant from
	 * @param {string} [opts.variant]  forced variant (skips inference)
	 * @param {string} [opts.tooltip]  rich hover tooltip ("\n" = line break)
	 * @returns {string} HTML
	 */
	ui.pill = function (label, opts) {
		opts = opts || {};
		const variant = opts.variant || ui.variantFor(opts.status != null ? opts.status : label);
		const tipCls = opts.tooltip ? " __PREFIX__-ui-has-tip" : "";
		const tipAttr = opts.tooltip ? ` data-tk-tip="${esc(opts.tooltip)}"` : "";
		return `<span class="__PREFIX__-ui-pill __PREFIX__-ui-pill--${variant}${tipCls}"${tipAttr}>${esc(label)}</span>`;
	};
	ui.badge = ui.pill; // alias

	// ========================================================================
	// ATTENTION STRIP  —  row of count-pills with hover breakdowns
	//   The reusable form of the a list view "needs attention" strip.
	// ========================================================================
	/**
	 * Horizontal strip of count pills, each with an optional rich tooltip.
	 *   attentionStrip([{label, count, variant, tooltip, onClick}], {label})
	 * Items with count === 0 are hidden unless opts.showZero. If onClick is a
	 * function, the pill becomes clickable and the strip is returned as a jQuery
	 * node (so handlers bind); otherwise an HTML string is returned.
	 * @param {object[]} items
	 * @param {object} [opts]  { label, showZero }
	 * @returns {string|jQuery}
	 */
	ui.attentionStrip = function (items, opts) {
		opts = opts || {};
		items = (items || []).filter((it) => it && (opts.showZero || it.count == null || it.count > 0));
		const lead = opts.label ? `<span class="__PREFIX__-ui-attention__label">${esc(opts.label)}</span>` : "";
		const hasClick = items.some((it) => typeof it.onClick === "function");

		const pills = items.map((it, i) => {
			const variant = it.variant || ui.variantFor(it.label);
			const tipCls = it.tooltip ? " __PREFIX__-ui-has-tip" : "";
			const clickCls = (typeof it.onClick === "function") ? " is-clickable" : "";
			const tipAttr = it.tooltip ? ` data-tk-tip="${esc(it.tooltip)}"` : "";
			const count = (it.count != null) ? ` <b>${esc(it.count)}</b>` : "";
			return `<span class="__PREFIX__-ui-pill __PREFIX__-ui-pill--${variant}${tipCls}${clickCls}"` +
				`${tipAttr} data-tk-i="${i}">${esc(it.label)}${count}</span>`;
		}).join("");

		const html = `<div class="__PREFIX__-ui-attention">${lead}${pills}</div>`;
		if (!hasClick) return html;

		const $strip = $(html);
		$strip.find(".__PREFIX__-ui-pill.is-clickable").on("click", function () {
			const it = items[parseInt(this.getAttribute("data-tk-i"), 10)];
			if (it && typeof it.onClick === "function") it.onClick(it);
		});
		return $strip;
	};

	// ========================================================================
	// TABLE  —  read-only contextual list
	// ========================================================================
	/**
	 * Read-only contextual list (NOT a list/report view).
	 * Column spec: { key, label, align:"right"|num:true, link:"DocType"|fn(row),
	 *   pill:true|fn(row)->status, date:true, currency:true|"USD", number:true,
	 *   precision, value:fn(row), render:fn(row)->html }.
	 * `render` is a TRUSTED escape hatch — the caller owns escaping there.
	 * @param {object[]} columns
	 * @param {object[]} rows
	 * @param {object} [opts]  { empty, emptyIcon, scroll:false }
	 * @returns {string} HTML
	 */
	ui.table = function (columns, rows, opts) {
		opts = opts || {};
		if (!rows || !rows.length) {
			return ui.empty(opts.empty || __("No records to display."), opts.emptyIcon);
		}

		const head = columns.map((c) => {
			const cls = (c.align === "right" || c.num || c.currency || c.number) ? ' class="__PREFIX__-ui-num"' : "";
			return `<th${cls}>${esc(c.label != null ? c.label : c.key)}</th>`;
		}).join("");

		const body = rows.map((row) => {
			const cells = columns.map((c) => {
				const cls = (c.align === "right" || c.num || c.currency || c.number) ? "__PREFIX__-ui-num" : "";
				const raw = (typeof c.value === "function") ? c.value(row) : row[c.key];
				let content;
				if (typeof c.render === "function") {
					content = c.render(row); // trusted HTML
				} else if (c.pill) {
					const status = (typeof c.pill === "function") ? c.pill(row) : raw;
					content = (raw == null || raw === "") ? DASH : ui.pill(raw, { status });
				} else if (c.link) {
					const dt = (typeof c.link === "function") ? c.link(row) : c.link;
					content = raw
						? `<a href="/app/${slug(dt)}/${encodeURIComponent(raw)}" target="_blank">${esc(raw)}</a>`
						: DASH;
				} else if (c.currency) {
					content = ui.fmtCurrency(raw, c.currency === true ? undefined : c.currency);
				} else if (c.number) {
					content = ui.fmtNumber(raw, c.precision);
				} else if (c.date) {
					content = ui.fmtDate(raw);
				} else {
					content = (raw == null || raw === "") ? DASH : esc(raw);
				}
				return `<td class="${cls}">${content}</td>`;
			}).join("");
			return `<tr>${cells}</tr>`;
		}).join("");

		const table = `<table class="__PREFIX__-ui-table"><thead><tr>${head}</tr></thead>` +
			`<tbody>${body}</tbody></table>`;
		return opts.scroll === false ? table : `<div class="__PREFIX__-ui-table-wrap">${table}</div>`;
	};

	// ========================================================================
	// DATA TABLE  —  thin wrapper over frappe.DataTable (sort / filter / resize)
	// ========================================================================
	/**
	 * Interactive grid for when sort/filter/resize is genuinely needed.
	 * Falls back to a static ui.table() if frappe.DataTable is unavailable.
	 * @param {HTMLElement|jQuery} wrapper
	 * @param {object[]} columns  same spec as ui.table (value:fn supported)
	 * @param {object[]} rows
	 * @param {object} [opts]  { datatable: {...passthrough...} }
	 * @returns {object|null} the DataTable instance, or null on fallback
	 */
	ui.dataTable = function (wrapper, columns, rows, opts) {
		opts = opts || {};
		const el = (wrapper && wrapper.get) ? wrapper.get(0) : wrapper;
		if (typeof frappe.DataTable === "undefined") {
			$(el).html(ui.table(columns, rows, opts));
			return null;
		}
		const dtColumns = columns.map((c) => ({
			name: c.label != null ? c.label : c.key,
			id: c.key,
			align: c.align || (c.num ? "right" : "left"),
			editable: false,
			format: c.format,
			width: c.width,
		}));
		const dtRows = rows.map((row) => columns.map((c) => {
			const v = (typeof c.value === "function") ? c.value(row) : row[c.key];
			return v == null ? "" : v;
		}));
		const dt = new frappe.DataTable(el, Object.assign({
			columns: dtColumns,
			data: dtRows,
			layout: "fluid", // size columns to content; pass datatable.layout to override
			noDataMessage: __("No records to display."),
		}, opts.datatable || {}));
		// frappe.DataTable mis-measures column widths when built before its
		// container has laid out — it looks cramped until you drag a column.
		// Re-render on the next frame (layout settled) to lock correct widths.
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(() => { try { dt.refresh(dtRows, dtColumns); } catch (e) { /* noop */ } });
		}
		return dt;
	};

	// ========================================================================
	// RESULT TABLE  —  standard success / skipped / error report for bulk actions
	// ========================================================================
	const RESULT_VARIANT = { success: "success", skipped: "warning", error: "danger" };

	/**
	 * Summary banner + detail table for a bulk action result.
	 * @param {object[]} results  [{ name|label, status:"success"|"skipped"|"error", reason }]
	 * @param {object} [opts]  { nameLabel }
	 * @returns {string} HTML
	 */
	ui.resultTable = function (results, opts) {
		opts = opts || {};
		results = results || [];

		const counts = { success: 0, skipped: 0, error: 0 };
		results.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

		const bits = [];
		if (counts.success) bits.push(`${counts.success} ${__("succeeded")}`);
		if (counts.skipped) bits.push(`${counts.skipped} ${__("skipped")}`);
		if (counts.error) bits.push(`${counts.error} ${__("failed")}`);
		const summaryType = counts.error ? "danger" : (counts.skipped ? "warning" : "success");
		const summary = ui.banner(summaryType, bits.join("  ·  ") || __("No results."));

		const label = {
			success: __("Success"), skipped: __("Skipped"), error: __("Failed"),
		};
		const rows = results.map((r) => ({
			name: r.name || r.label || DASH,
			status: r.status,
			reason: r.reason || "",
		}));
		const table = ui.table([
			{ key: "name", label: opts.nameLabel || __("Record") },
			{
				key: "status", label: __("Result"),
				render: (row) => ui.pill(label[row.status] || row.status, {
					variant: RESULT_VARIANT[row.status] || "neutral",
				}),
			},
			{ key: "reason", label: __("Detail") },
		], rows, { empty: __("No results.") });

		return summary + table;
	};

	// ========================================================================
	// PANEL  —  card shell for a custom form section
	// ========================================================================
	/**
	 * Card shell for a custom form section.
	 * @param {string} title
	 * @param {string} bodyHtml  trusted HTML body (compose with ui.table etc.)
	 * @param {object} [opts]  { icon, meta }
	 * @returns {string} HTML
	 */
	ui.panel = function (title, bodyHtml, opts) {
		opts = opts || {};
		const icon = opts.icon ? `${ui.icon(opts.icon, "sm")} ` : "";
		const meta = opts.meta ? `<span class="__PREFIX__-ui-panel__meta">${esc(opts.meta)}</span>` : "";
		const head = (title || meta)
			? `<div class="__PREFIX__-ui-panel__head">` +
				`<h6 class="__PREFIX__-ui-panel__title">${icon}${esc(title || "")}</h6>${meta}</div>`
			: "";
		return `<div class="__PREFIX__-ui-panel">${head}` +
			`<div class="__PREFIX__-ui-panel__body">${bodyHtml || ""}</div></div>`;
	};

	// ========================================================================
	// ACCORDION  —  collapsible group (e.g. grouped sections)
	// ========================================================================
	/**
	 * Collapsible group.
	 *   accordion({title, meta, trailing}, bodyHtml, {open:true})
	 *   accordion(rawSummaryHtml, bodyHtml)
	 * title/meta are escaped; `trailing` (e.g. a pill, pushed right) and the
	 * body are TRUSTED HTML — compose from other builders.
	 * @param {string|{title?:string, meta?:string, trailing?:string}} summary
	 * @param {string} bodyHtml
	 * @param {object} [opts]  { open:false }
	 * @returns {string} HTML
	 */
	ui.accordion = function (summary, bodyHtml, opts) {
		opts = opts || {};
		const open = opts.open ? " open" : "";
		let head;
		if (typeof summary === "string") {
			head = summary;
		} else {
			const title = summary.title
				? `<span class="__PREFIX__-ui-accordion__title">${esc(summary.title)}</span>` : "";
			const meta = summary.meta
				? `<span class="__PREFIX__-ui-accordion__meta">${esc(summary.meta)}</span>` : "";
			const trailing = summary.trailing
				? `<span class="__PREFIX__-ui-accordion__spacer"></span>${summary.trailing}` : "";
			head = title + meta + trailing;
		}
		return `<details class="__PREFIX__-ui-accordion"${open}>` +
			`<summary>${head}</summary>` +
			`<div class="__PREFIX__-ui-accordion__body">${bodyHtml || ""}</div></details>`;
	};

	// ========================================================================
	// STATES
	// ========================================================================
	/**
	 * Empty-state block.
	 * @param {string} message
	 * @param {string} [icon]  optional icon id
	 * @returns {string} HTML
	 */
	ui.empty = function (message, icon) {
		const ic = icon ? `<span class="__PREFIX__-ui-empty__icon">${ui.icon(icon, "lg")}</span>` : "";
		return `<div class="__PREFIX__-ui-empty">${ic}${esc(message || __("Nothing to show."))}</div>`;
	};
	/**
	 * Loading-state block.
	 * @param {string} [message]
	 * @returns {string} HTML
	 */
	ui.loading = function (message) {
		return `<div class="__PREFIX__-ui-loading">${esc(message || __("Loading…"))}</div>`;
	};

	// ========================================================================
	// SAFE INJECTION  —  put custom HTML onto a form WITHOUT DOM hacks
	// ========================================================================
	/**
	 * Render custom HTML onto a form. Prefer a dedicated HTML field declared in
	 * the doctype JSON (layout-stable, v16-safe); otherwise fall back to an
	 * idempotent section in the form dashboard area.
	 *   injectPanel(frm, html, { fieldname: "subs_html" })   // preferred
	 *   injectPanel(frm, html, { key: "related-records" })      // fallback
	 * @param {object} frm
	 * @param {string} html
	 * @param {object} [opts]  { fieldname, key }
	 * @returns {jQuery} the wrapper the HTML was written into
	 */
	ui.injectPanel = function (frm, html, opts) {
		opts = opts || {};
		if (opts.fieldname && frm.fields_dict && frm.fields_dict[opts.fieldname]) {
			const w = frm.fields_dict[opts.fieldname].$wrapper;
			w.html(html);
			return w;
		}
		const key = opts.key || "__PREFIX__-ui-section";
		const $dash = $(frm.dashboard.wrapper);
		$dash.find(`[data-tk-ui="${key}"]`).remove(); // idempotent across refreshes
		const $node = $(`<div data-tk-ui="${key}">${html}</div>`);
		$dash.append($node);
		return $node;
	};

	// ========================================================================
	// FORMATTERS  —  site-aware currency / number / duration (cf. fmtDate)
	// ========================================================================
	/**
	 * Format a currency amount using the site's currency + number format.
	 * @param {number} value
	 * @param {string} [currency]  ISO code; defaults to the site currency
	 * @returns {string}
	 */
	ui.fmtCurrency = function (value, currency) {
		if (value == null || value === "") return DASH;
		try {
			return format_currency(value, currency || frappe.defaults.get_default("currency"));
		} catch (e) { return esc(value); }
	};
	/**
	 * Format a number using the site's number format.
	 * @param {number} value
	 * @param {number} [precision]
	 * @returns {string}
	 */
	ui.fmtNumber = function (value, precision) {
		if (value == null || value === "") return DASH;
		try { return format_number(value, null, precision); } catch (e) { return esc(value); }
	};
	/**
	 * Format a duration (seconds) as "Xd Yh" / "Yh Zm" / "Zm".
	 * @param {number} seconds
	 * @returns {string}
	 */
	ui.fmtDuration = function (seconds) {
		if (seconds == null || seconds === "" || isNaN(seconds)) return DASH;
		let s = Math.floor(Math.abs(seconds));
		const d = Math.floor(s / 86400); s -= d * 86400;
		const h = Math.floor(s / 3600); s -= h * 3600;
		const m = Math.floor(s / 60);
		if (d) return `${d}d ${h}h`;
		if (h) return `${h}h ${m}m`;
		return `${m}m`;
	};

	// ========================================================================
	// DETAIL LIST  —  read-only label : value pairs (snapshots / summaries)
	// ========================================================================
	/**
	 * Two-column key/value list. Empty values hidden unless opts.showEmpty.
	 * @param {object[]} pairs  [{ label, value, render:fn(pair)->html }]
	 * @param {object} [opts]  { showEmpty, empty }
	 * @returns {string} HTML
	 */
	ui.detailList = function (pairs, opts) {
		opts = opts || {};
		pairs = (pairs || []).filter((p) => p && (opts.showEmpty || (p.value != null && p.value !== "")));
		if (!pairs.length) return ui.empty(opts.empty || __("No details."));
		const rows = pairs.map((p) => {
			const val = (typeof p.render === "function")
				? p.render(p)
				: ((p.value == null || p.value === "") ? DASH : esc(p.value));
			return `<div class="__PREFIX__-ui-dl__row">` +
				`<dt class="__PREFIX__-ui-dl__label">${esc(p.label)}</dt>` +
				`<dd class="__PREFIX__-ui-dl__value">${val}</dd></div>`;
		}).join("");
		return `<dl class="__PREFIX__-ui-dl">${rows}</dl>`;
	};

	// ========================================================================
	// GALLERY  —  thumbnail grid + click-to-zoom lightbox
	// ========================================================================
	/**
	 * Thumbnail grid. Each image: a URL string or { src, title }.
	 * Clicking opens a lightbox (one global handler, installed below).
	 * @param {(string|{src:string,title?:string})[]} images
	 * @param {object} [opts]  { empty }
	 * @returns {string} HTML
	 */
	ui.gallery = function (images, opts) {
		opts = opts || {};
		images = (images || [])
			.map((im) => (typeof im === "string" ? { src: im } : im))
			.filter((im) => im && im.src);
		if (!images.length) return ui.empty(opts.empty || __("No images."), "camera");
		const items = images.map((im) => {
			const t = esc(im.title || "");
			return `<a class="__PREFIX__-ui-gallery__item" href="${esc(im.src)}" title="${t}">` +
				`<img src="${esc(im.src)}" alt="${t}" loading="lazy">` +
				(im.title ? `<span class="__PREFIX__-ui-gallery__cap">${t}</span>` : "") +
				`</a>`;
		}).join("");
		return `<div class="__PREFIX__-ui-gallery">${items}</div>`;
	};

	// Lightbox: a grouped viewer — prev/next buttons + ←/→ / Esc keys.
	function openLightbox(images, start) {
		let idx = start;
		const $o = $(
			`<div class="__PREFIX__-ui-lightbox" tabindex="-1">` +
			`<button class="__PREFIX__-ui-lightbox__nav __PREFIX__-ui-lightbox__prev" aria-label="${__("Previous")}">‹</button>` +
			`<figure class="__PREFIX__-ui-lightbox__inner"><img alt="">` +
			`<figcaption class="__PREFIX__-ui-lightbox__cap"></figcaption>` +
			`<div class="__PREFIX__-ui-lightbox__count"></div></figure>` +
			`<button class="__PREFIX__-ui-lightbox__nav __PREFIX__-ui-lightbox__next" aria-label="${__("Next")}">›</button>` +
			`</div>`
		);
		const render = () => {
			const im = images[idx];
			$o.find("img").attr("src", im.src);
			$o.find(".__PREFIX__-ui-lightbox__cap").text(im.cap || "");
			$o.find(".__PREFIX__-ui-lightbox__count").text(images.length > 1 ? `${idx + 1} / ${images.length}` : "");
			$o.find(".__PREFIX__-ui-lightbox__nav").toggle(images.length > 1);
		};
		const go = (d) => { idx = (idx + d + images.length) % images.length; render(); };
		const onKey = (e) => {
			if (e.key === "Escape") close();
			else if (e.key === "ArrowLeft") go(-1);
			else if (e.key === "ArrowRight") go(1);
		};
		const close = () => { $(document).off("keydown", onKey); $o.remove(); };
		$o.on("click", (e) => { if (e.target === $o[0]) close(); }); // backdrop closes
		$o.find(".__PREFIX__-ui-lightbox__prev").on("click", (e) => { e.stopPropagation(); go(-1); });
		$o.find(".__PREFIX__-ui-lightbox__next").on("click", (e) => { e.stopPropagation(); go(1); });
		$(document).on("keydown", onKey);
		$("body").append($o);
		render();
		$o.focus();
	}

	// Delegated: open the clicked gallery's images as a navigable group.
	$(document).on("click", ".__PREFIX__-ui-gallery__item", function (e) {
		e.preventDefault();
		const $items = $(this).closest(".__PREFIX__-ui-gallery").find(".__PREFIX__-ui-gallery__item");
		const images = $items.map(function () {
			return { src: this.getAttribute("href"), cap: this.getAttribute("title") || "" };
		}).get();
		openLightbox(images, $items.index(this));
	});

	// ========================================================================
	// BULK DIALOG  —  standard scaffold for the app's many bulk actions
	//   Two combinable modes:
	//     • act-on-selected: pass opts.count → "N record(s)" banner
	//     • entry grid:      pass opts.grid  → editable Table field (cf.
	//       a bulk-create client script) — Frappe's native grid, not ours
	//   opts.action(values, dialog) may return [{name,status,reason}] → shown
	//   via resultTable in a result popup.
	// ========================================================================
	/**
	 * @param {object} opts
	 * @param {string} opts.title
	 * @param {number} [opts.count]   selected-record count (shows a banner)
	 * @param {string} [opts.intro]   extra banner text
	 * @param {object[]} [opts.fields]  Frappe Dialog field defs (action params)
	 * @param {object} [opts.grid]   { label, fields, data, fieldname, reqd } → Table field
	 * @param {string} [opts.primaryLabel]
	 * @param {function} opts.action  (values, dialog) => results[]|void (async ok)
	 * @returns {object} the frappe.ui.Dialog instance
	 */
	ui.bulkDialog = function (opts) {
		opts = opts || {};
		const fields = [];

		const bits = [];
		if (opts.count != null) bits.push(__("Acting on {0} record(s).", [opts.count]));
		if (opts.intro) bits.push(opts.intro);
		if (bits.length) {
			fields.push({ fieldtype: "HTML", fieldname: "_intro",
				options: ui.banner("info", bits.join(" "), { html: true }) });
		}
		(opts.fields || []).forEach((f) => fields.push(f));
		if (opts.grid) {
			fields.push({
				fieldtype: "Table",
				fieldname: opts.grid.fieldname || "rows",
				label: opts.grid.label || __("Rows"),
				cannot_add_rows: false,
				in_place_edit: opts.grid.in_place_edit !== false,
				reqd: opts.grid.reqd ? 1 : 0,
				data: opts.grid.data || [],
				fields: opts.grid.fields || [],
			});
		}

		const d = new frappe.ui.Dialog({
			title: opts.title || __("Bulk Action"),
			size: opts.size || (opts.grid ? "large" : "small"),
			fields: fields,
			primary_action_label: opts.primaryLabel || __("Submit"),
			primary_action: function (values) {
				Promise.resolve()
					.then(() => (typeof opts.action === "function" ? opts.action(values, d) : null))
					.then((results) => {
						d.hide();
						if (Array.isArray(results)) {
							frappe.msgprint({
								title: opts.resultTitle || __("Result"),
								message: ui.resultTable(results, opts.resultOpts),
								wide: true,
							});
						}
					})
					.catch((err) => {
						frappe.msgprint({
							title: __("Error"),
							message: (err && err.message) || __("Action failed."),
							indicator: "red",
						});
					});
			},
		});
		d.show();
		return d;
	};

})(__NS__.ui);
