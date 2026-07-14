// Split the single notify_repair_order column into three individual columns
// (notify_repair_created / notify_repair_ready / notify_repair_delivered) so
// each repair event can be toggled independently in the UI.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function dropColumnIfExists(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (cols.includes(column)) {
    // SQLite cannot drop columns directly; recreate the table without it.
    const otherCols = cols.filter((c) => c !== column).map((c) => `"${c}"`).join(", ");
    db.prepare(`CREATE TABLE ${table}_tmp AS SELECT ${otherCols} FROM ${table}`).run();
    db.prepare(`DROP TABLE ${table}`).run();
    db.prepare(`ALTER TABLE ${table}_tmp RENAME TO ${table}`).run();
  }
}

module.exports = {
  name: "197_split_repair_notification_columns",
  up(db) {
    // 1. Add the three individual columns if missing.
    addColumnIfMissing(db, "telegram_recipients", "notify_repair_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_repair_ready", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_repair_delivered", "INTEGER NOT NULL DEFAULT 1");

    // 2. Migrate old notify_repair_order value into the new columns.
    const hasOld = db.prepare("PRAGMA table_info(telegram_recipients)").all().some((c) => c.name === "notify_repair_order");
    if (hasOld) {
      db.prepare(`
        UPDATE telegram_recipients SET
          notify_repair_created = COALESCE(notify_repair_order, 1),
          notify_repair_ready = COALESCE(notify_repair_order, 1),
          notify_repair_delivered = COALESCE(notify_repair_order, 1)
      `).run();
      // 3. Remove the old grouped column.
      dropColumnIfExists(db, "telegram_recipients", "notify_repair_order");
    }

    // 4. Keep legacy settings columns in sync.
    addColumnIfMissing(db, "settings", "telegram_notify_repair_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_repair_ready", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_repair_delivered", "INTEGER NOT NULL DEFAULT 1");
  },
};
