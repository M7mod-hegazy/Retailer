// Canonicalize saved print layouts: the designer used to store items-table
// column config under layout.<family>.columns.items_table, which the print
// renderer never read (it reads layout.<family>.perBlock.items_table.columns).
// Move every legacy payload to the canonical location so old designs finally
// print the way their preview looked. Safe to re-run: normalizeLayout is
// idempotent, and rows without the legacy shape are left untouched.
const { normalizeLayout } = require("../../shared/printLayout");

function up(db) {
  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='print_settings_per_doc'")
    .get();
  if (!hasTable) return; // table is created lazily by the route on first use

  const rows = db.prepare("SELECT doc_type, settings FROM print_settings_per_doc").all();
  const update = db.prepare("UPDATE print_settings_per_doc SET settings = ? WHERE doc_type = ?");
  rows.forEach((row) => {
    let parsed;
    try { parsed = JSON.parse(row.settings || "{}"); }
    catch { return; } // unparseable row: leave as-is rather than destroy it
    const { changed, settings } = normalizeLayout(parsed);
    if (changed) update.run(JSON.stringify(settings), row.doc_type);
  });
}

module.exports = { up };
