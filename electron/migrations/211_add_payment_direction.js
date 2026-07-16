function up(db) {
  const cols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name);
  if (!cols.includes("direction")) {
    db.exec(`ALTER TABLE payments ADD COLUMN direction TEXT NOT NULL DEFAULT 'subtract'`);
  }
}

module.exports = { up, name: "211_add_payment_direction" };
