import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Radio from "../Radio";

describe("Radio", () => {
  it("renders radio input", () => {
    render(<Radio name="opt" value="a" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("radio")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Radio name="opt" value="a" label="Option A" checked={false} onChange={() => {}} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("shows checked state", () => {
    render(<Radio name="opt" value="a" checked={true} onChange={() => {}} />);
    expect(screen.getByRole("radio")).toBeChecked();
  });

  it("shows unchecked state", () => {
    render(<Radio name="opt" value="a" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("radio")).not.toBeChecked();
  });

  it("calls onChange with value", () => {
    const onChange = vi.fn();
    render(<Radio name="opt" value="a" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio"));
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("disables when disabled prop is true", () => {
    render(<Radio name="opt" value="a" checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole("radio")).toBeDisabled();
  });

  it("does not render label span when no label", () => {
    render(<Radio name="opt" value="a" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("radio").closest("label")?.textContent).toBe("");
  });
});
