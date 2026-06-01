# __COMPANY__ Form-UI Toolkit (`__NS__.ui` + `.__PREFIX__-ui-`)

A small, shared, theme-safe set of UI primitives for **custom UI rendered inside
Desk forms, lists and dialogs** — banners, status pills, tables, section panels,
accordions, attention strips, detail lists, galleries, bulk-action dialogs, and
site-aware formatters. It is the form-level sibling of the dashboard design
system (`__PREFIX___dashboard.bundle.css`, `.__PREFIX__-dash-`).

It exists for one reason: the same banner / status-badge / table markup was being
hand-pasted across many client scripts with hardcoded colours, so the look drifted
between screens and every theme change meant editing eight files. This collapses
that to one source of truth.

---

## ⚠️ Read this first — Frappe defaults come FIRST

**This toolkit does NOT mean "prefer custom UI over Frappe."** The opposite.
Frappe's built-ins are almost always the right answer. Use this toolkit **only
where a bespoke section is genuinely required and Frappe has no built-in for it.**

Decide in this order:

| You need… | Use (in order of preference) | Not this toolkit |
|---|---|---|
| To browse / filter / sort / paginate a whole doctype | **List View** or **Report View** (configure them) | ✗ |
| A capture/edit surface | **Native fields** on the doctype + form layout | ✗ |
| An interactive grid (sort/filter/resize) inside a form or Page | **`frappe.DataTable`** — wrapped by `__NS__.ui.dataTable()` | partial |
| Standard status/indicators in a list | **`frappe.listview_settings` indicators**, `indicator-pill` | ✗ |
| A headline/alert on a form | **`frm.dashboard.set_headline` / `frm.layout.show_message`** first | maybe |
| A *custom* read-only section Frappe can't express (e.g. related-records panel, activity timeline, bulk-result report) | **This toolkit** ✓ | — |

If a Frappe built-in does the job, use it. Reach for `__NS__.ui.*` when you would
otherwise be writing raw `<table>` / `<style>` / inline-hex HTML by hand.

---

## What's in the box

| File | Purpose |
|---|---|
| `public/css/__PREFIX___ui.bundle.css` | Design tokens (§1) + primitive classes (`.__PREFIX__-ui-*`) |
| `public/css/__PREFIX___dashboard.bundle.css` | Dashboard-page system (`.__PREFIX__-dash-*`) |
| `public/js/__PREFIX___ui.bundle.js` | `__NS__.ui.*` builders (return HTML strings) |
| `hooks.py` | Registers them globally (`app_include_css`, `app_include_js`) |

All are loaded on every Desk page, so any client script can call `__NS__.ui.*`
with no import. After editing a bundle, rebuild:

```bash
bench build --app <your_app>
```

### Primitives at a glance

| Builder | What |
|---|---|
| `banner` | info / success / warning / danger callout (ARIA live) |
| `pill` / `badge` | status indicator, optional rich hover tooltip |
| `table` | read-only list — `link` / `pill` / `date` / `currency` / `number` columns |
| `dataTable` | interactive grid over `frappe.DataTable` (sort / filter / resize) |
| `resultTable` | bulk success / skipped / error report |
| `panel` | section-card shell |
| `accordion` | collapsible group (e.g. grouped sections) |
| `attentionStrip` | count pills + hover breakdowns (list header) |
| `detailList` | read-only label : value snapshot |
| `gallery` | thumbnail grid + click-to-zoom lightbox |
| `bulkDialog` | bulk-action dialog — act-on-selected + editable entry-grid modes |
| `empty` / `loading` | states |
| `injectPanel` | safe form injection (HTML field / dashboard) |
| `fmtDate` / `fmtCurrency` / `fmtNumber` / `fmtDuration` | site-aware formatters |

Full signatures in the **API reference** below.

## Build & QA

After editing a bundle, rebuild and hard-reload Desk:

```bash
bench build --app <your_app>
bench --site <your.site> clear-cache
```

A good QA pattern: build a throwaway Desk **Page** that renders every primitive
in every variant side-by-side, and view it in both light and dark before
shipping a bundle change. (The origin project ships such a "kitchen sink" page;
it's app-specific, so it isn't bundled here — recreate it in a few minutes by
pasting the API examples below into a Page's JS.)

## Accessibility

- **Banners** carry an ARIA live role: `role="alert"` (assertive) for `danger`,
  `role="status"` (polite) for `info`/`success`/`warning`. Banner icons are
  `aria-hidden` (decorative — the text carries the meaning).
- **Pills** convey status through a text label, not colour alone.
- **Tables** use real `<table>`/`<thead>`/`<th>` semantics.
- Colour pairs (tint background + saturated foreground) come from Frappe's own
  theme tokens, which flip per light/dark — verify new combinations on your
  QA page in both themes.

---

## The token model (why it's theme- and v16-safe)

Every colour in the CSS is a **token** bound to a Frappe theme variable with a
literal fallback:

```css
--__PREFIX__-success-fg: var(--green-600, #1a8a52);
--__PREFIX__-success-bg: var(--bg-green,  #e6f4ea);
```

Consequences:

- **Follows Desk light/dark** automatically — we inherit Frappe's theme vars.
- **Survives the v16 "Espresso" re-skin** — when Frappe retunes its palette, our
  primitives move with it. No hardcoded hex to hunt down.
- **Degrades safely** — if a theme var is ever absent, the literal fallback keeps
  the component readable.

**Rule:** components reference tokens; **never write a raw hex inside a component,
and never inline a colour in a client script.** Need a new colour meaning? Add a
token in §1 of the CSS.

---

## API reference (`__NS__.ui.*`)

All builders return an **HTML string** unless noted, so they compose:
`panel(title, table(cols, rows))`. All record/caller data is escaped; pass
pre-built HTML only through the documented `render` / `html` escape hatches.

### `banner(type, message, opts?)`
Info/success/warning/danger callout.
```js
__NS__.ui.banner("warning", __("Needs review before approval"));
__NS__.ui.banner("info", htmlString, { html: true });   // trust pre-built HTML
__NS__.ui.banner("danger", msg, { icon: false });        // no icon
```

### `pill(label, opts?)` · alias `badge`
Inline status indicator. Variant is auto-derived from the status text via
`variantFor()`, or forced.
```js
__NS__.ui.pill(doc.closing_status);                 // "Won" → green
__NS__.ui.pill("Custom", { variant: "info" });      // forced
__NS__.ui.pill(label, { status: doc.status });      // derive from a different field
```

### `table(columns, rows, opts?)`
Read-only contextual list (NOT a list/report view).
```js
__NS__.ui.table(
  [
    { key: "name",   label: __("Order"),  link: "Sales Order" },
    { key: "status", label: __("Status"), pill: true },
    { key: "days",   label: __("Days Left"), num: true },
    { key: "total",  label: __("Total") },
  ],
  rows,
  { empty: __("No orders for this customer.") }
);
```
Column options: `link` (doctype string or `fn(row)`), `pill` (`true` or
`fn(row)->status`), `num`/`align:"right"`, `value:fn(row)`, `render:fn(row)->html`
(trusted escape hatch — you own escaping). `opts.scroll:false` drops the
horizontal-scroll wrapper.

### `dataTable(wrapper, columns, rows, opts?)`
Thin wrapper over **`frappe.DataTable`** when you actually need sort/filter/resize.
Returns the instance (or `null` and renders a static `ui.table()` fallback if the
library is unavailable). Prefer `table()` unless interactivity is required.
```js
__NS__.ui.dataTable(frm.fields_dict.grid_html.$wrapper, columns, rows);
```

### `resultTable(results, opts?)`
Standard success/skipped/error report for bulk actions — a summary banner plus a
detail table. Replaces every hand-built bulk-result table.
```js
__NS__.ui.resultTable([
  { name: "SUB-0001", status: "success" },
  { name: "SUB-0002", status: "skipped", reason: __("Already renewed") },
  { name: "SUB-0003", status: "error",   reason: __("No active device") },
]);
```

### `panel(title, bodyHtml, opts?)`
Card shell for a custom form section.
```js
__NS__.ui.panel(__("Related Orders"), tableHtml,
  { icon: "list", meta: __("{0} order(s)", [n]) });
```

### `empty(message, icon?)` / `loading(message?)`
Consistent empty and loading states.

### `injectPanel(frm, html, opts?)`
Put custom HTML on a form **without DOM hacks**.
```js
// Preferred: a dedicated HTML field declared in the doctype JSON
__NS__.ui.injectPanel(frm, html, { fieldname: "related_orders_html" });
// Fallback: an idempotent section in the form dashboard area
__NS__.ui.injectPanel(frm, html, { key: "related-orders" });
```
Always prefer declaring an **HTML field** in the doctype and passing `fieldname` —
it is layout-stable and survives the v16 form-view restyle. The `key` fallback
appends into `frm.dashboard.wrapper` (a sanctioned area) and is idempotent across
refreshes. Do **not** go back to `$(frm.wrapper).prepend(...)` into framework DOM.

### `variantFor(status)` / `icon(name, size)`
`variantFor` maps a status string → `success|danger|warning|info|neutral` (the one
place status colours are decided — see table below). `icon` is a safe wrapper over
`frappe.utils.icon` that returns `""` for missing names.

### `accordion(summary, bodyHtml, opts?)`
Collapsible group with a rotating caret (e.g. grouped sections / history).
```js
__NS__.ui.accordion(
  { title: __("Period 01-05-2026 → 01-06-2026"), meta: __("3 entries"), trailing: ui.pill("Approved") },
  entriesTableHtml, { open: true });
// or accordion(rawSummaryHtml, bodyHtml)
```

### `attentionStrip(items, opts?)`
Row of count-pills with rich hover tooltips — the reusable form of a list view's
"needs attention" strip. `\n` in a tooltip = line break. Pass `onClick` per item
to make pills clickable (then a jQuery node is returned and handlers bind).
```js
__NS__.ui.attentionStrip([
  { label: __("Review"), count: 7, variant: "warning", tooltip: "Missing info — 3\nOn hold — 2" },
  { label: __("Overdue"), count: 12, variant: "danger", onClick: () => {/* filter */} },
], { label: __("Needs attention:") });
```
Any pill can also carry a tooltip directly: `pill(label, { tooltip: "…\n…" })`.

### `detailList(pairs, opts?)`
Read-only two-column label:value block (snapshots / summaries). Empty values hidden
unless `opts.showEmpty`.
```js
__NS__.ui.detailList([
  { label: __("Reference"), value: "SO-2026-00042" },
  { label: __("Status"), render: () => ui.pill("Active") },   // trusted render hatch
]);
```

### `gallery(images, opts?)`
Thumbnail grid with a click-to-zoom lightbox (one global handler). Each image is a URL
string or `{ src, title }`.
```js
__NS__.ui.gallery([{ src: url, title: __("Front view") }, ...]);
```

### `bulkDialog(opts)`
Standard scaffold for the app's many bulk actions. Two combinable modes:
- **act-on-selected** — pass `count` → a "N record(s)" banner.
- **entry grid** — pass `grid` → an editable Frappe Table field (a bulk-create
  pattern; uses Frappe's native grid, not a custom one).

`action(values, dialog)` may return `[{name,status,reason}]` → rendered via
`resultTable()` in a result popup. `values.rows` holds grid rows.
```js
__NS__.ui.bulkDialog({
  title: __("Create Items (Bulk)"),
  grid: { label: __("Items"), fields: [
    { fieldtype: "Data", fieldname: "item_code", label: __("Item Code"), in_list_view: 1, reqd: 1 },
  ]},
  action: (values) => createItems(values.rows),   // returns results[]
});
```

### Formatters — `fmtDate` / `fmtCurrency` / `fmtNumber` / `fmtDuration`
Site-aware formatters (respect System Settings → Date Format, currency, number
format). Also available as **column options** on `table()`:
`{ date:true }`, `{ currency:true | "USD" }`, `{ number:true, precision }` — these
also right-align the column.

---

## Status → variant map (single source of truth)

Edit `STATUS_VARIANT` in `__PREFIX___ui.bundle.js` to change these — do not re-map colours
per screen.

| Variant | Statuses |
|---|---|
| success | won, active, completed, renewed, paid, approved, valid, passed |
| danger | lost, cancelled, expired, failed, rejected, error, overdue |
| warning | suspended, pending, on hold, due soon |
| info | in progress, open, draft, new, scheduled |
| neutral | deferred, skipped, anything unknown |

---

## Relationship to the dashboard system (`.__PREFIX__-dash-`)

Two surfaces, deliberately themed differently:

- **`__PREFIX___dashboard.bundle.css` (`.__PREFIX__-dash-`)** — standalone CEO/HTML dashboard **Pages**.
  Fixed light brand palette; it's its own branded surface. Unchanged by this work.
- **`__PREFIX___ui.bundle.css` (`.__PREFIX__-ui-`)** — custom sections **embedded in Desk forms**.
  Theme-bound so they blend with Desk (light/dark/v16).

Same design language, different palette source per surface. Keep using `.__PREFIX__-dash-`
for dashboard Pages and `.__PREFIX__-ui-` for form/dialog sections.

> **Planned convergence (follow-up, not done here):** the dashboard tokens are
> still defined independently inside `__PREFIX___dashboard.bundle.css`. A later, *tested*
> pass should point the dashboard's semantic tokens at a shared core so there's a
> single token vocabulary. Left out of this pass to avoid an untested visual
> change to the live dashboards.

---

## Adding a new primitive

1. Add the class(es) under a new `§` in `__PREFIX___ui.bundle.css`, using **tokens only**.
2. Add a matching builder to `__PREFIX___ui.bundle.js` under its own comment section.
3. Escape all caller data; expose a `render`/`html` escape hatch only if needed.
4. Document it here with a signature + example.
5. `bench build --app <your_app>`.

When you find hand-built UI in a client script (raw `<table>` / inline `<style>` /
hardcoded hex status badges), replace it with the matching `__NS__.ui.*` builder —
that's the whole point: one source of truth instead of drifting copies.
