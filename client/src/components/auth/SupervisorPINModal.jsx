import React, { useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function SupervisorPINModal({ open, action, details, onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/api/auth/supervisor-override", { pin, action, details });
      if (res.data?.success) {
        toast.success("تم تأكيد الصلاحية بنجاح");
        onSuccess(res.data.data.supervisor_id);
        setPin("");
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "رمز الإشراف غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="تأكيد مشرف النظام">
      <form onSubmit={handleSubmit} className="space-y-4 text-center">
        <p className="mb-4 text-sm text-text-secondary">
          الإجراء المطلوب يحتاج إلى صلاحيات إشرافية. الرجاء إدخال رمز الإشراف.
        </p>
        <div className="mb-4 flex justify-center">
          <input
            type="password"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input code w-48 rounded-[20px] p-3 text-center text-3xl tracking-[1em]"
            placeholder="••••"
            dir="ltr"
            required
          />
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={loading || pin.length < 4}>تأكيد</Button>
        </div>
      </form>
    </Modal>
  );
}
