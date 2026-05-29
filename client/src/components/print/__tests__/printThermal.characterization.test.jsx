import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PrintThermalDoc } from "../PrintDoc";

const INVOICE = {
  invoice_no: "INV-2025-0042",
  created_at: "2025-06-01T10:00:00Z",
  customer_name: "محمد الهيجازي",
  cashier_name: "أحمد صالح",
  lines: [
    { sku: "SKU-001", product_name: "قميص قطني L", quantity: 2, unit_price: 60, discount_amount: 0 },
    { sku: "SKU-002", product_name: "بنطلون جينز", quantity: 1, unit_price: 110, discount_amount: 10 },
  ],
  payments: [{ method_name: "نقداً", amount: 250 }],
};
const SETTINGS = {
  company_name: "إلهيجازي للتجزئة", branch_name: "الفرع الرئيسي",
  address: "شارع الملك فهد", phone: "0500000000", tax_id: "310122393500003",
  receipt_width: "80mm", show_qr: true, accent_color: "#0f172a",
};

describe("PrintThermalDoc characterization", () => {
  it("80mm output is stable", () => {
    const { container } = render(<PrintThermalDoc invoice={INVOICE} settings={{ ...SETTINGS, receipt_width: "80mm" }} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("58mm output is stable", () => {
    const { container } = render(<PrintThermalDoc invoice={INVOICE} settings={{ ...SETTINGS, receipt_width: "58mm" }} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
