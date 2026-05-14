import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Checkbox from "../Checkbox";

describe("Checkbox", () => {
  it("renders checkbox input", () => {
    render(<Checkbox checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Checkbox label="خيار 1" checked={false} onChange={() => {}} />);
    expect(screen.getByText("خيار 1")).toBeInTheDocument();
  });

  it("shows checked state", () => {
    render(<Checkbox checked={true} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows unchecked state", () => {
    render(<Checkbox checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls onChange with checked value", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when unchecking", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("disables checkbox when disabled prop is true", () => {
    render(<Checkbox checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("applies opacity class when disabled", () => {
    render(<Checkbox checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole("checkbox").closest("label")).toHaveClass("opacity-50");
  });

  it("applies custom className", () => {
    render(<Checkbox checked={false} onChange={() => {}} className="custom-class" />);
    expect(screen.getByRole("checkbox").closest("label")).toHaveClass("custom-class");
  });
});
