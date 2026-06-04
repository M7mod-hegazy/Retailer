import { useState, useEffect } from "react";
import { X, Phone, MapPin, Edit2, Plus, Trash2, Save, Loader2, User } from "lucide-react";
import api from "../../services/api";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseJson(val) {
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

export default function CustomerInfoModal({ open, customerId, onClose, onUpdated }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !customerId) return;
    setEditMode(false);
    setError("");
    setLoading(true);
    api.get(`/api/customers/${customerId}`)
      .then(r => { setCustomer(r.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, customerId]);

  function openEdit() {
    if (!customer) return;
    const phones = [customer.phone || "", ...parseJson(customer.additional_phones)].filter((_, i, arr) =>
      i === 0 || arr[i] !== ""
    );
    const addresses = parseJson(customer.addresses);
    setForm({
      name: customer.name || "",
      phones: phones.length ? phones : [""],
      addresses: addresses.length ? addresses : [""],
      notes: customer.notes || "",
    });
    setEditMode(true);
    setError("");
  }

  function setPhone(i, val) { setForm(f => { const p = [...f.phones]; p[i] = val; return { ...f, phones: p }; }); }
  function addPhone() { setForm(f => ({ ...f, phones: [...f.phones, ""] })); }
  function removePhone(i) { setForm(f => ({ ...f, phones: f.phones.filter((_, idx) => idx !== i) })); }
  function setAddress(i, val) { setForm(f => { const a = [...f.addresses]; a[i] = val; return { ...f, addresses: a }; }); }
  function addAddress() { setForm(f => ({ ...f, addresses: [...f.addresses, ""] })); }
  function removeAddress(i) { setForm(f => ({ ...f, addresses: f.addresses.filter((_, idx) => idx !== i) })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("اسم العميل مطلوب"); return; }
    setSaving(true);
    try {
      const filledPhones = form.phones.map(p => p.trim()).filter(Boolean);
      const filledAddresses = form.addresses.map(a => a.trim()).filter(Boolean);
      const r = await api.put(`/api/customers/${customer.id}`, {
        ...customer,
        name: form.name.trim(),
        phone: filledPhones[0] || null,
        additional_phones: filledPhones.length > 1 ? JSON.stringify(filledPhones.slice(1)) : null,
        addresses: filledAddresses.length > 0 ? JSON.stringify(filledAddresses) : null,
        notes: form.notes.trim() || null,
      });
      const updated = r.data.data;
      setCustomer(updated);
      setEditMode(false);
      onUpdated?.(updated);
    } catch (e) {
      setError(e.response?.data?.message || "فشل حفظ البيانات");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setEditMode(false);
    setError("");
    onClose();
  }

  if (!open) return null;

  const bal = customer ? Number(customer.opening_balance || 0) : 0;
  const extraPhones = customer ? parseJson(customer.additional_phones) : [];
  const addresses = customer ? parseJson(customer.addresses) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-700">
            {editMode ? "تعديل بيانات العميل" : "بيانات العميل"}
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          )}

          {!loading && customer && !editMode && (
            <div className="px-5 py-4 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xl font-black text-white shrink-0">
                  {customer.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-[16px] font-black text-slate-900">{customer.name}</p>
                  {customer.code && (
                    <span className="text-[11px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{customer.code}</span>
                  )}
                </div>
              </div>

              {/* Balance pill */}
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${bal > 0 ? "bg-rose-50 border border-rose-200" : bal < 0 ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
                <span className={`text-[11px] font-black uppercase tracking-wide ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                  {bal > 0 ? "عليه رصيد" : bal < 0 ? "له رصيد" : "مسوّى"}
                </span>
                <span className={`text-[18px] font-black font-mono ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                  {fmt(Math.abs(bal))} <span className="text-[11px]">ج.م</span>
                </span>
              </div>

              {/* Phones */}
              {(customer.phone || extraPhones.length > 0) && (
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">أرقام الهاتف</p>
                  <div className="space-y-1.5">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-mono">
                        <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        {customer.phone}
                      </div>
                    )}
                    {extraPhones.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-500 font-mono">
                        <Phone className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Addresses */}
              {addresses.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">العناوين</p>
                  <div className="space-y-1.5">
                    {addresses.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {customer.notes && (
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">ملاحظات</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{customer.notes}</p>
                </div>
              )}

              {/* No contact info */}
              {!customer.phone && extraPhones.length === 0 && addresses.length === 0 && !customer.notes && (
                <p className="text-sm text-slate-400 text-center py-2">لا توجد بيانات تواصل مضافة</p>
              )}
            </div>
          )}

          {!loading && customer && editMode && (
            <div className="px-5 py-4 space-y-4">
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  الاسم <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
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
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        placeholder={i === 0 ? "رقم الهاتف الرئيسي" : "رقم إضافي"}
                        value={phone}
                        onChange={e => setPhone(i, e.target.value)}
                        dir="ltr"
                      />
                      {form.phones.length > 1 && (
                        <button type="button" onClick={() => removePhone(i)}
                          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.phones.length < 5 && (
                  <button type="button" onClick={addPhone}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    <Plus size={13} /> إضافة رقم آخر
                  </button>
                )}
              </div>

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
                        <button type="button" onClick={() => removeAddress(i)}
                          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors mt-0.5">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.addresses.length < 5 && (
                  <button type="button" onClick={addAddress}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    <Plus size={13} /> إضافة عنوان آخر
                  </button>
                )}
              </div>

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
          )}
        </div>

        {/* Footer */}
        {!loading && customer && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0">
            {editMode ? (
              <>
                <button onClick={() => { setEditMode(false); setError(""); }}
                  className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  إلغاء
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  حفظ التعديلات
                </button>
              </>
            ) : (
              <>
                <button onClick={handleClose}
                  className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                  إغلاق
                </button>
                <button onClick={openEdit}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                  <Edit2 size={14} />
                  تعديل
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
