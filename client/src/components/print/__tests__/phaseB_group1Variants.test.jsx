import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DocDateBlock from "../blocks/DocDateBlock";
import CashierBlock from "../blocks/CashierBlock";
import BarcodeBlock from "../blocks/BarcodeBlock";
import OrderNumberBlock from "../blocks/OrderNumberBlock";
import ReceiptHeaderTextBlock from "../blocks/ReceiptHeaderTextBlock";

describe("DocDateBlock ruled variant", () => {
  const invoice = { created_at: "2026-07-10T10:00:00Z" };
  it("ruled variant differs from standard on page", () => {
    const standard = render(<DocDateBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} family="page" />).container.innerHTML;
    const ruled = render(<DocDateBlock invoice={invoice} settings={{}} props={{ variant: "ruled" }} family="page" />).container.innerHTML;
    expect(ruled).not.toBe(standard);
    expect(ruled).toContain("border-top");
  });
  it("ruled variant differs from standard on roll", () => {
    const standard = render(<DocDateBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} family="roll" />).container.innerHTML;
    const ruled = render(<DocDateBlock invoice={invoice} settings={{}} props={{ variant: "ruled" }} family="roll" />).container.innerHTML;
    expect(ruled).not.toBe(standard);
    expect(ruled).toContain("dashed");
  });
});

describe("CashierBlock boxed variant", () => {
  const invoice = { cashier_name: "سارة الحربي" };
  const settings = { show_cashier_name: true };
  it("boxed variant differs from badge on page", () => {
    const badge = render(<CashierBlock invoice={invoice} settings={settings} props={{ variant: "badge" }} family="page" />).container.innerHTML;
    const boxed = render(<CashierBlock invoice={invoice} settings={settings} props={{ variant: "boxed" }} family="page" />).container.innerHTML;
    expect(boxed).not.toBe(badge);
  });
  it("boxed variant renders a border on roll", () => {
    const { container } = render(<CashierBlock invoice={invoice} settings={settings} props={{ variant: "boxed" }} family="roll" />);
    expect(container.innerHTML).toContain("border");
    expect(container.textContent).toContain("سارة الحربي");
  });
});

describe("BarcodeBlock framed variant", () => {
  const invoice = { invoice_no: "INV-2026-0001" };
  const settings = { show_barcode_line: true };
  it("framed variant adds a border around the barcode area", () => {
    const standard = render(<BarcodeBlock invoice={invoice} settings={settings} props={{ variant: "standard" }} family="roll" />).container.innerHTML;
    const framed = render(<BarcodeBlock invoice={invoice} settings={settings} props={{ variant: "framed" }} family="roll" />).container.innerHTML;
    expect(framed).not.toBe(standard);
    expect(framed).toContain("border");
  });
});

describe("OrderNumberBlock boxed variant", () => {
  const invoice = { invoice_no: "INV-2026-0001" };
  it("boxed variant differs from badge and standard", () => {
    const badge = render(<OrderNumberBlock invoice={invoice} props={{ variant: "badge" }} family="roll" />).container.innerHTML;
    const boxed = render(<OrderNumberBlock invoice={invoice} props={{ variant: "boxed" }} family="roll" />).container.innerHTML;
    expect(boxed).not.toBe(badge);
    expect(boxed).toContain("INV-2026-0001");
  });
});

describe("ReceiptHeaderTextBlock underline-accent variant", () => {
  it("underline-accent variant differs from boxed and standard on page", () => {
    const standard = render(<ReceiptHeaderTextBlock props={{ variant: "standard" }} family="page" editing />).container.innerHTML;
    const underline = render(<ReceiptHeaderTextBlock props={{ variant: "underline-accent" }} family="page" editing />).container.innerHTML;
    expect(underline).not.toBe(standard);
    expect(underline).toContain("border-bottom");
  });
});
