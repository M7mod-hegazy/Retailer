const cron = require("node-cron");
const { performBackup } = require("../services/backupService");
const { getDb } = require("../config/database");

function startAutoBackupJob() {
  return cron.schedule("0 */6 * * *", () => {
    const db = getDb();
    const settings = db.prepare("SELECT auto_backup_enabled FROM settings WHERE id = 1").get();
    const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'open' LIMIT 1").get();
    if (settings?.auto_backup_enabled && !activeShift) {
      performBackup();
    }
  });
}

module.exports = { startAutoBackupJob };
