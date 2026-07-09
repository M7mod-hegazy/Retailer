import { create } from "zustand";

const initialState = {
  config: null,
  configured: false,
  connected: false,
  checking: false,
  status: null,
  pendingChanges: [],
  available: { products: [], categories: [], stockChanges: [] },
  logs: [],
  error: null,

  imagePreview: { open: false, product: null, selectedIndex: 0 },
  selectedImages: {},
  fieldSelections: {},
};

export const useSyncStore = create((set, get) => ({
  ...initialState,

  setConfig: (config) =>
    set({ config, configured: !!config }),

  setChecking: (checking) => set({ checking }),

  setStatus: (status) =>
    set({
      status,
      connected: status?.connected || false,
      error: status?.error || null,
    }),

  setAvailable: (available) => {
    const existing = get().fieldSelections || {};
    const fieldSelections = { ...existing };
    const products = available.products || [];
    for (const p of products) {
      if (!fieldSelections[p.sku]) {
        fieldSelections[p.sku] = { name: false, price: false, stock: false, images: false };
      }
    }
    set({ available, fieldSelections });
  },

  setPendingChanges: (pendingChanges) => set({ pendingChanges }),

  setLogs: (logs) => set({ logs }),

  setError: (error) => set({ error }),

  openImagePreview: (product, index = 0) =>
    set({ imagePreview: { open: true, product, selectedIndex: index } }),

  closeImagePreview: () =>
    set({ imagePreview: { open: false, product: null, selectedIndex: 0 } }),

  setImagePreviewIndex: (index) =>
    set((s) => ({ imagePreview: { ...s.imagePreview, selectedIndex: index } })),

  toggleField: (sku, field) =>
    set((s) => ({
      fieldSelections: {
        ...s.fieldSelections,
        [sku]: {
          ...(s.fieldSelections[sku] || { name: false, price: false, stock: false, images: false }),
          [field]: !(s.fieldSelections[sku]?.[field] ?? false),
        },
      },
    })),

  toggleAllFields: (sku, value) =>
    set((s) => ({
      fieldSelections: {
        ...s.fieldSelections,
        [sku]: { name: value, price: value, stock: value, images: value },
      },
    })),

  setField: (sku, field, value) =>
    set((s) => ({
      fieldSelections: {
        ...s.fieldSelections,
        [sku]: {
          ...(s.fieldSelections[sku] || { name: false, price: false, stock: false, images: false }),
          [field]: value,
        },
      },
    })),

  getSelectedFields: (sku) => {
    return get().fieldSelections[sku] || { name: false, price: false, stock: false, images: false };
  },

  setSelectedImages: (sku, images) =>
    set((s) => ({ selectedImages: { ...s.selectedImages, [sku]: images } })),

  reset: () => set(initialState),
}));
