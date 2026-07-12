import React from "react";
import { formatNumber } from "../../../utils/currency";
import { g } from "./blockUtils";

/**
 * Owner statement blocks — page-only (A4 / A5).
 * Dashboard-style blocks for the store owner's financial overview.
 * Each block supports 5+ visual variants controlled by props.variant.
 */

const fmt = (n) => formatNumber(n);

/* ── Helper KPI card ──────────────────────────────────────────────────────── */
function KPICard({ label, value, color, bg, settings, variant = "standard" }) {
  const accent = g(settings, "accent_color") || "#0f172a";
  const c = color === "accent" ? accent : color;
  const b = bg === "accent" ? `${accent}0d` : bg;

  if (variant === "accent-band") {
    return (
      <div style={{ flex: 1, borderRadius: 6, overflow: "hidden", border: `1px solid ${c}33` }}>
        <div style={{ background: c, color: "#fff", fontSize: "0.72em", fontWeight: 800, padding: "4px 8px", textAlign: "center" }}>{label}</div>
        <div style={{ padding: "8px", textAlign: "center", background: "#fff" }}>
          <div style={{ fontSize: "1.3em", fontWeight: 950, color: c }}>{value}</div>
        </div>
      </div>
    );
  }
  if (variant === "minimal-rule") {
    return (
      <div style={{ flex: 1, textAlign: "center", padding: "4px 6px", borderBottom: `2px solid ${c}` }}>
        <div style={{ fontSize: "1.2em", fontWeight: 950, color: c }}>{value}</div>
        <div style={{ fontSize: "0.75em", color: "#64748b", fontWeight: 700, marginTop: 2 }}>{label}</div>
      </div>
    );
  }
  if (variant === "boxed") {
    return (
      <div style={{ flex: 1, border: `2px solid ${c}`, borderRadius: 8, padding: "10px", textAlign: "center", background: b }}>
        <div style={{ fontSize: "0.75em", fontWeight: 800, color: c, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: "1.35em", fontWeight: 950, color: c }}>{value}</div>
      </div>
    );
  }
  if (variant === "stripe") {
    return (
      <div style={{ flex: 1, borderRadius: 6, overflow: "hidden", border: `1px solid ${c}22` }}>
        <div style={{ height: 4, background: c }} />
        <div style={{ padding: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "0.75em", color: "#64748b", fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: "1.3em", fontWeight: 950, color: c }}>{value}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, border: `1.5px solid ${c}22`, borderTop: `4px solid ${c}`, borderRadius: 6, padding: "10px", background: b, textAlign: "center" }}>
      <div style={{ fontSize: "0.8em", color: "#64748b", fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "1.3em", fontWeight: 950, color: c }}>{value}</div>
    </div>
  );
}

/* ── 1. Owner Dashboard Metrics ───────────────────────────────────────────── */
export function OwnerDashboardMetricsBlock({ invoice = {}, settings, props = {} }) {
  const owner = invoice.owner || invoice;
  const variant = props.variant || "standard";

  const hasPurchases = owner.total_purchases > 0;
  const middleLabel = hasPurchases ? "إجمالي المشتريات" : "التكاليف والمصروفات";
  const middleValue = hasPurchases ? owner.total_purchases : (owner.total_expenses || 0);
  const middleColor = hasPurchases ? "#2563eb" : "#dc2626";
  const middleBg = hasPurchases ? "#eff6ff" : "#fef2f2";

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <KPICard variant={variant} label="إجمالي المبيعات" value={`${fmt(owner.total_sales || 0)} ج.م`} color="accent" bg="accent" settings={settings} />
      <KPICard variant={variant} label={middleLabel} value={`${fmt(middleValue)} ج.م`} color={middleColor} bg={middleBg} settings={settings} />
      <KPICard variant={variant} label="صافي الربح" value={`${fmt(owner.net_profit || 0)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
    </div>
  );
}

/* ── 2. Owner Revenue Breakdown ───────────────────────────────────────────── */
function RevenueRow({ label, amount, pct, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.8em" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 900, minWidth: 70, textAlign: "left" }}>{fmt(amount)} ج.م</span>
      {pct != null ? <span style={{ color: "#94a3b8", minWidth: 35, textAlign: "left" }}>{pct}%</span> : null}
    </div>
  );
}

function OwnerRevenueVariantStandard({ data, accent }) {
  return (
    <div>
      {data.map((r, i) => <RevenueRow key={i} {...r} color={accent} />)}
    </div>
  );
}

function OwnerRevenueVariantCards({ data, accent }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {data.map((r, i) => (
        <div key={i} style={{ border: `1px solid ${accent}22`, borderRight: `3px solid ${accent}`, borderRadius: 4, padding: "6px 8px" }}>
          <div style={{ fontSize: "0.75em", color: "#64748b", fontWeight: 700 }}>{r.label}</div>
          <div style={{ fontSize: "1.05em", fontWeight: 950 }}>{fmt(r.amount)} ج.م</div>
          {r.pct != null ? <div style={{ fontSize: "0.7em", color: accent }}>{r.pct}%</div> : null}
        </div>
      ))}
    </div>
  );
}

function OwnerRevenueVariantBar({ data, accent }) {
  const max = Math.max(...data.map((r) => r.amount || 1));
  return (
    <div>
      {data.map((r, i) => (
        <div key={i} style={{ marginBottom: 4, fontSize: "0.8em" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <span style={{ fontWeight: 900 }}>{fmt(r.amount)} ج.م</span>
          </div>
          <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${((r.amount || 0) / max) * 100}%`, height: "100%", background: accent, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerRevenueVariantMinimal({ data, accent }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {data.map((r, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center", borderBottom: `2px solid ${accent}`, paddingBottom: 4 }}>
          <div style={{ fontSize: "1em", fontWeight: 950 }}>{fmt(r.amount)}</div>
          <div style={{ fontSize: "0.7em", color: "#94a3b8" }}>{r.label}</div>
        </div>
      ))}
    </div>
  );
}

function OwnerRevenueVariantCompact({ data, accent }) {
  return (
    <div style={{ fontSize: "0.8em" }}>
      {data.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
          <span style={{ fontWeight: 700 }}>{r.label}</span>
          <span style={{ fontWeight: 900 }}>{fmt(r.amount)} ج.م</span>
        </div>
      ))}
    </div>
  );
}

export function OwnerRevenueBreakdownBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#0f172a";
  const variant = props.variant || "standard";
  const owner = invoice.owner || invoice;
  const raw = owner.revenue_breakdown;
  const data = Array.isArray(raw) ? raw : [
    { label: "مبيعات نقدية", amount: owner.cash_sales || 0, pct: 60 },
    { label: "مبيعات آجلة", amount: owner.credit_sales || 0, pct: 25 },
    { label: "مرتجعات", amount: owner.returns || 0, pct: 15 },
  ];
  const variants = { standard: OwnerRevenueVariantStandard, cards: OwnerRevenueVariantCards, bar: OwnerRevenueVariantBar, minimal: OwnerRevenueVariantMinimal, compact: OwnerRevenueVariantCompact };
  const Comp = variants[variant] || variants.standard;
  return <Comp data={data} accent={accent} />;
}

/* ── 3. Owner Expense Categories ──────────────────────────────────────────── */
function ExpenseRow({ label, amount, color, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.8em" }}>
      <div style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 900, minWidth: 70, textAlign: "left" }}>{fmt(amount)} ج.م</span>
    </div>
  );
}

function OwnerExpenseVariantStandard({ data, accent }) {
  return <div>{data.map((r, i) => <ExpenseRow key={i} {...r} color={accent} />)}</div>;
}

function OwnerExpenseVariantCards({ data, accent }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {data.map((r, i) => (
        <div key={i} style={{ textAlign: "center", border: `1px solid ${r.color}33`, borderRadius: 6, padding: "6px 4px", borderTop: `3px solid ${r.color}` }}>
          <div style={{ fontSize: "1em", fontWeight: 950, color: r.color }}>{fmt(r.amount)}</div>
          <div style={{ fontSize: "0.65em", color: "#64748b", fontWeight: 700, marginTop: 2 }}>{r.label}</div>
        </div>
      ))}
    </div>
  );
}

function OwnerExpenseVariantPie({ data, accent }) {
  const total = data.reduce((s, r) => s + (r.amount || 0), 0) || 1;
  let cum = 0;
  const colors = ["#dc2626", "#2563eb", "#d97706", "#059669", "#7c3aed", "#0f172a"];
  const slices = data.map((r, i) => {
    const pct = ((r.amount || 0) / total) * 100;
    const start = cum;
    cum += pct;
    return { ...r, pct, start, color: r.color || colors[i % colors.length] };
  });
  const stops = slices.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: `conic-gradient(${stops})`, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75em", padding: "1px 0" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 700 }}>{s.label}</span>
            <span style={{ fontWeight: 900 }}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerExpenseVariantMinimal({ data, accent }) {
  const total = data.reduce((s, r) => s + (r.amount || 0), 0) || 1;
  return (
    <div>
      {data.map((r, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8em", marginBottom: 2 }}>
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <span style={{ fontWeight: 900 }}>{fmt(r.amount)} ج.م</span>
          </div>
          <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${((r.amount || 0) / total) * 100}%`, height: "100%", background: accent, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerExpenseVariantBadge({ data, accent }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {data.map((r, i) => (
        <span key={i} style={{ background: `${r.color || accent}15`, color: r.color || accent, padding: "3px 10px", borderRadius: 12, fontSize: "0.75em", fontWeight: 800, border: `1px solid ${r.color || accent}33` }}>
          {r.label}: {fmt(r.amount)}
        </span>
      ))}
    </div>
  );
}

export function OwnerExpenseCategoriesBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#0f172a";
  const variant = props.variant || "standard";
  const owner = invoice.owner || invoice;
  const raw = owner.expense_categories;
  const data = Array.isArray(raw) ? raw : [
    { label: "رواتب", amount: owner.salaries || 12000, color: "#dc2626" },
    { label: "إيجار", amount: owner.rent || 8000, color: "#2563eb" },
    { label: "مصاريف تشغيل", amount: owner.operating || 5000, color: "#d97706" },
    { label: "مشتريات", amount: owner.purchases_expense || 15000, color: "#059669" },
  ];
  const variants = { standard: OwnerExpenseVariantStandard, cards: OwnerExpenseVariantCards, pie: OwnerExpenseVariantPie, minimal: OwnerExpenseVariantMinimal, badge: OwnerExpenseVariantBadge };
  const Comp = variants[variant] || variants.standard;
  return <Comp data={data} accent={accent} />;
}

/* ── 4. Owner Net Profit ──────────────────────────────────────────────────── */
function OwnerProfitVariantStandard({ owner, accent }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <KPICard label="الإيرادات" value={`${fmt(owner.total_revenue || owner.total_sales || 0)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={{ accent_color: accent }} variant="standard" />
      <KPICard label="المصروفات" value={`${fmt(owner.total_expenses || 0)} ج.م`} color="#dc2626" bg="#fef2f2" settings={{ accent_color: accent }} variant="standard" />
      <KPICard label="صافي الربح" value={`${fmt(owner.net_profit || 0)} ج.م`} color="accent" bg="accent" settings={{ accent_color: accent }} variant="standard" />
    </div>
  );
}

function OwnerProfitVariantBand({ owner, accent }) {
  return (
    <div style={{ background: accent, color: "#fff", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-around", marginBottom: 14 }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.75em", opacity: 0.8 }}>الإيرادات</div><div style={{ fontSize: "1.3em", fontWeight: 950 }}>{fmt(owner.total_revenue || owner.total_sales || 0)}</div></div>
      <div style={{ width: 1, background: "rgba(255,255,255,0.3)" }} />
      <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.75em", opacity: 0.8 }}>المصروفات</div><div style={{ fontSize: "1.3em", fontWeight: 950 }}>{fmt(owner.total_expenses || 0)}</div></div>
      <div style={{ width: 1, background: "rgba(255,255,255,0.3)" }} />
      <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.75em", opacity: 0.8 }}>صافي الربح</div><div style={{ fontSize: "1.3em", fontWeight: 950 }}>{fmt(owner.net_profit || 0)}</div></div>
    </div>
  );
}

function OwnerProfitVariantMinimal({ owner, accent }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0", borderBottom: `3px solid ${accent}`, marginBottom: 14 }}>
      <div style={{ fontSize: "2em", fontWeight: 950, color: accent }}>{fmt(owner.net_profit || 0)} ج.م</div>
      <div style={{ fontSize: "0.85em", color: "#64748b", fontWeight: 700 }}>صافي الربح</div>
    </div>
  );
}

function OwnerProfitVariantBoxed({ owner, accent }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <div style={{ flex: 1, border: `2px solid #16a34a`, borderRadius: 8, padding: 8, textAlign: "center" }}>
        <div style={{ fontSize: "0.7em", color: "#16a34a", fontWeight: 800 }}>الإيرادات</div>
        <div style={{ fontSize: "1.2em", fontWeight: 950, color: "#16a34a" }}>{fmt(owner.total_revenue || owner.total_sales || 0)}</div>
      </div>
      <div style={{ flex: 1, border: `2px solid #dc2626`, borderRadius: 8, padding: 8, textAlign: "center" }}>
        <div style={{ fontSize: "0.7em", color: "#dc2626", fontWeight: 800 }}>المصروفات</div>
        <div style={{ fontSize: "1.2em", fontWeight: 950, color: "#dc2626" }}>{fmt(owner.total_expenses || 0)}</div>
      </div>
      <div style={{ flex: 1, border: `2px solid ${accent}`, borderRadius: 8, padding: 8, textAlign: "center", background: `${accent}0d` }}>
        <div style={{ fontSize: "0.7em", color: accent, fontWeight: 800 }}>الربح الصافي</div>
        <div style={{ fontSize: "1.2em", fontWeight: 950, color: accent }}>{fmt(owner.net_profit || 0)}</div>
      </div>
    </div>
  );
}

function OwnerProfitVariantStripe({ owner, accent }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 14, borderRadius: 6, overflow: "hidden" }}>
      <div style={{ flex: 1, background: "#f0fdf4", padding: "8px", textAlign: "center" }}>
        <div style={{ fontSize: "0.7em", color: "#16a34a", fontWeight: 800 }}>الإيرادات</div>
        <div style={{ fontSize: "1.1em", fontWeight: 950, color: "#16a34a" }}>{fmt(owner.total_revenue || owner.total_sales || 0)}</div>
      </div>
      <div style={{ flex: 1, background: "#fef2f2", padding: "8px", textAlign: "center" }}>
        <div style={{ fontSize: "0.7em", color: "#dc2626", fontWeight: 800 }}>المصروفات</div>
        <div style={{ fontSize: "1.1em", fontWeight: 950, color: "#dc2626" }}>{fmt(owner.total_expenses || 0)}</div>
      </div>
      <div style={{ flex: 1, background: `${accent}15`, padding: "8px", textAlign: "center" }}>
        <div style={{ fontSize: "0.7em", color: accent, fontWeight: 800 }}>الربح</div>
        <div style={{ fontSize: "1.1em", fontWeight: 950, color: accent }}>{fmt(owner.net_profit || 0)}</div>
      </div>
    </div>
  );
}

export function OwnerNetProfitBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#0f172a";
  const variant = props.variant || "standard";
  const owner = invoice.owner || invoice;
  const variants = { standard: OwnerProfitVariantStandard, band: OwnerProfitVariantBand, minimal: OwnerProfitVariantMinimal, boxed: OwnerProfitVariantBoxed, stripe: OwnerProfitVariantStripe };
  const Comp = variants[variant] || variants.standard;
  return <Comp owner={owner} accent={accent} />;
}

/* ── 5. Owner Period Comparison ───────────────────────────────────────────── */
function ComparisonRow({ label, current, previous, color }) {
  const diff = previous ? (((current - previous) / previous) * 100).toFixed(1) : "0";
  const isUp = current >= previous;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.8em" }}>
      <span style={{ flex: 1, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 900, minWidth: 65, textAlign: "left" }}>{fmt(current)}</span>
      <span style={{ color: "#94a3b8", minWidth: 65, textAlign: "left" }}>{fmt(previous)}</span>
      <span style={{ color: isUp ? "#16a34a" : "#dc2626", fontWeight: 800, minWidth: 45, textAlign: "left" }}>{isUp ? "▲" : "▼"} {Math.abs(diff)}%</span>
    </div>
  );
}

function OwnerComparisonVariantStandard({ data, accent }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, fontSize: "0.7em", color: "#94a3b8", fontWeight: 800, padding: "0 0 4px", borderBottom: "2px solid #e2e8f0", marginBottom: 2 }}>
        <span style={{ flex: 1 }}></span>
        <span style={{ minWidth: 65, textAlign: "left" }}>الحالي</span>
        <span style={{ minWidth: 65, textAlign: "left" }}>السابق</span>
        <span style={{ minWidth: 45, textAlign: "left" }}>التغيير</span>
      </div>
      {data.map((r, i) => <ComparisonRow key={i} {...r} color={accent} />)}
    </div>
  );
}

function OwnerComparisonVariantCards({ data, accent }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {data.map((r, i) => {
        const diff = r.previous ? (((r.current - r.previous) / r.previous) * 100).toFixed(1) : "0";
        const isUp = r.current >= r.previous;
        return (
          <div key={i} style={{ border: `1px solid #e2e8f0`, borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: "0.7em", color: "#64748b", fontWeight: 700, marginBottom: 4 }}>{r.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "1.1em", fontWeight: 950 }}>{fmt(r.current)}</span>
              <span style={{ fontSize: "0.75em", color: isUp ? "#16a34a" : "#dc2626", fontWeight: 800 }}>{isUp ? "▲" : "▼"}{Math.abs(diff)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnerComparisonVariantBar({ data, accent }) {
  return (
    <div>
      {data.map((r, i) => {
        const max = Math.max(r.current || 0, r.previous || 0) || 1;
        const diff = r.previous ? (((r.current - r.previous) / r.previous) * 100).toFixed(1) : "0";
        const isUp = r.current >= r.previous;
        return (
          <div key={i} style={{ marginBottom: 6, fontSize: "0.8em" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontWeight: 700 }}>{r.label}</span>
              <span style={{ color: isUp ? "#16a34a" : "#dc2626", fontWeight: 800 }}>{isUp ? "▲" : "▼"}{Math.abs(diff)}%</span>
            </div>
            <div style={{ position: "relative", height: 12, background: "#f1f5f9", borderRadius: 3 }}>
              <div style={{ position: "absolute", top: 0, left: 0, height: "50%", width: `${((r.previous || 0) / max) * 100}%`, background: "#cbd5e1", borderRadius: "3px 3px 0 0" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, height: "50%", width: `${((r.current || 0) / max) * 100}%`, background: accent, borderRadius: "0 0 3px 3px" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnerComparisonVariantMinimal({ data, accent }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {data.map((r, i) => {
        const diff = r.previous ? (((r.current - r.previous) / r.previous) * 100).toFixed(1) : "0";
        const isUp = r.current >= r.previous;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "4px", borderRight: i > 0 ? `1px solid #e2e8f0` : "none" }}>
            <div style={{ fontSize: "0.65em", color: "#94a3b8" }}>{r.label}</div>
            <div style={{ fontSize: "1em", fontWeight: 950 }}>{fmt(r.current)}</div>
            <div style={{ fontSize: "0.65em", color: isUp ? "#16a34a" : "#dc2626", fontWeight: 800 }}>{isUp ? "▲" : "▼"}{Math.abs(diff)}%</div>
          </div>
        );
      })}
    </div>
  );
}

function OwnerComparisonVariantCompact({ data, accent }) {
  return (
    <div style={{ fontSize: "0.8em" }}>
      {data.map((r, i) => {
        const diff = r.previous ? (((r.current - r.previous) / r.previous) * 100).toFixed(1) : "0";
        const isUp = r.current >= r.previous;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <span style={{ color: isUp ? "#16a34a" : "#dc2626", fontWeight: 800 }}>{isUp ? "+" : ""}{diff}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function OwnerPeriodComparisonBlock({ invoice = {}, settings, props = {} }) {
  const accent = g(settings, "accent_color") || "#0f172a";
  const variant = props.variant || "standard";
  const owner = invoice.owner || invoice;
  const raw = owner.period_comparison;
  const data = Array.isArray(raw) ? raw : [
    { label: "المبيعات", current: owner.total_sales || 0, previous: owner.prev_sales || 0 },
    { label: "المشتريات", current: owner.total_purchases || 0, previous: owner.prev_purchases || 0 },
    { label: "صافي الربح", current: owner.net_profit || 0, previous: owner.prev_profit || 0 },
  ];
  const variants = { standard: OwnerComparisonVariantStandard, cards: OwnerComparisonVariantCards, bar: OwnerComparisonVariantBar, minimal: OwnerComparisonVariantMinimal, compact: OwnerComparisonVariantCompact };
  const Comp = variants[variant] || variants.standard;
  return <Comp data={data} accent={accent} />;
}

/* ── 6. Owner Assets & Liabilities Block ────────────────────────────────── */
export function OwnerAssetsLiabilitiesBlock({ invoice = {}, settings, props = {} }) {
  const owner = invoice.owner || invoice;
  const variant = props.variant || "standard";
  const accent = g(settings, "accent_color") || "#0f172a";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: "0.85em",
        fontWeight: 900,
        color: accent,
        borderRight: `3px solid ${accent}`,
        paddingRight: 6,
        marginBottom: 8,
        textAlign: "right"
      }}>
        الأصول والالتزامات (الميزانية المبسطة)
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <KPICard variant={variant} label="قيمة المخزون" value={`${fmt(owner.stock || 0)} ج.م`} color="#0284c7" bg="#f0f9ff" settings={settings} />
        <KPICard variant={variant} label="رصيد الخزائن والبنك" value={`${fmt(owner.cash || 0)} ج.م`} color="#0f172a" bg="#f8fafc" settings={settings} />
        <KPICard variant={variant} label="ذمم العملاء (لنا)" value={`${fmt(owner.ar || 0)} ج.م`} color="#16a34a" bg="#f0fdf4" settings={settings} />
        <KPICard variant={variant} label="ذمم الموردين (علينا)" value={`${fmt(owner.ap || 0)} ج.م`} color="#dc2626" bg="#fef2f2" settings={settings} />
      </div>
    </div>
  );
}

/* ── 7. Owner Payment Flow Block ────────────────────────────────────────── */
export function OwnerPaymentFlowBlock({ invoice = {}, settings: s, props = {} }) {
  const owner = invoice.owner || invoice;
  const paymentFlow = owner.payment_flow || [];
  const accent = g(s, "accent_color") || "#0f172a";
  const fontSize = `${g(s, "item_font_size") || 11}px`;

  if (!paymentFlow.length) return null;

  const variant = props.variant || "standard";

  if (variant === "cards") {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: "0.85em",
          fontWeight: 900,
          color: accent,
          borderRight: `3px solid ${accent}`,
          paddingRight: 6,
          marginBottom: 8,
          textAlign: "right"
        }}>
          تدفقات وسائل الدفع
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
          {paymentFlow.map((row, i) => (
            <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", background: "#fff", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                <span style={{ fontSize: "0.85em", fontWeight: 900, color: accent }}>{row.method_name}</span>
                <span style={{ fontSize: "0.75em", background: "#f1f5f9", color: "#64748b", borderRadius: 10, padding: "1px 6px", fontWeight: 800 }}>{row.transaction_count} حركة</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em", color: "#16a34a", fontWeight: 700 }}>
                <span>داخل:</span>
                <span>{fmt(row.total_in)} ج.م</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em", color: "#dc2626", fontWeight: 700 }}>
                <span>خارج:</span>
                <span>{fmt(row.total_out)}- ج.م</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80em", fontWeight: 900, borderTop: "1px dashed #e2e8f0", paddingTop: 4 }}>
                <span>الصافي:</span>
                <span style={{ color: row.net_amount < 0 ? "#dc2626" : "#0f172a" }}>{fmt(row.net_amount)} ج.م</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const striped = props.zebra !== false;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: "0.85em",
        fontWeight: 900,
        color: accent,
        borderRight: `3px solid ${accent}`,
        paddingRight: 6,
        marginBottom: 8,
        textAlign: "right"
      }}>
        تدفقات وسائل الدفع بالتفصيل
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize, fontWeight: 700 }}>
        <thead>
          <tr style={{ background: accent, color: "#fff", borderBottom: "2px solid #cbd5e1" }}>
            {["وسيلة الدفع", "الحركات", "داخل (الوارد)", "خارج (المنصرف)", "صافي التدفق"].map((h) => (
              <th key={h} style={{ padding: "5px 8px", textAlign: "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paymentFlow.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: striped && i % 2 === 0 ? "#f8fafc" : "transparent" }}>
              <td style={{ padding: "5px 8px", fontWeight: 900, color: "#0f172a" }}>{row.method_name}</td>
              <td style={{ padding: "5px 8px", color: "#64748b" }}>{row.transaction_count}</td>
              <td style={{ padding: "5px 8px", color: "#16a34a" }}>{fmt(row.total_in)} ج.م</td>
              <td style={{ padding: "5px 8px", color: "#dc2626" }}>{fmt(row.total_out)} ج.م</td>
              <td style={{ padding: "5px 8px", fontWeight: 900, color: Number(row.net_amount) < 0 ? "#dc2626" : accent }}>{fmt(row.net_amount)} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
