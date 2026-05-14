import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePosStore } from "../posStore";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));
vi.mock("../../services/api", () => ({ default: mockApi }));

function makeItem(id = 1, overrides = {}) {
  return { id, name: `Item ${id}`, sale_price: 10, quantity: 2, ...overrides };
}

describe("posStore", () => {
  beforeEach(() => {
    usePosStore.setState({
      lines: [],
      customer: null,
      discount: 0,
      increase: 0,
      promotionDiscount: 0,
      appliedPromotions: [],
      paymentType: "cash",
      search: "",
      activeCategory: "all",
      heldInvoices: [],
    });
    vi.clearAllMocks();
  });

  it("starts with empty cart", () => {
    const state = usePosStore.getState();
    expect(state.lines).toEqual([]);
    expect(state.getTotals()).toEqual({ subtotal: 0, total: 0 });
  });

  describe("addLine", () => {
    it("adds a new item to empty cart", () => {
      usePosStore.getState().addLine(makeItem(1));
      expect(usePosStore.getState().lines).toHaveLength(1);
      expect(usePosStore.getState().lines[0].item_id).toBe(1);
    });

    it("increments quantity when adding existing item", () => {
      usePosStore.getState().addLine(makeItem(1, { quantity: 2 }));
      usePosStore.getState().addLine(makeItem(1, { quantity: 3 }));
      expect(usePosStore.getState().lines).toHaveLength(1);
      expect(usePosStore.getState().lines[0].quantity).toBe(5);
    });

    it("calls evaluateCart after add", async () => {
      mockApi.post.mockResolvedValue({ data: { data: { discount: 5, applied_promotions: [] } } });
      usePosStore.getState().addLine(makeItem(1));
      await vi.waitFor(() => {
        expect(usePosStore.getState().promotionDiscount).toBe(5);
      });
    });
  });

  describe("updateLine", () => {
    it("updates a specific line by item_id", () => {
      usePosStore.setState({ lines: [{ item_id: 1, quantity: 2, unit_price: 10, line_discount: 0 }] });
      usePosStore.getState().updateLine(1, { quantity: 5 });
      expect(usePosStore.getState().lines[0].quantity).toBe(5);
    });

    it("only updates the matching line", () => {
      usePosStore.setState({
        lines: [
          { item_id: 1, quantity: 2, unit_price: 10, line_discount: 0 },
          { item_id: 2, quantity: 1, unit_price: 20, line_discount: 0 },
        ],
      });
      usePosStore.getState().updateLine(1, { quantity: 99 });
      expect(usePosStore.getState().lines[0].quantity).toBe(99);
      expect(usePosStore.getState().lines[1].quantity).toBe(1);
    });
  });

  describe("removeLine", () => {
    it("removes line by item_id", () => {
      usePosStore.setState({ lines: [{ item_id: 1 }, { item_id: 2 }] });
      usePosStore.getState().removeLine(1);
      expect(usePosStore.getState().lines).toHaveLength(1);
      expect(usePosStore.getState().lines[0].item_id).toBe(2);
    });
  });

  describe("setCustomer", () => {
    it("sets the customer", () => {
      const customer = { id: 5, name: "أحمد" };
      usePosStore.getState().setCustomer(customer);
      expect(usePosStore.getState().customer).toEqual(customer);
    });

    it("sets customer to null", () => {
      usePosStore.setState({ customer: { id: 5 } });
      usePosStore.getState().setCustomer(null);
      expect(usePosStore.getState().customer).toBeNull();
    });
  });

  describe("setDiscount / setIncrease", () => {
    it("setDiscount stores number", () => {
      usePosStore.getState().setDiscount("10");
      expect(usePosStore.getState().discount).toBe(10);
    });

    it("setDiscount handles null/undefined", () => {
      usePosStore.getState().setDiscount(null);
      expect(usePosStore.getState().discount).toBe(0);
    });

    it("setIncrease clamps to 0", () => {
      usePosStore.getState().setIncrease(-5);
      expect(usePosStore.getState().increase).toBe(0);
    });
  });

  describe("getTotals", () => {
    it("calculates subtotal and total", () => {
      usePosStore.setState({
        lines: [{ quantity: 2, unit_price: 10, line_discount: 0 }],
      });
      const totals = usePosStore.getState().getTotals();
      expect(totals.subtotal).toBe(20);
      expect(totals.total).toBe(20);
    });

    it("applies discount", () => {
      usePosStore.setState({
        lines: [{ quantity: 2, unit_price: 10, line_discount: 0 }],
        discount: 5,
      });
      expect(usePosStore.getState().getTotals().total).toBe(15);
    });

    it("applies promotionDiscount", () => {
      usePosStore.setState({
        lines: [{ quantity: 2, unit_price: 10, line_discount: 0 }],
        promotionDiscount: 3,
      });
      expect(usePosStore.getState().getTotals().total).toBe(17);
    });

    it("applies increase", () => {
      usePosStore.setState({
        lines: [{ quantity: 2, unit_price: 10, line_discount: 0 }],
        increase: 5,
      });
      expect(usePosStore.getState().getTotals().total).toBe(25);
    });
  });

  describe("holdInvoice / resume", () => {
    it("holdCurrentInvoice saves and clears state", () => {
      usePosStore.setState({
        lines: [{ quantity: 2, unit_price: 10, line_discount: 0 }],
        customer: { id: 1 },
        discount: 5,
      });
      usePosStore.getState().holdCurrentInvoice();
      const state = usePosStore.getState();
      expect(state.lines).toEqual([]);
      expect(state.customer).toBeNull();
      expect(state.heldInvoices).toHaveLength(1);
      expect(state.heldInvoices[0].lines).toHaveLength(1);
    });

    it("does not hold empty cart", () => {
      usePosStore.getState().holdCurrentInvoice();
      expect(usePosStore.getState().heldInvoices).toEqual([]);
    });

    it("limits held invoices to 4", () => {
      for (let i = 0; i < 5; i++) {
        usePosStore.setState({ lines: [{ item_id: i, quantity: 1, unit_price: 10, line_discount: 0 }] });
        usePosStore.getState().holdCurrentInvoice();
      }
      expect(usePosStore.getState().heldInvoices).toHaveLength(4);
    });

    it("resumeHeldInvoice restores and removes from held", () => {
      usePosStore.setState({
        lines: [{ item_id: 1, quantity: 2, unit_price: 10, line_discount: 0 }],
      });
      usePosStore.getState().holdCurrentInvoice();
      usePosStore.getState().resumeHeldInvoice(usePosStore.getState().heldInvoices[0].id);
      const state = usePosStore.getState();
      expect(state.lines).toHaveLength(1);
      expect(state.heldInvoices).toHaveLength(0);
    });

    it("resumeHeldInvoice no-ops for unknown id", () => {
      usePosStore.setState({ lines: [{ item_id: 1, quantity: 2, unit_price: 10, line_discount: 0 }] });
      usePosStore.getState().holdCurrentInvoice();
      usePosStore.getState().resumeHeldInvoice("nonexistent");
      expect(usePosStore.getState().heldInvoices).toHaveLength(1);
    });
  });

  describe("discardHeldInvoice", () => {
    it("removes a held invoice by id", () => {
      usePosStore.setState({
        lines: [{ item_id: 1, quantity: 2, unit_price: 10, line_discount: 0 }],
      });
      usePosStore.getState().holdCurrentInvoice();
      const heldId = usePosStore.getState().heldInvoices[0].id;
      usePosStore.getState().discardHeldInvoice(heldId);
      expect(usePosStore.getState().heldInvoices).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("resets entire state", () => {
      usePosStore.setState({
        lines: [{ item_id: 1 }],
        customer: { id: 1 },
        discount: 5,
        increase: 2,
        paymentType: "credit",
      });
      usePosStore.getState().clear();
      const state = usePosStore.getState();
      expect(state.lines).toEqual([]);
      expect(state.customer).toBeNull();
      expect(state.discount).toBe(0);
      expect(state.increase).toBe(0);
      expect(state.paymentType).toBe("cash");
    });
  });
});
