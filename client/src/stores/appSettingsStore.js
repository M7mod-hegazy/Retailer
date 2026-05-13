import { create } from "zustand";

const DEFAULT_SETTINGS = {
  currency_code: "EGP",
  currency_symbol: "ج.م",
  decimal_places: 2,
};

export const useAppSettingsStore = create((set) => ({
  settings: DEFAULT_SETTINGS,

  applySettings: (settings = {}) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings,
      },
    })),
}));

