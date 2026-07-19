import React from "react";
import Modal from "./Modal";
import Button from "./Button";
import { ShieldAlert } from "lucide-react";
import { PAGE_PERMISSIONS, ACTION_LABELS } from "../../constants/pagePermissions";
import { useDetach } from "../../hooks/useDetach";

export default function PermissionDeniedModal({ open, onClose, page, action }) {
  const { handleDetach } = useDetach("permission-denied", {
    onClose, getState: () => ({ page, action }), actions: {},
  });
  const pageMeta = PAGE_PERMISSIONS?.[page];
  const pageLabel = pageMeta?.label || page;
  const actionLabel = ACTION_LABELS?.[action] || action;

  return (
    <Modal open={open} title="غير مصرح" onClose={onClose} onDetach={handleDetach} maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-rose-500" />
        </div>
        <p className="text-sm font-bold text-center text-text-primary leading-relaxed">
          ليس لديك صلاحية <span className="text-rose-600">{actionLabel}</span>{" "}
          في <span className="text-rose-600">{pageLabel}</span>
        </p>
        <p className="text-[11px] font-mono text-text-secondary bg-bg-overlay px-3 py-1.5 rounded-lg border border-border-normal">
          {page}:{action}
        </p>
      </div>
      <div className="flex justify-end">
        <Button variant="danger" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}
