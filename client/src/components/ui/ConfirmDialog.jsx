import React from "react";
import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({ open, title = "تأكيد العملية", message, onConfirm, onCancel, modalType = "confirm-dialog", ...rest }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} modalType={modalType} modalState={{ title, message }} {...rest}>
      <p className="mb-4 text-sm text-text-secondary">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="danger" onClick={onCancel}>إلغاء</Button>
        <Button variant="danger" onClick={onConfirm}>تأكيد</Button>
      </div>
    </Modal>
  );
}
