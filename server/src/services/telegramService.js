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
    const rows = db.prepare("SELECT * FROM telegram_recipients ORDER BY created_at ASC").all();
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
      eventPresets: parseEventPresets(r.event_presets),
    }));
  } catch (err) {
    return [];
  }
}

function parseEventPresets(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function isEventEnabledForRecipient(recipient, eventType) {
  if (!recipient || !recipient.enabled) return false;
  switch (eventType) {
    case EVENT_TYPES.NEW_INVOICE: return recipient.notifyNewInvoice;
    case EVENT_TYPES.DAILY_CLOSE:
    case EVENT_TYPES.SHIFT_CLOSE: return recipient.notifyDailyClose;
    case EVENT_TYPES.LARGE_INVOICE:
    case EVENT_TYPES.LARGE_DISCOUNT: return recipient.notifyLargeAmounts;
    case EVENT_TYPES.SALES_RETURN:
    case EVENT_TYPES.INVOICE_VOIDED:
    case EVENT_TYPES.RETURN_PAYMENT: return recipient.notifyReturnsVoids;
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

function formatQty(qty) {
  const value = Number(qty || 0);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildItemsTable(items, currency) {
  if (!Array.isArray(items) || items.length === 0) return "لا توجد أصناف";
  const rows = items.map((it, i) => {
    const name = it.item_name_ar || it.item_name || it.name || "—";
    const qty = formatQty(it.quantity || it.qty);
    const price = formatMoney(it.unit_price || it.price || 0, currency);
    const total = formatMoney(it.line_total || (it.quantity * it.unit_price) || 0, currency);
    return `${i + 1}. ${name} | الكمية: ${qty} | السعر: ${price} | الإجمالي: ${total}`;
  });
  return rows.join("\n");
}

function buildPaymentBreakdown(payments, currency) {
  if (!Array.isArray(payments) || payments.length === 0) return "—";
  const rows = payments.map((p) => {
    const method = p.method || p.method_name || p.type || "غير محدد";
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
};

function buildTemplateVars(eventType, data, currency) {
  switch (eventType) {
    case EVENT_TYPES.NEW_INVOICE: {
      const items = Array.isArray(data.lines) ? data.lines : Array.isArray(data.items) ? data.items : [];
      const payments = Array.isArray(data.payments) ? data.payments : [];
      const total = Number(data.total || 0);
      const paid = Number(data.paid ?? data.amount_received ?? total);
      const balance = Number(data.balance ?? data.remaining_amount ?? 0);
      return {
        invoice_no: data.invoiceNo || data.id,
        customer_name: data.customerName || data.customer_name || "غير محدد",
        total: formatMoney(total, currency),
        subtotal: formatMoney(data.subtotal || total, currency),
        tax: formatMoney(data.tax || 0, currency),
        discount: formatMoney(data.discount || 0, currency),
        paid: formatMoney(paid, currency),
        balance: formatMoney(balance, currency),
        payment_type: data.paymentType || data.payment_type || "غير محدد",
        created_at: formatDateTime(data.createdAt || data.created_at),
        items_count: items.length,
        items_table: buildItemsTable(items, currency),
        payment_breakdown: buildPaymentBreakdown(payments, currency),
      };
    }
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
    case EVENT_TYPES.RETURN_PAYMENT:
      return {
        customer_name: data.customerName || "غير محدد", amount: formatMoney(data.amount, currency),
        method: data.method || "غير محدد", date: data.date || formatDateTime(data.createdAt),
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
        category: data.category || "غير محدد", amount: formatMoney(data.amount, currency),
        date: data.date || formatDateTime(data.createdAt), notes: data.notes || "—",
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
        item_name: data.itemName || "غير محدد",
        old_qty: data.oldQuantity ?? "—",
        new_qty: data.newQuantity ?? "—",
        reason: data.reason || "غير محدد",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.NEW_PRODUCT:
      return {
        item_name: data.itemName || "غير محدد",
        item_code: data.itemCode || "—",
        price: formatMoney(data.price || 0, currency),
        quantity: data.quantity ?? "—",
        category: data.category || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PRICE_CHANGED:
      return {
        item_name: data.itemName || "غير محدد",
        item_code: data.itemCode || "—",
        old_price: formatMoney(data.oldPrice || 0, currency),
        new_price: formatMoney(data.newPrice || 0, currency),
        change_percent: data.changePercent ?? "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BATCH_EXPIRY_WARNING:
      return {
        item_name: data.itemName || "غير محدد",
        batch_no: data.batchNo || "—",
        expiry_date: data.expiryDate || "—",
        quantity: data.quantity ?? "—",
        warehouse: data.warehouse || "غير محدد",
      };
    case EVENT_TYPES.PHYSICAL_COUNT_CONFIRMED:
      return {
        warehouse: data.warehouse || "غير محدد",
        user_name: data.userName || "غير محدد",
        items_count: data.itemsCount ?? 0,
        matched: data.matched ?? 0,
        discrepancies: data.discrepancies ?? 0,
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SUPPLIER_PAYMENT:
      return {
        supplier_name: data.supplierName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        method: data.method || "غير محدد",
        reference: data.reference || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.DEBT_PAYMENT_RECEIVED:
      return {
        customer_name: data.customerName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        method: data.method || "غير محدد",
        invoice_no: data.invoiceNo || "—",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.INSTALLMENT_PAID:
      return {
        customer_name: data.customerName || "غير محدد",
        amount: formatMoney(data.amount || 0, currency),
        installment_no: data.installmentNo ?? "—",
        total_installments: data.totalInstallments ?? "—",
        method: data.method || "غير محدد",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PURCHASE_VOIDED:
      return {
        invoice_no: data.invoiceNo || data.id || "—",
        supplier_name: data.supplierName || "غير محدد",
        total: formatMoney(data.total || 0, currency),
        reason: data.reason || "غير محدد",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.PURCHASE_RETURN:
      return {
        original_invoice: data.originalInvoice || "—",
        supplier_name: data.supplierName || "غير محدد",
        items_table: buildItemsTable(data.items || [], currency),
        total: formatMoney(data.total || 0, currency),
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.BRANCH_TRANSFER:
      return {
        reference_no: data.referenceNo || "—",
        from_branch: data.fromBranch || "غير محدد",
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
        target_user: data.targetUser || "غير محدد",
        admin_user: data.adminUser || "غير محدد",
        changes: data.changes || "—",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.SUPERVISOR_OVERRIDE:
      return {
        user_name: data.userName || "غير محدد",
        action: data.action || "غير محدد",
        amount: data.amount ? formatMoney(data.amount, currency) : "—",
        reason: data.reason || "—",
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
        method: data.paymentMethod || "نقداً",
        user_name: data.userName || "غير محدد",
        time: formatDateTime(data.createdAt),
      };
    case EVENT_TYPES.WITHDRAWAL_CREATED:
      return {
        doc_no: data.docNo || "—",
        amount: formatMoney(data.amount || 0, currency),
        category: data.category || "غير مصنف",
        note: data.note || "—",
        method: data.paymentMethod || "نقداً",
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

async function sendTelegramMessage(botConfig, chatId, text) {
  const token = encodeURIComponent(botConfig.botToken);
  const url = `${botConfig.apiBase.replace(/\/$/, "")}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
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
  if (!config || !config.enabled) return;

  const recipients = getTelegramRecipients(db);
  const text = buildMessage(eventType, data, db);

  // Multi-recipient path.
  if (recipients.length > 0) {
    for (const recipient of recipients) {
      if (!isEventEnabledForRecipient(recipient, eventType)) continue;
      try {
        await sendTelegramMessage(config, recipient.chatId, text);
      } catch (err) {
        logger.warn({ message: "Telegram send failed, enqueueing", eventType, chatId: recipient.chatId, error: err.message });
        enqueueNotification(db, eventType, recipient.chatId, text, data);
      }
    }
    return;
  }

  // Legacy fallback for un-migrated DBs or single-recipient setups.
  const legacy = getLegacyTelegramConfig(db);
  if (!legacy) return;
  const legacyEnabled = (() => {
    switch (eventType) {
      case EVENT_TYPES.NEW_INVOICE: return legacy.notifyNewInvoice;
      case EVENT_TYPES.DAILY_CLOSE:
      case EVENT_TYPES.SHIFT_CLOSE: return legacy.notifyDailyClose;
      case EVENT_TYPES.LARGE_INVOICE:
      case EVENT_TYPES.LARGE_DISCOUNT: return legacy.notifyLargeAmounts;
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
  if (!legacyEnabled) return;
  try {
    await sendTelegramMessage(legacy, legacy.chatId, text);
  } catch (err) {
    logger.warn({ message: "Telegram send failed, enqueueing", eventType, error: err.message });
    enqueueNotification(db, eventType, legacy.chatId, text, data);
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
  getTelegramRecipients,
  getLegacyTelegramConfig,
  isEventEnabledForRecipient,
  isDigestEnabledForRecipient,
  buildMessage,
  sendTelegramMessage,
  detectChatId,
  getBotInfo,
  notifyOwner,
  enqueueNotification,
  processQueue,
  startTelegramRetryJob,
};
