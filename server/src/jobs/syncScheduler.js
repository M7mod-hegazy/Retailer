const cron = require("node-cron");
const { getDb } = require("../config/database");
const logger = require("../config/logger");
const syncRoutes = require("../routes/sync.routes");

// Guard so overlapping ticks (a slow pull) never run concurrently.
let running = false;

async function runAutoSync() {
  const db = getDb();
  const cfg = db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
  if (!cfg || !cfg.auto_sync_enabled) return;

  // Respect the configured interval instead of firing every minute.
  const interval = Math.max(1, Number(cfg.sync_interval_minutes) || 30);
  if (cfg.last_auto_sync_at) {
    // SQLite datetime('now') → "YYYY-MM-DD HH:MM:SS" (UTC). Normalize to ISO.
    const last = new Date(cfg.last_auto_sync_at.replace(" ", "T") + "Z").getTime();
    const elapsedMin = (Date.now() - last) / 60000;
    if (Number.isFinite(elapsedMin) && elapsedMin < interval) return;
  }

  if (running) return;
  running = true;
  try {
    const res = await syncRoutes.autoPullAll(db);
    // Only stamp last_auto_sync_at on a real attempt (not "not configured").
    if (res && res.ok) {
      db.prepare("UPDATE sync_config SET last_auto_sync_at = datetime('now') WHERE id = ?").run(cfg.id);
      logger.info({ message: "Auto-sync completed", imported: res.imported, failed: res.failed });
    } else if (res && res.error) {
      logger.warn({ message: "Auto-sync failed", error: res.error });
    }
  } catch (err) {
    logger.error({ message: "Auto-sync error", error: err.message, stack: err.stack });
  } finally {
    running = false;
  }
}

function startSyncScheduler() {
  // Tick every minute; runAutoSync internally enforces sync_interval_minutes.
  return cron.schedule("* * * * *", () => { runAutoSync(); }, { scheduled: true });
}

module.exports = { startSyncScheduler };
