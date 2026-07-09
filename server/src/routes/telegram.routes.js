const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireAnyPagePermission } = require("../middleware/permission");
const { getTelegramConfig, sendTelegramMessage, buildMessage, EVENT_TYPES } = require("../services/telegramService");
const { getDb } = require("../config/database");

const router = express.Router();
router.use(authRequired);

// Read current Telegram configuration status (no secrets returned).
router.get("/config", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), (req, res) => {
  try {
    const config = getTelegramConfig(getDb());
    res.json({
      success: true,
      data: {
        configured: Boolean(config),
        enabled: Boolean(config?.enabled),
        notify_new_invoice: Boolean(config?.notifyNewInvoice),
        notify_daily_close: Boolean(config?.notifyDailyClose),
        notify_important_actions: Boolean(config?.notifyImportantActions),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Send a test message to verify the bot token + chat_id work.
router.post("/test", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const db = getDb();
    const config = getTelegramConfig(db);
    if (!config) {
      return res.status(400).json({ success: false, message: "إعدادات Telegram غير مكتملة — أدخل التوكن ومعرّف الدردشة ثم فعّل الإشعارات" });
    }
    const text = buildMessage(EVENT_TYPES.TEST, { branch: req.body?.branch });
    await sendTelegramMessage(config, text);
    res.json({ success: true, message: "تم إرسال رسالة الاختبار بنجاح" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
