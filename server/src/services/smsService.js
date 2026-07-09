// SMS channel — generic paid HTTP-gateway sender + outbox drainer.
// Inert until settings.sms_enabled=1 AND sms_api_url is configured; nothing
// runs and nothing changes for stores that only use WhatsApp.
//
// Gateway contract (fits SMS Misr / Cequens / Twilio-proxy style endpoints):
//   POST sms_api_url with a JSON body built from sms_body_template, where
//   {phone} {message} {sender} {api_key} are substituted. Default template:
//   {"to":"{phone}","message":"{message}","sender":"{sender}","api_key":"{api_key}"}
//   The api key is also sent as an Authorization: Bearer header.
//   Any 2xx response counts as sent.
const { getDb } = require("../config/database");
const logger = require("../config/logger");
const { markRecipient, isRecipientPaused } = require("./campaignProgress");

const DEFAULT_BODY_TEMPLATE = '{"to":"{phone}","message":"{message}","sender":"{sender}","api_key":"{api_key}"}';

function getSmsConfig(db) {
  try {
    const s = db.prepare("SELECT sms_enabled, sms_api_url, sms_api_key, sms_sender, sms_body_template FROM settings WHERE id=1").get();
    if (!s || !s.sms_enabled || !s.sms_api_url) return null;
    return s;
  } catch (_) { return null; } // columns missing → migration 170 not applied yet
}

function isSmsEnabled() {
  return Boolean(getSmsConfig(getDb()));
}

function fillTemplate(template, vars) {
  return template.replace(/\{(phone|message|sender|api_key)\}/g, (_, k) =>
    JSON.stringify(String(vars[k] ?? "")).slice(1, -1) // JSON-escape the value, drop wrapping quotes
  );
}

async function sendSms(config, phone, message) {
  const template = (config.sms_body_template || "").trim() || DEFAULT_BODY_TEMPLATE;
  const body = fillTemplate(template, {
    phone,
    message,
    sender: config.sms_sender || "",
    api_key: config.sms_api_key || "",
  });
  const headers = { "Content-Type": "application/json" };
  if (config.sms_api_key) headers.Authorization = `Bearer ${config.sms_api_key}`;
  const resp = await fetch(config.sms_api_url, { method: "POST", headers, body });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`SMS gateway ${resp.status}: ${text.slice(0, 150)}`);
  }
}

// ─── Outbox drainer (channel='sms') ─────────────────────────────────────────
let drainerTimer = null;
let draining = false;

async function drainNext() {
  if (draining) return;
  draining = true;
  let claimed = null;
  const db = getDb();
  try {
    const config = getSmsConfig(db);
    if (!config) return;

    const candidates = db.prepare(`
      SELECT * FROM wa_outbox
      WHERE status = 'pending' AND channel = 'sms'
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
      ORDER BY id ASC LIMIT 10
    `).all();
    const row = candidates.find(r => !(r.campaign_recipient_id && isRecipientPaused(db, r.campaign_recipient_id)));
    if (!row) return;

    const res = db.prepare("UPDATE wa_outbox SET status='sending' WHERE id=? AND status='pending'").run(row.id);
    if (res.changes !== 1) return;
    claimed = row;

    const payload = JSON.parse(row.payload || "{}");
    if (!payload.text) throw new Error("empty sms payload");
    await sendSms(config, row.recipient_phone, payload.text);

    db.prepare("UPDATE wa_outbox SET status='sent', sent_at=datetime('now'), attempts=attempts+1 WHERE id=?").run(row.id);
    markRecipient(db, row.campaign_recipient_id, "sent");
    claimed = null;
  } catch (err) {
    try {
      if (claimed) {
        const attempts = (claimed.attempts || 0) + 1;
        const status = attempts >= 3 ? "failed" : "pending";
        db.prepare("UPDATE wa_outbox SET status=?, attempts=?, error=? WHERE id=?")
          .run(status, attempts, String(err.message).slice(0, 200), claimed.id);
        if (status === "failed") markRecipient(db, claimed.campaign_recipient_id, "skipped");
      } else {
        logger.error({ message: "SMS drainer tick failed", error: err.message });
      }
    } catch (_) {}
  } finally { draining = false; }
}

function startSmsDrainer() {
  if (drainerTimer) return;
  try { getDb().prepare("UPDATE wa_outbox SET status='pending' WHERE status='sending' AND channel='sms'").run(); } catch (_) {}
  drainerTimer = setInterval(() => { drainNext().catch(() => {}); }, 6000);
}

module.exports = { startSmsDrainer, sendSms, getSmsConfig, isSmsEnabled };
