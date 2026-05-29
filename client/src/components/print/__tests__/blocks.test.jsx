import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BLOCK_REGISTRY } from "../blocks/registry";

const S = { company_name: "إلهيجازي للتجزئة", header_font_size: 16, accent_color: "#0f172a", currency_symbol: "ر.س", tax_rate: 15 };
const INV = { lines: [{ unit_price: 100, quantity: 2, discount_amount: 0 }], payments: [] };

describe("block registry", () => {
  it("renders company name from settings", () => {
    const { component: Block } = BLOCK_REGISTRY.company_name;
    render(<Block invoice={{}} settings={S} props={{}} family="roll" />);
    expect(screen.getByText("إلهيجازي للتجزئة")).toBeTruthy();
  });
  it("computes grand total = subtotal - discount + tax", () => {
    const { component: Block } = BLOCK_REGISTRY.grand_total;
    const { container } = render(<Block invoice={INV} settings={S} props={{}} family="roll" />);
    // 200 - 0 + 15% = 230.00
    expect(container.textContent).toContain("230.00");
  });
  it("registry covers all v1 block types", () => {
    const expected = ["logo","company_name","branch","address","tax_id","receipt_header_text",
      "doc_number","doc_date","customer","cashier","items_table","subtotal","discount","tax",
      "grand_total","payments","footer_text","qr","custom_text","divider","spacer"];
    expected.forEach(t => expect(BLOCK_REGISTRY[t], `missing block: ${t}`).toBeTruthy());
  });
});
