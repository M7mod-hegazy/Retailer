import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Check,
  Clock,
  Loader2,
  StickyNote,
  User,
} from "lucide-react";

function varianceColor(variance, systemQty) {
  if (variance === 0) return { bg: "bg-success-bg", text: "text-success-text", border: "border-success-border", label: "مطابق" };
  const pct = systemQty > 0 ? (Math.abs(variance) / systemQty) * 100 : 100;
  if (pct <= 10) return { bg: "bg-warning-bg", text: "text-warning-text", border: "border-warning-border", label: "فرق طفيف" };
  return { bg: "bg-danger-bg", text: "text-danger-text", border: "border-danger-border", label: "فرق كبير" };
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
    return `${date} ${time}`;
  } catch {
    return "";
  }
}

function PhysicalCountRow({
  line,
  localVal,
  saveStatus,
  readOnly,
  onSave,
  onComplete,
  onNotesChange,
  highlight,
  inputRef,
}) {
  const [notes, setNotes] = useState(line.notes || "");
  const [completing, setCompleting] = useState(false);
  const localInputRef = useRef(null);
  const ref = inputRef || localInputRef;

  // Text is tracked separately from the numeric localVal so the field can
  // sit empty while the user clears it to type a new count — a plain
  // number-typed input snaps back to "0" on every keystroke otherwise.
  const [countText, setCountText] = useState(String(localVal ?? ""));
  useEffect(() => {
    if (Number(countText) !== localVal) setCountText(String(localVal ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localVal]);

  const variance = localVal - line.system_quantity;
  const touched = line.touched || localVal !== line.system_quantity;
  const isCompleted = line.status === "completed";
  const vc = varianceColor(variance, line.system_quantity);

  const handleBlur = () => {
    const v = countText === "" || Number.isNaN(Number(countText)) ? 0 : Number(countText);
    setCountText(String(v));
    if (v !== line.counted_quantity) {
      onSave?.(line.item_id, line.warehouse_id, v);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete?.(line.id, localVal, notes);
    } finally {
      setCompleting(false);
    }
  };

  const handleNotesBlur = () => {
    if (notes !== (line.notes || "")) {
      onNotesChange?.(line.id, notes);
    }
  };

  return (
    <div
      data-line-id={line.id}
      data-item-id={line.item_id}
      className={`group border-b border-border-normal transition-colors duration-200 ${
        highlight ? "bg-primary/5 ring-2 ring-primary/30" : isCompleted ? "bg-success-bg/20 hover:bg-success-bg/30" : "hover:bg-bg-overlay/60"
      }`}
    >
      {/* Main Row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        {/* Status indicator */}
        <div className="w-2 shrink-0">
          {isCompleted ? (
            <div className="w-2 h-2 rounded-full bg-success-text" />
          ) : touched ? (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-border-strong" />
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-mono text-text-muted">{line.item_code || "—"}</p>
            {line.barcode && (
              <span className="text-[10px] font-mono text-text-muted bg-bg-overlay px-2 py-0.5 rounded border border-border-subtle">
                {line.barcode}
              </span>
            )}
          </div>
          <h3 className="text-base font-black text-text-primary truncate tracking-tight mt-0.5">{line.item_name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] font-bold text-text-secondary">{line.category_name || "—"}</p>
            {line.warehouse_name && (
              <>
                <span className="w-1 h-1 rounded-full bg-border-strong" />
                <p className="text-[11px] font-bold text-text-muted">{line.warehouse_name}</p>
              </>
            )}
          </div>
        </div>

        {/* System Qty */}
        <div className="text-center w-20 shrink-0 hidden sm:block">
          <p className="text-lg number-fmt text-text-muted font-black">{line.system_quantity}</p>
        </div>

        <div className="w-px h-10 bg-border-normal shrink-0 hidden sm:block" />

        {/* Count Input */}
        <div className="text-center relative shrink-0 w-24">
          <div className="relative">
            <input
              ref={ref}
              type="number"
              disabled={readOnly || isCompleted}
              className={`w-24 text-center text-xl number-fmt font-black py-2 rounded-xl outline-none border-2 transition-all ${
                isCompleted
                  ? "bg-success-bg text-success-text border-success-border cursor-default"
                  : touched
                    ? "bg-primary/10 text-primary border-primary/30 focus:border-primary"
                    : "bg-bg-surface text-text-primary border-border-normal focus:border-primary focus:bg-primary/5"
              } ${highlight ? "ring-2 ring-primary/50" : ""}`}
              value={countText}
              onChange={(e) => {
                const raw = e.target.value;
                setCountText(raw);
                if (raw === "" || raw === "-") return;
                const v = Number(raw);
                if (!Number.isNaN(v)) onSave?.(line.item_id, line.warehouse_id, v, true);
              }}
              onBlur={handleBlur}
            />
            {saveStatus === "saving" && (
              <Loader2 className="absolute -left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-primary" />
            )}
            {saveStatus === "ok" && (
              <CheckCircle2 className="absolute -left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-success-text" />
            )}
          </div>
        </div>

        <div className="w-px h-10 bg-border-normal shrink-0 hidden sm:block" />

        {/* Variance */}
        <div className="text-center w-20 shrink-0 hidden sm:block">
          {touched ? (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-black number-fmt border ${vc.bg} ${vc.text} ${vc.border}`}>
              {variance > 0 ? "+" : ""}{variance}
            </span>
          ) : (
            <p className="text-lg number-fmt text-text-muted">—</p>
          )}
        </div>

        {/* Status / Actions column — fixed width so it lines up under the header */}
        <div className="w-28 shrink-0 flex items-center justify-center">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-bg text-success-text text-[11px] font-black uppercase tracking-widest border border-success-border">
              <CheckCircle2 className="w-3.5 h-3.5" />
              تم العد
            </span>
          ) : !readOnly ? (
            <button
              onClick={handleComplete}
              disabled={completing || !touched}
              className={`h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                touched
                  ? "bg-success-text text-white hover:opacity-90 shadow-sm"
                  : "bg-bg-overlay text-text-muted border border-border-normal cursor-not-allowed"
              }`}
            >
              {completing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">اعتماد</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Notes — direct inline input */}
      {!readOnly && touched && (
        <div className="px-5 pb-2 flex items-center gap-2">
          <StickyNote className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent text-xs font-bold text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-transparent focus:border-border-normal transition-colors py-1"
            placeholder="ملاحظة..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
          />
        </div>
      )}

      {/* User + Date/Time after count */}
      {line.counted_at && (
        <div className="px-5 pb-2.5 flex items-center gap-3 text-[11px] font-bold text-text-muted">
          {line.counted_by_name && (
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {line.counted_by_name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatDateTime(line.counted_at)}
          </span>
        </div>
      )}

      {/* Mobile-only variance display */}
      {touched && (
        <div className="sm:hidden px-5 pb-3 flex items-center gap-3">
          <span className="text-[11px] font-bold text-text-muted">النظام: {line.system_quantity}</span>
          <span className={`text-[11px] font-black ${vc.text}`}>{vc.label}: {variance > 0 ? "+" : ""}{variance}</span>
        </div>
      )}
    </div>
  );
}

// Rows are memoized so that a keystroke in one row (which re-renders the
// whole PhysicalCountPage via localCounts state) doesn't force every other
// row on the page to re-render too — this matters a lot on complete/large
// sessions with 1000+ lines. Effective only as long as the callback props
// the parent passes stay referentially stable (see useCallback there).
export default React.memo(PhysicalCountRow);
