# Plan: Telegram Accumulative Daily Summary + Enhanced Daily Close + Quit/Logout Triggers

## Requirements Summary

1. **Daily Smart Global Accumulative System**: Every invoice-related Telegram message (new, edited, voided, return, purchase, expense, revenue, withdrawal, payment) must include a second section at the bottom showing the day's running totals by payment method — full IN/OUT breakdown per method.

2. **Detailed payment display on ALL types**: Every invoice message must show the payment type WITH the amount, not just the method name. Applies to ALL payment types (cash, credit, multi, installments, bank_transfer, card, etc.) and ALL invoice message types (new, edited, voided, amended, returns, purchases):
   - `cash` → `طريقة الدفع: نقداً — 1,000 ج`
   - `credit` → `طريقة الدفع: آجل — 3,000 ج`
   - `multi` → full breakdown: `دفع متعدد` + sub-methods list with amounts
   - `installments` → `الأقساط — 2,000 ج`
   - `bank_transfer` → `تحويل بنكي — 1,500 ج`
   - `card` → `بطاقة — 800 ج`

3. **Enhanced Daily Close (إغلاق اليومية)**: The DAILY_CLOSE message must include full breakdown — expenses, revenues, withdrawals, purchases, returns, per-payment-method totals, invoice counts, and the expected/actual/discrepancy. Must match `/daily-treasury` exactly.

4. **Logout/App Quit Triggers**: Always fire a Telegram notification on logout and app quit with trigger reason visible in the message.

5. **Consistency**: End-of-day Telegram totals must match `/daily-treasury` numbers.

---

## Files to Modify

### 1. `server/src/services/telegramService.js` (main changes)
### 2. `server/src/services/dailySessionService.js` (enhanced DAILY_CLOSE data)
### 3. `server/src/routes/auth.routes.js` (logout trigger)
### 4. `electron/main.js` (app quit trigger)
### 5. `electron/migrations/212_telegram_accumulative_and_quit_events.js` (new event columns)

---

## Task 1: Daily Accumulative Summary System

### 1a. New function `getDailyPaymentMethodSummary(db, date)`

Query ALL payment sources for the day and aggregate by payment method (including cash as a virtual method). Returns:

```js
{
  cash: { in: 5000, out: 1200, net: 3800 },
  credit: { in: 0, out: 0, net: 0 },  // credit = آجل invoices
  bank: { in: 2000, out: 0, net: 2000 },  // bank_transfer + card
  methods: [
    { name: "فودافون كاش", in: 100, out: 0, net: 100 },
    { name: "مدى", in: 500, out: 50, net: 450 },
  ],
  expected_cash: 3800,
  opening_balance: prevBalance,
}
```

Logic reuses the same SQL patterns from `cashBreakdown()` and the `/today/payment-methods` endpoint:
- **Cash IN**: posCashSales + posInstallmentCash + posMultiCash + customerCashCollections + revenuesCash + purchaseReturnsCash + supplierRefundPayments
- **Cash OUT**: expensesCash + supplierCashPayments + salesReturnsCash + withdrawals + purchasesCash + customerRefundPayments
- **Credit**: posCreditSales ( invoices with payment_type IN ('installments','credit'))
- **Bank/Card**: posBankSales (invoices with payment_type IN ('bank_transfer','card','bank'))
- **Per-method**: Same 6-source aggregation as the payment-methods endpoint (payments, ajal_payments, expenses, revenues, purchase_payments, withdrawals)

### 1b. New function `buildAccumulativeFooter(data, currency)`

Formats the summary section for Telegram:

```
━━━━━━━━━━━━━━━━━━━━
📊 ملخص اليوم حتى الآن:
💵 الصندوق: +5,000 / -1,200 = 3,800
🏦 بنكي/تحويل: +2,000
💳 بطاقات: +500
📋 آجل: +3,000
📱 فودافون كاش: +100 / -50 = 50
📱 مدى: +500
━━━━━━━━━━━━━━━━━━━━
💰 الرصيد المتوقع: 9,450
```

Only shows methods with non-zero activity. Cash always shown first.

### 1c. New function `buildAccumulativeFooterVars(data, currency)`

Returns template variables for DB templates:

```js
{
  daily_accumulative_footer: "━━━━━━━━━━━━━━\n📊 ملخص اليوم...",
  daily_cash_in: "5,000",
  daily_cash_out: "1,200",
  daily_cash_net: "3,800",
  daily_expected_cash: "3,800",
  daily_methods_summary: "📱 فودافون: 50\n📱 مدى: 500",
}
```

### 1d. Modify `buildMessage()` — all financial event cases

After the main message body, append the accumulative footer:

```js
case EVENT_TYPES.NEW_INVOICE: {
  const main = `🧾 فاتورة جديدة\n...`;
  const footer = db ? buildAccumulativeFooter(
    getDailyPaymentMethodSummary(db, localDate()), currency
  ) : "";
  return header + main + footer;
}
```

Apply to these event types:
- `NEW_INVOICE`, `INVOICE_EDITED`, `INVOICE_VOIDED`, `INVOICE_AMENDED`
- `SALES_RETURN`, `SALES_RETURN_EDITED`, `SALES_RETURN_CANCELLED`, `RETURN_PAYMENT`
- `PURCHASE_CREATED`, `PURCHASE_EDITED`, `PURCHASE_VOIDED`
- `PURCHASE_RETURN`, `PURCHASE_RETURN_EDITED`, `PURCHASE_RETURN_CANCELLED`
- `EXPENSE_CREATED`, `EXPENSE_EDITED`, `EXPENSE_DELETED`
- `REVENUE_CREATED`, `REVENUE_EDITED`, `REVENUE_DELETED`
- `WITHDRAWAL_CREATED`, `WITHDRAWAL_EDITED`, `WITHDRAWAL_DELETED`
- `CUSTOMER_PAYMENT`, `SUPPLIER_PAYMENT`, `DEBT_PAYMENT_RECEIVED`, `INSTALLMENT_PAID`

### 1e. Modify `buildTemplateVars()` — add accumulative vars to all financial events

Add `daily_accumulative_footer`, `daily_cash_in`, `daily_cash_out`, `daily_cash_net`, `daily_expected_cash`, `daily_methods_summary` to every financial event's template vars.

---

## Task 2: Detailed Payment Display on ALL Types

### 2a. New function `buildPaymentTypeDisplay(paymentType, payments, invoiceTotal, currency)`

Shows the payment method WITH the amount for ALL types:

```js
function buildPaymentTypeDisplay(paymentType, payments, invoiceTotal, currency) {
  const type = String(paymentType || '').toLowerCase();
  
  // Multi-payment: show full breakdown
  if (type === 'multi' || type === 'split') {
    const method = translateMethod(paymentType);
    if (!Array.isArray(payments) || payments.length === 0) return method;
    const lines = payments.map(p => {
      const name = translateMethod(p.method || p.method_name || p.type || 'other');
      const amt = formatMoney(p.amount, currency);
      return `  • ${name}: ${amt}`;
    });
    return `${method}\n${lines.join('\n')}`;
  }
  
  // Installments: show method + total
  if (type === 'installments') {
    return `${translateMethod(paymentType)} — ${formatMoney(invoiceTotal, currency)}`;
  }
  
  // ALL other types: method + total amount
  return `${translateMethod(paymentType)} — ${formatMoney(invoiceTotal, currency)}`;
}
```

Examples:
- `cash` → `نقداً — 1,000 ج`
- `credit` → `آجل — 3,000 ج`
- `bank_transfer` → `تحويل بنكي — 1,500 ج`
- `card` → `بطاقة — 800 ج`
- `installments` → `أقساط — 2,000 ج`
- `multi` → `دفع متعدد\n  • نقداً: 500 ج\n  • فيزا: 200 ج\n  • فودافون كاش: 100 ج`

### 2b. Modify `buildTemplateVars()` for NEW_INVOICE

Replace:
```js
payment_type: translateMethod(data.paymentType || data.payment_type),
```

With:
```js
payment_type: buildPaymentTypeDisplay(
  data.paymentType || data.payment_type,
  data.payments || [],
  data.total || 0,
  currency
),
```

### 2c. Modify hardcoded fallback for NEW_INVOICE

Same change in `buildMessage()` NEW_INVOICE case.

### 2d. Apply to ALL invoice message types

Replace `translateMethod()` with `buildPaymentTypeDisplay()` wherever payment type is shown:

| Event Type | Current | New |
|---|---|---|
| `NEW_INVOICE` | `translateMethod(data.paymentType)` | `buildPaymentTypeDisplay(type, payments, total, currency)` |
| `INVOICE_EDITED` | `oldPaymentType/newPaymentType` | Both old and new get the display treatment |
| `INVOICE_VOIDED` | No payment type shown | Add payment type display if available |
| `SALES_RETURN` | `translateMethod(data.refundMethod)` | `buildPaymentTypeDisplay(refundMethod, [], total, currency)` |
| `PURCHASE_CREATED` | No payment detail | Add `buildPaymentTypeDisplay(data.paymentMethod, [], total, currency)` |
| `PURCHASE_EDITED` | `translateMethod(oldPaymentMethod)` | Both old and new |
| `CUSTOMER_PAYMENT` | `translateMethod(data.method)` | `buildPaymentTypeDisplay(method, [], amount, currency)` |
| `SUPPLIER_PAYMENT` | `translateMethod(data.method)` | `buildPaymentTypeDisplay(method, [], amount, currency)` |
| `RETURN_PAYMENT` | `translateMethod(data.method)` | `buildPaymentTypeDisplay(method, [], amount, currency)` |

For `INVOICE_EDITED` specifically, the before/after comparison:
```
◀️ قبل: العميل أحمد — 2,000 ج | نقداً — 2,000 ج
▶️ بعد: العميل أحمد — 1,500 ج | آجل — 1,500 ج
```

---

## Task 3: Enhanced Daily Close (إغلاق اليومية)

### 3a. Modify `closeDailySession()` in `dailySessionService.js`

Pass the FULL summary data to the Telegram notification:

```js
notifyOwner(TG.DAILY_CLOSE, {
  date,
  openingBalance: summary.opening_balance || session.opening_balance || 0,
  expectedCash: summary.expected_cash || 0,
  actualCash: actual,
  discrepancy,
  // Existing
  cashSales: summary.pos_cash_sales || 0,
  creditSales: summary.pos_credit_sales || 0,
  invoicesCount: summary.pos_all_sales_count || 0,
  // NEW — full breakdown
  installmentCash: summary.pos_installment_cash || 0,
  multiCash: summary.pos_multi_cash || 0,
  bankSales: summary.pos_bank_sales || 0,
  totalSales: summary.pos_all_sales || 0,
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
  // Per-method summary
  paymentMethods: getDailyPaymentMethodSummary(db, date),
}, db);
```

### 3b. Enhance DAILY_CLOSE template vars in `telegramService.js`

Add all new variables to `buildTemplateVars()` case DAILY_CLOSE:

```js
case EVENT_TYPES.DAILY_CLOSE:
  return {
    date: data.date,
    opening_balance: formatMoney(data.openingBalance, currency),
    // Sales breakdown
    cash_sales: formatMoney(data.cashSales, currency),
    credit_sales: formatMoney(data.creditSales, currency),
    installment_cash: formatMoney(data.installmentCash, currency),
    multi_cash: formatMoney(data.multiCash, currency),
    bank_sales: formatMoney(data.bankSales, currency),
    total_sales: formatMoney(data.totalSales, currency),
    invoices_count: data.invoicesCount || 0,
    // Purchases
    purchases_cash: formatMoney(data.purchasesCash, currency),
    purchases_payable: formatMoney(data.purchasesPayable, currency),
    // Returns
    sales_returns_cash: formatMoney(data.salesReturnsCash, currency),
    sales_returns_account: formatMoney(data.salesReturnsAccount, currency),
    purchase_returns_cash: formatMoney(data.purchaseReturnsCash, currency),
    purchase_returns_account: formatMoney(data.purchaseReturnsAccount, currency),
    // Expenses & Revenues
    expenses_cash: formatMoney(data.expensesCash, currency),
    expenses_count: data.expensesCount || 0,
    revenues_cash: formatMoney(data.revenuesCash, currency),
    revenues_count: data.revenuesCount || 0,
    // Payments
    customer_payments: formatMoney(data.customerPayments, currency),
    customer_payments_count: data.customerPaymentsCount || 0,
    supplier_payments: formatMoney(data.supplierPayments, currency),
    supplier_payments_count: data.supplierPaymentsCount || 0,
    withdrawals: formatMoney(data.withdrawals, currency),
    ajal_payments: formatMoney(data.ajalPayments, currency),
    // Totals
    cash_in: formatMoney(data.cashIn, currency),
    cash_out: formatMoney(data.cashOut, currency),
    non_cash_total: formatMoney(data.nonCashTotal, currency),
    // Cash equation
    expected_cash: formatMoney(data.expectedCash, currency),
    actual_cash: formatMoney(data.actualCash, currency),
    discrepancy: formatMoney(data.discrepancy, currency),
    // Per-method
    payment_methods_summary: buildAccumulativeFooter(data.paymentMethods, currency),
  };
```

### 3c. Enhance hardcoded DAILY_CLOSE fallback message

Replace the simple 7-line message with the full breakdown:

```js
case EVENT_TYPES.DAILY_CLOSE: {
  const o = (v) => formatMoney(v, currency);
  return `${header}📅 إغلاق يومية — ${data.date}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 الرصيد الافتتاحي: *${o(data.openingBalance)}*\n` +
    `━━━━ 📥 المبيعات ━━━━\n` +
    `🧾 نقدية: *${o(data.cashSales)}*\n` +
    `📋 آجلة: *${o(data.creditSales)}*\n` +
    `🔄 أقساط: *${o(data.installmentCash)}*\n` +
    `🔀 متعدد: *${o(data.multiCash)}*\n` +
    `🏦 بنكي/بطاقة: *${o(data.bankSales)}*\n` +
    `📊 الإجمالي: *${o(data.totalSales)}* (${data.invoicesCount || 0} فاتورة)\n` +
    `━━━━ 📦 المشتريات ━━━━\n` +
    `💵 نقدية: *${o(data.purchasesCash)}*\n` +
    `📋 آجلة: *${o(data.purchasesPayable)}*\n` +
    `━━━━ ↩️ المرتجعات ━━━━\n` +
    `↩️ مبيعات (نقدي): *${o(data.salesReturnsCash)}*\n` +
    `↩️ مبيعات (آجل): *${o(data.salesReturnsAccount)}*\n` +
    `↩️ مشتريات (نقدي): *${o(data.purchaseReturnsCash)}*\n` +
    `↩️ مشتريات (آجل): *${o(data.purchaseReturnsAccount)}*\n` +
    `━━━━ 💸 المصروفات ━━━━\n` +
    `💸 مصروفات: *${o(data.expensesCash)}* (${data.expensesCount || 0})\n` +
    `💰 إيرادات: *${o(data.revenuesCash)}* (${data.revenuesCount || 0})\n` +
    `🏧 سحوبات: *${o(data.withdrawals)}*\n` +
    `━━━━ 💳 الدفعات ━━━━\n` +
    `💰 تحصيل عملاء: *${o(data.customerPayments)}* (${data.customerPaymentsCount || 0})\n` +
    `💰 دفع موردين: *${o(data.supplierPayments)}* (${data.supplierPaymentsCount || 0})\n` +
    `📋 تحصيل آجل: *${o(data.ajalPayments)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📥 الوارد: *${o(data.cashIn)}*\n` +
    `📤 الصادر: *${o(data.cashOut)}*\n` +
    `💰 الرصيد المتوقع: *${o(data.expectedCash)}*\n` +
    `💵 الرصيد الفعلي: *${o(data.actualCash)}*\n` +
    `⚖️ الفرق: *${o(data.discrepancy)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${data.nonCashTotal ? `📊 حركات غير نقدية: *${o(data.nonCashTotal)}*\n` : ''}` +
    (data.paymentMethods ? buildAccumulativeFooter(data.paymentMethods, currency) : '');
}
```

### 3d. Update catch-up mechanism

Update `catchUpMissedDailyCloseNotifications()` to pass the full data set.

---

## Task 4: Logout + App Quit Triggers

### 4a. New EVENT_TYPES in `telegramService.js`

```js
APP_QUIT: "app_quit",
USER_LOGOUT: "user_logout",
```

### 4b. New EVENT_CATEGORY mappings

```js
[EVENT_TYPES.APP_QUIT]: "telegram_app_quit",
[EVENT_TYPES.USER_LOGOUT]: "telegram_user_logout",
```

### 4c. New EVENT_PRESET_FIELD mappings

```js
[EVENT_TYPES.APP_QUIT]: "notifySystem",
[EVENT_TYPES.USER_LOGOUT]: "notifySystem",
```

### 4d. Template vars

```js
case EVENT_TYPES.APP_QUIT:
  return {
    user_name: data.userName || "غير محدد",
    trigger_reason: data.reason || "إغلاق التطبيق",
    time: formatDateTime(data.createdAt),
    uptime: data.uptime || "—",
  };
case EVENT_TYPES.USER_LOGOUT:
  return {
    user_name: data.userName || "غير محدد",
    trigger_reason: data.reason || "تسجيل خروج",
    time: formatDateTime(data.createdAt),
    session_duration: data.sessionDuration || "—",
  };
```

### 4e. Hardcoded fallback messages

```js
case EVENT_TYPES.APP_QUIT:
  return `${header}🛑 إغلاق التطبيق\n` +
    `المستخدم: *${data.userName || "غير محدد"}*\n` +
    `السبب: *${data.reason || "إغلاق التطبيق"}*\n` +
    `الوقت: ${formatDateTime(data.createdAt)}`;

case EVENT_TYPES.USER_LOGOUT:
  return `${header}🚪 تسجيل خروج\n` +
    `المستخدم: *${data.userName || "غير محدد"}*\n` +
    `السبب: *${data.reason || "تسجيل خروج"}*\n` +
    `الوقت: ${formatDateTime(data.createdAt)}`;
```

### 4f. Add `POST /logout` route in `auth.routes.js`

```js
router.post("/logout", authRequired, (req, res) => {
  try {
    const userRow = getDb().prepare(
      "SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?"
    ).get(req.user.id);
    notifyOwner(TG.USER_LOGOUT, {
      userName: userRow?.name || req.user?.username || `#${req.user?.id}`,
      reason: req.body?.reason || "تسجيل خروج",
      createdAt: new Date().toISOString(),
    });
  } catch (_) {}
  res.json({ success: true });
});
```

### 4g. Add quit notification in `electron/main.js`

In the `before-quit` handler, BEFORE `closeDb()`:

```js
try {
  const { getDb } = require("../server/src/config/database");
  const { notifyOwner, EVENT_TYPES } = require("../server/src/services/telegramService");
  const db = getDb();
  if (db) {
    // Send synchronously — we're about to quit
    notifyOwner(EVENT_TYPES.APP_QUIT, {
      reason: app.isQuittingForUpdate ? "تحديث التطبيق" : "إغلاق التطبيق",
      createdAt: new Date().toISOString(),
    }, db);
  }
} catch (_) {}
```

### 4h. Support `isEventEnabledForRecipient()` for new events

Add the new event types to the recipient toggle checks. Map `APP_QUIT` and `USER_LOGOUT` to the `notifySystem` toggle (same as BACKUP_RESULT, FAILED_LOGIN).

---

## Task 5: Migration `212_telegram_accumulative_and_quit_events.js`

```js
function up(db) {
  // Add columns for new event types to telegram_recipients
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map(c => c.name);
  
  if (!cols.includes("notify_app_quit")) {
    db.exec(`ALTER TABLE telegram_recipients ADD COLUMN notify_app_quit INTEGER NOT NULL DEFAULT 1`);
  }
  if (!cols.includes("notify_user_logout")) {
    db.exec(`ALTER TABLE telegram_recipients ADD COLUMN notify_user_logout INTEGER NOT NULL DEFAULT 1`);
  }
}
module.exports = { up, name: "212_telegram_accumulative_and_quit_events" };
```

---

## Task 6: Update `isEventEnabledForRecipient()` for new events

Add mapping for `APP_QUIT` and `USER_LOGOUT` to check the appropriate recipient toggle column (or fall back to `notifySystem`).

---

## Verification

1. Create an invoice → message should show payment detail (multi breakdown) + accumulative footer
2. Edit the invoice → message should show old/new + updated accumulative
3. Void the invoice → message should show void + updated accumulative
4. Create a purchase → message should show accumulative
5. Create expense/revenue/withdrawal → message should show accumulative
6. Close daily → message should show full breakdown matching `/daily-treasury`
7. Logout → Telegram message with user name and reason
8. Quit app → Telegram message with reason
9. Compare last accumulative footer with `/daily-treasury` values → must match

Run: `npm test --prefix server` after changes.
