import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { formatPrintDigits, smartFormat } from "../blocks/blockUtils";
import ItemsTableBlock from "../blocks/ItemsTableBlock";

describe("formatPrintDigits", () => {
  it("maps western digits to Arabic-Indic when print_numerals is arabic", () => {
    expect(formatPrintDigits({ print_numerals: "arabic" }, "123.45")).toBe("١٢٣.٤٥");
    expect(formatPrintDigits({ print_numerals: "arabic" }, "0987654321")).toBe("٠٩٨٧٦٥٤٣٢١");
  });

  it("leaves non-digit characters (currency symbols, '%', '.') untouched", () => {
    expect(formatPrintDigits({ print_numerals: "arabic" }, "ر.س 12.50")).toBe("ر.س ١٢.٥٠");
    expect(formatPrintDigits({ print_numerals: "arabic" }, "15%")).toBe("١٥%");
  });

  it("is off by default (western digits unchanged)", () => {
    expect(formatPrintDigits({}, "123.45")).toBe("123.45");
    expect(formatPrintDigits({ print_numerals: "western" }, "123.45")).toBe("123.45");
  });

  it("smartFormat only applies digit mapping when settings are passed", () => {
    expect(smartFormat(123.456)).toBe("123.46"); // legacy call, no settings — unchanged
    expect(smartFormat(123.456, {})).toBe("123.46"); // settings passed, default western
    expect(smartFormat(123.456, { print_numerals: "arabic" })).toBe("١٢٣.٤٦");
  });
});

describe("ItemsTableBlock print_numerals", () => {
  const invoice = {
    lines: [{ product_name: "منتج تجريبي", quantity: 3, unit_price: 45.5 }],
  };

  it("renders western digits by default", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} settings={{}} family="roll" />
    );
    expect(container.textContent).toContain("45.5");
    expect(container.textContent).not.toMatch(/[٠-٩]/);
  });

  it("renders Arabic-Indic digits when print_numerals is arabic", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} settings={{ print_numerals: "arabic" }} family="roll" />
    );
    // quantity "3" -> "٣", price "45.5" -> "٤٥.٥"
    expect(container.textContent).toContain("٣");
    expect(container.textContent).toContain("٤٥.٥");
  });
});
