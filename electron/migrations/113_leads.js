// Leads table — lightweight marketing contacts captured at the POS (walk-bys + anonymous sales).
// Separate from `customers`: a lead is someone who has NOT transacted as a named customer.
// All writes upsert on phone_normalized (UNIQUE) so the same number never duplicates.
module.exports = {
  name: "113_leads",
  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS leads (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_normalized  TEXT NOT NULL UNIQUE,      -- digits only, country-coded (e.g. 201001234567)
        phone_raw         TEXT,                       -- as entered, for display
        name              TEXT,
        note              TEXT,
        birthday          TEXT,                       -- YYYY-MM-DD
        tags              TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
        source            TEXT NOT NULL DEFAULT 'pos_sale', -- pos_sale | quick_add | import
        last_purchase_item     TEXT,
        last_purchase_category TEXT,
        last_contacted_at TEXT,
        opted_out         INTEGER NOT NULL DEFAULT 0,
        promoted_customer_id INTEGER,                 -- set when the lead becomes a real customer
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_normalized)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_leads_optout ON leads(opted_out)`).run();
  },
};
