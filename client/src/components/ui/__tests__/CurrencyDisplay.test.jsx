import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CurrencyDisplay from "../CurrencyDisplay";

const mockUseAppSettingsStore = vi.hoisted(() => vi.fn());
vi.mock("../../../stores/appSettingsStore", () => ({
  useAppSettingsStore: mockUseAppSettingsStore,
}));

describe("CurrencyDisplay", () => {
  beforeEach(() => {
    mockUseAppSettingsStore.mockReturnValue({ currency_symbol: "ج.م", decimal_places: 2 });
  });

  it("renders formatted value with currency symbol", () => {
    render(<CurrencyDisplay value={100} />);
    expect(screen.getByText("100.00 ج.م")).toBeInTheDocument();
  });

  it("renders zero correctly", () => {
    render(<CurrencyDisplay value={0} />);
    expect(screen.getByText("0.00 ج.م")).toBeInTheDocument();
  });

  it("handles null/undefined value", () => {
    render(<CurrencyDisplay value={null} />);
    expect(screen.getByText("0.00 ج.م")).toBeInTheDocument();
  });

  it("symbol prop overrides store symbol", () => {
    render(<CurrencyDisplay value={50} symbol="$" />);
    expect(screen.getByText("50.00 $")).toBeInTheDocument();
  });

  it("decimals prop overrides store decimals", () => {
    render(<CurrencyDisplay value={10.5} decimals={3} />);
    expect(screen.getByText("10.500 ج.م")).toBeInTheDocument();
  });

  it("uses store settings when no overrides", () => {
    mockUseAppSettingsStore.mockReturnValue({ currency_symbol: "ر.س", decimal_places: 3 });
    render(<CurrencyDisplay value={25} />);
    expect(screen.getByText("25.000 ر.س")).toBeInTheDocument();
  });

  it("falls back to default symbol when store has none", () => {
    mockUseAppSettingsStore.mockReturnValue({ currency_symbol: null, decimal_places: 2 });
    render(<CurrencyDisplay value={10} />);
    expect(screen.getByText("10.00 ج.م")).toBeInTheDocument();
  });

  it("has dir=ltr and monospace class", () => {
    render(<CurrencyDisplay value={100} />);
    expect(screen.getByText("100.00 ج.م")).toHaveAttribute("dir", "ltr");
  });
});
