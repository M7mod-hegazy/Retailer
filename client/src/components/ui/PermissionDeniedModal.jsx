import React from "react";
import Modal from "./Modal";
import Button from "./Button";

export default function PermissionDeniedModal({ open, onClose }) {
  return (
    <Modal open={open} title="غير مصرح" onClose={onClose} maxWidth="max-w-sm">
      <p className="mb-4 text-sm text-text-secondary">
        ليس لديك صلاحية لتنفيذ هذا الإجراء
      </p>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}
