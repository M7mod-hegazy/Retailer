import React, { useState } from "react";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import api from "../../services/api";
import { Clock3, Wallet } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useDetach } from "../../hooks/useDetach";

export default function ShiftOpenModal({ open, onClose, onSuccess, userId: propUserId, openingCash: initialOpeningCash }) {
  const [openingCash, setOpeningCash] = useState(initialOpeningCash ?? "0");
  const user = useAuthStore((state) => state.user);
  const userId = propUserId ?? user?.id;
  const { handleDetach } = useDetach("shift-open", {
    onClose,
    getState: () => ({ openingCash, userId }),
    actions: { success: () => onSuccess?.() },
  });

  async function submit() {
    const response = await api.post("/api/shifts/open", { opening_cash: Number(openingCash), user_id: userId });
    onSuccess?.(response.data.data);
    onClose?.();
  }

  return (
    <Modal open={open} title="فتح وردية" onClose={onClose} onDetach={handleDetach} modalType="shift-open" showDetach={true}>
      <div className="space-y-6">
        <div className="rounded-[20px] border border-primary/20 bg-primary/10 p-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary shadow-glow">
            <Clock3 className="h-7 w-7" />
          </div>
          <div className="text-sm text-text-secondary">الوقت الحالي</div>
          <div className="mt-2 text-2xl font-black text-text-primary">{new Date().toLocaleTimeString("ar-EG-u-nu-latn")}</div>
        </div>
        <div className="rounded-[20px] border border-border-subtle bg-[var(--bg-overlay)] p-5">
          <div className="mb-3 flex items-center gap-2 text-text-primary">
            <Wallet className="h-5 w-5 text-primary-300" />
            <span className="font-bold">رصيد البداية</span>
          </div>
          <Input label="المبلغ الافتتاحي" type="number" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
        </div>
        <Button className="w-full" onClick={submit}>فتح الوردية</Button>
      </div>
    </Modal>
  );
}
