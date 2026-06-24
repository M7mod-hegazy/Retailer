import { create } from "zustand";
import { searchHelp } from "../help/helpSearch";
import { isAiFallbackEnabled, askAi } from "../services/aiHelp";

// Session-scoped flag for the dismissable floating bubble.
const BUBBLE_KEY = "retailer.assistant.bubbleDismissed";
function readBubbleDismissed() {
  try {
    return sessionStorage.getItem(BUBBLE_KEY) === "true";
  } catch {
    return false;
  }
}

let messageSeq = 0;
const nextId = () => `msg_${Date.now()}_${++messageSeq}`;

/**
 * Assistant UI + offline-bot conversation state.
 * Phase 1: the "المساعد" tab (offline Arabic help search). The "الدعم" tab and
 * developer mode are wired in Phase 2.
 */
export const useAssistantStore = create((set, get) => ({
  isOpen: false,
  activeTab: "assistant", // 'assistant' | 'support'
  devMode: false,
  bubbleDismissed: readBubbleDismissed(),
  // conversation: { id, role: 'user' | 'bot', text, results?: HelpEntry[], confident?: boolean }
  messages: [],

  open: (tab) => set((s) => ({ isOpen: true, activeTab: tab || s.activeTab })),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setTab: (tab) => set({ activeTab: tab }),
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),

  dismissBubble: () => {
    try {
      sessionStorage.setItem(BUBBLE_KEY, "true");
    } catch {
      /* ignore */
    }
    set({ bubbleDismissed: true });
  },

  clearConversation: () => set({ messages: [] }),

  /**
   * Ask the bot a question. Offline-first: the local Arabic search answer is
   * always shown immediately. If the local answer isn't confident AND the
   * optional AI fallback is enabled+configured, it additionally fetches an AI
   * answer (inert otherwise).
   */
  ask: async (query, currentPath = null) => {
    const text = String(query || "").trim();
    if (!text) return;

    const userMsg = { id: nextId(), role: "user", text };
    const { results, confident } = searchHelp(text, { currentPath, limit: 3 });
    const entries = results.map((r) => r.entry);
    const offlineMsg = { id: nextId(), role: "bot", kind: "offline", results: entries, confident };

    set((s) => ({ messages: [...s.messages, userMsg, offlineMsg] }));

    // Hybrid fallback — only when the offline answer is weak.
    if (confident || !isAiFallbackEnabled()) return;

    const aiId = nextId();
    set((s) => ({ messages: [...s.messages, { id: aiId, role: "bot", kind: "ai", loading: true }] }));

    const patchAi = (patch) =>
      set((s) => ({
        messages: s.messages.map((m) => (m.id === aiId ? { ...m, ...patch, loading: false } : m)),
      }));

    try {
      const { answer } = await askAi(text, entries.map((e) => ({ title: e.title, body: e.answer })));
      if (answer) patchAi({ text: answer });
      else patchAi({ error: true });
    } catch {
      patchAi({ error: true });
    }
  },
}));
