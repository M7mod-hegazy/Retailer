import { create } from "zustand";

const DEFAULT_SETTINGS = {
  currency_code: "EGP",
  currency_symbol: "ج.م",
  decimal_places: 2,
  max_discount_percent: 15,
  discount_cap_enabled: 1,
  pos_voice_enabled: 0,
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

