import { useEffect, useRef } from "react";
import { SHORTCUT_MAP, eventToChord, keysToChord, isPureModifier } from "./registry";
import { useShortcutStore } from "./shortcutStore";

// ── Central dispatcher ───────────────────────────────────────────────────────
// A single window keydown listener resolves the pressed chord against all currently
// mounted handlers. Page-scoped shortcuts win over global ones for the same chord, so
// e.g. Ctrl+K opens the page's quick-entry on Expenses but global search elsewhere.

let installed = false;
const handlers = new Map(); // token -> { id, fn }
let seq = 0;

function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

function canFireInInput(def, e) {
  if (def.blockInInput) return false;
  if (def.allowInInput) return true;
  if (/^F\d{1,2}$/i.test(e.key)) return true; // function keys
  if (e.key === "Escape") return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true; // modified chords are commands
  return false;
}

function scopePriority(scope) {
  return scope === "global" ? 0 : 1; // page scopes win over global
}

function onKeyDown(e) {
  if (isPureModifier(e)) return;
  const chord = eventToChord(e);
  const editing = isEditableTarget(e.target);

  let best = null;
  let bestPriority = -1;
  for (const entry of handlers.values()) {
    const def = SHORTCUT_MAP[entry.id];
    if (!def) continue;
    if (keysToChord(useShortcutStore.getState().keysFor(entry.id)) !== chord) continue;
    if (editing && !canFireInInput(def, e)) continue;
    const p = scopePriority(def.scope);
    if (p > bestPriority || (p === bestPriority && entry.seq > (best?.seq ?? -1))) {
      best = entry;
      bestPriority = p;
    }
  }

  if (best) {
    e.preventDefault();
    try {
      best.fn(e);
    } catch {
      /* handler errors must not break the dispatcher */
    }
  }
}

function ensureInstalled() {
  if (installed) return;
  window.addEventListener("keydown", onKeyDown);
  installed = true;
}

function register(id, fn) {
  ensureInstalled();
  const token = ++seq;
  handlers.set(token, { id, fn, seq: token });
  return () => handlers.delete(token);
}

// True when a keyboard event matches a shortcut's current binding. For cell-level /
// inline handlers that can't go through the central dispatcher (e.g. a per-cell F2).
export function matchesShortcut(e, id) {
  return eventToChord(e) === keysToChord(useShortcutStore.getState().keysFor(id));
}

// ── Hook ─────────────────────────────────────────────────────────────────────
// Bind a handler to a registry shortcut id. Keys come from the store (override ??
// default), so rebinding takes effect everywhere without touching call sites.
export function useShortcut(id, handler, { enabled = true, deps = [] } = {}) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    const unregister = register(id, (e) => handlerRef.current?.(e));
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, ...deps]);
}
