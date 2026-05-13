const fs = require("fs");
const path = require("path");
const { getDb } = require("../config/database");

function resolveCurrentDbPath(db) {
  const row = db.prepare("PRAGMA database_list").all().find((entry) => entry.name === "main");
  if (!row?.file) {
    throw new Error("Unable to resolve database path");
  }
  return row.file;
}

function performBackup() {
  const db = getDb();
  const dbPath = resolveCurrentDbPath(db);
  const settings = db.prepare("SELECT auto_backup_path FROM settings WHERE id = 1").get();
  const configuredDir = String(settings?.auto_backup_path || "").trim();
  const rootBackupDir = configuredDir || path.join(process.cwd(), "backups");
  const now = new Date();
  const backupDir = path.join(
    rootBackupDir,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  );

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `retailer-backup-${timestamp}.db`);

  db.pragma("wal_checkpoint(TRUNCATE)");
  fs.copyFileSync(dbPath, dest);

  return dest;
}

function isLikelySqliteFile(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 16).toString("utf8");
  return header === "SQLite format 3\0";
}

module.exports = { performBackup, resolveCurrentDbPath, isLikelySqliteFile };
