import { describe, it, expect } from "vitest";
import { ensureLayout, seedFamilyLayout, familyForSize, overrideStyle, defaultColumns, SHOW_KEY } from "../layout/layoutModel";

describe("layoutModel", () => {
  it("maps sizes to families", () => {
    expect(familyForSize("58mm")).toBe("roll");
    expect(familyForSize("80mm")).toBe("roll");
    expect(familyForSize("A5")).toBe("page");
    expect(familyForSize("A4")).toBe("page");
  });

  it("seeds both families with order, columns, empty inserted/perBlock", () => {
    const fam = seedFamilyLayout("page");
    expect(fam.order.length).toBeGreaterThan(5);
    expect(fam.inserted).toEqual([]);
    expect(fam.columns.items_table.length).toBe(defaultColumns("page").length);
  });

  it("ensureLayout is non-mutating and idempotent", () => {
    const s = { company_name: "X" };
    const out = ensureLayout(s);
    expect(s.layout).toBeUndefined();             // original untouched
    expect(out.layout.roll.order.length).toBeGreaterThan(0);
    expect(out.layout.page.order.length).toBeGreaterThan(0);
    const out2 = ensureLayout(out);
    expect(out2.layout.roll.order).toBe(out.layout.roll.order); // preserved
  });

  it("overrideStyle builds CSS from designer overrides", () => {
    expect(overrideStyle({ fontSize: 14, bold: true, align: "center", color: "#fff" }))
      .toEqual({ fontSize: "14px", fontWeight: 900, textAlign: "center", color: "#fff" });
    expect(overrideStyle({})).toBeNull();
  });

  it("show-capable blocks map to existing show_* fields", () => {
    expect(SHOW_KEY.logo).toBe("show_logo");
    expect(SHOW_KEY.qr).toBe("show_qr");
    expect(SHOW_KEY.footer_text).toBe("show_footer");
  });
});
