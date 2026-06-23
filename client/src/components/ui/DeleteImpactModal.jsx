/**
 * DeleteImpactModal.jsx — pre-delete warning that shows exactly what the record is linked to.
 *
 * Driven by the server's GET {endpoint}/:id/delete-impact response:
 *   { mode: "archive" | "hard_delete" | "blocked", blockedReason?, related: [{label, count}] }
 *
 * - archive      → record is linked; it will be hidden (archived), not destroyed.
 * - hard_delete  → nothing linked; it will be permanently removed.
 * - blocked      → cannot be deleted at all (e.g. default walk-in customer / category in use).
 * - unknown      → impact endpoint missing/failed; generic warning, still safe to confirm.
 *
 * Colours come from theme CSS vars (no hardcoded palette).
 */
import React from "react";
import TitleBar from "./TitleBar";

export default function DeleteImpactModal({
  open,
  itemName,
  impact,        // { mode, blockedReason, related } | null while loading
  loading = false,
  confirming = false,
  onConfirm,
  onCancel,
  onDetach,
}) {
  if (!open) return null;

  const mode = impact?.mode || "unknown";
  const related = impact?.related || [];
  const isBlocked = mode === "blocked";
  const isArchive = mode === "archive";
  const isHard = mode === "hard_delete";

  const accent = isArchive ? "var(--warning, #d97706)" : "var(--danger)";
  const accentBg = isArchive ? "var(--warning-bg, rgba(217,119,6,0.12))" : "var(--danger-bg)";

  let outcome = "";
  if (isArchive) outcome = "هذا السجل مرتبط بالبيانات التالية، لذلك سيتم أرشفته (إخفاؤه) بدل حذفه نهائياً.";
  else if (isHard) outcome = "لا توجد بيانات مرتبطة بهذا السجل. سيتم حذفه نهائياً ولا يمكن التراجع.";
  else if (isBlocked) outcome = impact?.blockedReason || "لا يمكن حذف هذا السجل.";
  else outcome = "إذا كان هذا السجل مرتبطاً ببيانات أخرى سيتم أرشفته، وإلا سيُحذف نهائياً.";

  const confirmLabel = isArchive ? "تأكيد الأرشفة" : "تأكيد الحذف";

  return (
    <div
      dir="rtl"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: 20,
          padding: 28,
          maxWidth: 420, width: "100%",
          boxShadow: "var(--shadow-modal)",
          animation: "modalEnter 280ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <TitleBar
          title={isArchive ? "تأكيد الأرشفة" : "تأكيد الحذف"}
          onClose={onCancel}
          onDetach={onDetach}
        />

        <div data-modal-content>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, margin: "0 auto 18px", borderRadius: "50%",
          background: accentBg, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30,
        }}>
          {isBlocked ? "🚫" : "⚠️"}
        </div>
        {itemName && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginBottom: 16 }}>
            {isArchive ? "أرشفة: " : "حذف: "}<strong style={{ color: "var(--text-primary)" }}>{itemName}</strong>
          </p>
        )}

        {loading ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
            جارٍ التحقق من البيانات المرتبطة...
          </p>
        ) : (
          <>
            {isArchive && related.length > 0 && (
              <div style={{
                background: "var(--bg-overlay)", border: "1px solid var(--border-subtle)",
                borderRadius: 12, padding: "10px 14px", marginBottom: 16,
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>
                  مرتبط بالبيانات التالية:
                </p>
                {related.map((r, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: 13, padding: "3px 0", color: "var(--text-secondary)",
                  }}>
                    <span>{r.label}</span>
                    <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {r.count === null ? "—" : r.count}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <p style={{
              fontSize: 12.5, lineHeight: 1.7, textAlign: "center", marginBottom: 22,
              color: isHard || isBlocked ? "var(--danger-text)" : "var(--text-secondary)",
            }}>
              {outcome}
            </p>
          </>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            disabled={confirming}
            className="btn-danger"
            style={{
              flex: 1, padding: 12, borderRadius: 10,
              cursor: confirming ? "not-allowed" : "pointer",
            }}
          >
            {isBlocked ? "إغلاق" : "إلغاء"}
          </button>

          {!isBlocked && (
            <button
              onClick={onConfirm}
              disabled={loading || confirming}
              style={{
                flex: 1, padding: 12, borderRadius: 10, border: "none",
                background: accent, color: "#fff", fontSize: 14, fontWeight: 800,
                cursor: loading || confirming ? "not-allowed" : "pointer",
                opacity: loading || confirming ? 0.6 : 1,
              }}
            >
              {confirming ? "جارٍ التنفيذ..." : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
