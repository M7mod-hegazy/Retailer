// Telegram owner notification channel.
// Sends the system owner a Telegram message for important events. If the API
// call fails (no internet, Telegram down, bad token), the message is written to
// pending_notifications and retried periodically with a cap.
//
// Setup: see docs/telegram-setup.md
const { getDb } = require("../config/database");
const logger = require("../config/logger");

const MAX_RETRIES = 10;
const MAX_AGE_HOURS = 24;
const RETRY_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const EVENT_TYPES = {
  NEW_INVOICE: "new_invoice",
  DAILY_CLOSE: "daily_close",
  LARGE_INVOICE: "large_invoice",
  LARGE_DISCOUNT: "large_discount",
  SALES_RETURN: "sales_return",
  INVOICE_VOIDED: "invoice_voided",
  PURCHASE_CREATED: "purchase_created",
  CUSTOMER_PAYMENT: "customer_payment",
  LOW_STOCK: "low_stock",
  BACKUP_RESULT: "backup_result",
  FAILED_LOGIN: "failed_login",
  SHIFT_CLOSE: "shift_close",
  TEST: "test",
};

function getTelegramConfig(db) {
  try {
    const row = db
      .prepare(
        `SELECT telegram_enabled, telegram_bot_token, telegram_chat_id, telegram_api_base,
                telegram_notify_new_invoice, telegram_notify_daily_close, telegram_notify_important_actions
         FROM settings WHERE id = 1`
      )
      .get();
    if (!row || !row.telegram_enabled || !row.telegram_bot_token || !row.telegram_chat_id) {
      return null;
    }
    return {
      enabled: Boolean(row.telegram_enabled),
      botToken: row.telegram_bot_token,
      chatId: row.telegram_chat_id,
      apiBase: row.telegram_api_base || "https://api.telegram.org",
      notifyNewInvoice: Boolean(row.telegram_notify_new_invoice),
      notifyDailyClose: Boolean(row.telegram_notify_daily_close),
      notifyImportantActions: Boolean(row.telegram_notify_important_actions),
    };
  } catch (err) {
    // Migration not applied yet or schema mismatch.
    return null;
  }
}

function isEventEnabled(config, eventType) {
  if (!config || !config.enabled) return false;
  if (eventType === EVENT_TYPES.NEW_INVOICE) return config.notifyNewInvoice;
  if (eventType === EVENT_TYPES.DAILY_CLOSE) return config.notifyDailyClose;
  if (eventType === EVENT_TYPES.SHIFT_CLOSE) return config.notifyDailyClose; // grouped with daily close
  // All other events fall under "important actions".
  return config.notifyImportantActions;
}

function formatMoney(amount, currencySymbol = "ج") {
  const value = Number(amount || 0);
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currencySymbol}`;
}

function formatDateTime(dt) {
  if (!dt) return new Date().toLocaleString("ar-EG");
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString("ar-EG");
}

function buildMessage(eventType, data = {}) {
  const currency = data.currencySymbol || "ج";
  const branch = data.branch || "";
  const header = branch ? `🏪 *${branch}*\n` : "";

  switch (eventType) {
    case EVENT_TYPES.TEST:
      return `${header}✅ اختبار ناجح\nتم إعداد إشعارات Telegram بنجاح.`;

    case EVENT_TYPES.NEW_INVOICE: {
      const total = formatMoney(data.total, currency);
      return `${header}🧾 فاتورة جديدة\n` +
        `الرقم: *#${data.invoiceNo || data.id}*\n` +
        `العميل: *${data.customerName || "غير محدد"}*\n` +
        `المجموع: *${total}*\n` +
        `طريقة الدفع: *${data.paymentType || "غير محدد"}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}`;
    }

    case EVENT_TYPES.LARGE_INVOICE: {
      const total = formatMoney(data.total, currency);
      return `${header}🚨 فاتورة بمبلغ كبير\n` +
        `الرقم: *#${data.invoiceNo || data.id}*\n` +
        `العميل: *${data.customerName || "غير محدد"}*\n` +
        `المجموع: *${total}*`;
    }

    case EVENT_TYPES.LARGE_DISCOUNT:
      return `${header}💸 خصم كبير مطبق\n` +
        `الفاتورة: *#${data.invoiceNo || data.id}*\n` +
        `نسبة الخصم: *${data.discountPercent}%*`;

    case EVENT_TYPES.SALES_RETURN: {
      const total = formatMoney(data.total, currency);
      return `${header}↩️ مرتجع مبيعات\n` +
        `الفاتورة الأصلية: *#${data.originalInvoiceId}*\n` +
        `مبلغ المرتجع: *${total}*`;
    }

    case EVENT_TYPES.INVOICE_VOIDED:
      return `${header}⛔ فاتورة ملغاة\n` +
        `الفاتورة: *#${data.invoiceNo || data.id}*\n` +
        `السبب: *${data.reason || "غير محدد"}*\n` +
        `بواسطة: *${data.userName || "غير محدد"}*`;

    case EVENT_TYPES.SHIFT_CLOSE: {
      const opening = formatMoney(data.openingCash, currency);
      const closing = formatMoney(data.closingCash, currency);
      const expected = formatMoney(data.expectedCash, currency);
      const diff = formatMoney(data.discrepancy, currency);
      return `${header}📋 إغلاق وردية\n` +
        `رقم الوردية: *#${data.shiftId}*\n` +
        `الرصيد الافتتاحي: *${opening}*\n` +
        `الرصيد المتوقع: *${expected}*\n` +
        `الرصيد الفعلي: *${closing}*\n` +
        `الفرق: *${diff}*\n` +
        `عدد الفواتير: *${data.invoicesCount || 0}*`;
    }

    case EVENT_TYPES.DAILY_CLOSE: {
      const opening = formatMoney(data.openingBalance, currency);
      const expected = formatMoney(data.expectedCash, currency);
      const actual = formatMoney(data.actualCash, currency);
      const diff = formatMoney(data.discrepancy, currency);
      const cashSales = formatMoney(data.cashSales, currency);
      const creditSales = formatMoney(data.creditSales, currency);
      return `${header}📅 إغلاق يومية — ${data.date}\n` +
        `الرصيد الافتتاحي: *${opening}*\n` +
        `المبيعات النقدية: *${cashSales}*\n` +
        `المبيعات الآجلة: *${creditSales}*\n` +
        `الرصيد المتوقع: *${expected}*\n` +
        `الرصيد الفعلي: *${actual}*\n` +
        `الفرق: *${diff}*\n` +
        `عدد الفواتير: *${data.invoicesCount || 0}*`;
    }

    case EVENT_TYPES.PURCHASE_CREATED: {
      const total = formatMoney(data.total, currency);
      return `${header}📦 عملية شراء جديدة\n` +
        `النوع: *${data.kind === "receipt" ? "فاتورة شراء" : "أمر شراء"}*\n` +
        `الرقم: *#${data.reference || data.id}*\n` +
        `المورد: *${data.supplierName || "غير محدد"}*\n` +
        `المجموع: *${total}*`;
    }

    case EVENT_TYPES.CUSTOMER_PAYMENT: {
      const amount = formatMoney(data.amount, currency);
      return `${header}💰 دفع من عميل\n` +
        `العميل: *${data.customerName || "غير محدد"}*\n` +
        `المبلغ: *${amount}*\n` +
        `الطريقة: *${data.method || "غير محدد"}*`;
    }

    case EVENT_TYPES.LOW_STOCK:
      if (data.summary) {
        return `${header}⚠️ تنبيه مخزون منخفض\n` +
          `عدد الأصناف: *${data.currentQuantity}*\n` +
          `الأصناف: *${data.productName || data.sku || "غير محدد"}*`;
      }
      return `${header}⚠️ تنبيه مخزون منخفض\n` +
        `المنتج: *${data.productName || data.sku || "غير محدد"}*\n` +
        `الكمية الحالية: *${data.currentQuantity}*\n` +
        `الحد الأدنى: *${data.minQuantity}*`;

    case EVENT_TYPES.BACKUP_RESULT:
      return `${header}${data.success ? "✅ نسخة احتياطية ناجحة" : "❌ فشل النسخ الاحتياطي"}\n` +
        `السبب: *${data.reason || "غير محدد"}*\n` +
        `الملف: *${data.filePath || "—"}*\n` +
        `${data.error ? `الخطأ: \`${data.error}\`` : ""}`;

    case EVENT_TYPES.FAILED_LOGIN:
      return `${header}🔒 محاولة دخول فاشلة\n` +
        `المستخدم: *${data.username || "غير محدد"}*\n` +
        `الوقت: ${formatDateTime(data.time)}\n` +
        `IP: *${data.ip || "غير معروف"}*`;

    default:
      return `${header}📢 إشعار جديد\n${JSON.stringify(data)}`;
  }
}

async function sendTelegramMessage(config, text) {
  const token = encodeURIComponent(config.botToken);
  const url = `${config.apiBase.replace(/\/$/, "")}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: config.chatId,
    text,
    parse_mode: "Markdown",
  });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Telegram API ${response.status}: ${errorText.slice(0, 200)}`);
  }
  return response.json();
}

function enqueueNotification(db, eventType, text, payload = {}) {
  try {
    db.prepare(
      `INSERT INTO pending_notifications (event_type, text, payload_json, status, next_retry_at)
       VALUES (?, ?, ?, 'pending', datetime('now', '+2 minutes'))`
    ).run(eventType, text, JSON.stringify(payload));
  } catch (err) {
    logger.error({ message: "Failed to enqueue Telegram notification", error: err.message });
  }
}

function markSent(db, id) {
  db.prepare(
    "UPDATE pending_notifications SET status='sent', sent_at=datetime('now'), updated_at=datetime('now'), error=NULL WHERE id=?"
  ).run(id);
}

function markFailed(db, id, retryCount, error) {
  const tooOld = retryCount >= MAX_RETRIES;
  const status = tooOld ? "failed" : "pending";
  const backoffMinutes = Math.min(2 ** retryCount, 60); // cap at 60 minutes
  db.prepare(
    `UPDATE pending_notifications
     SET status=?, retry_count=?, error=?, updated_at=datetime('now'),
         next_retry_at=datetime('now', '+${backoffMinutes} minutes')
     WHERE id=?`
  ).run(status, retryCount, String(error || "").slice(0, 250), id);
}

async function notifyOwner(eventType, data = {}, dbArg) {
  const db = dbArg || getDb();
  const config = getTelegramConfig(db);
  if (!config || !isEventEnabled(config, eventType)) return;

  const text = buildMessage(eventType, data);
  try {
    await sendTelegramMessage(config, text);
  } catch (err) {
    logger.warn({ message: "Telegram send failed, enqueueing", eventType, error: err.message });
    enqueueNotification(db, eventType, text, data);
  }
}

function cleanupStaleNotifications(db) {
  try {
    db.prepare(
      `DELETE FROM pending_notifications
       WHERE status = 'pending'
         AND datetime(created_at, '+${MAX_AGE_HOURS} hours') < datetime('now')`
    ).run();
  } catch (_) {}
}

async function processQueue(dbArg) {
  const db = dbArg || getDb();
  const config = getTelegramConfig(db);
  if (!config) return;

  cleanupStaleNotifications(db);

  let rows;
  try {
    rows = db.prepare(
      `SELECT * FROM pending_notifications
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
       ORDER BY id ASC
       LIMIT 20`
    ).all();
  } catch (_) {
    return;
  }

  for (const row of rows) {
    try {
      await sendTelegramMessage(config, row.text);
      markSent(db, row.id);
    } catch (err) {
      const retryCount = (row.retry_count || 0) + 1;
      markFailed(db, row.id, retryCount, err.message);
      logger.warn({ message: "Telegram retry failed", id: row.id, retryCount, error: err.message });
    }
  }
}

let drainerTimer = null;

function startTelegramRetryJob() {
  if (drainerTimer) return;
  // Attempt a drain immediately on startup.
  processQueue().catch(() => {});
  drainerTimer = setInterval(() => {
    processQueue().catch(() => {});
  }, RETRY_INTERVAL_MS);
}

module.exports = {
  EVENT_TYPES,
  getTelegramConfig,
  isEventEnabled,
  buildMessage,
  sendTelegramMessage,
  notifyOwner,
  enqueueNotification,
  processQueue,
  startTelegramRetryJob,
};
