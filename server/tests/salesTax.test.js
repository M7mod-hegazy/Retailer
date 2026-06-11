const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { resolveTax, round2 } = require("../src/utils/salesTax");

const admin = { id: 1, role: "admin" };
const cashier = { id: 2, role: "cashier", page_permissions: JSON.stringify({ pos: ["view", "add"] }) };
const cashierWithRate = { id: 3, role: "cashier", page_permissions: JSON.stringify({ pos: ["view", "add", "edit_tax_rate"] }) };

function setSettings(db, { tax_enabled, tax_rate, tax_type }) {
  db.prepare("UPDATE settings SET tax_enabled = ?, tax_rate = ?, tax_type = ? WHERE id = 1")
    .run(tax_enabled, tax_rate, tax_type);
}

describe("salesTax.resolveTax", () => {
  let db;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-tax-"));
    initDb(path.join(dir, "tax.db"));
    db = getDb();
    setSettings(db, { tax_enabled: 1, tax_rate: 15, tax_type: "exclusive" });
  });

  test("exclusive: default ON, settings rate, tax added on top", () => {
    const r = resolveTax(db, { base: 100, user: cashier });
    expect(r).toEqual({ tax_enabled: 1, tax_rate: 15, tax_amount: 15, tax_type: "exclusive", total: 115 });
  });

  test("null requestedEnabled means 'not specified' (JSON cannot carry undefined) → default ON", () => {
    const r = resolveTax(db, { requestedEnabled: null, requestedRate: null, base: 100, user: cashier });
    expect(r.tax_enabled).toBe(1);
    expect(r.total).toBe(115);
  });

  test("explicit opt-out (0 / false) disables tax", () => {
    expect(resolveTax(db, { requestedEnabled: 0, base: 100, user: cashier }).total).toBe(100);
    expect(resolveTax(db, { requestedEnabled: false, base: 100, user: cashier }).tax_amount).toBe(0);
  });

  test("inclusive: total unchanged, tax extracted", () => {
    setSettings(db, { tax_enabled: 1, tax_rate: 15, tax_type: "inclusive" });
    const r = resolveTax(db, { base: 115, user: cashier });
    expect(r.total).toBe(115);
    expect(r.tax_amount).toBe(15);
    expect(r.tax_type).toBe("inclusive");
  });

  test("feature off (or tax_type none) → zeros even if client sends tax_enabled 1", () => {
    setSettings(db, { tax_enabled: 0, tax_rate: 15, tax_type: "exclusive" });
    expect(resolveTax(db, { requestedEnabled: 1, base: 100, user: admin }).total).toBe(100);
    setSettings(db, { tax_enabled: 1, tax_rate: 15, tax_type: "none" });
    expect(resolveTax(db, { requestedEnabled: 1, base: 100, user: admin }).tax_amount).toBe(0);
  });

  test("custom rate without edit_tax_rate permission → 403", () => {
    expect(() => resolveTax(db, { requestedRate: 10, base: 100, user: cashier }))
      .toThrow(/صلاحية/);
    try { resolveTax(db, { requestedRate: 10, base: 100, user: cashier }); } catch (e) { expect(e.status).toBe(403); }
  });

  test("custom rate allowed with permission / admin bypass; settings-equal rate is permission-free", () => {
    expect(resolveTax(db, { requestedRate: 10, base: 100, user: cashierWithRate }).tax_amount).toBe(10);
    expect(resolveTax(db, { requestedRate: 10, base: 100, user: admin }).total).toBe(110);
    // echoing the settings rate is not a custom rate
    expect(resolveTax(db, { requestedRate: 15, base: 100, user: cashier }).total).toBe(115);
  });

  test("invalid rate rejected with 400", () => {
    try {
      resolveTax(db, { requestedRate: 150, base: 100, user: admin });
      throw new Error("should have thrown");
    } catch (e) { expect(e.status).toBe(400); }
  });

  test("existing doc: unspecified fields inherit snapshot (rate + type), permission-free", () => {
    const existing = { tax_enabled: 1, tax_rate: 10, tax_type: "exclusive" };
    // settings rate is 15 — inherited 10 must NOT trigger the permission check
    const r = resolveTax(db, { base: 200, user: cashier, existing });
    expect(r.tax_rate).toBe(10);
    expect(r.total).toBe(220);
    // explicitly echoing the snapshot rate is also permission-free
    expect(resolveTax(db, { requestedRate: 10, base: 200, user: cashier, existing }).total).toBe(220);
  });

  test("existing untaxed doc: unrelated edit does not retro-tax it", () => {
    const existing = { tax_enabled: 0, tax_rate: 0, tax_type: null };
    const r = resolveTax(db, { base: 100, user: cashier, existing });
    expect(r.tax_enabled).toBe(0);
    expect(r.total).toBe(100);
  });

  test("feature disabled later: editing a taxed doc preserves its snapshot instead of stripping it", () => {
    setSettings(db, { tax_enabled: 0, tax_rate: 15, tax_type: "exclusive" });
    const existing = { tax_enabled: 1, tax_rate: 14, tax_type: "exclusive" };
    const r = resolveTax(db, { base: 100, user: cashier, existing });
    expect(r.tax_rate).toBe(14);
    expect(r.total).toBe(114);
    // unless the client explicitly disables it
    expect(resolveTax(db, { requestedEnabled: 0, base: 100, user: cashier, existing }).total).toBe(100);
  });

  test("snapshot tax_type wins over changed settings type on edits", () => {
    setSettings(db, { tax_enabled: 1, tax_rate: 15, tax_type: "inclusive" });
    const existing = { tax_enabled: 1, tax_rate: 15, tax_type: "exclusive" };
    const r = resolveTax(db, { base: 100, user: cashier, existing });
    expect(r.tax_type).toBe("exclusive");
    expect(r.total).toBe(115); // still added on top, not extracted
  });

  test("rounding uses round2", () => {
    const r = resolveTax(db, { requestedRate: 14, base: 99.99, user: admin });
    expect(r.tax_amount).toBe(round2(99.99 * 0.14));
    expect(r.total).toBe(round2(99.99 + r.tax_amount));
  });
});
