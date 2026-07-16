import React from "react";
import { g } from "./blockUtils";

/**
 * Kitchen ticket blocks — roll (58mm / 80mm) and page.
 * Each block supports 5+ visual variants controlled by props.variant.
 */

/* ── Kitchen Order Header ─────────────────────────────────────────────────── */
function KitchenHeaderVariantStandard({ invoice, settings, accent }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 8, borderBottom: `2px solid ${accent}`, paddingBottom: 6 }}>
      <div style={{ fontSize: "1.3em", fontWeight: 950, color: accent }}>{invoice.company?.name || "المطعم"}</div>
      <div style={{ fontSize: "0.85em", color: "#64748b", marginTop: 2 }}>تيكت المطبخ</div>
    </div>
  );
}

function KitchenHeaderVariantBadge({ invoice, settings, accent }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 8, background: accent, color: "#fff", padding: "6px 0", borderRadius: 4 }}>
      <div style={{ fontSize: "1.2em", fontWeight: 950 }}>{invoice.company?.name || "المطعم"}</div>
      <div style={{ fontSize: "0.75em", opacity: 0.85, marginTop: 1 }}>تيكت المطبخ</div>
    </div>
  );
}

function KitchenHeaderVariantMinimal({ invoice, settings, accent }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 6 }}>
      <div style={{ fontSize: "1.1em", fontWeight: 900, letterSpacing: 1 }}>{invoice.company?.name || "المطعم"}</div>
      <div style={{ width: 40, height: 2, background: accent, margin: "4px auto 0" }} />
    </div>
  );
}

function KitchenHeaderVariantBoxed({ invoice, settings, accent }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 8, border: `2px solid ${accent}`, borderRadius: 6, padding: "6px 0" }}>
      <div style={{ fontSize: "1.2em", fontWeight: 950, color: accent }}>{invoice.company?.name || "المطعم"}</div>
      <div style={{ fontSize: "0.75em", color: "#94a3b8" }}>تيكت المطبخ</div>
    </div>
  );
}

function KitchenHeaderVariantStriped({ invoice, settings, accent }) {
  return (
    <div style={{ marginBottom: 8, overflow: "hidden", borderRadius: 4 }}>
      <div style={{ background: accent, color: "#fff", padding: "5px 0", textAlign: "center" }}>
        <div style={{ fontSize: "1.15em", fontWeight: 950 }}>{invoice.company?.name || "المطعم"}</div>
      </div>
      <div style={{ height: 3, background: `repeating-linear-gradient(90deg, ${accent} 0, ${accent} 6px, transparent 6px, transparent 10px)` }} />
    </div>
  );
}

const KITCHEN_HEADER_VARIANTS = {
  standard: KitchenHeaderVariantStandard,
  badge: KitchenHeaderVariantBadge,
  minimal: KitchenHeaderVariantMinimal,
  boxed: KitchenHeaderVariantBoxed,
  striped: KitchenHeaderVariantStriped,
};

export function KitchenOrderHeaderBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#dc2626";
  const variant = props.variant || "standard";
  const Comp = KITCHEN_HEADER_VARIANTS[variant] || KITCHEN_HEADER_VARIANTS.standard;
  return <Comp invoice={invoice} settings={settings} accent={accent} />;
}

/* ── Kitchen Order Meta (order number, table, type) ───────────────────────── */
function KitchenMetaVariantStandard({ invoice, settings, accent }) {
  const orderNum = invoice.invoice_number || invoice.order_number || "#—";
  const table = invoice.dining_table?.number || invoice.table_number || "";
  const orderType = invoice.order_type === "dine_in" ? "صالة" : invoice.order_type === "takeaway" ? "تيك أواي" : "";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85em", fontWeight: 800, marginBottom: 6, borderBottom: "1px dashed #cbd5e1", paddingBottom: 4 }}>
      <span>#{orderNum}</span>
      {table ? <span>طاولة: {table}</span> : null}
      {orderType ? <span>{orderType}</span> : null}
    </div>
  );
}

function KitchenMetaVariantBadge({ invoice, settings, accent }) {
  const orderNum = invoice.invoice_number || invoice.order_number || "#—";
  const table = invoice.dining_table?.number || invoice.table_number || "";
  const orderType = invoice.order_type === "dine_in" ? "صالة" : invoice.order_type === "takeaway" ? "تيك أواي" : "";
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
      <span style={{ background: accent, color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: "0.8em", fontWeight: 900 }}>#{orderNum}</span>
      {table ? <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 10, fontSize: "0.8em", fontWeight: 800 }}>طاولة {table}</span> : null}
      {orderType ? <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 10, fontSize: "0.8em", fontWeight: 800 }}>{orderType}</span> : null}
    </div>
  );
}

function KitchenMetaVariantInline({ invoice, settings, accent }) {
  const orderNum = invoice.invoice_number || invoice.order_number || "#—";
  const table = invoice.dining_table?.number || invoice.table_number || "";
  const orderType = invoice.order_type === "dine_in" ? "صالة" : invoice.order_type === "takeaway" ? "تيك أواي" : "";
  return (
    <div style={{ fontSize: "0.8em", color: "#64748b", marginBottom: 6 }}>
      طلب {orderNum}{table ? ` — طاولة ${table}` : ""}{orderType ? ` — ${orderType}` : ""}
    </div>
  );
}

function KitchenMetaVariantCompact({ invoice, settings, accent }) {
  const orderNum = invoice.invoice_number || invoice.order_number || "#—";
  const table = invoice.dining_table?.number || invoice.table_number || "";
  return (
    <div style={{ fontSize: "0.85em", fontWeight: 800, marginBottom: 4, textAlign: "center", color: accent }}>
      {orderNum}{table ? ` / ${table}` : ""}
    </div>
  );
}

function KitchenMetaVariantRuled({ invoice, settings, accent }) {
  const orderNum = invoice.invoice_number || invoice.order_number || "#—";
  const table = invoice.dining_table?.number || invoice.table_number || "";
  const orderType = invoice.order_type === "dine_in" ? "صالة" : invoice.order_type === "takeaway" ? "تيك أواي" : "";
  return (
    <div style={{ borderTop: `2px solid ${accent}`, borderBottom: `2px solid ${accent}`, padding: "4px 0", marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: "0.85em", fontWeight: 800 }}>
      <span>{orderNum}</span>
      {table ? <span>طاولة {table}</span> : null}
      {orderType ? <span>{orderType}</span> : null}
    </div>
  );
}

export function KitchenOrderMetaBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#dc2626";
  const variant = props.variant || "standard";
  const variants = { standard: KitchenMetaVariantStandard, badge: KitchenMetaVariantBadge, inline: KitchenMetaVariantInline, compact: KitchenMetaVariantCompact, ruled: KitchenMetaVariantRuled };
  const Comp = variants[variant] || variants.standard;
  return <Comp invoice={invoice} settings={settings} accent={accent} />;
}

/* ── Kitchen Items List ───────────────────────────────────────────────────── */
function KitchenItemsVariantStandard({ invoice, settings, accent }) {
  const items = invoice.items || invoice.lines || [];
  if (!items.length) return <div style={{ fontSize: "0.8em", color: "#94a3b8", fontStyle: "italic", marginBottom: 6 }}>لا توجد أصناف</div>;
  return (
    <div style={{ marginBottom: 6 }}>
      {items.map((item, i) => {
        const modStr = item.modifiers || item.extras;
        const modText = modStr ? (typeof modStr === "string" ? modStr : "+") : null;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dotted #e2e8f0", fontSize: "0.85em" }}>
            <span style={{ fontWeight: 800 }}>{item.quantity || 1}× {item.name || item.product_name || "صنف"}</span>
            {modText ? <span style={{ color: "#94a3b8", fontSize: "0.85em" }}>{modText}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function KitchenItemsVariantCards({ invoice, settings, accent }) {
  const items = invoice.items || invoice.lines || [];
  if (!items.length) return <div style={{ fontSize: "0.8em", color: "#94a3b8", fontStyle: "italic", marginBottom: 6 }}>لا توجد أصناف</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
      {items.map((item, i) => {
        const modStr = item.modifiers || item.extras;
        const modText = modStr ? (typeof modStr === "string" ? modStr : "+") : null;
        return (
          <div key={i} style={{ border: `1px solid ${accent}22`, borderRight: `3px solid ${accent}`, borderRadius: 4, padding: "4px 6px", background: "#fafafa" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 900, fontSize: "0.85em" }}>{item.name || item.product_name || "صنف"}</span>
              <span style={{ fontWeight: 950, color: accent, fontSize: "0.85em" }}>{item.quantity || 1}×</span>
            </div>
            {modText ? <div style={{ fontSize: "0.75em", color: "#94a3b8" }}>{modText}</div> : null}
            {item.notes ? <div style={{ fontSize: "0.75em", color: "#f59e0b", fontStyle: "italic" }}>ملاحظة: {item.notes}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function KitchenItemsVariantMinimal({ invoice, settings, accent }) {
  const items = invoice.items || invoice.lines || [];
  if (!items.length) return <div style={{ fontSize: "0.8em", color: "#94a3b8", fontStyle: "italic", marginBottom: 6 }}>لا توجد أصناف</div>;
  return (
    <div style={{ marginBottom: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "2px 0", fontSize: "0.85em" }}>
          <span style={{ fontWeight: 950, color: accent }}>{item.quantity || 1}×</span> {item.name || item.product_name || "صنف"}
          {item.modifiers ? <span style={{ color: "#94a3b8" }}> +{typeof item.modifiers === "string" ? item.modifiers : "+"}</span> : null}
        </div>
      ))}
    </div>
  );
}

function KitchenItemsVariantTicket({ invoice, settings, accent }) {
  const items = invoice.items || invoice.lines || [];
  if (!items.length) return <div style={{ fontSize: "0.8em", color: "#94a3b8", fontStyle: "italic", marginBottom: 6 }}>لا توجد أصناف</div>;
  return (
    <div style={{ marginBottom: 6, borderTop: "1px dashed #94a3b8", borderBottom: "1px dashed #94a3b8", padding: "4px 0" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.85em" }}>
          <span>{item.quantity || 1}× {item.name || item.product_name || "صنف"}</span>
          {item.notes ? <span style={{ color: "#f59e0b" }}>⚠</span> : null}
        </div>
      ))}
    </div>
  );
}

function KitchenItemsVariantNumbered({ invoice, settings, accent }) {
  const items = invoice.items || invoice.lines || [];
  if (!items.length) return <div style={{ fontSize: "0.8em", color: "#94a3b8", fontStyle: "italic", marginBottom: 6 }}>لا توجد أصناف</div>;
  return (
    <div style={{ marginBottom: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6, padding: "3px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.85em" }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7em", fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ flex: 1, fontWeight: 800 }}>{item.name || item.product_name || "صنف"}</span>
          <span style={{ fontWeight: 950 }}>×{item.quantity || 1}</span>
        </div>
      ))}
    </div>
  );
}

export function KitchenItemsBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#dc2626";
  const variant = props.variant || "standard";
  const variants = { standard: KitchenItemsVariantStandard, cards: KitchenItemsVariantCards, minimal: KitchenItemsVariantMinimal, ticket: KitchenItemsVariantTicket, numbered: KitchenItemsVariantNumbered };
  const Comp = variants[variant] || variants.standard;
  return <Comp invoice={invoice} settings={settings} accent={accent} />;
}

/* ── Kitchen Notes ────────────────────────────────────────────────────────── */
function KitchenNotesVariantStandard({ invoice, settings, accent }) {
  const notes = invoice.notes || invoice.special_instructions || "";
  if (!notes) return null;
  return (
    <div style={{ background: "#fef3c7", border: `1px solid #f59e0b`, borderRadius: 4, padding: "4px 8px", marginBottom: 6, fontSize: "0.8em" }}>
      <span style={{ fontWeight: 900, color: "#92400e" }}>ملاحظات: </span>
      <span style={{ color: "#78350f" }}>{notes}</span>
    </div>
  );
}

function KitchenNotesVariantAlert({ invoice, settings, accent }) {
  const notes = invoice.notes || invoice.special_instructions || "";
  if (!notes) return null;
  return (
    <div style={{ background: "#fee2e2", borderRight: `4px solid #dc2626`, padding: "4px 8px", marginBottom: 6, fontSize: "0.8em", fontWeight: 800, color: "#991b1b" }}>
      ⚠ {notes}
    </div>
  );
}

function KitchenNotesVariantMinimal({ invoice, settings, accent }) {
  const notes = invoice.notes || invoice.special_instructions || "";
  if (!notes) return null;
  return (
    <div style={{ marginBottom: 6, fontSize: "0.75em", color: "#64748b", fontStyle: "italic" }}>
      {notes}
    </div>
  );
}

function KitchenNotesVariantBoxed({ invoice, settings, accent }) {
  const notes = invoice.notes || invoice.special_instructions || "";
  if (!notes) return null;
  return (
    <div style={{ border: `1px dashed ${accent}`, borderRadius: 4, padding: "4px 8px", marginBottom: 6, fontSize: "0.8em" }}>
      {notes}
    </div>
  );
}

function KitchenNotesVariantCentered({ invoice, settings, accent }) {
  const notes = invoice.notes || invoice.special_instructions || "";
  if (!notes) return null;
  return (
    <div style={{ textAlign: "center", marginBottom: 6, fontSize: "0.8em", fontWeight: 800, color: accent }}>
      — {notes} —
    </div>
  );
}

export function KitchenNotesBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#dc2626";
  const variant = props.variant || "standard";
  const variants = { standard: KitchenNotesVariantStandard, alert: KitchenNotesVariantAlert, minimal: KitchenNotesVariantMinimal, boxed: KitchenNotesVariantBoxed, centered: KitchenNotesVariantCentered };
  const Comp = variants[variant] || variants.standard;
  return <Comp invoice={invoice} settings={settings} accent={accent} />;
}

/* ── Kitchen Order Footer ─────────────────────────────────────────────────── */
function KitchenFooterVariantStandard({ invoice, settings, accent }) {
  const time = invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "";
  const cashier = invoice.cashier_name || invoice.user?.name || "";
  return (
    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 4, fontSize: "0.75em", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
      {time ? <span>{time}</span> : null}
      {cashier ? <span>{cashier}</span> : null}
    </div>
  );
}

function KitchenFooterVariantBadge({ invoice, settings, accent }) {
  const time = invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "";
  const cashier = invoice.cashier_name || invoice.user?.name || "";
  return (
    <div style={{ borderTop: `2px solid ${accent}`, paddingTop: 4, fontSize: "0.75em", display: "flex", justifyContent: "space-between" }}>
      {time ? <span style={{ background: accent, color: "#fff", padding: "1px 6px", borderRadius: 8, fontWeight: 800 }}>{time}</span> : null}
      {cashier ? <span style={{ fontWeight: 800, color: "#475569" }}>{cashier}</span> : null}
    </div>
  );
}

function KitchenFooterVariantMinimal({ invoice, settings, accent }) {
  const time = invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div style={{ textAlign: "center", fontSize: "0.7em", color: "#94a3b8", marginTop: 4 }}>
      {time}
    </div>
  );
}

function KitchenFooterVariantCentered({ invoice, settings, accent }) {
  const time = invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "";
  const cashier = invoice.cashier_name || invoice.user?.name || "";
  return (
    <div style={{ textAlign: "center", fontSize: "0.75em", color: "#94a3b8", marginTop: 4, borderTop: "1px dashed #e2e8f0", paddingTop: 4 }}>
      {time}{cashier ? ` — ${cashier}` : ""}
    </div>
  );
}

function KitchenFooterVariantRuled({ invoice, settings, accent }) {
  const time = invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "";
  const cashier = invoice.cashier_name || invoice.user?.name || "";
  return (
    <div style={{ borderTop: `2px solid ${accent}`, borderBottom: `2px solid ${accent}`, padding: "3px 0", marginTop: 4, fontSize: "0.75em", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
      <span>{time}</span>
      <span>{cashier}</span>
    </div>
  );
}

export function KitchenOrderFooterBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#dc2626";
  const variant = props.variant || "standard";
  const variants = { standard: KitchenFooterVariantStandard, badge: KitchenFooterVariantBadge, minimal: KitchenFooterVariantMinimal, centered: KitchenFooterVariantCentered, ruled: KitchenFooterVariantRuled };
  const Comp = variants[variant] || variants.standard;
  return <Comp invoice={invoice} settings={settings} accent={accent} />;
}
