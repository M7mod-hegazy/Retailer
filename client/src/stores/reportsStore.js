import { create } from "zustand";

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(`reports_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function persist(key, value) {
  try { localStorage.setItem(`reports_${key}`, JSON.stringify(value)); } catch { /* noop */ }
}

export function buildPrefKey(sourceKey, classification, dataMode) {
  return `${sourceKey}.${classification}.${dataMode}`;
}

export const useReportsStore = create((set, get) => ({
  // Per-report preferences keyed by slug or composite sourceKey.classification.dataMode
  preferences: loadPersisted("preferences", {}),

  // Favorites (set of report ids or composite keys)
  favorites: new Set(loadPersisted("favorites", [])),

  // Recent reports (ordered list of slugs/composite keys with timestamps)
  recents: loadPersisted("recents", []),

  // Saved presets
  presets: loadPersisted("presets", []),

  // Sidebar open state
  sidebarOpen: true,

  getPreference(key, subKey, fallback = null) {
    return get().preferences?.[key]?.[subKey] ?? fallback;
  },

  setPreference(key, subKey, value) {
    set((state) => {
      const updated = {
        ...state.preferences,
        [key]: { ...(state.preferences[key] || {}), [subKey]: value },
      };
      persist("preferences", updated);
      return { preferences: updated };
    });
  },

  setColumnVisibility(key, visibility) {
    get().setPreference(key, "columnVisibility", visibility);
  },

  setColumnOrder(key, order) {
    get().setPreference(key, "columnOrder", order);
  },

  setColumnWidth(key, colKey, width) {
    const existing = get().preferences?.[key]?.columnWidths || {};
    get().setPreference(key, "columnWidths", { ...existing, [colKey]: width });
  },

  setLastFilters(key, filters) {
    get().setPreference(key, "lastFilters", filters);
  },

  setCostMethod(key, method) {
    get().setPreference(key, "costMethod", method);
  },

  toggleFavorite(key) {
    set((state) => {
      const next = new Set(state.favorites);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist("favorites", [...next]);
      return { favorites: next };
    });
  },

  pushRecent(key) {
    set((state) => {
      const next = state.recents.filter((r) => r.key !== key);
      next.unshift({ key, at: Date.now() });
      if (next.length > 20) next.length = 20;
      persist("recents", next);
      return { recents: next };
    });
  },

  savePreset(name, key, filters, costMethod) {
    set((state) => {
      const next = [...state.presets, { id: Date.now(), name, key, filters, costMethod }];
      persist("presets", next);
      return { presets: next };
    });
  },

  deletePreset(id) {
    set((state) => {
      const next = state.presets.filter((p) => p.id !== id);
      persist("presets", next);
      return { presets: next };
    });
  },

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },
}));
