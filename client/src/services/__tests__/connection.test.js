import { describe, it, expect } from "vitest";
import {
  classifyConnectionError,
  createDisconnectTracker,
  buildErrorReport,
  buildSupportReport,
} from "../connection";

describe("classifyConnectionError", () => {
  it("treats a server HTTP response (any status) as 'http' — server is up", () => {
    expect(classifyConnectionError({ response: { status: 503 } })).toBe("http");
    expect(classifyConnectionError({ response: { status: 500 } })).toBe("http");
  });

  it("treats our own aborted/timed-out request as 'timeout' (busy, not down)", () => {
    expect(classifyConnectionError({ code: "ECONNABORTED" })).toBe("timeout");
    expect(classifyConnectionError({ code: "ETIMEDOUT" })).toBe("timeout");
    expect(classifyConnectionError({ message: "timeout of 8000ms exceeded" })).toBe("timeout");
  });

  it("treats a real connection failure as 'disconnect'", () => {
    expect(classifyConnectionError({ code: "ERR_NETWORK" })).toBe("disconnect");
    expect(classifyConnectionError({ code: "ECONNREFUSED" })).toBe("disconnect");
    expect(classifyConnectionError({})).toBe("disconnect");
  });
});

describe("createDisconnectTracker", () => {
  it("does NOT go offline on a single transient failure", () => {
    const t = createDisconnectTracker({ threshold: 3 });
    expect(t.record({ code: "ERR_NETWORK" }).offline).toBe(false);
    expect(t.record({ response: { status: 503 } }).offline).toBe(false);
  });

  it("goes offline only after `threshold` consecutive real/http failures", () => {
    const t = createDisconnectTracker({ threshold: 3 });
    t.record({ code: "ERR_NETWORK" });
    t.record({ code: "ERR_NETWORK" });
    expect(t.record({ code: "ERR_NETWORK" }).offline).toBe(true);
  });

  it("ignores timeouts — a busy server never counts toward offline", () => {
    const t = createDisconnectTracker({ threshold: 3 });
    t.record({ code: "ECONNABORTED" });
    t.record({ code: "ECONNABORTED" });
    t.record({ code: "ECONNABORTED" });
    expect(t.record({ code: "ECONNABORTED" }).offline).toBe(false);
  });

  it("a single success immediately clears offline state and resets the counter", () => {
    const t = createDisconnectTracker({ threshold: 3 });
    t.record({ code: "ERR_NETWORK" });
    t.record({ code: "ERR_NETWORK" });
    t.record({ code: "ERR_NETWORK" });
    expect(t.success().offline).toBe(false);
    // counter reset → needs full threshold again
    expect(t.record({ code: "ERR_NETWORK" }).offline).toBe(false);
  });
});

describe("buildErrorReport", () => {
  it("includes status, code, url, baseURL and the bridge response body", () => {
    const report = buildErrorReport(
      {
        code: "ERR_BAD_RESPONSE",
        message: "Request failed with status code 502",
        config: { url: "/api/settings", method: "get", baseURL: "retailer://local" },
        response: { status: 502, data: "bridge error: socket hang up" },
      },
      { context: "settings" },
    );
    expect(report).toContain("settings");
    expect(report).toContain("502");
    expect(report).toContain("ERR_BAD_RESPONSE");
    expect(report).toContain("/api/settings");
    expect(report).toContain("retailer://local");
    expect(report).toContain("bridge error: socket hang up");
  });
});

describe("buildSupportReport", () => {
  it("includes the base error report and the injected transport base, without Electron", async () => {
    window.__API_BASE__ = "retailer://local";
    const report = await buildSupportReport(
      { code: "ERR_NETWORK", message: "Network Error", config: { url: "/api/health" } },
      { context: "POS /api/health" },
    );
    expect(report).toContain("ERR_NETWORK");
    expect(report).toContain("POS /api/health");
    expect(report).toContain("injectedApiBase: retailer://local");
    delete window.__API_BASE__;
  });

  it("appends server diagnostics when the Electron bridge is present", async () => {
    window.electronAPI = {
      invoke: async (ch) =>
        ch === "diag:get-report"
          ? {
              report: { cause: "db-corrupt", startError: { code: "SQLITE_CORRUPT", message: "malformed" } },
              logTail: "line1\nline2",
              logDir: "C:/logs",
              port: "5000",
              dbPath: "C:/data/retailer.db",
              appVersion: "1.0.20",
            }
          : null,
    };
    const report = await buildSupportReport({ code: "ERR_NETWORK" }, { context: "x" });
    expect(report).toContain("db-corrupt");
    expect(report).toContain("SQLITE_CORRUPT");
    expect(report).toContain("recent log tail");
    delete window.electronAPI;
  });
});
