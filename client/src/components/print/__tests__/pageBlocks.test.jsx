import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BLOCK_REGISTRY } from "../blocks/registry";

const S = { accent_color: "#123456", currency_symbol: "ر.س", tax_rate: 15, item_font_size: 11, show_item_code: true };
const INV = { lines: [{ sku: "K1", product_name: "صنف", quantity: 2, unit_price: 50, discount_amount: 0 }], payments: [] };

describe("page-family blocks", () => {
  it("items_table renders page columns (#, سعر) on page", () => {
    const { component: Block } = BLOCK_REGISTRY.items_table;
    const { container } = render(<Block invoice={INV} settings={S} props={{}} family="page" />);
    const thead = container.querySelector("thead").textContent;
    expect(thead).toContain("#");
    expect(thead).toContain("سعر");
  });
  it("items_table drops the price column on narrow 58mm rolls (80mm keeps it)", () => {
    const { component: Block } = BLOCK_REGISTRY.items_table;
    const narrow = render(<Block invoice={INV} settings={{ ...S, receipt_width: "58mm" }} props={{}} family="roll" />);
    expect(narrow.container.querySelector("thead").textContent).not.toContain("سعر");
    const wide = render(<Block invoice={INV} settings={{ ...S, receipt_width: "80mm" }} props={{}} family="roll" />);
    expect(wide.container.querySelector("thead").textContent).toContain("سعر");
  });
  it("grand_total renders an accent box on page", () => {
    const { component: Block } = BLOCK_REGISTRY.grand_total;
    const { container } = render(<Block invoice={INV} settings={S} props={{}} family="page" />);
    expect(container.textContent).toContain("الإجمالي");
  });
});
