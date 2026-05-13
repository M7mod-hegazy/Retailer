import { create } from "zustand";

export const useUiStore = create((set) => ({
  globalSearchOpen: false,

  openGlobalSearch: () => set({ globalSearchOpen: true }),
  closeGlobalSearch: () => set({ globalSearchOpen: false }),
}));
