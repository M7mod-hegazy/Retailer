module.exports = {
  up(db) {
    try { db.exec("ALTER TABLE invoices ADD COLUMN cancelled_at TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN cancelled_by INTEGER REFERENCES users(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN cancel_reason TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN amendment_of INTEGER REFERENCES invoices(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN amended_by INTEGER REFERENCES invoices(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN cancelled_at TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN cancelled_by INTEGER REFERENCES users(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN cancel_reason TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN amendment_of INTEGER REFERENCES purchases(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN amended_by INTEGER REFERENCES purchases(id)"); } catch (_) {}
  },
};
