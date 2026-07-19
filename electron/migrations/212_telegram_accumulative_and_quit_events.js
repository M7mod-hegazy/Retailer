function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map(c => c.name);

  if (!cols.includes("notify_app_quit")) {
    db.exec(`ALTER TABLE telegram_recipients ADD COLUMN notify_app_quit INTEGER NOT NULL DEFAULT 1`);
  }
  if (!cols.includes("notify_user_logout")) {
    db.exec(`ALTER TABLE telegram_recipients ADD COLUMN notify_user_logout INTEGER NOT NULL DEFAULT 1`);
  }
}

module.exports = { up, name: "212_telegram_accumulative_and_quit_events" };
