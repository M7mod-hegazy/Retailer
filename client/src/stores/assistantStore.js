import { create } from "zustand";
import { searchHelp } from "../help/helpSearch";
import { isAiFallbackEnabled, askAi } from "../services/aiHelp";
import { executeQuery, executeMultiTurn, fetchAnomalies } from "../services/queryEngine";

const BUBBLE_KEY = "retailer.assistant.bubbleDismissed";
function readBubbleDismissed() {
  try { return sessionStorage.getItem(BUBBLE_KEY) === "true"; } catch { return false; }
}

const HISTORY_KEY = "retailer.assistant.searchHistory";
function loadHistory() {
  try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw).slice(0, 20) : []; } catch { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20))); } catch { /* ignore */ }
}

let messageSeq = 0;
const nextId = () => `msg_${Date.now()}_${++messageSeq}`;

export const useAssistantStore = create((set, get) => ({
  isOpen: false,
  activeTab: "assistant",
  devMode: false,
  bubbleDismissed: readBubbleDismissed(),
  messages: [],
  searchHistory: loadHistory(),
  _inflight: new Set(),

  queryContext: null,
  queryHistory: [],
  queryLoading: false,
  queryResult: null,
  queryError: null,
  anomalies: [],

  open: (tab) => {
    set((s) => ({ isOpen: true, activeTab: tab || s.activeTab, bubbleDismissed: true }));
    try { sessionStorage.setItem(BUBBLE_KEY, "true"); } catch { /* ignore */ }
    get().refreshAnomalies();
  },
  close: () => {
    get()._inflight.forEach((c) => { try { c.abort(); } catch { /* ignore */ } });
    set((s) => ({
      isOpen: false,
      _inflight: new Set(),
      messages: s.messages.filter((m) => !(m.kind === "ai" && m.loading)),
    }));
  },
  toggle: () => { const s = get(); if (s.isOpen) s.close(); else { set({ isOpen: true, bubbleDismissed: true }); try { sessionStorage.setItem(BUBBLE_KEY, "true"); } catch { /* ignore */ } } },
  setTab: (tab) => set({ activeTab: tab }),
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
  dismissBubble: () => { try { sessionStorage.setItem(BUBBLE_KEY, "true"); } catch { /* ignore */ } set({ bubbleDismissed: true }); },
  clearConversation: () => set({ messages: [], queryContext: null, queryHistory: [], queryResult: null, queryError: null }),
  rateMessage: (id, rating) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, rating } : m)) })),
  clearHistory: () => { saveHistory([]); set({ searchHistory: [] }); },

  refreshAnomalies: async () => {
    try {
      const res = await fetchAnomalies();
      if (res.success) set({ anomalies: res.data || [] });
    } catch { /* ignore */ }
  },

  executeQuery: async (text, intentId = null) => {
    const q = String(text || "").trim();
    if (!q) return;
    set({ queryLoading: true, queryResult: null, queryError: null });
    const userMsg = { id: nextId(), role: "user", text: q };
    const history = get().searchHistory;
    const deduped = [q, ...history.filter((h) => h !== q)].slice(0, 20);
    saveHistory(deduped);
    set({ searchHistory: deduped, messages: [...get().messages, userMsg] });
    try {
      const res = await executeQuery(q, get().queryHistory, intentId);
      if (res.success) {
        const resultMsg = { id: nextId(), role: "bot", kind: "query", result: res.data };
        set((s) => ({
          queryResult: res.data,
          queryLoading: false,
          queryContext: { lastIntent: res.data?.intent, lastQuery: q },
          queryHistory: [...s.queryHistory, { role: "user", text: q }, { role: "assistant", text: res.data?.summary || "" }],
          messages: [...s.messages, resultMsg],
        }));
        get().refreshAnomalies();
      } else {
        set({ queryError: res.error || "Query failed", queryLoading: false });
      }
    } catch (err) {
      set({ queryError: err.message || "Network error", queryLoading: false });
    }
  },

  executeMultiTurn: async (text) => {
    const q = String(text || "").trim();
    if (!q) return;
    set({ queryLoading: true, queryResult: null, queryError: null });
    const history = get().queryHistory;
    try {
      const res = await executeMultiTurn(q, history);
      if (res.success) {
        const resultMsg = { id: nextId(), role: "bot", kind: "query", result: res.data };
        set((s) => ({
          queryResult: res.data,
          queryLoading: false,
          queryHistory: [...s.queryHistory, { role: "user", text: q }, { role: "assistant", text: res.data?.summary || "" }],
          messages: [...s.messages, resultMsg],
        }));
      } else {
        set({ queryError: res.error || "Query failed", queryLoading: false });
      }
    } catch (err) {
      set({ queryError: err.message || "Network error", queryLoading: false });
    }
  },

  clearQuery: () => set({ queryResult: null, queryError: null, queryContext: null, queryHistory: [] }),

  ask: async (query, currentPath = null) => {
    const text = String(query || "").trim();
    if (!text) return;
    const userMsg = { id: nextId(), role: "user", text };
    const { results, confident } = searchHelp(text, { currentPath, limit: 3 });
    const entries = results.map((r) => r.entry);
    const offlineMsg = { id: nextId(), role: "bot", kind: "offline", results: entries, confident };
    const history = get().searchHistory;
    const deduped = [text, ...history.filter((h) => h !== text)].slice(0, 20);
    saveHistory(deduped);
    set({ searchHistory: deduped, messages: [...get().messages, userMsg, offlineMsg] });
    if (confident || !isAiFallbackEnabled()) return;
    const aiId = nextId();
    set((s) => ({ messages: [...s.messages, { id: aiId, role: "bot", kind: "ai", loading: true }] }));
    const patchAi = (patch) => set((s) => ({ messages: s.messages.map((m) => (m.id === aiId ? { ...m, ...patch, loading: false } : m)) }));
    const ctrl = new AbortController();
    set((s) => ({ _inflight: new Set(s._inflight).add(ctrl) }));
    const safetyTimer = setTimeout(() => { try { ctrl.abort(); } catch { /* ignore */ } }, 20000);
    try {
      const { answer } = await askAi(text, entries.map((e) => ({ title: e.title, body: e.answer })), ctrl.signal);
      if (!get().isOpen) return;
      patchAi(answer ? { text: answer } : { error: true });
    } catch {
      if (get().isOpen) patchAi({ error: true });
    } finally {
      clearTimeout(safetyTimer);
      set((s) => { const next = new Set(s._inflight); next.delete(ctrl); return { _inflight: next }; });
    }
  },
}));
