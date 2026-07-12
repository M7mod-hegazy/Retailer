import React from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

export default function ReturnsWarningModal({ open, onClose }) {
  return (
    <Modal open={open} title="لا يمكن التعديل" onClose={onClose} maxWidth="max-w-md" showDetach={false}>
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
        </div>
        <p className="text-sm font-bold text-text-secondary leading-relaxed max-w-xs">
          لا يمكن تعديل الفاتورة لوجود مرتجعات مرتبطة بها
        </p>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl bg-bg-overlay py-2.5 text-sm font-black text-text-primary hover:bg-bg-base transition-colors"
        >
          حسناً
        </button>
      </div>
    </Modal>
  );
}
