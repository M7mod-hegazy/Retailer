import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useMediaQuery from "../useMediaQuery";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") {
          window.matchMedia.__listeners = window.matchMedia.__listeners || [];
          window.matchMedia.__listeners.push(handler);
        }
      }),
      removeEventListener: vi.fn((event) => {
        if (event === "change") {
          window.matchMedia.__listeners = [];
        }
      }),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function triggerMatchMediaChange(matches) {
  const listeners = window.matchMedia.__listeners || [];
  listeners.forEach((handler) => handler({ matches }));
}

describe("useMediaQuery", () => {
  it("returns true when query matches", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when query does not match", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);
  });

  it("updates when match changes", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
    act(() => { triggerMatchMediaChange(false); });
    expect(result.current).toBe(false);
  });

  it("updates back to true when match restores", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    act(() => { triggerMatchMediaChange(false); });
    expect(result.current).toBe(false);
    act(() => { triggerMatchMediaChange(true); });
    expect(result.current).toBe(true);
  });

  it("handles complex media queries", () => {
    window.matchMedia.mockImplementation((query) => ({
      matches: query === "(min-width: 768px) and (max-width: 1024px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px) and (max-width: 1024px)"));
    expect(result.current).toBe(true);
  });

  it("handles empty query string", () => {
    window.matchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useMediaQuery(""));
    expect(result.current).toBe(false);
  });

  it("removes event listener on unmount", () => {
    const removeSpy = vi.fn();
    window.matchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: removeSpy,
      dispatchEvent: vi.fn(),
    }));
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });
});
