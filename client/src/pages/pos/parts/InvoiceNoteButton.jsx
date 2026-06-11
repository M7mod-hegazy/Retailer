import React, { useState, useRef, useEffect } from "react";
import { FileText } from "lucide-react";
import { usePosStore } from "../../../stores/posStore";
import { useTranslation } from "react-i18next";

export default function InvoiceNoteButton() {
  const { t } = useTranslation();
  const invoiceNotes = usePosStore((s) => s.invoiceNotes);
  const setInvoiceNotes = usePosStore((s) => s.setInvoiceNotes);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasnotes = invoiceNotes && invoiceNotes.trim().length > 0;

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("invoice_note", "ملاحظة الفاتورة")}
        style={{
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 8,
          border: hasnotes ? "2px solid var(--primary)" : "1px solid var(--border-normal)",
          background: hasnotes ? "var(--primary-light, #e8f4fd)" : "var(--bg-surface)",
          cursor: "pointer", color: hasnotes ? "var(--primary)" : "var(--text-secondary)",
        }}
      >
        <FileText size={16} />
        {hasnotes && (
          <span style={{
            position: "absolute", top: -4, insetInlineEnd: -4,
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--primary)", border: "1.5px solid var(--bg-surface)",
          }} />
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", insetInlineStart: 0, zIndex: 200,
          background: "var(--bg-surface)", border: "1px solid var(--border-normal)",
          borderRadius: 10, padding: 12, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          minWidth: 240,
        }}>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
            {t("invoice_note", "ملاحظة الفاتورة")}
          </p>
          <textarea
            autoFocus
            rows={3}
            value={invoiceNotes}
            onChange={(e) => setInvoiceNotes(e.target.value)}
            placeholder={t("invoice_note_placeholder", "أضف ملاحظة على الفاتورة…")}
            style={{
              width: "100%", resize: "none", borderRadius: 6,
              border: "1px solid var(--border-normal)", padding: "6px 8px",
              fontSize: 13, lineHeight: 1.5, fontFamily: "inherit",
              color: "var(--text-primary)", background: "var(--bg-input, #fff)",
              outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}
