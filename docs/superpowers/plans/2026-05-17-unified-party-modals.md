# Unified Party Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 7 scattered inline customer/supplier creation modals with two reusable global components, add notes display to the accounts pages, and improve the الحركات invoice row to show total and cash-paid figures.

**Architecture:** Two new modal components in `client/src/components/modals/` encapsulate the API call and form state. Each consuming page imports the modal, passes `open`/`onClose`/`onCreated` props, and handles the returned party object in `onCreated`. No backend changes are needed.

**Tech Stack:** React 18, TailwindCSS, Axios via `client/src/services/api.js`

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `client/src/components/modals/AddCustomerModal.jsx` |
| **Create** | `client/src/components/modals/AddSupplierModal.jsx` |
| **Modify** | `client/src/pages/accounts/CustomerAccountsPage.jsx` |
| **Modify** | `client/src/pages/accounts/SupplierAccountsPage.jsx` |
| **Modify** | `client/src/pages/sales/SalesReturnFormPage.jsx` |
| **Modify** | `client/src/pages/pos/POSPage.jsx` |
| **Modify** | `client/src/pages/purchases/PurchaseFormPage.jsx` |
| **Modify** | `client/src/pages/purchases/PurchaseReturnFormPage.jsx` |
| **Delete** | `client/src/pages/customers/CustomerFormModal.jsx` |
| **Delete** | `client/src/pages/suppliers/SupplierFormModal.jsx` |

---

## Task 1: Create AddCustomerModal

**Files:**
- Create: `client/src/components/modals/AddCustomerModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from "react";
import { X } from "lucide-react";
import api from "../../services/api";

export default function AddCustomerModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", opening_balance: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ name: "", phone: "", opening_balance: "", notes: "" });
    setError("");
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("اسم العميل مطلوب"); return; }
    setSaving(true);
    try {
      const r = await api.post("/api/customers", {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="w-[440px] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-[15px] font-black text-slate-900">إضافة عميل جديد</h2>
          <button onClick={() => { reset(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">اسم العميل <span className="text-rose-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="مثلاً: أحمد محمد..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">رصيد افتتاحي</label>
            <input
              type="number"
              value={form.opening_balance}
              onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-mono font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">ملاحظات (اختياري)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="أي ملاحظات..."
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none"
            />
          </div>
          {error && <p className="text-[12px] font-bold text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => { reset(); onClose(); }}
            className="rounded-xl border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-[13px] font-black text-white hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200"
          >
            {saving ? "جاري الحفظ..." : "حفظ العميل"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/modals/AddCustomerModal.jsx
git commit -m "feat: add reusable AddCustomerModal component"
```

---

## Task 2: Create AddSupplierModal

**Files:**
- Create: `client/src/components/modals/AddSupplierModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from "react";
import { X } from "lucide-react";
import api from "../../services/api";

export default function AddSupplierModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", opening_balance: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ name: "", phone: "", opening_balance: "", notes: "" });
    setError("");
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("اسم المورد مطلوب"); return; }
    setSaving(true);
    try {
      const r = await api.post("/api/suppliers", {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        opening_balance: form.opening_balance ? Number(form.opening_balance) : 0,
        notes: form.notes.trim() || undefined,
      });
      reset();
      onCreated(r.data.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "فشل إنشاء المورد");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="w-[440px] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-[15px] font-black text-slate-900">إضافة مورد جديد</h2>
          <button onClick={() => { reset(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">اسم المورد <span className="text-rose-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="مثلاً: شركة الأمل للتوريد..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">رصيد افتتاحي</label>
            <input
              type="number"
              value={form.opening_balance}
              onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-mono font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">ملاحظات (اختياري)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="أي ملاحظات..."
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-100 resize-none"
            />
          </div>
          {error && <p className="text-[12px] font-bold text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => { reset(); onClose(); }}
            className="rounded-xl border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-orange-600 px-6 py-2.5 text-[13px] font-black text-white hover:bg-orange-700 disabled:opacity-50 shadow-md shadow-orange-200"
          >
            {saving ? "جاري الحفظ..." : "حفظ المورد"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/modals/AddSupplierModal.jsx
git commit -m "feat: add reusable AddSupplierModal component"
```

---

## Task 3: Update CustomerAccountsPage

Three changes in one file: (A) swap inline modal for `AddCustomerModal`, (B) show `customer.notes` in the detail panel, (C) add إجمالي الفاتورة + دفع نقداً in the MovementsTab.

**Files:**
- Modify: `client/src/pages/accounts/CustomerAccountsPage.jsx`

- [ ] **Step 1: Add import at top of file**

Find the existing imports block (first ~15 lines) and add:

```js
import AddCustomerModal from "../../components/modals/AddCustomerModal";
```

- [ ] **Step 2: Replace createForm state and handleCreate**

Find and replace:

```js
  const [createForm, setCreateForm] = useState({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "", code: "", opening_balance: 0, credit_limit: 0 });
```

Replace with nothing (delete this line entirely).

Then find and replace the entire `handleCreate` function:

```js
  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);
    try {
      const additionalPhones = createForm.additionalPhones.filter(p => p.trim()).join("|");
      const addresses = createForm.addresses.filter(a => a.trim()).join("|");
      const r = await api.post("/api/customers", { ...createForm, additional_phones: additionalPhones || null, addresses: addresses || null });
      toast.success("تم إضافة العميل");
      setShowCreate(false);
      setCreateForm({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "", code: "", opening_balance: 0, credit_limit: 0 });
      await loadCustomers();
      selectCustomer(r.data.data, "movements");
    } catch (e) { toast.error(e.response?.data?.message || "فشل الإضافة"); }
    finally { setSaving(false); }
  };
```

Replace with:

```js
  const handleCustomerCreated = async (customer) => {
    toast.success("تم إضافة العميل");
    await loadCustomers();
    selectCustomer(customer, "movements");
  };
```

- [ ] **Step 3: Replace the inline create modal JSX**

Find (the entire create modal block — starts with `{/* Create Customer */}`):

```jsx
{/* Create Customer */}
{showCreate && (
  <Modal onClose={() => setShowCreate(false)}>
```

…all the way to its closing `)}` (the block ends after the إلغاء button). Replace the entire `{showCreate && (<Modal>…</Modal>)}` block with:

```jsx
<AddCustomerModal
  open={showCreate}
  onClose={() => setShowCreate(false)}
  onCreated={handleCustomerCreated}
/>
```

- [ ] **Step 4: Add notes display in the detail panel**

Find:

```jsx
                      {selected.is_blacklisted === 1 && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">محظور</span>
                      )}
                    </div>
                  </div>
                </div>
```

Replace with:

```jsx
                      {selected.is_blacklisted === 1 && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">محظور</span>
                      )}
                    </div>
                    {selected.notes && (
                      <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">{selected.notes}</p>
                    )}
                  </div>
                </div>
```

- [ ] **Step 5: Add invoice total + cash paid in MovementsTab**

In the `MovementsTab` function, find the payment chips section followed by the InstallmentsBadge section:

```jsx
            {/* Payment chips — what was actually paid on this invoice */}
            {ev.type === "invoice" && ev.chips?.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {ev.chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    {arMethod(chip.method)}
                    <span className="font-mono text-slate-500">{fmt(chip.amount)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Installments expandable on آجل / تقسيط invoices */}
            {ev.type === "invoice" && (ev.raw?.payment_type === "credit" || ev.raw?.payment_type === "installments") && ev.raw?.id && (
```

Replace with:

```jsx
            {/* Payment chips — what was actually paid on this invoice */}
            {ev.type === "invoice" && ev.chips?.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {ev.chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    {arMethod(chip.method)}
                    <span className="font-mono text-slate-500">{fmt(chip.amount)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Invoice total + cash paid for آجل / تقسيط invoices */}
            {ev.type === "invoice" && (ev.raw?.payment_type === "credit" || ev.raw?.payment_type === "installments") && (
              <div className="px-4 pb-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">إجمالي الفاتورة</span>
                  <span className="text-[11px] font-black font-mono text-slate-700">{fmt(Number(ev.raw.total || 0))} <span className="text-[9px] opacity-60">ج.م</span></span>
                </div>
                {Number(ev.raw.amount_received || 0) > 0.005 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">دفع نقداً</span>
                    <span className="text-[11px] font-black font-mono text-emerald-600">{fmt(Number(ev.raw.amount_received || 0))} <span className="text-[9px] opacity-60">ج.م</span></span>
                  </div>
                )}
              </div>
            )}

            {/* Installments expandable on آجل / تقسيط invoices */}
            {ev.type === "invoice" && (ev.raw?.payment_type === "credit" || ev.raw?.payment_type === "installments") && ev.raw?.id && (
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/accounts/CustomerAccountsPage.jsx
git commit -m "feat: unify customer create modal, show notes, improve movements invoice row"
```

---

## Task 4: Update SupplierAccountsPage

Same three changes: swap modal, add notes, improve MovementsTab.

**Files:**
- Modify: `client/src/pages/accounts/SupplierAccountsPage.jsx`

- [ ] **Step 1: Add import**

```js
import AddSupplierModal from "../../components/modals/AddSupplierModal";
```

- [ ] **Step 2: Replace createForm state and handleCreate**

Find and delete:

```js
  const [createForm, setCreateForm] = useState({ name: "", phone: "", code: "", opening_balance: 0, payment_terms: "", bank_details: "" });
```

Find and replace the entire `handleCreate` function:

```js
  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);
    try {
      const r = await api.post("/api/suppliers", createForm);
      toast.success("تم إضافة المورد");
      setShowCreate(false);
      setCreateForm({ name: "", phone: "", code: "", opening_balance: 0, payment_terms: "", bank_details: "" });
      await loadSuppliers();
      selectSupplier(r.data.data, "movements");
    } catch (e) { toast.error(e.response?.data?.message || "فشل الإضافة"); }
    finally { setSaving(false); }
  };
```

Replace with:

```js
  const handleSupplierCreated = async (supplier) => {
    toast.success("تم إضافة المورد");
    await loadSuppliers();
    selectSupplier(supplier, "movements");
  };
```

- [ ] **Step 3: Replace inline create modal JSX**

Find the entire `{showCreate && (<Modal>…</Modal>)}` block (the one with "إضافة مورد جديد" title containing name, phone, opening_balance, payment_terms fields) and replace with:

```jsx
<AddSupplierModal
  open={showCreate}
  onClose={() => setShowCreate(false)}
  onCreated={handleSupplierCreated}
/>
```

- [ ] **Step 4: Add notes display in the supplier detail panel**

In the supplier detail header section, find the block that shows phone and blacklisted status (similar structure to CustomerAccountsPage). Find:

```jsx
                      {selected.is_blacklisted === 1 && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">محظور</span>
                      )}
                    </div>
                  </div>
                </div>
```

Replace with:

```jsx
                      {selected.is_blacklisted === 1 && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">محظور</span>
                      )}
                    </div>
                    {selected.notes && (
                      <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">{selected.notes}</p>
                    )}
                  </div>
                </div>
```

- [ ] **Step 5: Add invoice total + cash paid in SupplierAccountsPage MovementsTab**

In the `MovementsTab` function inside `SupplierAccountsPage.jsx`, find:

```jsx
            {ev.type === "purchase" && ev.chips?.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {ev.chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    {arMethod(chip.method)}
                    <span className="font-mono text-slate-500">{fmt(chip.amount)}</span>
                  </span>
                ))}
              </div>
            )}

            {ev.type === "purchase" && ev.raw?.payment_type === "credit" && ev.raw?.id && (
```

Replace with:

```jsx
            {ev.type === "purchase" && ev.chips?.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {ev.chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    {arMethod(chip.method)}
                    <span className="font-mono text-slate-500">{fmt(chip.amount)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Invoice total + cash paid for آجل purchases */}
            {ev.type === "purchase" && (ev.raw?.payment_type === "credit" || ev.raw?.payment_type === "installments") && (
              <div className="px-4 pb-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">إجمالي الفاتورة</span>
                  <span className="text-[11px] font-black font-mono text-slate-700">{fmt(Number(ev.raw.total || 0))} <span className="text-[9px] opacity-60">ج.م</span></span>
                </div>
                {Number(ev.raw.amount_received || 0) > 0.005 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">دفع نقداً</span>
                    <span className="text-[11px] font-black font-mono text-emerald-600">{fmt(Number(ev.raw.amount_received || 0))} <span className="text-[9px] opacity-60">ج.م</span></span>
                  </div>
                )}
              </div>
            )}

            {ev.type === "purchase" && ev.raw?.payment_type === "credit" && ev.raw?.id && (
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/accounts/SupplierAccountsPage.jsx
git commit -m "feat: unify supplier create modal, show notes, improve movements purchase row"
```

---

## Task 5: Update SalesReturnFormPage

**Files:**
- Modify: `client/src/pages/sales/SalesReturnFormPage.jsx`

- [ ] **Step 1: Add import, remove CustomerCreateModal function**

Add at the top (with other imports):

```js
import AddCustomerModal from "../../components/modals/AddCustomerModal";
```

Find and delete the entire inline `CustomerCreateModal` function (lines 35–137, from `function CustomerCreateModal({` to its closing `}`).

- [ ] **Step 2: Replace JSX usage**

Find (wherever `<CustomerCreateModal` is rendered, which uses `customerCreateOpen` state and `onCreated`):

```jsx
      <CustomerCreateModal
        open={customerCreateOpen}
        onClose={() => setCustomerCreateOpen(false)}
        onCreated={(c) => {
```

…and the full block until the closing `/>` or `</CustomerCreateModal>`. Replace with:

```jsx
      <AddCustomerModal
        open={customerCreateOpen}
        onClose={() => setCustomerCreateOpen(false)}
        onCreated={(c) => {
          setCustomers(prev => [c, ...prev]);
          setCustomer({ id: c.id, name: c.name });
          setCustomerCreateOpen(false);
        }}
      />
```

Note: if `setCustomerCreateOpen(false)` is already called inside `AddCustomerModal` (it is — modal calls `onClose()` after `onCreated`), remove it from the callback to avoid a double-close. The correct callback is:

```jsx
      <AddCustomerModal
        open={customerCreateOpen}
        onClose={() => setCustomerCreateOpen(false)}
        onCreated={(c) => {
          setCustomers(prev => [c, ...prev]);
          setCustomer({ id: c.id, name: c.name });
        }}
      />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "refactor: replace inline CustomerCreateModal with AddCustomerModal in SalesReturnFormPage"
```

---

## Task 6: Update POSPage

POSPage has **two** identical inline customer create modals (list view and grid view) both controlled by `customerCreateOpen`. Replace both with a single `AddCustomerModal` instance, and remove the `customerDraft` state and `createQuickCustomer` function.

**Files:**
- Modify: `client/src/pages/pos/POSPage.jsx`

- [ ] **Step 1: Add import**

```js
import AddCustomerModal from "../../components/modals/AddCustomerModal";
```

- [ ] **Step 2: Remove customerDraft state**

Find and delete:

```js
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "" });
```

- [ ] **Step 3: Remove createQuickCustomer function**

Find and delete the entire `createQuickCustomer` function:

```js
  async function createQuickCustomer() {
    if (!customerDraft.name.trim()) {
      setSaveMessage("أدخل اسم العميل."); return;
    }
    try {
      const additionalPhones = customerDraft.additionalPhones.filter(p => p.trim()).join("|");
      const addresses = customerDraft.addresses.filter(a => a.trim()).join("|");
      const response = await api.post("/api/customers", {
        name:    customerDraft.name.trim(),
        phone:   customerDraft.phone.trim() || null,
        additional_phones: additionalPhones || null,
        addresses: addresses || null,
        notes:   customerDraft.notes.trim() || null,
      });
      const newCustomer = response.data?.data;
      if (newCustomer) { setCustomers((prev) => [newCustomer, ...prev]); setCustomer(newCustomer); setCustomerQuery(newCustomer.name); }
      setCustomerCreateOpen(false);
      setCustomerDraft({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "" });
      setSaveMessage("");
    } catch (error) { setSaveMessage(error.response?.data?.message || "تعذر إنشاء العميل."); }
  }
```

- [ ] **Step 4: Replace first inline customer modal (list view)**

Find the first customer create modal block (in the list-view section). It starts with:

```jsx
        {/* Quick customer creation modal for list view */}
        <Modal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} title="إنشاء عميل جديد">
          <div className="space-y-4 animate-modal-enter">
```

Find the entire block until its closing `</Modal>` and replace with:

```jsx
        <AddCustomerModal
          open={customerCreateOpen}
          onClose={() => setCustomerCreateOpen(false)}
          onCreated={(customer) => {
            setCustomers(prev => [customer, ...prev]);
            setCustomer(customer);
            setCustomerQuery(customer.name);
          }}
        />
```

- [ ] **Step 5: Replace second inline customer modal (grid view)**

Find the second modal block. It starts with:

```jsx
      {/* ── Quick customer creation ── */}
      <Modal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} title="إنشاء عميل جديد">
        <div className="space-y-4 animate-modal-enter">
```

Find and delete the entire block until its closing `</Modal>`. Do **not** add another `<AddCustomerModal>` — the one added in Step 4 already covers both cases since it's always rendered.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/POSPage.jsx
git commit -m "refactor: replace duplicate customer create modals in POSPage with AddCustomerModal"
```

---

## Task 7: Update PurchaseFormPage

**Files:**
- Modify: `client/src/pages/purchases/PurchaseFormPage.jsx`

- [ ] **Step 1: Add import**

```js
import AddSupplierModal from "../../components/modals/AddSupplierModal";
```

- [ ] **Step 2: Remove supplierDraft state and createSupplier function**

Find and delete:

```js
    setSupplierDraft({ name: "", phone: "", address: "" });
```

(and the full `useState` initializing `supplierDraft` with those fields)

Find and delete the entire `createSupplier` function:

```js
  async function createSupplier() {
    if (!supplierDraft.name) return;
    try {
      const r = await api.post("/api/suppliers", supplierDraft);
      const newSup = r.data.data;
      setSuppliers(prev => [newSup, ...prev]);
      handlePickSupplier(newSup);
      setSupplierModalOpen(false);
      setSupplierDraft({ name: "", phone: "", address: "" });
    } catch { toast.error("فشل إنشاء المورد"); }
  }
```

- [ ] **Step 3: Replace inline supplier modal JSX**

Find the block:

```jsx
      {/* New Supplier Modal */}
      <Modal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="إضافة مورد جديد">
        <div className="space-y-4">
```

…through its closing `</Modal>` and replace with:

```jsx
      <AddSupplierModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onCreated={(supplier) => {
          setSuppliers(prev => [supplier, ...prev]);
          handlePickSupplier(supplier);
        }}
      />
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/purchases/PurchaseFormPage.jsx
git commit -m "refactor: replace inline supplier create modal in PurchaseFormPage with AddSupplierModal"
```

---

## Task 8: Update PurchaseReturnFormPage

**Files:**
- Modify: `client/src/pages/purchases/PurchaseReturnFormPage.jsx`

- [ ] **Step 1: Add import, remove SupplierCreateModal function**

Add import:

```js
import AddSupplierModal from "../../components/modals/AddSupplierModal";
```

Find and delete the entire `SupplierCreateModal` function (lines 35–132, from `function SupplierCreateModal({` to its closing `}`).

- [ ] **Step 2: Replace JSX usage**

Find wherever `<SupplierCreateModal` is rendered and replace with:

```jsx
      <AddSupplierModal
        open={supplierCreateOpen}
        onClose={() => setSupplierCreateOpen(false)}
        onCreated={(s) => {
          setSuppliers(prev => [s, ...prev]);
          setSupplier({ id: s.id, name: s.name });
        }}
      />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/purchases/PurchaseReturnFormPage.jsx
git commit -m "refactor: replace inline SupplierCreateModal with AddSupplierModal in PurchaseReturnFormPage"
```

---

## Task 9: Delete dead files and final commit

**Files:**
- Delete: `client/src/pages/customers/CustomerFormModal.jsx`
- Delete: `client/src/pages/suppliers/SupplierFormModal.jsx`

- [ ] **Step 1: Delete dead files**

```bash
rm client/src/pages/customers/CustomerFormModal.jsx
rm client/src/pages/suppliers/SupplierFormModal.jsx
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "CustomerFormModal\|SupplierFormModal" client/src/
```

Expected output: no matches.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete unused CustomerFormModal and SupplierFormModal"
```

---

## Self-Review

**Spec coverage:**
- ✅ Unified customer modal (AddCustomerModal) — Task 1
- ✅ Unified supplier modal (AddSupplierModal) — Task 2
- ✅ Removed credit_limit, code from customer modals — Tasks 1, 3, 5, 6
- ✅ Removed payment_terms, code from supplier modals — Tasks 2, 4, 7, 8
- ✅ Added notes field to both modals — Tasks 1, 2
- ✅ Notes shown in /accounts/customers detail panel — Task 3 Step 4
- ✅ Notes shown in /accounts/suppliers detail panel — Task 4 Step 4
- ✅ إجمالي الفاتورة + دفع نقداً in CustomerAccountsPage movements — Task 3 Step 5
- ✅ Same in SupplierAccountsPage movements — Task 4 Step 5
- ✅ Dead files deleted — Task 9
- ✅ All 7 inline modals replaced — Tasks 3–8

**No placeholders, no TODOs, no ambiguous steps.**
