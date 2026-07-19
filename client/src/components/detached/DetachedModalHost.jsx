import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { getModalRegistration } from "./modalRegistry";
import DetachedProviders from "./DetachedProviders";

function parseDetachedState() {
  try {
    const raw = new URLSearchParams(window.location.search).get("detachedState");
    if (!raw) { console.log('[DetachedModalHost] no detachedState in URL'); return null; }
    const parsed = JSON.parse(decodeURIComponent(raw));
    console.log('[DetachedModalHost] parsed state from URL', parsed);
    return parsed;
  } catch (e) { console.warn('[DetachedModalHost] failed to parse detachedState', e); return null; }
}

function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50" dir="rtl">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      <p className="text-sm font-bold text-slate-500">جاري تحميل النافذة...</p>
    </div>
  );
}

export default function DetachedModalHost() {
  const [resolved, setResolved] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const urlData = parseDetachedState();
    if (urlData?.state?.token) {
      useAuthStore.setState({ token: urlData.state.token });
    }

    async function resolve() {
      if (urlData && !urlData.stateViaIPC) {
        if (!cancelled) {
          setResolved(urlData);
          setLoading(false);
        }
        return;
      }

      try {
        const result = await window.electronAPI?.getModalInitialState();
        if (cancelled) return;
        if (result?.success) {
          if (result.state?.token) {
            useAuthStore.setState({ token: result.state.token });
          }
          setResolved({ modalType: result.modalType, state: result.state });
        } else {
          console.warn('[DetachedModalHost] IPC returned no state', result);
          setResolved(null);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[DetachedModalHost] IPC error', e);
          setResolved(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, []);

  const handleChildAction = useCallback((action, data) => {
    window.electronAPI?.sendModalAction?.({ action, data });
    // In a detached window, "close"/"cancel" mean dismiss — the only thing that
    // actually closes a child window is closeModalWindow(). Many registrations'
    // deserialized onClose only sendAction("close") (which just notifies the
    // parent), so close them centrally here. Registrations that already call
    // closeModalWindow() too are unaffected (the IPC handler guards isDestroyed).
    if (action === "close" || action === "cancel") {
      window.electronAPI?.closeModalWindow?.();
    }
  }, []);

  if (loading) return <LoadingSpinner />;

  const { modalType, state } = resolved || {};

  if (!modalType) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50" dir="rtl">
        <p className="text-sm text-slate-400">لا توجد بيانات</p>
      </div>
    );
  }

  const reg = getModalRegistration(modalType);
  if (!reg) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 p-8" dir="rtl">
        <p className="text-sm font-medium text-slate-500">
          نوع النافذة غير معروف: {modalType}
        </p>
        <p className="text-xs text-slate-400">
          هذه النافذة المنبثقة غير مسجلة في سجل النوافذ المنفصلة
        </p>
      </div>
    );
  }

  const Component = reg.component;
  const props = reg.deserialize
    ? reg.deserialize(state, handleChildAction)
    : state;

  return (
    <DetachedProviders>
      <div className="h-dvh w-dvw overflow-auto bg-slate-50" dir="rtl">
        {/* Registered components are React.lazy — loaded on first render. */}
        <Suspense fallback={<LoadingSpinner />}>
          <Component {...props} />
        </Suspense>
      </div>
    </DetachedProviders>
  );
}
