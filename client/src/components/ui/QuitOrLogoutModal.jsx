import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Power, ArrowDownToLine } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import TitleBar from "./TitleBar";
import { useAuthStore } from "../../stores/authStore";
import { useQuitOrLogoutStore } from "../../stores/quitOrLogoutStore";
import { notifyServerLogout } from "../../services/api";

export default function QuitOrLogoutModal() {
  const { show, source, hideModal } = useQuitOrLogoutStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!show) return null;

  const isFromWindowClose = source === "window_close";

  const handleLogout = () => {
    notifyServerLogout("تسجيل خروج");
    logout();
    hideModal();
    navigate("/login");
  };

  const handleQuit = () => {
    hideModal();
    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke("app:quit");
    }
  };

  const handleHide = () => {
    hideModal();
    window.electronAPI?.hide?.();
  };

  const handleCancel = () => {
    hideModal();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={handleCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm rounded-xl bg-bg-surface p-6 shadow-2xl ring-1 ring-slate-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <TitleBar title="تأكيد" onClose={handleCancel} showDetach={false} />

            <div data-modal-content>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {isFromWindowClose
                ? "هل تريد إخفاء البرنامج في شريط المهام أو إغلاقه بالكامل أم تسجيل الخروج فقط؟"
                : "هل تريد إغلاق البرنامج بالكامل أم تسجيل الخروج فقط؟"}
            </p>

            <div className="flex flex-col gap-3">
              {isFromWindowClose && (
                <button
                  onClick={handleHide}
                  className="flex items-center justify-center gap-2.5 w-full rounded-lg border border-border-strong bg-bg-surface px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-bg-overlay"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  إخفاء للتطبيق (الدرج)
                </button>
              )}

              <button
                onClick={handleQuit}
                className="flex items-center justify-center gap-2.5 w-full rounded-lg btn-danger px-4 py-3 text-sm font-bold transition-all"
              >
                <Power className="h-4 w-4" />
                إغلاق 100%
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2.5 w-full rounded-lg border border-border-strong bg-bg-surface px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-bg-overlay"
              >
                <LogOut className="h-4 w-4" />
                تسجيل خروج
              </button>
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
