import { describe, it, expect } from "vitest";
import { normalizeArabic, tokenize } from "../arabicText";
import { searchHelp } from "../helpSearch";

describe("normalizeArabic", () => {
  it("strips tashkeel and unifies alef/ta-marbuta/ya forms", () => {
    expect(normalizeArabic("الفَاتُورَة")).toBe(normalizeArabic("الفاتوره"));
    expect(normalizeArabic("إغلاق")).toBe(normalizeArabic("اغلاق"));
    expect(normalizeArabic("كيفية")).toBe(normalizeArabic("كيفيه"));
  });

  it("treats different hamza/alef typings as equal", () => {
    expect(normalizeArabic("أعمل")).toBe(normalizeArabic("اعمل"));
  });
});

describe("tokenize", () => {
  it("drops stop words and 1-char tokens", () => {
    const tokens = tokenize("كيف اعمل خصم في الفاتورة");
    expect(tokens).not.toContain("في");
    expect(tokens).toContain("خصم");
  });
});

describe("searchHelp (intent knowledge base)", () => {
  it("returns no results for an empty query", () => {
    const { results, confident } = searchHelp("   ");
    expect(results).toHaveLength(0);
    expect(confident).toBe(false);
  });

  it("answers 'how do I close the shift' with the shift intent + exact route", () => {
    const { results } = searchHelp("ازاي اقفل الوردية");
    expect(results[0].entry.id).toBe("close-shift");
    expect(results[0].entry.route).toBe("/pos");
    expect(results[0].entry.answer).toMatch(/وردية/);
  });

  it("every answer carries a natural answer string (not generic cards)", () => {
    const { results } = searchHelp("ازاي اعمل فاتورة بيع");
    expect(results[0].entry.answer.length).toBeGreaterThan(30);
    expect(results[0].entry.route).toBeTruthy();
  });

  it("matches synonyms (تخفيض → discount intent)", () => {
    const viaDiscount = searchHelp("ازاي اعمل خصم");
    const viaSynonym = searchHelp("عايز اعمل تخفيض للعميل");
    expect(viaDiscount.results[0].entry.id).toBe("discount");
    expect(viaSynonym.results.some((r) => r.entry.id === "discount")).toBe(true);
  });

  it("biases the result toward the current page", () => {
    const onPurchaseReturns = searchHelp("مرتجع", { currentPath: "/purchases/returns" });
    expect(onPurchaseReturns.results[0].entry.id).toBe("purchase-return");
  });

  it("handles a complex, reworded question", () => {
    const { results } = searchHelp("العميل رجعلي صنف عايز ارجعه ازاي");
    expect(results[0].entry.id).toBe("sales-return");
    expect(results[0].entry.route).toBe("/sales/returns");
  });
});
