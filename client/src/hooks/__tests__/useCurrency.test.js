import { describe, it, expect } from "vitest";
import { useCurrency } from "../useCurrency";

describe("useCurrency", () => {
  it("formats with default symbol and 2 decimals", () => {
    expect(useCurrency(10)).toBe("10.00 ر.س");
  });

  it("formats with custom symbol", () => {
    expect(useCurrency(10, "$")).toBe("10.00 $");
  });

  it("formats with custom decimals", () => {
    expect(useCurrency(10, "ر.س", 3)).toBe("10.000 ر.س");
  });

  it("handles zero", () => {
    expect(useCurrency(0)).toBe("0.00 ر.س");
  });

  it("handles null/undefined", () => {
    expect(useCurrency(null)).toBe("0.00 ر.س");
    expect(useCurrency(undefined)).toBe("0.00 ر.س");
  });

  it("handles fractions", () => {
    expect(useCurrency(10.5)).toBe("10.50 ر.س");
  });

  it("handles large numbers", () => {
    expect(useCurrency(1_000_000)).toBe("1000000.00 ر.س");
  });

  it("handles negative numbers", () => {
    expect(useCurrency(-5)).toBe("-5.00 ر.س");
  });

  it("handles string numeric input", () => {
    expect(useCurrency("25")).toBe("25.00 ر.س");
  });

  it("always returns a string", () => {
    [0, 1, 1.5, 100, "50", null, undefined].forEach((v) => {
      expect(typeof useCurrency(v)).toBe("string");
    });
  });
});
