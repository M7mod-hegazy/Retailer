import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SubtotalBlock from "../blocks/SubtotalBlock";
import DiscountBlock from "../blocks/DiscountBlock";
import IncreaseBlock from "../blocks/IncreaseBlock";
import TaxBlock from "../blocks/TaxBlock";

const invoice = { lines: [{ quantity: 1, unit_price: 500 }] };

describe("SubtotalBlock badge variant", () => {
  it("differs from boxed on page and roll", () => {
    const boxedPage = render(<SubtotalBlock invoice={invoice} settings={{}} props={{ variant: "boxed" }} family="page" editing />).container.innerHTML;
    const badgePage = render(<SubtotalBlock invoice={invoice} settings={{}} props={{ variant: "badge" }} family="page" editing />).container.innerHTML;
    expect(badgePage).not.toBe(boxedPage);
    expect(badgePage).toContain("border-radius");
  });
});

describe("DiscountBlock underline-accent variant", () => {
  const settings = {};
  it("differs from badge and standard on page", () => {
    const invoiceWithDiscount = { lines: [{ quantity: 1, unit_price: 500, discount_amount: 25 }] };
    const badge = render(<DiscountBlock invoice={invoiceWithDiscount} settings={settings} props={{ variant: "badge" }} family="page" editing />).container.innerHTML;
    const underline = render(<DiscountBlock invoice={invoiceWithDiscount} settings={settings} props={{ variant: "underline-accent" }} family="page" editing />).container.innerHTML;
    expect(underline).not.toBe(badge);
    expect(underline).toContain("border-bottom");
  });
});

describe("IncreaseBlock badge variant", () => {
  it("differs from boxed and standard on page", () => {
    const invoiceWithIncrease = { lines: [{ quantity: 1, unit_price: 500 }], increase_amount: 15 };
    const boxed = render(<IncreaseBlock invoice={invoiceWithIncrease} settings={{}} props={{ variant: "boxed" }} family="page" editing />).container.innerHTML;
    const badge = render(<IncreaseBlock invoice={invoiceWithIncrease} settings={{}} props={{ variant: "badge" }} family="page" editing />).container.innerHTML;
    expect(badge).not.toBe(boxed);
    expect(badge).toContain("border-radius");
  });
});

describe("TaxBlock ruled variant", () => {
  const settings = { tax_enabled: "1" };
  it("differs from plain variant (solid single rule vs dashed double rule)", () => {
    const plain = render(<TaxBlock invoice={invoice} settings={settings} props={{ variant: "plain" }} family="page" editing />).container.innerHTML;
    const ruled = render(<TaxBlock invoice={invoice} settings={settings} props={{ variant: "ruled" }} family="page" editing />).container.innerHTML;
    expect(ruled).not.toBe(plain);
    expect(ruled).toContain("border-top");
  });
  it("renders on roll too", () => {
    const { container } = render(<TaxBlock invoice={invoice} settings={settings} props={{ variant: "ruled" }} family="roll" editing />);
    expect(container.innerHTML).toContain("border-top");
  });
});
