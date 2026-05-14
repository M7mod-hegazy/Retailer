import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgressBar from "../ProgressBar";

describe("ProgressBar", () => {
  it("renders progress bar", () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelector('[class*="rounded-full"]')).toBeInTheDocument();
  });

  it("sets width based on value/max ratio", () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    const bar = container.querySelector('[style*="width"]');
    expect(bar?.getAttribute("style")).toContain("50%");
  });

  it("clamps to 100% when value exceeds max", () => {
    const { container } = render(<ProgressBar value={150} max={100} />);
    const bar = container.querySelector('[style*="width"]');
    expect(bar?.getAttribute("style")).toContain("100%");
  });

  it("clamps to 0% when value is negative", () => {
    const { container } = render(<ProgressBar value={-10} max={100} />);
    const bar = container.querySelector('[style*="width"]');
    expect(bar?.getAttribute("style")).toContain("0%");
  });

  it("shows label when showLabel is true", () => {
    render(<ProgressBar value={75} showLabel />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("does not show label by default", () => {
    render(<ProgressBar value={75} />);
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });

  it("uses blue gradient by default", () => {
    const { container } = render(<ProgressBar value={50} />);
    const bar = container.querySelector('[class*="bg-gradient"]');
    expect(bar?.className).toContain("from-info-DEFAULT");
  });

  it("uses specified color gradient", () => {
    const { container } = render(<ProgressBar value={50} color="red" />);
    const bar = container.querySelector('[class*="bg-gradient"]');
    expect(bar?.className).toContain("from-danger-DEFAULT");
  });
});
