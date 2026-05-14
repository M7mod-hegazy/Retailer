import { describe, it, expect, beforeEach } from "vitest";
import { useAppSettingsStore } from "../appSettingsStore";

describe("appSettingsStore", () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ settings: { currency_code: "EGP", currency_symbol: "ج.م", decimal_places: 2 } });
  });

  it("starts with default settings", () => {
    const state = useAppSettingsStore.getState();
    expect(state.settings).toEqual({
      currency_code: "EGP",
      currency_symbol: "ج.م",
      decimal_places: 2,
    });
  });

  it("applySettings merges partial settings", () => {
    useAppSettingsStore.getState().applySettings({ currency_symbol: "$" });
    const state = useAppSettingsStore.getState();
    expect(state.settings.currency_symbol).toBe("$");
    expect(state.settings.currency_code).toBe("EGP");
  });

  it("applySettings with empty object does nothing", () => {
    useAppSettingsStore.getState().applySettings({});
    const state = useAppSettingsStore.getState();
    expect(state.settings.currency_code).toBe("EGP");
  });

  it("applySettings with null reverts to defaults only", () => {
    useAppSettingsStore.getState().applySettings(null);
    const state = useAppSettingsStore.getState();
    expect(state.settings.currency_code).toBe("EGP");
    expect(state.settings.decimal_places).toBe(2);
  });

  it("applySettings overrides with new keys", () => {
    useAppSettingsStore.getState().applySettings({ tax_rate: 0.15 });
    const state = useAppSettingsStore.getState();
    expect(state.settings.tax_rate).toBe(0.15);
  });
});
