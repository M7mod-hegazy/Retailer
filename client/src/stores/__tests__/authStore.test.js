import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuthStore } from "../authStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, permissions: {} });
    localStorage.clear();
  });

  it("starts with null user, token, and empty permissions", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.permissions).toEqual({});
  });

  it("setSession sets user, token, and parses page_permissions", () => {
    const user = {
      id: 1,
      name: "test",
      role: "user",
      page_permissions: JSON.stringify({ pos: ["create", "view"] }),
    };
    useAuthStore.getState().setSession({ user, token: "abc123" });
    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.token).toBe("abc123");
    expect(state.permissions).toEqual({ pos: ["create", "view"] });
  });

  it("setSession handles missing page_permissions gracefully", () => {
    const user = { id: 1, name: "test" };
    useAuthStore.getState().setSession({ user, token: "abc" });
    expect(useAuthStore.getState().permissions).toEqual({});
  });

  it("setSession handles null page_permissions", () => {
    const user = { id: 1, page_permissions: null };
    useAuthStore.getState().setSession({ user, token: "abc" });
    expect(useAuthStore.getState().permissions).toEqual({});
  });

  it("setSession persists to localStorage", () => {
    const user = { id: 1, name: "test", page_permissions: "{}" };
    useAuthStore.getState().setSession({ user, token: "token123" });
    const stored = JSON.parse(localStorage.getItem("retailer.auth"));
    expect(stored.user).toEqual(user);
    expect(stored.token).toBe("token123");
  });

  it("logout clears user, token, permissions", () => {
    useAuthStore.setState({ user: { id: 1 }, token: "abc", permissions: { pos: ["view"] } });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.permissions).toEqual({});
  });

  it("logout removes localStorage entry", () => {
    localStorage.setItem("retailer.auth", JSON.stringify({ user: { id: 1 }, token: "abc" }));
    useAuthStore.getState().logout();
    expect(localStorage.getItem("retailer.auth")).toBeNull();
  });
});
