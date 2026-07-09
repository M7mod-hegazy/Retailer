// SMS channel activation + campaign→outbox linkage.
// - settings: SMS gateway config (generic paid HTTP gateway; inert until sms_enabled=1)
// - wa_outbox: campaign_recipient_id so the drainers can report progress back to
//   campaign_recipients / campaigns (previously campaigns showed 0% forever).
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "170_sms_and_campaign_links",
  up(db) {
    addColumnIfMissing(db, "settings", "sms_enabled", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "sms_api_url", "TEXT");
    addColumnIfMissing(db, "settings", "sms_api_key", "TEXT");
    addColumnIfMissing(db, "settings", "sms_sender", "TEXT");
    addColumnIfMissing(db, "settings", "sms_body_template", "TEXT");

    addColumnIfMissing(db, "wa_outbox", "campaign_recipient_id", "INTEGER");
    db.prepare("CREATE INDEX IF NOT EXISTS idx_wa_outbox_pending ON wa_outbox(status, channel)").run();

    // Custom (user-created) templates carry a display label; system kinds
    // (receipt/birthday/debt) keep their fixed labels in the UI.
    addColumnIfMissing(db, "message_templates", "label", "TEXT");

    // Walk-in contact captured at the POS is stamped on the invoice itself so
    // invoice details/amend can show who the anonymous sale belonged to.
    addColumnIfMissing(db, "invoices", "walk_in_phone", "TEXT");
    addColumnIfMissing(db, "invoices", "walk_in_name", "TEXT");
  },
};
