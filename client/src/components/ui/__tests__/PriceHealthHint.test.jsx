import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PriceHealthHint from "../PriceHealthHint";

describe("PriceHealthHint", () => {
  it("renders children directly with no tooltip markup when label is falsy", () => {
    const { container } = render(
      <PriceHealthHint label={null}><input aria-label="price" /></PriceHealthHint>
    );
    expect(screen.getByLabelText("price")).toBeInTheDocument();
    expect(container.querySelectorAll("span").length).toBe(0);
  });

  it("shows the label text on focus and hides it on blur", () => {
    render(
      <PriceHealthHint label="ت 18.00 · +7.00"><input aria-label="price" /></PriceHealthHint>
    );
    expect(screen.queryByText("ت 18.00 · +7.00")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("price"));
    expect(screen.getByText("ت 18.00 · +7.00")).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText("price"));
    expect(screen.queryByText("ت 18.00 · +7.00")).not.toBeInTheDocument();
  });

  it("shows the label text on mouse hover and hides it on mouse leave", () => {
    render(
      <PriceHealthHint label="ت 18.00"><input aria-label="price" /></PriceHealthHint>
    );
    const wrapper = screen.getByLabelText("price").parentElement;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText("ت 18.00")).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText("ت 18.00")).not.toBeInTheDocument();
  });
});
