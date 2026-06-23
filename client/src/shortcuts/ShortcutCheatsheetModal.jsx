import React, { useEffect, useMemo } from "react";
import { Keyboard } from "lucide-react";
import { SHORTCUTS, formatKeys } from "./registry";
import TitleBar from "../components/ui/TitleBar";
import { useShortcutStore } from "./shortcutStore";
import { useDetach } from "../hooks/useDetach";

// Read-only overlay listing every shortcut with its current binding, grouped by section.
// Opened by the global.help shortcut ("?"). Editing happens on the Settings → Shortcuts tab.
export default function ShortcutCheatsheetModal({ open, onClose }) {
  const { handleDetach } = useDetach("shortcut-cheatsheet", {
    onClose, getState: () => ({}), actions: {},
  });
  const keysFor = useShortcutStore((s) => s.keysFor);

  const groups = useMemo(() => {
    const map = new Map();
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group).push(s);
    }
    return Array.from(map.entries());
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" dir="rtl" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-[640px] mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <TitleBar title="اختصارات لوحة المفاتيح" onClose={onClose} onDetach={handleDetach} />
        <div data-modal-content className="px-5 py-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {groups.map(([group, items]) => (
            <div key={group}>
              <div className="text-xs font-black text-slate-400 mb-2">{group}</div>
              <div className="space-y-1.5">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-600 truncate">{s.label}</span>
                    <kbd className="shrink-0 inline-flex items-center justify-center min-w-[40px] rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700 font-mono">
                      {formatKeys(keysFor(s.id))}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
