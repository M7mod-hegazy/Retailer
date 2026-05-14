import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrint } from "../usePrint";

describe("usePrint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a ref object", () => {
    const { result } = renderHook(() => usePrint());
    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });

  it("returns a print function", () => {
    const { result } = renderHook(() => usePrint());
    expect(typeof result.current.print).toBe("function");
  });

  it("calls window.print when print() is invoked and ref is set", () => {
    window.print = vi.fn();
    const { result } = renderHook(() => usePrint());
    result.current.ref.current = document.createElement("div");
    result.current.print();
    expect(window.print).toHaveBeenCalledOnce();
  });

  it("does NOT call window.print when ref.current is null", () => {
    window.print = vi.fn();
    const { result } = renderHook(() => usePrint());
    result.current.print();
    expect(window.print).not.toHaveBeenCalled();
  });

  it("does not throw when ref.current is set", () => {
    window.print = vi.fn();
    const { result } = renderHook(() => usePrint());
    result.current.ref.current = document.createElement("div");
    expect(() => result.current.print()).not.toThrow();
  });
});
