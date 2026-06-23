import { create } from "zustand";

export const useQuitOrLogoutStore = create((set) => ({
  show: false,
  source: null,
  showModal: (source) => set({ show: true, source }),
  hideModal: () => set({ show: false, source: null }),
}));
