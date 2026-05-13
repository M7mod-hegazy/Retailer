import { create } from "zustand";

const persisted =
  typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("retailer.auth") || "null") : null;

export const useAuthStore = create((set) => ({
  user: persisted?.user || null,
  token: persisted?.token || null,
  permissions: persisted?.permissions || {},
  setSession: ({ user, token }) =>
    set(() => {
      const permissions = user?.page_permissions
        ? JSON.parse(user.page_permissions)
        : {};

      if (typeof window !== "undefined") {
        window.localStorage.setItem("retailer.auth", JSON.stringify({ user, token, permissions }));
      }
      return { user, token, permissions };
    }),
  logout: () =>
    set(() => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("retailer.auth");
      }
      return { user: null, token: null, permissions: {} };
    }),
}));
