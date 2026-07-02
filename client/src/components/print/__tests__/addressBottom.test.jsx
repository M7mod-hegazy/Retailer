import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

const INV = { invoice_no: "INV-1", lines: [{ product_name: "صنف", quantity: 1, unit_price: 10 }], payments: [] };
const S = {
  company_name: "ACME", address: "العنوان في الأسفل", tax_id: "123456",
  receipt_header: "ترويسة مهمة", address_position: "bottom", receipt_width: "80mm",
};

describe("address_position=bottom + receipt_header", () => {
  it("roll: address moves below QR, header text shows, header has no address", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={S} />);
    expect(container.textContent).toContain("ترويسة مهمة");
    expect(container.textContent).toContain("العنوان في الأسفل");
    // RollWrapper now nests [paper div > band div > centered brand div, headtext, ...];
    // brand div must not hold the address.
    const brandHeader = container.firstChild.firstChild.firstChild;
    expect(brandHeader.textContent).not.toContain("العنوان في الأسفل");
  });

  it("page: address renders in a bottom zone, not in the header", () => {
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={INV} settings={S} />);
    expect(container.textContent).toContain("ترويسة مهمة");
    const header = container.querySelector("[data-zone='header']");
    expect(header.textContent).not.toContain("العنوان في الأسفل");
    const bottom = container.querySelector("[data-zone='address-bottom']");
    expect(bottom).toBeTruthy();
    expect(bottom.textContent).toContain("العنوان في الأسفل");
  });
});
