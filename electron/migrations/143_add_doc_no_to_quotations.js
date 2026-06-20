module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(quotations)").all().map(c => c.name);
    if (!cols.includes("doc_no")) {
      db.exec("ALTER TABLE quotations ADD COLUMN doc_no TEXT");
    }
    db.transaction(() => {
      const rows = db.prepare("SELECT id FROM quotations WHERE doc_no IS NULL").all();
      const upd = db.prepare("UPDATE quotations SET doc_no = ? WHERE id = ?");
      for (const row of rows) {
        upd.run(`QTN-${String(row.id).padStart(5, "0")}`, row.id);
      }
    })();
  }
};
