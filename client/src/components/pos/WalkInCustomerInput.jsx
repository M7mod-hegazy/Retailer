import React from "react";
import { X } from "lucide-react";

// Controlled walk-in customer create UI — a lightweight phone+name capture with
// a "تأكيد" commit, mirroring the POS walk-in flow. Once committed it shows a
// chip (edit / remove). Mutually exclusive with a selected real customer:
// the parent should hide/disable its customer search while `committed` is true.
//
// Props (all controlled by the parent):
//   phone, name           — current values
//   onPhoneChange(v), onNameChange(v)
//   committed             — boolean; true = show the committed chip
//   onCommit()            — user pressed تأكيد (phone valid)
//   onEdit()              — user pressed تعديل (back to inputs, keep values)
//   onRemove()            — user cleared the walk-in entirely
export default function WalkInCustomerInput({
  phone, name, onPhoneChange, onNameChange,
  committed, onCommit, onEdit, onRemove,
}) {
  const phoneValid = String(phone || "").replace(/\D/g, "").length >= 10;

  if (committed && phone) {
    return (
      <div className="mt-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-base">🚶</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-emerald-800 truncate">{name || "عميل نقدي"}</p>
            <p className="text-[11px] font-bold text-emerald-600 font-mono" dir="ltr">{phone}</p>
          </div>
          <button type="button" onClick={onEdit} title="تعديل البيانات"
            className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors">
            تعديل
          </button>
          <button type="button" onClick={onRemove} title="إزالة العميل النقدي"
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
      <div className="flex items-center gap-1.5 px-3 pt-2">
        <span className="text-[11px] font-black text-emerald-700">🚶 عميل نقدي (اختياري)</span>
      </div>
      <div className="flex items-center gap-1.5 p-2">
        <input type="tel" dir="ltr" value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && phoneValid) onCommit(); }}
          placeholder="01xxxxxxxxx"
          className="w-[38%] rounded-lg border border-emerald-200 bg-white/80 px-2.5 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white transition-colors placeholder:text-emerald-600/40"
        />
        <input type="text" value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && phoneValid) onCommit(); }}
          placeholder="الاسم (اختياري)"
          className="flex-1 min-w-0 rounded-lg border border-emerald-100 bg-white/60 px-2.5 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white transition-colors placeholder:text-slate-400"
        />
        <button type="button" onClick={onCommit} disabled={!phoneValid}
          className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-[12px] font-black text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors">
          تأكيد
        </button>
      </div>
    </div>
  );
}
