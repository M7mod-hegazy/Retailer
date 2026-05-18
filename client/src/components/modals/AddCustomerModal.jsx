import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import api from "../../services/api";

const EMPTY_FORM = { name: "", phones: [""], addresses: [""], opening_balance: "", notes: "" };

export default function AddCustomerModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() { setForm(EMPTY_FORM); setError(""); }

  function handleClose() { reset(); onClose(); }

  function setPhone(i, val) {
    setForm(f => { const phones = [...f.phones]; phones[i] = val; return { ...f, phones }; });
  }
  function addPhone() { setForm(f => ({ ...f, phones: [...f.phones, ""] })); }
  function removePhone(i) { setForm(f => ({ ...f, phones: f.phones.filter((_, idx) => idx !== i) })); }

  function setAddress(i, val) {
    setForm(f => { const addresses = [...f.addresses]; addresses[i] = val; return { ...f, addresses }; });
  }
  function addAddress() { setForm(f => ({ ...f, addresses: [...f.addresses, ""] })); }
  function removeAddress(i) { setForm(f => ({ ...f, addresses: f.addresses.filter((_, idx) => idx !== i) })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("اسم العميل مطلوب"); return; }
    setSaving(true);
    try {
      const filledPhones = form.phones.map(p => p.trim()).filter(Boolean);
      const filledAddresses = form.addresses.map(a => a.trim()).filter(Boolean);
      const r = await api.post("/api/customers", {
        name: form.name.trim(),
        phone: filledPhones[0] || undefined,
        additional_phones: filledPhones.length > 1 ? JSON.stringify(filledPhones.slice(1)) : undefined,
        addresses: filledAddresses.length > 0 ? JSON.stringify(filledAddresses) : undefined,
        opening_balance: form.opening_balance ? Number(form.opening_balance) : 0,
        notes: form.notes.trim() || undefined,
      });
      reset();
      onCreated(r.data.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "فشل إنشاء العميل");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">إضافة عميل جديد</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              اسم العميل <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="أدخل اسم العميل"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Phones */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">أرقام الهاتف</label>
            <div className="space-y-2">
              {form.phones.map((phone, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder={i === 0 ? "رقم الهاتف الرئيسي" : "رقم إضافي"}
                    value={phone}
                    onChange={e => setPhone(i, e.target.value)}
                    dir="ltr"
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.phones.length < 5 && (
              <button
                type="button"
                onClick={addPhone}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={13} />
                إضافة رقم آخر
              </button>
            )}
          </div>

          {/* Addresses */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">العناوين</label>
            <div className="space-y-2">
              {form.addresses.map((addr, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder={i === 0 ? "العنوان الرئيسي (اختياري)" : "عنوان إضافي"}
                    value={addr}
                    onChange={e => setAddress(i, e.target.value)}
                  />
                  {form.addresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAddress(i)}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.addresses.length < 5 && (
              <button
                type="button"
                onClick={addAddress}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={13} />
                إضافة عنوان آخر
              </button>
            )}
          </div>

          {/* Opening balance */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">الرصيد الافتتاحي</label>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="0"
              value={form.opening_balance}
              onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">ملاحظات</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
              placeholder="اختياري"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
