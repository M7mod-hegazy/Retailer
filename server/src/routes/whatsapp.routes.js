const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission, requireAnyPagePermission, requireAnyPageAction } = require("../middleware/permission");
const { nowSql } = require("../utils/datetime");
const { sendSms, getSmsConfig } = require("../services/smsService");
const { getTelegramConfig } = require("../services/telegramService");

// Load the WhatsApp engine — works in Electron and plain Node
let engine = null;
try { engine = require("../../../electron/whatsapp/engine"); } catch (_) {}

const router = express.Router();
router.use(authRequired);

// ── Engine control via REST (works in browser + Electron) ─────────────────────

// The engine is driven from both the settings page and the WhatsApp CRM page —
// either permission is enough (a CRM-only user used to get a 403 here and the
// CRM page wrongly showed "غير متاح").
router.get("/engine-status", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), (_req, res) => {
  if (!engine) return res.json({ success: true, data: { status: "unavailable" } });
  res.json({ success: true, data: engine.getStatus() });
});

// Aggregated connection status for WhatsApp, SMS and Telegram — used by the
// dashboard's small status indicator so it doesn't need three round trips.
router.get("/channels-status", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), (_req, res) => {
  try {
    const db = getDb();
    const waStatus = engine ? engine.getStatus() : { status: "unavailable" };
    const smsConfig = getSmsConfig(db);
    const tgConfig = getTelegramConfig(db);
    // Email config
    let emailOn = false;
    try { emailOn = Boolean(db.prepare("SELECT email_enabled FROM settings WHERE id = 1").get()?.email_enabled); } catch (_) {}
    // Meta Ads config
    let metaOn = false;
    try { metaOn = Boolean(db.prepare("SELECT id FROM meta_ads_config WHERE is_active = 1 LIMIT 1").get()); } catch (_) {}
    res.json({
      success: true,
      data: {
        whatsapp: { connected: waStatus.status === "connected", status: waStatus.status, phone: engine?.getStatus?.()?.phone || null },
        sms: { connected: Boolean(smsConfig) },
        telegram: { connected: Boolean(tgConfig?.enabled) },
        email: { connected: emailOn },
        meta: { connected: metaOn },
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/engine-connect", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (_req, res) => {
  if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
  try { await engine.connect(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/engine-disconnect", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (_req, res) => {
  if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
  try { await engine.disconnect(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// SMS gateway test-send (uses the saved settings; fails fast with the gateway error)
router.post("/sms-test", requirePagePermission("settings", "edit"), async (req, res) => {
  try {
    const config = getSmsConfig(getDb());
    if (!config) return res.status(400).json({ success: false, message: "خدمة SMS غير مفعّلة أو رابط البوابة غير مضبوط" });
    const normalized = normalizePhone(req.body?.phone);
    if (!normalized) return res.status(400).json({ success: false, message: "invalid phone" });
    await sendSms(config, normalized, req.body?.text || "رسالة تجريبية من نظام المتجر");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = "2" + d;
  if (!d.startsWith("2") && d.length === 10) d = "20" + d;
  return d.length >= 10 ? d : null;
}

// Find or create a lightweight customer by phone
router.post("/find-or-create-customer", requirePagePermission("pos", "add"), (req, res) => {
  try {
    const db = getDb();
    const { phone, name, birthday, capture_source = "pos", marketing_opt_in = 0 } = req.body;
    const normalized = normalizePhone(phone);
    if (!normalized) return res.json({ success: true, data: null });

    const local = normalized.startsWith("20") ? "0" + normalized.slice(2) : normalized;
    let customer = db.prepare(
      "SELECT * FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','') IN (?,?) LIMIT 1"
    ).get(normalized, local);

    // Check if birthday column exists (migration may not have run yet)
    const cols = db.prepare("PRAGMA table_info(customers)").all().map(c => c.name);
    const hasBirthday = cols.includes("birthday");

    if (!customer) {
      const result = hasBirthday
        ? db.prepare("INSERT INTO customers (name, phone, capture_source, marketing_opt_in, whatsapp_opt_out, birthday) VALUES (?,?,?,?,0,?)")
            .run(name || local, local, capture_source, marketing_opt_in ? 1 : 0, birthday || null)
        : db.prepare("INSERT INTO customers (name, phone, capture_source, marketing_opt_in, whatsapp_opt_out) VALUES (?,?,?,?,0)")
            .run(name || local, local, capture_source, marketing_opt_in ? 1 : 0);
      customer = db.prepare("SELECT * FROM customers WHERE id=?").get(result.lastInsertRowid);
    } else {
      const updates = ["marketing_opt_in = ?"];
      const vals = [marketing_opt_in ? 1 : 0];
      if (hasBirthday && birthday && !customer.birthday) { updates.push("birthday = ?"); vals.push(birthday); }
      vals.push(customer.id);
      db.prepare(`UPDATE customers SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
      customer = db.prepare("SELECT * FROM customers WHERE id=?").get(customer.id);
    }
    res.json({ success: true, data: customer });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Enqueue a WhatsApp message
router.post("/enqueue", requireAnyPagePermission(["whatsapp_receipt", "pos", "sales_returns"], "send"), (req, res) => {
  try {
    const db = getDb();
    const { recipient_phone, customer_id, kind = "receipt", payload = {}, scheduled_at } = req.body;
    const normalized = normalizePhone(recipient_phone);
    if (!normalized) return res.status(400).json({ success: false, message: "invalid phone" });

    db.prepare(`
      INSERT INTO wa_outbox (recipient_phone, customer_id, kind, payload, scheduled_at)
      VALUES (?,?,?,?,?)
    `).run(normalized, customer_id || null, kind, JSON.stringify(payload), scheduled_at || null);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Outbox status (for the UI panel)
router.get("/outbox", requirePagePermission("settings", "view"), (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = db.prepare(`
      SELECT o.*, c.name AS customer_name
      FROM wa_outbox o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.id DESC LIMIT ?
    `).all(limit);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Message templates — readable by anyone who can send receipts, manage POS/sales returns,
// or configure WhatsApp channels.
router.get("/templates", requireAnyPagePermission(["settings", "whatsapp_receipt", "whatsapp_crm", "pos", "sales_returns"], "view"), (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM message_templates ORDER BY kind").all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/templates/:kind", requireAnyPageAction({ settings: "edit", whatsapp_crm: "manage_templates" }), (req, res) => {
  try {
    const db = getDb();
    const { kind } = req.params;
    const { body } = req.body;
    db.prepare(`
      INSERT INTO message_templates (kind, body) VALUES (?,?)
      ON CONFLICT(kind) DO UPDATE SET body=excluded.body, updated_at=?
    `).run(kind, body || "", nowSql());
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Opted-in contacts list (for CRM view and broadcast)
router.get("/contacts", requirePagePermission("customers", "view"), (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.id, c.name, c.phone, c.birthday, c.marketing_opt_in, c.whatsapp_opt_out, c.capture_source,
             (SELECT MAX(created_at) FROM wa_outbox WHERE customer_id = c.id) AS last_message_at,
             (SELECT status FROM wa_outbox WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_status
      FROM customers c
      WHERE c.phone IS NOT NULL AND c.phone != ''
      ORDER BY c.id DESC
      LIMIT 500
    `).all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Broadcast to all opted-in customers (enqueue one message per customer)
router.post("/broadcast", requirePagePermission("settings", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { text, scheduled_at } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: "text required" });

    const customers = db.prepare(`
      SELECT id, phone FROM customers
      WHERE marketing_opt_in = 1
        AND (whatsapp_opt_out IS NULL OR whatsapp_opt_out = 0)
        AND phone IS NOT NULL AND phone != ''
    `).all();

    const ins = db.prepare("INSERT INTO wa_outbox (recipient_phone, customer_id, kind, payload, scheduled_at) VALUES (?,?,?,?,?)");
    let count = 0;
    for (const c of customers) {
      ins.run(c.phone, c.id, "broadcast", JSON.stringify({ text: text.trim() }), scheduled_at || null);
      count++;
    }
    res.json({ success: true, queued: count });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Check if a phone number is registered on WhatsApp
router.post("/check-exists", requireAnyPagePermission(["whatsapp_receipt", "pos", "sales_returns"], "send"), async (req, res) => {
  try {
    if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
    const normalized = normalizePhone(req.body?.phone);
    if (!normalized) return res.status(400).json({ success: false, message: "invalid phone" });
    const es = engine.getStatus();
    if (es.status !== "connected") return res.status(503).json({ success: false, message: "WhatsApp not connected" });
    const exists = await engine.checkExists(normalized);
    res.json({ success: true, data: { exists } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Send a WhatsApp message directly (bypass outbox) with confirmation
router.post("/send-direct", requireAnyPagePermission(["whatsapp_receipt", "pos", "sales_returns"], "send"), async (req, res) => {
  try {
    if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
    const { recipient_phone, customer_id, kind = "receipt", payload = {} } = req.body;
    const normalized = normalizePhone(recipient_phone);
    if (!normalized) return res.status(400).json({ success: false, message: "invalid phone" });
    const es = engine.getStatus();
    if (es.status !== "connected") return res.status(400).json({ success: false, message: "WhatsApp not connected" });

    const jid = normalized + "@s.whatsapp.net";
    if (payload.image) {
      const buf = Buffer.from(payload.image, "base64");
      await engine.sendImage(jid, buf, payload.caption || "");
    } else {
      await engine.sendText(jid, payload.text || "");
    }

    // Record in outbox for history
    const db = getDb();
    db.prepare(`
      INSERT INTO wa_outbox (recipient_phone, customer_id, kind, payload, status, sent_at)
      VALUES (?,?,?,?, 'sent', datetime('now'))
    `).run(normalized, customer_id || null, kind, JSON.stringify(payload));

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Send an SMS message directly (bypass outbox) with confirmation
router.post("/send-sms-direct", requireAnyPagePermission(["whatsapp_receipt", "pos", "sales_returns"], "send"), async (req, res) => {
  try {
    const db = getDb();
    const { sendSms, getSmsConfig } = require("../services/smsService");
    const config = getSmsConfig(db);
    if (!config) return res.status(400).json({ success: false, message: "خدمة SMS غير مفعّلة — فعّلها من الإعدادات أولاً" });
    const { recipient_phone, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: "text required" });
    const normalized = normalizePhone(recipient_phone);
    if (!normalized) return res.status(400).json({ success: false, message: "invalid phone" });
    await sendSms(config, normalized, text.trim());

    // Record in outbox for history
    db.prepare(`
      INSERT INTO wa_outbox (recipient_phone, kind, payload, channel, status, sent_at)
      VALUES (?, 'receipt', ?, 'sms', 'sent', datetime('now'))
    `).run(normalized, JSON.stringify({ text: text.trim() }));

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Check if SMS is enabled
router.get("/sms-status", requireAnyPagePermission(["whatsapp_receipt", "pos", "sales_returns", "settings"], "view"), (_req, res) => {
  try {
    const db = getDb();
    const { getSmsConfig } = require("../services/smsService");
    const config = getSmsConfig(db);
    res.json({ success: true, data: { enabled: Boolean(config) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Resolve a template body with variables
function resolveTemplate(body, vars = {}) {
  return body.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
router.exports_resolveTemplate = resolveTemplate;

module.exports = router;
