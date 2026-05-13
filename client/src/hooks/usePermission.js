import { useAuthStore } from "../stores/authStore";

export function usePermission(page, action) {
  const { user, permissions } = useAuthStore();
  if (!user) return false;
  if (user.role === "dev" || user.role === "admin") return true;
  return Array.isArray(permissions?.[page]) && permissions[page].includes(action);
}

export function useCanView(page) {
  return usePermission(page, "view");
}
