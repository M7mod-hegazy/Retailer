# Edge-Case Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast-check stateful property-testing engine that generates random sequences of real POS actions and verifies money/stock/loyalty invariants after every step, shrinking any failure to its minimal reproducer.

**Architecture:** A "model vs. reality" checker. fast-check generates a random sequence of `Command` objects. Each command runs against the real Express app via supertest (temp SQLite DB), updates a naive parallel JS model, and asserts per-command expectations. After the whole sequence, invariants compare real DB state (read via in-process `getDb()`) against the model. On mismatch, fast-check shrinks to the minimal failing command list and prints the seed.

**Tech Stack:** Jest, supertest, fast-check, better-sqlite3 (synchronous), Express (`createApp`).

**Known contracts (verified against the codebase):**
- Bootstrap: `setDb(null); initDb(path); const app = createApp();` — from `server/src/config/database.js` (`initDb`, `setDb`, `getDb`) and `server/src/app.js` (`createApp`).
- Dev auth: JWT signed `{ sub: "__dev__" }` with `process.env.JWT_SECRET || "test-secret"` → `req.user.role === "dev"` (bypasses permissions, see `server/src/middleware/auth.js:24`).
- Create customer: `POST /api/customers` body `{ name, phone, code, opening_balance, credit_limit }` → `201 { data: { id, ... } }` (`customers.routes.js:63`).
- Create invoice (sale): `POST /api/invoices` body `{ lines: [{ item_id, quantity, unit_price }], discount, payment_type, customer_id, supervisor_override }` → returns `{ id, total, ... }`. `payment_type: "cash"` (paid) or `"credit"` (unpaid → adds to customer balance). (`invoices.routes.js:379`, `invoiceService.createInvoice`).
- Create payment: `POST /api/payments` body `{ party_type: "customer", party_id, amount, method, treasury_id }` → auto-allocates to oldest unpaid invoices (`payments.routes.js:70`).
- Read invoice: `GET /api/invoices/:id` → `{ data: invoice }` (`invoices.routes.js:356`).
- Seed data needed before sales: a unit, an item_category, a default warehouse, an item, and a stock_levels row (see `server/tests/invoiceService.test.js` beforeEach).

---

## File Structure

```
server/tests/edge/
  helpers.js        # bootstrap app+temp DB, seed base data, sign token, read DB
  model.js          # naive parallel truth-model (pure functions)
  invariants.js     # universal laws checked against real DB vs model
  commands/
    customers.js    # CreateCustomer command
    sales.js        # SaleCredit + SaleCash commands
    payments.js     # Payment command
  engine.test.js    # fast-check runner (entry point)
server/package.json # add fast-check dep + test:edge script
```

---

## Task 0: Add dependency and script

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install fast-check as a dev dependency**

Run: `cd server && npm install --save-dev fast-check`
Expected: `fast-check` appears under `devDependencies` in `server/package.json`.

- [ ] **Step 2: Add the `test:edge` script**

In `server/package.json`, in the `"scripts"` block, add after the existing `"test"` line:

```json
"test:edge": "jest --runInBand tests/edge",
```

- [ ] **Step 3: Verify jest finds no tests yet but runs**

Run: `cd server && npx jest --runInBand tests/edge --passWithNoTests`
Expected: exits 0 with "No tests found" / pass-with-no-tests message.

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore: add fast-check and test:edge script for edge engine"
```

---

## Task 1: Bootstrap helper

**Files:**
- Create: `server/tests/edge/helpers.js`
- Test: `server/tests/edge/helpers.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/edge/helpers.test.js
const { freshWorld } = require("./helpers");

describe("edge helpers", () => {
  test("freshWorld boots an app with seeded base data and a usable token", async () => {
    const world = freshWorld();
    expect(world.token).toEqual(expect.any(String));

    // base seed exists: one default warehouse + one item with stock
    const wh = world.db.prepare("SELECT COUNT(*) AS n FROM warehouses").get();
    expect(wh.n).toBeGreaterThanOrEqual(1);
    const item = world.db.prepare("SELECT COUNT(*) AS n FROM items").get();
    expect(item.n).toBeGreaterThanOrEqual(1);

    // app responds
    const request = require("supertest");
    const res = await request(world.app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${world.token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest --runInBand tests/edge/helpers.test.js`
Expected: FAIL — `Cannot find module './helpers'`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/tests/edge/helpers.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../../src/app");
const { initDb, setDb, getDb } = require("../../src/config/database");

// Boot a brand-new isolated app + temp SQLite DB, seed the minimum data
// every sale needs, and return handles for driving and inspecting it.
function freshWorld() {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-edge-"));
  initDb(path.join(dir, "edge.db"));
  const db = getDb();

  // Base catalog seed (mirrors server/tests/invoiceService.test.js).
  db.prepare("INSERT INTO units (name) VALUES ('pcs')").run();
  db.prepare("INSERT INTO item_categories (name) VALUES ('cat')").run();
  db.prepare("INSERT INTO warehouses (name, is_default) VALUES ('Main', 1)").run();
  db.prepare(
    "INSERT INTO items (name, barcode, category_id, unit_id) VALUES ('EdgeItem', 'edge-001', 1, 1)",
  ).run();
  db.prepare(
    "INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 1, 1000000)",
  ).run();

  const app = createApp();
  const token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");

  return { app, db, token, dir, itemId: 1, warehouseId: 1 };
}

module.exports = { freshWorld };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest --runInBand tests/edge/helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/tests/edge/helpers.js server/tests/edge/helpers.test.js
git commit -m "test(edge): add freshWorld bootstrap helper"
```

---

## Task 2: The naive model

**Files:**
- Create: `server/tests/edge/model.js`
- Test: `server/tests/edge/model.test.js`

The model is a plain object that re-derives expected truth with deliberately simple math.
It is NOT the production logic — it is the independent second opinion.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/edge/model.test.js
const { newModel, addCustomer, applyCreditSale, applyPayment } = require("./model");

describe("edge model", () => {
  test("customer balance follows credit sales and payments", () => {
    const m = newModel();
    addCustomer(m, { id: 1, openingBalance: 100 });
    expect(m.customers[1].balance).toBe(100);

    applyCreditSale(m, { customerId: 1, total: 250 });
    expect(m.customers[1].balance).toBe(350);

    applyPayment(m, { customerId: 1, amount: 90 });
    expect(m.customers[1].balance).toBe(260);
  });

  test("cash sale does not change customer balance", () => {
    const m = newModel();
    addCustomer(m, { id: 1, openingBalance: 0 });
    // cash sales are tracked separately; no applyCreditSale call
    expect(m.customers[1].balance).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest --runInBand tests/edge/model.test.js`
Expected: FAIL — `Cannot find module './model'`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/tests/edge/model.js
// Naive parallel truth-model. Pure functions, no DB access.
function newModel() {
  return { customers: {} };
}

function addCustomer(m, { id, openingBalance }) {
  m.customers[id] = { id, balance: Number(openingBalance || 0) };
}

// Credit sale increases what the customer owes.
function applyCreditSale(m, { customerId, total }) {
  m.customers[customerId].balance += Number(total || 0);
}

// Payment reduces what the customer owes.
function applyPayment(m, { customerId, amount }) {
  m.customers[customerId].balance -= Number(amount || 0);
}

module.exports = { newModel, addCustomer, applyCreditSale, applyPayment };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest --runInBand tests/edge/model.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/tests/edge/model.js server/tests/edge/model.test.js
git commit -m "test(edge): add naive customer-balance model"
```

---

## Task 3: Customer-balance invariant

**Files:**
- Create: `server/tests/edge/invariants.js`
- Test: `server/tests/edge/invariants.test.js`

The invariant reads the REAL DB and asserts the real customer balance equals the model's.
Real balance = `opening_balance + sum(credit invoice totals) − sum(payments)` for that customer.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/edge/invariants.test.js
const { freshWorld } = require("./helpers");
const { newModel, addCustomer, applyCreditSale } = require("./model");
const { checkInvariants, realCustomerBalance } = require("./invariants");

describe("edge invariants", () => {
  test("realCustomerBalance reads opening balance from DB", () => {
    const world = freshWorld();
    world.db
      .prepare("INSERT INTO customers (name, opening_balance) VALUES ('C', 75)")
      .run();
    expect(realCustomerBalance(world.db, 1)).toBe(75);
  });

  test("checkInvariants throws when model and DB disagree", () => {
    const world = freshWorld();
    world.db
      .prepare("INSERT INTO customers (name, opening_balance) VALUES ('C', 0)")
      .run();
    const m = newModel();
    addCustomer(m, { id: 1, openingBalance: 0 });
    // Lie to the model: claim a 50 credit sale that never hit the DB.
    applyCreditSale(m, { customerId: 1, total: 50 });
    expect(() => checkInvariants(world.db, m)).toThrow(/balance mismatch/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest --runInBand tests/edge/invariants.test.js`
Expected: FAIL — `Cannot find module './invariants'`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/tests/edge/invariants.js
// Universal laws checked against the real DB after a sequence runs.

// Real balance = opening + unpaid credit (sum of credit invoice totals) - payments received.
function realCustomerBalance(db, customerId) {
  const opening = Number(
    db.prepare("SELECT opening_balance AS v FROM customers WHERE id = ?").get(customerId)?.v || 0,
  );
  const creditTotal = Number(
    db
      .prepare(
        "SELECT COALESCE(SUM(total), 0) AS v FROM invoices WHERE customer_id = ? AND payment_type = 'credit'",
      )
      .get(customerId)?.v || 0,
  );
  const paid = Number(
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE party_type = 'customer' AND party_id = ?",
      )
      .get(customerId)?.v || 0,
  );
  return round2(opening + creditTotal - paid);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

// Compare every modelled customer against the real DB.
function checkInvariants(db, model) {
  for (const id of Object.keys(model.customers)) {
    const expected = round2(model.customers[id].balance);
    const actual = realCustomerBalance(db, Number(id));
    if (expected !== actual) {
      throw new Error(
        `INVARIANT: customer ${id} balance mismatch — model=${expected} db=${actual}`,
      );
    }
  }
}

module.exports = { checkInvariants, realCustomerBalance, round2 };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest --runInBand tests/edge/invariants.test.js`
Expected: PASS (both: the read returns 75, and the mismatch throws).

- [ ] **Step 5: Commit**

```bash
git add server/tests/edge/invariants.js server/tests/edge/invariants.test.js
git commit -m "test(edge): add customer-balance invariant"
```

---

## Task 4: Commands — CreateCustomer, SaleCredit, SaleCash, Payment

**Files:**
- Create: `server/tests/edge/commands/customers.js`
- Create: `server/tests/edge/commands/sales.js`
- Create: `server/tests/edge/commands/payments.js`
- Test: `server/tests/edge/commands/commands.test.js`

Each command implements fast-check's `Command` interface: `check(model)` (is it applicable?),
`run(model, real)` (call real API, update model, assert), and `toString()` (for the reproducer).
`real` is the `freshWorld()` object plus a `request` supertest agent.

- [ ] **Step 1: Write the failing test (drives one of each command directly)**

```js
// server/tests/edge/commands/commands.test.js
const request = require("supertest");
const { freshWorld } = require("../helpers");
const { newModel } = require("../model");
const { checkInvariants } = require("../invariants");
const { CreateCustomer } = require("./customers");
const { SaleCredit, SaleCash } = require("./sales");
const { Payment } = require("./payments");

function realFrom(world) {
  return { ...world, http: request(world.app) };
}

describe("edge commands", () => {
  test("a hand-built sequence keeps invariants intact", async () => {
    const world = freshWorld();
    const real = realFrom(world);
    const model = newModel();

    await new CreateCustomer({ openingBalance: 100 }).run(model, real);
    await new SaleCredit({ quantity: 2, unitPrice: 50 }).run(model, real); // +100 credit
    await new SaleCash({ quantity: 1, unitPrice: 30 }).run(model, real);   // no balance change
    await new Payment({ amount: 40 }).run(model, real);                    // -40

    // expected model balance: 100 + 100 - 40 = 160
    expect(model.customers[1].balance).toBe(160);
    expect(() => checkInvariants(world.db, model)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest --runInBand tests/edge/commands/commands.test.js`
Expected: FAIL — `Cannot find module './customers'`.

- [ ] **Step 3a: Implement CreateCustomer**

```js
// server/tests/edge/commands/customers.js
const { addCustomer } = require("../model");

let seq = 0;

class CreateCustomer {
  constructor({ openingBalance }) {
    this.openingBalance = Number(openingBalance || 0);
  }
  check() {
    return true; // always allowed
  }
  async run(model, real) {
    seq += 1;
    const res = await real.http
      .post("/api/customers")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        name: `EdgeCust-${seq}`,
        code: `EDGE-${seq}`,
        opening_balance: this.openingBalance,
        credit_limit: 1_000_000,
      });
    if (res.status !== 201) {
      throw new Error(`CreateCustomer failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const id = res.body.data.id;
    addCustomer(model, { id, openingBalance: this.openingBalance });
    model.lastCustomerId = id;
  }
  toString() {
    return `CreateCustomer(opening=${this.openingBalance})`;
  }
}

module.exports = { CreateCustomer };
```

- [ ] **Step 3b: Implement SaleCredit + SaleCash**

```js
// server/tests/edge/commands/sales.js
const { applyCreditSale } = require("../model");

// Both sale commands need an existing customer.
function hasCustomer(model) {
  return Boolean(model.lastCustomerId);
}

class SaleCredit {
  constructor({ quantity, unitPrice }) {
    this.quantity = Number(quantity);
    this.unitPrice = Number(unitPrice);
  }
  check(model) {
    return hasCustomer(model);
  }
  async run(model, real) {
    const customerId = model.lastCustomerId;
    const res = await real.http
      .post("/api/invoices")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        customer_id: customerId,
        payment_type: "credit",
        discount: 0,
        lines: [{ item_id: real.itemId, quantity: this.quantity, unit_price: this.unitPrice }],
      });
    if (!res.body?.id && !res.body?.data?.id) {
      throw new Error(`SaleCredit failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const total = Number((res.body.data || res.body).total);
    applyCreditSale(model, { customerId, total });
  }
  toString() {
    return `SaleCredit(qty=${this.quantity}, price=${this.unitPrice})`;
  }
}

class SaleCash {
  constructor({ quantity, unitPrice }) {
    this.quantity = Number(quantity);
    this.unitPrice = Number(unitPrice);
  }
  check(model) {
    return hasCustomer(model);
  }
  async run(model, real) {
    const customerId = model.lastCustomerId;
    const res = await real.http
      .post("/api/invoices")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        customer_id: customerId,
        payment_type: "cash",
        discount: 0,
        lines: [{ item_id: real.itemId, quantity: this.quantity, unit_price: this.unitPrice }],
      });
    if (!res.body?.id && !res.body?.data?.id) {
      throw new Error(`SaleCash failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    // Cash sale: paid immediately, no change to credit balance → model unchanged.
  }
  toString() {
    return `SaleCash(qty=${this.quantity}, price=${this.unitPrice})`;
  }
}

module.exports = { SaleCredit, SaleCash };
```

- [ ] **Step 3c: Implement Payment**

```js
// server/tests/edge/commands/payments.js
const { applyPayment } = require("../model");

class Payment {
  constructor({ amount }) {
    this.amount = Number(amount);
  }
  check(model) {
    // Only pay a customer that owes something (keeps sequences meaningful).
    const id = model.lastCustomerId;
    return Boolean(id) && model.customers[id].balance > 0 && this.amount > 0;
  }
  async run(model, real) {
    const customerId = model.lastCustomerId;
    const res = await real.http
      .post("/api/payments")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        party_type: "customer",
        party_id: customerId,
        amount: this.amount,
        method: "cash",
      });
    if (res.status >= 400) {
      throw new Error(`Payment failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    applyPayment(model, { customerId, amount: this.amount });
  }
  toString() {
    return `Payment(amount=${this.amount})`;
  }
}

module.exports = { Payment };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest --runInBand tests/edge/commands/commands.test.js`
Expected: PASS. If the invoice response nests under `data`, the `(res.body.data || res.body)` handles both; if it fails, inspect the printed body and adjust the total read.

- [ ] **Step 5: Commit**

```bash
git add server/tests/edge/commands
git commit -m "test(edge): add customer, sale, and payment commands"
```

---

## Task 5: The fast-check engine runner

**Files:**
- Create: `server/tests/edge/engine.test.js`

This wires the commands into `fc.commands` and runs random sequences, checking invariants
after each sequence, with a fresh world per run.

- [ ] **Step 1: Write the engine test**

```js
// server/tests/edge/engine.test.js
const fc = require("fast-check");
const request = require("supertest");
const { freshWorld } = require("./helpers");
const { newModel } = require("./model");
const { checkInvariants } = require("./invariants");
const { CreateCustomer } = require("./commands/customers");
const { SaleCredit, SaleCash } = require("./commands/sales");
const { Payment } = require("./commands/payments");

const RUNS = Number(process.env.EDGE_RUNS || 50);
const SEED = process.env.EDGE_SEED ? Number(process.env.EDGE_SEED) : undefined;

// Generators that produce Command instances with random args.
const allCommands = [
  fc.record({ openingBalance: fc.integer({ min: 0, max: 500 }) }).map((a) => new CreateCustomer(a)),
  fc
    .record({ quantity: fc.integer({ min: 1, max: 5 }), unitPrice: fc.integer({ min: 1, max: 100 }) })
    .map((a) => new SaleCredit(a)),
  fc
    .record({ quantity: fc.integer({ min: 1, max: 5 }), unitPrice: fc.integer({ min: 1, max: 100 }) })
    .map((a) => new SaleCash(a)),
  fc.record({ amount: fc.integer({ min: 1, max: 200 }) }).map((a) => new Payment(a)),
];

describe("edge engine", () => {
  test("invariants hold across random action sequences", async () => {
    await fc.assert(
      fc.asyncProperty(fc.commands(allCommands, { maxCommands: 40 }), async (cmds) => {
        const world = freshWorld();
        const real = { ...world, http: request(world.app) };
        const model = newModel();

        // fc.modelRun replays only the applicable (check()===true) commands.
        const setup = () => ({ model, real });
        await fc.asyncModelRun(setup, cmds);

        checkInvariants(world.db, model);
      }),
      { numRuns: RUNS, seed: SEED, verbose: true },
    );
  });
});
```

- [ ] **Step 2: Run the engine**

Run: `cd server && npx jest --runInBand tests/edge/engine.test.js`
Expected: PASS. On any failure, fast-check prints the shrunk command list (each `toString()`) and a `seed`/`counterexample`. Re-run that exact case with `EDGE_SEED=<seed> npx jest --runInBand tests/edge/engine.test.js`.

- [ ] **Step 3: Commit**

```bash
git add server/tests/edge/engine.test.js
git commit -m "test(edge): add fast-check engine runner over random action sequences"
```

---

## Task 6: Prove the engine catches a real bug (smoke check)

This guards against a vacuously-passing engine. We deliberately break the model, confirm
the engine fails and shrinks, then revert.

**Files:**
- Modify (temporarily): `server/tests/edge/model.js`

- [ ] **Step 1: Introduce a deliberate bug**

In `server/tests/edge/model.js`, change `applyPayment` to under-count by 1:

```js
function applyPayment(m, { customerId, amount }) {
  m.customers[customerId].balance -= Number(amount || 0) - 1; // BUG: off by one
}
```

- [ ] **Step 2: Run the engine and confirm it fails with a shrunk reproducer**

Run: `cd server && npx jest --runInBand tests/edge/engine.test.js`
Expected: FAIL with `INVARIANT: customer ... balance mismatch` and a printed minimal command sequence containing a `Payment(...)`. This proves the engine detects and shrinks real discrepancies.

- [ ] **Step 3: Revert the deliberate bug**

Restore `applyPayment` to:

```js
function applyPayment(m, { customerId, amount }) {
  m.customers[customerId].balance -= Number(amount || 0);
}
```

- [ ] **Step 4: Confirm green again**

Run: `cd server && npx jest --runInBand tests/edge/engine.test.js`
Expected: PASS.

- [ ] **Step 5: Document the smoke check (no code change to commit beyond the reverted file)**

Add a short note to `server/tests/edge/engine.test.js` top comment:

```js
// Smoke-tested: temporarily breaking model.js applyPayment (off-by-one) makes this
// suite fail with a shrunk Payment counterexample. See plan Task 6.
```

```bash
git add server/tests/edge/engine.test.js server/tests/edge/model.js
git commit -m "test(edge): document engine bug-detection smoke check"
```

---

## Task 7: Extension recipe (remaining domains)

The engine is now proven for the money slice. Each additional domain follows the SAME
four-part recipe. This task documents it concretely so future commands stay consistent;
implement each new command as its own commit using this template.

**Recipe for adding a command (worked example: `VoidInvoice`):**

1. **Model function** in `model.js` — pure update. Example:

```js
function applyVoid(m, { customerId, total, wasCredit }) {
  if (wasCredit) m.customers[customerId].balance -= Number(total || 0);
}
```

2. **Track state needed by `check()`** — e.g. push created invoice ids onto
   `model.openInvoices = []` in the sale commands so `VoidInvoice.check()` can find a
   voidable invoice.

3. **Command file** `commands/voids.js` implementing `check`/`run`/`toString`, calling the
   real endpoint (`POST /api/invoices/:id/void` — verify exact path in `invoices.routes.js`
   before writing), then calling `applyVoid`.

4. **Extend the invariant** in `invariants.js` if the domain introduces a new law (e.g. a
   stock conservation check). For void, the existing customer-balance invariant already
   covers it — no new law needed.

5. **Register the generator** in `engine.test.js`'s `allCommands` array.

6. **Smoke-check** by breaking the new model function (as in Task 6) and confirming failure.

**Remaining domains to add, each as one commit using the recipe above:**
- Returns (`POST /api/invoices/sales/general-return` — verify path) → reduces credit balance / stock.
- Refunds → treasury + customer balance.
- Shifts (`OpenShift` / `CloseShift`) → add shift-total invariant: closed shift totals == sum of its invoices.
- Stock purchases + transfers → add stock invariant: `on_hand == purchases + returns_in − sales − transfers_out`, never negative; extend model with `m.stock[itemId]`.
- Loyalty add/redeem → add points invariant: `points == earned − redeemed`, never negative.

For each, before writing the command, run:
`grep -nE "router\\.(post|put|delete)" server/src/routes/<route>.routes.js`
to confirm the exact endpoint and payload, mirroring how Task 4's commands were derived.

- [ ] **Step 1:** Implement domains in this order (money already done): stock → shifts → loyalty → returns → refunds, one command per commit, each with its own smoke check.
- [ ] **Step 2:** After all domains are in `allCommands`, bump default depth: set `maxCommands: 60` and run a deep pass `EDGE_RUNS=1000 npm run test:edge`.
- [ ] **Step 3: Commit the final tuned engine**

```bash
git add server/tests/edge
git commit -m "test(edge): full action menu + tuned run budget"
```
