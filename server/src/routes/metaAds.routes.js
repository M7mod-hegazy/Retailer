const express = require("express");
const router = express.Router();
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const metaService = require("../services/metaAdsService");

// ─── Get config ──────────────────────────────────────────────────────────────
router.get("/config", authRequired, requirePagePermission("settings", "edit"), (_req, res) => {
  try {
    const cfg = metaService.getConfig();
    res.json({ success: true, data: { ...cfg, access_token: cfg.access_token ? "••••" + cfg.access_token.slice(-4) : null } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Save config ─────────────────────────────────────────────────────────────
router.put("/config", authRequired, requirePagePermission("settings", "edit"), (req, res) => {
  try {
    const { access_token, app_id, app_secret, pixel_id, business_id, ad_account_id } = req.body;
    metaService.saveConfig({ access_token, app_id, app_secret, pixel_id, business_id, ad_account_id, enabled: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Test connection ─────────────────────────────────────────────────────────
router.post("/test-connection", authRequired, requirePagePermission("settings", "edit"), async (_req, res) => {
  try {
    const result = await metaService.testConnection();
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Sync audiences ──────────────────────────────────────────────────────────
router.post("/sync-audiences", authRequired, requirePagePermission("whatsapp_crm", "view"), async (_req, res) => {
  try {
    const result = await metaService.syncAudiences();
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── List audiences ──────────────────────────────────────────────────────────
router.get("/audiences", authRequired, requirePagePermission("whatsapp_crm", "view"), (_req, res) => {
  try {
    const db = getDb();
    const audiences = db.prepare("SELECT * FROM meta_ads_audiences ORDER BY created_at DESC").all();
    res.json({ success: true, data: audiences });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Create custom audience ──────────────────────────────────────────────────
router.post("/audiences", authRequired, requirePagePermission("whatsapp_crm", "view"), async (req, res) => {
  try {
    const { name, description, include = "opted_in" } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "اسم الجمهور مطلوب" });
    const db = getDb();
    let emails = [];
    if (include === "opted_in") {
      emails = db.prepare("SELECT email FROM customers WHERE marketing_opt_in = 1 AND email IS NOT NULL AND email LIKE '%@%'").all().map(r => r.email);
    } else if (include === "all") {
      emails = db.prepare("SELECT email FROM customers WHERE email IS NOT NULL AND email LIKE '%@%'").all().map(r => r.email);
    }
    const result = await metaService.createCustomAudience(name.trim(), description, emails);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Push audience to Meta ───────────────────────────────────────────────────
router.post("/audiences/:id/push", authRequired, requirePagePermission("whatsapp_crm", "view"), async (req, res) => {
  try {
    const db = getDb();
    const aud = db.prepare("SELECT * FROM meta_ads_audiences WHERE id = ?").get(req.params.id);
    if (!aud) return res.status(404).json({ success: false, message: "الجمهور غير موجود" });
    const result = await metaService.pushAudience(aud.meta_audience_id);
    db.prepare("UPDATE meta_ads_audiences SET size = ?, status = 'ready' WHERE id = ?").run(result.pushed, req.params.id);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Get lead forms ──────────────────────────────────────────────────────────
router.get("/lead-forms", authRequired, requirePagePermission("whatsapp_crm", "view"), async (_req, res) => {
  try {
    const result = await metaService.getLeadForms();
    res.json({ success: true, data: result.forms });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── List saved lead forms ───────────────────────────────────────────────────
router.get("/lead-forms/saved", authRequired, requirePagePermission("whatsapp_crm", "view"), (_req, res) => {
  try {
    const db = getDb();
    const forms = db.prepare("SELECT * FROM meta_lead_forms ORDER BY created_at DESC").all();
    res.json({ success: true, data: forms });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Sync leads from form ────────────────────────────────────────────────────
router.post("/lead-forms/:metaFormId/sync", authRequired, requirePagePermission("whatsapp_crm", "view"), async (req, res) => {
  try {
    const result = await metaService.syncLeads(req.params.metaFormId);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Disconnect ──────────────────────────────────────────────────────────────
router.delete("/config", authRequired, requirePagePermission("settings", "edit"), (_req, res) => {
  try {
    const db = getDb();
    db.prepare("UPDATE meta_ads_config SET enabled = 0, access_token = NULL, app_secret = NULL WHERE id = 1").run();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
