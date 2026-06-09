import React from "react";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import PermissionGate from "../../../components/ui/PermissionGate";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

// Dropdown listing held (paused) invoices with resume / discard actions.
export default function HeldDropdown({ heldInvoices, onResume, onDiscard, onClose }) {
  if (!heldInvoices.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 min-w-[320px] overflow-hidden rounded-xl border border-amber-200 bg-white shadow-[0_12px_48px_-8px_rgba(0,0,0,0.2)]">
      <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
        {heldInvoices.map((h) => (
          <div key={h.id} className="flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <PauseCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-800 truncate">{h.customer?.name || "زبون نقدي"}</span>
                <span className="font-mono text-sm font-black text-amber-700 shrink-0">{formatMoney(h.heldTotal)} ج.م</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">{h.linesCount} أصناف</span>
                <span className="text-[11px] text-slate-400 font-mono">{formatArabicDateTime(new Date(h.heldAt))}</span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <PermissionGate page="pos" action="hold">
                <button onClick={() => { onResume(h.id); onClose(); }} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all active:scale-[0.98]" title="استئناف">
                  <PlayCircle className="h-5 w-5" />
                </button>
              </PermissionGate>
              <PermissionGate page="pos" action="void">
                <button onClick={() => onDiscard(h.id)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-[0.98]" title="حذف">
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
