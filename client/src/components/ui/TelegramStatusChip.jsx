/**
 * TelegramStatusChip
 * A non-blocking, auto-dismissing status pill shown after any action
 * that triggers a Telegram notification.
 *
 * Usage:
 *   import { useTelegramStatus } from "@/components/ui/TelegramStatusChip";
 *   const { showTelegramStatus, TelegramStatusChip } = useTelegramStatus();
 *   // After API mutation:
 *   showTelegramStatus(response.data?.telegramStatus);
 *   // Render anywhere in JSX:
 *   <TelegramStatusChip />
 */

import React, { useState, useCallback, useEffect, useRef } from "react";

const CHIP_STATES = {
  sent: {
    icon: "🤖",
    textAr: "تم الإرسال على تيليجرام",
    className: "tg-chip tg-chip--sent",
  },
  queued: {
    icon: "⏳",
    textAr: "الرسالة في قائمة الانتظار",
    className: "tg-chip tg-chip--queued",
  },
  skipped: {
    icon: "🔕",
    textAr: "تيليجرام معطّل",
    className: "tg-chip tg-chip--skipped",
  },
  error: {
    icon: "⚠️",
    textAr: "خطأ في إرسال تيليجرام",
    className: "tg-chip tg-chip--error",
  },
};

/**
 * Derive display state from a telegramStatus object returned by the API.
 * Shape: { sent: number, queued: number, error: string|null, skipped?: boolean }
 */
function resolveState(status) {
  if (!status) return null;
  if (status.skipped) return "skipped";
  if (status.sent > 0) return "queued" === null ? "sent" : "sent";
  if (status.queued > 0) return "queued";
  if (status.error) return "error";
  return "skipped";
}

/**
 * The floating chip rendered at bottom-center of the viewport.
 */
function TelegramChipElement({ state, onDismiss }) {
  const info = CHIP_STATES[state];
  if (!info) return null;
  return (
    <div className={info.className} onClick={onDismiss} role="status" aria-live="polite">
      <span className="tg-chip__icon">{info.icon}</span>
      <span className="tg-chip__text">{info.textAr}</span>
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
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearTimeout(timerRef.current);
  }, []);

  const showTelegramStatus = useCallback(
    (telegramStatus) => {
      const resolved = resolveState(telegramStatus);
      if (!resolved || resolved === "skipped") return; // don't flash for skipped
      clearTimeout(timerRef.current);
      setState(resolved);
      setVisible(true);
      timerRef.current = setTimeout(dismiss, duration);
    },
    [dismiss, duration]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const Chip = useCallback(
    () =>
      visible && state ? (
        <TelegramChipElement state={state} onDismiss={dismiss} />
      ) : null,
    [visible, state, dismiss]
  );

  return { showTelegramStatus, TelegramStatusChip: Chip };
}

export default useTelegramStatus;
