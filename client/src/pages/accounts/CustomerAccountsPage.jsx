import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users, Search, Plus, X, Phone, AlertTriangle, SlidersHorizontal,
  MessageSquare, Eye, ExternalLink, RefreshCw, FileText,
  ShoppingBag, CreditCard, RotateCcw, Scale, ChevronDown, ChevronUp, Calendar,
  Copy, Check, TrendingUp, TrendingDown, Info, AlertCircle
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import PermissionGate from "../../components/ui/PermissionGate";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import CustomerInfoModal from "../../components/modals/CustomerInfoModal";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

const PAYMENT_METHOD_AR = {
  cash: "نقداً", card: "بطاقة", bank: "بنك", bank_transfer: "تحويل بنكي",
  credit: "آجل", installments: "تقسيط", wallet: "محفظة", multi: "متعدد",
};
const arMethod = (key) => PAYMENT_METHOD_AR[key] || key;

// Per-method color tokens
const METHOD_STYLE = {
  cash: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/60", dot: "bg-emerald-500" },
  card: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/60", dot: "bg-blue-500" },
  bank: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200/60", dot: "bg-sky-500" },
  bank_transfer: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200/60", dot: "bg-sky-500" },
  credit: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60", dot: "bg-amber-500" },
  installments: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200/60", dot: "bg-violet-500" },
  wallet: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200/60", dot: "bg-purple-500" },
  default: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200/60", dot: "bg-slate-400" },
};
const ms = (method) => METHOD_STYLE[method] || METHOD_STYLE.default;

// Left-border accent per event type
const TYPE_ACCENT = {
  invoice: "border-r-blue-500",
  payment: "border-r-emerald-500",
  return: "border-r-rose-500",
  adjustment: "border-r-amber-500",
};

const PTYPE_COLOR = {
  cash: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
  credit: "text-amber-700 bg-amber-50 border-amber-200/60",
  installments: "text-violet-700 bg-violet-50 border-violet-200/60",
  multi: "text-blue-700 bg-blue-50 border-blue-200/60",
  bank_transfer: "text-sky-700 bg-sky-50 border-sky-200/60",
};

function Modal({ onClose, children, width = "480px" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300" onClick={onClose}>
      <div style={{ width }} className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-h-[90vh] overflow-y-auto border border-slate-200/60" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Event type config ─────────────────────────────────────
const EVENT_TYPES = {
  invoice: { icon: ShoppingBag, label: "فاتورة", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  payment: { icon: CreditCard, label: "تحصيل دفعة", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  return: { icon: RotateCcw, label: "مرتجع", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
  adjustment: { icon: Scale, label: "تسوية يدوية", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
};

// Parse payment splits string — excludes credit (used for non-multi display)
function parsePaymentSplits(splits) {
  if (!splits) return [];
  return splits.split("|||").map(s => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const method = s.slice(0, idx).trim();
    const amount = Number(s.slice(idx + 1));
    return { method, amount };
  }).filter(Boolean).filter(s => s.method !== "credit" && s.amount > 0.005);
}

// Parse ALL splits including credit — used for متعدد invoice display
function parseAllPaymentSplits(splits) {
  if (!splits) return [];
  return splits.split("|||").map(s => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const method = s.slice(0, idx).trim();
    const amount = Number(s.slice(idx + 1));
    return { method, amount };
  }).filter(Boolean).filter(s => s.amount > 0.005);
}

// ── Installments expandable within invoice row ────────────
function InstallmentsBadge({ debtId }) {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (schedules !== null) { setOpen(o => !o); return; }
    try {
      const r = await api.get(`/api/ajal-debts/${debtId}`);
      setSchedules(r.data.data?.schedule || []);
      setOpen(true);
    } catch { setSchedules([]); setOpen(true); }
  }, [debtId, schedules]);

  const pending = schedules ? schedules.filter(s => s.status !== "paid").length : null;

  return (
    <div className="mt-2">
      <button onClick={load}
        className="flex items-center gap-1.5 text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200/80 rounded-xl px-3 py-1 hover:bg-violet-100 transition-colors">
        <Calendar className="h-3 w-3" />
        {pending !== null ? `${pending} قسط متبقي` : "متابعة الأقساط"}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && schedules?.length > 0 && (
        <div className="mt-2 space-y-1.5 pr-2.5 border-r-2 border-violet-200">
          {schedules.map(s => {
            const isOverdue = s.status !== "paid" && s.due_date < today;
            const isPaid = s.status === "paid";
            return (
              <div key={s.id} className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-[10px] font-bold border transition-colors ${isPaid
                  ? "bg-emerald-50/50 border-emerald-100 text-emerald-700"
                  : isOverdue
                    ? "bg-rose-50/50 border-rose-100 text-rose-700"
                    : "bg-slate-50/50 border-slate-150 text-slate-600"
                }`}>
                <span className="font-semibold">القسط {s.installment_no} — {fmtDate(s.due_date)}</span>
                <span className="font-black font-mono">{fmt(s.amount)}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${isPaid
                    ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                    : isOverdue
                      ? "bg-rose-100 border-rose-200 text-rose-800"
                      : "bg-slate-100 border-slate-200 text-slate-700"
                  }`}>
                  {isPaid ? "مسدد" : isOverdue ? "متأخر" : "معلق"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {open && schedules?.length === 0 && (
        <div className="mt-1 text-[10px] text-slate-400 font-bold pr-2.5 flex items-center gap-1">
          <Info className="h-3.5 w-3.5 text-slate-300" />
          <span>لا توجد أقساط مجدولة</span>
        </div>
      )}
    </div>
  );
}

// ── الحركات Tab ───────────────────────────────────────────
function MovementsTab({ party, partyType, onOpenInvoice, onOpenReturn }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const idParam = partyType === "customer" ? `customer_id=${party.id}` : `supplier_id=${party.id}`;
      const docEndpoint = partyType === "customer" ? `/api/invoices?${idParam}&limit=200` : `/api/purchases?${idParam}&limit=200`;
      const payEndpoint = `/api/payments?party_type=${partyType}&party_id=${party.id}&limit=200`;
      const retEndpoint = partyType === "customer"
        ? `/api/invoices/returns?customer_id=${party.id}&limit=200`
        : `/api/purchases/returns?supplier_id=${party.id}&limit=200`;
      const adjEndpoint = partyType === "customer"
        ? `/api/customers/${party.id}/notes?type=adjustment`
        : `/api/suppliers/${party.id}/notes?type=adjustment`;

      const [docsR, paysR, retsR, adjR] = await Promise.allSettled([
        api.get(docEndpoint),
        api.get(payEndpoint),
        api.get(retEndpoint),
        api.get(adjEndpoint),
      ]);

      const items = [];

      (docsR.value?.data?.data || []).forEach(d => {
        const total = Number(d.total || 0);
        const received = Number(d.amount_received || 0);
        const ajalAmount = Math.max(0, total - received);
        let chips = parsePaymentSplits(d.payment_splits);
        // For single-method paid invoices, synthesise a chip from payment_type + received
        if (chips.length === 0 && d.payment_type !== "credit" && received > 0) {
          chips = [{ method: d.payment_type, amount: received }];
        }
        // For متعدد: parse ALL splits (incl. credit) so آجل is never lost
        const allChips = d.payment_type === "multi"
          ? parseAllPaymentSplits(d.payment_splits)
          : chips;
        // Original آجل amount from splits (permanent, even if debt later paid off)
        const ajalChipAmount = d.payment_type === "multi"
          ? (allChips.find(c => c.method === "credit")?.amount || 0)
          : 0;
        items.push({
          id: `inv-${d.id}`,
          type: "invoice",
          date: new Date(d.created_at),
          ref: d.invoice_no || d.doc_no || `#${d.id}`,
          chips,
          allChips,
          // Full invoice amount shown on card; balance impact only for أجل portion
          invoiceTotal: total,
          ajalAmount,
          ajalChipAmount,
          impactAmount: ajalAmount,
          impactDir: ajalAmount > 0.005 ? "add" : null,
          raw: d,
        });
      });

      // Only standalone payments (not created at invoice creation)
      (paysR.value?.data?.data || []).filter(p => !p.invoice_id).forEach(p => {
        items.push({
          id: `pay-${p.id}`,
          type: "payment",
          date: new Date(p.created_at),
          ref: p.doc_no || `PAY-${p.id}`,
          methodLabel: arMethod(p.method || ""),
          description: p.notes || null,
          impactAmount: Number(p.amount || 0),
          impactDir: "subtract",
          raw: p,
        });
      });

      (retsR.value?.data?.data || []).forEach(r => {
        items.push({
          id: `ret-${r.id}`,
          type: "return",
          date: new Date(r.created_at),
          ref: r.doc_no || `RET-${r.id}`,
          description: r.original_invoice_no ? `مرتجع فاتورة ${r.original_invoice_no}` : "مرتجع",
          impactAmount: Number(r.total || 0),
          impactDir: "subtract",
          raw: r,
        });
      });

      (adjR.value?.data?.data || []).forEach(n => {
        const amount = Number(n.amount || 0);
        items.push({
          id: `adj-${n.id}`,
          type: "adjustment",
          date: new Date(n.created_at),
          ref: `ADJ-${n.id}`,
          description: n.note || "تسوية يدوية",
          impactAmount: Math.abs(amount),
          impactDir: amount > 0 ? "add" : "subtract",
          raw: n,
        });
      });

      items.sort((a, b) => b.date - a.date);

      // Compute رصيد افتتاحي by unwinding all impacts from current balance
      const currentBal = Number(party.opening_balance || 0);
      let running = currentBal;
      for (const item of items) {
        if (item.impactDir === "add") running -= (item.impactAmount || 0);
        else if (item.impactDir === "subtract") running += (item.impactAmount || 0);
      }
      if (Math.abs(running) > 0.005) {
        items.push({
          id: "opening",
          type: "opening",
          date: null,
          impactAmount: Math.abs(running),
          impactDir: running > 0 ? "add" : "subtract",
        });
      }

      setEvents(items);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [party, partyType]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex h-32 items-center justify-center text-[12px] font-black text-slate-400 animate-pulse">جاري التحميل...</div>;
  if (events.length === 0) return (
    <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
      <FileText className="h-8 w-8 opacity-40" />
      <span className="font-black text-[13px]">لا توجد حركات مسجلة</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {events.map(ev => {
        // ── Opening balance row ─────────────────────────────────────────────
        if (ev.type === "opening") {
          return (
            <div key="opening" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-3.5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-[11px] font-black text-slate-700">رصيد افتتاحي سابق للعميل</div>
                  <div className="text-[9px] text-slate-400 font-bold">قبل الحركات المعروضة أدناه</div>
                </div>
              </div>
              <div className="text-end">
                <div className={`text-[15px] font-black font-mono tracking-tight ${ev.impactDir === "add" ? "text-rose-600" : "text-emerald-600"}`}>
                  {ev.impactDir === "add" ? "+" : "−"}{fmt(ev.impactAmount)}
                </div>
                <div className="text-[9px] font-bold text-slate-400">ج.م</div>
              </div>
            </div>
          );
        }

        const cfg = EVENT_TYPES[ev.type];
        const Icon = cfg.icon;
        const ptype = ev.raw?.payment_type;
        const isMulti = ptype === "multi";
        const isCredit = ptype === "credit";
        const isInstallments = ptype === "installments";
        const isDocRow = ev.type === "invoice";

        // For متعدد: use ajalChipAmount (from payment_splits, permanent)
        // so the strip shows even after the debt is paid off
        const multiAjalAmount = isMulti ? (ev.ajalChipAmount || 0) : 0;
        const hasImpact = isMulti
          ? multiAjalAmount > 0.005
          : (ev.impactDir && ev.impactAmount > 0.005);
        const displayImpactAmount = isMulti ? multiAjalAmount : ev.impactAmount;

        // Build payment method rows for multi-payment invoices
        // For متعدد: use allChips which includes credit parsed directly from payment_splits
        // (ajalAmount can be 0 if the debt was later paid, but credit is still in payment_splits)
        const multiChips = isMulti ? (ev.allChips || []) : [];
        // For credit: show full amount as آجل
        const creditChips = isCredit ? [{ method: "credit", amount: ev.raw?.total }] : [];
        // For installments: show paid + remaining
        const installChips = isInstallments ? [
          ...(ev.chips || []),
          ...(ev.ajalAmount > 0.005 ? [{ method: "credit", amount: ev.ajalAmount }] : []),
        ] : [];
        // For single-method (cash/bank_transfer)
        const singleChips = !isMulti && !isCredit && !isInstallments && ev.chips?.length > 0 ? ev.chips : [];

        // Which chips array to render
        const renderChips = isMulti ? multiChips : isCredit ? creditChips : isInstallments ? installChips : singleChips;

        return (
          <div key={ev.id}
            className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden border-r-4 hover:shadow-md hover:border-slate-350 transition-all duration-200 ${TYPE_ACCENT[ev.type] || "border-r-slate-200"}`}
          >
            {/* ── Top row: icon / type / ref / date / action ────────────── */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              {/* Icon */}
              <div className={`h-8.5 w-8.5 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 border ${cfg.border}`}>
                <Icon className={`h-4.5 w-4.5 ${cfg.color}`} />
              </div>

              {/* Middle: label + ref + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[12px] font-black text-slate-800 font-mono tracking-tight">
                    {ev.ref}
                  </span>
                  {/* Payment type badge (non-invoice rows only show method) */}
                  {!isDocRow && ev.methodLabel && (
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <span>•</span>
                      <span>{ev.methodLabel}</span>
                    </span>
                  )}
                </div>
                {ev.description && (
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{ev.description}</div>
                )}
              </div>

              {/* Right: total + date */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {/* Non-doc rows: show amount */}
                {!isDocRow && (
                  <div className={`text-[14px] font-black font-mono tracking-tight ${ev.impactDir === "subtract" ? "text-emerald-700" : "text-rose-600"
                    }`}>
                    {fmt(ev.impactAmount)}
                    <span className="text-[9px] font-bold opacity-60 mr-0.5">ج.م</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-400 font-bold font-mono">{fmtDate(ev.date)}</div>
              </div>

              {/* Action buttons */}
              {ev.type === "invoice" && (
                <button onClick={() => onOpenInvoice(ev.raw)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-150 hover:border-blue-200 transition-colors shrink-0"
                  title="عرض تفاصيل الفاتورة">
                  <Eye className="h-4 w-4" />
                </button>
              )}
              {ev.type === "return" && (
                <button onClick={() => onOpenReturn(ev.raw)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-150 hover:border-rose-200 transition-colors shrink-0"
                  title="عرض تفاصيل المرتجع">
                  <Eye className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ── Payment methods section ────────────────────────────────── */}
            {isDocRow && renderChips.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/20">
                {/* Total summary bar — always visible for invoice rows */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <span className="text-[10px] font-black text-slate-400">إجمالي قيمة الفاتورة</span>
                  <span className="text-[15px] font-black font-mono text-slate-900 tracking-tight">
                    {fmt(ev.invoiceTotal)}
                    <span className="text-[10px] font-bold text-slate-400 mr-1">ج.م</span>
                  </span>
                </div>

                <div className="px-4 pt-2.5 pb-3">
                  {/* Multi-payment: structured rows */}
                  {isMulti ? (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">تفاصيل الدفع متعدد القنوات</div>
                      {renderChips.map((chip, i) => {
                        const style = ms(chip.method);
                        const chipTotal = ev.invoiceTotal || 0;
                        const pct = chipTotal > 0 ? Math.round((chip.amount / chipTotal) * 100) : 0;
                        return (
                          <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${style.bg} border ${style.border}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${style.dot} shrink-0`} />
                            <span className={`text-[11px] font-black flex-1 ${style.text}`}>
                              {arMethod(chip.method)}
                            </span>

                            {/* Mini visual split bar */}
                            <div className="w-16 h-1.5 bg-slate-200/50 rounded-full overflow-hidden shrink-0 mx-2 hidden sm:block">
                              <div className={`h-full rounded-full ${style.dot}`} style={{ width: `${pct}%` }} />
                            </div>

                            <span className="text-[9px] font-bold text-slate-400 shrink-0">{pct}%</span>
                            <span className={`text-[12px] font-black font-mono shrink-0 ${style.text}`}>
                              {fmt(chip.amount)}
                              <span className="text-[9px] font-bold opacity-60 mr-0.5">ج.م</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Single / credit / installments: compact pill row */
                    <div className="flex flex-wrap gap-1.5">
                      {renderChips.map((chip, i) => {
                        const style = ms(chip.method);
                        return (
                          <span key={i}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {arMethod(chip.method)}
                            <span className="font-mono">{fmt(chip.amount)}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Installments expandable ────────────────────────────────── */}
            {isDocRow && isInstallments && ev.raw?.id && (
              <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50/10">
                <InstallmentsBadge debtId={ev.raw.debt_id || ev.raw.id} />
              </div>
            )}

            {/* ── Balance impact strip ───────────────────────────────────── */}
            {hasImpact && (
              <div className={`flex items-center justify-between px-4 py-2 border-t ${ev.impactDir === "add" || isMulti
                  ? "bg-rose-50/50 border-rose-100"
                  : "bg-emerald-50/50 border-emerald-100"
                }`}>
                <span className={`text-[10px] font-black tracking-wide ${ev.impactDir === "add" || isMulti ? "text-rose-500" : "text-emerald-600"
                  }`}>
                  {ev.impactDir === "add" || isMulti ? "↑ أُضيف للرصيد الآجل المترتب على العميل" : "↓ خُصم من الرصيد / تحصيل مالي"}
                </span>
                <span className={`text-[13px] font-black font-mono tracking-tight ${ev.impactDir === "add" || isMulti ? "text-rose-600" : "text-emerald-700"
                  }`}>
                  {ev.impactDir === "add" || isMulti ? "+" : "−"}{fmt(displayImpactAmount)}
                  <span className="text-[10px] font-bold opacity-60 mr-1">ج.م</span>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CustomerAccountsPage() {
  usePageTour('customer_accounts');
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [walkInId, setWalkInId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "movements");
  const [notesData, setNotesData] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);

  // Summary
  const [netBalance, setNetBalance] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Invoice detail modal
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Return detail modal
  const [detailReturn, setDetailReturn] = useState(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  // Forms
  const [payForm, setPayForm] = useState({ amount: "", method_id: "", notes: "" });
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "subtract", reason: "" });
  const [saving, setSaving] = useState(false);

  // ── Loaders ───────────────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    try {
      const [res, methodsReq, settingsReq] = await Promise.all([
        api.get("/api/customers"),
        api.get("/api/payment-methods"),
        api.get("/api/settings"),
      ]);
      const wid = settingsReq.data.data?.walk_in_customer_id || null;
      setWalkInId(wid);
      setCustomers((res.data.data || []).filter(c => c.id !== wid));
      setPaymentMethods((methodsReq.data.data || []).filter(m => m.id !== 2));
    } catch { toast.error("فشل تحميل العملاء"); }
    finally { setLoading(false); }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/api/customers/balance-summary");
      setNetBalance(r.data.data?.net_balance ?? null);
    } catch { setNetBalance(null); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!selected) return;
    setNotesLoading(true);
    try {
      const r = await api.get(`/api/customers/${selected.id}/notes?type=note`);
      setNotesData(r.data.data || []);
    } catch { setNotesData([]); }
    finally { setNotesLoading(false); }
  }, [selected]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === "notes") loadNotes(); }, [activeTab, loadNotes]);

  // ── URL sync ──────────────────────────────────────────────
  useEffect(() => {
    const urlId = searchParams.get("id");
    const urlTab = searchParams.get("tab");
    if (urlTab) setActiveTab(urlTab);
    if (urlId && customers.length > 0) {
      const found = customers.find(c => String(c.id) === String(urlId));
      if (found && (!selected || selected.id !== found.id)) setSelected(found);
      else if (!found) setSearchParams({});
    }
  }, [searchParams, customers, selected]);

  const selectCustomer = useCallback((c, tab = "movements") => {
    setSelected(c);
    setActiveTab(tab);
    setNotesData([]);
    setSearchParams({ id: String(c.id), tab });
  }, [setSearchParams]);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (selected) setSearchParams({ id: String(selected.id), tab });
  }, [selected, setSearchParams]);

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await api.get(`/api/customers/${selected.id}`);
    setSelected(r.data.data);
    loadCustomers();
    loadSummary();
  };

  // ── Invoice detail ────────────────────────────────────────
  useEffect(() => {
    if (!detailInvoice) { setDetailData(null); return; }
    setDetailLoading(true);
    api.get(`/api/invoices/${detailInvoice.id}`)
      .then(r => setDetailData(r.data.data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailInvoice]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCustomerCreated = (customer) => {
    toast.success("تم إضافة العميل بنجاح");
    loadCustomers();
    selectCustomer(customer, "movements");
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.method_id) return toast.error("برجاء إدخال المبلغ وتحديد وسيلة الدفع");
    setSaving(true);
    try {
      await api.post("/api/payments", {
        party_type: "customer",
        party_id: selected.id,
        amount: Number(payForm.amount),
        method_id: Number(payForm.method_id),
        notes: payForm.notes || null,
      });
      toast.success("تم تسجيل الدفعة بنجاح");
      setShowPayment(false);
      setPayForm({ amount: "", method_id: "", notes: "" });
      await refreshSelected();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسجيل الدفعة"); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjForm.amount || Number(adjForm.amount) <= 0) return toast.error("برجاء إدخال مبلغ صحيح");
    setSaving(true);
    try {
      await api.post(`/api/customers/${selected.id}/adjust`, adjForm);
      setShowAdjust(false);
      setAdjForm({ amount: "", direction: "subtract", reason: "" });
      await refreshSelected();
      toast.success("تمت تسوية الرصيد بنجاح");
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسوية الرصيد"); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (noteText) => {
    if (!noteText?.trim()) return;
    try {
      await api.post(`/api/customers/${selected.id}/notes`, { note: noteText });
      toast.success("تمت إضافة الملاحظة");
      loadNotes();
    } catch (e) { toast.error(e.response?.data?.message || "فشل إضافة الملاحظة"); }
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.code?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === "debtors") return Number(c.opening_balance) > 0;
    if (filter === "creditors") return Number(c.opening_balance) < 0;
    return true;
  });

  const bal = Number(selected?.opening_balance || 0);
  const creditLimit = Number(selected?.credit_limit || 0);
  const creditPct = creditLimit > 0 ? Math.min(100, Math.max(0, (bal / creditLimit) * 100)) : 0;

  return (
    <div className="flex flex-1 min-h-0 bg-slate-50 overflow-hidden" dir="rtl">

      {/* ── Left Panel ── */}
      <div className="w-[370px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        <div className="p-4 border-b border-slate-200/60 bg-slate-50/50 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8.5 w-8.5 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
                <Users className="h-4.5 w-4.5 text-white" />
              </div>
              <h1 className="text-[14px] font-black text-slate-800 tracking-tight">حسابات العملاء</h1>
            </div>
            <PermissionGate page="customer_accounts" action="add">
              <button onClick={() => setShowCreate(true)}
                className="flex h-8.5 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white hover:bg-blue-700 active:scale-[0.97] transition-all shadow-sm shadow-blue-100">
                <Plus className="h-4 w-4" /> عميل جديد
              </button>
            </PermissionGate>
          </div>

          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم، رقم الهاتف، الكود..."
              className="w-full h-10 rounded-xl border border-slate-250 pr-9.5 pl-3 text-[12px] font-bold outline-none focus:border-blue-500 bg-white transition-all focus:shadow-sm" />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[{ id: "all", label: "الكل" }, { id: "debtors", label: "يدينون لنا" }, { id: "creditors", label: "ندين لهم" }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all ${filter === f.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Net Balance Ticker Summary ── */}
        <div className="mx-4 mt-3 mb-2 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 p-4 shadow-md relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-blue-500/10 blur-xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
          <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-indigo-500/10 blur-lg pointer-events-none group-hover:scale-150 transition-all duration-500" />

          <div className="flex justify-between items-start mb-1.5 relative z-10">
            <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي صافي مديونية العملاء</span>
            <span className={`p-1 rounded-lg ${netBalance > 0 ? "bg-rose-500/15 text-rose-400" : netBalance < 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
              {netBalance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : netBalance < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />}
            </span>
          </div>

          <div className="relative z-10 flex items-baseline gap-1">
            <span className={`text-[22px] font-black font-mono tracking-tight ${netBalance > 0 ? "text-rose-400" : netBalance < 0 ? "text-emerald-400" : "text-slate-300"}`}>
              {summaryLoading ? (
                <span className="inline-block w-16 h-6 bg-slate-700 rounded animate-pulse" />
              ) : (
                fmt(netBalance ?? 0)
              )}
            </span>
            <span className="text-[10px] font-bold text-slate-400">ج.م</span>
          </div>

          <div className="mt-2 text-[9px] font-bold text-slate-400 flex items-center gap-1.5 relative z-10">
            {netBalance < 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">● رصيد دائن لصالح العملاء</span>
            ) : netBalance > 0 ? (
              <span className="text-rose-400 flex items-center gap-1">● مديونية مستحقة على العملاء</span>
            ) : (
              <span>● جميع الحسابات مسواة</span>
            )}
          </div>
        </div>

        {/* ── Customers List Scroll ── */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري تحميل القائمة...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <Users className="h-9 w-9 text-slate-300 opacity-60" />
              <p className="text-[12px] font-black text-slate-400">لا يوجد عملاء مطابقين للبحث</p>
            </div>
          ) : filtered.map(c => {
            const b = Number(c.opening_balance || 0);
            const lim = Number(c.credit_limit || 0);
            const nearLimit = lim > 0 && b >= lim * 0.9;
            return (
              <div key={c.id} onClick={() => selectCustomer(c, "movements")}
                className={`p-3.5 mx-2 my-1 rounded-2xl cursor-pointer border transition-all duration-200 relative group ${selected?.id === c.id
                    ? "bg-blue-50/50 border-blue-200 shadow-sm"
                    : "bg-white border-transparent hover:bg-slate-50/80 hover:border-slate-200"
                  }`}>
                <div className="flex items-center gap-3">
                  {/* Letter Avatar */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-[14px] font-black text-white shrink-0 shadow-sm transition-all duration-300 ${selected?.id === c.id
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 scale-105"
                      : "bg-gradient-to-br from-slate-400 to-slate-500 group-hover:from-blue-500 group-hover:to-blue-600"
                    }`}>
                    {c.name?.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className={`text-[13px] font-black truncate transition-colors ${selected?.id === c.id ? "text-blue-900" : "text-slate-800"}`}>{c.name}</div>
                      {nearLimit && (
                        <span className="flex items-center" title="تنبيه: اقتراب من الحد الائتماني">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400 font-mono font-bold truncate">{c.phone || c.code || "—"}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        {b < 0 && <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-700 border border-emerald-500/10 px-1.5 py-0.5 rounded-lg">له رصيد</span>}
                        {b > 0 && <span className="text-[8px] font-black bg-rose-500/10 text-rose-700 border border-rose-500/10 px-1.5 py-0.5 rounded-lg">عليه دين</span>}
                        <span className={`text-[12px] font-black font-mono tracking-tight ${b > 0 ? "text-rose-600" : b < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {fmt(Math.abs(b))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300">
            <Users className="h-16 w-16 opacity-30 text-slate-400" />
            <p className="text-[14px] font-black text-slate-400">اختر أحد العملاء من القائمة الجانبية للتفاصيل المالية</p>
          </div>
        ) : (
          <>
            {/* Customer Header Panel */}
            <div className="bg-white border-b border-slate-200/80 px-6 py-4 shrink-0 space-y-4 shadow-sm relative z-10">
              {/* Avatar + Basic Data */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-[18px] font-black text-white shrink-0 shadow-md shadow-blue-200">
                    {selected.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[16px] font-black text-slate-900 truncate leading-snug">{selected.name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {selected.phone && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-bold bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-0.5 hover:bg-slate-100/80 transition-colors">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{selected.phone}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selected.phone);
                              toast.success("تم نسخ رقم الهاتف");
                            }}
                            className="hover:text-blue-600 p-0.5"
                            title="نسخ رقم الهاتف"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {selected.code && (
                        <span className="text-[10px] font-bold font-mono bg-slate-50 text-slate-500 border border-slate-200/60 px-2.5 py-0.5 rounded-xl flex items-center gap-1">
                          <span>الكود: {selected.code}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selected.code);
                              toast.success("تم نسخ الكود");
                            }}
                            className="hover:text-blue-600 p-0.5"
                            title="نسخ الكود"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {selected.is_blacklisted === 1 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2.5 py-0.5 rounded-xl">
                          <AlertCircle className="h-3.5 w-3.5 animate-pulse" /> محظور من البيع الآجل
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 text-[11px] font-black text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 transition-all duration-200 shadow-sm shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> تعديل الملف
                </button>
              </div>

              {/* Status and Balance Card (Replacing old red/green emojis with SVGs) */}
              <div className={`rounded-2xl p-4 flex items-center justify-between border relative overflow-hidden transition-all duration-300 ${bal > 0
                  ? "bg-rose-50/60 border-rose-100 shadow-sm shadow-rose-500/[0.02]"
                  : bal < 0
                    ? "bg-emerald-50/60 border-emerald-100 shadow-sm shadow-emerald-500/[0.02]"
                    : "bg-slate-50 border-slate-200"
                }`}>
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-[16px] shrink-0 border shadow-sm transition-transform duration-300 hover:rotate-12 ${bal > 0
                      ? "bg-rose-100/80 border-rose-200 text-rose-600"
                      : bal < 0
                        ? "bg-emerald-100/80 border-emerald-200 text-emerald-600"
                        : "bg-slate-100 border-slate-200 text-slate-500"
                    }`}>
                    {bal > 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : bal < 0 ? (
                      <TrendingDown className="h-5 w-5" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className={`text-[10px] font-black tracking-wider uppercase ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-500" : "text-slate-400"
                      }`}>
                      {bal > 0 ? "صافي الرصيد المستحق (عليه مديونية)" : bal < 0 ? "الرصيد الدائن للعميل (له رصيد)" : "رصيد الحساب مسوّى بالكامل"}
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <div className={`text-[24px] font-black font-mono leading-none tracking-tight ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-650"
                        }`}>
                        {fmt(Math.abs(bal))}
                      </div>
                      <span className={`text-[12px] font-bold ${bal > 0 ? "text-rose-450" : bal < 0 ? "text-emerald-450" : "text-slate-450"
                        }`}>ج.م</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit Limit Indicator */}
              {creditLimit > 0 && bal > 0 && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 transition-all hover:bg-slate-100/30">
                  <div className="flex justify-between text-[11px] font-black mb-2">
                    <span className="text-slate-500 flex items-center gap-1">
                      <SlidersHorizontal className="h-3 w-3" />
                      <span>الحد الائتماني الأقصى المسموح</span>
                    </span>
                    <span className="text-slate-700 font-mono">{fmt(bal)} / {fmt(creditLimit)} ج.م</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner relative">
                    <div className={`h-full rounded-full transition-all duration-500 ${creditPct > 90
                        ? "bg-gradient-to-r from-rose-500 to-red-650"
                        : creditPct > 70
                          ? "bg-gradient-to-r from-amber-400 to-orange-500"
                          : "bg-gradient-to-r from-emerald-400 to-blue-500"
                      }`}
                      style={{ width: `${creditPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-1.5 font-mono">
                    <span>مستنفذ {Math.round(creditPct)}%</span>
                    <span>المتبقي {fmt(Math.max(0, creditLimit - bal))} ج.م</span>
                  </div>
                </div>
              )}

              {/* Grid CTAs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <PermissionGate page="customer_accounts" action="edit">
                  <button onClick={() => { setPayForm({ amount: bal > 0 ? String(bal) : "", method_id: "", notes: "" }); setShowPayment(true); }}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-white hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-200 transition-all duration-200">
                    <Plus className="h-4.5 w-4.5" />
                    <span className="text-[12px] font-black">{bal < 0 ? "رد دفعة للعميل" : "تحصيل دفعة مالية"}</span>
                  </button>
                </PermissionGate>
                <PermissionGate page="customer_accounts" action="edit">
                  <button onClick={() => { setAdjForm({ amount: "", direction: "subtract", reason: "" }); setShowAdjust(true); }}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 py-3 text-slate-700 hover:bg-slate-50 active:scale-[0.98] hover:border-slate-300 shadow-sm transition-all duration-200">
                    <SlidersHorizontal className="h-4.5 w-4.5 text-slate-500" />
                    <span className="text-[12px] font-black">تسوية رصيد يدوية</span>
                  </button>
                </PermissionGate>
              </div>
            </div>

            {/* Custom Tab Panel bar */}
            <div className="flex gap-2 px-6 py-3 bg-white border-b border-slate-200/80 shrink-0">
              {[
                { id: "movements", label: "سجل الحركات المالية" },
                { id: "notes", label: "ملاحظات وتنبيهات العميل" },
              ].map(t => (
                <button key={t.id} onClick={() => changeTab(t.id)}
                  className={`px-4 py-2 text-[12px] font-black rounded-xl transition-all duration-200 ${activeTab === t.id
                      ? "bg-slate-100 text-blue-700 font-black shadow-sm"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Container */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/70">
              {activeTab === "movements" ? (
                <MovementsTab
                  party={selected}
                  partyType="customer"
                  onOpenInvoice={setDetailInvoice}
                  onOpenReturn={setDetailReturn}
                />
              ) : (
                <NotesTab
                  notes={notesData}
                  loading={notesLoading}
                  onAdd={handleAddNote}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Invoice Detail Modal ══════════════════════════════ */}
      {detailInvoice && (
        <Modal onClose={() => { setDetailInvoice(null); setDetailData(null); }} width="650px">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-[16px] font-black text-slate-800">تفاصيل فاتورة المبيعات</h2>
                <p className="text-[11px] text-slate-400 font-bold font-mono mt-0.5">{detailInvoice.invoice_no || `#${detailInvoice.id}`}</p>
              </div>
              <button onClick={() => { setDetailInvoice(null); setDetailData(null); }} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-zinc-900 transition-colors">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 animate-pulse text-[12px] font-black">
                <RefreshCw className="h-5 w-5 animate-spin ml-2" /> جاري تحميل تفاصيل الفاتورة...
              </div>
            ) : detailData ? (
              <>
                <div className="rounded-2xl bg-slate-50 border border-slate-200/60 p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div><span className="font-black text-slate-400">العميل المستفيد:</span> <span className="font-bold text-slate-800">{detailData.customer_name || "—"}</span></div>
                    <div><span className="font-black text-slate-400">طريقة سداد الفاتورة:</span> <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-black ${PTYPE_COLOR[detailData.payment_type] || "text-slate-655 bg-slate-100 border-slate-200"}`}>{arMethod(detailData.payment_type)}</span></div>
                    <div><span className="font-black text-slate-400">تاريخ المعاملة:</span> <span className="font-bold text-slate-800">{fmtDate(detailData.created_at)}</span></div>
                    <div><span className="font-black text-slate-400">حالة السداد:</span> <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${detailData.status === "paid" ? "bg-emerald-100 text-emerald-700" : detailData.status === "cancelled" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{detailData.status === "paid" ? "مسدد بالكامل" : detailData.status === "cancelled" ? "ملغي" : "آجل غير كامل السداد"}</span></div>
                  </div>
                </div>

                {/* Lines Receipt */}
                <div className="rounded-2xl border border-slate-200/80 overflow-hidden mb-4 shadow-sm bg-white">
                  <div className="bg-slate-50 grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-black text-slate-555 border-b border-slate-200/60">
                    <div className="col-span-5">اسم البند/الصنف</div>
                    <div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-2 text-center">سعر الوحدة</div>
                    <div className="col-span-1 text-center">خصم</div>
                    <div className="col-span-2 text-left">الإجمالي</div>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {detailData.lines?.map((line, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50/50 transition-colors">
                        <div className="col-span-5 text-[12px] font-bold text-slate-800 truncate">{line.item_name || line.name}</div>
                        <div className="col-span-2 text-center font-mono text-[11px] text-slate-650">{line.quantity}</div>
                        <div className="col-span-2 text-center font-mono text-[11px] text-slate-650">{fmt(line.unit_price)}</div>
                        <div className="col-span-1 text-center font-mono text-[10px] text-rose-500">{line.discount > 0 ? fmt(line.discount) : "—"}</div>
                        <div className="col-span-2 text-left font-mono text-[11px] font-black text-slate-800">{fmt(line.line_total)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900 text-white px-4 py-3.5">
                    <div className="flex justify-between text-[11px] mb-1.5"><span className="text-slate-400">إجمالي الأصناف الفرعي</span><span className="font-mono">{fmt(detailData.subtotal)} ج.م</span></div>
                    {Number(detailData.discount) > 0 && <div className="flex justify-between text-[11px] mb-1.5"><span className="text-slate-400">خصم إضافي</span><span className="font-mono text-rose-300">- {fmt(detailData.discount)} ج.م</span></div>}
                    {Number(detailData.increase) > 0 && <div className="flex justify-between text-[11px] mb-1.5"><span className="text-slate-400">رسوم / تكلفة إضافية</span><span className="font-mono text-amber-300">+ {fmt(detailData.increase)} ج.م</span></div>}
                    <div className="flex justify-between text-[14px] font-black border-t border-slate-700/80 pt-2.5 mt-2.5">
                      <span>إجمالي قيمة الفاتورة النهائي</span>
                      <span className="font-mono text-emerald-350">{fmt(detailData.total)} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Payment Methods Breakdown */}
                {detailData.payments?.length > 0 && (
                  <div className="rounded-2xl border border-slate-200/80 overflow-hidden mb-4 shadow-sm">
                    <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 border-b border-slate-200/80 uppercase">
                      توزيع القنوات المالية المستلمة
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                      {detailData.payments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${p.method === "cash" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" :
                              p.method === "credit" ? "bg-amber-50 text-amber-700 border-amber-200/60" :
                                p.method === "bank" ? "bg-sky-50 text-sky-700 border-sky-200/60" :
                                  "bg-slate-100 text-slate-700 border-slate-200/60"
                            }`}>
                            {arMethod(p.method) || p.method_name || p.method}
                          </span>
                          <span className="font-mono font-black text-[13px] text-slate-800">{fmt(p.amount)} <span className="text-[10px] font-bold text-slate-400">ج.م</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-5">
                  <button onClick={() => window.open(`/invoices/${detailInvoice.id}`, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-[12px] font-black text-white hover:bg-blue-700 active:scale-[0.98] transition-all">
                    <ExternalLink className="h-4 w-4" /> فتح الفاتورة الكاملة
                  </button>
                  <button onClick={() => { setDetailInvoice(null); setDetailData(null); }} className="px-6 rounded-2xl border border-slate-200 text-[12px] font-black text-slate-600 hover:bg-slate-50 transition-colors">إغلاق النافذة</button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                <FileText className="h-8 w-8 opacity-30" />
                <span className="font-black text-[13px]">تعذر عرض تفاصيل الفاتورة</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Return Detail Modal ══════════════════════════════ */}
      {detailReturn && (
        <Modal onClose={() => setDetailReturn(null)} width="480px">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-[16px] font-black text-slate-850">تفاصيل سند المرتجع المالي</h2>
                <p className="text-[11px] text-slate-400 font-bold font-mono mt-0.5">{detailReturn.doc_no || `#${detailReturn.id}`}</p>
              </div>
              <button onClick={() => setDetailReturn(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"><X className="h-4.5 w-4.5" /></button>
            </div>
            <div className="space-y-3.5 text-[12px]">
              {[
                ["سند الفاتورة الأصلية", detailReturn.original_invoice_no || "—"],
                ["قيمة المرتجع المالي", `${fmt(detailReturn.total)} ج.م`],
                ["طريقة استرداد القيمة", arMethod(detailReturn.refund_method) || detailReturn.refund_method || "—"],
                ["سبب إرجاع البضاعة", detailReturn.reason || "لا يوجد سبب مسجل"],
                ["تاريخ قيد الحركة", fmtDate(detailReturn.created_at)]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 pb-2.5 items-center">
                  <span className="font-black text-slate-400">{label}</span>
                  <span className="font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setDetailReturn(null)} className="mt-5 w-full rounded-2xl border border-slate-200 py-2.5 text-[12px] font-black text-slate-600 hover:bg-slate-50 transition-colors">إغلاق النافذة</button>
          </div>
        </Modal>
      )}

      {/* ══ Modals ══════════════════════════════════════════ */}

      <AddCustomerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCustomerCreated}
      />

      <CustomerInfoModal
        open={showEdit}
        customerId={selected?.id}
        onClose={() => setShowEdit(false)}
        onUpdated={(updated) => {
          setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
          setSelected(updated);
        }}
      />

      {/* Payment Modal */}
      {showPayment && selected && (
        <Modal onClose={() => setShowPayment(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
              <h2 className="text-[16px] font-black text-slate-850">{bal < 0 ? "رد دفعة مالية للعميل" : "تحصيل دفعة مالية من العميل"}</h2>
              <button onClick={() => setShowPayment(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><X className="h-4.5 w-4.5" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-3">الحساب المستهدف: <span className="text-slate-800 font-black">{selected.name}</span></p>
            {bal > 0 && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 mb-4 text-[12px] font-bold text-rose-800 flex justify-between items-center">
                <span>إجمالي الرصيد المستحق بذمته:</span>
                <span className="font-mono font-black text-[13px]">{fmt(bal)} ج.م</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-1.5 block uppercase">المبلغ المقبوض <span className="text-rose-500">*</span></label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-blue-500 focus:shadow-sm" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-1.5 block uppercase">قناة الاستلام الدفع <span className="text-rose-500">*</span></label>
                <select value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[12px] font-bold bg-white outline-none focus:border-blue-500">
                  <option value="">-- اختر قناة السداد --</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-1.5 block uppercase">ملاحظات توضيحية (اختياري)</label>
                <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[12px] outline-none focus:border-blue-500" placeholder="مثال: دفعة من حساب فواتير سابقة" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handlePayment} disabled={saving || !payForm.amount || !payForm.method_id}
                className="flex-1 h-11 rounded-2xl bg-blue-600 text-white text-[12px] font-black hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200 active:scale-[0.98] transition-all">
                {saving ? "جاري قيد العملية..." : "تأكيد واستلام الدفعة"}
              </button>
              <button onClick={() => setShowPayment(false)} className="h-11 px-6 rounded-2xl bg-slate-100 text-slate-700 text-[12px] font-black hover:bg-slate-200 transition-colors">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Adjust Modal */}
      {showAdjust && selected && (
        <Modal onClose={() => setShowAdjust(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
              <h2 className="text-[16px] font-black text-slate-850">تسوية رصيد الحساب يدوياً</h2>
              <button onClick={() => setShowAdjust(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><X className="h-4.5 w-4.5" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-4">
              العميل المشمول: <span className="text-slate-800 font-black">{selected.name}</span>
              {" — "}الرصيد قبل التسوية:
              <span className={`font-mono font-black ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}> {fmt(Math.abs(bal))} ج.م</span>
            </p>
            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-3.5 mb-4">
              <p className="text-[10.5px] font-bold text-amber-800 leading-relaxed">⚠️ تنبيه: تؤدي التسوية اليدوية لتغيير رصيد العميل مباشرة دون قيد مالي في الخزنة. تستخدم فقط لتصحيح القيود الخاطئة أو الخصم والتنازل المتفق عليه.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "subtract" }))}
                  className={`p-3 rounded-2xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "subtract" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                  <div className="text-[18px] mb-1">↓</div>تخفيض مديونية العميل
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(خصم / إعفاء / تسوية)</div>
                </button>
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "add" }))}
                  className={`p-3 rounded-2xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "add" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                  <div className="text-[18px] mb-1">↑</div>رفع مديونية العميل
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(إضافة دين / قيد تصحيح)</div>
                </button>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-1.5 block uppercase">مبلغ التسوية المستحق <span className="text-rose-500">*</span></label>
                <input type="number" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-blue-500 focus:shadow-sm" placeholder="0.00" autoFocus />
              </div>
              {adjForm.amount > 0 && (() => {
                const newBal = adjForm.direction === "subtract" ? bal - Number(adjForm.amount) : bal + Number(adjForm.amount);
                return (
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 mb-1">صافي رصيد الحساب المتوقع بعد الحفظ:</p>
                    <p className={`text-[17px] font-black font-mono ${newBal > 0 ? "text-rose-600" : newBal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {fmt(Math.abs(newBal))} ج.م
                    </p>
                  </div>
                );
              })()}
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-1.5 block uppercase">سبب التسوية اليدوية (مطلوب للتسجيل) <span className="text-rose-500">*</span></label>
                <input value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[12px] outline-none focus:border-blue-500"
                  placeholder="مثال: خصم خاص متفق عليه / تصحيح تكرار حركة فواتير" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdjust} disabled={saving || !adjForm.amount || !adjForm.reason}
                className="flex-1 h-11 rounded-2xl bg-slate-800 text-white text-[12px] font-black hover:bg-slate-900 disabled:opacity-50 transition-colors">
                {saving ? "جاري تنفيذ التسوية..." : "تأكيد وحفظ التسوية"}
              </button>
              <button onClick={() => setShowAdjust(false)} className="h-11 px-6 rounded-2xl bg-slate-100 text-slate-700 text-[12px] font-black hover:bg-slate-200 transition-colors">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Notes Tab (inline, keeps file self-contained) ─────────
function NotesTab({ notes, loading, onAdd }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text);
    setText("");
    setSaving(false);
  };

  if (loading) return <div className="flex h-32 items-center justify-center text-[12px] font-black text-slate-400 animate-pulse">جاري التحميل...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Add note inline */}
      <div className="bg-white rounded-2xl border border-slate-200/85 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-wider">إضافة ملاحظة أو تنبيه جديد للعميل</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full rounded-xl border border-slate-200 p-3 text-[13px] font-semibold outline-none focus:border-amber-500 resize-none transition-all focus:shadow-sm"
          placeholder="اكتب هنا ملاحظة تخص التعامل المالي أو أي تفاصيل هامة..." />
        <div className="flex justify-end mt-2">
          <button onClick={submit} disabled={saving || !text.trim()}
            className="h-9 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-black disabled:opacity-40 transition-colors shadow-sm shadow-amber-100">
            {saving ? "جاري الحفظ..." : "حفظ الملاحظة الآن"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-28 text-slate-355 gap-2 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
          <MessageSquare className="h-8 w-8 opacity-30 text-slate-400" />
          <span className="font-black text-[12px] text-slate-400">لا توجد ملاحظات مسجلة لهذا العميل</span>
        </div>
      ) : (
        <div className="relative pr-3 border-r-2 border-slate-200 space-y-4 mr-1">
          {notes.map(n => (
            <div key={n.id} className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200">
              {/* Timeline marker */}
              <div className="absolute right-[-18px] top-6 w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow-sm" />

              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>ملاحظة مسجلة</span>
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                  <span>بواسطة: {n.user_name || "النظام"}</span>
                  <span>•</span>
                  <span>{n.created_at ? new Date(n.created_at).toLocaleDateString("ar-EG") : "—"}</span>
                </div>
              </div>
              <p className="text-[13px] font-bold leading-relaxed text-slate-800 whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
