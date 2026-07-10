// Scheduled Telegram analytics digests with catch-up-on-launch.
// This is a desktop app that is closed outside business hours, so instead of a
// fire-at-a-fixed-time cron we check on boot (and every few hours) whether the
// just-completed period's digest has been sent; if not, we send it now. A
// per-(period_type, period_key) row in telegram_digest_log guarantees each
// digest is delivered exactly once.
const logger = require("../config/logger");
const { getDb } = require("../config/database");
const { getTelegramConfig, sendTelegramMessage, enqueueNotification } = require("../services/telegramService");
const { completedPeriodBounds, buildDigest } = require("../services/telegramDigest");

const PERIODS = [
  { type: "weekly", col: "telegram_notify_weekly" },
  { type: "monthly", col: "telegram_notify_monthly" },
  { type: "yearly", col: "telegram_notify_yearly" },
];

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

function alreadySent(db, type, key) {
  try {
    return Boolean(db.prepare("SELECT 1 FROM telegram_digest_log WHERE period_type=? AND period_key=?").get(type, key));
  } catch (_) {
    return true; // table missing (un-migrated) — treat as "sent" so we never crash/spam
  }
}

function markSent(db, type, key) {
  try {
    db.prepare("INSERT OR IGNORE INTO telegram_digest_log (period_type, period_key) VALUES (?,?)").run(type, key);
  } catch (_) {}
}

// For each enabled period, send the completed-period digest once. Exported for tests.
function runDueDigests(dbArg) {
  const db = dbArg || getDb();
  const config = getTelegramConfig(db);
  if (!config || !config.enabled) return;

  let row;
  try { row = db.prepare("SELECT * FROM settings WHERE id = 1").get(); } catch (_) { return; }
  if (!row) return;
  const currency = row.currency_symbol || "ج";
  const branch = row.store_name || row.shop_name || row.company_name || "";

  for (const p of PERIODS) {
    if (!row[p.col]) continue;

    let bounds;
    try { bounds = completedPeriodBounds(p.type); } catch (_) { continue; }
    if (alreadySent(db, p.type, bounds.key)) continue;

    let text;
    try { text = buildDigest(db, p.type, bounds, { currencySymbol: currency, branch }); }
    catch (e) { logger.warn({ message: "Telegram digest build failed", type: p.type, error: e.message }); continue; }

    // Mark sent immediately so a slow/failed send can't cause a duplicate on the
    // next tick; on failure we hand the message to the existing retry queue.
    markSent(db, p.type, bounds.key);
    sendTelegramMessage(config, text).catch((err) => {
      logger.warn({ message: "Telegram digest send failed, enqueued for retry", type: p.type, error: err.message });
      try { enqueueNotification(db, `digest_${p.type}`, text, {}); } catch (_) {}
    });
  }
}

let timer = null;

function startTelegramDigestJob() {
  if (timer) return;
  // Catch-up shortly after boot (let migrations + settings settle).
  setTimeout(() => { try { runDueDigests(); } catch (_) {} }, 10000);
  timer = setInterval(() => { try { runDueDigests(); } catch (_) {} }, CHECK_INTERVAL_MS);
}

module.exports = { runDueDigests, startTelegramDigestJob };
