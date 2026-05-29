import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PrintA4Doc } from "../PrintDoc";

const INVOICE = {
  invoice_no: "INV-2025-0042", created_at: "2025-06-01T10:00:00Z",
  customer_name: "محمد الهيجازي", cashier_name: "أحمد صالح",
  lines: [
    { sku: "SKU-001", product_name: "قميص قطني L", quantity: 2, unit_price: 60, discount_amount: 0 },
    { sku: "SKU-002", product_name: "بنطلون جينز", quantity: 1, unit_price: 110, discount_amount: 10 },
  ],
  payments: [{ method_name: "نقداً", amount: 250 }],
};
const SETTINGS = { company_name: "إلهيجازي للتجزئة", branch_name: "الفرع الرئيسي", tax_id: "310122393500003", show_qr: true, accent_color: "#0f172a" };

describe("PrintA4Doc characterization", () => {
  it("A4 output is stable", () => {
    const { container } = render(<PrintA4Doc invoice={INVOICE} settings={SETTINGS} size="A4" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("A5 output is stable", () => {
    const { container } = render(<PrintA4Doc invoice={INVOICE} settings={SETTINGS} size="A5" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
