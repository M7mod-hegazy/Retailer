// Pure helpers for the per-doc print layout JSON stored in
// print_settings_per_doc.settings (shape: { ..flat fields, layout: { roll, page } },
// each family = { order, inserted, perBlock, columns?, margins }).
//
// CommonJS so both the server-side migration and the Vite client (ESM interop)
// can share the exact same logic. Keep this file dependency-free and pure.

/**
 * Canonicalize one saved settings object (NON-mutating).
 *
 * History: the designer used to save the items-table column config under
 * `layout.<family>.columns.items_table`, but the print renderer only ever read
 * `layout.<family>.perBlock.items_table.columns` — so column edits looked right
 * in the designer preview and were silently dropped on paper. The canonical
 * location is perBlock; this moves any legacy `columns` payload there.
 *
 * Idempotent: normalized input comes back structurally unchanged. On conflict
 * the legacy `columns` value wins — it was the designer's latest visible state.
 * Returns { changed, settings }.
 */
function normalizeLayout(settings) {
  if (!settings || typeof settings !== "object" || !settings.layout || typeof settings.layout !== "object") {
    return { changed: false, settings };
  }
  let changed = false;
  const layout = {};
  Object.keys(settings.layout).forEach((family) => {
    const fam = settings.layout[family];
    if (!fam || typeof fam !== "object") { layout[family] = fam; return; }
    const legacyCols = fam.columns && fam.columns.items_table;
    if (!legacyCols) {
      // Nothing to migrate; still drop an empty legacy `columns` bag if present.
      if (fam.columns && Object.keys(fam.columns).length === 0) {
        const { columns: _unused, ...rest } = fam;
        layout[family] = rest;
        changed = true;
      } else {
        layout[family] = fam;
      }
      return;
    }
    const perBlock = { ...(fam.perBlock || {}) };
    perBlock.items_table = { ...(perBlock.items_table || {}), columns: legacyCols };
    const { columns: _dropped, ...rest } = fam;
    const remainingCols = { ...(fam.columns || {}) };
    delete remainingCols.items_table;
    layout[family] = Object.keys(remainingCols).length
      ? { ...rest, perBlock, columns: remainingCols }
      : { ...rest, perBlock };
    changed = true;
  });
  return changed
    ? { changed: true, settings: { ...settings, layout } }
    : { changed: false, settings };
}

/**
 * Merge a global (_global scope) family layout with a per-doc family layout.
 * Per-doc wins wherever it explicitly says something:
 *  - order: doc order if non-empty, else global, else null (caller defaults)
 *  - perBlock: per-key shallow merge, doc keys over global keys
 *  - inserted: global inserts first, then doc inserts (doc wins on id clash)
 *  - margins: doc keys over global keys
 * Either argument may be null/undefined. Pure, non-mutating.
 */
function mergeFamilyLayouts(globalFam, docFam) {
  const gf = globalFam && typeof globalFam === "object" ? globalFam : {};
  const df = docFam && typeof docFam === "object" ? docFam : {};
  const order = Array.isArray(df.order) && df.order.length ? df.order
    : Array.isArray(gf.order) && gf.order.length ? gf.order
    : null;
  const perBlock = {};
  const gpb = gf.perBlock || {};
  const dpb = df.perBlock || {};
  new Set([...Object.keys(gpb), ...Object.keys(dpb)]).forEach((k) => {
    perBlock[k] = { ...(gpb[k] || {}), ...(dpb[k] || {}) };
  });
  const gIns = Array.isArray(gf.inserted) ? gf.inserted : [];
  const dIns = Array.isArray(df.inserted) ? df.inserted : [];
  const dIds = new Set(dIns.map((b) => b && b.id));
  const inserted = [...gIns.filter((b) => b && !dIds.has(b.id)), ...dIns];
  const margins = { ...(gf.margins || {}), ...(df.margins || {}) };
  const out = { perBlock, inserted, margins };
  if (order) out.order = order;
  return out;
}

module.exports = { normalizeLayout, mergeFamilyLayouts };
