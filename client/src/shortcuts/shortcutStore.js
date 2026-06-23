import { create } from "zustand";
import api from "../services/api";
import { SHORTCUTS, SHORTCUT_MAP, keysToChord } from "./registry";

// Holds user overrides (id -> keys array). Absent id = factory default.
// effectiveKeys / keysFor resolve the active binding; rebind enforces no-overlap.
export const useShortcutStore = create((set, get) => ({
  overrides: {},
  loaded: false,

  load: async () => {
    try {
      const { data } = await api.get("/api/settings/shortcuts-config");
      const overrides = data?.data && typeof data.data === "object" ? data.data : {};
      set({ overrides, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  // Active keys array for an id: override ?? factory default.
  keysFor: (id) => {
    const ov = get().overrides[id];
    if (ov && ov.length) return ov;
    return SHORTCUT_MAP[id]?.defaultKeys || [];
  },

  // Returns the conflicting shortcut def, or null. Two shortcuts conflict when they share a
  // chord AND could be active together: same scope, OR either side is global (global keys —
  // e.g. Ctrl+K for search — are reserved everywhere and can't be reused by any page).
  findConflict: (keys, scope, excludeId) => {
    const chord = keysToChord(keys);
    if (!chord) return null;
    for (const s of SHORTCUTS) {
      if (s.id === excludeId) continue;
      if (s.editable === false) continue;
      if (keysToChord(get().keysFor(s.id)) !== chord) continue;
      const sameScope = s.scope === scope;
      const eitherGlobal = s.scope === "global" || scope === "global";
      if (sameScope || eitherGlobal) return s;
    }
    return null;
  },

  // Commit a rebind. Returns { ok } or { ok:false, conflict }.
  rebind: (id, keys) => {
    const def = SHORTCUT_MAP[id];
    if (!def || def.editable === false) return { ok: false };
    const conflict = get().findConflict(keys, def.scope, id);
    if (conflict) return { ok: false, conflict };
    const overrides = { ...get().overrides, [id]: keys };
    set({ overrides });
    get()._persist(overrides);
    return { ok: true };
  },

  resetOne: (id) => {
    const overrides = { ...get().overrides };
    delete overrides[id];
    set({ overrides });
    get()._persist(overrides);
  },

  resetAll: () => {
    set({ overrides: {} });
    get()._persist({});
  },

  _persist: (overrides) => {
    api.put("/api/settings/shortcuts-config", { config: overrides }).catch(() => {});
  },
}));
