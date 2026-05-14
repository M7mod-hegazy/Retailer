import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import StatusDot from "../StatusDot";

describe("StatusDot", () => {
  it("renders a span element", () => {
    const { container } = render(<StatusDot status="active" />);
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("has rounded-full class", () => {
    const { container } = render(<StatusDot status="active" />);
    expect(container.querySelector("span")).toHaveClass("rounded-full");
  });

  it("uses bg-primary for active status", () => {
    const { container } = render(<StatusDot status="active" />);
    expect(container.querySelector("span")).toHaveClass("bg-primary");
  });

  it("uses bg-white/20 for inactive", () => {
    const { container } = render(<StatusDot status="inactive" />);
    expect(container.querySelector("span")).toHaveClass("bg-white/20");
  });

  it("uses bg-warning for warning", () => {
    const { container } = render(<StatusDot status="warning" />);
    expect(container.querySelector("span")).toHaveClass("bg-warning-DEFAULT");
  });

  it("uses bg-danger for error", () => {
    const { container } = render(<StatusDot status="error" />);
    expect(container.querySelector("span")).toHaveClass("bg-danger-DEFAULT");
  });

  it("falls back to inactive for unknown status", () => {
    const { container } = render(<StatusDot status="unknown" />);
    expect(container.querySelector("span")).toHaveClass("bg-white/20");
  });

  it("falls back to inactive for null status", () => {
    const { container } = render(<StatusDot status={null} />);
    expect(container.querySelector("span")).toHaveClass("bg-white/20");
  });
});
