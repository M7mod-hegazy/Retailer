import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import Button from "../ui/Button";

const EMPTY_FORM = { name: "", phones: [""], addresses: [""], opening_balance: "", notes: "" };

export default function DetachedCustomerForm({ initialState, sendAction, token }) {
  useEffect(() => {
    if (token) useAuthStore.setState({ token });
  }, [token]);

  useEffect(() => {
    const onUnload = () => sendAction?.("cancel");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      sendAction?.("cancel");
    };
  }, [sendAction]);
  const [form, setForm] = useState(initialState || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

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
      sendAction?.("created", r.data.data);
      window.close();
    } catch (e) {
      setError(e.response?.data?.message || "فشل إنشاء العميل");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-white" dir="rtl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="truncate text-sm font-bold text-slate-800">إضافة عميل جديد</h3>
        <button
          type="button"
          onClick={() => window.close()}
          className="flex h-7 w-7 items-center justify-center rounded-sm bg-red-600 text-white transition-colors hover:bg-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            اسم العميل <span className="text-red-500">*</span>
          </label>
          <input
            ref={nameRef}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="أدخل اسم العميل"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">أرقام الهاتف</label>
          <div className="space-y-2">
            {form.phones.map((phone, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
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

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">العناوين</label>
          <div className="space-y-2">
            {form.addresses.map((addr, i) => (
              <div key={i} className="flex items-start gap-2">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
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

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">الرصيد الافتتاحي</label>
          <input
            type="number"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="0"
            value={form.opening_balance}
            onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ملاحظات</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            placeholder="اختياري"
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 shrink-0">
        <Button variant="danger" size="sm" onClick={() => window.close()}>إلغاء</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </div>
    </div>
  );
}
