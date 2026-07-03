import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

const INV = { invoice_no: "INV-1", lines: [{ product_name: "X", quantity: 1, unit_price: 10 }], payments: [] };

describe("LayoutRenderer", () => {
  it("renders default order when no layout given", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME", show_qr: true }} />);
    expect(container.textContent).toContain("ACME");
  });
  it("hides the subtotal line when the net equals the subtotal (grand total always shows)", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME", show_tax: false }} />);
    // No discount/fee/tax → no separate "الإجمالي:" subtotal line…
    expect(container.textContent).not.toContain("الإجمالي:");
    // …but the prominent grand-total box (✦الإجمالي✦) always prints.
    expect(container.textContent).toContain("✦");
  });

  it("prints رسوم إضافية when the invoice has a surcharge", () => {
    const withFee = { ...INV, increase: 5 };
    const { container } = render(<LayoutRenderer family="roll" invoice={withFee} settings={{ company_name: "ACME", show_tax: false }} />);
    expect(container.textContent).toContain("رسوم إضافية");
    expect(container.textContent).toContain("✦"); // grand-total box marker
  });

  it("honors an explicit order (company name before grand total)", () => {
    const INV2 = { ...INV, discount: 3 };
    const layout = { roll: { order: ["company_name", "grand_total"] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV2} settings={{ company_name: "ACME" }} layout={layout} />);
    const txt = container.textContent;
    expect(txt.indexOf("ACME")).toBeLessThan(txt.indexOf("الإجمالي"));
  });
});
