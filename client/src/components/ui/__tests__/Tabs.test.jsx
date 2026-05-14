import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../Tabs";

const tabs = [
  { value: "all", label: "الكل" },
  { value: "active", label: "نشط" },
  { value: "archived", label: "مؤرشف" },
];

describe("Tabs", () => {
  it("renders all tabs", () => {
    render(<Tabs tabs={tabs} active="all" onChange={() => {}} />);
    expect(screen.getByText("الكل")).toBeInTheDocument();
    expect(screen.getByText("نشط")).toBeInTheDocument();
    expect(screen.getByText("مؤرشف")).toBeInTheDocument();
  });

  it("highlights active tab", () => {
    render(<Tabs tabs={tabs} active="active" onChange={() => {}} />);
    const activeBtn = screen.getByText("نشط");
    expect(activeBtn.className).toContain("font-bold");
  });

  it("calls onChange with tab value on click", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="all" onChange={onChange} />);
    fireEvent.click(screen.getByText("مؤرشف"));
    expect(onChange).toHaveBeenCalledWith("archived");
  });

  it("renders nothing when tabs array is empty", () => {
    const { container } = render(<Tabs tabs={[]} active="" onChange={() => {}} />);
    expect(container.querySelector("div")?.children.length || 0).toBe(0);
  });
});
