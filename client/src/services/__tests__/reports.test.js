import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApi = vi.hoisted(() => ({
  get: mockApiGet,
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
}));
vi.mock("../api", () => ({ default: mockApi }));

describe("reportsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchRegistry", () => {
    it("returns data array from response", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: { data: [{ slug: "sales-summary" }] } });
      const result = await reportsApi.fetchRegistry();
      expect(mockApiGet).toHaveBeenCalledWith("/api/reports/registry");
      expect(result).toEqual([{ slug: "sales-summary" }]);
    });

    it("returns empty array when no data", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: {} });
      const result = await reportsApi.fetchRegistry();
      expect(result).toEqual([]);
    });
  });

  describe("fetchReport", () => {
    it("builds query params from non-empty values", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: {} });
      await reportsApi.fetchReport("sales", { from: "2025-01-01", to: "2025-01-31", customer_id: 5, empty: "", nullVal: null, undef: undefined });
      const calledUrl = mockApiGet.mock.calls[0][0];
      expect(calledUrl).toContain("/api/reports/run/sales?");
      expect(calledUrl).toContain("from=2025-01-01");
      expect(calledUrl).toContain("to=2025-01-31");
      expect(calledUrl).toContain("customer_id=5");
      expect(calledUrl).not.toContain("empty=");
      expect(calledUrl).not.toContain("nullVal=");
      expect(calledUrl).not.toContain("undef=");
    });

    it("returns full response data", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: { rows: [], total: 0 } });
      const result = await reportsApi.fetchReport("sales");
      expect(result).toEqual({ rows: [], total: 0 });
    });

    it("handles no params", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: {} });
      await reportsApi.fetchReport("sales");
      expect(mockApiGet).toHaveBeenCalledWith("/api/reports/run/sales?");
    });
  });

  describe("fetchSourceReport", () => {
    it("sends classification and dataMode as query params", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: {} });
      await reportsApi.fetchSourceReport("invoices", "summary", "daily", { year: 2025 });
      const calledUrl = mockApiGet.mock.calls[0][0];
      expect(calledUrl).toContain("/api/reports/source/invoices/run?");
      expect(calledUrl).toContain("classification=summary");
      expect(calledUrl).toContain("dataMode=daily");
      expect(calledUrl).toContain("year=2025");
    });
  });

  describe("fetchSourceClassifications", () => {
    it("returns classifications from response", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: { data: ["summary", "detail"] } });
      const result = await reportsApi.fetchSourceClassifications("invoices");
      expect(mockApiGet).toHaveBeenCalledWith("/api/reports/source/invoices/classifications");
      expect(result).toEqual(["summary", "detail"]);
    });

    it("returns null when no data", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: {} });
      const result = await reportsApi.fetchSourceClassifications("invoices");
      expect(result).toBeNull();
    });
  });

  describe("exportReport", () => {
    it("builds export URL with format and params", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      await reportsApi.exportReport("sales", "pdf", { from: "2025-01-01" });
      const calledUrl = mockApiGet.mock.calls[0][0];
      expect(calledUrl).toContain("/api/reports/export-slug/sales?");
      expect(calledUrl).toContain("format=pdf");
      expect(calledUrl).toContain("from=2025-01-01");
    });

    it("includes columns JSON when provided", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      const columns = [{ key: "name", label: "Name", type: "string" }];
      await reportsApi.exportReport("sales", "excel", { columns });
      const calledUrl = mockApiGet.mock.calls[0][0];
      expect(calledUrl).toContain("columns=");
      expect(calledUrl).toContain("name");
    });

    it("sets responseType to blob", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      await reportsApi.exportReport("sales", "pdf");
      expect(mockApiGet.mock.calls[0][1]).toMatchObject({ responseType: "blob" });
    });

    it("passes onProgress callback", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      const onProgress = vi.fn();
      await reportsApi.exportReport("sales", "pdf", { onProgress });
      expect(mockApiGet.mock.calls[0][1]).toMatchObject({ onDownloadProgress: onProgress });
    });
  });

  describe("exportRows", () => {
    it("sends rows as JSON string param", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      const rows = [{ name: "test", total: 100 }];
      await reportsApi.exportRows(rows, "excel", "My Export");
      expect(mockApiGet.mock.calls[0][1].params).toMatchObject({
        rows: JSON.stringify(rows),
        format: "excel",
        title: "My Export",
      });
    });

    it("uses default format and title", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      await reportsApi.exportRows([]);
      expect(mockApiGet.mock.calls[0][1].params).toMatchObject({
        format: "excel",
        title: "Export",
      });
    });

    it("sets responseType to blob", async () => {
      const { reportsApi } = await import("../reports");
      mockApiGet.mockResolvedValue({ data: new Blob() });
      await reportsApi.exportRows([]);
      expect(mockApiGet.mock.calls[0][1].responseType).toBe("blob");
    });
  });
});
