import { create } from "zustand";

const POS_AUTO_RAIL_KEY = "retailer.sidebar.posAutoRail";

function readPosAutoRail() {
  try {
    return JSON.parse(localStorage.getItem(POS_AUTO_RAIL_KEY)) === true;
  } catch {
    return false;
  }
}

export const useUiStore = create((set) => ({
  globalSearchOpen: false,
  dynamicBreadcrumb: null, // { label, path } — set by detail pages for the last crumb

  // When on, the POS page auto-collapses the sidebar to the icon rail (opt-in,
  // per-machine like the rest of the sidebar prefs). Persisted in localStorage.
  posAutoRail: readPosAutoRail(),

  openGlobalSearch: () => set({ globalSearchOpen: true }),
  closeGlobalSearch: () => set({ globalSearchOpen: false }),
  setDynamicBreadcrumb: (crumb) => set({ dynamicBreadcrumb: crumb }),
  clearDynamicBreadcrumb: () => set({ dynamicBreadcrumb: null }),
  setPosAutoRail: (value) => {
    const next = !!value;
    try { localStorage.setItem(POS_AUTO_RAIL_KEY, JSON.stringify(next)); } catch {}
    set({ posAutoRail: next });
  },
}));
