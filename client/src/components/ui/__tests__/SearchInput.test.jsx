import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchInput from "../SearchInput";

describe("SearchInput", () => {
  it("renders input with placeholder", () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("بحث...")).toBeInTheDocument();
  });

  it("renders custom placeholder", () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="ابحث عن..." />);
    expect(screen.getByPlaceholderText("ابحث عن...")).toBeInTheDocument();
  });

  it("calls onChange with value", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
    expect(onChange).toHaveBeenCalledWith("test");
  });

  it("shows clear button when value exists", () => {
    render(<SearchInput value="test" onChange={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("does not show clear button when value is empty", () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onClear when clear button clicked", () => {
    const onClear = vi.fn();
    render(<SearchInput value="test" onChange={() => {}} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalled();
  });

  it("calls onChange('') when no onClear and button clicked", () => {
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows loading spinner when loading is true", () => {
    render(<SearchInput value="test" onChange={() => {}} loading />);
    expect(screen.getByRole("textbox").parentElement?.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("calls onFocus and onBlur", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(<SearchInput value="" onChange={() => {}} onFocus={onFocus} onBlur={onBlur} />);
    fireEvent.focus(screen.getByRole("textbox"));
    expect(onFocus).toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onBlur).toHaveBeenCalled();
  });

  it("handles autoFocus", () => {
    render(<SearchInput value="" onChange={() => {}} autoFocus />);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
});
