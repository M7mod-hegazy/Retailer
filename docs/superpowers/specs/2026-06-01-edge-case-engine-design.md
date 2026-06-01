# Edge-Case Engine — Stateful Property Testing for Financial & Stock Integrity

**Date:** 2026-06-01
**Status:** Approved design, pending implementation plan

## Problem

The system has a large surface of money- and stock-mutating actions (sales, payments,
returns, refunds, voids, transfers, loyalty, shifts). The dangerous bugs are not in any
single action — they emerge from **combinations** of actions in a particular order
(e.g. "customer balance goes wrong only after sale → partial payment → return → void").

A solo developer cannot hand-write every combination. Hand-written scenario tests only
ever cover sequences the author already imagined, so by definition they miss the
unimagined edge cases that bite in production.

## Goal

Build a **stateful property-testing engine** that:
1. Generates random sequences of real actions against a throwaway database.
2. After every single step, checks universal invariants AND compares against a naive
   parallel model.
3. On any violation, shrinks to the **minimal reproducing sequence** and saves the seed
   for exact replay.

Declare the laws once; let the machine supply the chaos.

## Non-Goals

- Formal model checking (TLA+/Alloy) — tests a model, not the real `better-sqlite3` code. Rejected.
- Replacing the existing per-route Jest suite — this is additive.
- UI/Electron-level testing — engine drives the HTTP API only.

## Honest Ceiling (explicitly acknowledged)

The engine finds bugs only within **{actions in the command menu} × {invariants written}**.
It will not invent an action that was never added, and it will not catch a violation that
no invariant watches. Coverage grows by adding commands and invariants over time.
Realistically it exhausts 2–3-action interaction bugs and finds most 4–5-action ones;
very deep 8+ step conspiracies are statistically possible to miss within a finite run budget.

## Approach

Chosen technique: **Level 3 — stateful property testing** using `fast-check`'s
model-based commands, driven through the real Express app via `supertest`.

Rejected alternatives:
- **Level 1 (hand-written scenarios):** zero discovery; coverage = author imagination.
- **Level 2 (invariants on hand-written sequences):** strong assertions, weak inputs.
- **Level 4 (formal model checking):** tests an abstraction, drifts from real code, huge effort.

### Execution: HTTP API via supertest

Confirmed decision. Reuses the existing test bootstrap already present in the codebase:
`createApp()` (`server/src/app`), `initDb(path)` / `setDb(null)` (`server/src/config/database`),
temp-dir SQLite DB, and JWT signed with `{ sub: "__dev__" }`. Actions exercise real route
logic, validation, and auth — where real edge cases live.

### Verify mode: Model + Invariants (both)

Two independent checks run after every command:

1. **Naive parallel model** (`model.js`) — a deliberately simple plain-object
   re-derivation of expected truth (e.g. `model.customers[id].balance += saleAmount`).
   It is NOT the production logic; it is an easy-to-eyeball second opinion. If the real
   route and this naive model disagree, one is wrong and the simple one is easy to audit.
2. **Universal invariants** (`invariants.js`) — laws that must hold regardless of history,
   checked against the real DB state.

### On failure: Fail fast + save seed

Stop at the first broken invariant/model mismatch. Print the minimal shrunk command
sequence as a replayable list. Persist the fast-check seed so the exact failure can be
re-run deterministically.

## Architecture

```
fast-check generates a random command sequence
        │
        ▼
  for each command in sequence:
    1. run it against REAL app (supertest → Express → temp SQLite)
    2. update the MODEL (plain JS object)
    3. check INVARIANTS: real DB state == model, and all laws hold
        │ on mismatch
        ▼
  fast-check SHRINKS → minimal failing sequence + saved seed
```

## Components

### `server/tests/edge/helpers.js`
App bootstrap. Reuses `setDb(null)` + `initDb(tempDir)` + `createApp()` + JWT signing,
mirroring `server/tests/customers.test.js`. Provides a fresh isolated app+DB per sequence
and a helper to read real DB state for invariant checks.

### `server/tests/edge/model.js`
Naive truth-model: plain JS object tracking, per entity, what *should* be true
(customer balances, treasury balances, stock on hand, loyalty points, shift totals).
Pure functions: `applyX(model, args, result)` updates the model. No DB access.

### `server/tests/edge/commands/`
One file per action. Each command implements the fast-check `Command` interface:
- `check(model)` — is this command currently valid/applicable?
- `run(model, real)` — call the real API via supertest, update the model, assert per-command expectations.
- `toString()` — human-readable for the shrunk reproducer.

Initial command menu ("everything at once"):
`CreateCustomer, CreateItem, OpenShift, CloseShift, SaleCash, SaleCredit, Payment,
Return, RefundPayment, VoidInvoice, EditInvoice, StockPurchase, Transfer,
AddLoyalty, RedeemLoyalty`.

### `server/tests/edge/invariants.js`
Laws checked after every command against the real DB:

- **Money:** `customer.balance == sum(unpaid invoices) − sum(overpayments)` for every customer.
- **Money:** `treasury.balance == opening + sum(movements)`; net treasury delta == net cash in/out.
- **Stock:** `item.on_hand == purchases + returns_in − sales − returns_out − transfers_out`; never negative.
- **Loyalty:** `points == earned − redeemed`; never negative.
- **Shift:** closed shift totals == sum of its invoices; no invoice attaches to a shift after it is closed.
- **Conservation:** void/return/refund neither create nor destroy total money or total stock.

### `server/tests/edge/engine.test.js`
The runner. Uses `fc.assert(fc.property(fc.commands(...), ...))`. Config: N sequences
(default 200, env-overridable to thousands for deep runs), 30–60 commands each, fresh
temp DB per sequence, fail-fast, seed printed on failure.

## Run shape

- `npm run test:edge` — default run (200 sequences).
- `EDGE_RUNS=5000 npm run test:edge` — deep run.
- `EDGE_SEED=<n> npm run test:edge` — replay a specific saved failure.

## Testing the engine itself

To prove the engine actually catches bugs (not just passes vacuously):
- Add a temporary deliberate bug behind an env flag (e.g. off-by-one in a balance update)
  and confirm the engine fails and shrinks to a small sequence. Documented as a smoke check.

## File layout

```
server/tests/edge/
  engine.test.js
  model.js
  invariants.js
  helpers.js
  commands/
    customers.js
    items.js
    shifts.js
    sales.js
    payments.js
    returns.js
    refunds.js
    voids.js
    edits.js
    purchases.js
    transfers.js
    loyalty.js
```

## Dependencies

- Add `fast-check` (dev dependency) to `server/package.json`. No other new deps; `supertest`
  and `jest` already present.

## Rollout

1. Engine + helpers + model skeleton + 2 commands (CreateCustomer, SaleCash) + customer-balance invariant. Prove the loop works end-to-end and the deliberate-bug smoke check fails as expected.
2. Add money commands (payment, return, refund, void) + treasury/conservation invariants.
3. Add stock commands (purchase, transfer) + stock invariants.
4. Add shifts + loyalty commands and their invariants.
5. Wire `test:edge` script; tune run budget.
