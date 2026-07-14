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

// ─── Branch filter helper ──────────────────────────────────────────────────
// If the user has a branch_id, scope queries to that branch.
// Admins and devs (no branch_id) see all data.
function branchFilter(user, table) {
  if (!user || user.role === "dev" || user.role === "admin" || !user.branch_id) return { sql: "", params: [] };
  const prefix = table ? `${table}.` : "";
  return { sql: `${prefix}branch_id = ?`, params: [user.branch_id] };
}
function whereBranch(user, table) {
  const f = branchFilter(user, table);
  return f.sql ? `AND ${f.sql}` : "";
}
function branchParams(user, table) {
  return branchFilter(user, table).params;
}

// ─── Messaging config (page branding + channel availability) ───────────────
// Lightweight so CRM users don't need settings:view.
router.get("/config", canView, (_req, res) => {
  try {
    const db = getDb();
    let smsEnabled = false;
    try {
      const s = db.prepare("SELECT sms_enabled, sms_api_url FROM settings WHERE id=1").get();
      smsEnabled = Boolean(s?.sms_enabled && s?.sms_api_url);
    } catch (_) {} // columns missing → migration 170 not applied yet
    res.json({ success: true, data: { sms_enabled: smsEnabled } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Stats / Dashboard ────────────────────────────────────────────────────
router.get("/stats", canView, (req, res) => {
  try {
    const db = getDb();
    const bf = branchFilter(req.user, "wc");
    const convWhere = bf.sql ? `WHERE (${bf.sql} OR wc.branch_id IS NULL)` : "";
    const convCountWhere = bf.sql ? `WHERE (${bf.sql.replace("wc.", "")} OR branch_id IS NULL)` : "";
    const totalContacts = db.prepare(`SELECT COUNT(*) AS c FROM customers c WHERE phone IS NOT NULL AND phone != '' ${whereBranch(req.user, "c")}`).get(...branchParams(req.user, "c"))?.c || 0;
    const totalLeads = db.prepare(`SELECT COUNT(*) AS c FROM leads l WHERE opted_out=0 ${whereBranch(req.user, "l")}`).get(...branchParams(req.user, "l"))?.c || 0;
    const optedIn = db.prepare(`SELECT COUNT(*) AS c FROM customers c WHERE marketing_opt_in=1 AND (whatsapp_opt_out IS NULL OR whatsapp_opt_out=0) ${whereBranch(req.user, "c")}`).get(...branchParams(req.user, "c"))?.c || 0;
    const optedOut = db.prepare(`SELECT COUNT(*) AS c FROM customers c WHERE whatsapp_opt_out=1 ${whereBranch(req.user, "c")}`).get(...branchParams(req.user, "c"))?.c || 0;
    const pendingOutbox = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='pending'").get()?.c || 0;
    const sentToday = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='sent' AND date(sent_at)=date('now')").get()?.c || 0;
    const sentTotal = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='sent'").get()?.c || 0;
    const failedTotal = db.prepare("SELECT COUNT(*) AS c FROM wa_outbox WHERE status='failed'").get()?.c || 0;
    const convCount = db.prepare(`SELECT COUNT(*) AS c FROM wa_conversations ${convCountWhere}`).get(...bf.params)?.c || 0;
    const unreadCount = db.prepare(`SELECT COUNT(*) AS c FROM wa_conversations WHERE unread_count > 0 ${bf.sql ? `AND (${bf.sql.replace("wc.", "")} OR branch_id IS NULL)` : ""}`).get(...bf.params)?.c || 0;
    const recentMessages = db.prepare(`
      SELECT wm.body, wm.direction, wm.created_at, wc.contact_name, wc.remote_jid,
        ${CONTACT_TYPE_SQL} AS contact_type
      FROM wa_messages wm
      JOIN wa_conversations wc ON wc.id = wm.conversation_id
      ${convWhere}
      ORDER BY wm.id DESC LIMIT 10
    `).all(...bf.params);
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

// Contact type for a conversation phone: is this a known customer, a lead
// captured elsewhere (POS quick-add, walk-in), or a number we've never seen?
// Lets the inbox/activity feed show who's actually messaging.
const CONTACT_TYPE_SQL = `
  CASE
    WHEN EXISTS (
      SELECT 1 FROM customers c
      WHERE REPLACE(REPLACE(c.phone,' ',''),'-','') = wc.phone_normalized
         OR REPLACE(REPLACE(c.phone,' ',''),'-','') = ('0' || substr(wc.phone_normalized, 3))
    ) THEN 'customer'
    WHEN EXISTS (SELECT 1 FROM leads l WHERE l.phone_normalized = wc.phone_normalized) THEN 'lead'
    ELSE NULL
  END
`;

// ─── Conversations ─────────────────────────────────────────────────────────
router.get("/conversations", canView, (req, res) => {
  try {
    const db = getDb();
    const bf = branchFilter(req.user, "wc");
    const where = bf.sql ? `WHERE (${bf.sql} OR wc.branch_id IS NULL)` : "";
    const rows = db.prepare(`
      SELECT wc.*, ${CONTACT_TYPE_SQL} AS contact_type
      FROM wa_conversations wc
      ${where}
      ORDER BY wc.last_message_at DESC
      LIMIT 200
    `).all(...bf.params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/conversations/:jid/messages", canView, (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const conv = db.prepare("SELECT id, branch_id FROM wa_conversations WHERE remote_jid=?").get(req.params.jid);
    if (!conv) return res.json({ success: true, data: [] });
    if (conv.branch_id && req.user.branch_id && conv.branch_id !== req.user.branch_id) {
      return res.json({ success: true, data: [] });
    }
    const rows = db.prepare(`
      SELECT * FROM wa_messages WHERE conversation_id=?
      ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(conv.id, limit, offset);
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

router.delete("/messages/:id", canEdit, (req, res) => {
  try {
    const db = getDb();
    const msg = db.prepare("SELECT * FROM wa_messages WHERE id=?").get(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });
    if (msg.direction !== "outbound") return res.status(403).json({ success: false, message: "لا يمكن حذف رسائل واردة" });
    db.prepare("DELETE FROM wa_messages WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Send message from inbox ───────────────────────────────────────────────
router.post("/send", canEdit, async (req, res) => {
  try {
    if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
    const { jid, text, imageBase64, caption, fileBase64, fileName, mimeType, audioBase64 } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: "jid required" });
    if (!text && !imageBase64 && !fileBase64 && !audioBase64) {
      return res.status(400).json({ success: false, message: "text, image, file, or audio required" });
    }
    const es = engine.getStatus();
    if (es.status !== "connected") return res.status(400).json({ success: false, message: "WhatsApp not connected" });
    if (imageBase64) {
      await engine.sendImage(jid, Buffer.from(imageBase64, "base64"), caption || "");
    } else if (fileBase64) {
      await engine.sendDocument(jid, Buffer.from(fileBase64, "base64"), fileName || "document", caption || "");
    } else if (audioBase64) {
      await engine.sendAudio(jid, Buffer.from(audioBase64, "base64"), true);
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
    const bf = branchFilter(req.user, "c");
    if (bf.sql) { custWhere.push(bf.sql); custParams.push(...bf.params); }

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
    const bfLeads = branchFilter(req.user, "");
    if (bfLeads.sql) { leadWhere.push(bfLeads.sql); leadParams.push(...bfLeads.params); }

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
    const { name, body, channel = "whatsapp", scheduled_at, filters = {}, image_url } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: "body required" });
    if (!["whatsapp", "sms"].includes(channel)) return res.status(400).json({ success: false, message: "invalid channel" });
    // image_url is later read from disk by the WhatsApp engine — accept ONLY
    // the exact /uploads/<file>.<img-ext> shape our upload route produces, or
    // a crafted path could exfiltrate arbitrary files to a campaign recipient.
    if (image_url != null && image_url !== "") {
      if (typeof image_url !== "string" || !/^\/uploads\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i.test(image_url)) {
        return res.status(400).json({ success: false, message: "رابط الصورة غير صالح" });
      }
    }
    if (channel === "sms") {
      let smsReady = false;
      try {
        const s = db.prepare("SELECT sms_enabled, sms_api_url FROM settings WHERE id=1").get();
        smsReady = Boolean(s?.sms_enabled && s?.sms_api_url);
      } catch (_) {}
      if (!smsReady) return res.status(400).json({ success: false, message: "خدمة SMS غير مفعّلة — فعّلها من الإعدادات أولاً" });
    }

    // Build audience
    const { tag, source, include = "both" } = filters;
    const leadWhere = ["opted_out = 0", "promoted_customer_id IS NULL"];
    const leadParams = [];
    if (tag) { leadWhere.push("EXISTS (SELECT 1 FROM json_each(leads.tags) WHERE json_each.value = ?)"); leadParams.push(tag); }
    if (source) { leadWhere.push("source = ?"); leadParams.push(source); }

    let audience = [];
    if (include === "custom") {
      // Explicit recipients hand-picked in the UI (e.g. selected contact rows).
      const list = Array.isArray(req.body.recipients) ? req.body.recipients : [];
      audience = list.map(r => ({
        lead_id: r.lead_id || null,
        customer_id: r.customer_id || null,
        name: r.name || null,
        phone: r.phone,
      }));
      if (!audience.length) return res.status(400).json({ success: false, message: "لا يوجد مستلمون محددون" });
    }
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
      INSERT INTO campaigns (name, body, channel, audience_json, status, total, image_url, created_at)
      VALUES (?,?,?,?,'active',?,?,datetime('now'))
    `).run(name?.trim() || null, body.trim(), channel, audienceJson, deduped.length, image_url || null);
    const campaignId = result.lastInsertRowid;

    // Insert recipients + enqueue in wa_outbox, linked back so the drainers can
    // report progress (previously nothing updated campaign_recipients → 0% forever).
    const outboxCols = db.prepare("PRAGMA table_info(wa_outbox)").all().map(c => c.name);
    const hasChannel = outboxCols.includes("channel");
    const hasLink = outboxCols.includes("campaign_recipient_id");

    const ins = db.prepare(`
      INSERT INTO campaign_recipients (campaign_id, lead_id, customer_id, phone_normalized, name, resolved_body, ord)
      VALUES (?,?,?,?,?,?,?)
    `);
    const outboxIns = hasChannel && hasLink
      ? db.prepare("INSERT INTO wa_outbox (recipient_phone, customer_id, lead_id, kind, payload, scheduled_at, channel, campaign_recipient_id) VALUES (?,?,?,?,?,?,?,?)")
      : db.prepare("INSERT INTO wa_outbox (recipient_phone, customer_id, kind, payload, scheduled_at) VALUES (?,?,?,?,?)");

    let shopName = "";
    try { shopName = db.prepare("SELECT company_name FROM settings WHERE id=1").get()?.company_name || ""; } catch (_) {}

    deduped.forEach((a, i) => {
      const norm = normalizeDigits(a.phone);
      const resolved = body
        .replace(/\{name\}/g, a.name || "")
        .replace(/\{phone\}/g, a.phone || "")
        .replace(/\{shop\}/g, shopName);
      const outboxPayload = image_url
        ? { text: resolved, image_url: image_url }
        : { text: resolved };
      const recipientId = ins.run(campaignId, a.lead_id || null, a.customer_id || null, norm, a.name || null, resolved, i).lastInsertRowid;
      if (hasChannel && hasLink) {
        outboxIns.run(norm, a.customer_id || null, a.lead_id || null, "broadcast", JSON.stringify(outboxPayload), scheduled_at || null, channel, recipientId);
      } else if (channel === "whatsapp") {
        outboxIns.run(norm, a.customer_id || null, "broadcast", JSON.stringify(outboxPayload), scheduled_at || null);
      }
    });

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
    // Cancel queued messages first — deleting a campaign must stop its sends.
    try {
      db.prepare(`
        UPDATE wa_outbox SET status='failed', error='campaign deleted'
        WHERE status='pending' AND campaign_recipient_id IN (SELECT id FROM campaign_recipients WHERE campaign_id=?)
      `).run(req.params.id);
    } catch (_) {} // campaign_recipient_id column missing → nothing to cancel
    db.prepare("DELETE FROM campaign_recipients WHERE campaign_id=?").run(req.params.id);
    db.prepare("DELETE FROM campaigns WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Batch check which phone numbers exist on WhatsApp
router.post("/check-whatsapp-batch", canView, async (req, res) => {
  try {
    if (!engine) return res.status(503).json({ success: false, message: "engine not available" });
    const es = engine.getStatus();
    if (es.status !== "connected") return res.status(503).json({ success: false, message: "WhatsApp not connected" });
    const { phones } = req.body;
    if (!Array.isArray(phones) || !phones.length) return res.status(400).json({ success: false, message: "phones array required" });
    const results = {};
    for (const raw of phones.slice(0, 50)) {
      const norm = normalizeDigits(raw);
      if (!norm) { results[raw] = false; continue; }
      try {
        results[norm] = await engine.checkExists(norm);
      } catch { results[norm] = null; }
    }
    res.json({ success: true, data: results });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Templates ──────────────────────────────────────────────────────────────
// Category → fixed sending channel. These categories are driven by automatic
// triggers (a sale, a shift close, a Telegram alert) — not something a user
// picks a channel for when composing a one-off campaign — so the channel is
// implied by the category, not user-editable per variant.
const CATEGORY_CHANNEL = {
  receipt: "whatsapp", return_receipt: "whatsapp", birthday: "whatsapp", debt: "whatsapp",
  purchase_receipt: "whatsapp", purchase_return_receipt: "whatsapp",
  transfer_send: "whatsapp", transfer_receive: "whatsapp",
  telegram_new_invoice: "telegram", telegram_daily_close: "telegram", telegram_shift_close: "telegram",
  telegram_large_invoice: "telegram", telegram_large_discount: "telegram", telegram_sales_return: "telegram",
  telegram_invoice_voided: "telegram", telegram_purchase_created: "telegram", telegram_customer_payment: "telegram",
  telegram_low_stock: "telegram", telegram_backup_result: "telegram", telegram_failed_login: "telegram",
  telegram_customer_created: "telegram", telegram_supplier_created: "telegram", telegram_expense_created: "telegram",
  telegram_return_payment: "telegram",
  telegram_weekly_digest: "telegram", telegram_monthly_digest: "telegram", telegram_yearly_digest: "telegram",
  // Extended events (migration 194)
  telegram_stock_transfer: "telegram", telegram_inventory_adjustment: "telegram",
  telegram_new_product: "telegram", telegram_price_change: "telegram",
  telegram_batch_expiry: "telegram", telegram_physical_count: "telegram",
  telegram_supplier_payment: "telegram", telegram_debt_payment: "telegram",
  telegram_installment_paid: "telegram",
  telegram_purchase_voided: "telegram", telegram_purchase_return: "telegram",
  telegram_branch_transfer: "telegram",
  telegram_password_changed: "telegram", telegram_permission_changed: "telegram",
  telegram_supervisor_override: "telegram", telegram_repair_created: "telegram",
  telegram_repair_ready: "telegram", telegram_repair_delivered: "telegram",
  telegram_revenue_created: "telegram", telegram_withdrawal_created: "telegram",
  telegram_employee_created: "telegram", telegram_salary_settled: "telegram",
  telegram_advance_created: "telegram", telegram_deduction_created: "telegram",
  telegram_bonus_created: "telegram",
};

// System kinds are auto-send triggers: body-editable via variants below,
// never deletable as a category. Custom templates (kind = custom_*) are
// fully user-managed and selectable when composing a campaign.
const SYSTEM_TEMPLATE_KINDS = new Set(Object.keys(CATEGORY_CHANNEL));

function templatesHaveLabel(db) {
  try { return db.prepare("PRAGMA table_info(message_templates)").all().some(c => c.name === "label"); }
  catch (_) { return false; }
}

router.get("/templates", canView, (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM message_templates ORDER BY id").all();
    rows.forEach(r => { r.is_system = SYSTEM_TEMPLATE_KINDS.has(r.kind) ? 1 : 0; });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

const TEMPLATE_CHANNELS = new Set(["whatsapp", "sms", "both"]);
function templatesHaveChannel(db) {
  try { return db.prepare("PRAGMA table_info(message_templates)").all().some(c => c.name === "channel"); }
  catch (_) { return false; }
}

// Create a custom template
router.post("/templates", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { label, body, channel } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ success: false, message: "اسم القالب مطلوب" });
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: "نص القالب مطلوب" });
    if (!templatesHaveLabel(db)) return res.status(400).json({ success: false, message: "قاعدة البيانات تحتاج تحديثاً (migration 170)" });
    if (channel && !TEMPLATE_CHANNELS.has(channel)) return res.status(400).json({ success: false, message: "قناة غير صالحة" });
    const kind = `custom_${Date.now()}`;
    if (templatesHaveChannel(db)) {
      db.prepare("INSERT INTO message_templates (kind, label, body, channel) VALUES (?,?,?,?)").run(kind, label.trim(), body.trim(), channel || "both");
    } else {
      db.prepare("INSERT INTO message_templates (kind, label, body) VALUES (?,?,?)").run(kind, label.trim(), body.trim());
    }
    const row = db.prepare("SELECT * FROM message_templates WHERE kind=?").get(kind);
    res.status(201).json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/templates/:kind", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { kind } = req.params;
    const { body, label, channel } = req.body;
    if (channel && !TEMPLATE_CHANNELS.has(channel)) return res.status(400).json({ success: false, message: "قناة غير صالحة" });
    db.prepare("INSERT INTO message_templates (kind, body) VALUES (?,?) ON CONFLICT(kind) DO UPDATE SET body=excluded.body, updated_at=?").run(kind, body || "", nowSql());
    if (label && !SYSTEM_TEMPLATE_KINDS.has(kind) && templatesHaveLabel(db)) {
      db.prepare("UPDATE message_templates SET label=? WHERE kind=?").run(String(label).trim(), kind);
    }
    if (channel && !SYSTEM_TEMPLATE_KINDS.has(kind) && templatesHaveChannel(db)) {
      db.prepare("UPDATE message_templates SET channel=? WHERE kind=?").run(channel, kind);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Delete a custom template (system kinds are protected)
router.delete("/templates/:kind", canEdit, (req, res) => {
  try {
    const { kind } = req.params;
    if (SYSTEM_TEMPLATE_KINDS.has(kind)) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف القوالب التلقائية" });
    }
    getDb().prepare("DELETE FROM message_templates WHERE kind=?").run(kind);
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

// ─── Template variants ──────────────────────────────────────────────────────
// Multiple saved drafts per category (receipt/birthday/.../telegram_*), one
// flagged active. Activating a variant copies its body into message_templates
// so every existing sender (birthday cron, receipt send, telegramService) —
// which all read message_templates by kind — keeps working unchanged.
router.get("/template-variants", canView, (_req, res) => {
  try {
    const rows = getDb().prepare("SELECT * FROM message_template_variants ORDER BY category, id").all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/template-variants", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { category, label, body } = req.body;
    if (!category || !CATEGORY_CHANNEL[category]) return res.status(400).json({ success: false, message: "فئة غير صالحة" });
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: "نص القالب مطلوب" });
    const channel = CATEGORY_CHANNEL[category];
    const result = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?,?,?,?,0,datetime('now'))
    `).run(category, label?.trim() || null, body.trim(), channel);
    const row = db.prepare("SELECT * FROM message_template_variants WHERE id=?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/template-variants/:id", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { label, body } = req.body;
    const variant = db.prepare("SELECT * FROM message_template_variants WHERE id=?").get(req.params.id);
    if (!variant) return res.status(404).json({ success: false, message: "القالب غير موجود" });
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: "نص القالب مطلوب" });
    db.prepare("UPDATE message_template_variants SET label=?, body=?, updated_at=datetime('now') WHERE id=?")
      .run(label?.trim() || null, body.trim(), req.params.id);
    // Keep the canonical row in sync if this was the active variant.
    if (variant.is_active) {
      db.prepare("UPDATE message_templates SET body=?, updated_at=? WHERE kind=?").run(body.trim(), nowSql(), variant.category);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/template-variants/:id", canEdit, (req, res) => {
  try {
    const db = getDb();
    const variant = db.prepare("SELECT * FROM message_template_variants WHERE id=?").get(req.params.id);
    if (!variant) return res.status(404).json({ success: false, message: "القالب غير موجود" });
    if (variant.is_active) return res.status(400).json({ success: false, message: "فعّل قالباً آخر أولاً قبل حذف هذا القالب" });
    const remaining = db.prepare("SELECT COUNT(*) AS c FROM message_template_variants WHERE category=?").get(variant.category)?.c || 0;
    if (remaining <= 1) return res.status(400).json({ success: false, message: "لازم يفضل قالب واحد على الأقل لكل فئة" });
    db.prepare("DELETE FROM message_template_variants WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/template-variants/:id/activate", canEdit, (req, res) => {
  try {
    const db = getDb();
    const variant = db.prepare("SELECT * FROM message_template_variants WHERE id=?").get(req.params.id);
    if (!variant) return res.status(404).json({ success: false, message: "القالب غير موجود" });
    const tx = db.transaction(() => {
      db.prepare("UPDATE message_template_variants SET is_active=0 WHERE category=?").run(variant.category);
      db.prepare("UPDATE message_template_variants SET is_active=1 WHERE id=?").run(variant.id);
      db.prepare(`
        INSERT INTO message_templates (kind, body, channel) VALUES (?,?,?)
        ON CONFLICT(kind) DO UPDATE SET body=excluded.body, updated_at=?
      `).run(variant.category, variant.body, variant.channel, nowSql());
    });
    tx();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
