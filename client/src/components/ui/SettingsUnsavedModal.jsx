import { createPortal } from "react-dom";
import { AlertTriangle, Save, XCircle, Loader2 } from "lucide-react";
import TitleBar from "./TitleBar";

export function SettingsUnsavedModal({ open, onSave, onDiscard, onCancel, saving = false, lang = "ar" }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <TitleBar title={lang === "ar" ? "تغييرات غير محفوظة" : "Unsaved Changes"} onClose={onCancel} showDetach={false} />
        <div data-modal-content className="p-6 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-text-secondary mb-6">
            {lang === "ar"
              ? "لديك تغييرات لم يتم حفظها. ماذا تريد أن تفعل؟"
              : "You have unsaved changes. What would you like to do?"}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-xl bg-bg-overlay py-3 text-sm font-bold text-text-primary hover:bg-border-normal transition-all active:scale-95 disabled:opacity-50"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={onDiscard}
              disabled={saving}
              className="flex-1 rounded-xl bg-bg-overlay py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-1.5">
                <XCircle className="h-4 w-4" />
                {lang === "ar" ? "تجاهل" : "Discard"}
              </span>
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 rounded-xl btn-primary py-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving
                  ? (lang === "ar" ? "جاري الحفظ..." : "Saving...")
                  : (lang === "ar" ? "حفظ ومغادرة" : "Save & Leave")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
