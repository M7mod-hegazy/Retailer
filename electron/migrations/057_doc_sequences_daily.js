module.exports = {
  up(db) {
    // Add 'day' column (YYYYMMDD string) to document_sequences for daily-reset counters
    try { db.exec(`ALTER TABLE document_sequences ADD COLUMN day TEXT NOT NULL DEFAULT '';`); } catch(e) {}

    // Update prefixes to agreed values: INV (POS), PUR (purchases), SRT (sales returns), PRT (purchase returns)
    db.exec(`
      INSERT OR REPLACE INTO settings_kv (key, value) VALUES
        ('doc_prefix_pos_sale',         'INV'),
        ('doc_prefix_purchase_receipt', 'PUR'),
        ('doc_prefix_sales_return',     'SRT'),
        ('doc_prefix_purchase_return',  'PRT');
    `);
  },
  down(db) {
    // SQLite cannot drop columns — prefix rollback only
    db.exec(`
      INSERT OR REPLACE INTO settings_kv (key, value) VALUES
        ('doc_prefix_pos_sale',         'SEL'),
        ('doc_prefix_purchase_receipt', 'PR'),
        ('doc_prefix_sales_return',     'SRET'),
        ('doc_prefix_purchase_return',  'PRET');
    `);
  },
};
