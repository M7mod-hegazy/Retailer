const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { normalizeDigits } = require("../utils/phone");

const router = express.Router();
router.use(authRequired);

// Leads reuse the "customers" page permission (marketing contacts are customer-adjacent).
const canView = requirePagePermission("customers", "view");
const canAdd = requirePagePermission("customers", "add");
const canEdit = requirePagePermission("customers", "edit");
const canDelete = requirePagePermission("customers", "delete");

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; }
    catch { return raw.split(",").map((t) => t.trim()).filter(Boolean); }
  }
  return [];
}

// GET /api/leads — filters: q, tag, source, opted_out, from, to (created_at), contacted_before
router.get("/", canView, (req, res) => {
  try {
    const db = getDb();
    const { q, tag, source, opted_out, from, to, contacted_before } = req.query;
    const where = ["1=1"];
    const params = [];
    if (q) {
      where.push("(name LIKE ? OR phone_normalized LIKE ? OR phone_raw LIKE ?)");
      const like = `%${String(q).trim()}%`;
      params.push(like, like, like);
    }
    if (tag) { where.push("EXISTS (SELECT 1 FROM json_each(leads.tags) WHERE json_each.value = ?)"); params.push(String(tag)); }
    if (source) { where.push("source = ?"); params.push(String(source)); }
    if (opted_out === "1") where.push("opted_out = 1");
    else if (opted_out === "0") where.push("opted_out = 0");
    if (from) { where.push("date(created_at) >= date(?)"); params.push(String(from)); }
    if (to) { where.push("date(created_at) <= date(?)"); params.push(String(to)); }
    if (contacted_before) { where.push("(last_contacted_at IS NULL OR date(last_contacted_at) < date(?))"); params.push(String(contacted_before)); }

    const rows = db.prepare(`SELECT * FROM leads WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT 1000`).all(...params);
    rows.forEach((r) => { r.tags = parseTags(r.tags); });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/leads — quick-add (upsert by normalized phone)
router.post("/", canAdd, (req, res) => {
  try {
    const db = getDb();
    const { phone, name, tags, note, birthday, source = "quick_add" } = req.body;
    const norm = normalizeDigits(phone);
    if (!norm) return res.status(400).json({ success: false, message: "رقم هاتف غير صالح" });

    const tagsJson = JSON.stringify(parseTags(tags));
    db.prepare(`
      INSERT INTO leads (phone_normalized, phone_raw, name, note, birthday, tags, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_normalized) DO UPDATE SET
        name = COALESCE(excluded.name, leads.name),
        note = COALESCE(excluded.note, leads.note),
        birthday = COALESCE(excluded.birthday, leads.birthday),
        tags = CASE WHEN excluded.tags != '[]' THEN excluded.tags ELSE leads.tags END,
        updated_at = datetime('now', 'localtime')
    `).run(norm, String(phone), name?.trim() || null, note?.trim() || null, birthday || null, tagsJson, source);

    const lead = db.prepare("SELECT * FROM leads WHERE phone_normalized = ?").get(norm);
    lead.tags = parseTags(lead.tags);
    res.status(201).json({ success: true, data: lead });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/leads/:id — edit name/tags/note/birthday
router.put("/:id", canEdit, (req, res) => {
  try {
    const db = getDb();
    const { name, tags, note, birthday } = req.body;
    db.prepare("UPDATE leads SET name=?, tags=?, note=?, birthday=?, updated_at=datetime('now', 'localtime') WHERE id=?")
      .run(name?.trim() || null, JSON.stringify(parseTags(tags)), note?.trim() || null, birthday || null, req.params.id);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (lead) lead.tags = parseTags(lead.tags);
    res.json({ success: true, data: lead });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/leads/:id/opt-out — toggle opted_out
router.patch("/:id/opt-out", canEdit, (req, res) => {
  try {
    const db = getDb();
    const val = req.body.opted_out === false || req.body.opted_out === 0 ? 0 : 1;
    db.prepare("UPDATE leads SET opted_out=?, updated_at=datetime('now', 'localtime') WHERE id=?").run(val, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", canDelete, (req, res) => {
  try {
    getDb().prepare("DELETE FROM leads WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/leads/audience — union of contactable leads + opted-in customers, deduped (customer-wins).
// Supports the same lead filters (tag/source/date) which only narrow the leads side.
router.get("/audience", canView, (req, res) => {
  try {
    const db = getDb();
    const { tag, source, from, to, include = "both" } = req.query;

    const leadWhere = ["opted_out = 0", "promoted_customer_id IS NULL"];
    const leadParams = [];
    if (tag) { leadWhere.push("EXISTS (SELECT 1 FROM json_each(leads.tags) WHERE json_each.value = ?)"); leadParams.push(String(tag)); }
    if (source) { leadWhere.push("source = ?"); leadParams.push(String(source)); }
    if (from) { leadWhere.push("date(created_at) >= date(?)"); leadParams.push(String(from)); }
    if (to) { leadWhere.push("date(created_at) <= date(?)"); leadParams.push(String(to)); }

    let leads = [];
    if (include === "both" || include === "leads") {
      leads = db.prepare(`SELECT id AS lead_id, name, phone_normalized, phone_raw FROM leads WHERE ${leadWhere.join(" AND ")}`).all(...leadParams);
    }

    let customers = [];
    if (include === "both" || include === "customers") {
      customers = db.prepare(`
        SELECT id AS customer_id, name, phone FROM customers
        WHERE marketing_opt_in = 1 AND (whatsapp_opt_out IS NULL OR whatsapp_opt_out = 0)
          AND phone IS NOT NULL AND phone != ''
      `).all();
    }

    // Dedupe by normalized phone — customer wins (real name/segment).
    const byPhone = new Map();
    for (const l of leads) {
      const norm = l.phone_normalized || normalizeDigits(l.phone_raw);
      if (!norm) continue;
      byPhone.set(norm, { phone_normalized: norm, name: l.name || null, kind: "lead", lead_id: l.lead_id, customer_id: null });
    }
    for (const c of customers) {
      const norm = normalizeDigits(c.phone);
      if (!norm) continue;
      byPhone.set(norm, { phone_normalized: norm, name: c.name || null, kind: "customer", lead_id: null, customer_id: c.customer_id });
    }

    const data = [...byPhone.values()];
    res.json({ success: true, data, count: data.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
