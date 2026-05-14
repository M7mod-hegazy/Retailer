import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDebounce from "../useDebounce";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebounce", () => {
  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update before delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("a");
  });

  it("updates after the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("b");
  });

  it("resets timer on rapid changes (only last value wins)", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: "c" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("c");
  });

  it("uses default delay of 300ms", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe("b");
  });

  it("works with delay of 0", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe("b");
  });

  it("handles undefined value", () => {
    const { result } = renderHook(() => useDebounce(undefined));
    expect(result.current).toBeUndefined();
  });

  it("handles null value", () => {
    const { result } = renderHook(() => useDebounce(null));
    expect(result.current).toBeNull();
  });

  it("handles object values", () => {
    const obj = { a: 1 };
    const { result } = renderHook(() => useDebounce(obj));
    expect(result.current).toBe(obj);
  });

  it("cleans up timer on unmount", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "b" });
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
