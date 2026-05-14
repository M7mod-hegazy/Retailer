import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingSpinner from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders without text by default", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders with text when provided", () => {
    render(<LoadingSpinner text="جاري التحميل..." />);
    expect(screen.getByText("جاري التحميل...")).toBeInTheDocument();
  });

  it("uses md size by default", () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-8 w-8");
  });

  it("uses sm size", () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-4 w-4");
  });

  it("uses lg size", () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-12 w-12");
  });

  it("has animate-spin class on SVG", () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("animate-spin");
  });
});
