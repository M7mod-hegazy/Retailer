import { describe, it, expect, beforeEach } from "vitest";
import { useUpdateStore } from "../updateStore";

describe("updateStore", () => {
  beforeEach(() => {
    useUpdateStore.setState({
      available: false,
      downloaded: false,
      info: null,
      progress: null,
      error: null,
      checking: false,
    });
  });

  it("starts with defaults", () => {
    const state = useUpdateStore.getState();
    expect(state.available).toBe(false);
    expect(state.downloaded).toBe(false);
    expect(state.info).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.error).toBeNull();
    expect(state.checking).toBe(false);
  });

  it("setChecking sets checking flag", () => {
    useUpdateStore.getState().setChecking(true);
    expect(useUpdateStore.getState().checking).toBe(true);
  });

  it("setAvailable marks as available with info", () => {
    const info = { version: "2.0.0" };
    useUpdateStore.getState().setAvailable(info);
    const state = useUpdateStore.getState();
    expect(state.available).toBe(true);
    expect(state.info).toEqual(info);
    expect(state.checking).toBe(false);
  });

  it("setNotAvailable clears availability", () => {
    useUpdateStore.setState({ available: true, checking: true });
    useUpdateStore.getState().setNotAvailable();
    expect(useUpdateStore.getState().available).toBe(false);
    expect(useUpdateStore.getState().checking).toBe(false);
  });

  it("setProgress stores progress value", () => {
    useUpdateStore.getState().setProgress(50);
    expect(useUpdateStore.getState().progress).toBe(50);
  });

  it("setDownloaded marks as downloaded with info", () => {
    const info = { version: "2.0.0" };
    useUpdateStore.getState().setDownloaded(info);
    expect(useUpdateStore.getState().downloaded).toBe(true);
    expect(useUpdateStore.getState().info).toEqual(info);
  });

  it("setError stores error and clears checking", () => {
    useUpdateStore.getState().setError("Network error");
    expect(useUpdateStore.getState().error).toBe("Network error");
    expect(useUpdateStore.getState().checking).toBe(false);
  });

  it("reset restores all defaults", () => {
    useUpdateStore.setState({
      available: true,
      downloaded: true,
      info: { version: "2.0.0" },
      progress: 100,
      error: "err",
      checking: true,
    });
    useUpdateStore.getState().reset();
    const state = useUpdateStore.getState();
    expect(state.available).toBe(false);
    expect(state.downloaded).toBe(false);
    expect(state.info).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.error).toBeNull();
    expect(state.checking).toBe(false);
  });
});
