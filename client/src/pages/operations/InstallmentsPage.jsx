import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../../services/api";
import {
  Plus, Calendar, User, AlertCircle, CheckCircle2,
  Search, Clock, Banknote, X, ChevronDown, RefreshCw,
  TrendingDown, Building2
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import PermissionGate from "../../components/ui/PermissionGate";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

function fmt(v) {
  return formatNumber(v);
}
function dateStr(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG-u-nu-latn");
}

const STATUS_MAP = {
  open: { label: "مفتوح", color: "bg-blue-50 text-blue-700 border-blue-200" },
  partial: { label: "جزئي", color: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue: { label: "متأخر", color: "bg-rose-50 text-rose-700 border-rose-200" },
  paid: { label: "مسدد", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function InstallmentsPage() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_owed: 0, open_count: 0, overdue_count: 0, overdue_amount: 0, due_today: 0, debtors: 0 });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // open|partial|overdue|paid|""
  const [partyType, setPartyType] = useState("customer"); // customer|supplier
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  const queryRef = useRef(null);
  const statusFilterRef = useRef(null);
  const partyTypeRef = useRef(null);
  const payAmountRef = useRef(null);
  const payNoteRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  async function load() {
    setLoading(true);
    try {
      const [debtsRes, summaryRes] = await Promise.all([
        api.get(`/api/ajal-debts?party_type=${partyType}`),
        api.get(`/api/ajal-debts/summary?party_type=${partyType}`),
      ]);
      setDebts(debtsRes.data.data || []);
      setSummary(summaryRes.data.data || {});
    } catch {
      toast.error("فشل جلب بيانات الديون الآجلة");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [partyType]);

  async function handlePay(e) {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setPaying(true);
    try {
      await api.post(`/api/ajal-debts/${selectedDebt.id}/pay`, { amount: Number(payAmount), notes: payNote });
      toast.success("تم تسجيل السداد بنجاح");
      setSelectedDebt(null);
      setPayAmount("");
      setPayNote("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل تسجيل السداد");
    } finally {
      setPaying(false);
    }
  }

  const filtered = useMemo(() => {
    return debts.filter(d => {
      const matchQuery = !query || (d.party_name || "").includes(query) || String(d.invoice_id || "").includes(query);
      const matchStatus = !statusFilter || d.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [debts, query, statusFilter]);

  return (
    <div className="standard-page-container flex flex-col gap-6 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[22px] font-black text-text-primary">إدارة الأقساط والمديونيات الآجلة</h1>
          <p className="text-sm text-text-muted font-bold mt-0.5">متابعة وتحصيل الديون الآجلة للعملاء والموردين</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border-normal overflow-hidden bg-bg-overlay">
            <button ref={partyTypeRef} onClick={() => setPartyType("customer")} className={`px-4 py-2 text-2sm font-black transition-all flex items-center gap-1.5 ${partyType === "customer" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg-overlay"}`}
              onKeyDown={e => handleKeyDown(e, { prevRef: statusFilterRef })}>
              <User className="h-3.5 w-3.5" /> العملاء
            </button>
            <button onClick={() => setPartyType("supplier")} className={`px-4 py-2 text-2sm font-black transition-all flex items-center gap-1.5 ${partyType === "supplier" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg-overlay"}`}>
              <Building2 className="h-3.5 w-3.5" /> الموردين
            </button>
          </div>
          <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-normal bg-bg-surface hover:bg-bg-overlay transition-colors">
            <RefreshCw className={`h-4 w-4 text-text-secondary ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-normal bg-bg-surface p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">إجمالي المستحق</span>
          <div className="mt-1 text-[22px] font-black text-text-primary">{fmt(summary.total_owed)}</div>
          <div className="text-[11px] text-text-muted font-bold">{summary.open_count} دَين مفتوح</div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-widest text-rose-400">متأخرة السداد</span>
          <div className="mt-1 text-[22px] font-black text-rose-700">{summary.overdue_count}</div>
          <div className="text-[11px] text-rose-400 font-bold">{fmt(summary.overdue_amount)} ج.م</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">مستحقة اليوم</span>
          <div className="mt-1 text-[22px] font-black text-amber-700">{summary.due_today}</div>
          <div className="text-[11px] text-amber-400 font-bold">يجب تحصيلها اليوم</div>
        </div>
        <div className="rounded-xl border border-border-normal bg-bg-surface p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">عدد المدينين</span>
          <div className="mt-1 text-[22px] font-black text-text-primary">{summary.debtors}</div>
          <div className="text-[11px] text-text-muted font-bold">{partyType === "customer" ? "عميل" : "مورد"} مديون</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            ref={queryRef}
            type="text"
            placeholder="بحث بالاسم أو رقم الفاتورة..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border-normal bg-bg-surface py-2 pl-3 pr-9 text-sm font-bold outline-none focus:border-slate-800"
            onKeyDown={e => handleKeyDown(e, { nextRef: statusFilterRef })}
          />
        </div>
        <div className="flex gap-1">
          {["", "open", "partial", "overdue", "paid"].map((s, i) => (
            <button
              key={s}
              ref={i === 0 ? statusFilterRef : undefined}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-[11px] font-black border transition-all ${statusFilter === s ? "bg-primary text-white border-slate-800" : "bg-bg-surface border-border-normal text-text-secondary hover:border-slate-400"}`}
              onKeyDown={i === 0 ? e => handleKeyDown(e, { nextRef: partyTypeRef, prevRef: queryRef }) : undefined}
            >
              {s === "" ? "الكل" : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-normal bg-bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-overlay text-[11px] font-black uppercase tracking-widest text-text-muted">
                <th className="px-5 py-3">{partyType === "customer" ? "العميل" : "المورد"}</th>
                <th className="px-5 py-3">المصدر</th>
                <th className="px-5 py-3">تاريخ الاستحقاق</th>
                <th className="px-5 py-3 text-left">الأصل</th>
                <th className="px-5 py-3 text-left">المسدد</th>
                <th className="px-5 py-3 text-left">المتبقي</th>
                <th className="px-5 py-3 text-center">الحالة</th>
                <th className="px-5 py-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr><td colSpan="8" className="py-16 text-center text-text-muted font-bold animate-pulse">جاري جلب البيانات...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="py-16 text-center text-text-muted font-bold">لا توجد ديون مطابقة</td></tr>
              ) : (
                filtered.map(debt => {
                  const remaining = Number(debt.original_amount) - Number(debt.paid_amount);
                  const st = STATUS_MAP[debt.status] || STATUS_MAP.open;
                  return (
                    <tr key={debt.id} className="hover:bg-bg-overlay/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-overlay text-text-muted border border-border-normal shrink-0">
                            {partyType === "supplier" ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                          </div>
                          <span className="text-sm font-black text-text-primary">{debt.party_name || debt.customer_name || debt.supplier_name || `#${debt.customer_id || debt.supplier_id}`}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-2sm font-bold text-text-secondary">{debt.source_type === "purchase" ? "مشتريات" : "فاتورة"}</div>
                        <div className="text-[11px] font-mono text-text-muted">#{debt.invoice_id || "—"}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className={`flex items-center gap-1.5 text-2sm font-bold ${debt.status === "overdue" ? "text-rose-600" : "text-text-secondary"}`}>
                          <Calendar className="h-3.5 w-3.5 opacity-60" />
                          {dateStr(debt.due_date)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-left number-fmt-primary text-sm text-text-primary">{fmt(debt.original_amount)}</td>
                      <td className="px-5 py-3.5 text-left number-fmt-primary text-sm text-emerald-600">{fmt(debt.paid_amount)}</td>
                      <td className="px-5 py-3.5 text-left number-fmt-primary text-sm text-text-primary">{fmt(remaining)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {debt.status !== "paid" && (
                          <PermissionGate page="installments" action="edit">
                          <button
                            onClick={() => { setSelectedDebt(debt); setPayAmount(String(remaining.toFixed(2))); setPayNote(""); }}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors mx-auto"
                          >
                            <Banknote className="h-3.5 w-3.5" /> سداد
                          </button>
                          </PermissionGate>
                        )}
                        {debt.status === "paid" && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={!!selectedDebt} onClose={() => setSelectedDebt(null)} title="تسجيل سداد" showDetach={false}>
        {selectedDebt && (
          <form onSubmit={handlePay} className="flex flex-col gap-4 mt-2">
            <div className="rounded-xl bg-bg-overlay border border-border-normal p-4 flex flex-col gap-1">
              <div className="flex justify-between text-2sm">
                <span className="font-bold text-text-secondary">{partyType === "customer" ? "العميل" : "المورد"}</span>
                <span className="font-black text-text-primary">{selectedDebt.party_name || selectedDebt.customer_name}</span>
              </div>
              <div className="flex justify-between text-2sm">
                <span className="font-bold text-text-secondary">المبلغ الأصلي</span>
                <span className="number-fmt-primary text-text-primary">{fmt(selectedDebt.original_amount)}</span>
              </div>
              <div className="flex justify-between text-2sm">
                <span className="font-bold text-text-secondary">المسدد</span>
                <span className="number-fmt-primary text-emerald-600">{fmt(selectedDebt.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-2sm border-t border-border-normal pt-1 mt-1">
                <span className="font-black text-text-primary">المتبقي</span>
                <span className="number-fmt-primary text-rose-600">{fmt(Number(selectedDebt.original_amount) - Number(selectedDebt.paid_amount))}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">المبلغ المدفوع</label>
              <input
                ref={payAmountRef}
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="rounded-lg border border-border-strong bg-bg-surface px-4 py-2.5 text-[16px] font-black outline-none focus:border-emerald-500"
                autoFocus
                onKeyDown={e => handleKeyDown(e, { nextRef: payNoteRef })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">ملاحظات (اختياري)</label>
              <input
                ref={payNoteRef}
                type="text"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="مثال: دفعة نقدية..."
                className="rounded-lg border border-border-normal bg-bg-surface px-4 py-2 text-sm font-bold outline-none focus:border-slate-800"
                onKeyDown={e => handleKeyDown(e, { prevRef: payAmountRef, onEnter: () => handlePay(e) })}
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setSelectedDebt(null)} className="flex-1 rounded-lg border border-border-normal bg-bg-overlay px-4 py-2.5 text-sm font-black text-text-secondary hover:bg-bg-overlay transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={paying} className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> {paying ? "جاري التسجيل..." : "تأكيد السداد"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
