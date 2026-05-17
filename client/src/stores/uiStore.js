import { create } from "zustand";

export const useUiStore = create((set) => ({
  globalSearchOpen: false,
  dynamicBreadcrumb: null, // { label, path } — set by detail pages for the last crumb

  openGlobalSearch: () => set({ globalSearchOpen: true }),
  closeGlobalSearch: () => set({ globalSearchOpen: false }),
  setDynamicBreadcrumb: (crumb) => set({ dynamicBreadcrumb: crumb }),
  clearDynamicBreadcrumb: () => set({ dynamicBreadcrumb: null }),
}));
