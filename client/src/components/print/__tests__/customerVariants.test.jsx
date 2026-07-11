import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CustomerBlock from "../blocks/CustomerBlock";

const invoice = { customer_name: "أحمد محمد", customer_phone: "0501234567" };
const settings = { show_customer_name: true };

describe("CustomerBlock two-column variant on roll", () => {
  it("boxed variant on roll renders a bordered box", () => {
    const { container } = render(
      <CustomerBlock invoice={invoice} settings={settings} props={{ variant: "boxed", showPhone: true }} family="roll" />
    );
    expect(container.innerHTML).toContain("border");
  });

  it("two-column variant on roll pairs name and phone on the same line, distinct from boxed", () => {
    const boxed = render(
      <CustomerBlock invoice={invoice} settings={settings} props={{ variant: "boxed", showPhone: true }} family="roll" />
    ).container.innerHTML;
    const twoCol = render(
      <CustomerBlock invoice={invoice} settings={settings} props={{ variant: "two-column", showPhone: true }} family="roll" />
    ).container.innerHTML;
    expect(twoCol).not.toBe(boxed);
    expect(twoCol).toContain("flex-wrap");
  });
});
