const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireAnyPagePermission } = require("../middleware/permission");
const { getTelegramConfig, getTelegramRecipients, getLegacyTelegramConfig, sendTelegramMessage, buildMessage, detectChatId, getBotInfo, EVENT_TYPES, processQueue, logSentNotification } = require("../services/telegramService");
const { getDb } = require("../config/database");
const QRCode = require("qrcode");

const router = express.Router();
router.use(authRequired);

// Read current Telegram configuration status (no secrets returned).
router.get("/config", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), (req, res) => {
  try {
    const db = getDb();
    const config = getTelegramConfig(db);
    const recipients = getTelegramRecipients(db);
    res.json({
      success: true,
      data: {
        configured: Boolean(config),
        enabled: Boolean(config?.enabled),
        recipients_count: recipients.length,
        recipients_enabled: recipients.filter((r) => r.enabled).length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Recipients CRUD ────────────────────────────────────────────────────────
function recipientFromBody(body) {
  const asBool = (v) => v === true || v === 1 || v === "1" || v === "true";
  return {
    name: String(body?.name || "").trim(),
    chat_id: String(body?.chat_id || "").trim(),
    enabled: asBool(body?.enabled),
    notify_new_invoice: asBool(body?.notify_new_invoice),
    notify_daily_close: asBool(body?.notify_daily_close),
    notify_large_amounts: asBool(body?.notify_large_amounts),
    notify_returns_voids: asBool(body?.notify_returns_voids),
    notify_purchases_payments: asBool(body?.notify_purchases_payments),
    notify_customer_created: asBool(body?.notify_customer_created),
    notify_supplier_created: asBool(body?.notify_supplier_created),
    notify_expense_created: asBool(body?.notify_expense_created),
    notify_return_payment: asBool(body?.notify_return_payment),
    notify_low_stock: asBool(body?.notify_low_stock),
    notify_system: asBool(body?.notify_system),
    notify_weekly: asBool(body?.notify_weekly),
    notify_monthly: asBool(body?.notify_monthly),
    notify_yearly: asBool(body?.notify_yearly),
    // Extended events (migration 194)
    notify_stock_transfer: asBool(body?.notify_stock_transfer),
    notify_inventory_adjustment: asBool(body?.notify_inventory_adjustment),
    notify_new_product: asBool(body?.notify_new_product),
    notify_price_change: asBool(body?.notify_price_change),
    notify_batch_expiry: asBool(body?.notify_batch_expiry),
    notify_physical_count: asBool(body?.notify_physical_count),
    notify_supplier_payment: asBool(body?.notify_supplier_payment),
    notify_debt_payment: asBool(body?.notify_debt_payment),
    notify_installment_paid: asBool(body?.notify_installment_paid),
    notify_purchase_voided: asBool(body?.notify_purchase_voided),
    notify_purchase_return: asBool(body?.notify_purchase_return),
    notify_branch_transfer: asBool(body?.notify_branch_transfer),
    notify_password_changed: asBool(body?.notify_password_changed),
    notify_permission_changed: asBool(body?.notify_permission_changed),
    notify_supervisor_override: asBool(body?.notify_supervisor_override),
    notify_repair_created: asBool(body?.notify_repair_created),
    notify_repair_ready: asBool(body?.notify_repair_ready),
    notify_repair_delivered: asBool(body?.notify_repair_delivered),
    notify_revenue_created: asBool(body?.notify_revenue_created),
    notify_withdrawal_created: asBool(body?.notify_withdrawal_created),
    notify_employee_created: asBool(body?.notify_employee_created),
    notify_salary_settled: asBool(body?.notify_salary_settled),
    notify_advance_created: asBool(body?.notify_advance_created),
    notify_deduction_created: asBool(body?.notify_deduction_created),
    notify_bonus_created: asBool(body?.notify_bonus_created),
    // New edit/delete events (migration 201)
    notify_expense_edited: asBool(body?.notify_expense_edited),
    notify_expense_deleted: asBool(body?.notify_expense_deleted),
    notify_revenue_edited: asBool(body?.notify_revenue_edited),
    notify_revenue_deleted: asBool(body?.notify_revenue_deleted),
    // Return lifecycle sub-events (migration 210)
    notify_sales_return_edited: asBool(body?.notify_sales_return_edited),
    notify_sales_return_cancelled: asBool(body?.notify_sales_return_cancelled),
    notify_purchase_return_edited: asBool(body?.notify_purchase_return_edited),
    // Edit/cancel sub-events (migration 208)
    notify_invoice_edited: asBool(body?.notify_invoice_edited),
    notify_invoice_amended: asBool(body?.notify_invoice_amended),
    notify_purchase_edited: asBool(body?.notify_purchase_edited),
    notify_purchase_return_cancelled: asBool(body?.notify_purchase_return_cancelled),
    notify_branch_transfer_edited: asBool(body?.notify_branch_transfer_edited),
    notify_branch_transfer_cancelled: asBool(body?.notify_branch_transfer_cancelled),
    notify_withdrawal_edited: asBool(body?.notify_withdrawal_edited),
    notify_withdrawal_deleted: asBool(body?.notify_withdrawal_deleted),
    event_presets: parseEventPresets(body?.event_presets),
  };
}

function parseEventPresets(v) {
  if (!v) return "{}";
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return JSON.stringify(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
    } catch (_) {
      return "{}";
    }
  }
  if (typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
  return "{}";
}

// All writable columns, in one place — INSERT and UPDATE are generated from
// this list so they can never drift apart again.
const RECIPIENT_WRITE_COLUMNS = [
  "name", "chat_id", "enabled",
  "notify_new_invoice", "notify_daily_close", "notify_large_amounts",
  "notify_returns_voids", "notify_purchases_payments",
  "notify_customer_created", "notify_supplier_created", "notify_expense_created", "notify_return_payment",
  "notify_low_stock", "notify_system", "notify_weekly", "notify_monthly", "notify_yearly",
  "notify_stock_transfer", "notify_inventory_adjustment", "notify_new_product", "notify_price_change",
  "notify_batch_expiry", "notify_physical_count",
  "notify_supplier_payment", "notify_debt_payment", "notify_installment_paid",
  "notify_purchase_voided", "notify_purchase_return", "notify_branch_transfer",
  "notify_password_changed", "notify_permission_changed", "notify_supervisor_override",
  "notify_repair_created", "notify_repair_ready", "notify_repair_delivered",
  "notify_revenue_created", "notify_withdrawal_created",
  "notify_employee_created", "notify_salary_settled", "notify_advance_created",
  "notify_deduction_created", "notify_bonus_created",
  // New edit/delete events (migration 201)
  "notify_expense_edited", "notify_expense_deleted",
  "notify_revenue_edited", "notify_revenue_deleted",
  // Return lifecycle sub-events (migration 210)
  "notify_sales_return_edited", "notify_sales_return_cancelled", "notify_purchase_return_edited",
  // Edit/cancel sub-events (migration 208)
  "notify_invoice_edited", "notify_invoice_amended",
  "notify_purchase_edited", "notify_purchase_return_cancelled",
  "notify_branch_transfer_edited", "notify_branch_transfer_cancelled",
  "notify_withdrawal_edited", "notify_withdrawal_deleted",
  "event_presets",
];

function recipientWriteValues(r) {
  return RECIPIENT_WRITE_COLUMNS.map((col) => {
    if (col === "name") return r.name || "مستلم Telegram";
    if (col === "chat_id") return r.chat_id;
    if (col === "event_presets") return r.event_presets;
    return r[col] ? 1 : 0;
  });
}

function insertRecipient(db, r) {
  const placeholders = RECIPIENT_WRITE_COLUMNS.map(() => "?").join(", ");
  const result = db.prepare(`
    INSERT INTO telegram_recipients (${RECIPIENT_WRITE_COLUMNS.join(", ")})
    VALUES (${placeholders})
  `).run(...recipientWriteValues(r));
  return result.lastInsertRowid;
}

function updateRecipient(db, id, r) {
  const assignments = RECIPIENT_WRITE_COLUMNS.map((c) => `${c} = ?`).join(", ");
  db.prepare(`UPDATE telegram_recipients SET ${assignments} WHERE id = ?`)
    .run(...recipientWriteValues(r), id);
}

function schemaErrorResponse(res, e) {
  const message = e.message || "";
  const isSchemaError = /no such column|has no column|NOT NULL constraint failed/.test(message);
  res.status(500).json({
    success: false,
    message: isSchemaError
      ? `خطأ في هيكل قاعدة البيانات: ${message}. أعد تشغيل السيرفر لتطبيق التحديثات.`
      : message,
  });
}

router.get("/recipients", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), (req, res) => {
  try {
    const recipients = getTelegramRecipients(getDb());
    res.json({ success: true, data: recipients });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/recipients", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), (req, res) => {
  try {
    const db = getDb();
    const r = recipientFromBody(req.body);
    if (!r.chat_id) {
      return res.status(400).json({ success: false, message: "Chat ID مطلوب" });
    }
    // Upsert: a chat that is already registered gets updated instead of
    // duplicated — repeated saves from the client stay idempotent.
    const existing = db.prepare("SELECT id FROM telegram_recipients WHERE chat_id = ?").get(r.chat_id);
    if (existing) {
      updateRecipient(db, existing.id, r);
      return res.json({ success: true, data: { id: existing.id, ...r } });
    }
    const id = insertRecipient(db, r);
    res.json({ success: true, data: { id, ...r } });
  } catch (e) {
    schemaErrorResponse(res, e);
  }
});

router.put("/recipients/:id", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), (req, res) => {
  try {
    const db = getDb();
    const r = recipientFromBody(req.body);
    if (!r.chat_id) {
      return res.status(400).json({ success: false, message: "Chat ID مطلوب" });
    }
    const clash = db.prepare("SELECT id FROM telegram_recipients WHERE chat_id = ? AND id != ?").get(r.chat_id, req.params.id);
    if (clash) {
      return res.status(400).json({ success: false, message: "يوجد مستلم آخر بنفس معرّف المحادثة" });
    }
    updateRecipient(db, req.params.id, r);
    res.json({ success: true, data: { id: Number(req.params.id), ...r } });
  } catch (e) {
    schemaErrorResponse(res, e);
  }
});

router.delete("/recipients/:id", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), (req, res) => {
  try {
    getDb().prepare("DELETE FROM telegram_recipients WHERE id = ?").run(req.params.id);
    res.json({ success: true });
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
      return res.status(400).json({ success: false, message: "إعدادات Telegram غير مكتملة — أدخل التوكن وفعّل الإشعارات" });
    }
    const recipients = getTelegramRecipients(db);
    const targetChatId = req.body?.chat_id;
    const text = buildMessage(EVENT_TYPES.TEST, { branch: req.body?.branch });

    if (targetChatId) {
      await sendTelegramMessage(config, targetChatId, text);
      logSentNotification(db, "test", targetChatId, text);
      return res.json({ success: true, message: "تم إرسال رسالة الاختبار بنجاح" });
    }

    if (recipients.length === 0) {
      // Legacy fallback.
      const legacy = getLegacyTelegramConfig(db);
      if (!legacy) {
        return res.status(400).json({ success: false, message: "لا يوجد مستلم — أضف Chat ID أولاً" });
      }
      await sendTelegramMessage(legacy, legacy.chatId, text);
      logSentNotification(db, "test", legacy.chatId, text);
      return res.json({ success: true, message: "تم إرسال رسالة الاختبار بنجاح" });
    }

    for (const recipient of recipients) {
      if (!recipient.enabled) continue;
      await sendTelegramMessage(config, recipient.chatId, text);
      logSentNotification(db, "test", recipient.chatId, text);
    }
    res.json({ success: true, message: "تم إرسال رسالة الاختبار للمستلمين" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// On-demand smart insights (تقرير القرارات الذكية): builds the reorder /
// dead-stock / weak-margin / rising-products report NOW and sends it to all
// enabled recipients (or returns it as preview_only without sending).
router.post("/insights/send", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const db = getDb();
    const { buildInsightsMessage } = require("../services/telegramInsights");
    let settings = null;
    try { settings = db.prepare("SELECT * FROM settings WHERE id = 1").get(); } catch (_) {}
    const text = buildInsightsMessage(db, {
      currencySymbol: settings?.currency_symbol || "ج",
      branch: settings?.store_name || settings?.shop_name || settings?.company_name || "",
    });
    if (!text) {
      return res.json({ success: true, data: { sent: 0, empty: true }, message: "لا توجد توصيات حالياً — كل المؤشرات سليمة ✅" });
    }
    if (req.body?.preview_only) {
      return res.json({ success: true, data: { text, sent: 0 } });
    }

    const config = getTelegramConfig(db);
    if (!config || !config.enabled) {
      return res.status(400).json({ success: false, message: "إعدادات Telegram غير مكتملة — أدخل التوكن وفعّل الإشعارات" });
    }
    const recipients = getTelegramRecipients(db);
    let sent = 0;
    if (recipients.length > 0) {
      for (const recipient of recipients) {
        if (!recipient.enabled) continue;
        await sendTelegramMessage(config, recipient.chatId, text);
        logSentNotification(db, "insights_manual", recipient.chatId, text);
        sent++;
      }
    } else {
      const legacy = getLegacyTelegramConfig(db);
      if (!legacy) return res.status(400).json({ success: false, message: "لا يوجد مستلم — أضف Chat ID أولاً" });
      await sendTelegramMessage(legacy, legacy.chatId, text);
      logSentNotification(db, "insights_manual", legacy.chatId, text);
      sent++;
    }
    res.json({ success: true, data: { sent, text } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Auto-detect chat_id from the bot's recent messages — lets the owner paste
// only the bot token and click a button instead of reading raw getUpdates JSON.
// Returns 200 with { found: false } when no chat is available yet (instead of
// 404) so the client-side polling interval doesn't spam the browser console.
router.post("/detect-chat-id", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const { bot_token, api_base } = req.body || {};
    if (!bot_token || !bot_token.trim()) {
      return res.status(400).json({ success: false, message: "أدخل Bot Token أولاً" });
    }
    const chat = await detectChatId(bot_token.trim(), api_base?.trim() || undefined);
    if (!chat) {
      return res.json({ success: true, found: false, message: "لسه مفيش رسائل — ابدأ محادثة مع البوت بدوسة Start وجرّب تاني" });
    }
    res.json({ success: true, found: true, data: chat });
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

// Validate a bot token by calling getMe — returns bot name/username so the
// client can auto-verify and auto-generate QR without an extra click.
router.post("/bot-info", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const { bot_token, api_base } = req.body || {};
    if (!bot_token || !bot_token.trim()) {
      return res.status(400).json({ success: false, message: "أدخل Bot Token أولاً" });
    }
    const info = await getBotInfo(bot_token.trim(), api_base?.trim() || undefined);
    if (!info) {
      return res.status(404).json({ success: false, found: false });
    }
    const name = [info.first_name, info.last_name].filter(Boolean).join(" ");
    res.json({
      success: true, found: true,
      data: { username: info.username, name: name || info.username, id: info.id },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Phone pairing ──────────────────────────────────────────────────────────
// In-memory store for pending pairing sessions. Each entry expires after 5 min.
const pairingSessions = new Map();
const PAIRING_TTL_MS = 5 * 60 * 1000;

function gcPairing() {
  const now = Date.now();
  for (const [code, session] of pairingSessions) {
    if (now - session.createdAt > PAIRING_TTL_MS) pairingSessions.delete(code);
  }
}
setInterval(gcPairing, 60_000);

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Start a pairing session — returns code + URL for the phone to open.
router.post("/pairing/start", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  gcPairing();
  const code = generateCode();
  pairingSessions.set(code, { token: null, createdAt: Date.now() });
  const port = process.env.ACTUAL_PORT || process.env.PORT || "5000";
  const lanIP = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const cleanIP = String(lanIP).replace(/^::ffff:/, "");
  const baseUrl = `http://${cleanIP === "::1" || cleanIP === "127.0.0.1" ? "127.0.0.1" : cleanIP}:${port}`;
  const url = `${baseUrl}/pairing/${code}`;
  const qr = await QRCode.toDataURL(url, { width: 256, margin: 1 });
  res.json({
    success: true,
    data: { code, url, qr },
  });
});

// Poll for pairing result — the client calls this until a token arrives.
router.get("/pairing/:code/status", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), (req, res) => {
  const session = pairingSessions.get(req.params.code);
  if (!session) return res.json({ success: true, found: false });
  if (session.token) {
    pairingSessions.delete(req.params.code);
    return res.json({ success: true, found: true, data: { token: session.token } });
  }
  res.json({ success: true, found: false });
});

// Cancel a pairing session
router.delete("/pairing/:code", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), (req, res) => {
  pairingSessions.delete(req.params.code);
  res.json({ success: true });
});

// Disconnect Telegram: clear local credentials and retry queue.
// Note: Telegram has no API to revoke the bot token itself;
// the user must revoke it via @BotFather if desired.
router.post("/disconnect", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), (req, res) => {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE settings SET
        telegram_enabled = 0,
        telegram_bot_token = '',
        telegram_chat_id = ''
      WHERE id = 1
    `).run();
    db.prepare("DELETE FROM telegram_recipients").run();
    db.prepare("DELETE FROM pending_notifications").run();
    res.json({ success: true, message: "تم فصل Telegram بنجاح" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// History of sent/failed Telegram owner notifications.
router.get("/history", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const rows = db.prepare(`
      SELECT id, event_type, text, status, retry_count, error, created_at, sent_at
      FROM pending_notifications
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Force-drain the pending queue immediately (owner-facing manual retry).
router.post("/retry-queue", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    await processQueue();
    const db = getDb();
    const pending = db.prepare("SELECT COUNT(*) AS c FROM pending_notifications WHERE status = 'pending'").get()?.c || 0;
    const failed = db.prepare("SELECT COUNT(*) AS c FROM pending_notifications WHERE status = 'failed'").get()?.c || 0;
    res.json({ success: true, pending, failed });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

// ── Public pairing page (no auth) ──────────────────────────────────────────
// Exported separately so app.js can mount it outside the auth middleware.
module.exports.pairingPageRouter = (() => {
  const r = express.Router();

  r.get("/pairing/:code", (req, res) => {
    const session = pairingSessions.get(req.params.code);
    if (!session) {
      return res.status(404).send(`
        <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>منتهي</title><style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;color:#666}</style>
        </head><body><div style="text-align:center"><h2>هذا الرابط منتهي أو غير صالح</h2><p>ارجع للتطبيق وأعد المحاولة</p></div></body></html>`);
    }
    res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
    <title>ربط Telegram</title><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:16px}
      .card{background:#1e293b;border-radius:16px;padding:32px 24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
      h1{font-size:20px;font-weight:800;text-align:center;margin-bottom:6px}
      p{font-size:13px;color:#94a3b8;text-align:center;margin-bottom:24px;line-height:1.6}
      input{width:100%;padding:14px 16px;border-radius:12px;border:2px solid #334155;background:#0f172a;color:#e2e8f0;font-size:15px;font-family:monospace;direction:ltr;text-align:center;letter-spacing:1px;outline:none;transition:border-color .2s}
      input:focus{border-color:#6366f1}input::placeholder{color:#475569;letter-spacing:0}
      button{width:100%;padding:14px;border-radius:12px;border:none;background:#6366f1;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:16px;transition:all .2s}
      button:disabled{opacity:.4;cursor:not-allowed}button:not(:disabled):hover{background:#818cf8}
      .ok{background:#22c55e;text-align:center;padding:16px;border-radius:12px;margin-top:16px;font-weight:700;display:none}
      .err{background:rgba(239,68,68,.15);color:#fca5a5;text-align:center;padding:12px;border-radius:10px;margin-top:12px;font-size:13px;display:none}
      .spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-left:8px}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style></head><body>
    <div class="card">
      <h1>🤖 ربط Telegram</h1>
      <p>الصق Bot Token هنا — هتلاقيه في محادثة @BotFather على تليجرام</p>
      <form id="f">
        <input id="tok" type="text" placeholder="123456789:ABCdefGHI..." autocomplete="off" spellcheck="false" autofocus />
        <button type="submit" id="btn">إرسال للجهاز</button>
      </form>
      <div class="ok" id="ok">✅ تم الإرسال — رجع للتطبيق على الكمبيوتر</div>
      <div class="err" id="err"></div>
    </div>
    <script>
      const code = "${req.params.code}";
      document.getElementById("f").onsubmit = async (e) => {
        e.preventDefault();
        const token = document.getElementById("tok").value.trim();
        if (!token) return;
        const btn = document.getElementById("btn");
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';
        try {
          const r = await fetch("/pairing/" + code, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ token }) });
          const d = await r.json();
          if (d.success) {
            document.getElementById("ok").style.display = "block";
            document.getElementById("f").style.display = "none";
          } else {
            throw new Error(d.message || "فشل");
          }
        } catch (err) {
          const el = document.getElementById("err");
          el.textContent = "❌ " + err.message; el.style.display = "block";
          btn.disabled = false; btn.textContent = "إرسال للجهاز";
        }
      };
    </script></body></html>`);
  });

  r.post("/pairing/:code", express.json(), (req, res) => {
    const session = pairingSessions.get(req.params.code);
    if (!session) return res.status(404).json({ success: false, message: "هذا الرابط منتهي" });
    const { token } = req.body || {};
    if (!token || !token.trim()) return res.status(400).json({ success: false, message: "الصق التوكن أولاً" });
    session.token = token.trim();
    res.json({ success: true });
  });

  return r;
})();
