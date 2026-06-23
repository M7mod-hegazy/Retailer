import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import TitleBar from "./TitleBar";

export function UnsavedChangesModal({ open, onStay, onLeave }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onStay}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <TitleBar title="مغادرة الصفحة؟" onClose={onStay} showDetach={false} />
        <div data-modal-content className="p-6 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-6">
            لديك تغييرات لم يتم حفظها. إذا غادرت الآن ستُفقد هذه التغييرات.
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onStay}
              className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-all active:scale-95"
            >
              ابقَ في الصفحة
            </button>
            <button
              onClick={onLeave}
              className="flex-1 rounded-xl btn-danger py-3 text-sm font-bold transition-all active:scale-95"
            >
              اغادر بدون حفظ
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
