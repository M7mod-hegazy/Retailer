import React, { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, ArrowRight } from "lucide-react";
import { formatMoney } from "../../pages/pos/posPageUtils";
import TitleBar from "../ui/TitleBar";
import { useDetach } from "../../hooks/useDetach";

// Fast cash checkout: shows the final total due (already after global discount/increase and
// tax), takes the cash the customer hands over, and shows the change to give back. Confirm
// records the tendered amount and hands control back to the parent (which opens the normal
// print/save-choice preview — it does NOT persist the invoice itself).
//
// Theme-aware: all colours come from the active theme's CSS variables so it looks correct
// on every theme (see constants/colorThemes.js).
//
// Props:
//   open      bool
//   total     number  — totals.total (final amount due)
//   onConfirm (tendered:number) => void
//   onClose   () => void
export default function PosCashCheckoutModal({ open, total = 0, onConfirm, onClose }) {
  const { handleDetach } = useDetach("pos-cash-checkout", {
    onClose, getState: () => ({ total }), actions: { confirm: (data) => onConfirm?.(data) },
  });
  const [tendered, setTendered] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTendered("");
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
    }
  }, [open]);

  const tenderedNum = Number(tendered || 0);
  const change = tenderedNum - total;
  const enough = tenderedNum >= total && tenderedNum > 0;

  const suggestions = useMemo(() => {
    const out = new Set();
    if (total > 0) out.add(Math.ceil(total));
    for (const step of [5, 10, 50, 100, 200, 500]) {
      const up = Math.ceil(total / step) * step;
      if (up >= total) out.add(up);
    }
    return Array.from(out).filter((v) => v > 0).sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  function confirm() {
    if (!enough) return;
    onConfirm?.(tenderedNum);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); confirm(); }
    if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
  }

  if (!open) return null;

  const card = { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-modal)" };
  const subtle = { borderColor: "var(--border-subtle)" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" dir="rtl" onKeyDown={handleKeyDown}>
      <div className="rounded-2xl w-full max-w-[440px] mx-4 flex flex-col border" style={{ ...card, ...subtle }}>
        {/* Header */}
        <TitleBar title="دفع نقدي وحساب الباقي" onClose={onClose} onDetach={handleDetach} />

        {/* Body */}
        <div data-modal-content className="px-5 py-5 space-y-4">
          {/* Total due */}
          <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
            <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>الإجمالي المطلوب</span>
            <span className="text-2xl font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{formatMoney(total)}</span>
          </div>

          {/* Tendered input */}
          <div>
            <label className="block text-xs font-black mb-1.5" style={{ color: "var(--text-secondary)" }}>المبلغ المدفوع نقداً</label>
            <input
              ref={inputRef}
              type="number"
              min="0"
              inputMode="decimal"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border-2 px-4 py-3 text-2xl font-black text-center tabular-nums outline-none transition-colors bg-bg-surface"
              style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
              onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-normal)"; }}
            />
          </div>

          {/* Quick-cash chips */}
          <div className="flex flex-wrap gap-2">
            {suggestions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTendered(String(v))}
                className="rounded-lg border px-3 py-1.5 text-sm font-black tabular-nums transition-colors hover:opacity-80"
                style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}
              >
                {formatMoney(v, 0)}
              </button>
            ))}
          </div>

          {/* Change / shortfall */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3 border"
            style={enough
              ? { backgroundColor: "var(--success-bg)", borderColor: "var(--success-border)" }
              : { backgroundColor: "var(--danger-bg)", borderColor: "var(--danger-border)" }}>
            <span className="text-sm font-black" style={{ color: enough ? "var(--success-text)" : "var(--danger-text)" }}>
              {enough ? "الباقي للعميل" : "المبلغ ناقص"}
            </span>
            <span className="text-2xl font-black tabular-nums" style={{ color: enough ? "var(--success-text)" : "var(--danger-text)" }}>
              {formatMoney(Math.abs(change))}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t" style={subtle}>
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-black hover:opacity-80"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
            إلغاء
          </button>
          <button
            onClick={confirm}
            disabled={!enough}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--primary)" }}
          >
            تأكيد ومتابعة <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
