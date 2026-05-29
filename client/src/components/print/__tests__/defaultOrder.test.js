import { describe, it, expect } from "vitest";
import { DEFAULT_ORDER } from "../families/defaultOrder";

describe("default order", () => {
  it("roll starts with brand and ends with qr", () => {
    expect(DEFAULT_ORDER.roll[0]).toBe("logo");
    expect(DEFAULT_ORDER.roll).toContain("items_table");
    expect(DEFAULT_ORDER.roll.at(-1)).toBe("qr");
  });
  it("page contains the same block set as roll", () => {
    expect([...DEFAULT_ORDER.page].sort()).toEqual([...DEFAULT_ORDER.roll].sort());
  });
});
