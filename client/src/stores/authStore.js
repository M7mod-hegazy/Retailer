import { create } from "zustand";

const persisted =
  typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("retailer.auth") || "null") : null;

const initialUser = persisted?.user
  ? { ...persisted.user, name: persisted.user.name || persisted.user.full_name || persisted.user.username }
  : null;

export const useAuthStore = create((set) => ({
  user: initialUser,
  token: persisted?.token || null,
  permissions: persisted?.permissions || {},
  setSession: ({ user, token }) =>
    set(() => {
      const permissions = user?.page_permissions
        ? JSON.parse(user.page_permissions)
        : {};

      const enrichedUser = { ...user, name: user.full_name || user.username };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("retailer.auth", JSON.stringify({ user: enrichedUser, token, permissions }));
      }
      return { user: enrichedUser, token, permissions };
    }),
  logout: () =>
    set(() => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("retailer.auth");
      }
      return { user: null, token: null, permissions: {} };
    }),
}));
