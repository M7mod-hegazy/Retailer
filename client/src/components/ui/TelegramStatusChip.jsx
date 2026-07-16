/**
 * TelegramStatusChip
 * A non-blocking, auto-dismissing status pill shown after any action
 * that triggers a Telegram notification.
 *
 * Global usage (preferred): the axios interceptor in services/api.js emits a
 * "telegram:status" window event for ANY API response carrying telegramStatus,
 * and <GlobalTelegramStatusChip /> (mounted once in AppShell) renders it.
 * Individual pages no longer need to wire anything.
 *
 * Legacy/local usage:
 *   const { showTelegramStatus, TelegramStatusChip } = useTelegramStatus();
 *   showTelegramStatus(response.data?.telegramStatus);
 *   <TelegramStatusChip />
 */

import React, { useState, useCallback, useEffect, useRef } from "react";

// Deliberately generic wording — cashiers just see that "a notification" went
// out, without revealing that activity reports reach the owner on Telegram.
// The chip can also be hidden entirely from the Telegram tab (إظهار حالة
// الإرسال toggle → settings.telegram_status_chip_enabled).
const CHIP_STATES = {
  sent: {
    icon: "✓",
    textAr: "تم إرسال الإشعار",
    className: "tg-chip tg-chip--sent",
  },
  queued: {
    icon: "⏳",
    textAr: "سيُرسل الإشعار عند توفر الاتصال",
    className: "tg-chip tg-chip--queued",
  },
  skipped: {
    icon: "🔕",
    textAr: "الإشعارات معطّلة",
    className: "tg-chip tg-chip--skipped",
  },
  error: {
    icon: "⚠️",
    textAr: "تعذّر إرسال الإشعار",
    className: "tg-chip tg-chip--error",
  },
};

/**
 * Derive display state from a telegramStatus object returned by the API.
 * Shape: { sent: number, queued: number, error: string|null, skipped?: boolean, showChip?: boolean }
 */
function resolveState(status) {
  if (!status) return null;
  if (status.showChip === false) return null; // hidden via Telegram-tab toggle
  if (status.skipped) return "skipped";
  if (status.sent > 0) return "sent";
  if (status.queued > 0) return "queued";
  if (status.error) return "error";
  return "skipped";
}

function buildBugReport(status, context) {
  return [
    "== تقرير خطأ إرسال إشعار Telegram ==",
    `الوقت: ${new Date().toISOString()}`,
    context?.url ? `العملية: ${context.method || ""} ${context.url}` : null,
    `sent: ${status?.sent ?? "-"} | queued: ${status?.queued ?? "-"}`,
    `الخطأ: ${status?.error || "غير معروف"}`,
  ].filter(Boolean).join("\n");
}

/**
 * The floating chip rendered at bottom-center of the viewport.
 * The error state carries a copy-details button so a failure can be reported
 * as a bug instead of silently disappearing.
 */
function TelegramChipElement({ state, status, context, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const info = CHIP_STATES[state];
  if (!info) return null;

  const copyReport = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(buildBugReport(status, context));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — nothing sensible to do */
    }
  };

  return (
    <div className={info.className} onClick={onDismiss} role="status" aria-live="polite">
      <span className="tg-chip__icon">{info.icon}</span>
      <span className="tg-chip__text">{info.textAr}</span>
      {state === "error" && (
        <button type="button" className="tg-chip__copy" onClick={copyReport} title="نسخ تفاصيل الخطأ">
          {copied ? "✓ تم النسخ" : "نسخ الخطأ"}
        </button>
      )}
    </div>
  );
}

/**
 * Hook: returns { showTelegramStatus, TelegramStatusChip }
 * @param {number} duration  Auto-dismiss delay in ms (default 4000)
 */
export function useTelegramStatus(duration = 4000) {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState(null);
  const [status, setStatus] = useState(null);
  const [context, setContext] = useState(null);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearTimeout(timerRef.current);
  }, []);

  const showTelegramStatus = useCallback(
    (telegramStatus, ctx = null) => {
      const resolved = resolveState(telegramStatus);
      if (!resolved || resolved === "skipped") return; // don't flash for skipped
      clearTimeout(timerRef.current);
      setState(resolved);
      setStatus(telegramStatus);
      setContext(ctx);
      setVisible(true);
      // Errors stay longer — the user may want to copy the details.
      timerRef.current = setTimeout(dismiss, resolved === "error" ? Math.max(duration, 10000) : duration);
    },
    [dismiss, duration]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const Chip = useCallback(
    () =>
      visible && state ? (
        <TelegramChipElement state={state} status={status} context={context} onDismiss={dismiss} />
      ) : null,
    [visible, state, status, context, dismiss]
  );

  return { showTelegramStatus, TelegramStatusChip: Chip };
}

/**
 * App-wide chip: listens for the "telegram:status" events the axios
 * interceptor dispatches, so every action on every page reports its
 * notification outcome without page-level wiring. Mount once (AppShell).
 */
export function GlobalTelegramStatusChip() {
  const { showTelegramStatus, TelegramStatusChip } = useTelegramStatus();

  useEffect(() => {
    const onStatus = (e) => showTelegramStatus(e.detail?.status, e.detail?.context);
    window.addEventListener("telegram:status", onStatus);
    return () => window.removeEventListener("telegram:status", onStatus);
  }, [showTelegramStatus]);

  return <TelegramStatusChip />;
}

export default useTelegramStatus;
