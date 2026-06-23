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
export default function ShortcutsTab() {
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
    }
    window.addEventListener("keydown", onKey, true); // capture phase
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturingId, rebind]);

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700">
          <Keyboard className="h-5 w-5" />
          <h3 className="text-base font-black">اختصارات لوحة المفاتيح</h3>
        </div>
        <button
          type="button"
          onClick={() => { resetAll(); toast.success("تمت إعادة كل الاختصارات للوضع الافتراضي"); }}
          disabled={overrideCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> إعادة الكل للافتراضي
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 p-3 text-[12px] text-sky-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p>اضغط «تغيير» ثم اضغط الاختصار الجديد على لوحة المفاتيح. لا يمكن استخدام نفس الاختصار لأمرين في نفس الشاشة. اضغط Esc للإلغاء.</p>
          <p className="mt-1 font-bold">التغييرات تنعكس فوراً على جميع الأزرار والشاشات المتأثرة بالاختصار.</p>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map(([group, items]) => (
          <div key={group} className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-500">{group}</div>
            <div className="divide-y divide-slate-100">
              {items.map((s) => {
                const editable = s.editable !== false;
                const isCapturing = capturingId === s.id;
                const overridden = Boolean(overrides[s.id]);
                const conflict = editable ? findConflict(keysFor(s.id), s.scope, s.id) : null;
                return (
                  <div key={s.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${overridden ? 'bg-amber-50/40' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-700 truncate">{s.label}</span>
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
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 leading-relaxed">{SHORTCUT_DESC[s.id]}</p>
                      )}
                      {s.pages?.length > 0 && (
                        <div className="mt-1 flex items-center flex-wrap gap-1">
                          <Monitor className="h-3 w-3 text-slate-300" />
                          <span className="text-[9px] font-bold text-slate-400 ml-0.5">تظهر على:</span>
                          {s.pages.map((p) => (
                            <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{p}</span>
                          ))}
                        </div>
                      )}
                      {!editable && <div className="text-[10px] text-slate-400 mt-0.5">للعرض فقط — يُدار داخل الشاشة</div>}
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
                            : 'border-slate-300 bg-slate-100 text-slate-700'
                        }`}>
                          {formatKeys(keysFor(s.id))}
                        </kbd>
                      )}
                      {editable && (
                        <>
                          {isCapturing ? (
                            <button type="button" onClick={() => setCapturingId(null)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-500 hover:bg-slate-50">
                              <X className="h-3.5 w-3.5" /> إلغاء
                            </button>
                          ) : (
                            <button type="button" onClick={() => setCapturingId(s.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600 hover:bg-slate-50">
                              <Pencil className="h-3.5 w-3.5" /> تغيير
                            </button>
                          )}
                          <button type="button" onClick={() => resetOne(s.id)} disabled={!overridden}
                            title="إعادة للافتراضي"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30">
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
