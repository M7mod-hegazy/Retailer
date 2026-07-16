# Fix: Payment Direction Bug (رد دفعة / استرداد دفعة)

## Root Cause
The `payments` table has NO `direction` column. All read queries hardcode direction from `party_type`:
- Customer payments → always treated as cash IN / debt decrease
- Supplier payments → always treated as cash OUT / debt decrease

This means `رد دفعة` (customer refund, direction=add) is misread as cash IN, and `استرداد دفعة` (supplier refund, direction=add) is misread as cash OUT.

## Backfill Strategy
All existing payments default to `direction='subtract'` (matches historical display). Only new payments will be correctly distinguished.

## Treasury Gate Plan
Add new dedicated rows:
- `customer_refund_payments` → الخارج النقدي: "رد دفعات للعملاء"
- `supplier_refund_payments` → الداخل النقدي: "استرداد دفعات من الموردين"

---

## Checklist

### Phase 1: Database Migration + Write Path
- [x] 1.1 Create migration `211_add_payment_direction.js` — add `direction TEXT NOT NULL DEFAULT 'subtract'` column to `payments` table
- [x] 1.2 Update `server/src/routes/payments.routes.js` INSERT to persist `direction` from payload

### Phase 2: Account Statement Queries (running balance fix)
- [x] 2.1 Fix `server/src/reports/queries/accounts.js` customer statement — use `CASE WHEN p.direction='add' THEN p.amount ELSE -p.amount END`
- [x] 2.2 Fix `server/src/reports/queries/accounts.js` supplier statement — same CASE

### Phase 3: Party Balance Service (import reconciliation)
- [x] 3.1 Fix `server/src/services/partyBalanceService.js` supplier payments — use direction CASE
- [x] 3.2 Fix `server/src/services/partyBalanceService.js` customer payments — use direction CASE

### Phase 4: Daily Session Service (treasury calculation engine)
- [x] 4.1 Fix `dailySessionService.js` cashBreakdown() customerPayments — split by direction
- [x] 4.2 Fix `dailySessionService.js` cashBreakdown() supplierPayments — split by direction
- [x] 4.3 Fix `dailySessionService.js` cashBreakdown() cashIn/cashOut aggregation
- [x] 4.4 Fix `dailySessionService.js` liveOpeningBalance() customerPayments
- [x] 4.5 Fix `dailySessionService.js` liveOpeningBalance() supplierPayments
- [x] 4.6 Fix `dailySessionService.js` batchLiveOpeningBalances() customerPayments
- [x] 4.7 Fix `dailySessionService.js` batchLiveOpeningBalances() supplierPayments

### Phase 5: Daily Sessions Routes (treasury transaction display)
- [x] 5.1 Fix `dailySessions.routes.js` buildUnionParts() customer_payments cash_effect — use direction CASE
- [x] 5.2 Fix `dailySessions.routes.js` buildUnionParts() supplier_payments cash_effect — use direction CASE
- [x] 5.3 Fix `dailySessions.routes.js` payment-methods endpoint — use direction CASE
- [x] 5.4 Fix `dailySessions.routes.js` bucketIdFor() — add `customer_refund_payments` / `supplier_refund_payments` buckets

### Phase 6: Payment Flow Service
- [x] 6.1 Fix `paymentFlowService.js` standalonePayments direction — use direction CASE

### Phase 7: Client-side Movements Tab
- [x] 7.1 Fix `CustomerAccountsPage.jsx` impactDir for payments — use `p.direction || 'subtract'`
- [x] 7.2 Fix `SupplierAccountsPage.jsx` impactDir for payments — use `p.direction || 'subtract'`

### Phase 8: Client-side Treasury Page
- [x] 8.1 Add `customer_refund_payments` row to cashOutRows in `DailyTreasuryPage.jsx`
- [x] 8.2 Add `supplier_refund_payments` row to cashInRows in `DailyTreasuryPage.jsx`
- [x] 8.3 Fix `getEquationRowAffects()` — map customer_payment with negative ce to new bucket
- [x] 8.4 Fix `getEquationRowAffects()` — map supplier_payment with positive ce to new bucket

### Phase 9: Translations
- [x] 9.1 Treasury labels are hardcoded Arabic in JSX (not i18n keys) — no changes needed

### Phase 10: Verify
- [x] 10.1 All server files parse correctly (node -e require)
- [x] 10.2 All client JSX files have balanced braces
