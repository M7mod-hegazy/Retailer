const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireAnyPagePermission } = require("../middleware/permission");
const { getTelegramConfig, sendTelegramMessage, buildMessage, detectChatId, getBotInfo, EVENT_TYPES } = require("../services/telegramService");
const { getDb } = require("../config/database");
const QRCode = require("qrcode");

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

// Auto-detect chat_id from the bot's recent messages — lets the owner paste
// only the bot token and click a button instead of reading raw getUpdates JSON.
router.post("/detect-chat-id", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const { bot_token, api_base } = req.body || {};
    if (!bot_token || !bot_token.trim()) {
      return res.status(400).json({ success: false, message: "أدخل Bot Token أولاً" });
    }
    const chat = await detectChatId(bot_token.trim(), api_base?.trim() || undefined);
    if (!chat) {
      return res.status(404).json({ success: false, message: "لسه مفيش رسائل — ابدأ محادثة مع البوت بدوسة Start وجرّب تاني" });
    }
    res.json({ success: true, data: chat });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Build a connect deep-link + QR for the store's own bot. Derives the bot
// username from the token via getMe, so the owner only pastes the token, then
// scans the QR from their phone (opens t.me/<bot>?start=connect → taps Start).
router.post("/deep-link", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const { bot_token, api_base } = req.body || {};
    if (!bot_token || !bot_token.trim()) {
      return res.status(400).json({ success: false, message: "أدخل Bot Token أولاً" });
    }
    const info = await getBotInfo(bot_token.trim(), api_base?.trim() || undefined);
    if (!info?.username) {
      return res.status(404).json({ success: false, message: "تعذّر قراءة بيانات البوت — تأكد من صحة التوكن" });
    }
    const url = `https://t.me/${info.username}?start=connect`;
    const qr = await QRCode.toDataURL(url, { width: 256, margin: 1 });
    res.json({ success: true, data: { url, qr, username: info.username } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
