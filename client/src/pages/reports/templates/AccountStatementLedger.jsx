import React, { useMemo } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) {
  const v = Number(n || 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
}

// Re-nest the server's flattened rows (parent row marked `_has_items`, followed by
// `_is_item` child rows) back into document groups.
export function nestStatementRows(rows) {
  const groups = [];
  let current = null;
  for (const r of rows || []) {
    if (r._is_item) {
      if (current) current.items.push(r);
    } else {
      current = { ...r, items: [] };
      groups.push(current);
    }
  }
  return groups;
}

const TYPE_META = {
  invoice: { label: "فاتورة مبيعات", tone: "doc" },
  purchase: { label: "فاتورة شراء", tone: "doc" },
  payment: { label: "دفعة", tone: "pay" },
  sales_return: { label: "مرتجع مبيعات", tone: "ret" },
  purchase_return: { label: "مرتجع مشتريات", tone: "ret" },
  adjustment: { label: "تسوية", tone: "adj" },
};

const TONE_BADGE = {
  doc: "bg-blue-50 text-blue-700 border-blue-200",
  pay: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ret: "bg-rose-50 text-rose-700 border-rose-200",
  adj: "bg-amber-50 text-amber-700 border-amber-200",
};

// One reconciliation line inside a document's item sub-table footer.
function SummaryLine({ label, value, strong, tone }) {
  const toneText = {
    rose: "text-rose-700",
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    zinc: "text-zinc-600",
    amber: "text-amber-800",
  }[tone] || "text-zinc-700";
  const rowBg = tone === "amber" ? "bg-amber-100/70" : strong ? "bg-zinc-200/60" : "bg-zinc-100/50";
  return (
    <tr className={rowBg}>
      <td className={`px-2 py-1 text-[10px] border border-zinc-200 text-left ${strong ? "font-black text-zinc-700" : "font-bold text-zinc-500"} ${tone === "amber" ? "text-amber-800" : ""}`} colSpan={3}>{label}</td>
      <td className={`px-2 py-1 text-[11px] text-center border border-zinc-200 tabular-nums ${strong ? "font-black" : "font-bold"} ${toneText}`} dir="ltr">{value}</td>
    </tr>
  );
}

function BalanceCell({ value, bold }) {
  const v = Number(value || 0);
  const neg = v < -0.005;
  return (
    <span className={`tabular-nums ${bold ? "font-black" : "font-bold"} ${neg ? "text-rose-600" : "text-zinc-800"}`} dir="ltr">
      {fmtNum(v)}
    </span>
  );
}

/**
 * Dedicated account-statement ledger (كشف حساب) matching the classic Arabic
 * ledger layout: opening-balance row → per-document rows with nested item
 * sub-tables → totals footer. Works for both supplier and customer statements.
 */
export default function AccountStatementLedger({ rows = [], summary = {}, partyType = "supplier", period = {} }) {
  const groups = useMemo(() => nestStatementRows(rows), [rows]);
  const partyLabel = partyType === "customer" ? "العميل" : "المورد";
  const codeLabel = partyType === "customer" ? "كود العميل" : "كود المورد";
  const paymentLabel = partyType === "customer" ? "دفعة محصلة" : "دفعة إلى مورد";

  const opening = Number(summary.opening_balance || 0);
  const closing = Number(summary.closing_balance || 0);
  const totalDebit = Number(summary.total_debit || 0);
  const totalCredit = Number(summary.total_credit || 0);

  const headCell = "px-3 py-2 text-[12px] font-black text-zinc-600 border border-zinc-200 bg-zinc-50";
  const cell = "px-3 py-2 text-[12px] border border-zinc-200 align-middle";

  return (
    <div dir="rtl" className="select-text">
      {/* Identity band */}
      <div className="grid grid-cols-2 gap-px bg-zinc-200 border border-zinc-300 rounded-t-xl overflow-hidden">
        <div className="bg-zinc-800 text-white px-4 py-2.5 flex items-center justify-between">
          <span className="text-[12px] font-bold text-zinc-300">{partyLabel}</span>
          <span className="text-sm font-black">{summary.party_name || summary.supplier_name || summary.customer_name || "—"}</span>
        </div>
        <div className="bg-zinc-100 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[12px] font-bold text-zinc-500">{codeLabel}</span>
          <span className="text-sm font-black text-zinc-800">{summary.party_code || "—"}</span>
        </div>
      </div>

      {/* Period line */}
      {(period.from || period.to) && (
        <div className="bg-emerald-50/60 border-x border-zinc-300 px-4 py-1.5 text-center text-[12px] font-bold text-emerald-800">
          عن الفترة من {period.from || "البداية"} إلى {period.to || "الآن"}
        </div>
      )}

      <table className="w-full border-collapse bg-white" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "44%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={headCell}>م</th>
            <th className={headCell}>التاريخ</th>
            <th className={headCell}>مدين</th>
            <th className={headCell}>دائن</th>
            <th className={headCell}>الرصيد</th>
            <th className={headCell}>الوصف</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening balance row */}
          <tr className="bg-amber-50/50">
            <td className={`${cell} text-center text-zinc-400`}>—</td>
            <td className={`${cell} text-center font-bold text-zinc-500`} colSpan={3}>رصيد أول المدة</td>
            <td className={`${cell} text-center`}><BalanceCell value={opening} bold /></td>
            <td className={`${cell} font-bold text-zinc-600`}>الرصيد المرحّل من الفترات السابقة</td>
          </tr>

          {groups.map((g, idx) => {
            const meta = TYPE_META[g.type] || { label: g.type, tone: "doc" };
            const isPayment = g.type === "payment";
            const isReturn = g.type === "sales_return" || g.type === "purchase_return";
            const desc = g.description || (isPayment ? paymentLabel : meta.label);
            const noImpact = g.affects_balance === false;
            const zebra = noImpact ? "bg-amber-50/30" : idx % 2 === 1 ? "bg-zinc-50/40" : "bg-white";

            const itemsTotal = g.items.reduce((s, it) => s + Number(it.line_total || 0), 0);
            const discount = Number(g.doc_discount || 0);
            const increase = Number(g.doc_increase || 0);
            const docTotal = g.doc_total != null ? Number(g.doc_total) : null;
            const ledgerAmt = g.debit > 0.005 ? Number(g.debit) : Number(g.credit || 0);
            const cashPortion = docTotal != null ? Math.max(0, docTotal - ledgerAmt) : 0;
            const hasFinancials = g.items.length > 0 && (discount > 0.005 || increase > 0.005 || cashPortion > 0.005);
            const onAccountLabel = isReturn ? "دائن على الحساب" : "محمّل على الحساب (آجل)";
            const cashLabel = isReturn ? "مسترد نقداً" : "مسدّد نقداً عند الإنشاء";

            // ── No-impact treatment: the whole interaction (header + items) is
            // visually "ghosted" — amber leading ribbon, desaturated body, and a
            // "بدون تغيير" balance cell — so it's obvious it didn't move the balance.
            const headBg = noImpact ? "bg-amber-50" : `${zebra}`;
            const ribbon = noImpact ? "border-r-[3px] border-r-amber-400" : "";
            const itemHeadCellBg = noImpact ? "bg-amber-100/60" : "bg-zinc-100/50";
            const itemBodyCellBg = noImpact ? "bg-amber-50/40" : "bg-zinc-50/50";

            return (
              <React.Fragment key={`${g.type}-${g.ref_no || idx}-${idx}`}>
                <tr className={`${headBg} ${noImpact ? "" : "hover:bg-emerald-50/30"}`} style={{ breakInside: "avoid" }}>
                  <td className={`${cell} text-center font-bold tabular-nums ${ribbon} ${noImpact ? "text-amber-700/70" : "text-zinc-400"}`}>{(idx + 1).toLocaleString("en-US")}</td>
                  <td className={`${cell} text-center whitespace-nowrap ${noImpact ? "opacity-70" : ""}`}>
                    <div className="font-bold text-zinc-700 tabular-nums leading-tight" dir="ltr">{fmtDate(g.datetime || g.date)}</div>
                    {fmtTime(g.datetime) && <div className="text-[10px] text-zinc-400 tabular-nums leading-tight" dir="ltr">{fmtTime(g.datetime)}</div>}
                  </td>
                  <td className={`${cell} text-center`}>{g.debit > 0.005 ? <span className="tabular-nums font-black text-rose-700" dir="ltr">{fmtNum(g.debit)}</span> : <span className="text-zinc-300">—</span>}</td>
                  <td className={`${cell} text-center`}>{g.credit > 0.005 ? <span className="tabular-nums font-black text-emerald-700" dir="ltr">{fmtNum(g.credit)}</span> : <span className="text-zinc-300">—</span>}</td>
                  <td className={`${cell} text-center ${noImpact ? "bg-amber-100/40" : "bg-zinc-50/60"}`}>
                    {noImpact ? (
                      <div className="flex flex-col items-center leading-tight gap-0.5">
                        <span className="text-[9.5px] font-black text-amber-700 whitespace-nowrap">= بدون تغيير</span>
                        <span className="text-[11px] tabular-nums text-zinc-400" dir="ltr">{fmtNum(g.running_balance)}</span>
                      </div>
                    ) : <BalanceCell value={g.running_balance} />}
                  </td>
                  <td className={cell}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md border ${TONE_BADGE[meta.tone]} ${noImpact ? "opacity-70" : ""}`}>{meta.label}</span>
                      <span className={`font-bold break-words ${noImpact ? "text-zinc-500" : "text-zinc-700"}`}>{desc}</span>
                      {noImpact && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-400 bg-amber-200/70 text-amber-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> لم يؤثر على الرصيد
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {g.items.length > 0 && (
                  <tr style={{ breakInside: "avoid" }}>
                    <td className={`border border-zinc-200 ${itemHeadCellBg} ${ribbon}`} colSpan={2}>
                      <div className={`text-[9px] font-black text-center leading-tight ${noImpact ? "text-amber-600/80" : "text-zinc-400"}`}>تفاصيل<br />الأصناف</div>
                    </td>
                    <td className={`border border-zinc-200 ${itemBodyCellBg} p-1.5`} colSpan={4}>
                      <table className={`w-full border-collapse rounded-lg overflow-hidden ${noImpact ? "opacity-60" : ""}`} style={{ tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "52%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "16%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-[11px] font-black text-zinc-600 border border-zinc-200 bg-zinc-200/60">الصنف</th>
                            <th className="px-2 py-1 text-[11px] font-black text-zinc-600 border border-zinc-200 bg-zinc-200/60">الكمية</th>
                            <th className="px-2 py-1 text-[11px] font-black text-zinc-600 border border-zinc-200 bg-zinc-200/60">السعر</th>
                            <th className="px-2 py-1 text-[11px] font-black text-zinc-600 border border-zinc-200 bg-zinc-200/60">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((it, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-2 py-1 text-[11px] font-semibold text-zinc-700 border border-zinc-200 break-words">{it.item_name || "—"}{it.code ? <span className="text-zinc-400 font-normal"> · {it.code}</span> : null}</td>
                              <td className="px-2 py-1 text-[11px] text-center text-zinc-700 border border-zinc-200 tabular-nums" dir="ltr">{Number(it.quantity || 0).toLocaleString("en-US")}</td>
                              <td className="px-2 py-1 text-[11px] text-center text-zinc-700 border border-zinc-200 tabular-nums" dir="ltr">{fmtNum(it.unit_price)}</td>
                              <td className="px-2 py-1 text-[11px] text-center font-bold text-zinc-800 border border-zinc-200 tabular-nums" dir="ltr">{fmtNum(it.line_total)}</td>
                            </tr>
                          ))}
                          {/* Reconciliation: items → discount/increase → net → cash vs account */}
                          {(g.items.length > 1 || hasFinancials) && (
                            <SummaryLine label="إجمالي الأصناف" value={fmtNum(itemsTotal)} />
                          )}
                          {discount > 0.005 && <SummaryLine label="خصم عام على المستند" value={`(${fmtNum(discount)})`} tone="rose" />}
                          {increase > 0.005 && <SummaryLine label="إضافة / مصاريف على المستند" value={`+${fmtNum(increase)}`} tone="blue" />}
                          {hasFinancials && docTotal != null && (
                            <SummaryLine label="صافي المستند" value={fmtNum(docTotal)} strong />
                          )}
                          {cashPortion > 0.005 && <SummaryLine label={cashLabel} value={fmtNum(cashPortion)} tone="zinc" />}
                          {noImpact ? (
                            <SummaryLine label="الأثر على رصيد الحساب" value="بدون تغيير" strong tone="amber" />
                          ) : hasFinancials ? (
                            <SummaryLine label={onAccountLabel} value={fmtNum(ledgerAmt)} strong tone={isReturn ? "emerald" : "rose"} />
                          ) : null}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {groups.length === 0 && (
            <tr>
              <td className={`${cell} text-center text-zinc-400 py-6`} colSpan={6}>لا توجد حركات خلال هذه الفترة</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-zinc-800 text-white">
            <td className="px-3 py-2.5 text-sm font-black border border-zinc-700 text-center" colSpan={2}>الإجمالي</td>
            <td className="px-3 py-2.5 text-sm font-black border border-zinc-700 text-center tabular-nums" dir="ltr">{fmtNum(totalDebit)}</td>
            <td className="px-3 py-2.5 text-sm font-black border border-zinc-700 text-center tabular-nums text-emerald-300" dir="ltr">{fmtNum(totalCredit)}</td>
            <td className="px-3 py-2.5 text-sm font-black border border-zinc-700 text-center tabular-nums" dir="ltr">{fmtNum(closing)}</td>
            <td className="px-3 py-2.5 text-sm font-black border border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">رصيد الحركة</span>
                <span className={`tabular-nums ${closing < -0.005 ? "text-rose-300" : "text-white"}`} dir="ltr">{fmtNum(closing)} ج.م</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
