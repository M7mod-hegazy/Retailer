import { describe, it, expect, vi, beforeEach } from "vitest";
import { useReportsStore, buildPrefKey } from "../reportsStore";

describe("reportsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useReportsStore.setState({
      preferences: {},
      favorites: new Set(),
      recents: [],
      presets: [],
      sidebarOpen: true,
    });
  });

  describe("buildPrefKey", () => {
    it("builds composite key", () => {
      expect(buildPrefKey("invoices", "summary", "daily")).toBe("invoices.summary.daily");
    });
  });

  describe("sidebarOpen", () => {
    it("starts open", () => {
      expect(useReportsStore.getState().sidebarOpen).toBe(true);
    });

    it("toggleSidebar flips state", () => {
      useReportsStore.getState().toggleSidebar();
      expect(useReportsStore.getState().sidebarOpen).toBe(false);
      useReportsStore.getState().toggleSidebar();
      expect(useReportsStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe("getPreference / setPreference", () => {
    it("returns fallback when no preference set", () => {
      const val = useReportsStore.getState().getPreference("sales", "columnVisibility", "default");
      expect(val).toBe("default");
    });

    it("returns null fallback when not specified", () => {
      const val = useReportsStore.getState().getPreference("sales", "columnVisibility");
      expect(val).toBeNull();
    });

    it("setPreference stores and persists", () => {
      useReportsStore.getState().setPreference("sales", "columnVisibility", { name: true });
      const val = useReportsStore.getState().getPreference("sales", "columnVisibility");
      expect(val).toEqual({ name: true });
    });
  });

  describe("favorites", () => {
    it("toggleFavorite adds new", () => {
      useReportsStore.getState().toggleFavorite("sales-report");
      expect(useReportsStore.getState().favorites.has("sales-report")).toBe(true);
    });

    it("toggleFavorite removes existing", () => {
      useReportsStore.setState({ favorites: new Set(["sales-report"]) });
      useReportsStore.getState().toggleFavorite("sales-report");
      expect(useReportsStore.getState().favorites.has("sales-report")).toBe(false);
    });

    it("persists favorites to localStorage", () => {
      useReportsStore.getState().toggleFavorite("report-1");
      const stored = JSON.parse(localStorage.getItem("reports_favorites"));
      expect(stored).toContain("report-1");
    });
  });

  describe("recents", () => {
    it("pushRecent adds to front", () => {
      useReportsStore.getState().pushRecent("report-a");
      useReportsStore.getState().pushRecent("report-b");
      expect(useReportsStore.getState().recents[0].key).toBe("report-b");
      expect(useReportsStore.getState().recents[1].key).toBe("report-a");
    });

    it("pushRecent deduplicates", () => {
      useReportsStore.getState().pushRecent("report-a");
      useReportsStore.getState().pushRecent("report-b");
      useReportsStore.getState().pushRecent("report-a");
      expect(useReportsStore.getState().recents).toHaveLength(2);
      expect(useReportsStore.getState().recents[0].key).toBe("report-a");
    });

    it("limits recents to 20", () => {
      for (let i = 0; i < 25; i++) useReportsStore.getState().pushRecent(`r-${i}`);
      expect(useReportsStore.getState().recents).toHaveLength(20);
    });
  });

  describe("presets", () => {
    it("savePreset adds a preset", () => {
      useReportsStore.getState().savePreset("My Preset", "sales", { from: "2025-01-01" }, "average");
      const presets = useReportsStore.getState().presets;
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("My Preset");
      expect(presets[0].key).toBe("sales");
    });

    it("deletePreset removes by id", () => {
      useReportsStore.getState().savePreset("P1", "sales", {}, "average");
      const id = useReportsStore.getState().presets[0].id;
      useReportsStore.getState().deletePreset(id);
      expect(useReportsStore.getState().presets).toHaveLength(0);
    });
  });

  describe("setColumnVisibility / setColumnOrder / setColumnWidth / setLastFilters / setCostMethod", () => {
    it("setColumnVisibility stores under key", () => {
      useReportsStore.getState().setColumnVisibility("sales", { name: false });
      expect(useReportsStore.getState().preferences.sales.columnVisibility).toEqual({ name: false });
    });

    it("setColumnOrder stores under key", () => {
      useReportsStore.getState().setColumnOrder("sales", ["name", "total"]);
      expect(useReportsStore.getState().preferences.sales.columnOrder).toEqual(["name", "total"]);
    });

    it("setColumnWidth stores per-column width", () => {
      useReportsStore.getState().setColumnWidth("sales", "name", 150);
      expect(useReportsStore.getState().preferences.sales.columnWidths).toEqual({ name: 150 });
    });

    it("setColumnWidth merges with existing widths", () => {
      useReportsStore.getState().setColumnWidth("sales", "name", 150);
      useReportsStore.getState().setColumnWidth("sales", "total", 200);
      expect(useReportsStore.getState().preferences.sales.columnWidths).toEqual({ name: 150, total: 200 });
    });

    it("setLastFilters stores filters", () => {
      useReportsStore.getState().setLastFilters("sales", { from: "2025-01-01" });
      expect(useReportsStore.getState().preferences.sales.lastFilters).toEqual({ from: "2025-01-01" });
    });

    it("setCostMethod stores method", () => {
      useReportsStore.getState().setCostMethod("sales", "fifo");
      expect(useReportsStore.getState().preferences.sales.costMethod).toBe("fifo");
    });
  });
});
