import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageWrapper from "../PageWrapper";

describe("PageWrapper", () => {
  it("renders children", () => {
    render(<PageWrapper>Content</PageWrapper>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("has page-wrapper class", () => {
    const { container } = render(<PageWrapper>Content</PageWrapper>);
    expect(container.firstChild).toHaveClass("page-wrapper");
  });

  it("has min-h-full class", () => {
    const { container } = render(<PageWrapper>Content</PageWrapper>);
    expect(container.firstChild).toHaveClass("min-h-full");
  });

  it("applies custom className", () => {
    const { container } = render(<PageWrapper className="custom">Content</PageWrapper>);
    expect(container.firstChild).toHaveClass("custom");
  });
});
