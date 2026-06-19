const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

// Load the WhatsApp engine — works in Electron and plain Node
let engine = null;
try { engine = require("../../../electron/whatsapp/engine"); } catch (_) {}

const router = express.Router();
router.use(authRequired);

// ── Engine control via REST (works in browser + Electron) ─────────────────────

router.get("/engine-status", requirePagePermission("settings", "view"), (_req, res) => {
  if (!engine) return res.json({ success: true, data: { status: "unavailable" } });
  res.json({ success: true, data: engine.getStatus() });
});

router.post("/engine-connect", requirePagePermission("settings", "edit"), async (_req, res) => {
  if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
  try { await engine.connect(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/engine-disconnect", requirePagePermission("settings", "edit"), async (_req, res) => {
  if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
  try { await engine.disconnect(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
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
router.post("/enqueue", requirePagePermission("pos", "add"), (req, res) => {
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

// Message templates
router.get("/templates", requirePagePermission("settings", "view"), (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM message_templates ORDER BY kind").all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/templates/:kind", requirePagePermission("settings", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { kind } = req.params;
    const { body } = req.body;
    db.prepare(`
      INSERT INTO message_templates (kind, body) VALUES (?,?)
      ON CONFLICT(kind) DO UPDATE SET body=excluded.body, updated_at=datetime('now', 'localtime')
    `).run(kind, body || "");
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

// Resolve a template body with variables
function resolveTemplate(body, vars = {}) {
  return body.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
router.exports_resolveTemplate = resolveTemplate;

module.exports = router;
