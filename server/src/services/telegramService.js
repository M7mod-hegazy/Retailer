// Telegram owner notification channel.
// Sends the system owner a Telegram message for important events. If the API
// call fails (no internet, Telegram down, bad token), the message is written to
// pending_notifications and retried periodically with a cap.
//
// Setup: see docs/telegram-setup.md
const { getDb } = require("../config/database");
const { today: cairoToday } = require("../utils/datetime");
const logger = require("../config/logger");

const MAX_RETRIES = 9999;
const MAX_AGE_HOURS = 168; // 7 days — enough for extended downtime (weekend, etc.)
const RETRY_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const EVENT_TYPES = {
  NEW_INVOICE: "new_invoice",
  DAILY_CLOSE: "daily_close",
  LARGE_INVOICE: "large_invoice",
  LARGE_DISCOUNT: "large_discount",
  BELOW_COST_SALE: "below_cost_sale",
  SALES_RETURN: "sales_return",
  INVOICE_VOIDED: "invoice_voided",
  PURCHASE_CREATED: "purchase_created",
  CUSTOMER_PAYMENT: "customer_payment",
  RETURN_PAYMENT: "return_payment",
  LOW_STOCK: "low_stock",
  BACKUP_RESULT: "backup_result",
  FAILED_LOGIN: "failed_login",
  SHIFT_CLOSE: "shift_close",
  CUSTOMER_CREATED: "customer_created",
  SUPPLIER_CREATED: "supplier_created",
  EXPENSE_CREATED: "expense_created",
  TEST: "test",
  // Extended events (migration 194)
  STOCK_TRANSFERRED: "stock_transferred",
  INVENTORY_ADJUSTED: "inventory_adjusted",
  NEW_PRODUCT: "new_product",
  PRICE_CHANGED: "price_changed",
  BATCH_EXPIRY_WARNING: "batch_expiry_warning",
  PHYSICAL_COUNT_CONFIRMED: "physical_count_confirmed",
  SUPPLIER_PAYMENT: "supplier_payment",
  DEBT_PAYMENT_RECEIVED: "debt_payment_received",
  INSTALLMENT_PAID: "installment_paid",
  PURCHASE_VOIDED: "purchase_voided",
  PURCHASE_RETURN: "purchase_return",
  BRANCH_TRANSFER: "branch_transfer",
  PASSWORD_CHANGED: "password_changed",
  PERMISSION_CHANGED: "permission_changed",
  SUPERVISOR_OVERRIDE: "supervisor_override",
  REPAIR_ORDER_CREATED: "repair_order_created",
  REPAIR_ORDER_READY: "repair_order_ready",
  REPAIR_ORDER_DELIVERED: "repair_order_delivered",
  REVENUE_CREATED: "revenue_created",
  WITHDRAWAL_CREATED: "withdrawal_created",
  EMPLOYEE_CREATED: "employee_created",
  SALARY_SETTLED: "salary_settled",
  ADVANCE_CREATED: "advance_created",
  DEDUCTION_CREATED: "deduction_created",
  BONUS_CREATED: "bonus_created",
  // New edit/delete events (migration 201)
  EXPENSE_EDITED: "expense_edited",
  EXPENSE_DELETED: "expense_deleted",
  REVENUE_EDITED: "revenue_edited",
  REVENUE_DELETED: "revenue_deleted",
  // Return lifecycle + bulk pricing + deletions (migration 210)
  SALES_RETURN_EDITED: "sales_return_edited",
  SALES_RETURN_CANCELLED: "sales_return_cancelled",
  PURCHASE_RETURN_EDITED: "purchase_return_edited",
  PRICE_BULK_UPDATE: "price_bulk_update",
  ITEM_DELETED: "item_deleted",
  CUSTOMER_DELETED: "customer_deleted",
  SUPPLIER_DELETED: "supplier_deleted",
  EMPLOYEE_DELETED: "employee_deleted",
  // New edit/cancel events (migration 202)
  INVOICE_EDITED: "invoice_edited",
  INVOICE_AMENDED: "invoice_amended",
  PURCHASE_EDITED: "purchase_edited",
  PURCHASE_RETURN_CANCELLED: "purchase_return_cancelled",
  BRANCH_TRANSFER_EDITED: "branch_transfer_edited",
  BRANCH_TRANSFER_CANCELLED: "branch_transfer_cancelled",
  WITHDRAWAL_EDITED: "withdrawal_edited",
  WITHDRAWAL_DELETED: "withdrawal_deleted",
  // Quit/logout events (migration 212)
  APP_QUIT: "app_quit",
  USER_LOGOUT: "user_logout",
  // Payroll partial payment + risky-deletion coverage (migration 215)
  SALARY_PARTIAL_PAID: "salary_partial_paid",
  SALARY_SETTLEMENT_DELETED: "salary_settlement_deleted",
  ADVANCE_PAYMENT: "advance_payment",
  ADVANCE_DELETED: "advance_deleted",
  DEDUCTION_DELETED: "deduction_deleted",
  BONUS_DELETED: "bonus_deleted",
  USER_DELETED: "user_deleted",
  // Money-channel + tamper coverage (migration 216). These close the paths a
  // dishonest user could take without ever touching an invoice: editing the
  // treasury, re-routing payment methods, abusing promotions, restoring or
  // wiping the DB, or silencing the owner's own alerts.
  // (Bank / cheque / loyalty events are intentionally absent — those pages
  // were removed from the product.)
  TREASURY_CHANGED: "treasury_changed",
  PAYMENT_METHOD_CHANGED: "payment_method_changed",
  PROMOTION_CHANGED: "promotion_changed",
  BACKUP_RESTORED: "backup_restored",
  DATA_WIPED: "data_wiped",
  NOTIFICATIONS_DISABLED: "notifications_disabled",
  USER_CREATED: "user_created",
  // The alert channel must watch itself (migration 217): adding a recipient
  // (someone routing the shop's alerts to their own chat), removing one, or
  // quietly switching off individual events are all ways to go dark.
  TELEGRAM_RECIPIENT_CHANGED: "telegram_recipient_changed",
  // Employee edit + legacy adjustment (migration 218)
  EMPLOYEE_EDITED: "employee_edited",
  ADJUSTMENT_CREATED: "adjustment_created",
  // Backup export + settings change (migration 219)
  BACKUP_EXPORTED: "backup_exported",
  BACKUP_SETTINGS_CHANGED: "backup_settings_changed",
  // Bulk settings change (migration 220)
  SETTINGS_CHANGED: "settings_changed",
};

function getTelegramConfig(db) {
  try {
    const row = db
      .prepare(
        `SELECT telegram_enabled, telegram_bot_token, telegram_api_base
         FROM settings WHERE id = 1`
      )
      .get();
    if (!row || !row.telegram_enabled || !row.telegram_bot_token) {
      return null;
    }
    return {
      enabled: Boolean(row.telegram_enabled),
      botToken: row.telegram_bot_token,
      apiBase: row.telegram_api_base || "https://api.telegram.org",
    };
  } catch (err) {
    // Migration not applied yet or schema mismatch.
    return null;
  }
}

// Legacy single-recipient fallback for DBs that haven't been migrated yet.
function getLegacyTelegramConfig(db) {
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
      notifyWeekly: Boolean(row.telegram_notify_weekly),
      notifyMonthly: Boolean(row.telegram_notify_monthly),
      notifyYearly: Boolean(row.telegram_notify_yearly),
    };
  } catch (err) {
    return null;
  }
}

function getTelegramRecipients(db) {
  try {
    migrateLegacyRecipientIfNeeded(db);
    // Order by id, not created_at — rows written while the table had lost its
    // constraints (see migration 200) have NULL created_at.
    const rows = db.prepare("SELECT * FROM telegram_recipients ORDER BY id ASC").all();
    if (!rows || rows.length === 0) return [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name || "",
      chatId: r.chat_id,
      enabled: Boolean(r.enabled),
      notifyNewInvoice: Boolean(r.notify_new_invoice),
      notifyDailyClose: Boolean(r.notify_daily_close),
      notifyLargeAmounts: Boolean(r.notify_large_amounts),
      notifyReturnsVoids: Boolean(r.notify_returns_voids),
      notifyPurchasesPayments: Boolean(r.notify_purchases_payments),
      notifyCustomerCreated: Boolean(r.notify_customer_created),
      notifySupplierCreated: Boolean(r.notify_supplier_created),
      notifyExpenseCreated: Boolean(r.notify_expense_created),
      notifyReturnPayment: Boolean(r.notify_return_payment),
      notifyLowStock: Boolean(r.notify_low_stock),
      notifySystem: Boolean(r.notify_system),
      notifyWeekly: Boolean(r.notify_weekly),
      notifyMonthly: Boolean(r.notify_monthly),
      notifyYearly: Boolean(r.notify_yearly),
      // Extended events (migration 194)
      notifyStockTransfer: Boolean(r.notify_stock_transfer),
      notifyInventoryAdjustment: Boolean(r.notify_inventory_adjustment),
      notifyNewProduct: Boolean(r.notify_new_product),
      notifyPriceChange: Boolean(r.notify_price_change),
      notifyBatchExpiry: Boolean(r.notify_batch_expiry),
      notifyPhysicalCount: Boolean(r.notify_physical_count),
      notifySupplierPayment: Boolean(r.notify_supplier_payment),
      notifyDebtPayment: Boolean(r.notify_debt_payment),
      notifyInstallmentPaid: Boolean(r.notify_installment_paid),
      notifyPurchaseVoided: Boolean(r.notify_purchase_voided),
      notifyPurchaseReturn: Boolean(r.notify_purchase_return),
      notifyBranchTransfer: Boolean(r.notify_branch_transfer),
      notifyPasswordChanged: Boolean(r.notify_password_changed),
      notifyPermissionChanged: Boolean(r.notify_permission_changed),
      notifySupervisorOverride: Boolean(r.notify_supervisor_override),
      notifyRepairCreated: Boolean(r.notify_repair_created),
      notifyRepairReady: Boolean(r.notify_repair_ready),
      notifyRepairDelivered: Boolean(r.notify_repair_delivered),
      notifyRevenueCreated: Boolean(r.notify_revenue_created),
      notifyWithdrawalCreated: Boolean(r.notify_withdrawal_created),
      notifyEmployeeCreated: Boolean(r.notify_employee_created),
      notifySalarySettled: Boolean(r.notify_salary_settled),
      notifyAdvanceCreated: Boolean(r.notify_advance_created),
      notifyDeductionCreated: Boolean(r.notify_deduction_created),
      notifyBonusCreated: Boolean(r.notify_bonus_created),
      // New edit/delete events (migration 201)
      notifyExpenseEdited: Boolean(r.notify_expense_edited),
      notifyExpenseDeleted: Boolean(r.notify_expense_deleted),
      notifyRevenueEdited: Boolean(r.notify_revenue_edited),
      notifyRevenueDeleted: Boolean(r.notify_revenue_deleted),
      // Return lifecycle sub-events (migration 210) — parent-toggle fallback.
      notifySalesReturnEdited: Boolean(r.notify_sales_return_edited ?? r.notify_returns_voids),
      notifySalesReturnCancelled: Boolean(r.notify_sales_return_cancelled ?? r.notify_returns_voids),
      notifyPurchaseReturnEdited: Boolean(r.notify_purchase_return_edited ?? r.notify_purchase_return),
      // Edit/cancel sub-events (migration 208) — before that migration these
      // shared the parent toggle, so fall back to it when the column is absent.
      notifyInvoiceEdited: Boolean(r.notify_invoice_edited ?? r.notify_returns_voids),
      notifyInvoiceAmended: Boolean(r.notify_invoice_amended ?? r.notify_returns_voids),
      notifyPurchaseEdited: Boolean(r.notify_purchase_edited ?? r.notify_purchases_payments),
      notifyPurchaseReturnCancelled: Boolean(r.notify_purchase_return_cancelled ?? r.notify_purchase_return),
      notifyBranchTransferEdited: Boolean(r.notify_branch_transfer_edited ?? r.notify_branch_transfer),
      notifyBranchTransferCancelled: Boolean(r.notify_branch_transfer_cancelled ?? r.notify_branch_transfer),
      notifyWithdrawalEdited: Boolean(r.notify_withdrawal_edited ?? r.notify_withdrawal_created),
      notifyWithdrawalDeleted: Boolean(r.notify_withdrawal_deleted ?? r.notify_withdrawal_created),
      // Quit/logout events (migration 212)
      notifyAppQuit: Boolean(r.notify_app_quit),
      notifyUserLogout: Boolean(r.notify_user_logout),
      // Partial salary payout (migration 215) — pre-migration DBs fall back to
      // the full-settlement toggle.
      notifySalaryPartialPaid: Boolean(r.notify_salary_partial_paid ?? r.notify_salary_settled),
      // Money-channel + tamper coverage (migration 216). Un-migrated DBs fall
      // back to notify_system so these alerts are never silently lost.
      notifyTreasuryChanged: Boolean(r.notify_treasury_changed ?? r.notify_system),
      notifyPaymentMethodChanged: Boolean(r.notify_payment_method_changed ?? r.notify_system),
      notifyPromotionChanged: Boolean(r.notify_promotion_changed ?? r.notify_system),
      notifyUserAccount: Boolean(r.notify_user_account ?? r.notify_permission_changed),
      // Self-watching alert channel (migration 217)
      notifyTelegramRecipientChanged: Boolean(r.notify_telegram_recipient_changed),
      // Employee edit + legacy adjustment (migration 218)
      notifyEmployeeEdited: Boolean(r.notify_employee_edited),
      notifyAdjustmentCreated: Boolean(r.notify_adjustment_created),
      // Backup export + settings change (migration 219)
      notifyBackupExported: Boolean(r.notify_backup_exported),
      notifyBackupSettingsChanged: Boolean(r.notify_backup_settings_changed),
      // Bulk settings change (migration 220)
      notifySettingsChanged: Boolean(r.notify_settings_changed),
      eventPresets: parseEventPresets(r.event_presets),
    }));
  } catch (err) {
    return [];
  }
}

// Before the sub-event field-key fix, the client stored preset choices for
// edit/cancel sub-events under raw telegram_* keys instead of the notify*
// field names EVENT_PRESET_FIELD looks up. Fold those legacy keys forward so
// previously-saved choices keep working.
const LEGACY_PRESET_KEYS = {
  telegram_sales_return_edited: "notifySalesReturnEdited",
  telegram_sales_return_cancelled: "notifySalesReturnCancelled",
  telegram_purchase_return_edited: "notifyPurchaseReturnEdited",
  telegram_invoice_edited: "notifyInvoiceEdited",
  telegram_invoice_amended: "notifyInvoiceAmended",
  telegram_purchase_edited: "notifyPurchaseEdited",
  telegram_purchase_return_cancelled: "notifyPurchaseReturnCancelled",
  telegram_branch_transfer_edited: "notifyBranchTransferEdited",
  telegram_branch_transfer_cancelled: "notifyBranchTransferCancelled",
  telegram_withdrawal_edited: "notifyWithdrawalEdited",
  telegram_withdrawal_deleted: "notifyWithdrawalDeleted",
};

function parseEventPresets(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    for (const [legacy, current] of Object.entries(LEGACY_PRESET_KEYS)) {
      if (parsed[legacy] !== undefined && parsed[current] === undefined) {
        parsed[current] = parsed[legacy];
      }
    }
    return parsed;
  } catch (_) {
    return {};
  }
}

function legacyBool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  return v !== 0 && v !== false && v !== "0";
}

// Promote the legacy single settings.telegram_chat_id into telegram_recipients
// when the recipients table exists but is still empty (migration 190 may not have run).
function migrateLegacyRecipientIfNeeded(db) {
  try {
    const count = db.prepare("SELECT COUNT(*) AS n FROM telegram_recipients").get()?.n || 0;
    if (count > 0) return false;

    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    const chatId = String(settings?.telegram_chat_id || "").trim();
    if (!chatId) return false;

    const bundled = legacyBool(settings.telegram_notify_important_actions, true);
    const granular = (col, fallback = bundled) => legacyBool(settings[col], fallback);

    db.prepare(`
      INSERT INTO telegram_recipients (
        name, chat_id, enabled,
        notify_new_invoice, notify_daily_close, notify_large_amounts,
        notify_returns_voids, notify_purchases_payments, notify_low_stock,
        notify_system, notify_weekly, notify_monthly, notify_yearly
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "المستلم الافتراضي",
      chatId,
      legacyBool(settings.telegram_enabled) ? 1 : 0,
      granular("telegram_notify_new_invoice", true) ? 1 : 0,
      granular("telegram_notify_daily_close", true) ? 1 : 0,
      granular("telegram_notify_large_amounts", bundled) ? 1 : 0,
      granular("telegram_notify_returns_voids", bundled) ? 1 : 0,
      granular("telegram_notify_purchases_payments", bundled) ? 1 : 0,
      granular("telegram_notify_low_stock", bundled) ? 1 : 0,
      granular("telegram_notify_system", bundled) ? 1 : 0,
      legacyBool(settings.telegram_notify_weekly, false) ? 1 : 0,
      legacyBool(settings.telegram_notify_monthly, false) ? 1 : 0,
      legacyBool(settings.telegram_notify_yearly, false) ? 1 : 0
    );
    logger.info(`Migrated legacy telegram_chat_id (${chatId}) into telegram_recipients`);
    return true;
  } catch (err) {
    logger.warn(`migrateLegacyRecipientIfNeeded failed: ${err.message}`);
    return false;
  }
}

function isEventEnabledForRecipient(recipient, eventType) {
  if (!recipient || !recipient.enabled) return false;
  switch (eventType) {
    case EVENT_TYPES.NEW_INVOICE: return recipient.notifyNewInvoice;
    case EVENT_TYPES.DAILY_CLOSE:
    case EVENT_TYPES.SHIFT_CLOSE: return recipient.notifyDailyClose;
    case EVENT_TYPES.LARGE_INVOICE:
    case EVENT_TYPES.LARGE_DISCOUNT:
    // Money-risk bucket: selling below cost rides the same per-recipient toggle
    // as large amounts, so no schema change is needed.
    case EVENT_TYPES.BELOW_COST_SALE: return recipient.notifyLargeAmounts;
    case EVENT_TYPES.SALES_RETURN:
    case EVENT_TYPES.INVOICE_VOIDED: return recipient.notifyReturnsVoids;
    case EVENT_TYPES.RETURN_PAYMENT: return recipient.notifyReturnPayment;
    case EVENT_TYPES.PURCHASE_CREATED:
    case EVENT_TYPES.CUSTOMER_PAYMENT: return recipient.notifyPurchasesPayments;
    case EVENT_TYPES.CUSTOMER_CREATED: return recipient.notifyCustomerCreated;
    case EVENT_TYPES.SUPPLIER_CREATED: return recipient.notifySupplierCreated;
    case EVENT_TYPES.EXPENSE_CREATED: return recipient.notifyExpenseCreated;
    case EVENT_TYPES.LOW_STOCK: return recipient.notifyLowStock;
    case EVENT_TYPES.BACKUP_RESULT:
    case EVENT_TYPES.FAILED_LOGIN: return recipient.notifySystem;
    // Extended events (migration 194)
    case EVENT_TYPES.STOCK_TRANSFERRED: return recipient.notifyStockTransfer;
    case EVENT_TYPES.INVENTORY_ADJUSTED: return recipient.notifyInventoryAdjustment;
    case EVENT_TYPES.NEW_PRODUCT: return recipient.notifyNewProduct;
    case EVENT_TYPES.PRICE_CHANGED: return recipient.notifyPriceChange;
    case EVENT_TYPES.BATCH_EXPIRY_WARNING: return recipient.notifyBatchExpiry;
    case EVENT_TYPES.PHYSICAL_COUNT_CONFIRMED: return recipient.notifyPhysicalCount;
    case EVENT_TYPES.SUPPLIER_PAYMENT: return recipient.notifySupplierPayment;
    case EVENT_TYPES.DEBT_PAYMENT_RECEIVED: return recipient.notifyDebtPayment;
    case EVENT_TYPES.INSTALLMENT_PAID: return recipient.notifyInstallmentPaid;
    case EVENT_TYPES.PURCHASE_VOIDED: return recipient.notifyPurchaseVoided;
    case EVENT_TYPES.PURCHASE_RETURN: return recipient.notifyPurchaseReturn;
    case EVENT_TYPES.BRANCH_TRANSFER: return recipient.notifyBranchTransfer;
    case EVENT_TYPES.PASSWORD_CHANGED: return recipient.notifyPasswordChanged;
    case EVENT_TYPES.PERMISSION_CHANGED: return recipient.notifyPermissionChanged;
    case EVENT_TYPES.SUPERVISOR_OVERRIDE: return recipient.notifySupervisorOverride;
    case EVENT_TYPES.REPAIR_ORDER_CREATED: return recipient.notifyRepairCreated;
    case EVENT_TYPES.REPAIR_ORDER_READY: return recipient.notifyRepairReady;
    case EVENT_TYPES.REPAIR_ORDER_DELIVERED: return recipient.notifyRepairDelivered;
    case EVENT_TYPES.REVENUE_CREATED: return recipient.notifyRevenueCreated;
    case EVENT_TYPES.WITHDRAWAL_CREATED: return recipient.notifyWithdrawalCreated;
    case EVENT_TYPES.EMPLOYEE_CREATED: return recipient.notifyEmployeeCreated;
    case EVENT_TYPES.SALARY_SETTLED: return recipient.notifySalarySettled;
    case EVENT_TYPES.ADVANCE_CREATED: return recipient.notifyAdvanceCreated;
    case EVENT_TYPES.DEDUCTION_CREATED: return recipient.notifyDeductionCreated;
    case EVENT_TYPES.BONUS_CREATED: return recipient.notifyBonusCreated;
    // New edit/delete events (migration 201)
    case EVENT_TYPES.EXPENSE_EDITED: return recipient.notifyExpenseEdited;
    case EVENT_TYPES.EXPENSE_DELETED: return recipient.notifyExpenseDeleted;
    case EVENT_TYPES.REVENUE_EDITED: return recipient.notifyRevenueEdited;
    case EVENT_TYPES.REVENUE_DELETED: return recipient.notifyRevenueDeleted;
    // Return lifecycle + bulk pricing + deletions (migration 210)
    case EVENT_TYPES.SALES_RETURN_EDITED: return recipient.notifySalesReturnEdited;
    case EVENT_TYPES.SALES_RETURN_CANCELLED: return recipient.notifySalesReturnCancelled;
    case EVENT_TYPES.PURCHASE_RETURN_EDITED: return recipient.notifyPurchaseReturnEdited;
    case EVENT_TYPES.PRICE_BULK_UPDATE: return recipient.notifyPriceChange;
    case EVENT_TYPES.ITEM_DELETED: return recipient.notifyNewProduct;
    case EVENT_TYPES.CUSTOMER_DELETED: return recipient.notifyCustomerCreated;
    case EVENT_TYPES.SUPPLIER_DELETED: return recipient.notifySupplierCreated;
    case EVENT_TYPES.EMPLOYEE_DELETED: return recipient.notifyEmployeeCreated;
    // Edit/cancel sub-events — own per-recipient toggles since migration 208
    case EVENT_TYPES.INVOICE_EDITED: return recipient.notifyInvoiceEdited;
    case EVENT_TYPES.INVOICE_AMENDED: return recipient.notifyInvoiceAmended;
    case EVENT_TYPES.PURCHASE_EDITED: return recipient.notifyPurchaseEdited;
    case EVENT_TYPES.PURCHASE_RETURN_CANCELLED: return recipient.notifyPurchaseReturnCancelled;
    case EVENT_TYPES.BRANCH_TRANSFER_EDITED: return recipient.notifyBranchTransferEdited;
    case EVENT_TYPES.BRANCH_TRANSFER_CANCELLED: return recipient.notifyBranchTransferCancelled;
    case EVENT_TYPES.WITHDRAWAL_EDITED: return recipient.notifyWithdrawalEdited;
    case EVENT_TYPES.WITHDRAWAL_DELETED: return recipient.notifyWithdrawalDeleted;
    // Quit/logout events (migration 212)
    case EVENT_TYPES.APP_QUIT: return recipient.notifyAppQuit;
    case EVENT_TYPES.USER_LOGOUT: return recipient.notifyUserLogout;
    // Payroll partial payment + risky-deletion coverage (migration 215).
    // Deletion events ride their "created" counterpart's toggle — same
    // precedent as CUSTOMER_DELETED → notifyCustomerCreated.
    case EVENT_TYPES.SALARY_PARTIAL_PAID: return recipient.notifySalaryPartialPaid;
    case EVENT_TYPES.SALARY_SETTLEMENT_DELETED: return recipient.notifySalarySettled;
    case EVENT_TYPES.ADVANCE_PAYMENT:
    case EVENT_TYPES.ADVANCE_DELETED: return recipient.notifyAdvanceCreated;
    case EVENT_TYPES.DEDUCTION_DELETED: return recipient.notifyDeductionCreated;
    case EVENT_TYPES.BONUS_DELETED: return recipient.notifyBonusCreated;
    // User-account lifecycle rides its own toggle (falls back to the
    // permission toggle on un-migrated DBs).
    case EVENT_TYPES.USER_CREATED:
    case EVENT_TYPES.USER_DELETED: return recipient.notifyUserAccount;
    // Money-channel + tamper coverage (migration 216)
    case EVENT_TYPES.TREASURY_CHANGED: return recipient.notifyTreasuryChanged;
    case EVENT_TYPES.PAYMENT_METHOD_CHANGED: return recipient.notifyPaymentMethodChanged;
    case EVENT_TYPES.PROMOTION_CHANGED: return recipient.notifyPromotionChanged;
    // Restoring, wiping, or muting are the actions someone takes to cover
    // tracks — they ride the system toggle and should stay on.
    case EVENT_TYPES.BACKUP_RESTORED:
    case EVENT_TYPES.DATA_WIPED:
    case EVENT_TYPES.NOTIFICATIONS_DISABLED: return recipient.notifySystem;
    // Self-watching alert channel (migration 217)
    case EVENT_TYPES.TELEGRAM_RECIPIENT_CHANGED: return recipient.notifyTelegramRecipientChanged;
    // Employee edit + legacy adjustment (migration 218)
    case EVENT_TYPES.EMPLOYEE_EDITED: return recipient.notifyEmployeeEdited;
    case EVENT_TYPES.ADJUSTMENT_CREATED: return recipient.notifyAdjustmentCreated;
    // Backup export + settings change (migration 219)
    case EVENT_TYPES.BACKUP_EXPORTED: return recipient.notifyBackupExported;
    case EVENT_TYPES.BACKUP_SETTINGS_CHANGED: return recipient.notifyBackupSettingsChanged;
    // Bulk settings change (migration 220)
    case EVENT_TYPES.SETTINGS_CHANGED: return recipient.notifySettingsChanged;
    case EVENT_TYPES.TEST: return true;
    default: return false;
  }
}

function isDigestEnabledForRecipient(recipient, periodType) {
  if (!recipient || !recipient.enabled) return false;
  switch (periodType) {
    case "weekly": return recipient.notifyWeekly;
    case "monthly": return recipient.notifyMonthly;
    case "yearly": return recipient.notifyYearly;
    default: return false;
  }
}

function formatMoney(amount, currencySymbol = "ج") {
  const value = Number(amount || 0);
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currencySymbol}`;
}

// Payment / refund method codes → Arabic. Notification firing sites pass raw
// codes (cash, cash_back, multi…) which used to render untranslated in the
// message body. Unknown values (already-Arabic names, comma-joined lists,
// "غير محدد") pass through unchanged.
const METHOD_LABELS = {
  cash: "نقداً",
  cash_back: "استرداد نقدي",
  visa: "فيزا",
  card: "بطاقة",
  bank: "تحويل بنكي",
  bank_transfer: "تحويل بنكي",
  transfer: "تحويل بنكي",
  wallet: "محفظة إلكترونية",
  cheque: "شيك",
  check: "شيك",
  credit: "آجل",
  ajel: "آجل",
  ajal: "آجل",
  installments: "أقساط",
  multi: "دفع متعدد",
  split: "دفع مقسّم",
  store_credit: "رصيد لدى المحل",
  credit_note: "إشعار دائن",
  points: "نقاط ولاء",
};
function translateMethod(code) {
  if (code === undefined || code === null || code === "") return "غير محدد";
  const key = String(code).trim().toLowerCase();
  return METHOD_LABELS[key] || String(code);
}

// Sales-return reason codes (see SalesReturnFormPage REASONS) → Arabic.
// Free-text reasons entered under "other" pass through unchanged.
const RETURN_REASON_LABELS = {
  defective: "عيب في المنتج",
  wrong_order: "خطأ في الطلب",
  shipping_damage: "تلف أثناء الشحن",
  not_as_described: "لا يطابق الوصف",
  other: "أخرى",
};
function translateReturnReason(code) {
  if (code === undefined || code === null || code === "") return "—";
  const key = String(code).trim().toLowerCase();
  return RETURN_REASON_LABELS[key] || String(code);
}

function formatQty(qty) {
  const value = Number(qty || 0);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildItemsTable(items, currency) {
  if (!Array.isArray(items) || items.length === 0) return "لا توجد أصناف";
  const rows = items.map((it, i) => {
    const name = it.item_name_ar || it.item_name || it.name || "—";
    const sku = it.item_code || it.sku || it.code || it.barcode || "";
    const label = sku ? `[${sku}] ${name}` : name;
    const qty = formatQty(it.quantity || it.qty);
    const price = formatMoney(it.unit_price || it.price || 0, currency);
    const total = formatMoney(it.line_total || (it.quantity * it.unit_price) || 0, currency);
    return `${i + 1}. ${label} | الكمية: ${qty} | السعر: ${price} | الإجمالي: ${total}`;
  });
  return rows.join("\n");
}

function buildItemsTableWithSku(lines, currency) {
  if (!Array.isArray(lines) || lines.length === 0) return "لا توجد أصناف";
  return lines.map(l => {
    const sku = l.item_code || l.sku || l.code || l.barcode || '';
    const name = l.item_name_ar || l.item_name || l.name || '—';
    const label = sku ? `[${sku}] ${name}` : name;
    const qty = formatQty(l.quantity || l.qty);
    const price = formatMoney(l.unit_price || l.unit_cost || 0, currency);
    const lineTotal = formatMoney((l.quantity || 0) * (l.unit_price || l.unit_cost || 0), currency);
    return `• ${label} × ${qty} × ${price} = ${lineTotal}`;
  }).join('\n');
}

function buildBranchTransferItemsTable(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return "لا توجد أصناف";
  return lines.map(l => {
    const sku = l.item_code || l.sku || l.code || l.barcode || '';
    const name = l.item_name_ar || l.item_name || l.name || '—';
    const label = sku ? `[${sku}] ${name}` : name;
    const qty = formatQty(l.quantity || l.qty);
    return `• ${label} × ${qty}`;
  }).join('\n');
}


function buildPaymentBreakdown(payments, currency) {
  if (!Array.isArray(payments) || payments.length === 0) return "—";
  const rows = payments.map((p) => {
    const method = translateMethod(p.method || p.method_name || p.type);
    const amount = formatMoney(p.amount, currency);
    return `• ${method}: ${amount}`;
  });
  return rows.join("\n");
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
  [EVENT_TYPES.BELOW_COST_SALE]: "telegram_below_cost_sale",
  [EVENT_TYPES.SALES_RETURN]: "telegram_sales_return",
  [EVENT_TYPES.INVOICE_VOIDED]: "telegram_invoice_voided",
  [EVENT_TYPES.PURCHASE_CREATED]: "telegram_purchase_created",
  [EVENT_TYPES.CUSTOMER_PAYMENT]: "telegram_customer_payment",
  [EVENT_TYPES.RETURN_PAYMENT]: "telegram_return_payment",
  [EVENT_TYPES.LOW_STOCK]: "telegram_low_stock",
  [EVENT_TYPES.BACKUP_RESULT]: "telegram_backup_result",
  [EVENT_TYPES.FAILED_LOGIN]: "telegram_failed_login",
  [EVENT_TYPES.CUSTOMER_CREATED]: "telegram_customer_created",
  [EVENT_TYPES.SUPPLIER_CREATED]: "telegram_supplier_created",
  [EVENT_TYPES.EXPENSE_CREATED]: "telegram_expense_created",
  // Extended events (migration 194)
  [EVENT_TYPES.STOCK_TRANSFERRED]: "telegram_stock_transfer",
  [EVENT_TYPES.INVENTORY_ADJUSTED]: "telegram_inventory_adjustment",
  [EVENT_TYPES.NEW_PRODUCT]: "telegram_new_product",
  [EVENT_TYPES.PRICE_CHANGED]: "telegram_price_change",
  [EVENT_TYPES.BATCH_EXPIRY_WARNING]: "telegram_batch_expiry",
  [EVENT_TYPES.PHYSICAL_COUNT_CONFIRMED]: "telegram_physical_count",
  [EVENT_TYPES.SUPPLIER_PAYMENT]: "telegram_supplier_payment",
  [EVENT_TYPES.DEBT_PAYMENT_RECEIVED]: "telegram_debt_payment",
  [EVENT_TYPES.INSTALLMENT_PAID]: "telegram_installment_paid",
  [EVENT_TYPES.PURCHASE_VOIDED]: "telegram_purchase_voided",
  [EVENT_TYPES.PURCHASE_RETURN]: "telegram_purchase_return",
  [EVENT_TYPES.BRANCH_TRANSFER]: "telegram_branch_transfer",
  [EVENT_TYPES.PASSWORD_CHANGED]: "telegram_password_changed",
  [EVENT_TYPES.PERMISSION_CHANGED]: "telegram_permission_changed",
  [EVENT_TYPES.SUPERVISOR_OVERRIDE]: "telegram_supervisor_override",
  [EVENT_TYPES.REPAIR_ORDER_CREATED]: "telegram_repair_created",
  [EVENT_TYPES.REPAIR_ORDER_READY]: "telegram_repair_ready",
  [EVENT_TYPES.REPAIR_ORDER_DELIVERED]: "telegram_repair_delivered",
  [EVENT_TYPES.REVENUE_CREATED]: "telegram_revenue_created",
  [EVENT_TYPES.WITHDRAWAL_CREATED]: "telegram_withdrawal_created",
  [EVENT_TYPES.EMPLOYEE_CREATED]: "telegram_employee_created",
  [EVENT_TYPES.SALARY_SETTLED]: "telegram_salary_settled",
  [EVENT_TYPES.ADVANCE_CREATED]: "telegram_advance_created",
  [EVENT_TYPES.DEDUCTION_CREATED]: "telegram_deduction_created",
  [EVENT_TYPES.BONUS_CREATED]: "telegram_bonus_created",
  // New edit/delete events (migration 201)
  [EVENT_TYPES.EXPENSE_EDITED]: "telegram_expense_edited",
  [EVENT_TYPES.EXPENSE_DELETED]: "telegram_expense_deleted",
  [EVENT_TYPES.REVENUE_EDITED]: "telegram_revenue_edited",
  [EVENT_TYPES.REVENUE_DELETED]: "telegram_revenue_deleted",
  // Return lifecycle + bulk pricing + deletions (migration 210)
  [EVENT_TYPES.SALES_RETURN_EDITED]: "telegram_sales_return_edited",
  [EVENT_TYPES.SALES_RETURN_CANCELLED]: "telegram_sales_return_cancelled",
  [EVENT_TYPES.PURCHASE_RETURN_EDITED]: "telegram_purchase_return_edited",
  [EVENT_TYPES.PRICE_BULK_UPDATE]: "telegram_price_bulk_update",
  [EVENT_TYPES.ITEM_DELETED]: "telegram_item_deleted",
  [EVENT_TYPES.CUSTOMER_DELETED]: "telegram_customer_deleted",
  [EVENT_TYPES.SUPPLIER_DELETED]: "telegram_supplier_deleted",
  [EVENT_TYPES.EMPLOYEE_DELETED]: "telegram_employee_deleted",
  // New edit/cancel events (migration 202)
  [EVENT_TYPES.INVOICE_EDITED]: "telegram_invoice_edited",
  [EVENT_TYPES.INVOICE_AMENDED]: "telegram_invoice_amended",
  [EVENT_TYPES.PURCHASE_EDITED]: "telegram_purchase_edited",
  [EVENT_TYPES.PURCHASE_RETURN_CANCELLED]: "telegram_purchase_return_cancelled",
  [EVENT_TYPES.BRANCH_TRANSFER_EDITED]: "telegram_branch_transfer_edited",
  [EVENT_TYPES.BRANCH_TRANSFER_CANCELLED]: "telegram_branch_transfer_cancelled",
  [EVENT_TYPES.WITHDRAWAL_EDITED]: "telegram_withdrawal_edited",
  [EVENT_TYPES.WITHDRAWAL_DELETED]: "telegram_withdrawal_deleted",
  // Quit/logout events (migration 212)
  [EVENT_TYPES.APP_QUIT]: "telegram_app_quit",
  [EVENT_TYPES.USER_LOGOUT]: "telegram_user_logout",
  // Payroll partial payment + risky-deletion coverage (migration 215)
  [EVENT_TYPES.SALARY_PARTIAL_PAID]: "telegram_salary_partial_paid",
  [EVENT_TYPES.SALARY_SETTLEMENT_DELETED]: "telegram_salary_settlement_deleted",
  [EVENT_TYPES.ADVANCE_PAYMENT]: "telegram_advance_payment",
  [EVENT_TYPES.ADVANCE_DELETED]: "telegram_advance_deleted",
  [EVENT_TYPES.DEDUCTION_DELETED]: "telegram_deduction_deleted",
  [EVENT_TYPES.BONUS_DELETED]: "telegram_bonus_deleted",
  [EVENT_TYPES.USER_DELETED]: "telegram_user_deleted",
  // Money-channel + tamper coverage (migration 216)
  [EVENT_TYPES.USER_CREATED]: "telegram_user_created",
  [EVENT_TYPES.TREASURY_CHANGED]: "telegram_treasury_changed",
  [EVENT_TYPES.PAYMENT_METHOD_CHANGED]: "telegram_payment_method_changed",
  [EVENT_TYPES.PROMOTION_CHANGED]: "telegram_promotion_changed",
  [EVENT_TYPES.BACKUP_RESTORED]: "telegram_backup_restored",
  [EVENT_TYPES.DATA_WIPED]: "telegram_data_wiped",
  [EVENT_TYPES.NOTIFICATIONS_DISABLED]: "telegram_notifications_disabled",
  // Self-watching alert channel (migration 217)
  [EVENT_TYPES.TELEGRAM_RECIPIENT_CHANGED]: "telegram_recipient_changed",
  // Employee edit + legacy adjustment (migration 218)
  [EVENT_TYPES.EMPLOYEE_EDITED]: "telegram_employee_edited",
  [EVENT_TYPES.ADJUSTMENT_CREATED]: "telegram_adjustment_created",
  // Backup export + settings change (migration 219)
  [EVENT_TYPES.BACKUP_EXPORTED]: "telegram_backup_exported",
  [EVENT_TYPES.BACKUP_SETTINGS_CHANGED]: "telegram_backup_settings_changed",
  // Bulk settings change (migration 220)
  [EVENT_TYPES.SETTINGS_CHANGED]: "telegram_settings_changed",
};

// Reverse lookup: template category → event type (for server-side previews).
const CATEGORY_EVENT = Object.fromEntries(
  Object.entries(EVENT_CATEGORY).map(([eventType, category]) => [category, eventType])
);
function eventTypeForCategory(category) {
  return CATEGORY_EVENT[category] || null;
}

// Maps each event type to the recipient.eventPresets key the client stores the
// chosen variant label under (the toggle field names in the UI). Lets each
// recipient receive the "detailed" or "brief" variant they picked per event.
const EVENT_PRESET_FIELD = {
  [EVENT_TYPES.NEW_INVOICE]: "notifyNewInvoice",
  [EVENT_TYPES.DAILY_CLOSE]: "notifyDailyClose",
  [EVENT_TYPES.SHIFT_CLOSE]: "notifyDailyClose",
  [EVENT_TYPES.LARGE_INVOICE]: "notifyLargeAmounts",
  [EVENT_TYPES.LARGE_DISCOUNT]: "notifyLargeAmounts",
  [EVENT_TYPES.SALES_RETURN]: "notifyReturnsVoids",
  [EVENT_TYPES.INVOICE_VOIDED]: "notifyReturnsVoids",
  [EVENT_TYPES.PURCHASE_CREATED]: "notifyPurchasesPayments",
  [EVENT_TYPES.CUSTOMER_PAYMENT]: "notifyPurchasesPayments",
  [EVENT_TYPES.RETURN_PAYMENT]: "notifyReturnPayment",
  [EVENT_TYPES.CUSTOMER_CREATED]: "notifyCustomerCreated",
  [EVENT_TYPES.SUPPLIER_CREATED]: "notifySupplierCreated",
  [EVENT_TYPES.EXPENSE_CREATED]: "notifyExpenseCreated",
  [EVENT_TYPES.LOW_STOCK]: "notifyLowStock",
  [EVENT_TYPES.BACKUP_RESULT]: "notifySystem",
  [EVENT_TYPES.FAILED_LOGIN]: "notifySystem",
  [EVENT_TYPES.STOCK_TRANSFERRED]: "notifyStockTransfer",
  [EVENT_TYPES.INVENTORY_ADJUSTED]: "notifyInventoryAdjustment",
  [EVENT_TYPES.NEW_PRODUCT]: "notifyNewProduct",
  [EVENT_TYPES.PRICE_CHANGED]: "notifyPriceChange",
  [EVENT_TYPES.BATCH_EXPIRY_WARNING]: "notifyBatchExpiry",
  [EVENT_TYPES.PHYSICAL_COUNT_CONFIRMED]: "notifyPhysicalCount",
  [EVENT_TYPES.SUPPLIER_PAYMENT]: "notifySupplierPayment",
  [EVENT_TYPES.DEBT_PAYMENT_RECEIVED]: "notifyDebtPayment",
  [EVENT_TYPES.INSTALLMENT_PAID]: "notifyInstallmentPaid",
  [EVENT_TYPES.PURCHASE_VOIDED]: "notifyPurchaseVoided",
  [EVENT_TYPES.PURCHASE_RETURN]: "notifyPurchaseReturn",
  [EVENT_TYPES.BRANCH_TRANSFER]: "notifyBranchTransfer",
  [EVENT_TYPES.PASSWORD_CHANGED]: "notifyPasswordChanged",
  [EVENT_TYPES.PERMISSION_CHANGED]: "notifyPermissionChanged",
  [EVENT_TYPES.SUPERVISOR_OVERRIDE]: "notifySupervisorOverride",
  [EVENT_TYPES.REPAIR_ORDER_CREATED]: "notifyRepairOrder",
  [EVENT_TYPES.REPAIR_ORDER_READY]: "notifyRepairOrder",
  [EVENT_TYPES.REPAIR_ORDER_DELIVERED]: "notifyRepairOrder",
  [EVENT_TYPES.REVENUE_CREATED]: "notifyRevenueCreated",
  [EVENT_TYPES.WITHDRAWAL_CREATED]: "notifyWithdrawalCreated",
  [EVENT_TYPES.EMPLOYEE_CREATED]: "notifyEmployeeCreated",
  [EVENT_TYPES.SALARY_SETTLED]: "notifySalarySettled",
  [EVENT_TYPES.ADVANCE_CREATED]: "notifyAdvanceCreated",
  [EVENT_TYPES.DEDUCTION_CREATED]: "notifyDeductionCreated",
  [EVENT_TYPES.BONUS_CREATED]: "notifyBonusCreated",
  // New edit/delete events (migration 201)
  [EVENT_TYPES.EXPENSE_EDITED]: "notifyExpenseEdited",
  [EVENT_TYPES.EXPENSE_DELETED]: "notifyExpenseDeleted",
  [EVENT_TYPES.REVENUE_EDITED]: "notifyRevenueEdited",
  [EVENT_TYPES.REVENUE_DELETED]: "notifyRevenueDeleted",
  // Return lifecycle + bulk pricing + deletions (migration 210)
  [EVENT_TYPES.SALES_RETURN_EDITED]: "notifySalesReturnEdited",
  [EVENT_TYPES.SALES_RETURN_CANCELLED]: "notifySalesReturnCancelled",
  [EVENT_TYPES.PURCHASE_RETURN_EDITED]: "notifyPurchaseReturnEdited",
  [EVENT_TYPES.PRICE_BULK_UPDATE]: "notifyPriceChange",
  [EVENT_TYPES.ITEM_DELETED]: "notifyNewProduct",
  [EVENT_TYPES.CUSTOMER_DELETED]: "notifyCustomerCreated",
  [EVENT_TYPES.SUPPLIER_DELETED]: "notifySupplierCreated",
  [EVENT_TYPES.EMPLOYEE_DELETED]: "notifyEmployeeCreated",
  // Edit/cancel sub-events — the UI stores their preset under these keys
  [EVENT_TYPES.INVOICE_EDITED]: "notifyInvoiceEdited",
  [EVENT_TYPES.INVOICE_AMENDED]: "notifyInvoiceAmended",
  [EVENT_TYPES.PURCHASE_EDITED]: "notifyPurchaseEdited",
  [EVENT_TYPES.PURCHASE_RETURN_CANCELLED]: "notifyPurchaseReturnCancelled",
  [EVENT_TYPES.BRANCH_TRANSFER_EDITED]: "notifyBranchTransferEdited",
  [EVENT_TYPES.BRANCH_TRANSFER_CANCELLED]: "notifyBranchTransferCancelled",
  [EVENT_TYPES.WITHDRAWAL_EDITED]: "notifyWithdrawalEdited",
  [EVENT_TYPES.WITHDRAWAL_DELETED]: "notifyWithdrawalDeleted",
  // Quit/logout events (migration 212) — UI stores under notifyAppQuit / notifyUserLogout
  [EVENT_TYPES.APP_QUIT]: "notifyAppQuit",
  [EVENT_TYPES.USER_LOGOUT]: "notifyUserLogout",
  // Payroll partial payment + risky-deletion coverage (migration 215)
  [EVENT_TYPES.SALARY_PARTIAL_PAID]: "notifySalaryPartialPaid",
  [EVENT_TYPES.SALARY_SETTLEMENT_DELETED]: "notifySalarySettled",
  [EVENT_TYPES.ADVANCE_PAYMENT]: "notifyAdvanceCreated",
  [EVENT_TYPES.ADVANCE_DELETED]: "notifyAdvanceCreated",
  [EVENT_TYPES.DEDUCTION_DELETED]: "notifyDeductionCreated",
  [EVENT_TYPES.BONUS_DELETED]: "notifyBonusCreated",
  // Money-channel + tamper coverage (migration 216)
  [EVENT_TYPES.USER_CREATED]: "notifyUserAccount",
  [EVENT_TYPES.USER_DELETED]: "notifyUserAccount",
  [EVENT_TYPES.TREASURY_CHANGED]: "notifyTreasuryChanged",
  [EVENT_TYPES.PAYMENT_METHOD_CHANGED]: "notifyPaymentMethodChanged",
  [EVENT_TYPES.PROMOTION_CHANGED]: "notifyPromotionChanged",
  [EVENT_TYPES.BACKUP_RESTORED]: "notifySystem",
  [EVENT_TYPES.DATA_WIPED]: "notifySystem",
  [EVENT_TYPES.NOTIFICATIONS_DISABLED]: "notifySystem",
  // Self-watching alert channel (migration 217)
  [EVENT_TYPES.TELEGRAM_RECIPIENT_CHANGED]: "notifyTelegramRecipientChanged",
  // Employee edit + legacy adjustment (migration 218)
  [EVENT_TYPES.EMPLOYEE_EDITED]: "notifyEmployeeEdited",
  [EVENT_TYPES.ADJUSTMENT_CREATED]: "notifyAdjustmentCreated",
  // Backup export + settings change (migration 219)
  [EVENT_TYPES.BACKUP_EXPORTED]: "notifyBackupExported",
  [EVENT_TYPES.BACKUP_SETTINGS_CHANGED]: "notifyBackupSettingsChanged",
  // Bulk settings change (migration 220)
  [EVENT_TYPES.SETTINGS_CHANGED]: "notifySettingsChanged",
};

// ── Settings key → Arabic label (for SETTINGS_CHANGED diff) ────────────────
// Only covers the most commonly changed settings; missing keys degrade to the
// raw column name which is still recognizable.
const SETTINGS_KEY_LABELS = {
  company_name: "اسم الشركة",
  branch_name: "اسم الفرع",
  phone: "الهاتف",
  address: "العنوان",
  commercial_register: "السجل التجاري",
  vat_number: "الرقم الضريبي",
  currency_symbol: "رمز العملة",
  decimal_places: "كسور العملة",
  tax_enabled: "تفعيل الضريبة",
  tax_rate: "نسبة الضريبة",
  tax_type: "نظام الضريبة",
  discount_cap_enabled: "limite الخصم",
  max_discount_percent: "الحد الأقصى للخصم",
  margin_alert_cost_method: "طريقة حساب التكلفة",
  min_margin_percent: "الحد الأدنى للهامش",
  target_margin_percent: "هامش الربح المستهدف",
  language: "اللغة الافتراضية",
  pos_voice_enabled: "أصوات شاشة الكاشير",
  smart_lock_enabled: "القفل الذكي",
  smart_lock_timeout_minutes: "مدة عدم النشاط",
  audit_log_retention_days: "مدة حفظ سجل النشاط",
  held_yellow_hours: "تنبيه أصفر بعد",
  held_red_hours: "تنبيه أحمر بعد",
  default_profit_margin: "هامش الربح الافتراضي",
  receipt_header: "رأس الإيصال",
  receipt_footer: "ذيل الإيصال",
  invoice_prefix: "بادئة رقم الفاتورة",
  next_invoice_number: "رقم الفاتورة التالي",
  telegram_enabled: "تفعيل Telegram",
  whatsapp_enabled: "تفعيل WhatsApp",
  allow_negative_stock: "السماح بمخزون سالب",
  barcode_scanner_enabled: "ماسح الباركود",
  customer_display_enabled: "شاشة العميل",
  default_warehouse_id: "المخزن الافتراضي",
  backup_auto_enabled: "النسخ الاحتياطي التلقائي",
  backup_interval_hours: "فترة النسخ الاحتياطي",
  backup_keep_count: "عدد النسخ المحفوظة",
  backup_path: "مسار النسخ الاحتياطي",
  sync_enabled: "المزامنة",
  store_type: "نوع المتجر",
  gold_pricing_enabled: "تسعير الذهب",
  restaurant_mode: "وضع المطعم",
};

// ── Money-related events (receive the accumulative daily footer) ────────────
// Only events that directly move money or affect cash/treasury should show the
// running daily summary. Informational events (settings, permissions, products,
// backups, etc.) do not get the footer.
const MONEY_EVENTS = new Set([
  EVENT_TYPES.NEW_INVOICE,
  EVENT_TYPES.DAILY_CLOSE,
  EVENT_TYPES.SHIFT_CLOSE,
  EVENT_TYPES.LARGE_INVOICE,
  EVENT_TYPES.LARGE_DISCOUNT,
  EVENT_TYPES.BELOW_COST_SALE,
  EVENT_TYPES.SALES_RETURN,
  EVENT_TYPES.INVOICE_VOIDED,
  EVENT_TYPES.PURCHASE_CREATED,
  EVENT_TYPES.CUSTOMER_PAYMENT,
  EVENT_TYPES.RETURN_PAYMENT,
  EVENT_TYPES.EXPENSE_CREATED,
  EVENT_TYPES.EXPENSE_EDITED,
  EVENT_TYPES.EXPENSE_DELETED,
  EVENT_TYPES.REVENUE_CREATED,
  EVENT_TYPES.REVENUE_EDITED,
  EVENT_TYPES.REVENUE_DELETED,
  EVENT_TYPES.WITHDRAWAL_CREATED,
  EVENT_TYPES.WITHDRAWAL_EDITED,
  EVENT_TYPES.WITHDRAWAL_DELETED,
  EVENT_TYPES.STOCK_TRANSFERRED,
  EVENT_TYPES.PHYSICAL_COUNT_CONFIRMED,
  EVENT_TYPES.SUPPLIER_PAYMENT,
  EVENT_TYPES.DEBT_PAYMENT_RECEIVED,
  EVENT_TYPES.INSTALLMENT_PAID,
  EVENT_TYPES.PURCHASE_VOIDED,
  EVENT_TYPES.PURCHASE_RETURN,
  EVENT_TYPES.PURCHASE_RETURN_EDITED,
  EVENT_TYPES.PURCHASE_RETURN_CANCELLED,
  EVENT_TYPES.PURCHASE_EDITED,
  EVENT_TYPES.BRANCH_TRANSFER,
  EVENT_TYPES.BRANCH_TRANSFER_EDITED,
  EVENT_TYPES.BRANCH_TRANSFER_CANCELLED,
  EVENT_TYPES.SALARY_SETTLED,
  EVENT_TYPES.SALARY_PARTIAL_PAID,
  EVENT_TYPES.SALARY_SETTLEMENT_DELETED,
  EVENT_TYPES.ADVANCE_CREATED,
  EVENT_TYPES.ADVANCE_PAYMENT,
  EVENT_TYPES.ADVANCE_DELETED,
  EVENT_TYPES.DEDUCTION_CREATED,
  EVENT_TYPES.DEDUCTION_DELETED,
  EVENT_TYPES.BONUS_CREATED,
  EVENT_TYPES.BONUS_DELETED,
  EVENT_TYPES.SALES_RETURN_EDITED,
  EVENT_TYPES.SALES_RETURN_CANCELLED,
  EVENT_TYPES.INVOICE_EDITED,
  EVENT_TYPES.INVOICE_AMENDED,
  EVENT_TYPES.ADJUSTMENT_CREATED,
  EVENT_TYPES.TREASURY_CHANGED,
  EVENT_TYPES.PAYMENT_METHOD_CHANGED,
]);

// ── Daily accumulative summary ─────────────────────────────────────────────

function localDate(d) {
  return cairoToday(d || new Date());
}

// Builds the running-day totals by payment method so every financial notification
// includes a footer showing the current state of the day.

function getDailyPaymentMethodSummary(db, dateText) {
  if (!db || !dateText) return null;
  try {
    const { calculateDailySummary } = require("./dailySessionService");
    // createIfMissing: true ensures a daily_sessions row exists for today so
    // the accumulative footer is never silently suppressed just because no
    // invoice has been written yet (quit/logout at day-start, restored DB…).
    const summary = calculateDailySummary(db, dateText, { createIfMissing: true });
    if (!summary) return null;

    // Cash / credit / bank / expected all come straight from the treasury's
    // own daily summary. This function used to re-derive them from 7 parallel
    // queries against raw method NAMES — the payments table stores method
    // CODES ("cash"), the cash method row is is_system=1 (excluded), and one
    // query referenced a column (settlement_method_id) that doesn't exist on
    // real DBs, which threw and nulled the whole footer on every message.
    const cashIn = Number(summary.cash_in || 0);
    const cashOut = Number(summary.cash_out || 0);

    return {
      cash: { in: cashIn, out: cashOut, net: cashIn - cashOut },
      credit: Number(summary.pos_credit_sales || 0),
      bank: Number(summary.pos_bank_sales || 0),
      opening_balance: Number(summary.opening_balance || 0),
      expected_cash: Number(summary.expected_cash || 0),
      methods: getWalletMethodBreakdown(db, dateText),
    };
  } catch (_) {
    return null;
  }
}

// Per-wallet/card day movement (InstaPay, فودافون كاش, فيزا…). Cash, credit
// and bank are reported from the daily summary above — this only covers the
// named non-cash methods. Every source query is individually guarded so one
// schema mismatch can never blank the whole footer again.
function getWalletMethodBreakdown(db, dateText) {
  try {
    const methods = db.prepare(`
      SELECT id, name, icon, category, type
      FROM payment_methods
      WHERE is_active = 1
        AND COALESCE(category, '') NOT IN ('cash', 'credit', 'bank')
        AND COALESCE(type, '') NOT IN ('cash', 'bank')
      ORDER BY id ASC
    `).all();
    if (!methods.length) return [];

    const agg = new Map(methods.map((m) => [m.id, { ...m, in: 0, out: 0 }]));
    const byName = new Map(methods.map((m) => [m.name, m.id]));
    const addById = (mid, inAmt, outAmt) => {
      const a = agg.get(mid);
      if (a) { a.in += Number(inAmt || 0); a.out += Number(outAmt || 0); }
    };
    const addByName = (name, inAmt, outAmt) => {
      const mid = byName.get(String(name || ""));
      if (mid != null) addById(mid, inAmt, outAmt);
    };
    const safe = (fn) => { try { fn(); } catch (_) { /* keep the rest alive */ } };

    // Invoice payments (wallet rows store the method NAME in payments.method)
    // Customer invoice payments are ALWAYS inflow (customer pays → money enters
    // business wallet). The direction column defaults to 'subtract' which would
    // incorrectly count them as outflow. For non-invoice customer payments
    // (debt collections, refunds) the direction column is authoritative.
    safe(() => db.prepare(`
      SELECT p.method AS name,
        SUM(CASE WHEN p.party_type = 'supplier' THEN
          CASE WHEN p.direction = 'add' THEN 0 ELSE p.amount END
        WHEN p.invoice_id IS NOT NULL THEN p.amount
        ELSE
          CASE WHEN p.direction = 'add' THEN p.amount ELSE 0 END
        END) AS in_amt,
        SUM(CASE WHEN p.party_type = 'supplier' THEN
          CASE WHEN p.direction = 'add' THEN p.amount ELSE 0 END
        WHEN p.invoice_id IS NOT NULL THEN 0
        ELSE
          CASE WHEN p.direction = 'add' THEN 0 ELSE p.amount END
        END) AS out_amt
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      WHERE p.method IS NOT NULL AND date(p.created_at) = ?
        AND COALESCE(i.status, '') != 'cancelled'
      GROUP BY p.method
    `).all(dateText).forEach((r) => addByName(r.name, r.in_amt, r.out_amt)));

    // Ajal (debt) payments — keyed by method id
    safe(() => db.prepare(`
      SELECT ap.payment_method_id AS mid,
        SUM(CASE WHEN COALESCE(d.party_type, 'customer') = 'supplier' THEN 0 ELSE ap.amount END) AS in_amt,
        SUM(CASE WHEN COALESCE(d.party_type, 'customer') = 'supplier' THEN ap.amount ELSE 0 END) AS out_amt
      FROM ajal_payments ap
      LEFT JOIN ajal_debts d ON d.id = ap.debt_id
      WHERE ap.payment_method_id IS NOT NULL
        AND date(COALESCE(ap.payment_date, ap.created_at)) = ?
      GROUP BY ap.payment_method_id
    `).all(dateText).forEach((r) => addById(r.mid, r.in_amt, r.out_amt)));

    // Expenses paid from a wallet
    safe(() => db.prepare(`
      SELECT payment_method AS name, SUM(amount) AS out_amt
      FROM expenses
      WHERE payment_method IS NOT NULL AND date(created_at) = ?
      GROUP BY payment_method
    `).all(dateText).forEach((r) => addByName(r.name, 0, r.out_amt)));

    // Revenues received on a wallet
    safe(() => db.prepare(`
      SELECT payment_method AS name, SUM(amount) AS in_amt
      FROM revenues
      WHERE payment_method IS NOT NULL AND date(created_at) = ?
      GROUP BY payment_method
    `).all(dateText).forEach((r) => addByName(r.name, r.in_amt, 0)));

    // Purchase payments — keyed by method id
    safe(() => db.prepare(`
      SELECT pp.method_id AS mid, SUM(pp.amount) AS out_amt
      FROM purchase_payments pp
      LEFT JOIN purchases pu ON pu.id = pp.purchase_id
      WHERE pp.method_id IS NOT NULL AND date(pp.created_at) = ?
        AND COALESCE(pu.status, '') NOT IN ('voided', 'cancelled')
      GROUP BY pp.method_id
    `).all(dateText).forEach((r) => addById(r.mid, 0, r.out_amt)));

    // Withdrawals from a wallet
    safe(() => db.prepare(`
      SELECT payment_method AS name, SUM(amount) AS out_amt
      FROM withdrawals
      WHERE payment_method IS NOT NULL AND date(created_at) = ?
      GROUP BY payment_method
    `).all(dateText).forEach((r) => addByName(r.name, 0, r.out_amt)));

    return [...agg.values()]
      .filter((m) => m.in !== 0 || m.out !== 0)
      .map((m) => ({ id: m.id, name: m.name, icon: m.icon, in: m.in, out: m.out, net: m.in - m.out }));
  } catch (_) {
    return [];
  }
}

// Formats the accumulative footer for Telegram messages
function buildAccumulativeFooter(data, currency) {
  if (!data) return "";
  const cash = data.cash || {};
  const hasCash = cash.in || cash.out;
  const hasCredit = !!data.credit;
  const hasBank = !!data.bank;
  const hasMethods = Array.isArray(data.methods) && data.methods.some(m => m.in || m.out);
  // Don't show footer if there's nothing to report
  if (!hasCash && !hasCredit && !hasBank && !hasMethods) return "";

  const lines = [];
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("📊 ملخص اليوم حتى الآن:");

  if (data.opening_balance !== undefined && data.opening_balance !== null) {
    lines.push(`🏁 رصيد أول اليوم: ${formatMoney(data.opening_balance, currency)}`);
  }

  if (hasCash) {
    lines.push(`💵 الصندوق: دخل +${formatMoney(cash.in, currency)} / خرج -${formatMoney(cash.out, currency)} = صافي *${formatMoney(cash.net, currency)}*`);
  }

  if (hasCredit) {
    lines.push(`📋 مبيعات آجل (مش في الدرج): *${formatMoney(data.credit, currency)}*`);
  }

  if (hasBank) {
    lines.push(`🏦 بنكي/بطاقة: *${formatMoney(data.bank, currency)}*`);
  }

  if (hasMethods) {
    for (const m of data.methods) {
      if (!m.in && !m.out) continue;
      const icon = m.icon || "📱";
      if (m.out) {
        lines.push(`${icon} ${m.name}: دخل +${formatMoney(m.in, currency)} / خرج -${formatMoney(m.out, currency)} = صافي *${formatMoney(m.net, currency)}*`);
      } else {
        lines.push(`${icon} ${m.name}: *${formatMoney(m.in, currency)}*`);
      }
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`💰 المتوقع في الدرج دلوقتي: *${formatMoney(data.expected_cash, currency)}*`);
  return lines.join("\n");
}

// Build accumulative footer template vars
function buildAccumulativeFooterVars(db, date, currency) {
  const summary = getDailyPaymentMethodSummary(db, date);
  // Return empty-string placeholders (not {} ) so any token the template
  // references still resolves to an empty string instead of leaking the
  // literal "{daily_accumulative_footer}" to the owner's chat.
  if (!summary) {
    return {
      daily_accumulative_footer: "",
      daily_cash_in: "",
      daily_cash_out: "",
      daily_cash_net: "",
      daily_expected_cash: "",
      daily_methods_summary: "",
    };
  }
  return {
    daily_accumulative_footer: buildAccumulativeFooter(summary, currency),
    daily_cash_in: formatMoney(summary.cash.in, currency),
    daily_cash_out: formatMoney(summary.cash.out, currency),
    daily_cash_net: formatMoney(summary.cash.net, currency),
    daily_expected_cash: formatMoney(summary.expected_cash, currency),
    daily_methods_summary: (summary.methods || []).map(m =>
      `${m.name}: ${formatMoney(m.net, currency)}`
    ).join(" | ") || "—",
  };
}

// Detailed payment type display — shows method WITH amount for ALL types
function buildPaymentTypeDisplay(paymentType, payments, invoiceTotal, currency) {
  const type = String(paymentType || "").toLowerCase();
  const label = translateMethod(paymentType);
  const total = formatMoney(invoiceTotal, currency);

  // Multi-payment: show full breakdown with sub-methods
  if (type === "multi" || type === "split") {
    if (!Array.isArray(payments) || payments.length === 0) return `${label} — ${total}`;
    const breakdown = payments.map(p => {
      const name = translateMethod(p.method || p.method_name || p.type || "other");
      const amt = formatMoney(p.amount, currency);
      return `  • ${name}: ${amt}`;
    }).join("\n");
    return `${label}\n${breakdown}`;
  }

  // All other types: method + amount
  return `${label} — ${total}`;
}

function buildTemplateVars(eventType, data, db, dateText, currency) {
  switch (eventType) {
    case EVENT_TYPES.NEW_INVOICE: {
      const items = Array.isArray(data.lines) ? data.lines : Array.isArray(data.items) ? data.items : [];
      const payments = Array.isArray(data.payments) ? data.payments : [];
      const total = Number(data.total || 0);
      const paid = Number(data.paid ?? data.amount_received ?? total);
      const balance = Number(data.balance ?? data.remaining_amount ?? 0);
      const accum = buildAccumulativeFooterVars(db, dateText, currency);
      return {
        invoice_no: data.invoiceNo || data.id,
        customer_name: data.customerName || data.customer_name || "غير محدد",
        total: formatMoney(total, currency),
        subtotal: formatMoney(data.subtotal || total, currency),
        tax: formatMoney(data.tax || 0, currency),
        discount: formatMoney(data.discount || 0, currency),
        paid: formatMoney(paid, currency),
        balance: formatMoney(balance, currency),
        payment_type: buildPaymentTypeDisplay(data.paymentType || data.payment_type, payments, total, currency),
        created_at: formatDateTime(data.createdAt || data.created_at),
        items_count: items.length,
        items_table: buildItemsTable(items, currency),
        payment_breakdown: buildPaymentBreakdown(payments, currency),
        ...accum,
      };
    }
    case EVENT_TYPES.DAILY_CLOSE:
      return {
        date: data.date,
        opening_balance: formatMoney(data.openingBalance, currency),
        // Sales breakdown
        cash_sales: formatMoney(data.cashSales, currency),
        credit_sales: formatMoney(data.creditSales, currency),
        installment_cash: formatMoney(data.installmentCash || 0, currency),
        multi_cash: formatMoney(data.multiCash || 0, currency),
        bank_sales: formatMoney(data.bankSales || 0, currency),
        total_sales: formatMoney(data.totalSales || 0, currency),
        invoices_count: data.invoicesCount || 0,
        // Purchases
        purchases_cash: formatMoney(data.purchasesCash || 0, currency),
        purchases_payable: formatMoney(data.purchasesPayable || 0, currency),
        // Returns
        sales_returns_cash: formatMoney(data.salesReturnsCash || 0, currency),
        sales_returns_account: formatMoney(data.salesReturnsAccount || 0, currency),
        purchase_returns_cash: formatMoney(data.purchaseReturnsCash || 0, currency),
        purchase_returns_account: formatMoney(data.purchaseReturnsAccount || 0, currency),
        // Expenses & Revenues
        expenses_cash: formatMoney(data.expensesCash || 0, currency),
        expenses_count: data.expensesCount || 0,
        revenues_cash: formatMoney(data.revenuesCash || 0, currency),
        revenues_count: data.revenuesCount || 0,
        // Payments
        customer_payments: formatMoney(data.customerPayments || 0, currency),
        customer_payments_count: data.customerPaymentsCount || 0,
        supplier_payments: formatMoney(data.supplierPayments || 0, currency),
        supplier_payments_count: data.supplierPaymentsCount || 0,
        withdrawals: formatMoney(data.withdrawals || 0, currency),
        ajal_payments: formatMoney(data.ajalPayments || 0, currency),
        // Totals
        cash_in: formatMoney(data.cashIn || 0, currency),
        cash_out: formatMoney(data.cashOut || 0, currency),
        non_cash_total: formatMoney(data.nonCashTotal || 0, currency),
        // Cash equation
        expected_cash: formatMoney(data.expectedCash, currency),
        actual_cash: formatMoney(data.actualCash, currency),
        discrepancy: formatMoney(data.discrepancy, currency),
        // Per-method
        payment_methods_summary: buildAccumulativeFooter(data.paymentMethods, currency),
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
    case EVENT_TYPES.BELOW_COST_SALE: {
      // Caller (invoices.routes.js) passes: { id, invoiceNo, items: [{name,
      // unitPrice, cost, quantity}], totalLoss, userName }. Build the same
      // flat tokens the template editor chips expose so the seeded template
      // body renders correctly instead of leaking {token} literals.
      const bcItems = Array.isArray(data.items) ? data.items : [];
      const bcFirst = bcItems[0] || {};
      return {
        invoice_no: data.invoiceNo || data.id,
        customer_name: data.customerName || data.customer_name || "غير محدد",
        item_name: bcFirst.name || bcFirst.itemName || (bcItems.length > 1 ? `${bcItems.length} أصناف` : "—"),
        selling_price: formatMoney(bcFirst.unitPrice || bcFirst.sellingPrice || 0, currency),
        cost_price: formatMoney(bcFirst.cost || bcFirst.costPrice || 0, currency),
        loss_amount: formatMoney(data.totalLoss || 0, currency),
        loss_percent: data.totalLoss && bcFirst.cost ? `${Math.round((data.totalLoss / Math.abs(bcFirst.cost)) * 100)}%` : "—",
        items_table: bcItems.slice(0, 6).map((l) =>
          `• ${l.name || "—"}: بيع بـ *${formatMoney(l.unitPrice, currency)}* والتكلفة *${formatMoney(l.cost, currency)}* (×${l.quantity})`
        ).join("\n") || "—",
        items_count: bcItems.length,
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt || data.time),
      };
    }
    case EVENT_TYPES.SALES_RETURN:
      return {
        original_invoice_id: data.originalInvoiceNo || data.originalInvoiceId,
        total: formatMoney(data.total, currency),
        customer_name: data.customerName || "غير محدد",
        refund_method: buildPaymentTypeDisplay(data.refundMethod, [], data.total || 0, currency),
        reason: translateReturnReason(data.reason),
        items_table: buildItemsTable(data.lines || data.items || [], currency),
        items_count: (data.lines || data.items || []).length,
        user_name: data.userName || "غير محدد",
      };
    case EVENT_TYPES.INVOICE_VOIDED: {
      const voidLines = data.lines || data.items || [];
      return {
        invoice_no: data.invoiceNo || data.id,
        customer_name: data.customerName || "غير محدد",
        total: formatMoney(data.total, currency),
        payment_type: data.paymentType ? buildPaymentTypeDisplay(data.paymentType, data.payments || [], data.total || 0, currency) : "—",
        reason: data.reason || "غير محدد",
        items_table: buildItemsTableWithSku(voidLines, currency),
        items_count: voidLines.length,
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    }
    case EVENT_TYPES.PURCHASE_CREATED:
      return {
        kind_label: data.kind === "receipt" ? "فاتورة شراء" : "أمر شراء", reference: data.reference || data.id,
        supplier_name: data.supplierName || "غير محدد", total: formatMoney(data.total, currency),
        payment_type: data.paymentMethod ? buildPaymentTypeDisplay(data.paymentMethod, data.payments || [], data.total || 0, currency) : "—",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.CUSTOMER_PAYMENT:
      return {
        customer_name: data.customerName || "غير محدد",
        amount: formatMoney(data.amount, currency),
        method: buildPaymentTypeDisplay(data.method, [], data.amount, currency),
      };
    case EVENT_TYPES.RETURN_PAYMENT:
      return {
        customer_name: data.customerName || "غير محدد",
        amount: formatMoney(data.amount, currency),
        method: buildPaymentTypeDisplay(data.method, [], data.amount, currency),
        date: data.date || formatDateTime(data.createdAt),
        reason: translateReturnReason(data.reason),
      };
    case EVENT_TYPES.CUSTOMER_CREATED:
      return {
        customer_name: data.customerName || data.name || "غير محدد", phone: data.phone || "—",
        city: data.city || "—", opening_balance: formatMoney(data.openingBalance || 0, currency),
      };
    case EVENT_TYPES.SUPPLIER_CREATED:
      return {
        supplier_name: data.supplierName || data.name || "غير محدد", phone: data.phone || "—",
        opening_balance: formatMoney(data.openingBalance || 0, currency),
      };
    case EVENT_TYPES.EXPENSE_CREATED:
      return {
        doc_no: data.docNo || "—",
        category: data.category || "غير محدد",
        amount: formatMoney(data.amount, currency),
        date: data.date || formatDateTime(data.createdAt),
        description: data.description || data.notes || "—",
        notes: data.notes || "—",
        method: translateMethod(data.paymentMethod || "cash"),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
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
    // Extended events (migration 194)
    case EVENT_TYPES.STOCK_TRANSFERRED:
      return {
        from_warehouse: data.fromWarehouse || "غير محدد",
        to_warehouse: data.toWarehouse || "غير محدد",
        user_name: data.userName || "غير محدد",
        items_table: buildItemsTable(data.items || [], currency),
        items_count: (data.items || []).length,
        total_units: (data.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0),
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.INVENTORY_ADJUSTED:
      return {
        product_name: data.productName || data.itemName || "غير محدد",
        warehouse: data.warehouse || "غير محدد",
        old_quantity: data.oldQuantity ?? "—",
        new_quantity: data.newQuantity ?? "—",
        difference: data.difference ?? (Number(data.newQuantity ?? 0) - Number(data.oldQuantity ?? 0)),
        reason: data.reason || "غير محدد",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.NEW_PRODUCT:
      return {
        product_name: data.productName || data.itemName || "غير محدد",
        sku: data.sku || data.itemCode || "—",
        price: formatMoney(data.price || 0, currency),
        warehouse: data.warehouse || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PRICE_CHANGED:
      return {
        product_name: data.productName || data.itemName || "غير محدد",
        old_price: formatMoney(data.oldPrice || 0, currency),
        new_price: formatMoney(data.newPrice || 0, currency),
        change_percent: data.changePercent ?? "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BATCH_EXPIRY_WARNING:
      return {
        product_name: data.productName || data.itemName || "غير محدد",
        batch_no: data.batchNo || "—",
        expiry_date: data.expiryDate || "—",
        remaining_quantity: data.remainingQuantity ?? data.quantity ?? "—",
        warehouse: data.warehouse || "غير محدد",
      };
    case EVENT_TYPES.PHYSICAL_COUNT_CONFIRMED:
      return {
        warehouse: data.warehouse || "غير محدد",
        user_name: data.userName || "غير محدد",
        total_items: data.totalItems ?? data.itemsCount ?? 0,
        matched_count: data.matchedCount ?? data.matched ?? 0,
        mismatched_count: data.mismatchedCount ?? data.discrepancies ?? 0,
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SUPPLIER_PAYMENT:
      return {
        supplier_name: data.supplierName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        method: buildPaymentTypeDisplay(data.method, [], data.amount, currency),
        reference: data.reference || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.DEBT_PAYMENT_RECEIVED:
      return {
        customer_name: data.customerName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        method: buildPaymentTypeDisplay(data.method, [], data.amount, currency),
        remaining_debt: data.remainingDebt !== undefined ? formatMoney(data.remainingDebt, currency) : "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.INSTALLMENT_PAID:
      return {
        customer_name: data.customerName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        installment_no: data.installmentNo ?? "—",
        total_installments: data.totalInstallments ?? "—",
        remaining: data.remaining !== undefined ? formatMoney(data.remaining, currency) : "—",
        method: buildPaymentTypeDisplay(data.method, [], data.amount, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PURCHASE_VOIDED: {
      const pvLines = data.items || data.lines || [];
      return {
        reference_no: data.referenceNo || data.invoiceNo || data.id || "—",
        supplier_name: data.supplierName || "غير محدد",
        total: formatMoney(data.total || 0, currency),
        reason: data.reason || "غير محدد",
        items_table: buildItemsTable(pvLines, currency),
        items_count: pvLines.length,
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    }
    case EVENT_TYPES.PURCHASE_RETURN:
      return {
        reference_no: data.referenceNo || data.originalInvoice || "—",
        supplier_name: data.supplierName || "غير محدد",
        items_table: buildItemsTable(data.items || [], currency),
        items_count: (data.items || []).length,
        total: formatMoney(data.total || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BRANCH_TRANSFER:
      return {
        reference_no: data.referenceNo || "—",
        from_branch: data.fromBranch || "غير محدد",
        // The seeded template uses {to_warehouse} for the destination.
        to_warehouse: data.toBranch || data.toWarehouse || "غير محدد",
        to_branch: data.toBranch || "غير محدد",
        user_name: data.userName || "غير محدد",
        transfer_type: data.transferType === "send" ? "إرسال" : "استلام",
        notes: data.notes || "—",
        items_table: buildItemsTable(data.items || [], currency),
        items_count: (data.items || []).length,
        total_units: (data.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0),
        total_cost: formatMoney((data.items || []).reduce((sum, it) => sum + (it.line_total || (it.quantity || 0) * (it.unit_cost || 0)), 0), currency),
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PASSWORD_CHANGED:
      return {
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
        ip_address: data.ipAddress || "غير معروف",
      };
    case EVENT_TYPES.PERMISSION_CHANGED:
      return {
        user_name: data.targetUser || data.userName || "غير محدد",
        action: data.action || "تم تغيير الصلاحيات",
        details: data.changes || data.details || "—",
        changed_by: data.adminUser || data.changedBy || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SUPERVISOR_OVERRIDE:
      return {
        user_name: data.userName || "غير محدد",
        action: data.action || "غير محدد",
        details: data.details || data.reason || (data.amount ? `القيمة: ${formatMoney(data.amount, currency)}` : "—"),
        supervisor: data.supervisor || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.REPAIR_ORDER_CREATED:
      return {
        order_no: data.orderNo || data.id || "—",
        customer_name: data.customerName || "غير محدد",
        device_type: data.deviceType || "—",
        problem: data.problem || "—",
        estimated_cost: formatMoney(data.estimatedCost || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.REPAIR_ORDER_READY:
      return {
        order_no: data.orderNo || data.id || "—",
        customer_name: data.customerName || "غير محدد",
        device_type: data.deviceType || "—",
        final_cost: formatMoney(data.finalCost || 0, currency),
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.REPAIR_ORDER_DELIVERED:
      return {
        order_no: data.orderNo || data.id || "—",
        customer_name: data.customerName || "غير محدد",
        device_type: data.deviceType || "—",
        amount_paid: formatMoney(data.amountPaid || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.REVENUE_CREATED:
      return {
        doc_no: data.docNo || "—",
        amount: formatMoney(data.amount || 0, currency),
        category: data.category || "غير مصنف",
        description: data.description || "—",
        method: translateMethod(data.paymentMethod || "cash"),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.WITHDRAWAL_CREATED:
      return {
        doc_no: data.docNo || "—",
        amount: formatMoney(data.amount || 0, currency),
        category: data.category || "غير مصنف",
        note: data.note || "—",
        method: translateMethod(data.paymentMethod || "cash"),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.EMPLOYEE_CREATED:
      return {
        employee_name: data.employeeName || "غير محدد",
        job_title: data.jobTitle || "—",
        salary: formatMoney(data.salary || 0, currency),
        phone: data.phone || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SALARY_SETTLED:
      return {
        employee_name: data.employeeName || "غير محدد",
        period: data.period || "—",
        base_salary: formatMoney(data.baseSalary || 0, currency),
        bonuses: formatMoney(data.bonuses || 0, currency),
        deductions: formatMoney(data.deductions || 0, currency),
        advance_deductions: formatMoney(data.advanceDeductions || 0, currency),
        net_salary: formatMoney(data.netSalary || 0, currency),
        paid_amount: formatMoney(data.paidAmount || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.ADVANCE_CREATED:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        installment_count: data.installmentCount ?? "—",
        installment_amount: formatMoney(data.installmentAmount || 0, currency),
        notes: data.notes || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.DEDUCTION_CREATED:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        deduction_type: data.deductionType || "غير محدد",
        is_recurring: data.isRecurring ? "نعم" : "لا",
        notes: data.notes || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BONUS_CREATED:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        bonus_type: data.bonusType || "غير محدد",
        is_recurring: data.isRecurring ? "نعم" : "لا",
        notes: data.notes || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── New edit/delete events (migration 201) ─────────────────────────────
    case EVENT_TYPES.EXPENSE_EDITED:
      return {
        expense_id: data.expenseId || data.id || "—",
        doc_no: data.docNo || "—",
        category: data.category || "غير مصنف",
        old_amount: formatMoney(data.oldAmount || 0, currency),
        new_amount: formatMoney(data.newAmount || 0, currency),
        old_description: data.oldDescription || "—",
        new_description: data.newDescription || "—",
        payment_method: translateMethod(data.paymentMethod || "cash"),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.EXPENSE_DELETED:
      return {
        expense_id: data.expenseId || data.id || "—",
        doc_no: data.docNo || "—",
        category: data.category || "غير مصنف",
        amount: formatMoney(data.amount || 0, currency),
        description: data.description || data.notes || "—",
        payment_method: translateMethod(data.paymentMethod || "cash"),
        date: data.date || formatDateTime(data.createdAt),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.deletedAt || data.createdAt),
      };
    case EVENT_TYPES.REVENUE_EDITED:
      return {
        revenue_id: data.revenueId || data.id || "—",
        doc_no: data.docNo || "—",
        category: data.category || "غير مصنف",
        old_amount: formatMoney(data.oldAmount || 0, currency),
        new_amount: formatMoney(data.newAmount || 0, currency),
        old_description: data.oldDescription || "—",
        new_description: data.newDescription || "—",
        payment_method: translateMethod(data.paymentMethod || "cash"),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.REVENUE_DELETED:
      return {
        revenue_id: data.revenueId || data.id || "—",
        doc_no: data.docNo || "—",
        category: data.category || "غير مصنف",
        amount: formatMoney(data.amount || 0, currency),
        description: data.description || data.notes || "—",
        payment_method: translateMethod(data.paymentMethod || "cash"),
        date: data.date || formatDateTime(data.createdAt),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.deletedAt || data.createdAt),
      };
    // ── Return lifecycle + bulk pricing (migration 210) ────────────────────
    case EVENT_TYPES.SALES_RETURN_EDITED:
      return {
        doc_no: data.docNo || data.id || "—",
        customer_name: data.customerName || "غير محدد",
        old_total: formatMoney(data.oldTotal || 0, currency),
        new_total: formatMoney(data.newTotal || 0, currency),
        old_items_table: buildItemsTableWithSku(data.oldLines, currency),
        new_items_table: buildItemsTableWithSku(data.newLines, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
        // Compatibility
        total: formatMoney(data.newTotal || 0, currency),
        items_table: buildItemsTableWithSku(data.newLines, currency),
      };
    case EVENT_TYPES.SALES_RETURN_CANCELLED:
      return {
        doc_no: data.docNo || data.id || "—",
        customer_name: data.customerName || "غير محدد",
        total: formatMoney(data.total || 0, currency),
        reason: data.reason || "غير محدد",
        items_table: buildItemsTableWithSku(data.lines, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.cancelledAt || data.createdAt),
      };
    case EVENT_TYPES.PURCHASE_RETURN_EDITED:
      return {
        reference_no: data.referenceNo || data.docNo || "—",
        supplier_name: data.supplierName || "غير محدد",
        old_total: formatMoney(data.oldTotal || 0, currency),
        new_total: formatMoney(data.newTotal || 0, currency),
        old_items_table: buildItemsTableWithSku(data.oldLines, currency),
        new_items_table: buildItemsTableWithSku(data.newLines, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
        // Compatibility
        total: formatMoney(data.newTotal || 0, currency),
        items_table: buildItemsTableWithSku(data.newLines, currency),
      };
    case EVENT_TYPES.PRICE_BULK_UPDATE:
      return {
        operation_label: data.operationLabel || "تحديث أسعار جماعي",
        items_count: data.itemsCount ?? 0,
        field_label: data.fieldLabel || "سعر البيع",
        adjustment_label: data.adjustmentLabel || "—",
        reason: data.reason || "—",
        changes_table: data.changesTable || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.ITEM_DELETED:
      return {
        product_name: data.productName || data.itemName || "غير محدد",
        sku: data.sku || data.itemCode || "—",
        price: formatMoney(data.price || 0, currency),
        quantity: data.quantity ?? "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.CUSTOMER_DELETED:
      return {
        customer_name: data.customerName || data.name || "غير محدد",
        phone: data.phone || "—",
        balance: formatMoney(data.balance || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SUPPLIER_DELETED:
      return {
        supplier_name: data.supplierName || data.name || "غير محدد",
        phone: data.phone || "—",
        balance: formatMoney(data.balance || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.EMPLOYEE_DELETED:
      return {
        employee_name: data.employeeName || data.name || "غير محدد",
        job_title: data.jobTitle || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── New edit/cancel events (migration 202) ─────────────────────────────
    case EVENT_TYPES.INVOICE_EDITED:
      return {
        invoice_no: data.invoiceNo || data.id || '—',
        old_customer_name: data.oldCustomerName || 'غير محدد',
        new_customer_name: data.newCustomerName || 'غير محدد',
        old_total: formatMoney(data.oldTotal || 0, currency),
        new_total: formatMoney(data.newTotal || 0, currency),
        old_payment_type: buildPaymentTypeDisplay(data.oldPaymentType, data.oldPayments || [], data.oldTotal || 0, currency),
        new_payment_type: buildPaymentTypeDisplay(data.newPaymentType, data.newPayments || [], data.newTotal || 0, currency),
        old_items_table: buildItemsTableWithSku(data.oldLines, currency),
        new_items_table: buildItemsTableWithSku(data.newLines, currency),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.createdAt),
        // Compatibility
        customer_name: data.newCustomerName || 'غير محدد',
        total: formatMoney(data.newTotal || 0, currency),
        items_table: buildItemsTableWithSku(data.newLines, currency),
        payment_breakdown: buildPaymentTypeDisplay(data.newPaymentType, data.newPayments || [], data.newTotal || 0, currency),
      };
    case EVENT_TYPES.INVOICE_AMENDED:
      return {
        old_invoice_no: data.oldInvoiceNo || data.originalId || '—',
        new_invoice_no: data.invoiceNo || data.id || '—',
        old_customer_name: data.oldCustomerName || 'غير محدد',
        new_customer_name: data.newCustomerName || 'غير محدد',
        old_total: formatMoney(data.oldTotal || 0, currency),
        new_total: formatMoney(data.newTotal || 0, currency),
        old_items_table: buildItemsTableWithSku(data.oldLines, currency),
        new_items_table: buildItemsTableWithSku(data.newLines, currency),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.createdAt),
        // Compatibility
        customer_name: data.newCustomerName || 'غير محدد',
        total: formatMoney(data.newTotal || 0, currency),
        items_table: buildItemsTableWithSku(data.newLines, currency),
      };
    case EVENT_TYPES.PURCHASE_EDITED:
      return {
        reference_no: data.referenceNo || data.docNo || '—',
        old_supplier_name: data.oldSupplierName || 'غير محدد',
        new_supplier_name: data.newSupplierName || 'غير محدد',
        old_total: formatMoney(data.oldTotal || 0, currency),
        new_total: formatMoney(data.newTotal || 0, currency),
        old_payment_method: buildPaymentTypeDisplay(data.oldPaymentMethod, data.oldPayments || [], data.oldTotal || 0, currency),
        new_payment_method: buildPaymentTypeDisplay(data.newPaymentMethod, data.newPayments || [], data.newTotal || 0, currency),
        old_items_table: buildItemsTableWithSku(data.oldLines, currency),
        new_items_table: buildItemsTableWithSku(data.newLines, currency),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.createdAt),
        // Compatibility
        supplier_name: data.newSupplierName || 'غير محدد',
        total: formatMoney(data.newTotal || 0, currency),
        new_total: formatMoney(data.newTotal || 0, currency),
        items_table: buildItemsTableWithSku(data.newLines, currency),
        payment_method: buildPaymentTypeDisplay(data.newPaymentMethod, data.newPayments || [], data.newTotal || 0, currency),
      };
    case EVENT_TYPES.PURCHASE_RETURN_CANCELLED:
      return {
        reference_no: data.referenceNo || data.docNo || '—',
        supplier_name: data.supplierName || 'غير محدد',
        total: formatMoney(data.total || 0, currency),
        reason: data.reason || '—',
        items_table: buildItemsTableWithSku(data.lines, currency),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BRANCH_TRANSFER_EDITED:
      return {
        reference_no: data.referenceNo || '—',
        transfer_type: data.transferType === 'send' ? 'إرسال' : 'استلام',
        old_partner_branch: data.oldPartnerBranch || '—',
        new_partner_branch: data.newPartnerBranch || '—',
        old_items_table: buildBranchTransferItemsTable(data.oldLines),
        new_items_table: buildBranchTransferItemsTable(data.newLines),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.createdAt),
        // Compatibility
        partner_branch: data.newPartnerBranch || '—',
        items_table: buildBranchTransferItemsTable(data.newLines),
      };
    case EVENT_TYPES.BRANCH_TRANSFER_CANCELLED:
      return {
        reference_no: data.referenceNo || '—',
        transfer_type: data.transferType === 'send' ? 'إرسال' : 'استلام',
        partner_branch: data.partnerBranch || '—',
        reason: data.reason || '—',
        items_table: buildBranchTransferItemsTable(data.lines),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.cancelledAt || data.createdAt),
      };
    case EVENT_TYPES.WITHDRAWAL_EDITED:
      return {
        doc_no: data.docNo || '—',
        old_amount: formatMoney(data.oldAmount || 0, currency),
        new_amount: formatMoney(data.newAmount || 0, currency),
        category: data.category || 'غير مصنف',
        note: data.note || '—',
        payment_method: data.paymentMethod || 'نقداً',
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.WITHDRAWAL_DELETED:
      return {
        doc_no: data.docNo || '—',
        amount: formatMoney(data.amount || 0, currency),
        category: data.category || 'غير مصنف',
        note: data.note || '—',
        payment_method: data.paymentMethod || 'نقداً',
        date: data.date || formatDateTime(data.createdAt),
        user_name: data.userName || 'غير محدد',
        time: formatDateTime(data.deletedAt || data.createdAt),
      };
    // ── Quit/logout events (migration 212) ──────────────────────────────────
    // The owner expects the same "day report" snapshot that the accumulative
    // footer sends on every other event, so the closing/quit messages carry
    // the full day totals (cash in/out/net, credit, bank, per-method,
    // expected_cash) — inject the accum tokens here so the template author can
    // either embed {daily_accumulative_footer} anywhere or rely on the
    // auto-append in buildMessage.
    case EVENT_TYPES.APP_QUIT:
      return {
        user_name: data.userName || "غير محدد",
        trigger_reason: data.reason || "إغلاق التطبيق",
        time: formatDateTime(data.createdAt),
        ...buildAccumulativeFooterVars(db, dateText, currency),
      };
    case EVENT_TYPES.USER_LOGOUT:
      return {
        user_name: data.userName || "غير محدد",
        trigger_reason: data.reason || "تسجيل خروج",
        time: formatDateTime(data.createdAt),
        ...buildAccumulativeFooterVars(db, dateText, currency),
      };
    // ── Payroll partial payment + risky-deletion coverage (migration 215) ───
    case EVENT_TYPES.SALARY_PARTIAL_PAID:
      return {
        kind_label: data.kindLabel || "صرف جزئي للراتب",
        employee_name: data.employeeName || "غير محدد",
        period: data.period || "—",
        net_salary: formatMoney(data.netSalary || 0, currency),
        paid_amount: formatMoney(data.paidAmount || 0, currency),
        remaining: formatMoney(data.remaining || 0, currency),
        remainder_plan: data.carryForward === undefined || data.carryForward === null
          ? "—"
          : data.carryForward ? "يتنقل للصرف الجاي تلقائياً" : "يتسدد بعدين يدوياً",
        method: translateMethod(data.paymentMethod || "cash"),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SALARY_SETTLEMENT_DELETED:
      return {
        employee_name: data.employeeName || "غير محدد",
        period: data.period || "—",
        paid_amount: formatMoney(data.paidAmount || 0, currency),
        net_salary: formatMoney(data.netSalary || 0, currency),
        expense_deleted: data.expenseDeleted ? "نعم" : "لا",
        reversed_advances: data.reversedAdvances ?? 0,
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.ADVANCE_PAYMENT:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        remaining: formatMoney(data.remaining || 0, currency),
        notes: data.notes || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.ADVANCE_DELETED:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        remaining: formatMoney(data.remaining || 0, currency),
        delete_kind: data.hardDeleted ? "حذف نهائي" : "إلغاء (لها مدفوعات)",
        expense_deleted: data.expenseDeleted ? "نعم" : "لا",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.DEDUCTION_DELETED:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        deduction_type: data.deductionType || "غير محدد",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BONUS_DELETED:
      return {
        employee_name: data.employeeName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        bonus_type: data.bonusType || "غير محدد",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.USER_DELETED:
      return {
        user_name: data.deletedUser || data.userName || "غير محدد",
        role: data.role || "—",
        deleted_by: data.deletedBy || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── Money-channel + tamper coverage (migration 216) ─────────────────────
    case EVENT_TYPES.USER_CREATED:
      return {
        user_name: data.createdUser || data.userName || "غير محدد",
        login_name: data.loginName || "—",
        role: data.role || "—",
        permissions_summary: data.permissionsSummary || "الصلاحيات الافتراضية",
        created_by: data.createdBy || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.TREASURY_CHANGED:
      return {
        action_label: data.actionLabel || "تعديل خزينة",
        treasury_name: data.treasuryName || "غير محدد",
        old_balance: data.oldBalance === undefined || data.oldBalance === null ? "—" : formatMoney(data.oldBalance, currency),
        new_balance: data.newBalance === undefined || data.newBalance === null ? "—" : formatMoney(data.newBalance, currency),
        details: data.details || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PAYMENT_METHOD_CHANGED:
      return {
        action_label: data.actionLabel || "تعديل طريقة دفع",
        method_name: data.methodName || "غير محدد",
        details: data.details || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PROMOTION_CHANGED:
      return {
        action_label: data.actionLabel || "تعديل عرض",
        promotion_name: data.promotionName || "غير محدد",
        details: data.details || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BACKUP_RESTORED:
      return {
        source: data.source || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.DATA_WIPED:
      return {
        scope: data.scope || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.NOTIFICATIONS_DISABLED:
      return {
        change_label: data.changeLabel || "تم إيقاف إشعارات تيليجرام",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── Self-watching alert channel (migration 217) ───────────────────────
    case EVENT_TYPES.TELEGRAM_RECIPIENT_CHANGED:
      return {
        action_label: data.actionLabel || "تغيير مستلم",
        recipient_name: data.recipientName || "غير محدد",
        chat_id: data.chatId || "—",
        changes_summary: data.changesSummary || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── Employee edit + legacy adjustment (migration 218) ──────────────────
    case EVENT_TYPES.EMPLOYEE_EDITED:
      return {
        employee_name: data.employeeName || "غير محدد",
        old_salary: data.oldSalary === undefined || data.oldSalary === null ? "—" : formatMoney(data.oldSalary, currency),
        new_salary: data.newSalary === undefined || data.newSalary === null ? "—" : formatMoney(data.newSalary, currency),
        old_job_title: data.oldJobTitle || "—",
        new_job_title: data.newJobTitle || "—",
        phone: data.phone || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.ADJUSTMENT_CREATED:
      return {
        employee_name: data.employeeName || "غير محدد",
        type_label: data.adjustmentType === "incentive" ? "حافز" : data.adjustmentType === "penalty" ? "خصم" : data.adjustmentType || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        reason: data.reason || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── Backup export + settings change (migration 219) ────────────────────
    case EVENT_TYPES.BACKUP_EXPORTED:
      return {
        file_path: data.filePath || data.path || "—",
        file_size: data.fileSize || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BACKUP_SETTINGS_CHANGED:
      return {
        setting_name: data.settingName || "إعداد النسخ الاحتياطي",
        old_value: data.oldValue ?? "—",
        new_value: data.newValue ?? "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    // ── Bulk settings change (migration 220) ──────────────────────────────
    case EVENT_TYPES.SETTINGS_CHANGED: {
      const changes = data.changes || {};
      const changeLines = Object.entries(changes).map(([key, val]) => {
        const label = SETTINGS_KEY_LABELS[key] || key;
        const from = val?.from ?? "—";
        const to = val?.to ?? "—";
        return `• ${label}: "${from}" ← "${to}"`;
      });
      return {
        changes_count: data.changesCount ?? Object.keys(changes).length,
        changes_summary: data.changesSummary || Object.keys(changes).slice(0, 5).join("، ") || "—",
        changes_detail: changeLines.join("\n") || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    }
    default:
      return {};
  }
}

// Telegram legacy-Markdown treats _ * ` [ as entity markers. Dynamic values
// (method codes like cash_back, SKUs like [BT-01], user names…) routinely
// contain them unbalanced, which makes sendMessage fail with
// "can't parse entities" and the notification silently never arrives.
// Escape them in every interpolated value; formatting (*bold*) lives in the
// template bodies, never in the values.
function escapeMd(v) {
  return String(v).replace(/([_*`[])/g, "\\$1");
}

function renderTemplate(body, vars) {
  return Object.entries(vars).reduce(
    // Function replacer: a plain-string replacement would reinterpret $& / $'
    // sequences inside the value.
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), () => escapeMd(val ?? "")),
    body
  );
}

function formatDateTime(dt) {
  if (!dt) return new Date().toLocaleString("ar-EG");
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString("ar-EG");
}

// Finds the template body for an event. Priority:
//   1. The variant the recipient chose per event (message_template_variants by
//      category + label) — this is what the preset chips in the UI select.
//   2. The globally active template (message_templates, kept in sync with the
//      active variant row).
//   3. null — caller falls back to the hardcoded default.
function resolveTemplateBody(db, category, presetLabel) {
  if (!db || !category) return null;
  try {
    if (presetLabel) {
      const variant = db
        .prepare("SELECT body FROM message_template_variants WHERE category = ? AND label = ?")
        .get(category, presetLabel);
      if (variant?.body) return variant.body;
    }
    const row = db.prepare("SELECT body FROM message_templates WHERE kind = ?").get(category);
    if (row?.body) return row.body;
  } catch (_) { /* un-migrated DB — hardcoded default below */ }
  return null;
}

// bodyOverride lets the template editor preview an unsaved body through the
// exact production pipeline (tokens, escaping, footer auto-append).
function buildMessage(eventType, data = {}, db = null, presetLabel = null, bodyOverride = null) {
  const currency = data.currencySymbol || "ج";
  const branch = data.branch || "";
  const header = branch ? `🏪 *${branch}*\n` : "";

  const category = EVENT_CATEGORY[eventType];
  const body = bodyOverride || resolveTemplateBody(db, category, presetLabel);
  if (body) {
    let msg = header + renderTemplate(body, buildTemplateVars(eventType, data, db, localDate(), currency));
    // Auto-append the accumulative day footer ONLY for money-related events.
    // Non-money events (settings, permissions, products, backups, etc.) should
    // not clutter the message with cash/treasury running totals.
    if (db && MONEY_EVENTS.has(eventType)) {
      if (!body.includes("{daily_accumulative_footer}")) {
        const accumFooter = buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency);
        if (accumFooter) msg += `\n${accumFooter}`;
      }
    }
    return msg;
  }

  switch (eventType) {
    case EVENT_TYPES.TEST:
      return `${header}✅ اختبار ناجح\nتم إعداد إشعارات Telegram بنجاح.`;

    case EVENT_TYPES.NEW_INVOICE: {
      const total = formatMoney(data.total, currency);
      const payments = Array.isArray(data.payments) ? data.payments : [];
      const paymentDisplay = buildPaymentTypeDisplay(data.paymentType, payments, data.total, currency);
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}🧾 فاتورة جديدة\n` +
        `الرقم: *#${data.invoiceNo || data.id}*\n` +
        `العميل: *${data.customerName || "غير محدد"}*\n` +
        `المجموع: *${total}*\n` +
        `طريقة الدفع: *${paymentDisplay}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (accumFooter ? `\n${accumFooter}` : "");
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
      const lines = (data.lines || []).map(l =>
        `• ${l.item_name || l.name || '—'} ×${l.quantity}`
      ).join('\n');
      const refundDisplay = buildPaymentTypeDisplay(data.refundMethod, [], data.total, currency);
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}↩️ مرتجع مبيعات\n` +
        `الفاتورة الأصلية: *#${data.originalInvoiceNo || data.originalInvoiceId}*\n` +
        `العميل: *${data.customerName || 'غير محدد'}*\n` +
        `مبلغ المرتجع: *${total}*\n` +
        `طريقة الاسترداد: *${refundDisplay}*\n` +
        `السبب: *${translateReturnReason(data.reason)}*\n` +
        (lines ? `الأصناف:\n${lines}\n` : '') +
        `بواسطة: *${data.userName || 'غير محدد'}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (accumFooter ? `\n${accumFooter}` : "");
    }

    case EVENT_TYPES.RETURN_PAYMENT: {
      const rpDisplay = buildPaymentTypeDisplay(data.method, [], data.amount, currency);
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}↩️ *دفعة مرتجعة*\n` +
        `العميل: *${data.customerName || 'غير محدد'}*\n` +
        `المبلغ: *${formatMoney(data.amount, currency)}*\n` +
        `الطريقة: *${rpDisplay}*\n` +
        `السبب: *${translateReturnReason(data.reason)}*\n` +
        `التاريخ: ${data.date || formatDateTime(data.createdAt)}` +
        (accumFooter ? `\n${accumFooter}` : "");
    }

    case EVENT_TYPES.INVOICE_VOIDED: {
      const voidLines = data.lines || data.items || [];
      const voidTable = buildItemsTableWithSku(voidLines, currency);
      const voidPayment = data.paymentType ? buildPaymentTypeDisplay(data.paymentType, data.payments || [], data.total, currency) : null;
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}⛔ إلغاء فاتورة مبيعات #${data.invoiceNo || data.id}\n` +
        `العميل: *${data.customerName || 'غير محدد'}*\n` +
        `الإجمالي: *${formatMoney(data.total, currency)}*\n` +
        (voidPayment ? `طريقة الدفع: *${voidPayment}*\n` : "") +
        `السبب: *${data.reason || "غير محدد"}*\n` +
        (voidLines.length ? `\n📦 أصناف الفاتورة الملغاة:\n${voidTable}\n📊 عدد الأصناف: ${voidLines.length}\n` : '') +
        `بواسطة: *${data.userName || "غير محدد"}*` +
        (accumFooter ? `\n${accumFooter}` : "");
    }

    case EVENT_TYPES.INVOICE_EDITED: {
      const oldTable = buildItemsTableWithSku(data.oldLines, currency);
      const newTable = buildItemsTableWithSku(data.newLines, currency);
      const oldPayment = buildPaymentTypeDisplay(data.oldPaymentType, data.oldPayments || [], data.oldTotal, currency);
      const newPayment = buildPaymentTypeDisplay(data.newPaymentType, data.newPayments || [], data.newTotal, currency);
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}✏️ تعديل فاتورة مبيعات #${data.invoiceNo || data.id}\n` +
        `◀️ قبل: العميل ${data.oldCustomerName || 'غير محدد'} — ${formatMoney(data.oldTotal, currency)} | *${oldPayment}*\n` +
        `${oldTable}\n` +
        `▶️ بعد: العميل *${data.newCustomerName || 'غير محدد'}* — *${formatMoney(data.newTotal, currency)}* | *${newPayment}*\n` +
        `${newTable}\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (accumFooter ? `\n${accumFooter}` : "");
    }

    case EVENT_TYPES.INVOICE_AMENDED:
      return `${header}🔄 تعديل (أمندمنت) فاتورة\n` +
        `الفاتورة القديمة: #${data.oldInvoiceNo || data.originalId || '—'} (ملغاة)\n` +
        `الفاتورة الجديدة: *#${data.invoiceNo || data.id}*\n` +
        `العميل: *${data.customerName || 'غير محدد'}*\n` +
        `الإجمالي: *${formatMoney(data.total, currency)}*\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*`;

    case EVENT_TYPES.PURCHASE_EDITED: {
      const oldPm = buildPaymentTypeDisplay(data.oldPaymentMethod, data.oldPayments || [], data.oldTotal, currency);
      const newPm = buildPaymentTypeDisplay(data.newPaymentMethod, data.newPayments || [], data.newTotal, currency);
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}✏️ تعديل فاتورة مشتريات\n` +
        `المرجع: *${data.referenceNo || data.docNo || '—'}*\n` +
        `◀️ قبل: المورد ${data.oldSupplierName || 'غير محدد'} — ${formatMoney(data.oldTotal, currency)} | *${oldPm}*\n` +
        `▶️ بعد: المورد *${data.newSupplierName || 'غير محدد'}* — *${formatMoney(data.newTotal, currency)}* | *${newPm}*\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (accumFooter ? `\n${accumFooter}` : "");
    }

    case EVENT_TYPES.PURCHASE_RETURN_CANCELLED:
      return `${header}❌ إلغاء مرتجع مشتريات\n` +
        `المرجع: *${data.referenceNo || data.docNo || '—'}*\n` +
        `المورد: *${data.supplierName || 'غير محدد'}*\n` +
        `السبب: *${data.reason || 'غير محدد'}*\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*`;

    case EVENT_TYPES.BRANCH_TRANSFER_EDITED:
      return `${header}✏️ تعديل حركة فرع\n` +
        `المرجع: *${data.referenceNo || '—'}*\n` +
        `النوع: ${data.transferType === 'send' ? 'إرسال' : 'استلام'}\n` +
        `الفرع: *${data.partnerBranch || 'غير محدد'}*\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*`;

    case EVENT_TYPES.BRANCH_TRANSFER_CANCELLED:
      return `${header}❌ إلغاء حركة فرع\n` +
        `المرجع: *${data.referenceNo || '—'}*\n` +
        `النوع: ${data.transferType === 'send' ? 'إرسال' : 'استلام'}\n` +
        `السبب: *${data.reason || 'غير محدد'}*\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*`;

    case EVENT_TYPES.WITHDRAWAL_EDITED:
      return `${header}✏️ تعديل سحب نقدي\n` +
        `المستند: *${data.docNo || '—'}*\n` +
        `المبلغ قبل: ${formatMoney(data.oldAmount, currency)} → بعد: *${formatMoney(data.newAmount, currency)}*\n` +
        `الفئة: ${data.category || 'غير مصنف'}\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*`;

    case EVENT_TYPES.WITHDRAWAL_DELETED:
      return `${header}🗑️ حذف سحب نقدي\n` +
        `المستند: *${data.docNo || '—'}*\n` +
        `المبلغ: *${formatMoney(data.amount, currency)}*\n` +
        `الفئة: ${data.category || 'غير مصنف'}\n` +
        `بواسطة: *${data.userName || 'غير محدد'}*`;

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
      const o = (v) => formatMoney(v, currency);
      return `${header}📅 إغلاق يومية — ${data.date}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 الرصيد الافتتاحي: *${o(data.openingBalance)}*\n` +
        `━━━━ 📥 المبيعات ━━━━\n` +
        `🧾 نقدية: *${o(data.cashSales)}*\n` +
        `📋 آجلة: *${o(data.creditSales)}*\n` +
        `🔄 أقساط: *${o(data.installmentCash || 0)}*\n` +
        `🔀 متعدد: *${o(data.multiCash || 0)}*\n` +
        `🏦 بنكي/بطاقة: *${o(data.bankSales || 0)}*\n` +
        `📊 الإجمالي: *${o(data.totalSales || 0)}* (${data.invoicesCount || 0} فاتورة)\n` +
        `━━━━ 📦 المشتريات ━━━━\n` +
        `💵 نقدية: *${o(data.purchasesCash || 0)}*\n` +
        `📋 آجلة: *${o(data.purchasesPayable || 0)}*\n` +
        `━━━━ ↩️ المرتجعات ━━━━\n` +
        `↩️ مبيعات (نقدي): *${o(data.salesReturnsCash || 0)}*\n` +
        `↩️ مبيعات (آجل): *${o(data.salesReturnsAccount || 0)}*\n` +
        `↩️ مشتريات (نقدي): *${o(data.purchaseReturnsCash || 0)}*\n` +
        `↩️ مشتريات (آجل): *${o(data.purchaseReturnsAccount || 0)}*\n` +
        `━━━━ 💸 المصروفات ━━━━\n` +
        `💸 مصروفات: *${o(data.expensesCash || 0)}* (${data.expensesCount || 0})\n` +
        `💰 إيرادات: *${o(data.revenuesCash || 0)}* (${data.revenuesCount || 0})\n` +
        `🏧 سحوبات: *${o(data.withdrawals || 0)}*\n` +
        `━━━━ 💳 الدفعات ━━━━\n` +
        `💰 تحصيل عملاء: *${o(data.customerPayments || 0)}* (${data.customerPaymentsCount || 0})\n` +
        `💰 دفع موردين: *${o(data.supplierPayments || 0)}* (${data.supplierPaymentsCount || 0})\n` +
        `📋 تحصيل آجل: *${o(data.ajalPayments || 0)}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📥 الوارد: *${o(data.cashIn || 0)}*\n` +
        `📤 الصادر: *${o(data.cashOut || 0)}*\n` +
        `💰 الرصيد المتوقع: *${o(data.expectedCash)}*\n` +
        `💵 الرصيد الفعلي: *${o(data.actualCash)}*\n` +
        `⚖️ الفرق: *${o(data.discrepancy)}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        (data.nonCashTotal ? `📊 حركات غير نقدية: *${o(data.nonCashTotal)}*\n` : "") +
        (data.paymentMethods ? buildAccumulativeFooter(data.paymentMethods, currency) : "");
    }

    case EVENT_TYPES.PURCHASE_CREATED: {
      const total = formatMoney(data.total, currency);
      const pmDisplay = data.paymentMethod ? buildPaymentTypeDisplay(data.paymentMethod, data.payments || [], data.total, currency) : null;
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}📦 عملية شراء جديدة\n` +
        `النوع: *${data.kind === "receipt" ? "فاتورة شراء" : "أمر شراء"}*\n` +
        `الرقم: *#${data.reference || data.id}*\n` +
        `المورد: *${data.supplierName || "غير محدد"}*\n` +
        `المجموع: *${total}*\n` +
        (pmDisplay ? `طريقة الدفع: *${pmDisplay}*\n` : "") +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (accumFooter ? `\n${accumFooter}` : "");
    }

    case EVENT_TYPES.CUSTOMER_PAYMENT: {
      const cpDisplay = buildPaymentTypeDisplay(data.method, [], data.amount, currency);
      const accumFooter = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}💰 دفع من عميل\n` +
        `العميل: *${data.customerName || "غير محدد"}*\n` +
        `المبلغ: *${formatMoney(data.amount, currency)}*\n` +
        `الطريقة: *${cpDisplay}*` +
        (accumFooter ? `\n${accumFooter}` : "");
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

    case EVENT_TYPES.BELOW_COST_SALE: {
      const items = Array.isArray(data.items) ? data.items : [];
      const list = items.slice(0, 6).map((l) =>
        `• ${l.name || "—"}: بيع بـ *${formatMoney(l.unitPrice, currency)}* والتكلفة *${formatMoney(l.cost, currency)}* (×${l.quantity})`
      ).join("\n");
      return `${header}🚨 بيع تحت التكلفة — فاتورة #${data.invoiceNo || data.id || "—"}\n` +
        `${list}\n` +
        `إجمالي الخسارة التقديرية: *${formatMoney(data.totalLoss, currency)}*\n` +
        `${data.userName ? `البائع: *${data.userName}*\n` : ""}` +
        `⚠️ راجع السعر فوراً — قد يكون خطأ تسعير أو تلاعب.`;
    }

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

    case EVENT_TYPES.APP_QUIT: {
      const aqF = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}🛑 إغلاق التطبيق\n` +
        `المستخدم: *${data.userName || "غير محدد"}*\n` +
        `السبب: *${data.reason || "إغلاق التطبيق"}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (aqF ? `\n${aqF}` : "");
    }

    case EVENT_TYPES.USER_LOGOUT: {
      const ulF = db ? buildAccumulativeFooter(getDailyPaymentMethodSummary(db, localDate()), currency) : "";
      return `${header}🚪 تسجيل خروج\n` +
        `المستخدم: *${data.userName || "غير محدد"}*\n` +
        `السبب: *${data.reason || "تسجيل خروج"}*\n` +
        `الوقت: ${formatDateTime(data.createdAt)}` +
        (ulF ? `\n${ulF}` : "");
    }

    default: {
      // Reached only if a DB template row is missing for this event (never on a
      // migrated DB — see verify_events). Render the resolved template vars as a
      // readable list instead of a raw JSON dump so the message is still usable.
      const vars = buildTemplateVars(eventType, data, currency);
      const lines = Object.entries(vars)
        .filter(([, v]) => v !== undefined && v !== null && v !== "" && !String(v).includes("\n"))
        .map(([k, v]) => `${k}: ${v}`);
      return `${header}📢 إشعار جديد\n${lines.join("\n") || JSON.stringify(data)}`;
    }
  }
}

async function sendTelegramMessage(botConfig, chatId, text) {
  const token = encodeURIComponent(botConfig.botToken);
  const url = `${botConfig.apiBase.replace(/\/$/, "")}/bot${token}/sendMessage`;
  const post = async (payload) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      const err = new Error(`Telegram API ${response.status}: ${errorText.slice(0, 200)}`);
      err.telegramDescription = errorText;
      throw err;
    }
    return response.json();
  };
  try {
    return await post({ chat_id: chatId, text, parse_mode: "Markdown" });
  } catch (err) {
    // Markdown entity errors (unbalanced _ * ` [ in the text) would otherwise
    // lose the message entirely — deliver it unformatted instead.
    if (String(err.telegramDescription || err.message).includes("can't parse entities")) {
      return post({ chat_id: chatId, text });
    }
    throw err;
  }
}

// Reads the bot's recent updates and pulls the chat id out of the last message,
// so owners don't have to open the getUpdates URL in a browser and read raw
// JSON to find their chat_id.
async function detectChatId(botToken, apiBase = "https://api.telegram.org") {
  const token = encodeURIComponent(botToken);
  const url = `${apiBase.replace(/\/$/, "")}/bot${token}/getUpdates?limit=20`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Telegram API ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  const updates = Array.isArray(data.result) ? data.result : [];
  const chatFromUpdate = (u) =>
    u?.message?.chat
    || u?.edited_message?.chat
    || u?.channel_post?.chat
    || u?.my_chat_member?.chat
    || u?.callback_query?.message?.chat
    || u?.chat_member?.chat;
  const last = [...updates].reverse().find((u) => chatFromUpdate(u));
  const chat = chatFromUpdate(last);
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

function enqueueNotification(db, eventType, chatId, text, payload = {}) {
  try {
    db.prepare(
      `INSERT INTO pending_notifications (event_type, chat_id, text, payload_json, status, next_retry_at)
       VALUES (?, ?, ?, ?, 'pending', datetime('now', '+2 minutes'))`
    ).run(eventType, chatId || null, text, JSON.stringify(payload));
  } catch (err) {
    logger.error({ message: "Failed to enqueue Telegram notification", error: err.message });
  }
}

// Records a successfully delivered message so /api/telegram/history (سجل
// الرسائل) shows real traffic — without this only failures ever appeared.
function logSentNotification(db, eventType, chatId, text) {
  try {
    db.prepare(
      `INSERT INTO pending_notifications (event_type, chat_id, text, payload_json, status, sent_at)
       VALUES (?, ?, ?, '{}', 'sent', datetime('now'))`
    ).run(eventType, chatId || null, text);
  } catch (err) {
    logger.warn({ message: "Failed to log sent Telegram notification", error: err.message });
  }
}

function markSent(db, id) {
  db.prepare(
    "UPDATE pending_notifications SET status='sent', sent_at=datetime('now'), updated_at=datetime('now'), error=NULL WHERE id=?"
  ).run(id);
}

function markFailed(db, id, retryCount, error) {
  // Only mark as "failed" after an absurd number of retries (effectively never
  // for normal offline scenarios). Pending messages must always be retried when
  // internet comes back — even if there are1000+ queued messages.
  const tooOld = retryCount >= MAX_RETRIES;
  const status = tooOld ? "failed" : "pending";
  const backoffMinutes = Math.min(2 ** Math.min(retryCount, 6), 60); // cap at 60 minutes
  db.prepare(
    `UPDATE pending_notifications
     SET status=?, retry_count=?, error=?, updated_at=datetime('now'),
         next_retry_at=datetime('now', '+${backoffMinutes} minutes')
     WHERE id=?`
  ).run(status, retryCount, String(error || "").slice(0, 250), id);
}

// Store-wide switch for the POS status chip (migration 209). Routes forward
// notifyOwner's result to the client, so exposing the flag here gates the chip
// everywhere from a single place. Missing column (un-migrated DB) → shown.
function isStatusChipEnabled(db) {
  try {
    const row = db.prepare("SELECT telegram_status_chip_enabled AS v FROM settings WHERE id = 1").get();
    return row?.v === undefined || row?.v === null ? true : Boolean(row.v);
  } catch (_) {
    return true;
  }
}

async function notifyOwner(eventType, data = {}, dbArg) {
  const db = dbArg || getDb();
  const config = getTelegramConfig(db);
  if (!config || !config.enabled) return { sent: 0, queued: 0, error: null, skipped: true };

  const recipients = getTelegramRecipients(db);

  // Each recipient may have picked a different variant (detailed/brief) for
  // this event — render once per distinct label.
  const presetField = EVENT_PRESET_FIELD[eventType];
  const textCache = new Map();
  const textForRecipient = (recipient) => {
    const label = (presetField && recipient?.eventPresets?.[presetField]) || "";
    if (!textCache.has(label)) {
      textCache.set(label, buildMessage(eventType, data, db, label || null));
    }
    return textCache.get(label);
  };

  let sent = 0;
  let queued = 0;
  let lastError = null;

  // Multi-recipient path.
  if (recipients.length > 0) {
    for (const recipient of recipients) {
      if (!isEventEnabledForRecipient(recipient, eventType)) continue;
      const text = textForRecipient(recipient);
      try {
        await sendTelegramMessage(config, recipient.chatId, text);
        logSentNotification(db, eventType, recipient.chatId, text);
        sent++;
      } catch (err) {
        lastError = err.message;
        logger.warn({ message: "Telegram send failed, enqueueing", eventType, chatId: recipient.chatId, error: err.message });
        enqueueNotification(db, eventType, recipient.chatId, text, data);
        queued++;
      }
    }
    return { sent, queued, error: lastError, showChip: isStatusChipEnabled(db) };
  }
  const text = buildMessage(eventType, data, db);

  // Legacy fallback for un-migrated DBs or single-recipient setups.
  const legacy = getLegacyTelegramConfig(db);
  if (!legacy) return { sent: 0, queued: 0, error: null, skipped: true };
  const legacyEnabled = (() => {
    switch (eventType) {
      case EVENT_TYPES.NEW_INVOICE: return legacy.notifyNewInvoice;
      case EVENT_TYPES.DAILY_CLOSE:
      case EVENT_TYPES.SHIFT_CLOSE: return legacy.notifyDailyClose;
      case EVENT_TYPES.LARGE_INVOICE:
      case EVENT_TYPES.LARGE_DISCOUNT:
      case EVENT_TYPES.BELOW_COST_SALE: return legacy.notifyLargeAmounts;
      case EVENT_TYPES.SALES_RETURN:
      case EVENT_TYPES.INVOICE_VOIDED:
      case EVENT_TYPES.RETURN_PAYMENT: return legacy.notifyReturnsVoids;
      case EVENT_TYPES.PURCHASE_CREATED:
      case EVENT_TYPES.CUSTOMER_PAYMENT: return legacy.notifyPurchasesPayments;
      case EVENT_TYPES.CUSTOMER_CREATED:
      case EVENT_TYPES.SUPPLIER_CREATED:
      case EVENT_TYPES.EXPENSE_CREATED: return legacy.notifyImportantActions;
      case EVENT_TYPES.LOW_STOCK: return legacy.notifyLowStock;
      case EVENT_TYPES.BACKUP_RESULT:
      case EVENT_TYPES.FAILED_LOGIN: return legacy.notifySystem;
      case EVENT_TYPES.TEST: return true;
      default: return legacy.notifyImportantActions;
    }
  })();
  if (!legacyEnabled) return { sent: 0, queued: 0, error: null, skipped: true };
  try {
    await sendTelegramMessage(legacy, legacy.chatId, text);
    logSentNotification(db, eventType, legacy.chatId, text);
    return { sent: 1, queued: 0, error: null, showChip: isStatusChipEnabled(db) };
  } catch (err) {
    logger.warn({ message: "Telegram send failed, enqueueing", eventType, error: err.message });
    enqueueNotification(db, eventType, legacy.chatId, text, data);
    return { sent: 0, queued: 1, error: err.message, showChip: isStatusChipEnabled(db) };
  }
}

function cleanupStaleNotifications(db) {
  try {
    db.prepare(
      `DELETE FROM pending_notifications
       WHERE status = 'pending'
         AND datetime(created_at, '+${MAX_AGE_HOURS} hours') < datetime('now')`
    ).run();
    // Sent/failed rows double as the message history (سجل الرسائل) — keep 30
    // days so the log stays useful without growing forever.
    db.prepare(
      `DELETE FROM pending_notifications
       WHERE status IN ('sent', 'failed')
         AND datetime(created_at, '+30 days') < datetime('now')`
    ).run();
  } catch (_) { }
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
       LIMIT 100`
    ).all();
  } catch (_) {
    return;
  }

  for (const row of rows) {
    const chatId = row.chat_id;
    if (!chatId) {
      // Old row without recipient; cannot retry reliably.
      markFailed(db, row.id, MAX_RETRIES, "Missing recipient chat_id");
      continue;
    }
    try {
      await sendTelegramMessage(config, chatId, row.text);
      markSent(db, row.id);
    } catch (err) {
      const retryCount = (row.retry_count || 0) + 1;
      markFailed(db, row.id, retryCount, err.message);
      logger.warn({ message: "Telegram retry failed", id: row.id, retryCount, error: err.message });
    }
  }
}

let drainerTimer = null;

// Boot-time catch-up: find daily sessions that were closed while the app was
// off and never got their Telegram daily_close notification sent. Runs once on
// startup so the owner always receives the end-of-day report even if the
// desktop app wasn't running at close time.
async function catchUpMissedDailyCloseNotifications(dbArg) {
  const db = dbArg || getDb();
  const config = getTelegramConfig(db);
  if (!config || !config.enabled) return;

  try {
    // Find sessions closed in the last 7 days
    const closedSessions = db.prepare(`
      SELECT * FROM daily_sessions
      WHERE status = 'closed'
        AND closed_at IS NOT NULL
        AND datetime(closed_at) >= datetime('now', '-7 days')
      ORDER BY date ASC
    `).all();

    if (!closedSessions.length) return;

    for (const session of closedSessions) {
      // Check if a daily_close notification was already sent for this date
      const alreadySent = db.prepare(`
        SELECT 1 FROM pending_notifications
        WHERE event_type = 'daily_close' AND status = 'sent'
          AND text LIKE ?
        LIMIT 1
      `).get(`%${session.date}%`);
      if (alreadySent) continue;

      // Also check if one is already queued (pending)
      const alreadyQueued = db.prepare(`
        SELECT 1 FROM pending_notifications
        WHERE event_type = 'daily_close' AND status = 'pending'
          AND text LIKE ?
        LIMIT 1
      `).get(`%${session.date}%`);
      if (alreadyQueued) continue;

      // Build summary and send — same data as closeDailySession
      try {
        const { calculateDailySummary } = require("./dailySessionService");
        const summary = calculateDailySummary(db, session.date);
        if (!summary) continue;

        let paymentMethods = null;
        try { paymentMethods = getDailyPaymentMethodSummary(db, session.date); } catch (_) { }

        await notifyOwner(EVENT_TYPES.DAILY_CLOSE, {
          date: session.date,
          openingBalance: summary.opening_balance || session.opening_balance || 0,
          expectedCash: (paymentMethods?.expected_cash != null ? paymentMethods.expected_cash : summary.expected_cash) || 0,
          actualCash: session.actual_cash,
          discrepancy: session.discrepancy,
          cashSales: summary.pos_cash_sales || 0,
          creditSales: summary.pos_credit_sales || 0,
          installmentCash: summary.pos_installment_cash || 0,
          multiCash: summary.pos_multi_cash || 0,
          bankSales: summary.pos_bank_sales || 0,
          totalSales: summary.pos_all_sales || 0,
          invoicesCount: summary.pos_all_sales_count || 0,
          purchasesCash: summary.purchases_cash || 0,
          purchasesPayable: summary.purchases_payable_total || 0,
          salesReturnsCash: summary.sales_returns_cash || 0,
          salesReturnsAccount: summary.sales_returns_account || 0,
          purchaseReturnsCash: summary.purchase_returns_cash || 0,
          purchaseReturnsAccount: summary.purchase_returns_payable_total || 0,
          expensesCash: summary.expenses_cash || 0,
          expensesCount: summary.expenses_count || 0,
          revenuesCash: summary.revenues_cash || 0,
          revenuesCount: summary.revenues_count || 0,
          customerPayments: summary.customer_payments || 0,
          customerPaymentsCount: summary.customer_payments_count || 0,
          supplierPayments: summary.supplier_payments || 0,
          supplierPaymentsCount: summary.supplier_payments_count || 0,
          withdrawals: summary.withdrawals || 0,
          ajalPayments: summary.ajal_payments || 0,
          cashIn: summary.cash_in || 0,
          cashOut: summary.cash_out || 0,
          nonCashTotal: summary.non_cash_movements_total || 0,
          paymentMethods,
        }, db);
        logger.info({ message: "Catch-up: sent missed daily_close Telegram", date: session.date });
      } catch (err) {
        logger.warn({ message: "Catch-up: daily_close send failed", date: session.date, error: err.message });
      }
    }
  } catch (err) {
    logger.warn({ message: "catchUpMissedDailyCloseNotifications failed", error: err.message });
  }
}

function startTelegramRetryJob() {
  if (drainerTimer) return;
  // Aggressive startup drain: process the queue immediately, then every 10
  // seconds for the first 2 minutes to flush queued messages quickly after
  // reconnecting from extended offline.
  processQueue().catch(() => { });
  // Catch up any daily close notifications that were missed while the app was off
  catchUpMissedDailyCloseNotifications().catch(() => { });
  let rapidDrainCount = 0;
  const rapidDrain = setInterval(() => {
    rapidDrainCount++;
    processQueue().catch(() => { });
    if (rapidDrainCount >= 12) clearInterval(rapidDrain); // stop after ~2 minutes
  }, 10 * 1000);
  drainerTimer = setInterval(() => {
    processQueue().catch(() => { });
  }, RETRY_INTERVAL_MS);
}

module.exports = {
  EVENT_TYPES,
  eventTypeForCategory,
  getTelegramConfig,
  getTelegramRecipients,
  getLegacyTelegramConfig,
  migrateLegacyRecipientIfNeeded,
  isEventEnabledForRecipient,
  isDigestEnabledForRecipient,
  buildMessage,
  translateMethod,
  translateReturnReason,
  resolveTemplateBody,
  sendTelegramMessage,
  detectChatId,
  getBotInfo,
  notifyOwner,
  enqueueNotification,
  logSentNotification,
  processQueue,
  startTelegramRetryJob,
  catchUpMissedDailyCloseNotifications,
  getDailyPaymentMethodSummary,
  buildAccumulativeFooter,
  buildPaymentTypeDisplay,
  localDate,
};
