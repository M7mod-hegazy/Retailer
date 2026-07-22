import React, { useMemo } from "react";
import { g } from "./blockUtils";
import { formatNumber } from "../../../utils/currency";

const fmt = (n) => formatNumber(n);

/**
 * Physical Count Report — 4 block types for the Print Studio.
 * Each block accepts `{ invoice, settings, props }` like all other blocks.
 * `invoice` is the physical count session with its lines array.
 */

/* ─── 1. Physical Count Header ────────────────────────────────────── */
export function PhysicalCountHeaderBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#1e40af";
  const variant = props.variant || "standard";
  const s = invoice;
  const scopeLabel = s.type === "complete" ? "جرد شامل — كل المخازن"
    : s.scope === "warehouse" ? (s.warehouse_name || "مستودع")
    : s.scope === "category" ? (s.category_name || "فئة")
    : "أصناف مخصصة";
  const statusLabel = s.status === "completed" ? "مكتمل" : s.status === "cancelled" ? "ملغى" : "جارٍ";
  const statusColor = s.status === "completed" ? "#16a34a" : s.status === "cancelled" ? "#64748b" : accent;

  if (variant === "boxed") {
    return (
      <div style={{ border: `2px solid ${accent}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ background: accent, color: "#fff", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "1.1em", fontWeight: 900 }}>{s.name || `جرد #${s.id}`}</span>
          <span style={{ fontSize: "0.75em", background: statusColor, padding: "2px 8px", borderRadius: 4 }}>{statusLabel}</span>
        </div>
        <div style={{ padding: "8px 12px", fontSize: "0.8em", color: "#475569", display: "flex", gap: 16 }}>
          <span>النطاق: {scopeLabel}</span>
          {s.created_at && <span>التاريخ: {new Date(s.created_at).toLocaleDateString("ar-EG")}</span>}
          {s.completed_at && <span>الإتمام: {new Date(s.completed_at).toLocaleDateString("ar-EG")}</span>}
        </div>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 6, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "1.2em", fontWeight: 900 }}>{s.name || `جرد #${s.id}`}</span>
        <span style={{ fontSize: "0.75em", color: statusColor, fontWeight: 800 }}>{statusLabel} — {scopeLabel}</span>
      </div>
    );
  }

  // standard / classic
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "1.2em", fontWeight: 900, color: accent, marginBottom: 4 }}>{s.name || `جرد #${s.id}`}</div>
      <div style={{ fontSize: "0.8em", color: "#64748b", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span style={{ background: `${statusColor}15`, color: statusColor, padding: "2px 8px", borderRadius: 4, fontWeight: 800 }}>{statusLabel}</span>
        <span>النطاق: {scopeLabel}</span>
        {s.created_at && <span>تاريخ الإنشاء: {new Date(s.created_at).toLocaleDateString("ar-EG")}</span>}
        {s.completed_at && <span>تاريخ الإتمام: {new Date(s.completed_at).toLocaleDateString("ar-EG")}</span>}
      </div>
    </div>
  );
}

/* ─── 2. Physical Count Metrics ────────────────────────────────────── */
export function PhysicalCountMetricsBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#1e40af";
  const variant = props.variant || "standard";
  const lines = invoice.lines || [];
  const total = lines.length;
  const counted = lines.filter((l) => l.touched).length;
  const matched = lines.filter((l) => l.touched && l.variance === 0).length;
  const surplus = lines.filter((l) => l.variance > 0);
  const deficit = lines.filter((l) => l.variance < 0);
  const surplusQty = surplus.reduce((s, l) => s + l.variance, 0);
  const deficitQty = deficit.reduce((s, l) => s + Math.abs(l.variance), 0);
  const completionPct = total > 0 ? Math.round((counted / total) * 100) : 0;

  const metrics = [
    { label: "إجمالي الأصناف", val: total, color: accent },
    { label: "تم العد", val: counted, color: "#2563eb" },
    { label: "مطابق", val: matched, color: "#16a34a" },
    { label: "فائض", val: `${surplus.length} (+${fmt(surplusQty)})`, color: "#d97706" },
    { label: "عجز", val: `${deficit.length} (−${fmt(deficitQty)})`, color: "#dc2626" },
    { label: "نسبة الإتمام", val: `${completionPct}%`, color: accent },
  ];

  if (variant === "compact" || variant === "minimal") {
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {metrics.slice(0, 4).map((m) => (
          <div key={m.label} style={{ flex: "1 1 20%", textAlign: "center", padding: "6px", borderBottom: `2px solid ${m.color}` }}>
            <div style={{ fontSize: "1.2em", fontWeight: 950, color: m.color }}>{m.val}</div>
            <div style={{ fontSize: "0.7em", color: "#64748b", fontWeight: 700 }}>{m.label}</div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ flex: "1 1 14%", border: `2px solid ${m.color}`, borderRadius: 8, padding: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "1.2em", fontWeight: 950, color: m.color }}>{m.val}</div>
            <div style={{ fontSize: "0.7em", color: "#64748b", fontWeight: 700 }}>{m.label}</div>
          </div>
        ))}
      </div>
    );
  }

  // standard
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      {metrics.map((m) => (
        <div key={m.label} style={{ flex: "1 1 14%", border: `1.5px solid ${m.color}22`, borderTop: `4px solid ${m.color}`, borderRadius: 6, padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "0.8em", color: "#64748b", fontWeight: 700, marginBottom: 2 }}>{m.label}</div>
          <div style={{ fontSize: "1.2em", fontWeight: 950, color: m.color }}>{m.val}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── 3. Physical Count Items Table ────────────────────────────────── */

const PC_VALUE = {
  item_name:        (l) => ({ primary: l.item_name, secondary: l.item_code }),
  item_code:        (l) => ({ text: l.item_code }),
  warehouse_name:   (l) => ({ text: l.warehouse_name || "" }),
  category_name:    (l) => ({ text: l.category_name || "" }),
  system_quantity:  (l) => ({ text: fmt(l.system_quantity), mono: true }),
  counted_quantity: (l) => ({ text: l.touched ? fmt(l.counted_quantity) : "", mono: true, faded: !l.touched }),
  variance:         (l) => ({ text: l.touched ? (l.variance > 0 ? `+${fmt(l.variance)}` : fmt(l.variance)) : "", color: l.touched ? varianceColor(l.variance, l.system_quantity) : "#cbd5e1", bold: true }),
  status:           (l) => ({
    text: l.status === "completed" ? "مكتمل" : l.touched ? "مُعدّ" : "لم يُعد",
    bg: l.status === "completed" ? "#dcfce7" : l.touched ? "#eff6ff" : "#f1f5f9",
    color: l.status === "completed" ? "#16a34a" : l.touched ? "#2563eb" : "#94a3b8",
  }),
  notes:            (l) => ({ text: l.notes || "" }),
};

const PC_HEADER = {
  item_name:        "الصنف",
  item_code:        "الكود",
  warehouse_name:   "المخزن",
  category_name:    "الفئة",
  system_quantity:  "النظام",
  counted_quantity: "الفعلي",
  variance:         "الفرق",
  status:           "الحالة",
  notes:            "ملاحظات",
};

const PC_DEFAULT_COLUMNS = [
  { key: "item_name", label: "الصنف", visible: true, align: "right" },
  { key: "system_quantity", label: "النظام", visible: true, align: "center" },
  { key: "counted_quantity", label: "الفعلي", visible: true, align: "center" },
  { key: "variance", label: "الفرق", visible: true, align: "center" },
  { key: "status", label: "الحالة", visible: true, align: "center" },
  { key: "notes", label: "ملاحظات", visible: true, align: "right" },
];

function varianceColor(v, sys) {
  if (v === 0) return "#16a34a";
  const pct = sys > 0 ? (Math.abs(v) / sys) * 100 : 100;
  return pct <= 10 ? "#d97706" : "#dc2626";
}

export function PhysicalCountItemsTableBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#1e40af";
  const variant = props.variant || "standard";
  // On screen, a "جرد شامل" (complete/multi-warehouse) session is always
  // grouped by warehouse — default the print table to match that instead of
  // a flat list, unless the user explicitly picked a different layout in the
  // Print Studio. This is what "print order differs from the real page"
  // was actually about for these sessions.
  const effectiveVariant = variant === "standard" && invoice.type === "complete" ? "grouped-by-warehouse" : variant;
  const lines = invoice.lines || [];

  // Sorting/grouping 1000+ lines is the heaviest part of this block — memoize
  // it so a parent re-render (e.g. print preview zoom/pan) doesn't re-sort
  // the whole session on every frame.
  const { displayLines, groups } = useMemo(() => {
    const sorted = [...lines].sort((a, b) => {
      if (effectiveVariant === "variance-only") return Math.abs(b.variance) - Math.abs(a.variance);
      if (effectiveVariant === "grouped-by-warehouse") return (a.warehouse_name || "").localeCompare(b.warehouse_name || "") || a.item_name?.localeCompare(b.item_name);
      if (effectiveVariant === "grouped-by-category") return (a.category_name || "").localeCompare(b.category_name || "") || a.item_name?.localeCompare(b.item_name);
      if (effectiveVariant === "alpha") return a.item_name?.localeCompare(b.item_name);
      // Default: preserve original order from database
      return 0;
    });

    const displayLines = effectiveVariant === "variance-only" ? sorted.filter((l) => l.variance !== 0) : sorted;

    const isGrouped = effectiveVariant === "grouped-by-warehouse" || effectiveVariant === "grouped-by-category";
    const groupKey = effectiveVariant === "grouped-by-warehouse" ? "warehouse_name" : effectiveVariant === "grouped-by-category" ? "category_name" : null;
    const groups = isGrouped ? Object.entries(displayLines.reduce((acc, l) => { const k = l[groupKey] || "غير محدد"; (acc[k] = acc[k] || []).push(l); return acc; }, {})) : null;

    return { displayLines, groups };
  }, [lines, effectiveVariant]);

  const designerCols = Array.isArray(props.columns) && props.columns.length
    ? props.columns.filter((c) => c.visible !== false && PC_VALUE[c.key])
    : null;
  const cols = designerCols || PC_DEFAULT_COLUMNS;

  const renderTable = (items, title) => (
    <div style={{ marginBottom: 12 }}>
      {title && <div style={{ fontSize: "0.8em", fontWeight: 800, color: accent, marginBottom: 4, padding: "4px 0", borderBottom: `1px solid ${accent}33` }}>{title}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75em" }}>
        <thead>
          <tr style={{ background: `${accent}0d` }}>
            {variant === "color-coded" && <th style={{ width: 4, padding: "6px 4px" }} />}
            {cols.map((c) => (
              <th key={c.key} style={{ padding: "6px 8px", textAlign: c.align || "center", fontWeight: 800, color: "#475569" }}>
                {c.label || PC_HEADER[c.key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((l, i) => (
            <tr key={`${l.item_id}_${l.warehouse_id ?? "null"}_${i}`} style={{ borderTop: "1px solid #e2e8f0", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
              {variant === "color-coded" && (
                <td style={{ width: 4, padding: 0, background: varianceColor(l.variance, l.system_quantity) }} />
              )}
              {cols.map((c) => {
                const cell = PC_VALUE[c.key]?.(l);
                if (!cell) return <td key={c.key} />;
                if (cell.primary) {
                  return (
                    <td key={c.key} style={{ padding: "5px 8px", textAlign: c.align || "right" }}>
                      <div style={{ fontWeight: 700 }}>{cell.primary}</div>
                      {cell.secondary && <div style={{ fontSize: "0.85em", color: "#94a3b8", fontFamily: "monospace" }}>{cell.secondary}</div>}
                    </td>
                  );
                }
                if (cell.bg) {
                  return (
                    <td key={c.key} style={{ padding: "5px 8px", textAlign: c.align || "center" }}>
                      <span style={{ fontSize: "0.85em", padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: cell.bg, color: cell.color }}>{cell.text}</span>
                    </td>
                  );
                }
                return (
                  <td key={c.key} style={{
                    padding: "5px 8px",
                    textAlign: c.align || (["item_name", "item_code", "warehouse_name", "category_name", "notes"].includes(c.key) ? "right" : "center"),
                    fontFamily: cell.mono ? "monospace" : undefined,
                    fontWeight: cell.bold ? 900 : undefined,
                    color: cell.color || (cell.faded ? "#cbd5e1" : "#64748b"),
                    opacity: cell.faded ? 0.35 : 1,
                    maxWidth: c.key === "notes" ? 120 : undefined,
                    overflow: c.key === "notes" ? "hidden" : undefined,
                    textOverflow: c.key === "notes" ? "ellipsis" : undefined,
                    whiteSpace: c.key === "notes" ? "nowrap" : undefined,
                  }}>{cell.text}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (groups) {
    return <div>{groups.map(([name, items]) => renderTable(items, name))}</div>;
  }
  return renderTable(displayLines);
}

/* ─── 4. Physical Count Signatures ────────────────────────────────── */
export function PhysicalCountSignaturesBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#1e40af";
  const variant = props.variant || "two-line";

  const lines = variant === "three-line" ? [
    { label: "عدّاء المخزون" },
    { label: "مدقق الجرد" },
    { label: "مدير المستودع" },
  ] : variant === "with-stamps" ? [
    { label: "عدّاء المخزون", stamp: true },
    { label: "مدقق الجرد", stamp: true },
  ] : [
    { label: "عدّاء المخزون" },
    { label: "مدير المستودع" },
  ];

  if (variant === "minimal") {
    return (
      <div style={{ borderTop: `1px solid #e2e8f0`, paddingTop: 8, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8em", color: "#64748b" }}>
          <span>التوقيع: _____________</span>
          <span>التاريخ: _____________</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: `1px solid #e2e8f0`, paddingTop: 12, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "space-around" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ borderTop: `1.5px solid ${accent}`, margin: "0 16px 4px", paddingTop: 8 }}>
              {l.stamp && (
                <div style={{ width: 50, height: 50, border: `2px dashed ${accent}44`, borderRadius: "50%", margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6em", color: "#94a3b8" }}>
                  ختم
                </div>
              )}
              <div style={{ fontSize: "0.8em", fontWeight: 800, color: accent }}>{l.label}</div>
              <div style={{ fontSize: "0.7em", color: "#94a3b8", marginTop: 4 }}>التوقيع: _____________</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
