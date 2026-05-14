import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "../uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ globalSearchOpen: false });
  });

  it("starts closed", () => {
    expect(useUiStore.getState().globalSearchOpen).toBe(false);
  });

  it("openGlobalSearch sets true", () => {
    useUiStore.getState().openGlobalSearch();
    expect(useUiStore.getState().globalSearchOpen).toBe(true);
  });

  it("closeGlobalSearch sets false", () => {
    useUiStore.setState({ globalSearchOpen: true });
    useUiStore.getState().closeGlobalSearch();
    expect(useUiStore.getState().globalSearchOpen).toBe(false);
  });

  it("openGlobalSearch on already open stays true", () => {
    useUiStore.setState({ globalSearchOpen: true });
    useUiStore.getState().openGlobalSearch();
    expect(useUiStore.getState().globalSearchOpen).toBe(true);
  });
});
