import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

const INV = { invoice_no: "INV-1", lines: [{ product_name: "X", quantity: 1, unit_price: 10 }], payments: [] };

describe("LayoutRenderer", () => {
  it("renders default order when no layout given", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME", show_qr: true }} />);
    expect(container.textContent).toContain("ACME");
  });
  it("honors an explicit order (company name before grand total)", () => {
    const layout = { roll: { order: ["company_name", "grand_total"] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} />);
    const txt = container.textContent;
    expect(txt.indexOf("ACME")).toBeLessThan(txt.indexOf("المستحق"));
  });
});
