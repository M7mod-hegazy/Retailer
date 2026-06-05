const cron = require("node-cron");
const { performBackup } = require("../services/backupService");
const { getDb } = require("../config/database");

// In-memory guard so we run at most once per configured minute.
let lastRunKey = null;

function currentHHMM(now) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function startAutoBackupJob() {
  // Tick every minute; run when the clock matches the configured daily time.
  return cron.schedule("* * * * *", () => {
    try {
      const db = getDb();
      const settings = db
        .prepare("SELECT auto_backup_enabled, auto_backup_time FROM settings WHERE id = 1")
        .get();
      if (!settings?.auto_backup_enabled) return;

      const now = new Date();
      const target = String(settings.auto_backup_time || "02:00").trim();
      if (currentHHMM(now) !== target) return;

      const runKey = `${now.toDateString()} ${target}`;
      if (runKey === lastRunKey) return; // already ran this minute

      const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'open' LIMIT 1").get();
      if (activeShift) return; // skip while a shift is open

      lastRunKey = runKey;
      performBackup({ triggerType: "auto", label: null });
    } catch {
      // never let the scheduler crash the process
    }
  });
}

module.exports = { startAutoBackupJob };
