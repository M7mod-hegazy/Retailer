import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

const INV = { invoice_no: "INV-9", customer_name: "عميل", lines: [{ product_name: "X", quantity: 1, unit_price: 100 }], payments: [] };
const S = { company_name: "ACME", accent_color: "#0f172a", show_qr: true, tax_rate: 15 };

describe("page zones", () => {
  it("renders a two-column header (brand + doc-meta side by side)", () => {
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={INV} settings={S} />);
    const header = container.querySelector("[data-zone='header']");
    expect(header).toBeTruthy();
    expect(header.querySelectorAll("[data-zone-col]").length).toBe(2);
  });
  it("totals zone is right-aligned", () => {
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={INV} settings={S} />);
    const totals = container.querySelector("[data-zone='totals']");
    expect(totals.getAttribute("style")).toContain("flex-end");
  });
});
