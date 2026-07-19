import { useState, useRef, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import api from "../../services/api";
import { openDetachedModal } from "../../hooks/useDetach";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

const EMPTY_FORM = { name: "", phones: [""], addresses: [""], opening_balance: "", notes: "" };

export default function AddCustomerModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const balanceRef = useRef(null);
  const notesRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  const onCreatedRef = useRef(onCreated);
  const onCloseRef = useRef(onClose);
  onCreatedRef.current = onCreated;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!window.electronAPI?.onModalAction) return;
    const cleanup = window.electronAPI.onModalAction(({ action, data }) => {
      if (action === "created" && data) {
        reset();
        onCreatedRef.current(data);
        onCloseRef.current();
      }
    });
    return () => cleanup?.();
  }, []);

  function handleDetach() {
    openDetachedModal("add-customer", { initialState: form });
    onClose();
  }

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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="إضافة عميل جديد"
      maxWidth="max-w-[480px]"
      onDetach={handleDetach}
    >
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          اسم العميل <span className="text-red-500">*</span>
        </label>
        <input
          ref={nameRef}
          className="w-full border border-border-normal rounded-lg px-3 py-2 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          placeholder="أدخل اسم العميل"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => handleKeyDown(e, { nextRef: phoneRef })}
          autoFocus
        />
      </div>

      {/* Phones */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">أرقام الهاتف</label>
        <div className="space-y-2">
          {form.phones.map((phone, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                ref={i === 0 ? phoneRef : undefined}
                className="flex-1 border border-border-normal rounded-lg px-3 py-2 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                placeholder={i === 0 ? "رقم الهاتف الرئيسي" : "رقم إضافي"}
                value={phone}
                onChange={e => setPhone(i, e.target.value)}
                onKeyDown={i === 0 ? e => handleKeyDown(e, { nextRef: addressRef, prevRef: nameRef }) : undefined}
                dir="ltr"
              />
              {form.phones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePhone(i)}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-500 transition-colors"
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
      <div className="mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">العناوين</label>
        <div className="space-y-2">
          {form.addresses.map((addr, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                ref={i === 0 ? addressRef : undefined}
                className="flex-1 border border-border-normal rounded-lg px-3 py-2 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                placeholder={i === 0 ? "العنوان الرئيسي (اختياري)" : "عنوان إضافي"}
                value={addr}
                onChange={e => setAddress(i, e.target.value)}
                onKeyDown={i === 0 ? e => handleKeyDown(e, { nextRef: balanceRef, prevRef: phoneRef }) : undefined}
              />
              {form.addresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAddress(i)}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-500 transition-colors mt-0.5"
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
      <div className="mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1">الرصيد الافتتاحي</label>
        <input
          ref={balanceRef}
          type="number"
          className="w-full border border-border-normal rounded-lg px-3 py-2 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          placeholder="0"
          value={form.opening_balance}
          onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
          onKeyDown={e => handleKeyDown(e, { nextRef: notesRef, prevRef: addressRef })}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">ملاحظات</label>
        <textarea
          ref={notesRef}
          className="w-full border border-border-normal rounded-lg px-3 py-2 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
          placeholder="اختياري"
          rows={2}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          onKeyDown={e => handleKeyDown(e, { prevRef: balanceRef, onEnter: handleSave })}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 mt-4 border-t border-border-subtle">
        <Button variant="danger" size="sm" onClick={handleClose}>إلغاء</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </div>
    </Modal>
  );
}
