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
                telegram_notify_new_invoice, telegram_notify_daily_close, telegram_notify_important_actions,
                telegram_notify_large_amounts, telegram_notify_returns_voids,
                telegram_notify_purchases_payments, telegram_notify_low_stock, telegram_notify_system
         FROM settings WHERE id = 1`
      )
      .get();
    if (!row || !row.telegram_enabled || !row.telegram_bot_token || !row.telegram_chat_id) {
      return null;
    }
    // Granular columns (migration 176) may not exist yet on un-migrated DBs —
    // fall back to the bundled "important actions" toggle for each of them.
    const bundled = Boolean(row.telegram_notify_important_actions);
    const granular = (col) => (row[col] === undefined || row[col] === null ? bundled : Boolean(row[col]));
    return {
      enabled: Boolean(row.telegram_enabled),
      botToken: row.telegram_bot_token,
      chatId: row.telegram_chat_id,
      apiBase: row.telegram_api_base || "https://api.telegram.org",
      notifyNewInvoice: Boolean(row.telegram_notify_new_invoice),
      notifyDailyClose: Boolean(row.telegram_notify_daily_close),
      notifyImportantActions: bundled,
      notifyLargeAmounts: granular("telegram_notify_large_amounts"),
      notifyReturnsVoids: granular("telegram_notify_returns_voids"),
      notifyPurchasesPayments: granular("telegram_notify_purchases_payments"),
      notifyLowStock: granular("telegram_notify_low_stock"),
      notifySystem: granular("telegram_notify_system"),
    };
  } catch (err) {
    // Migration not applied yet or schema mismatch.
    return null;
  }
}

function isEventEnabled(config, eventType) {
  if (!config || !config.enabled) return false;
  switch (eventType) {
    case EVENT_TYPES.NEW_INVOICE: return config.notifyNewInvoice;
    case EVENT_TYPES.DAILY_CLOSE:
    case EVENT_TYPES.SHIFT_CLOSE: return config.notifyDailyClose; // grouped with daily close
    case EVENT_TYPES.LARGE_INVOICE:
    case EVENT_TYPES.LARGE_DISCOUNT: return config.notifyLargeAmounts;
    case EVENT_TYPES.SALES_RETURN:
    case EVENT_TYPES.INVOICE_VOIDED: return config.notifyReturnsVoids;
    case EVENT_TYPES.PURCHASE_CREATED:
    case EVENT_TYPES.CUSTOMER_PAYMENT: return config.notifyPurchasesPayments;
    case EVENT_TYPES.LOW_STOCK: return config.notifyLowStock;
    case EVENT_TYPES.BACKUP_RESULT:
    case EVENT_TYPES.FAILED_LOGIN: return config.notifySystem;
    case EVENT_TYPES.TEST: return true;
    default: return config.notifyImportantActions;
  }
}

function formatMoney(amount, currencySymbol = "ج") {
  const value = Number(amount || 0);
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currencySymbol}`;
}

// Maps each event type to the message_templates category an owner can
// customize (see migration 177). TEST has no category — it's not meaningful
// to template a one-off connectivity check.
const EVENT_CATEGORY = {
  [EVENT_TYPES.NEW_INVOICE]: "telegram_new_invoice",
  [EVENT_TYPES.DAILY_CLOSE]: "telegram_daily_close",
  [EVENT_TYPES.SHIFT_CLOSE]: "telegram_shift_close",
  [EVENT_TYPES.LARGE_INVOICE]: "telegram_large_invoice",
  [EVENT_TYPES.LARGE_DISCOUNT]: "telegram_large_discount",
  [EVENT_TYPES.SALES_RETURN]: "telegram_sales_return",
  [EVENT_TYPES.INVOICE_VOIDED]: "telegram_invoice_voided",
  [EVENT_TYPES.PURCHASE_CREATED]: "telegram_purchase_created",
  [EVENT_TYPES.CUSTOMER_PAYMENT]: "telegram_customer_payment",
  [EVENT_TYPES.LOW_STOCK]: "telegram_low_stock",
  [EVENT_TYPES.BACKUP_RESULT]: "telegram_backup_result",
  [EVENT_TYPES.FAILED_LOGIN]: "telegram_failed_login",
};

function buildTemplateVars(eventType, data, currency) {
  switch (eventType) {
    case EVENT_TYPES.NEW_INVOICE:
      return {
        invoice_no: data.invoiceNo || data.id, customer_name: data.customerName || "غير محدد",
        total: formatMoney(data.total, currency), payment_type: data.paymentType || "غير محدد",
        created_at: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.DAILY_CLOSE:
      return {
        date: data.date, opening_balance: formatMoney(data.openingBalance, currency),
        cash_sales: formatMoney(data.cashSales, currency), credit_sales: formatMoney(data.creditSales, currency),
        expected_cash: formatMoney(data.expectedCash, currency), actual_cash: formatMoney(data.actualCash, currency),
        discrepancy: formatMoney(data.discrepancy, currency), invoices_count: data.invoicesCount || 0,
      };
    case EVENT_TYPES.SHIFT_CLOSE:
      return {
        shift_id: data.shiftId, opening_cash: formatMoney(data.openingCash, currency),
        expected_cash: formatMoney(data.expectedCash, currency), closing_cash: formatMoney(data.closingCash, currency),
        discrepancy: formatMoney(data.discrepancy, currency), invoices_count: data.invoicesCount || 0,
      };
    case EVENT_TYPES.LARGE_INVOICE:
      return { invoice_no: data.invoiceNo || data.id, customer_name: data.customerName || "غير محدد", total: formatMoney(data.total, currency) };
    case EVENT_TYPES.LARGE_DISCOUNT:
      return { invoice_no: data.invoiceNo || data.id, discount_percent: data.discountPercent };
    case EVENT_TYPES.SALES_RETURN:
      return { original_invoice_id: data.originalInvoiceId, total: formatMoney(data.total, currency) };
    case EVENT_TYPES.INVOICE_VOIDED:
      return { invoice_no: data.invoiceNo || data.id, reason: data.reason || "غير محدد", user_name: data.userName || "غير محدد" };
    case EVENT_TYPES.PURCHASE_CREATED:
      return {
        kind_label: data.kind === "receipt" ? "فاتورة شراء" : "أمر شراء", reference: data.reference || data.id,
        supplier_name: data.supplierName || "غير محدد", total: formatMoney(data.total, currency),
      };
    case EVENT_TYPES.CUSTOMER_PAYMENT:
      return { customer_name: data.customerName || "غير محدد", amount: formatMoney(data.amount, currency), method: data.method || "غير محدد" };
    case EVENT_TYPES.LOW_STOCK:
      return {
        product_name: data.productName || data.sku || "غير محدد", current_quantity: data.currentQuantity,
        min_quantity: data.summary ? "" : data.minQuantity,
      };
    case EVENT_TYPES.BACKUP_RESULT:
      return {
        success_text: data.success ? "✅ نسخة احتياطية ناجحة" : "❌ فشل النسخ الاحتياطي",
        reason: data.reason || "غير محدد", file_path: data.filePath || "—",
        error: data.error ? `الخطأ: \`${data.error}\`` : "",
      };
    case EVENT_TYPES.FAILED_LOGIN:
      return { username: data.username || "غير محدد", time: formatDateTime(data.time), ip: data.ip || "غير معروف" };
    default:
      return {};
  }
}

function renderTemplate(body, vars) {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), val ?? ""),
    body
  );
}

function formatDateTime(dt) {
  if (!dt) return new Date().toLocaleString("ar-EG");
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString("ar-EG");
}

function buildMessage(eventType, data = {}, db = null) {
  const currency = data.currencySymbol || "ج";
  const branch = data.branch || "";
  const header = branch ? `🏪 *${branch}*\n` : "";

  // Prefer the owner's saved template (message_templates, kept in sync with
  // the active message_template_variants row) over the hardcoded default —
  // falls through on any DB issue (un-migrated DB, no row yet).
  const category = EVENT_CATEGORY[eventType];
  if (category && db) {
    try {
      const row = db.prepare("SELECT body FROM message_templates WHERE kind=?").get(category);
      if (row?.body) {
        return header + renderTemplate(row.body, buildTemplateVars(eventType, data, currency));
      }
    } catch (_) { /* fall through to hardcoded default below */ }
  }

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

// Reads the bot's recent updates and pulls the chat id out of the last message,
// so owners don't have to open the getUpdates URL in a browser and read raw
// JSON to find their chat_id.
async function detectChatId(botToken, apiBase = "https://api.telegram.org") {
  const token = encodeURIComponent(botToken);
  const url = `${apiBase.replace(/\/$/, "")}/bot${token}/getUpdates?limit=5`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Telegram API ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  const updates = Array.isArray(data.result) ? data.result : [];
  const last = [...updates].reverse().find((u) => u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat);
  const chat = last?.message?.chat || last?.channel_post?.chat || last?.my_chat_member?.chat;
  if (!chat) return null;
  const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.title || chat.username || null;
  return { chatId: String(chat.id), chatName: name, chatType: chat.type };
}

// Reads the bot's own profile (getMe) — used to derive the bot username for
// the connect deep-link/QR so the owner doesn't have to type it manually.
async function getBotInfo(botToken, apiBase = "https://api.telegram.org") {
  const token = encodeURIComponent(botToken);
  const url = `${apiBase.replace(/\/$/, "")}/bot${token}/getMe`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Telegram API ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  return data?.result || null; // { id, is_bot, first_name, username, ... }
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

  const text = buildMessage(eventType, data, db);
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
  detectChatId,
  getBotInfo,
  notifyOwner,
  enqueueNotification,
  processQueue,
  startTelegramRetryJob,
};
