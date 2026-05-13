import React, { useState } from "react";
import api from "../../services/api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function SupplierFormModal() {
  const [form, setForm] = useState({ name: "", phone: "", code: "", opening_balance: "", payment_terms: "" });
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      await api.post("/api/suppliers", {
        ...form,
        opening_balance: Number(form.opening_balance || 0),
      });
      setMessage("تم حفظ المورد");
      setForm({ name: "", phone: "", code: "", opening_balance: "", payment_terms: "" });
    } catch (_error) {
      setMessage("فشل حفظ المورد");
    }
  }

  return (
    <form onSubmit={submit} className="page-surface space-y-4">
      <div>
        <h2 className="section-title">إضافة مورد</h2>
        <p className="section-subtitle mt-1">إدارة الموردين وشروط الدفع ضمن نفس لغة الواجهة الجديدة.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="الاسم" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input label="الهاتف" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Input label="الكود" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <Input label="الرصيد الافتتاحي" type="number" value={form.opening_balance} onChange={(event) => setForm({ ...form, opening_balance: event.target.value })} />
        <Input label="شروط الدفع" value={form.payment_terms} onChange={(event) => setForm({ ...form, payment_terms: event.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">حفظ</Button>
        {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
      </div>
    </form>
  );
}
