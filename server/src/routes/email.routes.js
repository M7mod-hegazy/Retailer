const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { loadConfig, verifyConnection, sendEmail, drainOutbox, getStats, queueBulk } = require("../services/emailService");

const router = express.Router();
router.use(authRequired);

const canView = requirePagePermission("whatsapp_crm", "view");
const canEdit = requirePagePermission("whatsapp_crm", "edit");

// ─── Email status (lightweight — used by header badge) ────────────────────
router.get("/status", canView, (_req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, data: stats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Get email config (password/key masked) ───────────────────────────────
router.get("/config", canView, (_req, res) => {
  try {
    const cfg = loadConfig();
    res.json({
      success: true,
      data: {
        email_enabled: cfg.enabled,
        email_provider: cfg.provider,
        email_host: cfg.host,
        email_port: cfg.port,
        email_secure: cfg.secure,
        email_user: cfg.user,
        email_pass: cfg.pass ? "••••••••" : "",
        email_api_key: cfg.apiKey ? "••••••••" : "",
        email_domain: cfg.domain,
        email_from_name: cfg.fromName,
        email_from_email: cfg.fromEmail,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Save email config ────────────────────────────────────────────────────
router.put("/config", canEdit, (req, res) => {
  try {
    const db = getDb();
    const {
      email_enabled, email_provider,
      email_host, email_port, email_secure,
      email_user, email_pass,
      email_api_key, email_domain,
      email_from_name, email_from_email,
    } = req.body;

    // Validate required fields
    if (email_enabled) {
      if (!email_provider) return res.status(400).json({ success: false, message: "نوع الخدمة مطلوب" });
      if (!email_from_email) return res.status(400).json({ success: false, message: "بريد المرسل مطلوب" });
      if (email_provider === "smtp" && !email_host) {
        return res.status(400).json({ success: false, message: "اسم الخادم (Host) مطلوب لـ SMTP" });
      }
    }

    const fields = [
      "email_enabled", "email_provider",
      "email_host", "email_port", "email_secure",
      "email_user", "email_pass",
      "email_api_key", "email_domain",
      "email_from_name", "email_from_email",
    ];

    const sets = [];
    const params = [];
    for (const f of fields) {
      let val = req.body[f];
      // Don't overwrite with masked value
      if (val === "••••••••") continue;
      if (f === "email_enabled") val = val ? 1 : 0;
      if (f === "email_secure") val = val ? 1 : 0;
      if (f === "email_port") val = Number(val) || 465;
      sets.push(`${f} = ?`);
      params.push(val ?? null);
    }

    if (sets.length > 0) {
      db.prepare(`UPDATE settings SET ${sets.join(", ")} WHERE id = 1`).run(...params);
    }

    res.json({ success: true, message: "تم حفظ إعدادات البريد الإلكتروني" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Test connection ──────────────────────────────────────────────────────
router.post("/test-connection", canEdit, async (_req, res) => {
  try {
    const result = await verifyConnection();
    res.json({ success: result.success, message: result.message });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Send test email ──────────────────────────────────────────────────────
router.post("/send-test", canEdit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "أدخل بريد إلكتروني صالح" });
    }
    const result = await sendEmail({
      to: email,
      subject: "رسالة تجريبية — ElHegazi Retailer",
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#16a34a">✓ تم الاتصال بنجاح!</h2>
          <p>رسالة تجريبية من نظام ElHegazi Retailer</p>
          <p>البريد الإلكتروني مفعّل وجاهز لإرسال الحملات والفواتير.</p>
          <hr style="border:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#6b7280;font-size:12px">هذه رسالة تجريبية — لا تحتاج للرد</p>
        </div>
      `,
      text: "✓ تم الاتصال بنجاح! رسالة تجريبية من نظام ElHegazi Retailer",
    });
    if (result.success) {
      res.json({ success: true, message: "تم إرسال الرسالة التجريبية بنجاح" });
    } else {
      res.status(400).json({ success: false, message: result.error || "فشل الإرسال" });
    }
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Drain outbox (manual trigger) ────────────────────────────────────────
router.post("/drain", canEdit, async (_req, res) => {
  try {
    const count = await drainOutbox(50);
    res.json({ success: true, data: { sent: count } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
