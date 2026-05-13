import { create } from "zustand";
import api from "../services/api";

export const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  loaded: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const response = await api.get("/api/notifications");
      const items = response.data?.data || [];
      set({
        items,
        unreadCount: items.filter((item) => !item.is_read).length,
        loading: false,
        loaded: true,
      });
    } catch {
      set({ loading: false, loaded: true });
    }
  },

  markAsRead: async (id) => {
    const items = get().items.map((item) => (item.id === id ? { ...item, is_read: 1 } : item));
    set({ items, unreadCount: items.filter((item) => !item.is_read).length });
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    const items = get().items.map((item) => ({ ...item, is_read: 1 }));
    set({ items, unreadCount: 0 });
    try {
      await api.post("/api/notifications/read-all");
    } catch {
      get().fetchNotifications();
    }
  },

  dismissNotification: async (id) => {
    const items = get().items.filter((item) => item.id !== id);
    set({ items, unreadCount: items.filter((item) => !item.is_read).length });
    try {
      await api.delete(`/api/notifications/${id}`);
    } catch {
      get().fetchNotifications();
    }
  },
}));
