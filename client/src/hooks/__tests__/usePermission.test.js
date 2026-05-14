import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePermission, useCanView } from "../usePermission";

const mockUseAuthStore = vi.hoisted(() => vi.fn());

vi.mock("../../stores/authStore", () => ({
  useAuthStore: mockUseAuthStore,
}));

describe("usePermission", () => {
  beforeEach(() => {
    mockUseAuthStore.mockReset();
  });

  it("returns false when no user", () => {
    mockUseAuthStore.mockReturnValue({ user: null, permissions: {} });
    expect(usePermission("pos", "create")).toBe(false);
  });

  it("returns true for dev role regardless of permissions", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "dev" },
      permissions: {},
    });
    expect(usePermission("pos", "create")).toBe(true);
  });

  it("returns true for admin role regardless of permissions", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "admin" },
      permissions: {},
    });
    expect(usePermission("any", "anything")).toBe(true);
  });

  it("returns true when permission exists for the page+action", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: { pos: ["create", "view"] },
    });
    expect(usePermission("pos", "create")).toBe(true);
  });

  it("returns false when action is missing from permissions", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: { pos: ["view"] },
    });
    expect(usePermission("pos", "create")).toBe(false);
  });

  it("returns false when page has no permissions", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: {},
    });
    expect(usePermission("pos", "view")).toBe(false);
  });

  it("returns false when permissions is null", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: null,
    });
    expect(usePermission("pos", "view")).toBe(false);
  });

  it("returns false when permissions is undefined", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: undefined,
    });
    expect(usePermission("pos", "view")).toBe(false);
  });

  it("handles empty action string", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: { pos: [""] },
    });
    expect(usePermission("pos", "")).toBe(true);
  });

  it("is case-sensitive for actions", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: { pos: ["View"] },
    });
    expect(usePermission("pos", "view")).toBe(false);
  });
});

describe("useCanView", () => {
  it("calls usePermission with 'view' action", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: { pos: ["view"] },
    });
    expect(useCanView("pos")).toBe(true);
  });

  it("returns false when no view permission", () => {
    mockUseAuthStore.mockReturnValue({
      user: { role: "user" },
      permissions: { pos: ["create"] },
    });
    expect(useCanView("pos")).toBe(false);
  });
});
