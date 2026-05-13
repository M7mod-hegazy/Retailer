import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import api from "../services/api";

function computeTotals(lines, discount, increase) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unit_price - Number(line.line_discount || 0),
    0,
  );
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(increase || 0));
  return { subtotal, total };
}

export const usePosStore = create(
  persist(
    (set, get) => ({
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
      evaluateCart: async () => {
        const { lines } = get();
        if (!lines.length) {
          set({ promotionDiscount: 0, appliedPromotions: [] });
          return;
        }
        try {
          const response = await api.post("/api/promotions/evaluate", { lines });
          set({
            promotionDiscount: Number(response.data?.data?.discount || 0),
            appliedPromotions: response.data?.data?.applied_promotions || [],
          });
        } catch {
          set({ promotionDiscount: 0, appliedPromotions: [] });
        }
      },
      addLine: (item) => {
        set((state) => {
          const existing = state.lines.find((line) => line.item_id === item.id);
          const nextQuantity = Number(item.quantity || 1);
          const nextPrice = Number(item.sale_price || item.unit_price || item.price || 0);
          const nextDiscount = Number(item.line_discount || 0);
          const lines = existing
            ? state.lines.map((line) =>
                line.item_id === item.id
                  ? {
                      ...line,
                      quantity: line.quantity + nextQuantity,
                      unit_price: nextPrice || line.unit_price,
                      line_discount: nextDiscount || line.line_discount || 0,
                      warehouse_id: item.warehouse_id || line.warehouse_id,
                      warehouse_name: item.warehouse_name || line.warehouse_name,
                      category_name: item.category_name || line.category_name,
                      unit_name: item.unit_name || line.unit_name,
                      item_barcode: item.barcode || item.item_barcode || line.item_barcode,
                      code: item.code || line.code,
                      primary_image_url: item.primary_image_url || line.primary_image_url || null,
                    }
                  : line,
              )
            : [
                ...state.lines,
                {
                  item_id: item.id,
                  item_name: item.name,
                  item_barcode: item.barcode || item.item_barcode || "",
                  code: item.code || item.item_code || "",
                  primary_image_url: item.primary_image_url || null,
                  quantity: nextQuantity,
                  unit_price: nextPrice,
                  line_discount: nextDiscount,
                  warehouse_id: item.warehouse_id || null,
                  warehouse_name: item.warehouse_name || "",
                  category_name: item.category_name || "",
                  unit_name: item.unit_name || "",
                  stock_quantity: Number(item.stock_quantity || item.stock || 0),
                },
              ];
          return { lines };
        });
        get().evaluateCart();
      },
      updateLine: (itemId, patch) => {
        set((state) => ({
          lines: state.lines.map((line) => (line.item_id === itemId ? { ...line, ...patch } : line)),
        }));
        get().evaluateCart();
      },
      removeLine: (itemId) => {
        set((state) => ({
          lines: state.lines.filter((line) => line.item_id !== itemId),
        }));
        get().evaluateCart();
      },
      setCustomer: (customer) => set({ customer }),
      setDiscount: (discount) => set({ discount: Number(discount || 0) }),
      setIncrease: (increase) => set({ increase: Math.max(0, Number(increase || 0)) }),
      setPaymentType: (paymentType) => set({ paymentType }),
      setSearch: (search) => set({ search }),
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      holdCurrentInvoice: () => {
        const state = get();
        if (!state.lines.length) return;
        const totals = computeTotals(
          state.lines,
          Number(state.discount || 0) + Number(state.promotionDiscount || 0),
          Number(state.increase || 0),
        );
        const slot = {
          id: `held-${Date.now()}`,
          heldAt: new Date().toISOString(),
          heldTotal: totals.total,
          heldSubtotal: totals.subtotal,
          linesCount: state.lines.length,
          lines: state.lines,
          customer: state.customer,
          discount: state.discount,
          increase: state.increase,
          promotionDiscount: state.promotionDiscount,
          appliedPromotions: state.appliedPromotions,
          paymentType: state.paymentType,
        };
        set({
          heldInvoices: [slot, ...state.heldInvoices].slice(0, 4),
          lines: [],
          customer: null,
          discount: 0,
          increase: 0,
          promotionDiscount: 0,
          appliedPromotions: [],
          paymentType: "cash",
        });
      },
      discardHeldInvoice: (id) => set((state) => ({ heldInvoices: state.heldInvoices.filter((h) => h.id !== id) })),
      resumeHeldInvoice: (id) => {
        const state = get();
        const held = state.heldInvoices.find((entry) => entry.id === id);
        if (!held) return;
        set({
          heldInvoices: state.heldInvoices.filter((entry) => entry.id !== id),
          lines: held.lines,
          customer: held.customer,
          discount: held.discount,
          increase: held.increase || 0,
          promotionDiscount: held.promotionDiscount,
          appliedPromotions: held.appliedPromotions,
          paymentType: held.paymentType,
        });
      },
      clear: () => set({ lines: [], customer: null, discount: 0, increase: 0, promotionDiscount: 0, appliedPromotions: [], paymentType: "cash", search: "", activeCategory: "all" }),
      getTotals: () => computeTotals(
        get().lines,
        Number(get().discount || 0) + Number(get().promotionDiscount || 0),
        Number(get().increase || 0),
      ),
    }),
    {
      name: "pos-crash-recovery-storage", 
      storage: createJSONStorage(() => localStorage), 
      partialize: (state) => ({ 
        lines: state.lines, 
        customer: state.customer, 
        discount: state.discount, 
        increase: state.increase,
        promotionDiscount: state.promotionDiscount,
        appliedPromotions: state.appliedPromotions,
        paymentType: state.paymentType,
        heldInvoices: state.heldInvoices,
      }),
    }
  )
);
