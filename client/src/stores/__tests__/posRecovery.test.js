import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDB = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  objectStoreNames: { contains: vi.fn() },
  createObjectStore: vi.fn(),
}));

const mockOpenDB = vi.hoisted(() => vi.fn().mockResolvedValue(mockDB));
vi.mock("idb", () => ({ openDB: mockOpenDB }));

describe("posRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveCart", () => {
    it("saves cart to IndexedDB", async () => {
      const { saveCart } = await import("../posRecovery");
      const cart = { lines: [{ item_id: 1, quantity: 2 }] };
      await saveCart(cart);
      expect(mockOpenDB).toHaveBeenCalledWith("retailer-pos", 1, expect.any(Object));
      expect(mockDB.put).toHaveBeenCalledWith("cart", cart, "current");
    });

    it("upgrade creates cart store if not exists", async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(false);
      const { saveCart } = await import("../posRecovery");
      await saveCart({});
      mockOpenDB.mock.calls[0][2].upgrade(mockDB);
      expect(mockDB.createObjectStore).toHaveBeenCalledWith("cart");
    });

    it("upgrade skips if cart store exists", async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(true);
      const { saveCart } = await import("../posRecovery");
      await saveCart({});
      mockOpenDB.mock.calls[0][2].upgrade(mockDB);
      expect(mockDB.createObjectStore).not.toHaveBeenCalled();
    });
  });

  describe("loadCart", () => {
    it("loads cart from IndexedDB", async () => {
      const { loadCart } = await import("../posRecovery");
      const expected = { lines: [{ item_id: 1, quantity: 2 }] };
      mockDB.get.mockResolvedValue(expected);
      const result = await loadCart();
      expect(result).toEqual(expected);
      expect(mockDB.get).toHaveBeenCalledWith("cart", "current");
    });

    it("returns undefined when no saved cart", async () => {
      const { loadCart } = await import("../posRecovery");
      mockDB.get.mockResolvedValue(undefined);
      const result = await loadCart();
      expect(result).toBeUndefined();
    });
  });
});
