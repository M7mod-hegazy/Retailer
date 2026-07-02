import { describe, it, expect } from "vitest";
import {
  rollPaperWidthMm,
  rollDefaultPrintWidthMm,
  rollPrintWidthMm,
  rollShiftXMm,
  rollBandLeftMm,
} from "../blocks/blockUtils";

describe("rollPaperWidthMm", () => {
  it("defaults to 80 when unset", () => {
    expect(rollPaperWidthMm({})).toBe(80);
  });
  it("parses 58mm", () => {
    expect(rollPaperWidthMm({ receipt_width: "58mm" })).toBe(58);
  });
  it("parses a custom width like 76mm", () => {
    expect(rollPaperWidthMm({ receipt_width: "76mm" })).toBe(76);
  });
  it("falls back to 80 for garbage input", () => {
    expect(rollPaperWidthMm({ receipt_width: "not-a-size" })).toBe(80);
    expect(rollPaperWidthMm({ receipt_width: "5mm" })).toBe(80);
    expect(rollPaperWidthMm({ receipt_width: "500mm" })).toBe(80);
  });
});

describe("rollDefaultPrintWidthMm", () => {
  it("58mm paper -> 48mm band", () => {
    expect(rollDefaultPrintWidthMm(58)).toBe(48);
  });
  it("80mm paper -> 72mm band", () => {
    expect(rollDefaultPrintWidthMm(80)).toBe(72);
  });
  it("76mm paper -> 68mm band", () => {
    expect(rollDefaultPrintWidthMm(76)).toBe(68);
  });
});

describe("rollPrintWidthMm", () => {
  it("uses the standard default band when no calibration is set", () => {
    expect(rollPrintWidthMm({ receipt_width: "80mm" })).toBe(72);
    expect(rollPrintWidthMm({ receipt_width: "58mm" })).toBe(48);
  });
  it("uses the calibrated print_area_width when set", () => {
    expect(rollPrintWidthMm({ receipt_width: "80mm", print_area_width: 74 })).toBe(74);
  });
  it("clamps a calibrated band wider than the paper to the paper width", () => {
    expect(rollPrintWidthMm({ receipt_width: "80mm", print_area_width: 999 })).toBe(80);
  });
});

describe("rollShiftXMm", () => {
  it("defaults to 0", () => {
    expect(rollShiftXMm({})).toBe(0);
  });
  it("respects an explicit print_shift_x value", () => {
    expect(rollShiftXMm({ print_shift_x: 3.5 })).toBe(3.5);
    expect(rollShiftXMm({ print_shift_x: -2 })).toBe(-2);
  });
});

describe("rollBandLeftMm", () => {
  it("centers the default band on the paper when no shift is set", () => {
    // 80mm paper, 72mm default band -> (80-72)/2 = 4mm each side
    expect(rollBandLeftMm({ receipt_width: "80mm" })).toBe(4);
  });
  it("applies the calibration shift on top of the centered position", () => {
    // (80-72)/2 = 4, +2 shift = 6
    expect(rollBandLeftMm({ receipt_width: "80mm", print_shift_x: 2 })).toBe(6);
  });
  it("clamps the left offset into [0, paper-band]", () => {
    // 80mm paper, 72mm band -> max left is 8; a huge positive shift clamps to 8
    expect(rollBandLeftMm({ receipt_width: "80mm", print_shift_x: 999 })).toBe(8);
    // a huge negative shift clamps to 0
    expect(rollBandLeftMm({ receipt_width: "80mm", print_shift_x: -999 })).toBe(0);
  });
});
