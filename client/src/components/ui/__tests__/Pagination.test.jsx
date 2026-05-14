import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "../Pagination";

describe("Pagination", () => {
  it("returns null when totalPages <= 1", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders page buttons", () => {
    render(<Pagination page={3} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("highlights current page", () => {
    render(<Pagination page={3} totalPages={5} onPageChange={() => {}} />);
    const currentBtn = screen.getByText("3");
    expect(currentBtn.className).toContain("bg-primary");
  });

  it("disables prev button on first page", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<Pagination page={5} totalPages={5} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it("calls onPageChange with page - 1 when clicking prev", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with page + 1 when clicking next", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("calls onPageChange with page number when clicking specific page", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("5"));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it("shows ellipsis when many pages", () => {
    const { container } = render(<Pagination page={10} totalPages={20} onPageChange={() => {}} />);
    const ellipsis = container.querySelectorAll("span");
    expect(ellipsis.length).toBeGreaterThan(0);
  });

  it("shows window of 5 pages around current", () => {
    render(<Pagination page={8} totalPages={20} onPageChange={() => {}} />);
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText("5")).toBeFalsy();
    expect(screen.queryByText("11")).toBeFalsy();
  });
});
