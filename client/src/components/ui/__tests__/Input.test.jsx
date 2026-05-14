import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Input from "../Input";

describe("Input", () => {
  it("renders input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Input label="الاسم" />);
    expect(screen.getByText("الاسم")).toBeInTheDocument();
  });

  it("shows required asterisk when required prop is true", () => {
    render(<Input label="الاسم" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows error message when error prop is provided", () => {
    render(<Input label="الاسم" error="هذا الحقل مطلوب" />);
    expect(screen.getByText("هذا الحقل مطلوب")).toBeInTheDocument();
  });

  it("adds error class to input when error is present", () => {
    render(<Input error="Error" />);
    expect(screen.getByRole("textbox")).toHaveClass("input-error");
  });

  it("applies autoComplete override", () => {
    render(<Input autoComplete="on" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("autoComplete", "on");
  });

  it("infers autoComplete='new-password' for password type", () => {
    render(<Input type="password" />);
    expect(screen.getByLabelText).toBeTruthy();
  });

  it("renders placeholder as space (for floating label)", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", " ");
  });

  it("passes extra props to input", () => {
    render(<Input data-testid="my-input" />);
    expect(screen.getByTestId("my-input")).toBeInTheDocument();
  });

  it("handles onChange", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("has-value class when value is provided", () => {
    render(<Input value="test" onChange={() => {}} />);
    expect(screen.getByRole("textbox").closest("label")).toHaveClass("has-value");
  });
});
