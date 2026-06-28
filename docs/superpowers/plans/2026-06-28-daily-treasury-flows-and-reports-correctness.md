# Daily Treasury — Correctness, Flows-Log Rebuild & Reports Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Daily-Treasury cash/wallet movement aggregation exclude cancelled & amended invoices, wire the payment-method card into the existing highlight system, replace the flat transaction tabs with a reconciling running-balance cash-flow ledger, and make invoice-touching reports handle edit/delete consistently.

**Architecture:** Soft-delete stays (invoices go `status='cancelled'`, amendments set `amended_by` and cancel the original; payment rows are never deleted). Fix is to add a uniform invoice-status guard to every query that sums `payments`/`purchase_payments`/invoice-derived figures. A new server endpoint produces a single, time-ordered, cancellation-correct ledger with a server-computed running balance that reconciles to the treasury equation. The client ledger and the payment-method card reuse the page's existing `activeEquationRowId` / `txAffects` highlight state.

**Tech Stack:** Express + better-sqlite3 (synchronous), Jest + supertest (backend tests), React 18 + Vite + framer-motion + lucide-react (client), TailwindCSS RTL, i18next.

## Global Constraints

- **Synchronous DB only** — better-sqlite3; never `async/await`/`.then()` for DB calls in server code.
- **Two DB files** — dev server uses `server/data/retailer.db`; inspect that one for schema, load via `npx electron -e "..."` (better-sqlite3 is built against Electron's Node).
- **All new UI text** added to BOTH `client/src/locales/ar.json` and `client/src/locales/en.json`.
- **Theme tokens only** — use `--danger`/`--warning`/`--success`/`--text`/`--bg` CSS vars, never raw Tailwind color literals for new semantic UI. (Existing emerald/rose equation styling may be matched for visual consistency where it already exists.)
- **RTL-first** — use Tailwind `rtl:`/`ltr:` variants; the page root is `dir="rtl"`.
- **Centralized API client** — client calls go through `client/src/services/api.js`, not bare `fetch`.
- **Branch** — work happens on `daily-treasury-flows-correctness` (already created).
- **Run backend tests with:** `npm test --prefix server`.

---

## File Structure

**Backend**
- `server/src/routes/dailySessions.routes.js` — MODIFY: fix `/today/payment-methods` cancellation guards (Task 1); ADD new `/:date/cashflow` endpoint (Task 2).
- `server/src/services/dailySessionService.js` — MODIFY only if Task 1's audit finds an unguarded source (Task 1 step 6).
- `server/tests/dailyTreasury.test.js` — MODIFY: add cancellation-exclusion + cashflow tests (Tasks 1, 2).
- `server/src/reports/queries/*.js` — MODIFY: apply uniform cancellation guard to invoice-touching queries (Tasks 6–7).
- `server/tests/reportsCancellation.test.js` — CREATE: per-report regression tests (Task 7).

**Frontend** (`client/src/pages/pos/DailyTreasuryPage.jsx`, single large existing file — follow its existing structure, do not restructure)
- MODIFY `getEquationRowAffects` + add method buckets + wire the payment-method card to the highlight state (Task 3).
- ADD a `CashflowLedger` section that consumes `/:date/cashflow`, replacing the `TABS` transaction explorer block (Tasks 4–5).
- `client/src/locales/ar.json`, `en.json` — MODIFY: new ledger/filter/badge strings (Task 4).

---

## Phase 1 — Backend correctness

### Task 1: Exclude cancelled/amended invoices from `/today/payment-methods`

**Files:**
- Modify: `server/src/routes/dailySessions.routes.js:118-198` (the `payments`, `ajal_payments`, `purchase_payments` aggregations)
- Test: `server/tests/dailyTreasury.test.js` (append a new `describe` block)

**Interfaces:**
- Consumes: existing `GET /api/daily-sessions/today/payment-methods?date=` → `{ success, data: [{ id, name, in, out, net }] }`.
- Produces: same shape; `in`/`out` now exclude payments tied to cancelled invoices / voided purchases.

- [ ] **Step 1: Write the failing test**

Append to `server/tests/dailyTreasury.test.js`:

```javascript
// ==================== CANCELLATION EXCLUSION TESTS ====================
describe("Payment-method movements exclude cancelled invoices", function () {
  it("drops a wallet movement when its invoice is voided", async function () {
    // A non-system, active wallet method whose name we will store on the payment row.
    db.exec(`INSERT OR IGNORE INTO payment_methods (id, name, type, is_system, is_active)
             VALUES (5, 'محفظة فودافون', 'wallet', 0, 1)`);

    // Create a real invoice via the API so void() has a valid target.
    const inv = await request(app).post("/api/invoices").send({
      customer_id: null,
      lines: [{ item_id: itemId1, quantity: 1, unit_price: 100, warehouse_id: 1 }],
      payment_type: "cash",
      treasury_id: treasuryId,
    });
    const invoiceId = inv.body.data.id;

    // Attach a wallet payment row to that invoice (matched by method NAME in the endpoint).
    db.prepare(`INSERT INTO payments (party_type, party_id, amount, method, invoice_id, created_at)
                VALUES ('customer', ?, 300, 'محفظة فودافون', ?, datetime('now'))`)
      .run(customerId, invoiceId);

    const before = await request(app).get("/api/daily-sessions/today/payment-methods");
    const mBefore = (before.body.data || []).find((m) => m.id === 5);
    expect(mBefore).toBeDefined();
    expect(mBefore.in).toBe(300);

    // Void the invoice (soft: sets status='cancelled').
    const voided = await request(app).post(`/api/invoices/${invoiceId}/void`).send({ reason: "test" });
    expect(voided.status).toBe(200);

    const after = await request(app).get("/api/daily-sessions/today/payment-methods");
    const mAfter = (after.body.data || []).find((m) => m.id === 5);
    expect(mAfter.in).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix server -- dailyTreasury -t "drops a wallet movement"`
Expected: FAIL — `mAfter.in` is `300` (the voided invoice's wallet payment is still counted).

- [ ] **Step 3: Apply the cancellation guards**

In `server/src/routes/dailySessions.routes.js`, replace the three invoice/purchase-linked aggregations.

`payments` block (currently ~line 131):

```javascript
    // payments: matched by method name. Supplier-side = out, everything else = in.
    // Exclude payments tied to a cancelled invoice (standalone payments have invoice_id NULL → kept).
    db.prepare(`
      SELECT p.method,
        SUM(CASE WHEN p.party_type = 'supplier' THEN 0 ELSE p.amount END) AS in_amt,
        SUM(CASE WHEN p.party_type = 'supplier' THEN p.amount ELSE 0 END) AS out_amt
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      WHERE p.method IS NOT NULL AND date(p.created_at) = ?
        AND COALESCE(i.status, '') != 'cancelled'
      GROUP BY p.method
    `).all(targetDate).forEach((r) => {
      const id = byName[r.method];
      if (id != null) { agg[id].in += Number(r.in_amt || 0); agg[id].out += Number(r.out_amt || 0); }
    });
```

`purchase_payments` block (currently ~line 180):

```javascript
    // purchase payments: matched by FK → always out. Exclude voided/cancelled purchases.
    db.prepare(`
      SELECT pp.method_id AS mid, SUM(pp.amount) AS out_amt
      FROM purchase_payments pp
      LEFT JOIN purchases pu ON pu.id = pp.purchase_id
      WHERE pp.method_id IS NOT NULL AND date(pp.created_at) = ?
        AND COALESCE(pu.status, '') NOT IN ('voided', 'cancelled')
      GROUP BY pp.method_id
    `).all(targetDate).forEach((r) => {
      if (agg[r.mid]) agg[r.mid].out += Number(r.out_amt || 0);
    });
```

`ajal_payments` block (currently ~line 144): keep as-is for now, but add the guard ONLY if the audit in Step 6 confirms debts are voided on invoice cancellation. Leave a code comment marking the decision:

```javascript
    // ajal_payments: settle debts, not invoices directly. Verified (Task 1 Step 6): debts are
    // NOT auto-voided on invoice cancellation, so no invoice-status guard is applied here.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix server -- dailyTreasury -t "drops a wallet movement"`
Expected: PASS.

- [ ] **Step 5: Run the full treasury suite (no regressions)**

Run: `npm test --prefix server -- dailyTreasury`
Expected: all green.

- [ ] **Step 6: Audit the remaining money sources and document findings**

Inspect, in `server/src/services/dailySessionService.js` and the `/today/transactions` union in `dailySessions.routes.js`, every aggregation that reads `payments`/`payment_allocations`/`purchase_payments`. For each, confirm a `status != 'cancelled'` (or `NOT IN ('voided','cancelled')`) guard exists. Run this to check whether cancelling an invoice voids its ajal debt:

Run: `npx electron -e "const d=require('better-sqlite3')('server/data/retailer.db'); console.log(d.prepare(\"SELECT sql FROM sqlite_master WHERE name='ajal_debts'\").get());"`

Record findings as a comment block at the top of the modified `/today/payment-methods` handler (which sources are guarded, which are intentionally not, and why). If any unguarded invoice-derived source is found in the summary service, add a guard + a test mirroring Step 1 before committing.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/dailySessions.routes.js server/tests/dailyTreasury.test.js server/src/services/dailySessionService.js
git commit -m "fix(treasury): exclude cancelled invoices from payment-method movements

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: New `/:date/cashflow` running-balance ledger endpoint

**Files:**
- Modify: `server/src/routes/dailySessions.routes.js` (add route near the other `/today/...` routes; reuse the existing `unionParts` builder and `normalizeDate`/`localDate` helpers)
- Test: `server/tests/dailyTreasury.test.js` (append a new `describe` block)

**Interfaces:**
- Consumes: the existing per-type union SQL already defined in `unionParts` (Task uses the same cancellation-correct sources).
- Produces: `GET /api/daily-sessions/:date/cashflow` →
  ```
  { success, data: {
      opening_balance: number,
      expected_cash: number,
      rows: [{
        id, doc_type, doc_no, party, created_at,
        direction: 'in'|'out'|'non_cash',
        amount,                 // signed cash effect; for non_cash this is the movement total
        cash_effect,            // signed, 0 for non_cash
        running_balance,        // cumulative opening + Σ cash_effect, only for cash rows
        bucket_id,              // equation/method bucket id (string)
        flags: string[]         // e.g. ['amended','large']
      }],
      closing_balance: number,  // opening + Σ cash_effect
      reconciles: boolean       // |closing_balance - expected_cash| < 0.01
  } }
  ```

- [ ] **Step 1: Write the failing test**

Append to `server/tests/dailyTreasury.test.js`:

```javascript
// ==================== CASHFLOW LEDGER TESTS ====================
describe("Cashflow ledger endpoint", function () {
  it("returns time-ordered rows whose closing balance reconciles to expected cash", async function () {
    const summaryRes = await request(app).get("/api/daily-sessions/today/summary");
    const expected = summaryRes.body.data.expected_cash;

    const res = await request(app).get(`/api/daily-sessions/${today}/cashflow`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(Array.isArray(d.rows)).toBe(true);

    // running_balance accumulates cash_effect from opening_balance, in created_at order.
    const cashRows = d.rows.filter((r) => r.direction !== "non_cash");
    let bal = d.opening_balance;
    for (const r of cashRows) {
      bal += r.cash_effect;
      expect(Math.abs(r.running_balance - bal)).toBeLessThan(0.01);
    }
    expect(Math.abs(d.closing_balance - expected)).toBeLessThan(0.01);
    expect(d.reconciles).toBe(true);
  });

  it("excludes a voided invoice from the ledger", async function () {
    const inv = await request(app).post("/api/invoices").send({
      customer_id: null,
      lines: [{ item_id: itemId1, quantity: 1, unit_price: 100, warehouse_id: 1 }],
      payment_type: "cash",
      treasury_id: treasuryId,
    });
    const invoiceId = inv.body.data.id;
    const docNo = inv.body.data.invoice_no;

    const withInv = await request(app).get(`/api/daily-sessions/${today}/cashflow`);
    expect((withInv.body.data.rows || []).some((r) => r.doc_no === docNo)).toBe(true);

    await request(app).post(`/api/invoices/${invoiceId}/void`).send({ reason: "test" });

    const afterVoid = await request(app).get(`/api/daily-sessions/${today}/cashflow`);
    expect((afterVoid.body.data.rows || []).some((r) => r.doc_no === docNo)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix server -- dailyTreasury -t "Cashflow ledger"`
Expected: FAIL — 404 / `res.body.data` undefined (route does not exist).

- [ ] **Step 3: Implement the endpoint**

Add to `server/src/routes/dailySessions.routes.js` (place after the `/today/transactions` handler so `unionParts` patterns are nearby; build the union from the same cancellation-correct subqueries). Use the existing `getSummary`/`getDailyBreakdown` export from `dailySessionService` for `opening_balance` and `expected_cash` — confirm the exact exported function name and reuse it rather than re-deriving:

```javascript
/** Unified, cancellation-correct, time-ordered cash-flow ledger with running balance. */
router.get("/:date/cashflow", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const targetDate = normalizeDate(req.params.date || localDate());

    // Reuse the summary service so opening/expected match the equation exactly.
    const { getSummary } = require("../services/dailySessionService");
    const summary = getSummary(targetDate);
    const openingBalance = Number(summary.previous_balance ?? summary.opening_balance ?? 0);
    const expectedCash = Number(summary.expected_cash ?? 0);

    // Build the same per-type union used by /today/transactions, with empty search,
    // selecting only the columns the ledger needs. buildUnionSql() must be the shared
    // helper that assembles unionParts (extract it in Task 2 Step 3a if it is inlined today).
    const { sql, params } = buildCashflowUnion(targetDate);
    const raw = db.prepare(sql).all(...params);

    const LARGE = 5000; // anomaly threshold (EGP); tune later if needed
    const rows = raw
      .map((t) => {
        const cashEffect = Number(t.cash_effect ?? 0);
        const direction = cashEffect > 0 ? "in" : cashEffect < 0 ? "out" : "non_cash";
        const flags = [];
        if (t.amended_by || t.amendment_of) flags.push("amended");
        if (Math.abs(Number(t.amount ?? 0)) >= LARGE) flags.push("large");
        return {
          id: t.id,
          doc_type: t.doc_type,
          doc_no: t.doc_no,
          party: t.party,
          created_at: t.created_at,
          direction,
          amount: cashEffect !== 0 ? cashEffect : Number(t.amount ?? 0),
          cash_effect: cashEffect,
          bucket_id: bucketIdFor(t), // mirrors client getEquationRowAffects ids
          flags,
        };
      })
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    let bal = openingBalance;
    for (const r of rows) {
      if (r.direction !== "non_cash") { bal += r.cash_effect; r.running_balance = bal; }
      else r.running_balance = bal;
    }
    const closingBalance = bal;

    res.json({
      success: true,
      data: {
        opening_balance: openingBalance,
        expected_cash: expectedCash,
        rows,
        closing_balance: closingBalance,
        reconciles: Math.abs(closingBalance - expectedCash) < 0.01,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
```

- [ ] **Step 3a: Extract the shared union + add helpers**

In the same file, factor the `unionParts` assembly used by `/today/transactions` into a reusable `buildCashflowUnion(targetDate)` that returns `{ sql, params }` for ALL types unioned together (search param empty, `show_cancelled = 0`). Add `bucketIdFor(tx)` that returns the same bucket id strings the client's `getEquationRowAffects` produces (`pos_cash_sales`, `expenses_cash`, `customer_collections`, `non_cash_movements`, etc.) so forward/reverse highlighting lines up. Keep `/today/transactions` working by having it call the shared builder.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix server -- dailyTreasury -t "Cashflow ledger"`
Expected: PASS (both cases).

- [ ] **Step 5: Run the full treasury suite**

Run: `npm test --prefix server -- dailyTreasury`
Expected: all green (confirms `/today/transactions` still works after the extraction).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/dailySessions.routes.js server/tests/dailyTreasury.test.js
git commit -m "feat(treasury): add /:date/cashflow running-balance ledger endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Frontend (highlight wiring + ledger UI)

> Frontend has no component-unit harness in this repo; verify these tasks with `npm run build` (type/JSX sanity) and manual checks via `npm run dev`. Follow the existing patterns in `DailyTreasuryPage.jsx`.

### Task 3: Wire the "حركة الوسائل اليوم" card into the highlight system

**Files:**
- Modify: `client/src/pages/pos/DailyTreasuryPage.jsx` — `getEquationRowAffects` (lines 72-138), the method-card render (lines 1620-1666), `handleEquationRowClick`/`handleTransactionClick` (lines 883-898).

**Interfaces:**
- Consumes: `methodTotals` state (`[{ id, name, in, out, net }]`), `activeEquationRowId`, `txAffects`.
- Produces: method buckets identified as `method_<id>_in` / `method_<id>_out`; `getEquationRowAffects` now also returns these for non-cash transactions.

- [ ] **Step 1: Extend `getEquationRowAffects` for method buckets**

In the `pos_invoice` multi/non-cash branches and any `account`-direction transaction, additionally push a method-bucket affect when the payment method can be resolved. Add, before `return affects;` in `getEquationRowAffects`:

```javascript
  // Method-card buckets: map non-cash splits to their payment-method in/out bucket.
  // Requires methodNameToId passed in via closure (see Step 2). Non-cash → 'in' for
  // customer-side, 'out' for supplier-side doc types.
  const supplierSide = ["supplier_payment", "purchase", "purchase_return"].includes(tx.doc_type);
  const dir = supplierSide ? "out" : "in";
  if (tx.payment_splits) {
    tx.payment_splits.split("|||").forEach((s) => {
      const i = s.lastIndexOf(":");
      const method = s.slice(0, i);
      const amt = Number(s.slice(i + 1));
      if (method !== "cash" && method !== "credit" && amt > 0) {
        const mid = tx.__methodNameToId?.[method];
        if (mid != null) affects.push({ id: `method_${mid}_${dir}`, amount: amt });
      }
    });
  }
```

(If splits are absent but the transaction is fully non-cash, resolve the single method via `tx.payment_method` the same way.)

- [ ] **Step 2: Provide method-name→id lookup to the affect computation**

Add a `useMemo` after `methodTotals` is defined:

```javascript
  const methodNameToId = useMemo(() => {
    const map = {};
    methodTotals.forEach((m) => { map[m.name] = m.id; });
    return map;
  }, [methodTotals]);
```

In `handleTransactionClick`, pass it through:

```javascript
  function handleTransactionClick(tx) {
    const affects = getEquationRowAffects({ ...tx, __methodNameToId: methodNameToId });
    setActiveEquationRowId(null);
    setTxAffects(affects.length > 0 ? affects : null);
    if (affects.length > 0) {
      setTimeout(() => equationRowRefs.current[affects[0].id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }
```

- [ ] **Step 3: Make the method in/out chips clickable + highlightable**

In the method-card map (lines ~1648-1661), register refs and react to `txAffects`. Replace the two inner chips with buttons that call a new `handleMethodBucketClick(m.id, 'in'|'out')` and show the amber affect badge:

```javascript
  function handleMethodBucketClick(methodId, dir) {
    const id = `method_${methodId}_${dir}`;
    setActiveTab("all");
    setGlobalAmountSearch("");
    setActiveEquationRowId(id);
    setTxAffects(null);
    setTimeout(() => txSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
```

For each chip, compute `const affect = txAffects?.find(a => a.id === \`method_${m.id}_in\`)` (and `_out`), register `ref={el => { equationRowRefs.current[\`method_${m.id}_in\`] = el; }}`, apply the same `ring-2`/amber-badge treatment used by equation rows when `activeEquationRowId === id || affect`.

- [ ] **Step 4: Filter the ledger when a method bucket is active**

Ensure the new ledger (Task 4) honors `activeEquationRowId` values of the form `method_<id>_<dir>` by filtering rows whose `bucket_id === activeEquationRowId`. (The equation rows already filter by `matchTx`; method buckets filter by exact `bucket_id`.)

- [ ] **Step 5: Build + manual verify**

Run: `npm run build`
Expected: build succeeds, no JSX/lint errors.

Manual (`npm run dev`): click a method's "داخل" chip → ledger scrolls and filters to that method's inflows; click a non-cash transaction → its method chip highlights with the amber "← هذه الحركة" badge. Confirm Escape and outside-click clear the highlight (existing handlers).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/DailyTreasuryPage.jsx
git commit -m "feat(treasury): wire payment-method card into the double-way highlight system

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Cashflow ledger UI — running balance + reconciliation badge

**Files:**
- Modify: `client/src/pages/pos/DailyTreasuryPage.jsx` — add a `loadCashflow` loader + state, render a ledger block replacing the `TABS` explorer (lines ~1696-end of that section).
- Modify: `client/src/locales/ar.json`, `client/src/locales/en.json` — ledger strings.

**Interfaces:**
- Consumes: `GET /api/daily-sessions/:date/cashflow` (Task 2 shape).
- Produces: in-page ledger; uses existing `slideOver` drill-in and `PrintPreviewModal`.

- [ ] **Step 1: Add loader + state**

```javascript
  const [cashflow, setCashflow] = useState(null);
  const [cashflowLoading, setCashflowLoading] = useState(false);

  const loadCashflow = useCallback(async () => {
    setCashflowLoading(true);
    try {
      const d = isToday ? todayStr() : date;
      const r = await api.get(`/api/daily-sessions/${d}/cashflow`);
      setCashflow(r.data.data);
    } catch { setCashflow(null); }
    finally { setCashflowLoading(false); }
  }, [date, isToday]);

  useEffect(() => { loadCashflow(); }, [loadCashflow]);
```

Call `loadCashflow()` inside `refreshAfterFinanceModal`, `handleQuickSave`, `handleWithdrawalSave`, and after void/reopen so the ledger refreshes with the equation.

- [ ] **Step 2: Render the ledger table with running balance**

Replace the transaction-explorer card body with a table: synthetic opening-balance first row (`الرصيد الافتتاحي` → `cashflow.opening_balance`), one row per `cashflow.rows` item (time, type+`doc_no`+party, داخل = green amount when `direction==='in'`, خارج = rose amount when `direction==='out'`, non-cash dimmed with a "لا يؤثر على الخزنة" chip, and `running_balance`), and a closing summary row. Apply `bucket_id`-based dimming when `activeEquationRowId`/`txAffects` is set (rows not matching are `opacity-40`), mirroring the equation-row pattern.

- [ ] **Step 3: Reconciliation badge**

Above the table, render a badge: when `cashflow.reconciles` → success token "مطابق للمعادلة"; else danger token `فرق ${fmt(cashflow.closing_balance - cashflow.expected_cash)} ج.م`. Use theme tokens (`--success`/`--danger`), not raw colors.

- [ ] **Step 4: Add locale strings**

Add to both `ar.json` and `en.json` (e.g. `treasury.ledger.title`, `opening`, `closing`, `inCol`, `outCol`, `balanceCol`, `reconciled`, `offBy`, `noFlow`). Use them in the JSX.

- [ ] **Step 5: Build + manual verify**

Run: `npm run build`
Expected: success.

Manual (`npm run dev`): ledger shows opening→rows→closing; running balance increments/decrements correctly; closing equals the equation's "المتوقع" and the badge is green. Record a cash expense → ledger appends a row and balance drops; badge stays green.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/DailyTreasuryPage.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(treasury): running-balance cashflow ledger with reconciliation badge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Ledger smart filters, per-row preview, export/print & anomaly flags

**Files:**
- Modify: `client/src/pages/pos/DailyTreasuryPage.jsx`
- Modify: `client/src/locales/ar.json`, `en.json`

**Interfaces:**
- Consumes: `cashflow.rows` (each row has `direction`, `doc_type`, `flags`, `bucket_id`).
- Produces: client-side filtered view; print payload for `PrintPreviewModal`.

- [ ] **Step 1: Filter state + derived rows**

```javascript
  const [ledgerFilters, setLedgerFilters] = useState({ direction: "all", method: "all", docType: "all", min: "", max: "", cashOnly: false });

  const ledgerRows = useMemo(() => {
    let rows = cashflow?.rows || [];
    const f = ledgerFilters;
    if (f.cashOnly) rows = rows.filter((r) => r.direction !== "non_cash");
    if (f.direction !== "all") rows = rows.filter((r) => r.direction === f.direction);
    if (f.docType !== "all") rows = rows.filter((r) => r.doc_type === f.docType);
    if (f.min !== "") rows = rows.filter((r) => Math.abs(r.amount) >= Number(f.min));
    if (f.max !== "") rows = rows.filter((r) => Math.abs(r.amount) <= Number(f.max));
    if (activeEquationRowId) rows = rows.filter((r) => r.bucket_id === activeEquationRowId);
    return rows;
  }, [cashflow, ledgerFilters, activeEquationRowId]);
```

`running_balance` shown is always the server value (true cumulative state); filtered-out rows are hidden but the displayed balance column is dimmed with a tooltip "الرصيد التراكمي محسوب على كل الحركات" so a filtered view is never mistaken for a re-based balance.

- [ ] **Step 2: Filter bar UI** — direction segmented control, method `<select>` (from `methodTotals`), doc-type `<select>` (from `TABS`/`DOC_TYPE_LABEL`), min/max number inputs, "نقدي فقط" toggle. Use existing input styling on the page.

- [ ] **Step 3: Per-row double-entry preview** — clicking a row opens the existing `slideOver` (set `setSlideOver(row)`), and shows the `bucket_id` mapped to its Arabic label (reuse `allEquationRows.find(r => r.id === bucket_id)?.label`, plus method-bucket labels). On hover/click also set `txAffects` via `handleTransactionClick(row)` so the equation/method bucket highlights.

- [ ] **Step 4: Anomaly flags** — for rows with `flags.includes('amended')`/`'large'`/`'deleted_source'`, render small chips (warning token) with tooltips. `'cancelled'` only appears if a "show cancelled" toggle is on.

- [ ] **Step 5: Export/print** — add a print button that opens `PrintPreviewModal` with the ledger (date, opening, rows, closing, reconciliation). Follow the existing `printOpen`/`handlePrint` pattern already in the file.

- [ ] **Step 6: Locale strings** for all new labels in `ar.json` + `en.json`.

- [ ] **Step 7: Build + manual verify**

Run: `npm run build`
Expected: success.

Manual: each filter narrows rows; "نقدي فقط" hides non-cash; clicking a row opens drill-in and highlights its bucket; print preview renders; an amended invoice shows the "amended" chip.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/pos/DailyTreasuryPage.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(treasury): ledger filters, per-row preview, export/print, anomaly flags

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Reports edit/delete audit

### Task 6: Discovery — enumerate invoice-touching report queries & their guards

**Files:**
- Create: `docs/superpowers/notes/2026-06-28-reports-cancellation-audit.md` (findings table)

- [ ] **Step 1: Enumerate** every query in `server/src/reports/queries/*.js` that reads `invoices`, `invoice_items`, `payments`, `payment_allocations`, or `sales_returns`. For each, record file, report id (from `reportsCenterConfig`/registry), and whether it filters `status='cancelled'` and handles amendment chains.

Run: `grep -rnE "FROM invoices|JOIN invoices|FROM payments|invoice_items|sales_returns" server/src/reports/queries/`

- [ ] **Step 2: Classify** each as OK / MISSING-cancel-guard / MISSING-amend-handling / intentional-include (e.g. void/audit reports). Prioritize the zero-handling modules: `revenues.js`, `expenses.js`, `employees.js`, `warehouses.js`. Write the table to the notes file.

- [ ] **Step 3: Commit the audit note**

```bash
git add docs/superpowers/notes/2026-06-28-reports-cancellation-audit.md
git commit -m "docs(reports): cancellation/amendment handling audit findings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: Fix invoice-touching reports + regression tests

**Files:**
- Modify: each report query flagged MISSING in Task 6 (e.g. `server/src/reports/queries/employees.js`, `warehouses.js`, and any sales-derived figure in `revenues.js`/`expenses.js`)
- Create: `server/tests/reportsCancellation.test.js`

**Interfaces:**
- Consumes: report runner (mirror how `dailyTreasury.test.js` / existing report tests invoke `/api/reports/...`; confirm the exact route from `report.routes.js`).
- Produces: each fixed report excludes cancelled + amended-away invoices.

- [ ] **Step 1: Write a failing regression test** (one per flagged report). Pattern, per report:

```javascript
it("<report> excludes a voided invoice", async function () {
  const before = await runReport(/* report id + params */);
  const inv = await request(app).post("/api/invoices").send({ /* a sale the report counts */ });
  const mid = await runReport(/* same */);
  expect(/* figure */ mid).toBeGreaterThan(/* before */); // it counted
  await request(app).post(`/api/invoices/${inv.body.data.id}/void`).send({ reason: "test" });
  const after = await runReport(/* same */);
  expect(/* figure */ after).toBe(/* before */); // excluded again
});
```

Implement `runReport()` helper using the real reports endpoint (confirm path in `server/src/routes/report.routes.js`).

- [ ] **Step 2: Run to verify it fails** — `npm test --prefix server -- reportsCancellation`. Expected: FAIL (cancelled invoice still counted).

- [ ] **Step 3: Apply the guard** to each flagged query — add `AND COALESCE(i.status,'') != 'cancelled'` (or the table's status column) to the WHERE clause; for amendment-aware reports ensure only the live version is counted (the amended original is already `cancelled`, so the same guard usually suffices — verify per report).

- [ ] **Step 4: Run to verify pass** — `npm test --prefix server -- reportsCancellation`. Expected: PASS.

- [ ] **Step 5: Run the full server suite** — `npm test --prefix server`. Expected: green.

- [ ] **Step 6: Commit**

```bash
git add server/src/reports/queries/ server/tests/reportsCancellation.test.js
git commit -m "fix(reports): exclude cancelled/amended invoices from report figures

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Part 1 (payment-methods deleted-invoice bug) → Task 1. ✓
- Part 1 audit of summary/transactions sources → Task 1 Step 6. ✓
- Part 2 (double-way highlight on method card) → Task 3. ✓
- Part 3 (running-balance ledger, reconciliation, filters, per-row preview, export/print, anomaly flags, correct doc_no) → Tasks 2, 4, 5. ✓ (`doc_no` is an explicit ledger field, Task 2 interface.)
- Part 4 (reports edit/delete audit) → Tasks 6, 7. ✓

**Open items to resolve during execution (flagged, not placeholders):**
- Exact exported summary function name in `dailySessionService` (Task 2 Step 3 says confirm `getSummary` and reuse).
- Whether `/today/transactions` already extracts a union builder or it must be factored out (Task 2 Step 3a).
- ajal_debts cascade decision (Task 1 Step 6 — concrete check command given).
- Reports endpoint path for `runReport()` (Task 7 Step 1 — confirm in `report.routes.js`).

**Type consistency:** bucket id strings (`method_<id>_<dir>`, and the equation ids `pos_cash_sales`/`expenses_cash`/etc.) are used identically in `getEquationRowAffects` (client), `bucketIdFor` (server, Task 2), and the ledger filter (Task 5). `cashflow` response fields used in Tasks 4–5 match the Task 2 interface block.
