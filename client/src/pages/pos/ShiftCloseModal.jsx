import React, { useState } from "react";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import api from "../../services/api";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export default function ShiftCloseModal({ open, shift, onClose, onSuccess }) {
  const [closingCash, setClosingCash] = useState(String(shift?.opening_cash || 0));
  const expected = Number(shift?.current_total || shift?.opening_cash || 0);
  const variance = Number(closingCash || 0) - expected;

  async function submit() {
    const response = await api.post("/api/shifts/close", { id: shift?.id, closing_cash: Number(closingCash) });
    onSuccess?.(response.data.data);
    onClose?.();
  }

  return (
    <Modal open={open} title="إغلاق وردية" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-[20px] border border-border-subtle bg-[var(--bg-overlay)] p-4 text-sm text-text-secondary">
          <div className="flex justify-between py-1">
            <span>المتوقع بالنظام</span>
            <span className="font-semibold text-primary-200"><CurrencyDisplay value={expected} /></span>
          </div>
          <div className="flex justify-between py-1">
            <span>الفرق</span>
            <span className={variance === 0 ? "text-primary-200" : variance > 0 ? "text-warning-DEFAULT" : "text-danger-DEFAULT"}>
              <CurrencyDisplay value={variance} />
            </span>
          </div>
        </div>
        <Input label="النقدية الفعلية" type="number" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} />
        <Button variant="secondary" className="w-full" onClick={submit}>إغلاق الوردية</Button>
      </div>
    </Modal>
  );
}
