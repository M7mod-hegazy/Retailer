import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useElectron } from "../useElectron";

describe("useElectron", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("returns isElectron=false and null api when no bridge exists", () => {
    globalThis.window = { ...originalWindow };
    delete globalThis.window.electronAPI;
    delete globalThis.window.retailerAPI;
    const result = useElectron();
    expect(result.isElectron).toBe(false);
    expect(result.api).toBeNull();
  });

  it("detects electronAPI bridge", () => {
    const api = { getVersion: vi.fn() };
    globalThis.window = { ...originalWindow, electronAPI: api };
    const result = useElectron();
    expect(result.isElectron).toBe(true);
    expect(result.api).toBe(api);
  });

  it("detects retailerAPI bridge as fallback", () => {
    const api = { getVersion: vi.fn() };
    globalThis.window = { ...originalWindow, retailerAPI: api };
    const result = useElectron();
    expect(result.isElectron).toBe(true);
    expect(result.api).toBe(api);
  });

  it("prefers electronAPI over retailerAPI when both exist", () => {
    const electronApi = { getVersion: vi.fn() };
    const retailerApi = { getVersion: vi.fn() };
    globalThis.window = { ...originalWindow, electronAPI: electronApi, retailerAPI: retailerApi };
    const result = useElectron();
    expect(result.api).toBe(electronApi);
  });

  describe("getVersion", () => {
    it("returns version from bridge when available", () => {
      const api = { getVersion: vi.fn().mockReturnValue("2.1.0") };
      globalThis.window = { ...originalWindow, electronAPI: api };
      expect(useElectron().getVersion()).toBe("2.1.0");
    });

    it("returns 'desktop' when bridge exists but getVersion is undefined", () => {
      const api = {};
      globalThis.window = { ...originalWindow, electronAPI: api };
      expect(useElectron().getVersion()).toBe("desktop");
    });

    it("returns 'web' when no bridge", () => {
      globalThis.window = { ...originalWindow };
      delete globalThis.window.electronAPI;
      delete globalThis.window.retailerAPI;
      expect(useElectron().getVersion()).toBe("web");
    });
  });

  describe("window controls", () => {
    it("minimize calls bridge.minimize when electron", () => {
      const minimize = vi.fn();
      globalThis.window = { ...originalWindow, electronAPI: { minimize } };
      useElectron().minimize();
      expect(minimize).toHaveBeenCalledOnce();
    });

    it("minimize does nothing when not electron", () => {
      globalThis.window = { ...originalWindow };
      delete globalThis.window.electronAPI;
      expect(() => useElectron().minimize()).not.toThrow();
    });

    it("maximize calls bridge.maximize when electron", () => {
      const maximize = vi.fn();
      globalThis.window = { ...originalWindow, electronAPI: { maximize } };
      useElectron().maximize();
      expect(maximize).toHaveBeenCalledOnce();
    });

    it("close calls bridge.close when electron", () => {
      const close = vi.fn();
      globalThis.window = { ...originalWindow, electronAPI: { close } };
      useElectron().close();
      expect(close).toHaveBeenCalledOnce();
    });

    it("handles missing window control methods gracefully", () => {
      globalThis.window = { ...originalWindow, electronAPI: {} };
      expect(() => {
        useElectron().minimize();
        useElectron().maximize();
        useElectron().close();
      }).not.toThrow();
    });
  });
});
