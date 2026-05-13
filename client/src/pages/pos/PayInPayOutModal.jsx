import React, { useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function PayInPayOutModal({ open, type, onClose }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const title = type === "in" ? "إضافة نقدية درج (Pay-In)" : "سحب نقدية من الدرج (Pay-Out)";
  const btnLabel = type === "in" ? "إضافة (+)" : "سحب (-)";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = type === "in" ? "/api/shifts/pay-in" : "/api/shifts/pay-out";
      await api.post(endpoint, { amount: Number(amount), reason });
      toast.success(type === "in" ? "تمت إضافة النقدية بنجاح" : "تم سحب النقدية بنجاح");
      setAmount("");
      setReason("");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[20px] border border-border-subtle bg-[var(--bg-overlay)] p-4 text-sm text-text-secondary">
          سجل حركة الخزنة مع سبب واضح حتى تظهر في سجل المناوبة والتقارير المالية لاحقاً.
        </div>
        <Input
          label="المبلغ"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="السبب / التفاصيل"
          type="text"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={loading}>{btnLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
