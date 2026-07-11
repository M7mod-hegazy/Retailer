import React from "react";
import { formatNumber } from "../../../utils/currency";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";
import { g } from "./blockUtils";

const fmt = (n) => formatNumber(n);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("ar-EG-u-nu-latn") : "—");

const STATUS_AJAL = {
  active:  { label: "نشط",   color: "#2563eb", bg: "#eff6ff" },
  overdue: { label: "متأخر", color: "#dc2626", bg: "#fee2e2" },
  settled: { label: "مسوَّى", color: "#16a34a", bg: "#dcfce7" },
};

const STATUS_CHEQUE = {
  pending: { label: "معلق", color: "#d97706", bg: "#fffbeb" },
  deposited: { label: "مودع", color: "#2563eb", bg: "#eff6ff" },
  cleared: { label: "محصّل", color: "#16a34a", bg: "#dcfce7" },
  bounced: { label: "مرتجع", color: "#dc2626", bg: "#fee2e2" },
  replaced: { label: "مستبدل", color: "#7c3aed", bg: "#f5f3ff" },
};

const STATUS_INSTALLMENT = {
  paid:    { label: "مدفوع",  color: "#16a34a", bg: "#dcfce7" },
  pending: { label: "معلق",   color: "#d97706", bg: "#fef3c7" },
  overdue: { label: "متأخر",  color: "#dc2626", bg: "#fee2e2" },
};

/* Helper card element for metrics blocks */
function MetricCard({ label, val, color, bg, settings, variant = "standard" }) {
  const accent = g(settings, "accent_color") || "#1e40af";
  const c = color === "accent" ? accent : color;
  const b = bg === "accent" ? `${accent}0d` : bg;

  if (variant === "accent-band") {
    return (
      <div style={{ flex: 1, borderRadius: 6, overflow: "hidden", border: `1px solid ${c}33` }}>
        <div style={{ background: c, color: "#fff", fontSize: "0.75em", fontWeight: 800, padding: "4px 8px", textAlign: "center" }}>{label}</div>
        <div style={{ padding: "8px", textAlign: "center", background: "#fff" }}>
          <div style={{ fontSize: "1.35em", fontWeight: 950, color: c }}>{val}</div>
        </div>
      </div>
    );
  }

  if (variant === "minimal-rule") {
    return (
      <div style={{ flex: 1, textAlign: "center", padding: "4px 6px", borderBottom: `2px solid ${c}` }}>
        <div style={{ fontSize: "1.3em", fontWeight: 950, color: c }}>{val}</div>
        <div style={{ fontSize: "0.8em", color: "#64748b", fontWeight: 700, marginTop: 2 }}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, border: `1.5px solid ${c}22`, borderTop: `4px solid ${c}`, borderRadius: 6, padding: "10px", background: b, textAlign: "center" }}>
      <div style={{ fontSize: "0.85em", color: "#64748b", fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "1.35em", fontWeight: 950, color: c }}>{val}</div>
    </div>
  );
}

/* 1. Bank Statement Metrics Card Block */
export function BankStatementMetricsBlock({ invoice = {}, settings, props = {} }) {
  const transactions = invoice.transactions || [];
  const totalIn  = transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalOut = transactions.filter((t) => t.type === "withdrawal" || t.type === "withdraw").reduce((s, t) => s + Number(t.amount || 0), 0);
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="الرصيد الحالي" val={`${fmt(invoice.bank?.balance)} ج.م`} color="accent" bg="accent" settings={settings} />
      <MetricCard variant={variant} label="إجمالي الإيداعات" val={`${fmt(totalIn)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="إجمالي السحوبات" val={`${fmt(totalOut)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
    </div>
  );
}

/* 2. Ajal Statement Metrics Card Block */
export function AjalStatementMetricsBlock({ invoice = {}, settings, props = {} }) {
  const debt = invoice.debt || {};
  const payments = debt.payments || [];
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = debt.remaining ?? ((debt.original_amount || 0) - paid);
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="إجمالي الدين" val={`${fmt(debt.original_amount)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
      <MetricCard variant={variant} label="إجمالي المدفوع" val={`${fmt(debt.paid_amount ?? paid)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="المتبقي المستحق" val={`${fmt(remaining)} ج.م`} color="accent" bg="accent" settings={settings} />
    </div>
  );
}

/* 3. Ajal Schedule Metrics Card Block */
export function AjalScheduleMetricsBlock({ invoice = {}, settings, props = {} }) {
  const debt = invoice.debt || {};
  const schedule = debt.schedule || [];
  const paidCount    = schedule.filter((r) => r.status === "paid").length;
  const pendingCount = schedule.filter((r) => r.status !== "paid").length;
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="إجمالي الدين" val={`${fmt(debt.original_amount)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
      <MetricCard variant={variant} label="المتبقي المستحق" val={`${fmt(debt.remaining)} ج.م`} color="accent" bg="accent" settings={settings} />
      <MetricCard variant={variant} label="الأقساط المدفوعة" val={`${paidCount} / ${schedule.length}`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="الأقساط المعلقة" val={String(pendingCount)} color="#d97706" bg="#fffbeb" settings={settings} />
    </div>
  );
}

/* 4. Daily Treasury Metrics Card Block */
export function DailyTreasuryMetricsBlock({ invoice = {}, settings, props = {} }) {
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="إجمالي الداخل" val={`${fmt(invoice.grand_in)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="إجمالي المنصرف" val={`${fmt(invoice.grand_out)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
      <MetricCard variant={variant} label="صافي رصيد الصندوق" val={`${fmt(invoice.grand_closing)} ج.م`} color="accent" bg="accent" settings={settings} />
    </div>
  );
}

/* 5. Daily Treasury Accounts Breakdown Block */
export function DailyTreasurySummariesBlock({ invoice = {}, settings, props = {} }) {
  const treasuries = invoice.treasuries || [];
  const accent = g(settings, "accent_color") || "#1e40af";
  if (!treasuries.length) return null;
  const striped = props.variant === "striped-compact";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 900, fontSize: "0.95em", color: accent, borderRight: `3px solid ${accent}`, paddingRight: 8, marginBottom: 8 }}>ملخص أرصدة الخزائن والعهود</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", fontWeight: 700 }}>
        <thead>
          <tr style={{ background: striped ? accent : "#f8fafc", color: striped ? "#fff" : "#0f172a", borderBottom: "2px solid #cbd5e1" }}>
            {["الخزينة / البنك", "الافتتاحي", "الوارد (الداخل)", "المنصرف (الخارج)", "الرصيد الختامي"].map((h) => (
              <th key={h} style={{ padding: striped ? "4px 8px" : "6px 8px", textAlign: "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {treasuries.map((t, i) => (
            <tr key={t.name || i} style={{ borderBottom: "1px solid #e2e8f0", background: striped && i % 2 === 0 ? "#f8fafc" : "transparent" }}>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", fontWeight: 900 }}>{t.name}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", color: "#475569" }}>{fmt(t.opening)}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", color: "#16a34a" }}>{fmt(t.total_in)}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", color: "#dc2626" }}>{fmt(t.total_out)}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", fontWeight: 900, color: accent }}>{fmt(t.closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 6. Ajal Full Statement Metrics Card Block */
export function AjalFullStatementMetricsBlock({ invoice = {}, settings, props = {} }) {
  const debts = invoice.debts || [];
  const original = invoice.total_original || 0;
  const remaining = invoice.total_remaining || 0;
  const paid = original - remaining;
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="إجمالي الديون" val={`${fmt(original)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
      <MetricCard variant={variant} label="إجمالي المقبوضات" val={`${fmt(paid)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="المتبقي للتحصيل" val={`${fmt(remaining)} ج.م`} color="accent" bg="accent" settings={settings} />
      <MetricCard variant={variant} label="عدد الحسابات" val={String(debts.length)} color="#64748b" bg="#f8fafc" settings={settings} />
    </div>
  );
}

/* 7. Cheque Register Metrics Card Block */
export function ChequeRegisterMetricsBlock({ invoice = {}, settings, props = {} }) {
  const rows = invoice.rows || [];
  const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalCleared = rows.filter((r) => r.status === "cleared").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalBounced = rows.filter((r) => r.status === "bounced").reduce((s, r) => s + Number(r.amount || 0), 0);
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="شيكات معلقة" val={`${fmt(totalPending)} ج.م`} color="#d97706" bg="#fffbeb" settings={settings} />
      <MetricCard variant={variant} label="شيكات محصّلة" val={`${fmt(totalCleared)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="شيكات مرتجعة" val={`${fmt(totalBounced)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
    </div>
  );
}

/* 8. Payment Methods Metrics Card Block */
export function PaymentMethodsReportMetricsBlock({ invoice = {}, settings, props = {} }) {
  const totalIn = invoice.totalIn || 0;
  const totalOut = invoice.totalOut || 0;
  const variant = props.variant || "standard";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <MetricCard variant={variant} label="إجمالي الداخل" val={`${fmt(totalIn)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
      <MetricCard variant={variant} label="إجمالي الخارج" val={`${fmt(totalOut)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
      <MetricCard variant={variant} label="الصافي النقدي" val={`${fmt(totalIn - totalOut)} ج.م`} color="accent" bg="accent" settings={settings} />
    </div>
  );
}

/* 9. Payment Methods Breakdown List Block */
export function PaymentMethodsByMethodBlock({ invoice = {}, settings, props = {} }) {
  const byMethod = invoice.byMethod || [];
  const accent = g(settings, "accent_color") || "#1e40af";
  if (!byMethod.length) return null;
  const striped = props.variant === "striped-compact";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 8, color: accent, borderRight: `3px solid ${accent}`, paddingRight: 8 }}>ملخص وسائل الدفع الحالية</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", fontWeight: 700 }}>
        <thead>
          <tr style={{ background: striped ? accent : "#f8fafc", color: striped ? "#fff" : "#0f172a", borderBottom: "2px solid #cbd5e1" }}>
            {["وسيلة الدفع", "الحركات", "داخل", "خارج", "صافي"].map((h) => <th key={h} style={{ padding: striped ? "4px 8px" : "6px 8px", textAlign: "right" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {byMethod.map((m, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: striped && i % 2 === 0 ? "#f8fafc" : "transparent" }}>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", fontWeight: 900 }}>{m.method_name}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px" }}>{m.transaction_count}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", color: "#16a34a" }}>{fmt(m.total_in)}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", color: "#dc2626" }}>{fmt(m.total_out)}</td>
              <td style={{ padding: striped ? "4px 8px" : "6px 8px", fontWeight: 900, color: accent }}>{fmt(m.net_amount)} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 10. Ajal Statement Party Info Block */
export function AjalPartyBlock({ invoice = {}, settings, props = {} }) {
  const debt = invoice.debt || {};
  const accent = g(settings, "accent_color") || "#1e40af";
  const boxedAccent = props.variant === "boxed-accent";
  const items = (
    <>
      <div><span style={{ color: "#64748b" }}>العميل: </span><strong style={{ color: "#0f172a" }}>{invoice.customer_name || debt.customer_name || "—"}</strong></div>
      <div><span style={{ color: "#64748b" }}>الهاتف: </span><strong style={{ color: "#0f172a" }}>{invoice.customer_phone || debt.customer_phone || "—"}</strong></div>
      {debt.invoice_no && (
        <div>
          <span style={{ color: "#64748b" }}>الفاتورة المرتبطة: </span>
          <strong style={{ color: accent }}>{debt.invoice_no}</strong>
        </div>
      )}
      {debt.due_date && (
        <div>
          <span style={{ color: "#64748b" }}>تاريخ الاستحقاق الكلي: </span>
          <strong style={{ color: "#dc2626" }}>{fmtDate(debt.due_date)}</strong>
        </div>
      )}
    </>
  );
  if (boxedAccent) {
    return (
      <div style={{ background: "#fff", borderRight: `4px solid ${accent}`, boxShadow: "inset 0 0 0 1px #e2e8f0", padding: "12px 14px", marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "11px", fontWeight: 700 }}>
        {items}
      </div>
    );
  }
  return (
    <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "11px", fontWeight: 700 }}>
      {items}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   11. UNIVERSAL REPORT TABLE BLOCK
   ────────────────────────────────────────────────────────── */

const BANK_COLS = {
  created_at: { label: "التاريخ", render: (tx) => fmtDate(tx.created_at), align: "right" },
  type: { label: "النوع", render: (tx) => <span style={{ color: tx.type === "deposit" ? "#16a34a" : "#dc2626" }}>{tx.type === "deposit" ? "إيداع" : "سحب"}</span>, align: "center" },
  reference: { label: "المرجع", render: (tx) => tx.reference || "—", align: "center" },
  notes: { label: "ملاحظات", render: (tx) => tx.notes || tx.note || "—", align: "right" },
  amount: { label: "المبلغ", render: (tx) => `${fmt(tx.amount)} ج.م`, align: "left" },
  reconciled: { label: "الحالة", render: (tx) => tx.reconciled ? "✓ مسوّى" : "○", align: "center" },
};

const AJAL_COLS = {
  payment_date: { label: "التاريخ", render: (p) => fmtDate(p.payment_date), align: "right" },
  method_name: { label: "وسيلة الدفع", render: (p) => p.method_name || "—", align: "center" },
  amount: { label: "المبلغ المدفوع", render: (p) => `${fmt(p.amount)} ج.م`, align: "left" },
};

const AJAL_SCHED_COLS = {
  installment_no: { label: "رقم القسط", render: (r) => r.installment_no, align: "center" },
  due_date: { label: "تاريخ الاستحقاق", render: (r) => fmtDate(r.due_date), align: "right" },
  amount: { label: "المبلغ", render: (r) => `${fmt(r.amount)} ج.م`, align: "right" },
  status: {
    label: "الحالة",
    render: (r) => {
      const isOverdue = r.status !== "paid" && new Date(r.due_date) < new Date();
      const st = STATUS_INSTALLMENT[isOverdue ? "overdue" : r.status] || STATUS_INSTALLMENT.pending;
      return <span style={{ background: st.bg, color: st.color, padding: "1px 6px", borderRadius: 8, fontSize: "0.85em", fontWeight: 900 }}>{st.label}</span>;
    },
    align: "center"
  },
  signature: { label: "توقيع الاستلام", render: (r) => <div style={{ borderBottom: r.status !== "paid" ? "1px solid #94a3b8" : "none", height: 14 }} />, align: "center" },
};

const TREASURY_COLS = {
  description: { label: "البيان / الحركة", render: (tx) => tx.description || "—", align: "right" },
  amount: { label: "المبلغ", render: (tx) => `${fmt(tx.amount)} ج.م`, align: "right" },
  type: { label: "النوع", render: (tx) => <span style={{ color: tx.type === "in" ? "#16a34a" : "#dc2626" }}>{tx.type === "in" ? "الوارد" : "المنصرف"}</span>, align: "center" },
  method: { label: "وسيلة الدفع", render: (tx) => tx.method || "—", align: "center" },
};

const AJAL_FULL_COLS = {
  customer_name: { label: "العميل", render: (d) => d.customer_name || "—", align: "right" },
  original_amount: { label: "الدين الإجمالي", render: (d) => `${fmt(d.original_amount)} ج.م`, align: "right" },
  paid: { label: "المدفوع الكلي", render: (d) => `${fmt((d.original_amount || 0) - (d.remaining || 0))} ج.م`, align: "right" },
  remaining: { label: "المتبقي الكلي", render: (d) => `${fmt(d.remaining)} ج.م`, align: "left" },
};

const CHEQUE_COLS = {
  cheque_no: { label: "رقم الشيك", render: (r) => r.cheque_no, align: "right" },
  bank_name: { label: "البنك", render: (r) => r.bank_name, align: "center" },
  drawer_name: { label: "الساحب / العميل", render: (r) => r.drawer_name || "—", align: "right" },
  due_date: { label: "تاريخ الاستحقاق", render: (r) => fmtDate(r.due_date), align: "center" },
  amount: { label: "المبلغ", render: (r) => `${fmt(r.amount)} ج.م`, align: "left" },
  status: {
    label: "الحالة",
    render: (r) => {
      const st = STATUS_CHEQUE[r.status] || STATUS_CHEQUE.pending;
      return <span style={{ background: st.bg, color: st.color, padding: "1px 6px", borderRadius: 8, fontSize: "0.85em", fontWeight: 900 }}>{st.label}</span>;
    },
    align: "center"
  },
};

const PAYMENT_METHOD_COLS = {
  doc_no: { label: "الكود", render: (r) => r.doc_no || `#${r.id}`, align: "center" },
  doc_type_label: { label: "النوع", render: (r) => r.doc_type_label || r.doc_type || "—", align: "center" },
  amount: { label: "المبلغ", render: (r) => `${fmt(r.amount)} ج.م`, align: "right" },
  direction: { label: "الاتجاه", render: (r) => <span style={{ color: r.direction === "out" ? "#dc2626" : "#16a34a" }}>{r.direction === "out" ? "خارج" : "داخل"}</span>, align: "center" },
  party: { label: "الطرف / المستلم", render: (r) => r.party || r.description || "—", align: "right" },
  method_name: { label: "الوسيلة", render: (r) => r.method_name || "—", align: "center" },
  created_at: { label: "التاريخ", render: (r) => r.created_at ? fmtDate(r.created_at) : "—", align: "center" },
};

export function ReportTableBlock({ invoice = {}, settings: s, props = {}, family }) {
  const accent = g(s, "accent_color") || "#1e40af";
  const fontSize = `${g(s, "item_font_size") || 11}px`;
  
  // Detect report type based on what fields are present on the invoice object
  let scope = "reports_generic";
  let rows = invoice.rows || [];
  let colDefs = {};

  if (invoice.transactions && invoice.bank) {
    scope = "bank_statement";
    rows = invoice.transactions;
    colDefs = BANK_COLS;
  } else if (invoice.debt && invoice.debt.payments && !invoice.debt.schedule) {
    scope = "ajal_statement";
    rows = invoice.debt.payments;
    colDefs = AJAL_COLS;
  } else if (invoice.debt && invoice.debt.schedule) {
    scope = "ajal_schedule";
    rows = invoice.debt.schedule;
    colDefs = AJAL_SCHED_COLS;
  } else if (invoice.treasuries && invoice.transactions) {
    scope = "daily_treasury";
    rows = invoice.transactions;
    colDefs = TREASURY_COLS;
  } else if (invoice.debts) {
    scope = "ajal_full_statement";
    rows = invoice.debts;
    colDefs = AJAL_FULL_COLS;
  } else if (invoice.rows && invoice.rows.length && invoice.rows[0].cheque_no) {
    scope = "cheque_register";
    rows = invoice.rows;
    colDefs = CHEQUE_COLS;
  } else if (invoice.rows && invoice.rows.length && invoice.rows[0].direction) {
    scope = "payment_methods_report";
    rows = invoice.rows;
    colDefs = PAYMENT_METHOD_COLS;
  } else {
    // generic report fallback
    rows = invoice.rows || [];
  }

  // Columns driving table headers and cells
  const designerCols = Array.isArray(props.columns) && props.columns.length
    ? props.columns.filter((c) => c.visible !== false)
    : null;

  let cols = [];
  if (designerCols) {
    cols = designerCols;
  } else if (scope === "reports_generic" && invoice.columns) {
    // invoice.columns can be:
    //   - Array of { key, label, type, ... } objects (from SourceWorkspacePage)
    //   - Array of raw strings (legacy)
    cols = invoice.columns.map((c, idx) => {
      if (typeof c === "string") return { key: c, label: c };
      return {
        key: c.key || c.id || String(idx),
        label: c.label || c.header || String(idx),
        type: c.type,
        align: c.align,
      };
    });
  } else {
    cols = Object.keys(colDefs).map((k) => ({ key: k, label: colDefs[k].label }));
  }

  const border = props.tableBorder || "lines";
  const headerVariant = props.headerVariant || "dark";
  const lw = Math.max(1, Math.min(4, Number(props.lineWidth) || 1));
  const lineColor = props.lineColor || "#cbd5e1";
  const cellBorder = border === "grid" ? { border: `${lw}px solid ${lineColor}` } : border === "lines" ? { borderBottom: `${lw}px solid ${lineColor}` } : {};

  const headBg = headerVariant === "dark" ? (props.headerBg || accent) : "transparent";
  const headColor = headerVariant === "dark" ? (props.headerColor || "#fff") : (props.headerColor || accent);
  const headBorder = headerVariant === "light" ? { borderBottom: `2px solid ${accent}` } : {};

  const pagePadY = props.rowPad != null ? Number(props.rowPad) : 6;
  const zebraBg = props.zebraBgColor || "#f8fafc";
  const textColor = props.textColor || "#000";
  const cellValign = props.cellValign || "middle";

  const cellValue = (row, c) => {
    if (scope === "reports_generic") {
      // For generic reports, rows are objects and columns have string keys
      const val = row[c.key];
      if (val == null || val === "") return "—";
      if (c.type === "date" || String(c.key).endsWith("_date")) {
        try { return new Date(val).toLocaleDateString("ar-EG-u-nu-latn"); } catch { return String(val); }
      }
      if (c.type === "money" || c.type === "cur" || c.type === "number" || c.type === "num") {
        const n = Number(val);
        if (!isNaN(n)) return formatNumber(n);
      }
      return String(val);
    }
    const def = colDefs[c.key];
    if (def) return def.render(row);
    return row[c.key] || "—";
  };

  if (props.variant === "cards") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", fontSize }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            border: `1px solid ${lineColor}`,
            borderRadius: "8px",
            padding: "8px 12px",
            background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff",
            color: textColor,
          }}>
            {cols.map((c) => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>{c.label}</span>
                <span style={{ fontWeight: 800 }}>{cellValue(row, c)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (props.variant === "minimalist-list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", fontSize, marginTop: "12px", borderBottom: `1px solid ${lineColor}`, paddingBottom: "6px" }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", padding: "3px 0", borderTop: i > 0 ? `1px dashed ${lineColor}` : "none" }}>
            {cols.map((c) => (
              <span key={c.key} style={{ color: textColor }}>
                <span style={{ color: "#64748b", fontSize: "0.85em" }}>{c.label}: </span>
                <span style={{ fontWeight: 700 }}>{cellValue(row, c)}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── ledger: accounting-style with ruled vertical lines ── */
  if (props.variant === "ledger") {
    return (
      <div style={{ marginTop: 12, fontSize, border: `${lw}px solid ${lineColor}`, borderRadius: 6, overflow: "hidden" }}>
        {headerVariant !== "none" && (
          <div style={{ display: "flex", background: headBg, color: headColor, borderBottom: `2px solid ${lineColor}` }}>
            {cols.map((c, ci) => (
              <div key={c.key} style={{
                flex: 1, padding: "6px 10px", textAlign: c.align || "center", fontWeight: 900,
                borderRight: ci < cols.length - 1 ? `${lw}px solid ${lineColor}` : "none",
              }}>{c.label}</div>
            ))}
          </div>
        )}
        {rows.map((row, i) => (
          <div key={i} style={{
            display: "flex", background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff",
            borderBottom: `${lw}px solid ${lineColor}`,
          }}>
            {cols.map((c, ci) => (
              <div key={c.key} style={{
                flex: 1, padding: `${pagePadY}px 10px`, textAlign: c.align || "center",
                color: textColor, fontWeight: 600,
                borderRight: ci < cols.length - 1 ? `${lw}px solid ${lineColor}` : "none",
              }}>{cellValue(row, c)}</div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── bordered-cards: each row is a card with a colored top accent border ── */
  if (props.variant === "bordered-cards") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px", marginTop: "12px", fontSize }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            border: `1px solid ${lineColor}`,
            borderTop: `3px solid ${accent}`,
            borderRadius: "8px",
            padding: "10px 12px",
            background: "#fff",
            color: textColor,
          }}>
            {cols.map((c) => (
              <div key={c.key} style={{ padding: "3px 0", borderBottom: `1px dashed ${lineColor}` }}>
                <div style={{ fontSize: "0.75em", color: "#64748b", fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontWeight: 800, marginTop: 1 }}>{cellValue(row, c)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── compact-row: ultra-dense rows, tiny padding, for large datasets ── */
  if (props.variant === "compact-row") {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `calc(${fontSize} - 1px)`, marginTop: 12, fontWeight: 500 }}>
        {headerVariant !== "none" && (
          <thead>
            <tr style={{ background: headBg, color: headColor, ...headBorder }}>
              {cols.map((c) => (
                <th key={c.key} style={{ padding: "3px 5px", textAlign: c.align || "center", fontWeight: 800, fontSize: `calc(${fontSize} - 1px)`, ...cellBorder }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff" }}>
              {cols.map((c) => (
                <td key={c.key} style={{
                  padding: "2px 5px", textAlign: c.align || "center",
                  color: textColor, ...cellBorder,
                }}>{cellValue(row, c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* ── highlighted: first numeric column gets a colored highlight background ── */
  if (props.variant === "highlighted") {
    const highlightCol = cols.find((c) => c.type === "money" || c.type === "cur" || c.type === "number" || c.type === "num");
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginTop: 12, fontWeight: 600 }}>
        {headerVariant !== "none" && (
          <thead>
            <tr style={{ background: headBg, color: headColor, ...headBorder }}>
              {cols.map((c) => (
                <th key={c.key} style={{ padding: "8px", textAlign: c.align || "center", ...cellBorder }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff" }}>
              {cols.map((c) => {
                const isHighlight = highlightCol && c.key === highlightCol.key;
                return (
                  <td key={c.key} style={{
                    padding: `${pagePadY}px 8px`, textAlign: c.align || "center",
                    color: isHighlight ? accent : textColor,
                    fontWeight: isHighlight ? 900 : 600,
                    background: isHighlight ? `${accent}08` : undefined,
                    ...cellBorder,
                  }}>{cellValue(row, c)}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* ── split-label: each row is a horizontal key-value pair (label | value) ── */
  if (props.variant === "split-label") {
    return (
      <div style={{ display: "flex", flexDirection: "column", marginTop: "12px", fontSize }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            display: "flex", borderBottom: `${lw}px solid ${lineColor}`,
            background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff",
          }}>
            {cols.map((c, ci) => (
              <div key={c.key} style={{
                flex: 1, padding: `${pagePadY}px 10px`,
                textAlign: ci === 0 ? "right" : "center",
                fontWeight: ci === 0 ? 700 : 600,
                color: ci === 0 ? "#475569" : textColor,
                borderRight: ci < cols.length - 1 ? `${lw}px solid ${lineColor}` : "none",
              }}>{cellValue(row, c)}</div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── numbered: auto-increment row numbers in a narrow first column ── */
  if (props.variant === "numbered") {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginTop: 12, fontWeight: 600 }}>
        {headerVariant !== "none" && (
          <thead>
            <tr style={{ background: headBg, color: headColor, ...headBorder }}>
              <th style={{ padding: "8px", width: "32px", textAlign: "center", ...cellBorder }}>#</th>
              {cols.map((c) => (
                <th key={c.key} style={{ padding: "8px", textAlign: c.align || "center", ...cellBorder }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff" }}>
              <td style={{ padding: `${pagePadY}px 5px`, textAlign: "center", color: "#94a3b8", fontWeight: 700, fontSize: `calc(${fontSize} - 1px)`, ...cellBorder }}>
                {i + 1}
              </td>
              {cols.map((c) => (
                <td key={c.key} style={{
                  padding: `${pagePadY}px 8px`, textAlign: c.align || "center",
                  color: textColor, ...cellBorder,
                }}>{cellValue(row, c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* ── accent-stripe: header with a thick left accent stripe ── */
  if (props.variant === "accent-stripe") {
    return (
      <div style={{ marginTop: 12, fontSize, borderRight: `4px solid ${accent}`, borderRadius: "0 6px 6px 0", overflow: "hidden", border: `1px solid ${lineColor}`, borderRightWidth: 4, borderRightColor: accent }}>
        {headerVariant !== "none" && (
          <div style={{ display: "flex", background: `${accent}10`, borderBottom: `2px solid ${lineColor}` }}>
            {cols.map((c) => (
              <div key={c.key} style={{ flex: 1, padding: "8px 10px", textAlign: c.align || "center", fontWeight: 900, color: accent }}>
                {c.label}
              </div>
            ))}
          </div>
        )}
        {rows.map((row, i) => (
          <div key={i} style={{
            display: "flex", borderBottom: `${lw}px solid ${lineColor}`,
            background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff",
          }}>
            {cols.map((c) => (
              <div key={c.key} style={{ flex: 1, padding: `${pagePadY}px 10px`, textAlign: c.align || "center", color: textColor }}>
                {cellValue(row, c)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginTop: 12, fontWeight: 600 }}>
      {headerVariant !== "none" && (
        <thead>
          <tr style={{ background: headBg, color: headColor, ...headBorder }}>
            {cols.map((c) => (
              <th key={c.key} style={{ padding: "8px", textAlign: c.align || "center", ...cellBorder }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff" }}>
            {cols.map((c) => {
              const val = cellValue(row, c);
              const def = colDefs[c.key];
              return (
                <td key={c.key} style={{
                  padding: `${pagePadY}px 8px`,
                  textAlign: c.align || (def ? def.align : "center"),
                  verticalAlign: cellValign,
                  color: textColor,
                  ...cellBorder,
                }}>
                  {val}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
