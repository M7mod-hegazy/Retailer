import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTour } from "../usePageTour";

const { mockTriggerPageTour, mockUseHelpStore } = vi.hoisted(() => ({
  mockTriggerPageTour: vi.fn(),
  mockUseHelpStore: vi.fn(),
}));

vi.mock("../../stores/helpStore", () => ({
  useHelpStore: mockUseHelpStore,
}));

vi.mock("../../help/helpContent", () => ({
  helpContent: {
    pos: { steps: [{ title: "Step 1" }] },
    purchases: { steps: [{ title: "Step 1" }] },
  },
}));

describe("usePageTour", () => {
  beforeEach(() => {
    mockTriggerPageTour.mockReset();
    vi.useFakeTimers();
  });

  it("triggers tour after 600ms when help is loaded and pageKey exists", () => {
    mockUseHelpStore.mockReturnValue({
      isLoaded: true,
      triggerPageTour: mockTriggerPageTour,
    });
    renderHook(() => usePageTour("pos"));
    vi.advanceTimersByTime(600);
    expect(mockTriggerPageTour).toHaveBeenCalledWith("pos");
  });

  it("does not trigger tour when help is not loaded", () => {
    mockUseHelpStore.mockReturnValue({
      isLoaded: false,
      triggerPageTour: mockTriggerPageTour,
    });
    renderHook(() => usePageTour("pos"));
    vi.advanceTimersByTime(600);
    expect(mockTriggerPageTour).not.toHaveBeenCalled();
  });

  it("does not trigger tour for unknown pageKey", () => {
    mockUseHelpStore.mockReturnValue({
      isLoaded: true,
      triggerPageTour: mockTriggerPageTour,
    });
    renderHook(() => usePageTour("nonexistent_page"));
    vi.advanceTimersByTime(600);
    expect(mockTriggerPageTour).not.toHaveBeenCalled();
  });

  it("clears timer on unmount", () => {
    mockUseHelpStore.mockReturnValue({
      isLoaded: true,
      triggerPageTour: mockTriggerPageTour,
    });
    const { unmount } = renderHook(() => usePageTour("pos"));
    unmount();
    vi.advanceTimersByTime(600);
    expect(mockTriggerPageTour).not.toHaveBeenCalled();
  });

  it("re-triggers when pageKey changes", () => {
    mockUseHelpStore.mockReturnValue({
      isLoaded: true,
      triggerPageTour: mockTriggerPageTour,
    });
    const { rerender } = renderHook(({ key }) => usePageTour(key), {
      initialProps: { key: "pos" },
    });
    vi.advanceTimersByTime(600);
    expect(mockTriggerPageTour).toHaveBeenCalledTimes(1);
    rerender({ key: "purchases" });
    vi.advanceTimersByTime(600);
    expect(mockTriggerPageTour).toHaveBeenCalledTimes(2);
    expect(mockTriggerPageTour).toHaveBeenLastCalledWith("purchases");
  });
});
