import React from "react";
import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({ open, title = "تأكيد العملية", message, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-text-secondary">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>إلغاء</Button>
        <Button variant="danger" onClick={onConfirm}>تأكيد</Button>
      </div>
    </Modal>
  );
}
