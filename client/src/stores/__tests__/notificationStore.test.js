import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificationStore } from "../notificationStore";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../services/api", () => ({ default: mockApi }));

function makeNotif(id, isRead = 0) {
  return { id, title: `Notif ${id}`, message: "msg", is_read: isRead, created_at: "2025-01-01" };
}

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unreadCount: 0, loading: false, loaded: false });
    vi.clearAllMocks();
  });

  it("starts with empty state", () => {
    const state = useNotificationStore.getState();
    expect(state.items).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.loaded).toBe(false);
  });

  describe("fetchNotifications", () => {
    it("loads notifications and counts unread", async () => {
      mockApi.get.mockResolvedValue({
        data: { data: [makeNotif(1, 0), makeNotif(2, 1), makeNotif(3, 0)] },
      });
      await useNotificationStore.getState().fetchNotifications();
      const state = useNotificationStore.getState();
      expect(state.items).toHaveLength(3);
      expect(state.unreadCount).toBe(2);
      expect(state.loading).toBe(false);
      expect(state.loaded).toBe(true);
    });

    it("handles API failure", async () => {
      mockApi.get.mockRejectedValue(new Error("fail"));
      await useNotificationStore.getState().fetchNotifications();
      const state = useNotificationStore.getState();
      expect(state.loading).toBe(false);
      expect(state.loaded).toBe(true);
      expect(state.items).toEqual([]);
    });
  });

  describe("markAsRead", () => {
    it("optimistically marks notification as read", async () => {
      useNotificationStore.setState({ items: [makeNotif(1, 0), makeNotif(2, 0)] });
      mockApi.post.mockResolvedValue({});
      await useNotificationStore.getState().markAsRead(1);
      const state = useNotificationStore.getState();
      expect(state.items[0].is_read).toBe(1);
      expect(state.unreadCount).toBe(1);
      expect(mockApi.post).toHaveBeenCalledWith("/api/notifications/1/read");
    });

    it("re-fetches on API failure", async () => {
      useNotificationStore.setState({ items: [makeNotif(1, 0)] });
      mockApi.post.mockRejectedValue(new Error("fail"));
      const fetchSpy = vi.spyOn(useNotificationStore.getState(), "fetchNotifications");
      await useNotificationStore.getState().markAsRead(1);
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("optimistically marks all as read", async () => {
      useNotificationStore.setState({ items: [makeNotif(1, 0), makeNotif(2, 0)] });
      mockApi.post.mockResolvedValue({});
      await useNotificationStore.getState().markAllAsRead();
      const state = useNotificationStore.getState();
      expect(state.items.every((i) => i.is_read === 1)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe("dismissNotification", () => {
    it("optimistically removes notification", async () => {
      useNotificationStore.setState({ items: [makeNotif(1, 0), makeNotif(2, 0)] });
      mockApi.delete.mockResolvedValue({});
      await useNotificationStore.getState().dismissNotification(1);
      expect(useNotificationStore.getState().items).toHaveLength(1);
      expect(useNotificationStore.getState().items[0].id).toBe(2);
    });
  });
});
