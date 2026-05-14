import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "../Badge";

describe("Badge", () => {
  it("renders label text", () => {
    render(<Badge label="نشط" />);
    expect(screen.getByText("نشط")).toBeInTheDocument();
  });

  it("uses blue color mapping to info variant by default", () => {
    render(<Badge label="Test" />);
    expect(screen.getByText("Test")).toHaveClass("badge--info");
  });

  it("maps green to success variant", () => {
    render(<Badge label="OK" color="green" />);
    expect(screen.getByText("OK")).toHaveClass("badge--success");
  });

  it("maps red to danger variant", () => {
    render(<Badge label="Error" color="red" />);
    expect(screen.getByText("Error")).toHaveClass("badge--danger");
  });

  it("maps yellow to warning variant", () => {
    render(<Badge label="Warn" color="yellow" />);
    expect(screen.getByText("Warn")).toHaveClass("badge--warning");
  });

  it("maps gray to neutral variant", () => {
    render(<Badge label="Info" color="gray" />);
    expect(screen.getByText("Info")).toHaveClass("badge--neutral");
  });

  it("maps purple to primary variant", () => {
    render(<Badge label="VIP" color="purple" />);
    expect(screen.getByText("VIP")).toHaveClass("badge--primary");
  });

  it("variant prop overrides color mapping", () => {
    render(<Badge label="Override" color="red" variant="badge--warning" />);
    expect(screen.getByText("Override")).toHaveClass("badge--warning");
  });

  it("falls back to neutral for unknown color", () => {
    render(<Badge label="Unknown" color="pink" />);
    expect(screen.getByText("Unknown")).toHaveClass("badge--neutral");
  });
});
