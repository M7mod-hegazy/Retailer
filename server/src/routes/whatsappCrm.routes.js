const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { nowSql } = require("../utils/datetime");
const { normalizeDigits } = require("../utils/phone");

let engine = null;
try { engine = require("../../../electron/whatsapp/engine"); } catch (_) {}

const router = express.Router();
router.use(authRequired);

const canView = requirePagePermission("whatsapp_crm", "view");
const canEdit = requirePagePermission("whatsapp_crm", "edit");

// ─── Stats / Dashboard ────────────────────────────────────────────────────
router.get("/stats", canView, (_req, res) => {
  try {
    const db = getDb();
    const totalContacts = db.prepare("SELECT COUNT(*) AS c FROM customers WHERE phone IS NOT NULL AND phone != ''").get()?.c || 0;
    const totalLeads = db.prepare("SELECT COUNT(*) AS c FROM leads WHERE opted_out=0").get()?.c || 0;
    const optedIn = db.prepare("SELECT COUNT(*) AS c FROM customers WHERE marketing_opt_in=1 AND (whatsapp_opt_out IS NULL OR whatsapp_opt_out=0)").get()?.c || 0;
    const optedOut = db.prepare("SELECT COUNT(*) AS c FROM customers WHERE whatsapp_opt_out=1").get()?.c || 0;
    const pendingOutbox = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='pending'").get()?.c || 0;
    const sentToday = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='sent' AND date(sent_at)=date('now')").get()?.c || 0;
    const sentTotal = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='sent'").get()?.c || 0;
    const failedTotal = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='failed'").get()?.c || 0;
    const convCount = db.prepare("SELECT COUNT(*) AS c FROM wa_conversations").get()?.c || 0;
    const unreadCount = db.prepare("SELECT COUNT(*) AS c FROM wa_conversations WHERE unread_count > 0").get()?.c || 0;
    const recentMessages = db.prepare(`
      SELECT wm.body, wm.direction, wm.created_at, wc.contact_name, wc.remote_jid
      FROM wa_messages wm
      JOIN wa_conversations wc ON wc.id = wm.conversation_id
      ORDER BY wm.id DESC LIMIT 10
    `).all();
    const sentByDay = db.prepare(`
      SELECT date(sent_at) AS day, COUNT(*) AS count FROM wa_outbox
      WHERE status='sent' AND sent_at IS NOT NULL
      GROUP BY date(sent_at) ORDER BY day DESC LIMIT 14
    `).all();

    const engineStatus = engine ? engine.getStatus() : { status: "unavailable" };

    res.json({ success: true, data: {
      totalContacts, totalLeads, optedIn, optedOut,
      pendingOutbox, sentToday, sentTotal, failedTotal,
      convCount, unreadCount,
      recentMessages, sentByDay: sentByDay.reverse(),
      engine: engineStatus,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Conversations ─────────────────────────────────────────────────────────
router.get("/conversations", canView, (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM wa_conversations
      ORDER BY last_message_at DESC
      LIMIT 200
    `).all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/conversations/:jid/messages", canView, (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const conv = db.prepare("SELECT id FROM wa_conversations WHERE remote_jid=?").get(req.params.jid);
    if (!conv) return res.json({ success: true, data: [] });
    const rows = db.prepare(`
      SELECT * FROM wa_messages WHERE conversation_id=?
      ORDER BY id DESC LIMIT ?
    `).all(conv.id, limit);
    res.json({ success: true, data: rows.reverse() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/conversations/:jid/read", canEdit, (req, res) => {
  try {
    const db = getDb();
    db.prepare("UPDATE wa_conversations SET unread_count=0 WHERE remote_jid=?").run(req.params.jid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/conversations/:jid/archive", canEdit, (req, res) => {
  try {
    const db = getDb();
    db.prepare("UPDATE wa_conversations SET status='archived' WHERE remote_jid=?").run(req.params.jid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Send message from inbox ───────────────────────────────────────────────
router.post("/send", canEdit, async (req, res) => {
  try {
    if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
    const { jid, text, imageBase64, caption } = req.body;
    if (!jid || (!text && !imageBase64)) return res.status(400).json({ success: false, message: "jid and text or image required" });
    const es = engine.getStatus();
    if (es.status !== "connected") return res.status(400).json({ success: false, message: "WhatsApp not connected" });
    if (imageBase64) {
      await engine.sendImage(jid, Buffer.from(imageBase64, "base64"), caption || "");
    } else {
      await engine.sendText(jid, text);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Contact name resolution ───────────────────────────────────────────────
router.post("/contacts/resolve", canView, (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.json({ success: true, data: null });
    const name = engine ? engine.resolveContactName(phone) : null;
    const db = getDb();
    const norm = normalizeDigits(phone);
    let fromDb = null;
    if (norm) {
      fromDb = db.prepare("SELECT name, push_name FROM wa_contact_cache WHERE phone_normalized=?").get(norm);
      if (!fromDb) {
        const customer = db.prepare("SELECT name FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','')=? OR REPLACE(REPLACE(phone,' ',''),'-','')=?").get(norm, "0" + norm.slice(2));
        if (customer) fromDb = { name: customer.name, push_name: null };
      }
    }
    res.json({ success: true, data: name || fromDb?.name || fromDb?.push_name || null });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Full contacts list (merged customers + leads) ─────────────────────────
router.get("/contacts", canView, (req, res) => {
  try {
    const db = getDb();
    const { q, source, marketing, opted_out } = req.query;

    // Safe table detection — migrations 110 and 158 may not have run yet
    const hasOutbox = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get("wa_outbox");
    const hasMessages = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get("wa_messages");

    // Customers with phone
    let custWhere = ["c.phone IS NOT NULL", "c.phone != ''"];
    let custParams = [];
    if (q) { custWhere.push("(c.name LIKE ? OR c.phone LIKE ?)"); const l = `%${q}%`; custParams.push(l, l); }
    if (marketing === "1") custWhere.push("c.marketing_opt_in = 1");
    if (opted_out === "1") custWhere.push("c.whatsapp_opt_out = 1");
    else if (opted_out === "0") custWhere.push("(c.whatsapp_opt_out IS NULL OR c.whatsapp_opt_out = 0)");

    const custCols = [
      "c.id", "c.name", "c.phone", "c.marketing_opt_in", "c.whatsapp_opt_out",
      "c.capture_source", "c.birthday", "'customer' AS type"
    ];
    if (hasOutbox) {
      custCols.push("(SELECT MAX(created_at) FROM wa_outbox WHERE customer_id = c.id) AS last_message_at");
      custCols.push("(SELECT status FROM wa_outbox WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_status");
    } else {
      custCols.push("NULL AS last_message_at", "NULL AS last_message_status");
    }
    if (hasMessages) {
      custCols.push("(SELECT body FROM wa_messages WHERE remote_jid LIKE '%' || REPLACE(REPLACE(c.phone,' ',''),'-','') || '%' ORDER BY id DESC LIMIT 1) AS last_inbound");
    } else {
      custCols.push("NULL AS last_inbound");
    }

    const customers = db.prepare(`
      SELECT ${custCols.join(",")}
      FROM customers c
      WHERE ${custWhere.join(" AND ")}
      ORDER BY c.id DESC LIMIT 500
    `).all(...custParams);

    // Leads
    let leadWhere = ["1=1"];
    let leadParams = [];
    if (q) { leadWhere.push("(name LIKE ? OR phone_normalized LIKE ?)"); const l = `%${q}%`; leadParams.push(l, l); }
    if (source) { leadWhere.push("source = ?"); leadParams.push(source); }
    if (opted_out === "1") leadWhere.push("opted_out = 1");
    else if (opted_out === "0") leadWhere.push("opted_out = 0");

    const leads = db.prepare(`
      SELECT id, name, phone_raw AS phone, 0 AS marketing_opt_in, opted_out AS whatsapp_opt_out,
             'lead' AS type, source AS capture_source, birthday, NULL AS last_message_at,
             NULL AS last_message_status, NULL AS last_inbound
      FROM leads WHERE ${leadWhere.join(" AND ")}
      ORDER BY id DESC LIMIT 200
    `).all(...leadParams);

    const data = [...customers, ...leads];
    res.json({ success: true, data, count: data.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Campaigns ─────────────────────────────────────────────────────────────
router.get("/campaigns", canView, (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id) AS total,
        (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id AND status = 'sent') AS sent_count
      FROM campaigns c ORDER BY c.id DESC LIMIT 50
    `).all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/campaigns/:id", canView, (req, res) => {
  try {
    const db = getDb();
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: "not found" });
    const recipients = db.prepare("SELECT * FROM campaign_recipients WHERE campaign_id=? ORDER BY ord ASC").all(req.params.id);
    res.json({ success: true, data: { ...campaign, recipients } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/campaigns", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { name, body, channel = "whatsapp", scheduled_at, filters = {} } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: "body required" });

    // Build audience
    const { tag, source, include = "both" } = filters;
    const leadWhere = ["opted_out = 0", "promoted_customer_id IS NULL"];
    const leadParams = [];
    if (tag) { leadWhere.push("EXISTS (SELECT 1 FROM json_each(leads.tags) WHERE json_each.value = ?)"); leadParams.push(tag); }
    if (source) { leadWhere.push("source = ?"); leadParams.push(source); }

    let audience = [];
    if (include === "both" || include === "leads") {
      const leads = db.prepare(`SELECT id AS lead_id, NULL AS customer_id, name, phone_normalized AS phone FROM leads WHERE ${leadWhere.join(" AND ")}`).all(...leadParams);
      audience.push(...leads);
    }
    if (include === "both" || include === "customers") {
      const customers = db.prepare(`
        SELECT NULL AS lead_id, id AS customer_id, name, phone FROM customers
        WHERE marketing_opt_in = 1 AND (whatsapp_opt_out IS NULL OR whatsapp_opt_out = 0)
          AND phone IS NOT NULL AND phone != ''
      `).all();
      audience.push(...customers);
    }

    // Dedupe
    const byPhone = new Map();
    for (const a of audience) {
      const norm = normalizeDigits(a.phone);
      if (!norm) continue;
      if (!byPhone.has(norm)) byPhone.set(norm, a);
    }
    const deduped = [...byPhone.values()];

    const audienceJson = JSON.stringify(filters);
    const result = db.prepare(`
      INSERT INTO campaigns (name, body, channel, audience_json, status, total, created_at)
      VALUES (?,?,?,?,'active',?,datetime('now'))
    `).run(name?.trim() || null, body.trim(), channel, audienceJson, deduped.length);
    const campaignId = result.lastInsertRowid;

    // Insert recipients
    const ins = db.prepare(`
      INSERT INTO campaign_recipients (campaign_id, lead_id, customer_id, phone_normalized, name, resolved_body, ord)
      VALUES (?,?,?,?,?,?,?)
    `);
    deduped.forEach((a, i) => {
      const resolved = body.replace(/\{name\}/g, a.name || "").replace(/\{phone\}/g, a.phone || "");
      ins.run(campaignId, a.lead_id || null, a.customer_id || null, normalizeDigits(a.phone), a.name || null, resolved, i);
    });

    // Enqueue messages in wa_outbox
    if (channel === "whatsapp") {
      const outboxIns = db.prepare("INSERT INTO wa_outbox (recipient_phone, customer_id, kind, payload, scheduled_at) VALUES (?,?,?,?,?)");
      for (const a of deduped) {
        const resolved = body.replace(/\{name\}/g, a.name || "");
        outboxIns.run(normalizeDigits(a.phone), a.customer_id || null, "broadcast", JSON.stringify({ text: resolved }), scheduled_at || null);
      }
    }

    const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(campaignId);
    res.status(201).json({ success: true, data: campaign });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/campaigns/:id", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    db.prepare("UPDATE campaigns SET status=? WHERE id=?").run(status, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/campaigns/:id", canEdit, (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM campaign_recipients WHERE campaign_id=?").run(req.params.id);
    db.prepare("DELETE FROM campaigns WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Templates (re-expose for CRM) ─────────────────────────────────────────
router.get("/templates", canView, (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM message_templates ORDER BY kind").all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/templates/:kind", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { kind } = req.params;
    const { body } = req.body;
    db.prepare("INSERT INTO message_templates (kind, body) VALUES (?,?) ON CONFLICT(kind) DO UPDATE SET body=excluded.body, updated_at=?").run(kind, body || "", nowSql());
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/templates/:kind/send-test", canEdit, (req, res) => {
  try {
    if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "phone required" });
    const jid = engine.normalizePhone(phone);
    if (!jid) return res.status(400).json({ success: false, message: "invalid phone" });
    const db = getDb();
    const tpl = db.prepare("SELECT body FROM message_templates WHERE kind=?").get(req.params.kind);
    if (!tpl) return res.status(404).json({ success: false, message: "template not found" });
    engine.sendText(jid, tpl.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
