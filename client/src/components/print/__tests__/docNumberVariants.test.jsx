import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DocNumberBlock from "../blocks/DocNumberBlock";

const invoice = { invoice_no: "INV-2026-0001" };

describe("DocNumberBlock giant variant on roll", () => {
  it("boxed variant on roll renders a border", () => {
    const { container } = render(
      <DocNumberBlock invoice={invoice} props={{ variant: "boxed" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border");
  });

  it("giant variant on roll renders a large centered number, distinct from boxed", () => {
    const boxed = render(
      <DocNumberBlock invoice={invoice} props={{ variant: "boxed" }} family="roll" />
    ).container.innerHTML;
    const giant = render(
      <DocNumberBlock invoice={invoice} props={{ variant: "giant" }} family="roll" />
    ).container.innerHTML;
    expect(giant).not.toBe(boxed);
    expect(giant).toContain("INV-2026-0001");
  });
});
