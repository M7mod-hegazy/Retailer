// Templates were channel-agnostic text, reused for both WhatsApp and SMS
// campaigns. Users couldn't tell which channel a template was written for.
// Adds an explicit channel per template so the UI can label and filter it.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "175_message_template_channel",
  up(db) {
    addColumnIfMissing(db, "message_templates", "channel", "TEXT NOT NULL DEFAULT 'both'");
    // System templates (receipt/birthday/debt) are only ever sent through the
    // WhatsApp engine (see whatsappCrm.routes.js send-test) — label them as such.
    db.prepare("UPDATE message_templates SET channel='whatsapp' WHERE kind IN ('receipt','birthday','debt')").run();
  },
};
