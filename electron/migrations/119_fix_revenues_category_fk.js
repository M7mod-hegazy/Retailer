/**
 * Fix revenues.category_id FK: was pointing to expense_categories(id) since
 * migration 004, but should point to revenue_categories(id) which was added
 * in migration 011.
 *
 * On databases with PRAGMA foreign_keys = ON (set in dbManager.js), inserting
 * a revenue with a category_id from revenue_categories fails with a foreign
 * key violation when expense_categories has no matching row.
 */
function up(db) {
  const fks = db.prepare("PRAGMA foreign_key_list(revenues)").all();
  const badFk = fks.find(
    (fk) => fk.table === "expense_categories" && fk.from === "category_id"
  );
  if (!badFk) return;

  db.exec("PRAGMA foreign_keys = OFF");

  db.exec(`
    CREATE TABLE revenues_new (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      amount          INTEGER NOT NULL,
      category_id     INTEGER REFERENCES revenue_categories(id),
      notes           TEXT,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
      description     TEXT,
      payment_method  TEXT DEFAULT 'cash',
      treasury_id     INTEGER,
      bank_id         INTEGER,
      doc_no          TEXT,
      updated_at      TEXT,
      attachment_url  TEXT,
      created_by      INTEGER REFERENCES users(id)
    )
  `);

  db.exec(`
    INSERT INTO revenues_new
      (id, amount, category_id, notes, created_at, description,
       payment_method, treasury_id, bank_id, doc_no, updated_at,
       attachment_url, created_by)
    SELECT
      id, amount, category_id, notes, created_at, description,
      payment_method, treasury_id, bank_id, doc_no, updated_at,
      attachment_url, created_by
    FROM revenues
  `);

  db.exec("DROP TABLE revenues");
  db.exec("ALTER TABLE revenues_new RENAME TO revenues");

  db.exec("PRAGMA foreign_keys = ON");
}

module.exports = { up };
