import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useLocalStorage from "../useLocalStorage";

describe("useLocalStorage", () => {
  const store = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => { store[key] = value; });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => { delete store[key]; });
  });

  it("returns initial value when key does not exist", () => {
    const { result } = renderHook(() => useLocalStorage("nonexistent", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads existing value from localStorage", () => {
    store["mykey"] = JSON.stringify("stored");
    const { result } = renderHook(() => useLocalStorage("mykey", "default"));
    expect(result.current[0]).toBe("stored");
  });

  it("persists to localStorage on setValue", () => {
    const { result } = renderHook(() => useLocalStorage("key2", "default"));
    act(() => { result.current[1]("newvalue"); });
    expect(result.current[0]).toBe("newvalue");
    expect(JSON.parse(store["key2"])).toBe("newvalue");
  });

  it("handles object values", () => {
    const obj = { a: 1, b: [2, 3] };
    const { result } = renderHook(() => useLocalStorage("obj", {}));
    act(() => { result.current[1](obj); });
    expect(result.current[0]).toEqual(obj);
    expect(JSON.parse(store["obj"])).toEqual(obj);
  });

  it("handles array values", () => {
    const arr = [1, 2, 3];
    const { result } = renderHook(() => useLocalStorage("arr", []));
    act(() => { result.current[1](arr); });
    expect(result.current[0]).toEqual(arr);
  });

  it("handles null initial value", () => {
    const { result } = renderHook(() => useLocalStorage("nullkey", null));
    expect(result.current[0]).toBeNull();
  });

  it("handles corrupted JSON gracefully", () => {
    store["corrupt"] = "{bad json";
    const { result } = renderHook(() => useLocalStorage("corrupt", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("returns setValue function that updates state", () => {
    const { result } = renderHook(() => useLocalStorage("fnkey", 0));
    act(() => { result.current[1](42); });
    expect(result.current[0]).toBe(42);
  });

  it("supports setValue with updater function", () => {
    const { result } = renderHook(() => useLocalStorage("updater", 0));
    act(() => { result.current[1]((prev) => prev + 1); });
    expect(result.current[0]).toBe(1);
  });

  it("writes to localStorage on every value change", () => {
    const { result } = renderHook(() => useLocalStorage("writes", "a"));
    act(() => { result.current[1]("b"); });
    expect(JSON.parse(store["writes"])).toBe("b");
    act(() => { result.current[1]("c"); });
    expect(JSON.parse(store["writes"])).toBe("c");
  });
});
