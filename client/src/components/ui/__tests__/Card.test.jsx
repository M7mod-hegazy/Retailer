import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies card class by default", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass("card");
  });

  it("applies card-elevated class when elevated is true", () => {
    const { container } = render(<Card elevated>Content</Card>);
    expect(container.firstChild).toHaveClass("card-elevated");
  });

  it("applies card-inset class when inset is true", () => {
    const { container } = render(<Card inset>Content</Card>);
    expect(container.firstChild).toHaveClass("card-inset");
  });

  it("elevated takes priority over inset", () => {
    const { container } = render(<Card elevated inset>Content</Card>);
    expect(container.firstChild).toHaveClass("card-elevated");
    expect(container.firstChild).not.toHaveClass("card-inset");
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild).toHaveClass("custom");
  });

  it("includes padding class", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass("p-4");
  });
});
