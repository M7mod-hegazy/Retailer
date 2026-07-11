import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PaymentsBlock from "../blocks/PaymentsBlock";

const invoice = {
  payments: [
    { method_name: "نقدي", amount: 150 },
    { method_name: "شبكة", amount: 100 },
  ],
};
const settings = { show_payment_details: true };

describe("PaymentsBlock roll variants", () => {
  it("table-row variant on roll shows a top rule per payment row", () => {
    const { container } = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "table-row" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border-top");
    expect(container.textContent).toContain("نقدي");
    expect(container.textContent).toContain("شبكة");
  });

  it("badge-pill variant on roll shows bordered pill tags", () => {
    const { container } = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border-radius");
    expect(container.textContent).toContain("نقدي");
  });

  it("table-row and badge-pill produce different markup on roll", () => {
    const a = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "table-row" }} family="roll" />
    ).container.innerHTML;
    const b = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    ).container.innerHTML;
    expect(a).not.toBe(b);
  });
});
