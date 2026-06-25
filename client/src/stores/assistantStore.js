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

// Persistent search history (last 20 queries)
const HISTORY_KEY = "retailer.assistant.searchHistory";
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw).slice(0, 20) : [];
  } catch {
    return [];
  }
}
function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
  } catch { /* ignore */ }
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
  searchHistory: loadHistory(),

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

  rateMessage: (id, rating) => set((s) => ({
    messages: s.messages.map((m) => (m.id === id ? { ...m, rating } : m)),
  })),

  /**
   * Ask the bot a question. Offline-first: the local Arabic search answer is
   * always shown immediately. If the local answer isn't confident AND the
   * optional AI fallback is enabled+configured, it additionally fetches an AI
   * answer (inert otherwise).
   */
  clearHistory: () => {
    saveHistory([]);
    set({ searchHistory: [] });
  },

  ask: async (query, currentPath = null) => {
    const text = String(query || "").trim();
    if (!text) return;

    const userMsg = { id: nextId(), role: "user", text };
    const { results, confident } = searchHelp(text, { currentPath, limit: 3 });
    const entries = results.map((r) => r.entry);
    const offlineMsg = { id: nextId(), role: "bot", kind: "offline", results: entries, confident };

    // Save to search history
    const history = get().searchHistory;
    const deduped = [text, ...history.filter((h) => h !== text)].slice(0, 20);
    saveHistory(deduped);
    set({ searchHistory: deduped, messages: [...get().messages, userMsg, offlineMsg] });

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
