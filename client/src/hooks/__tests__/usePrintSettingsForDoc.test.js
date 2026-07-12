import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePrintSettingsForDoc } from "../usePrintSettingsForDoc";

const mockApiGet = vi.hoisted(() => vi.fn());
vi.mock("../../services/api", () => ({ default: { get: mockApiGet } }));

function mockRoutes(routes) {
  mockApiGet.mockImplementation((url) => {
    for (const [prefix, data] of routes) {
      if (url.startsWith(prefix)) return Promise.resolve({ data: { data } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
}

describe("usePrintSettingsForDoc", () => {
  beforeEach(() => { mockApiGet.mockReset(); });

  it("defaults to the doc type's default paper size when nothing is saved", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", {}],
      ["/api/print-settings-per-doc/_global", {}],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.template).toBe("80mm");
  });

  it("uses the doc's explicit paper_size override", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/sales_return", { paper_size: "A4" }],
      ["/api/print-settings-per-doc/_global", {}],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("sales_return"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.template).toBe("A4");
  });

  it("inherits the _global scope's roll layout by default", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", {}],
      ["/api/print-settings-per-doc/_global", { layout: { roll: { headerStyle: "logo-center" } } }],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.layout.roll.headerStyle).toBe("logo-center");
  });

  it("uses the doc's own layout when it opts out of global inheritance", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", { inherit_global_roll: false, layout: { roll: { headerStyle: "logo-right" } } }],
      ["/api/print-settings-per-doc/_global", { layout: { roll: { headerStyle: "logo-center" } } }],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.layout.roll.headerStyle).toBe("logo-right");
  });

  it("merges flat doc-level fields over global settings when not inheriting", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", { inherit_global_roll: false, print_font: "cairo" }],
      ["/api/print-settings-per-doc/_global", { print_font: "tajawal" }],
      ["/api/settings", { company_name: "My Shop" }],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.print_font).toBe("cairo");
    expect(result.current.settings.company_name).toBe("My Shop");
  });

  it("does nothing when docType is falsy", () => {
    const { result } = renderHook(() => usePrintSettingsForDoc(null));
    expect(result.current.loading).toBe(false);
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
