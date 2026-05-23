/**
 * posLogic.test.js
 *
 * Comprehensive Vitest unit tests for POS business logic.
 * All functions under test are extracted as pure functions mirroring the
 * inline logic found in POSPage.jsx and posStore.js so they can be tested
 * without a DOM or React context.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Pure functions extracted from POSPage.jsx / posStore.js
// ─────────────────────────────────────────────────────────────────────────────

/** formatMoney — mirrors POSPage.jsx line 48-53 */
function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/** computeTotals — mirrors posStore.js lines 5-12 */
function computeTotals(lines, discountTotal = 0) {
  const subtotal = lines.reduce(
    (sum, line) =>
      sum + line.quantity * line.unit_price - Number(line.line_discount || 0),
    0,
  );
  const total = Math.max(0, subtotal - Number(discountTotal || 0));
  return { subtotal, total };
}

/**
 * addCurrentLine validation — mirrors POSPage.jsx addCurrentLine() lines 691-723.
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 * When the price is below purchase cost it calls the provided confirmFn; if
 * confirmFn returns false the add is aborted.
 *
 * @param {object} selectedItem
 * @param {object} staging      { quantity, unitPrice, lineDiscount, warehouseId }
 * @param {function} confirmFn  replacement for window.confirm
 * @returns {{ ok: boolean, error?: string, line?: object }}
 */
function addCurrentLineValidation(selectedItem, staging, confirmFn = () => true) {
  if (!selectedItem) return { ok: false, error: "no item selected" };

  const quantity     = Math.max(1, Number(staging.quantity || 1));
  const unitPrice    = Math.max(0, Number(staging.unitPrice || 0));
  const lineDiscount = Math.max(0, Number(staging.lineDiscount || 0));
  const stockValue   = Number(selectedItem.stock_quantity || selectedItem.stock || 0);
  const purchasePrice = Number(selectedItem.purchase_price || 0);

  if (unitPrice <= 0) {
    return { ok: false, error: "لا يمكن إضافة صنف بسعر صفر." };
  }
  if (quantity > stockValue) {
    return { ok: false, error: `المخزون غير كافٍ (المتاح: ${stockValue})` };
  }
  if (unitPrice < purchasePrice) {
    const confirmed = confirmFn(
      `السعر أقل من الشراء (${formatMoney(purchasePrice)}). هل تريد المتابعة؟`,
    );
    if (!confirmed) return { ok: false, error: "cancelled by user" };
  }

  return {
    ok: true,
    line: {
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      quantity,
      unit_price: unitPrice,
      line_discount: lineDiscount,
      stock_quantity: stockValue,
    },
  };
}

/**
 * saveInvoiceValidation — mirrors POSPage.jsx saveInvoice() pre-validation block
 * (lines 743-760).
 *
 * Returns { ok: true } or { ok: false, error: string, action?: string }.
 * action: 'open_customer_modal' | 'open_bank_select' | 'open_multi_fix'
 */
function saveInvoiceValidation({
  lines,
  paymentType,
  customer,
  selectedBankId,
  banks,
  activeMultiPayments,
  total,
}) {
  if (!lines || lines.length === 0) {
    return { ok: false, error: "no lines" };
  }
  if (lines.some((l) => Number(l.unit_price || 0) <= 0)) {
    return { ok: false, error: "يوجد صنف بسعر غير صالح." };
  }
  if (lines.some((l) => Number(l.quantity || 0) > Number(l.stock_quantity || 0))) {
    return { ok: false, error: "لا يمكن الحفظ: يوجد صنف يتجاوز المخزون." };
  }
  if (paymentType === "credit" && !customer?.id) {
    return {
      ok: false,
      error: "البيع الآجل يتطلب تحديد عميل.",
      action: "open_customer_modal",
    };
  }
  if (paymentType === "bank_transfer" && !selectedBankId && banks && banks.length > 0) {
    return { ok: false, error: "يرجى اختيار البنك.", action: "open_bank_select" };
  }
  if (paymentType === "multi") {
    const multiSum = activeMultiPayments.reduce(
      (acc, p) => acc + Number(p.amount),
      0,
    );
    if (Math.abs(total - multiSum) > 0.005) {
      return {
        ok: false,
        error: `مجموع الدفع المتعدد لا يساوي الإجمالي (${formatMoney(total)}).`,
        action: "open_multi_fix",
      };
    }
  }
  return { ok: true };
}

/**
 * generateInvoiceNumber — mirrors POSPage.jsx useMemo lines 522-528
 *
 * @param {Date}   stamp   the current date/time used for the prefix
 * @param {number} seq     the sequential counter (1-based)
 */
function generateInvoiceNumber(stamp, seq) {
  const yy = String(stamp.getFullYear()).slice(-2);
  const mm = String(stamp.getMonth() + 1).padStart(2, "0");
  const dd = String(stamp.getDate()).padStart(2, "0");
  return `INV-${yy}${mm}${dd}-${String(seq).padStart(4, "0")}`;
}

/**
 * creditRemaining — mirrors POSPage.jsx line 519
 *
 * @param {number} total
 * @param {number} paidAmount
 */
function creditRemaining(total, paidAmount) {
  return Math.max(0, total - Math.max(0, paidAmount));
}

/**
 * changeAmount — mirrors POSPage.jsx line 520
 *
 * @param {number} amountReceived
 * @param {number} total
 */
function changeAmount(amountReceived, total) {
  return Math.max(0, amountReceived - total);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeLine(overrides = {}) {
  return {
    item_id: 1,
    item_name: "صنف تجريبي",
    quantity: 2,
    unit_price: 10,
    line_discount: 0,
    stock_quantity: 50,
    ...overrides,
  };
}

function makeItem(overrides = {}) {
  return {
    id: 1,
    name: "صنف تجريبي",
    sale_price: 10,
    purchase_price: 5,
    stock_quantity: 50,
    ...overrides,
  };
}

function makeStaging(overrides = {}) {
  return {
    warehouseId: "1",
    quantity: "2",
    unitPrice: "10",
    lineDiscount: "0",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. formatMoney
// ─────────────────────────────────────────────────────────────────────────────

describe("formatMoney", () => {
  it("formats an integer with three decimal places", () => {
    const result = formatMoney(10);
    // Arabic locale may use Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) or Western digits
    // /[\d٠-٩]/ covers both Unicode ranges
    expect(result).toMatch(/[\d٠-٩]/);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats zero correctly", () => {
    const result = formatMoney(0);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles null/undefined by treating them as 0", () => {
    expect(formatMoney(null)).toEqual(formatMoney(0));
    expect(formatMoney(undefined)).toEqual(formatMoney(0));
  });

  it("handles an empty string by treating it as 0", () => {
    expect(formatMoney("")).toEqual(formatMoney(0));
  });

  it("handles negative values", () => {
    const result = formatMoney(-5.5);
    expect(typeof result).toBe("string");
    // Should contain a minus sign or the Arabic minus
    expect(result).toMatch(/[-−؜]/);
  });

  it("handles large numbers without throwing", () => {
    expect(() => formatMoney(1_000_000)).not.toThrow();
  });

  it("handles a string-numeric value", () => {
    expect(formatMoney("25")).toEqual(formatMoney(25));
  });

  it("always returns a string", () => {
    [0, 1, 1.5, 100, "50", null, undefined].forEach((v) => {
      expect(typeof formatMoney(v)).toBe("string");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. addCurrentLine validation
// ─────────────────────────────────────────────────────────────────────────────

describe("addCurrentLine validation", () => {
  it("returns ok: true for a valid item and staging values", () => {
    const result = addCurrentLineValidation(makeItem(), makeStaging());
    expect(result.ok).toBe(true);
    expect(result.line).toBeDefined();
    expect(result.line.quantity).toBe(2);
    expect(result.line.unit_price).toBe(10);
  });

  it("rejects when unitPrice is 0", () => {
    const result = addCurrentLineValidation(makeItem(), makeStaging({ unitPrice: "0" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("سعر صفر");
  });

  it("rejects when unitPrice is negative", () => {
    const result = addCurrentLineValidation(makeItem(), makeStaging({ unitPrice: "-5" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("سعر صفر");
  });

  it("rejects when unitPrice is an empty string (treated as 0)", () => {
    const result = addCurrentLineValidation(makeItem(), makeStaging({ unitPrice: "" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("سعر صفر");
  });

  it("rejects when quantity exceeds stock", () => {
    const item = makeItem({ stock_quantity: 5 });
    const result = addCurrentLineValidation(item, makeStaging({ quantity: "10" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("المخزون غير كافٍ");
    expect(result.error).toContain("5"); // shows available stock
  });

  it("rejects when quantity exactly equals stock+1 (off-by-one boundary)", () => {
    const item = makeItem({ stock_quantity: 3 });
    const result = addCurrentLineValidation(item, makeStaging({ quantity: "4" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("المخزون غير كافٍ");
  });

  it("accepts when quantity exactly equals stock (boundary)", () => {
    const item = makeItem({ stock_quantity: 3 });
    const result = addCurrentLineValidation(item, makeStaging({ quantity: "3" }));
    expect(result.ok).toBe(true);
  });

  it("warns when unitPrice is below purchase price and user confirms", () => {
    const confirmFn = vi.fn().mockReturnValue(true);
    const item = makeItem({ purchase_price: 15 });
    const result = addCurrentLineValidation(item, makeStaging({ unitPrice: "12" }), confirmFn);
    expect(confirmFn).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
  });

  it("aborts when unitPrice is below purchase price and user cancels", () => {
    const confirmFn = vi.fn().mockReturnValue(false);
    const item = makeItem({ purchase_price: 15 });
    const result = addCurrentLineValidation(item, makeStaging({ unitPrice: "12" }), confirmFn);
    expect(confirmFn).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("cancelled by user");
  });

  it("does NOT warn when unitPrice equals purchase price exactly (boundary)", () => {
    const confirmFn = vi.fn().mockReturnValue(true);
    const item = makeItem({ purchase_price: 10 });
    const result = addCurrentLineValidation(item, makeStaging({ unitPrice: "10" }), confirmFn);
    expect(confirmFn).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("returns ok: false when no item is selected", () => {
    const result = addCurrentLineValidation(null, makeStaging());
    expect(result.ok).toBe(false);
  });

  it("uses stock field as fallback when stock_quantity is absent", () => {
    const item = { id: 1, name: "x", sale_price: 10, purchase_price: 5, stock: 2 };
    const result = addCurrentLineValidation(item, makeStaging({ quantity: "3" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("المخزون غير كافٍ");
  });

  it("enforces minimum quantity of 1 even when staging.quantity is 0", () => {
    const result = addCurrentLineValidation(makeItem(), makeStaging({ quantity: "0" }));
    expect(result.ok).toBe(true);
    expect(result.line.quantity).toBe(1); // Math.max(1, …) enforces minimum
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. saveInvoice pre-validation
// ─────────────────────────────────────────────────────────────────────────────

describe("saveInvoice pre-validation", () => {
  const goodLines = [makeLine()];
  const goodCustomer = { id: 42, name: "أحمد" };

  it("returns ok: false when lines array is empty", () => {
    const result = saveInvoiceValidation({
      lines: [], paymentType: "cash", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no lines");
  });

  it("returns ok: false when lines is null/undefined", () => {
    const result = saveInvoiceValidation({
      lines: null, paymentType: "cash", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when any line has unit_price <= 0", () => {
    const lines = [makeLine({ unit_price: 0 })];
    const result = saveInvoiceValidation({
      lines, paymentType: "cash", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("سعر غير صالح");
  });

  it("rejects when any line has negative unit_price", () => {
    const lines = [makeLine({ unit_price: -1 })];
    const result = saveInvoiceValidation({
      lines, paymentType: "cash", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when quantity exceeds stock_quantity in any line", () => {
    const lines = [makeLine({ quantity: 100, stock_quantity: 10 })];
    const result = saveInvoiceValidation({
      lines, paymentType: "cash", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("يتجاوز المخزون");
  });

  it("rejects credit payment without a named customer", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "credit", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("آجل");
    expect(result.action).toBe("open_customer_modal");
  });

  it("rejects credit payment when customer has no id (walk-in object)", () => {
    const walkIn = { id: null, name: "زبون نقدي" };
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "credit", customer: walkIn,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.action).toBe("open_customer_modal");
  });

  it("accepts credit payment when a real customer is selected", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "credit", customer: goodCustomer,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects bank_transfer when banks exist but none selected", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "bank_transfer", customer: null,
      selectedBankId: "", banks: [{ id: 1, name: "البنك الأهلي" }],
      activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("البنك");
    expect(result.action).toBe("open_bank_select");
  });

  it("accepts bank_transfer when no banks exist at all (no choice to make)", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "bank_transfer", customer: null,
      selectedBankId: "", banks: [],
      activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects multi-payment when sum of payments does not equal total", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "multi", customer: null,
      selectedBankId: "", banks: [],
      activeMultiPayments: [{ method_id: 1, amount: "10" }],
      total: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("متعدد");
  });

  it("accepts multi-payment when sum exactly equals total", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "multi", customer: null,
      selectedBankId: "", banks: [],
      activeMultiPayments: [
        { method_id: 1, amount: "12" },
        { method_id: 2, amount: "8" },
      ],
      total: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts multi-payment within floating-point tolerance (0.005)", () => {
    // 10.000 + 9.998 = 19.998, total = 20 → diff = 0.002 < 0.005
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "multi", customer: null,
      selectedBankId: "", banks: [],
      activeMultiPayments: [
        { method_id: 1, amount: "10.000" },
        { method_id: 2, amount: "9.998" },
      ],
      total: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts cash payment with all good lines — happy path", () => {
    const result = saveInvoiceValidation({
      lines: goodLines, paymentType: "cash", customer: null,
      selectedBankId: "", banks: [], activeMultiPayments: [], total: 20,
    });
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Totals calculation
// ─────────────────────────────────────────────────────────────────────────────

describe("totals calculation", () => {
  it("calculates subtotal as sum of (qty * price - line_discount)", () => {
    const lines = [
      makeLine({ quantity: 3, unit_price: 10, line_discount: 5 }), // 25
      makeLine({ item_id: 2, quantity: 2, unit_price: 7, line_discount: 0 }), // 14
    ];
    const { subtotal } = computeTotals(lines, 0);
    expect(subtotal).toBe(39);
  });

  it("deducts invoice-level discount from subtotal to get total", () => {
    const lines = [makeLine({ quantity: 2, unit_price: 10, line_discount: 0 })]; // 20
    const { total } = computeTotals(lines, 5);
    expect(total).toBe(15);
  });

  it("total never goes negative when discount exceeds subtotal", () => {
    const lines = [makeLine({ quantity: 1, unit_price: 10, line_discount: 0 })]; // 10
    const { total } = computeTotals(lines, 100); // huge discount
    expect(total).toBe(0);
  });

  it("returns subtotal = 0 and total = 0 for empty cart", () => {
    const { subtotal, total } = computeTotals([], 0);
    expect(subtotal).toBe(0);
    expect(total).toBe(0);
  });

  it("handles combined invoice discount + promotionDiscount", () => {
    const lines = [makeLine({ quantity: 4, unit_price: 10, line_discount: 0 })]; // 40
    const discountTotal = 5 + 10; // invoiceDiscount=5, promotionDiscount=10
    const { total } = computeTotals(lines, discountTotal);
    expect(total).toBe(25);
  });

  it("applies line_discount per line independently", () => {
    const lines = [
      makeLine({ quantity: 1, unit_price: 100, line_discount: 20 }), // 80
      makeLine({ item_id: 2, quantity: 1, unit_price: 50,  line_discount: 0  }), // 50
    ];
    const { subtotal } = computeTotals(lines, 0);
    expect(subtotal).toBe(130);
  });

  it("subtotal can be negative if line_discount exceeds qty*price", () => {
    // This edge case: line_discount larger than the line value.
    // The store does NOT prevent this at computeTotals level.
    const lines = [makeLine({ quantity: 1, unit_price: 5, line_discount: 10 })]; // -5
    const { subtotal } = computeTotals(lines, 0);
    expect(subtotal).toBe(-5);
    // total is clamped to 0
    const { total } = computeTotals(lines, 0);
    expect(total).toBe(0);
  });

  it("handles floating-point quantities and prices accurately", () => {
    const lines = [makeLine({ quantity: 1.5, unit_price: 4, line_discount: 0 })]; // 6
    const { subtotal } = computeTotals(lines, 0);
    expect(subtotal).toBeCloseTo(6, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Invoice number format
// ─────────────────────────────────────────────────────────────────────────────

describe("invoiceNumber generation", () => {
  it("produces the format INV-YYMMDD-NNNN", () => {
    const date = new Date("2025-01-05");
    const inv = generateInvoiceNumber(date, 1);
    expect(inv).toMatch(/^INV-\d{6}-\d{4}$/);
  });

  it("uses two-digit year (last two digits)", () => {
    const date = new Date("2026-03-15");
    const inv = generateInvoiceNumber(date, 1);
    expect(inv.startsWith("INV-26")).toBe(true);
  });

  it("zero-pads month and day to two digits", () => {
    const date = new Date("2025-04-07");
    const inv = generateInvoiceNumber(date, 1);
    expect(inv).toBe("INV-250407-0001");
  });

  it("zero-pads sequence number to four digits", () => {
    const date = new Date("2025-12-31");
    const inv = generateInvoiceNumber(date, 7);
    expect(inv).toBe("INV-251231-0007");
  });

  it("handles sequence number >= 1000 without truncation", () => {
    const date = new Date("2025-06-01");
    const inv = generateInvoiceNumber(date, 1234);
    expect(inv).toBe("INV-250601-1234");
  });

  it("handles sequence number >= 10000 (overflows 4-digit pad gracefully)", () => {
    const date = new Date("2025-06-01");
    const inv = generateInvoiceNumber(date, 10000);
    // String(10000).padStart(4, "0") === "10000" — no truncation
    expect(inv).toBe("INV-250601-10000");
  });

  it("increments sequence between invoices", () => {
    const date = new Date("2025-08-20");
    const inv1 = generateInvoiceNumber(date, 1);
    const inv2 = generateInvoiceNumber(date, 2);
    expect(inv1).toBe("INV-250820-0001");
    expect(inv2).toBe("INV-250820-0002");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Payment calculations — change amount & credit remaining
// ─────────────────────────────────────────────────────────────────────────────

describe("payment calculations", () => {
  // ── changeAmount ──

  it("changeAmount: returns 0 when received equals total", () => {
    expect(changeAmount(100, 100)).toBe(0);
  });

  it("changeAmount: returns positive change when received > total", () => {
    expect(changeAmount(150, 100)).toBe(50);
  });

  it("changeAmount: returns 0 when received < total (no negative change)", () => {
    expect(changeAmount(80, 100)).toBe(0);
  });

  it("changeAmount: returns 0 for zero inputs", () => {
    expect(changeAmount(0, 0)).toBe(0);
  });

  it("changeAmount: handles fractional amounts", () => {
    expect(changeAmount(100.750, 97.500)).toBeCloseTo(3.25, 5);
  });

  // ── creditRemaining ──

  it("creditRemaining: full unpaid — remaining equals total", () => {
    expect(creditRemaining(200, 0)).toBe(200);
  });

  it("creditRemaining: partial payment", () => {
    expect(creditRemaining(200, 50)).toBe(150);
  });

  it("creditRemaining: full payment — remaining is 0", () => {
    expect(creditRemaining(200, 200)).toBe(0);
  });

  it("creditRemaining: over-payment is clamped to 0", () => {
    expect(creditRemaining(200, 300)).toBe(0);
  });

  it("creditRemaining: negative paidAmount is treated as 0", () => {
    // Math.max(0, paidAmount) = 0, so remaining = total
    expect(creditRemaining(200, -50)).toBe(200);
  });

  it("creditRemaining: handles fractional totals and payments", () => {
    expect(creditRemaining(99.750, 33.250)).toBeCloseTo(66.5, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Keyboard navigation flow
// ─────────────────────────────────────────────────────────────────────────────

describe("keyboard navigation flow", () => {
  /**
   * These tests verify the *intent* of the field-focus sequence in POSPage.
   * Since we have no DOM here, we model focus as calls to vi.fn() mocks that
   * represent the four entry field refs:
   *   [0] codeInputRef  → [1] qtyInputRef → [2] priceInputRef → [3] discInputRef
   *
   * The logic under test is handleEntryFieldKeyDown from POSPage.jsx.
   */

  function makeFieldRefs() {
    return [0, 1, 2, 3].map(() => ({
      current: { focus: vi.fn(), select: vi.fn() },
    }));
  }

  function handleEntryFieldKeyDown(e, fieldIndex, { selectedItem, refs, addLine }) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        const prev = fieldIndex - 1;
        if (prev >= 0) { refs[prev].current.focus(); refs[prev].current.select(); }
        return;
      }
      if (fieldIndex === 3) { if (selectedItem) addLine(); return; }
      if (fieldIndex === 0 && !selectedItem) return;
      const next = fieldIndex + 1;
      if (next < refs.length) { refs[next].current.focus(); refs[next].current.select(); }
      return;
    }
  }

  it("Enter on code field (index 0) with item selected moves to qty field (index 1)", () => {
    const refs = makeFieldRefs();
    const addLine = vi.fn();
    const e = { key: "Enter", shiftKey: false, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 0, { selectedItem: { id: 1 }, refs, addLine });
    expect(refs[1].current.focus).toHaveBeenCalledOnce();
    expect(refs[1].current.select).toHaveBeenCalledOnce();
  });

  it("Enter on code field (index 0) with NO item selected does nothing", () => {
    const refs = makeFieldRefs();
    const addLine = vi.fn();
    const e = { key: "Enter", shiftKey: false, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 0, { selectedItem: null, refs, addLine });
    refs.forEach((r) => {
      expect(r.current.focus).not.toHaveBeenCalled();
    });
    expect(addLine).not.toHaveBeenCalled();
  });

  it("Enter on qty field (index 1) moves to price field (index 2)", () => {
    const refs = makeFieldRefs();
    const e = { key: "Enter", shiftKey: false, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 1, { selectedItem: { id: 1 }, refs, addLine: vi.fn() });
    expect(refs[2].current.focus).toHaveBeenCalledOnce();
  });

  it("Enter on price field (index 2) moves to discount field (index 3)", () => {
    const refs = makeFieldRefs();
    const e = { key: "Enter", shiftKey: false, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 2, { selectedItem: { id: 1 }, refs, addLine: vi.fn() });
    expect(refs[3].current.focus).toHaveBeenCalledOnce();
  });

  it("Enter on discount field (index 3) calls addLine when item is selected", () => {
    const refs = makeFieldRefs();
    const addLine = vi.fn();
    const e = { key: "Enter", shiftKey: false, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 3, { selectedItem: { id: 1 }, refs, addLine });
    expect(addLine).toHaveBeenCalledOnce();
  });

  it("Enter on discount field (index 3) does NOT call addLine when no item selected", () => {
    const refs = makeFieldRefs();
    const addLine = vi.fn();
    const e = { key: "Enter", shiftKey: false, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 3, { selectedItem: null, refs, addLine });
    expect(addLine).not.toHaveBeenCalled();
  });

  it("Shift+Enter on price field (index 2) moves backwards to qty field (index 1)", () => {
    const refs = makeFieldRefs();
    const e = { key: "Enter", shiftKey: true, preventDefault: vi.fn() };
    handleEntryFieldKeyDown(e, 2, { selectedItem: { id: 1 }, refs, addLine: vi.fn() });
    expect(refs[1].current.focus).toHaveBeenCalledOnce();
    expect(refs[1].current.select).toHaveBeenCalledOnce();
  });

  it("Shift+Enter on code field (index 0) does not go out of bounds", () => {
    const refs = makeFieldRefs();
    const e = { key: "Enter", shiftKey: true, preventDefault: vi.fn() };
    // prev = -1, so nothing should be focused
    handleEntryFieldKeyDown(e, 0, { selectedItem: { id: 1 }, refs, addLine: vi.fn() });
    refs.forEach((r) => {
      expect(r.current.focus).not.toHaveBeenCalled();
    });
  });
});
