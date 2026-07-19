import React, { useState } from "react";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import PermissionGate from "../../../components/ui/PermissionGate";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import Modal from "../../../components/ui/Modal";
import { useDetach } from "../../../hooks/useDetach";
import { formatNumber } from "../../../utils/currency";

function formatMoney(value) {
  return formatNumber(value, { decimals: 3 });
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
}

// Modal listing held (paused) invoices with resume / discard actions.
export default function HeldDropdown({ heldInvoices, onResume, onDiscard, onClose }) {
  const { handleDetach } = useDetach("held-dropdown", {
    onClose, getState: () => ({ heldInvoices }), actions: { resume: (id) => onResume?.(id), discard: (id) => onDiscard?.(id) },
  });
  const [discardTarget, setDiscardTarget] = useState(null);

  if (!heldInvoices.length) return null;
  return (
    <>
      <Modal open={true} title="الفواتير المعلقة" onClose={onClose} onDetach={handleDetach} maxWidth="max-w-lg">
        <div className="max-h-[420px] overflow-y-auto -mx-2 px-2 custom-scrollbar">
          {heldInvoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">لا توجد فواتير معلقة</div>
          ) : (
            <div className="space-y-2">
              {heldInvoices.map((h) => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border-subtle px-4 py-3 hover:bg-amber-50 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <PauseCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-text-primary truncate">{h.customer?.name || "عميل نقدي"}</span>
                      <span className="number-fmt-primary text-sm text-amber-700 shrink-0">{formatMoney(h.heldTotal)} ج.م</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-md bg-bg-overlay px-2 py-0.5 text-[11px] font-black text-text-secondary">{h.linesCount} أصناف</span>
                      <span className="text-[11px] text-text-muted font-mono">{formatArabicDateTime(new Date(h.heldAt))}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <PermissionGate page="pos" action="hold">
                      <button onClick={() => { onResume(h.id); onClose(); }} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all active:scale-[0.98]" title="استئناف">
                        <PlayCircle className="h-5 w-5" />
                      </button>
                    </PermissionGate>
                    <PermissionGate page="pos" action="void">
                      <button onClick={() => setDiscardTarget(h)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-[0.98]" title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!discardTarget}
        title="حذف الفاتورة المعلقة"
        message={discardTarget
          ? `سيتم حذف فاتورة ${discardTarget.customer?.name || "عميل نقدي"} بمبلغ ${formatMoney(discardTarget.heldTotal)} ج.م بشكل نهائي.`
          : ""}
        onConfirm={() => { onDiscard(discardTarget.id); setDiscardTarget(null); }}
        onCancel={() => setDiscardTarget(null)}
      />
    </>
  );
}
