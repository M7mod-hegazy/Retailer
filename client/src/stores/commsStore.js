import { create } from "zustand";
import {
  isCommsConfigured,
  sendMessage,
  sendMessageWithFiles,
  fetchMessages,
  reactMessage,
  editMessage,
  deleteMessage,
  fetchAnnouncements,
  markAnnouncementRead,
} from "../services/comms";

// ── Local offline cache for announcements (local-first) ───────────────
// Once pulled while online, announcements render from this cache even with no
// connection. The `dismissed` flag is local-only.
const ANN_KEY = "retailer.comms.announcements";

function loadCachedAnnouncements() {
  try {
    const raw = localStorage.getItem(ANN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function persistAnnouncements(list) {
  try {
    localStorage.setItem(ANN_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / serialization errors */
  }
}

function mergeAnnouncements(cached, incoming) {
  const byId = new Map(cached.map((a) => [a.id, a]));
  for (const a of incoming) {
    const prev = byId.get(a.id) || {};
    // Server wins on content/read; preserve the local-only `dismissed` flag.
    byId.set(a.id, { ...prev, ...a, dismissed: prev.dismissed || false });
  }
  return [...byId.values()].sort((x, y) => y.id - x.id);
}

export const useCommsStore = create((set, get) => ({
  configured: isCommsConfigured(),

  // Support thread
  messages: [],
  supportCursor: 0,
  supportError: false,

  // Announcements (offline-cached)
  announcements: loadCachedAnnouncements(),

  // ── Support thread ──────────────────────────────────────────────────
  syncSupport: async () => {
    if (!isCommsConfigured()) return;
    try {
      const { messages, cursor } = await fetchMessages(0);
      set({ messages, supportCursor: cursor || 0, supportError: false });
    } catch (err) {
      // Network failure (vendor service offline) → silent, don't alarm the user.
      // Only surface the error for actual API failures (server responded but failed).
      const isNetworkError = !err.code || err.message === "Failed to fetch" || err.message?.includes("NetworkError");
      if (!isNetworkError) set({ supportError: true });
    }
  },



  sendSupport: async (body, channel = "support") => {
    const text = String(body || "").trim();
    if (!text || !isCommsConfigured()) return;
    const msg = await sendMessage({ body: text, channel });
    set((s) => ({ messages: [...s.messages.filter((m) => m.id !== msg.id), msg] }));
  },

  sendSupportWithFiles: async (body, files, channel = "support") => {
    if (!isCommsConfigured() || !(files && files.length)) return;
    const msg = await sendMessageWithFiles({ body: String(body || "").trim(), channel, files });
    set((s) => ({ messages: [...s.messages.filter((m) => m.id !== msg.id), msg] }));
  },

  reactSupport: async (id, emoji) => {
    const updated = await reactMessage(id, emoji);
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
  },
  editSupport: async (id, body) => {
    const updated = await editMessage(id, body);
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
  },
  removeSupport: async (id) => {
    const updated = await deleteMessage(id);
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
  },

  // ── Announcements ───────────────────────────────────────────────────
  syncAnnouncements: async () => {
    if (!isCommsConfigured()) return;
    try {
      const { announcements: incoming } = await fetchAnnouncements(0);
      const merged = mergeAnnouncements(get().announcements, incoming);
      persistAnnouncements(merged);
      set({ announcements: merged });
    } catch {
      /* offline: keep showing the cache */
    }
  },

  dismissAnnouncement: (id) => {
    const next = get().announcements.map((a) => (a.id === id ? { ...a, dismissed: true } : a));
    persistAnnouncements(next);
    set({ announcements: next });
  },

  markAnnouncementRead: async (id) => {
    const next = get().announcements.map((a) => (a.id === id ? { ...a, read: true } : a));
    persistAnnouncements(next);
    set({ announcements: next });
    try {
      if (isCommsConfigured()) await markAnnouncementRead(id);
    } catch {
      /* best-effort; will re-sync */
    }
  },

  // Latest announcement worth showing as a dashboard banner.
  bannerAnnouncement: () => {
    const list = get().announcements.filter((a) => !a.dismissed);
    return list.length ? list[0] : null;
  },
}));
