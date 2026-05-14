import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDB = vi.hoisted(() => ({
  add: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
  objectStoreNames: { contains: vi.fn() },
  createObjectStore: vi.fn(),
}));

const mockOpenDB = vi.hoisted(() => vi.fn().mockResolvedValue(mockDB));

vi.mock("idb", () => ({ openDB: mockOpenDB }));

const mockToast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));

describe("offlineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOfflineDB", () => {
    it("opens the IndexedDB database", async () => {
      const { getOfflineDB } = await import("../offlineSync");
      const result = await getOfflineDB();
      expect(mockOpenDB).toHaveBeenCalledWith("retailer_offline_db", 1, expect.any(Object));
      expect(result).toBe(mockDB);
    });
  });

  describe("upgrade function", () => {
    it("creates sync_queue store if not exists", async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(false);
      const { getOfflineDB } = await import("../offlineSync");
      await getOfflineDB();
      const upgradeFn = mockOpenDB.mock.calls[0][2].upgrade;
      upgradeFn(mockDB);
      expect(mockDB.createObjectStore).toHaveBeenCalledWith("sync_queue", { keyPath: "id", autoIncrement: true });
    });

    it("skips store creation if already exists", async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(true);
      const { getOfflineDB } = await import("../offlineSync");
      await getOfflineDB();
      const upgradeFn = mockOpenDB.mock.calls[0][2].upgrade;
      upgradeFn(mockDB);
      expect(mockDB.createObjectStore).not.toHaveBeenCalled();
    });
  });

  describe("queueOfflineInvoice", () => {
    it("adds invoice to sync queue with type and timestamp", async () => {
      const { queueOfflineInvoice } = await import("../offlineSync");
      const data = { customer_id: 1, total: 100 };
      await queueOfflineInvoice(data);
      expect(mockDB.add).toHaveBeenCalledWith("sync_queue", {
        type: "INVOICE",
        payload: data,
        timestamp: expect.any(Number),
      });
    });

    it("shows success toast after queuing", async () => {
      const { queueOfflineInvoice } = await import("../offlineSync");
      await queueOfflineInvoice({});
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  describe("syncOfflineData", () => {
    it("returns early when queue is empty", async () => {
      mockDB.getAll.mockResolvedValue([]);
      const { syncOfflineData } = await import("../offlineSync");
      const apiClient = { post: vi.fn() };
      await syncOfflineData(apiClient);
      expect(apiClient.post).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("syncs each invoice and deletes from queue", async () => {
      mockDB.getAll.mockResolvedValue([
        { id: 1, type: "INVOICE", payload: { total: 100 } },
        { id: 2, type: "INVOICE", payload: { total: 50 } },
      ]);
      const apiClient = { post: vi.fn().mockResolvedValue({}) };
      const { syncOfflineData } = await import("../offlineSync");
      await syncOfflineData(apiClient);
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(mockDB.delete).toHaveBeenCalledTimes(2);
      expect(mockDB.delete).toHaveBeenCalledWith("sync_queue", 1);
      expect(mockDB.delete).toHaveBeenCalledWith("sync_queue", 2);
    });

    it("continues syncing when one item fails", async () => {
      mockDB.getAll.mockResolvedValue([
        { id: 1, type: "INVOICE", payload: { total: 100 } },
        { id: 2, type: "INVOICE", payload: { total: 50 } },
      ]);
      const apiClient = {
        post: vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce({}),
      };
      const { syncOfflineData } = await import("../offlineSync");
      await syncOfflineData(apiClient);
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(mockDB.delete).toHaveBeenCalledTimes(1);
      expect(mockDB.delete).toHaveBeenCalledWith("sync_queue", 2);
    });

    it("shows success toast with count", async () => {
      mockDB.getAll.mockResolvedValue([
        { id: 1, type: "INVOICE", payload: { total: 100 } },
      ]);
      const apiClient = { post: vi.fn().mockResolvedValue({}) };
      const { syncOfflineData } = await import("../offlineSync");
      await syncOfflineData(apiClient);
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining("1"),
        expect.any(Object),
      );
    });
  });
});
