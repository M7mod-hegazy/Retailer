import React, { useEffect, useMemo, useState } from "react";
import { Keyboard, RotateCcw, Pencil, X, Info, AlertTriangle, Monitor } from "lucide-react";
import toast from "react-hot-toast";
import { useShortcutStore } from "../../shortcuts/shortcutStore";
import {
  SHORTCUTS,
  SHORTCUT_DESC,
  formatKeys,
  eventToKeys,
  isReservedChord,
  isPureModifier,
} from "../../shortcuts/registry";

// Settings tab: rebind every keyboard shortcut to a key of the user's choice, with
// no-overlap enforcement, per-row reset and reset-all. Reads/writes the shortcut store.
export default function ShortcutsTab({ onChange }) {
  const overrides = useShortcutStore((s) => s.overrides);
  const keysFor = useShortcutStore((s) => s.keysFor);
  const rebind = useShortcutStore((s) => s.rebind);
  const resetOne = useShortcutStore((s) => s.resetOne);
  const resetAll = useShortcutStore((s) => s.resetAll);
  const findConflict = useShortcutStore((s) => s.findConflict);
  const [capturingId, setCapturingId] = useState(null);

  // Group definitions by their Arabic section title.
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group).push(s);
    }
    return Array.from(map.entries());
  }, []);

  // Capture the next key chord while rebinding.
  useEffect(() => {
    if (!capturingId) return undefined;
    function onKey(e) {
      // Stop the central dispatcher (bubble phase) from acting on this keystroke.
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setCapturingId(null); return; }
      if (isPureModifier(e)) return; // wait for a non-modifier key
      const keys = eventToKeys(e);
      if (isReservedChord(keys)) {
        toast.error("هذا الاختصار محجوز للنظام ولا يمكن استخدامه");
        return;
      }
      const result = rebind(capturingId, keys);
      if (!result.ok) {
        if (result.conflict) {
          toast.error(`الاختصار مستخدم بالفعل في: ${result.conflict.label}`);
        }
        // keep capturing so the user can try another chord
        return;
      }
      toast.success(`تم تعيين ${formatKeys(keys)}`);
      setCapturingId(null);
      if (onChange) onChange("shortcuts_dirty", Date.now());
    }
    window.addEventListener("keydown", onKey, true); // capture phase
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturingId, rebind]);

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border-normal bg-bg-overlay/30 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Keyboard className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">زراير الكيبورد والاختصارات</h3>
            <p className="text-[11px] font-bold text-text-muted">{overrideCount > 0 ? `فيه ${overrideCount} اختصار متعدل عن الافتراضي` : "كل الزراير على الوضع الافتراضي بتاعها"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { resetAll(); if (onChange) onChange("shortcuts_dirty", Date.now()); toast.success("تمت إعادة كل الاختصارات للوضع الافتراضي"); }}
          disabled={overrideCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-1.5 text-xs font-black text-text-secondary hover:bg-bg-overlay disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> إعادة الكل للافتراضي
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-100 p-3 text-[12px] text-sky-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p>دوس «تغيير» وبعدين دوس على الزرار أو الزراير اللي إنت عايزها من الكيبورد. مينفعش تستخدم نفس الزرار لحاجتين في نفس الشاشة. لو عايز تلغي دوس Esc.</p>
          <p className="mt-1 font-bold">أي تعديل بتعمله بيسمّع في البرنامج كله على طول.</p>
        </div>
      </div>

      <div className="space-y-5">
        {groups.map(([group, items]) => (
          <div key={group} className="rounded-lg border border-border-normal overflow-hidden">
            <div className="bg-bg-overlay px-4 py-2.5 text-xs font-black uppercase tracking-widest text-text-secondary border-b border-border-normal/70">{group}</div>
            <div className="divide-y divide-border-subtle">
              {items.map((s) => {
                const editable = s.editable !== false;
                const isCapturing = capturingId === s.id;
                const overridden = Boolean(overrides[s.id]);
                const conflict = editable ? findConflict(keysFor(s.id), s.scope, s.id) : null;
                return (
                  <div key={s.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${overridden ? 'bg-amber-50/40' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-primary truncate">{s.label}</span>
                        {overridden && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-600">
                            <Pencil className="h-3 w-3" /> غير ثابت
                          </span>
                        )}
                        {conflict && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-black text-rose-600">
                            <AlertTriangle className="h-3 w-3" /> تعارض مع: {conflict.label}
                          </span>
                        )}
                      </div>
                      {SHORTCUT_DESC[s.id] && (
                        <p className="text-[11px] font-medium text-text-muted mt-0.5 leading-relaxed">{SHORTCUT_DESC[s.id]}</p>
                      )}
                      {s.pages?.length > 0 && (
                        <div className="mt-1 flex items-center flex-wrap gap-1">
                          <Monitor className="h-3 w-3 text-text-muted" />
                          <span className="text-[9px] font-bold text-text-muted ml-0.5">تظهر على:</span>
                          {s.pages.map((p) => (
                            <span key={p} className="rounded bg-bg-overlay px-1.5 py-0.5 text-[9px] font-bold text-text-secondary">{p}</span>
                          ))}
                        </div>
                      )}
                      {!editable && <div className="text-[10px] text-text-muted mt-0.5">للعرض فقط — يُدار داخل الشاشة</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCapturing ? (
                        <span className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-1 text-xs font-black text-primary animate-pulse">
                          اضغط الاختصار...
                        </span>
                      ) : (
                        <kbd className={`inline-flex items-center justify-center min-w-[44px] rounded-md border px-2 py-1 text-[11px] font-black font-mono ${
                          overridden
                            ? 'border-amber-300 bg-amber-100 text-amber-800'
                            : 'border-border-strong bg-bg-overlay text-text-primary'
                        }`}>
                          {formatKeys(keysFor(s.id))}
                        </kbd>
                      )}
                      {editable && (
                        <>
                          {isCapturing ? (
                            <button type="button" onClick={() => setCapturingId(null)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border-normal bg-bg-surface px-2 py-1 text-xs font-black text-text-secondary hover:bg-bg-overlay">
                              <X className="h-3.5 w-3.5" /> إلغاء
                            </button>
                          ) : (
                            <button type="button" onClick={() => setCapturingId(s.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border-normal bg-bg-surface px-2 py-1 text-xs font-black text-text-secondary hover:bg-bg-overlay">
                              <Pencil className="h-3.5 w-3.5" /> تغيير
                            </button>
                          )}
                          <button type="button" onClick={() => { resetOne(s.id); if (onChange) onChange("shortcuts_dirty", Date.now()); }} disabled={!overridden}
                            title="إعادة للافتراضي"
                            className="inline-flex items-center justify-center rounded-lg border border-border-normal bg-bg-surface p-1.5 text-text-muted hover:bg-bg-overlay hover:text-text-secondary disabled:opacity-30">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
