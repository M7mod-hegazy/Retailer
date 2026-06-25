import { create } from "zustand";
import {
  isDevAuthed,
  devLogin,
  devLogout,
  devListConversations,
  devListMessages,
  devReply,
  devSetStatus,
  devReact,
  devEdit,
  devDelete,
  devCreateAnnouncement,
  devListAnnouncements,
  devUpdateAnnouncement,
  devDeleteAnnouncement,
  devToggleAnnouncement,
} from "../services/devComms";
import { getVendorConfig } from "../services/comms";

/**
 * Developer-mode state: owner auth + the all-stores console (conversation list,
 * selected thread, announcement composer). Bearer-token auth via devComms.
 */
export const useDevStore = create((set, get) => ({
  authed: isDevAuthed(),
  loggingIn: false,
  loginError: "",

  conversations: [],
  selected: null, // licenseId
  messages: [],
  loadingThread: false,
  error: "",

  login: async (email, password) => {
    set({ loggingIn: true, loginError: "" });
    try {
      await devLogin(email, password);
      set({ authed: true, loggingIn: false });
      await get().loadConversations();
    } catch (e) {
      set({ loggingIn: false, loginError: e.code === "comms_not_configured" ? "not_configured" : "bad_credentials" });
    }
  },

  logout: () => {
    devLogout();
    set({ authed: false, conversations: [], selected: null, messages: [] });
  },

  loadConversations: async () => {
    if (!isDevAuthed()) {
      const { devEmail, devPassword } = getVendorConfig();
      if (devEmail && devPassword) {
        try {
          await devLogin(devEmail, devPassword);
          set({ authed: true });
        } catch {
          set({ error: "load_failed" });
          return;
        }
      } else {
        return;
      }
    }
    try {
      const conversations = await devListConversations();
      set({ conversations, error: "" });
    } catch (e) {
      if (e.code === "unauthorized") set({ authed: false });
      else set({ error: "load_failed" });
    }
  },

  selectConversation: async (licenseId) => {
    set({ selected: licenseId, loadingThread: true, messages: [] });
    try {
      const { messages } = await devListMessages(licenseId, 0);
      set({ messages, loadingThread: false });
      get().loadConversations(); // refresh unread counts after marking seen
    } catch {
      set({ loadingThread: false, error: "load_failed" });
    }
  },

  refreshThread: async () => {
    const { selected } = get();
    if (!selected) return;
    try {
      const { messages } = await devListMessages(selected, 0);
      set({ messages });
    } catch {
      /* keep current */
    }
  },

  closeThread: () => set({ selected: null, messages: [] }),

  sendReply: async (body) => {
    const { selected } = get();
    const text = String(body || "").trim();
    if (!selected || !text) return;
    const msg = await devReply(selected, text, "الدعم");
    set((s) => ({ messages: [...s.messages.filter((m) => m.id !== msg.id), msg] }));
  },

  setStatus: async (status) => {
    const { selected } = get();
    if (!selected) return;
    await devSetStatus(selected, status);
    get().loadConversations();
  },

  reactMessage: async (id, emoji) => {
    const updated = await devReact(id, emoji);
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
  },
  editMessage: async (id, body) => {
    const updated = await devEdit(id, body);
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
  },
  deleteMessage: async (id) => {
    const updated = await devDelete(id);
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
  },

  postAnnouncement: async (payload) => {
    await devCreateAnnouncement(payload);
  },

  announcementsList: [],

  loadAnnouncementsList: async () => {
    try {
      const list = await devListAnnouncements();
      set({ announcementsList: list });
    } catch {
      /* silent */
    }
  },

  updateAnnouncement: async (id, payload) => {
    await devUpdateAnnouncement(id, payload);
  },

  deleteAnnouncement: async (id) => {
    await devDeleteAnnouncement(id);
    set((s) => ({ announcementsList: s.announcementsList.filter((a) => a.id !== id) }));
  },

  toggleAnnouncement: async (id) => {
    const updated = await devToggleAnnouncement(id);
    set((s) => ({ announcementsList: s.announcementsList.map((a) => (a.id === id ? { ...a, ...updated } : a)) }));
  },
}));
