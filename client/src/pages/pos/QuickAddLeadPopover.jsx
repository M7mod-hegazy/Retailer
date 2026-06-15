import React, { useState, useRef, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

// Quick-add a walk-by WhatsApp lead, independent of any sale. Phone required; name/tag/birthday optional.
export default function QuickAddLeadPopover({ open, onClose }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const nameRef = useRef(null);
  const tagRef = useRef(null);
  const birthdayRef = useRef(null);
  const submitBtnRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPhone(""); setName(""); setTag(""); setBirthday(""); setSaving(false);
      setTimeout(() => phoneRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function save() {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/leads", {
        phone: phone.trim(),
        name: name.trim() || undefined,
        tags: tag.trim() ? [tag.trim()] : undefined,
        birthday: birthday || undefined,
        source: "quick_add",
      });
      toast.success("✅ تم حفظ الرقم في قائمة واتساب");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        dir="rtl"
        className="w-full max-w-sm mx-4 rounded-2xl bg-white p-5 shadow-2xl animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black text-slate-800 flex items-center gap-2">
            <span className="text-lg">📱</span> رقم واتساب سريع
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <input
            ref={phoneRef}
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={e => handleKeyDown(e, { nextRef: nameRef, onEnter: save })}
            placeholder="* رقم الهاتف / واتساب"
            className="w-full rounded-lg border border-green-200 bg-green-50/50 px-3 py-2.5 text-sm font-bold text-right outline-none focus:border-green-400 focus:bg-white placeholder:text-slate-400 placeholder:font-normal transition-colors"
          />
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={e => handleKeyDown(e, { nextRef: tagRef, prevRef: phoneRef })}
            placeholder="الاسم (اختياري)"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white placeholder:text-slate-400 placeholder:font-normal transition-colors"
          />
          <input
            ref={tagRef}
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={e => handleKeyDown(e, { nextRef: birthdayRef, prevRef: nameRef })}
            placeholder="وسم (اختياري) — مثال: جملة، VIP"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white placeholder:text-slate-400 placeholder:font-normal transition-colors"
          />
          <input
            ref={birthdayRef}
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: tagRef })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-500 outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            title="تاريخ الميلاد (اختياري)"
          />
        </div>

        <button
          ref={submitBtnRef}
          disabled={!phone.trim() || saving}
          onClick={save}
          onKeyDown={e => handleKeyDown(e, { onEnter: save, prevRef: birthdayRef })}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-black text-white hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "📲"}
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
        <p className="mt-2 text-[10px] font-bold text-slate-400 text-center">
          يُحفظ كجهة تسويق · لا يُضاف لقائمة العملاء
        </p>
      </div>
    </div>
  );
}
