import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DocGridBlock from "../blocks/DocGridBlock";
import BankDetailsBlock from "../blocks/BankDetailsBlock";

describe("DocGridBlock variants", () => {
  const invoice = { invoice_no: "INV-2026-0001", customer_name: "أحمد محمد" };
  const settings = {};
  it("boxed variant differs from standard on page", () => {
    const standard = render(<DocGridBlock invoice={invoice} settings={settings} props={{ variant: "standard" }} family="page" editing />).container.innerHTML;
    const boxed = render(<DocGridBlock invoice={invoice} settings={settings} props={{ variant: "boxed" }} family="page" editing />).container.innerHTML;
    expect(boxed).not.toBe(standard);
  });
  it("compact variant has no table on roll, unlike standard", () => {
    const { container } = render(<DocGridBlock invoice={invoice} settings={settings} props={{ variant: "compact" }} family="roll" editing />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("INV-2026-0001");
  });
});

describe("BankDetailsBlock variants", () => {
  const settings = { bank_name: "مصرف الراجحي", bank_iban: "SA8080000001234567890123" };
  it("boxed variant differs from standard (solid vs dashed border)", () => {
    const standard = render(<BankDetailsBlock settings={settings} props={{ variant: "standard" }} family="page" editing />).container.innerHTML;
    const boxed = render(<BankDetailsBlock settings={settings} props={{ variant: "boxed" }} family="page" editing />).container.innerHTML;
    expect(boxed).not.toBe(standard);
  });
  it("inline variant has no card border, unlike standard", () => {
    const { container } = render(<BankDetailsBlock settings={settings} props={{ variant: "inline" }} family="roll" editing />);
    expect(container.textContent).toContain("SA8080000001234567890123");
    expect(container.innerHTML).not.toContain("dashed");
  });
});
