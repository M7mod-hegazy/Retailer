import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Select from "../Select";

const options = [
  { value: "", label: "اختر..." },
  { value: "1", label: "خيار 1" },
  { value: "2", label: "خيار 2" },
];

describe("Select", () => {
  it("renders all options", () => {
    render(<Select options={options} />);
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(3);
    expect(opts[0]).toHaveTextContent("اختر...");
    expect(opts[1]).toHaveTextContent("خيار 1");
  });

  it("renders empty when no options", () => {
    render(<Select options={[]} />);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("applies className", () => {
    render(<Select options={options} className="my-class" />);
    expect(screen.getByRole("combobox")).toHaveClass("my-class");
  });

  it("handles onChange", () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("passes value prop", () => {
    render(<Select options={options} value="2" onChange={() => {}} />);
    expect(screen.getByRole("combobox").value).toBe("2");
  });

  it("renders with input class", () => {
    render(<Select options={options} />);
    expect(screen.getByRole("combobox")).toHaveClass("input");
  });
});
