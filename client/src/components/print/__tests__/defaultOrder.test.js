import { describe, it, expect } from "vitest";
import { DEFAULT_ORDER } from "../families/defaultOrder";

describe("default order", () => {
  it("roll starts with brand and ends with the code blocks (qr then barcode)", () => {
    expect(DEFAULT_ORDER.roll[0]).toBe("logo");
    expect(DEFAULT_ORDER.roll).toContain("items_table");
    expect(DEFAULT_ORDER.roll.indexOf("barcode")).toBe(DEFAULT_ORDER.roll.indexOf("qr") + 1);
  });
  it("page is a superset of roll plus its page-only blocks", () => {
    const pageOnly = ["watermark", "signature_lines"];
    const pageSet = new Set(DEFAULT_ORDER.page);
    DEFAULT_ORDER.roll.forEach((b) => expect(pageSet.has(b), b).toBe(true));
    pageOnly.forEach((b) => expect(pageSet.has(b), b).toBe(true));
    expect([...DEFAULT_ORDER.page].filter((b) => !DEFAULT_ORDER.roll.includes(b)).sort())
      .toEqual([...pageOnly].sort());
  });
});
