import { describe, it, expect } from "vitest";
import { buildZatcaTlv, formatZatcaAmount } from "@shared/zatcaQr";

// Manually assemble a TLV field the same way the ZATCA spec describes it —
// independent of shared/zatcaQr.js internals — so this test doesn't just
// mirror the implementation.
function tagField(tag, str) {
  const bytes = Array.from(new TextEncoder().encode(str));
  return [tag, bytes.length, ...bytes];
}

describe("buildZatcaTlv", () => {
  it("matches an independently-assembled TLV for a known vector", () => {
    const sellerName = "Bobs Records";
    const vatNumber = "310122393500003";
    const timestamp = "2022-04-25T15:30:00Z";

    const expectedBytes = [
      ...tagField(1, sellerName),
      ...tagField(2, vatNumber),
      ...tagField(3, timestamp),
      ...tagField(4, "1000.00"),
      ...tagField(5, "150.00"),
    ];
    const expectedBase64 = Buffer.from(expectedBytes).toString("base64");

    const actual = buildZatcaTlv({ sellerName, vatNumber, timestamp, total: 1000, vat: 150 });
    expect(actual).toBe(expectedBase64);
  });

  it("round-trips an Arabic seller name through base64 + TLV", () => {
    const sellerName = "متجر الهجازي للتجزئة";
    const vatNumber = "300000000000003";
    const timestamp = "2026-07-03T10:15:00Z";

    const b64 = buildZatcaTlv({ sellerName, vatNumber, timestamp, total: 230.5, vat: 30.07 });

    // Decode independently (not via the module) and parse the TLV back out.
    const bytes = Array.from(Buffer.from(b64, "base64"));
    const decoder = new TextDecoder("utf-8");
    const fields = {};
    let i = 0;
    while (i < bytes.length) {
      const tag = bytes[i];
      const len = bytes[i + 1];
      const value = decoder.decode(Uint8Array.from(bytes.slice(i + 2, i + 2 + len)));
      fields[tag] = value;
      i += 2 + len;
    }

    expect(fields[1]).toBe(sellerName);
    expect(fields[2]).toBe(vatNumber);
    expect(fields[3]).toBe(timestamp);
    expect(fields[4]).toBe("230.50");
    expect(fields[5]).toBe("30.07");
  });

  it("throws when sellerName is missing", () => {
    expect(() => buildZatcaTlv({ vatNumber: "300000000000003", total: 10, vat: 1 })).toThrow();
  });

  it("throws when vatNumber is missing", () => {
    expect(() => buildZatcaTlv({ sellerName: "Test Co", total: 10, vat: 1 })).toThrow();
  });

  it("truncates an overlong seller name at 255 bytes without crashing", () => {
    const longName = "A".repeat(300);
    const b64 = buildZatcaTlv({ sellerName: longName, vatNumber: "300000000000003", total: 1, vat: 0 });
    const bytes = Array.from(Buffer.from(b64, "base64"));
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(255);
    expect(bytes.length).toBeGreaterThan(255); // tag+len bytes for fields 2-5 still follow
  });

  it("formatZatcaAmount formats to exactly 2 decimals", () => {
    expect(formatZatcaAmount(10)).toBe("10.00");
    expect(formatZatcaAmount(10.5)).toBe("10.50");
    expect(formatZatcaAmount(10.567)).toBe("10.57");
    expect(formatZatcaAmount("not-a-number")).toBe("0.00");
  });
});
