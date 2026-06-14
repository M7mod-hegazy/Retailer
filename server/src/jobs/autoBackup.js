const { performBackup } = require("../services/backupService");
const { getDb } = require("../config/database");

// Interval/staleness-based auto-backup engine.
//
// The old design fired a backup only when the wall clock matched one configured
// minute (default 02:00). On a retail PC that is powered off overnight that
// backup never ran. This engine instead asks "is a backup DUE?" at several safe
// moments — app launch, an hourly tick while running, and on graceful close —
// all routed through runDueBackupIfNeeded(). A backup is due when the newest
// auto-backup is older than the configured interval (default 24h).

const DEFAULT_INTERVAL_HOURS = 24;

// On graceful close we want the day's final work captured, but without spamming
// a backup if one was just taken (e.g. the user clicked "backup now" then quit).
const CLOSE_MIN_AGE_MS = 30 * 60 * 1000; // 30 minutes

let hourlyTimer = null;

function readSettings(db) {
  try {
    return db
      .prepare(
        "SELECT auto_backup_enabled, auto_backup_interval_hours, last_auto_backup_at FROM settings WHERE id = 1",
      )
      .get();
  } catch {
    return null;
  }
}

function intervalMs(settings) {
  const hours = Number(settings?.auto_backup_interval_hours);
  const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_INTERVAL_HOURS;
  return safe * 60 * 60 * 1000;
}

// ms since the last successful auto-backup. A missing/blank anchor means
// "never" → treated as infinitely stale so the first due-check backs up once.
function ageSinceLastBackup(settings, now) {
  const raw = settings?.last_auto_backup_at;
  if (!raw) return Infinity;
  const then = new Date(raw).getTime();
  if (!Number.isFinite(then)) return Infinity;
  return now - then;
}

function stampLastBackup(db, iso) {
  try {
    db.prepare("UPDATE settings SET last_auto_backup_at = ? WHERE id = 1").run(iso);
  } catch {
    /* settings shape may vary — non-fatal */
  }
}

/**
 * Run an auto-backup if one is due. Safe to call from any context (launch,
 * timer, before-quit) — it never throws.
 *
 * @param {object}  opts
 * @param {string}  opts.reason     label written into the sidecar
 * @param {number}  [opts.minAgeMs] override the "due" threshold (e.g. shorter on close)
 * @returns {boolean} whether a backup was actually written
 */
function runDueBackupIfNeeded(opts = {}) {
  const { reason = "auto", minAgeMs } = opts;
  try {
    const db = getDb();
    const settings = readSettings(db);
    if (!settings?.auto_backup_enabled) return false;

    const now = Date.now();
    const threshold = Number.isFinite(minAgeMs) ? minAgeMs : intervalMs(settings);
    if (ageSinceLastBackup(settings, now) < threshold) return false;

    const result = performBackup({ triggerType: "auto", label: reason });
    stampLastBackup(db, result?.summary?.createdAt || new Date().toISOString());
    return true;
  } catch {
    // Never let an auto-backup failure crash the caller (esp. before-quit).
    return false;
  }
}

// Synchronous, throttled backup for app shutdown — captures the latest work on
// a graceful quit. Returns whether a backup was written.
function runCloseBackup() {
  return runDueBackupIfNeeded({ reason: "auto (on close)", minAgeMs: CLOSE_MIN_AGE_MS });
}

// Launch catch-up + hourly due-check while the app stays running.
function startAutoBackupJob() {
  // Launch catch-up: back up immediately if the last backup is stale.
  runDueBackupIfNeeded({ reason: "auto (launch catch-up)" });

  // Always-on PCs never trigger launch/close — re-check hourly so they still
  // get a daily backup. unref so the timer can't keep the process alive.
  if (hourlyTimer) clearInterval(hourlyTimer);
  hourlyTimer = setInterval(() => {
    runDueBackupIfNeeded({ reason: "auto (scheduled)" });
  }, 60 * 60 * 1000);
  if (typeof hourlyTimer.unref === "function") hourlyTimer.unref();

  return hourlyTimer;
}

function stopAutoBackupJob() {
  if (hourlyTimer) {
    clearInterval(hourlyTimer);
    hourlyTimer = null;
  }
}

module.exports = {
  startAutoBackupJob,
  stopAutoBackupJob,
  runDueBackupIfNeeded,
  runCloseBackup,
};
