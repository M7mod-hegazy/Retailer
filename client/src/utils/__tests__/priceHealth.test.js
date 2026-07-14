import { describe, it, expect } from "vitest";
import { getMarginHealth, getRefundHealth, HEALTH_BORDER_CLASSES, ENTRY_HEALTH_CLASSES } from "../priceHealth";

describe("getMarginHealth", () => {
  it("is neutral when cost is unknown", () => {
    expect(getMarginHealth(100, 0, 100).level).toBe("neutral");
  });
  it("is neutral when price is zero", () => {
    expect(getMarginHealth(0, 50, 100).level).toBe("neutral");
  });
  it("flags loss when price equals cost", () => {
    expect(getMarginHealth(50, 50, 100).level).toBe("loss");
  });
  it("flags loss when price is below cost", () => {
    expect(getMarginHealth(40, 50, 100).level).toBe("loss");
  });
  it("flags thin margin just under the 10% band", () => {
    const r = getMarginHealth(54, 50, 100); // margin = 8%
    expect(r.level).toBe("thin");
    expect(r.diffPct).toBeCloseTo(8, 5);
  });
  it("is healthy at exactly 10% margin", () => {
    expect(getMarginHealth(55, 50, 100).level).toBe("healthy");
  });
  it("is healthy well above the thin band", () => {
    expect(getMarginHealth(80, 50, 100).level).toBe("healthy");
  });
  it("flags high when price exceeds list price by more than 30%", () => {
    expect(getMarginHealth(131, 50, 100).level).toBe("high");
  });
  it("is not high at exactly 30% over list price", () => {
    expect(getMarginHealth(130, 50, 100).level).toBe("healthy");
  });
  it("reports margin figures for a high price when cost is known", () => {
    const r = getMarginHealth(140, 50, 100);
    expect(r.level).toBe("high");
    expect(r.diffFlat).toBe(90);
  });
  it("is high even when cost is unknown, with null margin figures", () => {
    const r = getMarginHealth(140, 0, 100);
    expect(r.level).toBe("high");
    expect(r.diffFlat).toBeNull();
    expect(r.diffPct).toBeNull();
  });
});

describe("getRefundHealth", () => {
  it("is neutral when original price is unknown", () => {
    expect(getRefundHealth(50, 0).level).toBe("neutral");
  });
  it("is neutral when entered price is zero", () => {
    expect(getRefundHealth(0, 50).level).toBe("neutral");
  });
  it("is healthy when refunding exactly what was paid", () => {
    expect(getRefundHealth(50, 50).level).toBe("healthy");
  });
  it("is healthy when refunding less than what was paid", () => {
    expect(getRefundHealth(40, 50).level).toBe("healthy");
  });
  it("flags thin just over what was paid", () => {
    expect(getRefundHealth(54, 50).level).toBe("thin"); // +8%
  });
  it("is exactly at the 10% boundary -> thin, not loss", () => {
    expect(getRefundHealth(55, 50).level).toBe("thin"); // +10%
  });
  it("flags loss when refunding more than 10% over what was paid", () => {
    expect(getRefundHealth(56, 50).level).toBe("loss"); // +12%
  });
  it("never returns 'high'", () => {
    expect(getRefundHealth(1000, 50).level).not.toBe("high");
  });
});

describe("style maps", () => {
  it("HEALTH_BORDER_CLASSES has an entry for every level", () => {
    for (const level of ["loss", "high", "thin", "healthy", "neutral"]) {
      expect(HEALTH_BORDER_CLASSES).toHaveProperty(level);
    }
  });
  it("ENTRY_HEALTH_CLASSES has an entry for every level", () => {
    for (const level of ["loss", "high", "thin", "healthy", "neutral"]) {
      expect(ENTRY_HEALTH_CLASSES).toHaveProperty(level);
    }
  });
});
