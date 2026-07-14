// Scheduled Telegram analytics digests with catch-up-on-launch.
// This is a desktop app that is closed outside business hours, so instead of a
// fire-at-a-fixed-time cron we check on boot (and every few hours) whether the
// just-completed period's digest has been sent; if not, we send it now. A
// per-(period_type, period_key) row in telegram_digest_log guarantees each
// digest is delivered exactly once.
const logger = require("../config/logger");
const { getDb } = require("../config/database");
const { getTelegramConfig, getTelegramRecipients, getLegacyTelegramConfig, isDigestEnabledForRecipient, sendTelegramMessage, enqueueNotification } = require("../services/telegramService");
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

function sendDigestToRecipients(db, config, text, periodType) {
  const recipients = getTelegramRecipients(db);
  if (recipients.length > 0) {
    for (const recipient of recipients) {
      if (!isDigestEnabledForRecipient(recipient, periodType)) continue;
      sendTelegramMessage(config, recipient.chatId, text).catch((err) => {
        logger.warn({ message: "Telegram digest send failed, enqueued for retry", chatId: recipient.chatId, type: periodType, error: err.message });
        try { enqueueNotification(db, `digest_${periodType}`, recipient.chatId, text, {}); } catch (_) {}
      });
    }
    return;
  }

  // Legacy fallback.
  const legacy = getLegacyTelegramConfig(db);
  if (legacy && legacy.enabled && rowForPeriod(legacy, periodType)) {
    sendTelegramMessage(legacy, legacy.chatId, text).catch((err) => {
      logger.warn({ message: "Telegram digest send failed, enqueued for retry", type: periodType, error: err.message });
      try { enqueueNotification(db, `digest_${periodType}`, legacy.chatId, text, {}); } catch (_) {}
    });
  }
}

function rowForPeriod(legacy, periodType) {
  switch (periodType) {
    case "weekly": return legacy.notifyWeekly;
    case "monthly": return legacy.notifyMonthly;
    case "yearly": return legacy.notifyYearly;
    default: return false;
  }
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
    // With recipients table, period enablement is per-recipient; if no recipients
    // yet, fall back to the settings toggle.
    const recipients = getTelegramRecipients(db);
    const legacyEnabled = row[p.col];
    const anyEnabled = recipients.length > 0
      ? recipients.some((r) => r.enabled && isDigestEnabledForRecipient(r, p.type))
      : legacyEnabled;
    if (!anyEnabled) continue;

    let bounds;
    try { bounds = completedPeriodBounds(p.type); } catch (_) { continue; }
    if (alreadySent(db, p.type, bounds.key)) continue;

    const category = `telegram_${p.type}_digest`;
    let templateBody = "";
    try {
      const row = db.prepare("SELECT body FROM message_templates WHERE kind=?").get(category);
      templateBody = row?.body || "";
    } catch (_) {}

    let text;
    try { text = buildDigest(db, p.type, bounds, { currencySymbol: currency, branch, templateBody }); }
    catch (e) { logger.warn({ message: "Telegram digest build failed", type: p.type, error: e.message }); continue; }

    // Mark sent immediately so a slow/failed send can't cause a duplicate on the
    // next tick; on failure we hand the message to the existing retry queue.
    markSent(db, p.type, bounds.key);
    sendDigestToRecipients(db, config, text, p.type);
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
