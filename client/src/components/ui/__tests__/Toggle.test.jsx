import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Toggle from "../Toggle";

describe("Toggle", () => {
  it("renders with label", () => {
    render(<Toggle label="تفعيل" checked={false} onChange={() => {}} />);
    expect(screen.getByText("تفعيل")).toBeInTheDocument();
  });

  it("shows checked state", () => {
    render(<Toggle checked={true} onChange={() => {}} />);
    const btn = screen.getByRole("switch");
    expect(btn).toHaveAttribute("aria-checked", "true");
  });

  it("shows unchecked state", () => {
    render(<Toggle checked={false} onChange={() => {}} />);
    const btn = screen.getByRole("switch");
    expect(btn).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with inverted value when clicked", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when checked=true and clicked", () => {
    const onChange = vi.fn();
    render(<Toggle checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies opacity class when disabled", () => {
    render(<Toggle checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole("switch").closest("label")).toHaveClass("opacity-50");
  });
});
