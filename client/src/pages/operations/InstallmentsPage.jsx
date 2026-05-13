import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  Plus, Calendar, User, AlertCircle, CheckCircle2,
  Search, Clock, Banknote, X, ChevronDown, RefreshCw,
  TrendingDown, Building2
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import PermissionGate from "../../components/ui/PermissionGate";

function fmt(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function dateStr(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
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
          <h1 className="text-[22px] font-black text-slate-800">إدارة الأقساط والمديونيات الآجلة</h1>
          <p className="text-[13px] text-slate-400 font-bold mt-0.5">متابعة وتحصيل الديون الآجلة للعملاء والموردين</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            <button onClick={() => setPartyType("customer")} className={`px-4 py-2 text-[12px] font-black transition-all flex items-center gap-1.5 ${partyType === "customer" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <User className="h-3.5 w-3.5" /> العملاء
            </button>
            <button onClick={() => setPartyType("supplier")} className={`px-4 py-2 text-[12px] font-black transition-all flex items-center gap-1.5 ${partyType === "supplier" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Building2 className="h-3.5 w-3.5" /> الموردين
            </button>
          </div>
          <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">إجمالي المستحق</span>
          <div className="mt-1 text-[22px] font-black text-slate-800">{fmt(summary.total_owed)}</div>
          <div className="text-[10px] text-slate-400 font-bold">{summary.open_count} دَين مفتوح</div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">متأخرة السداد</span>
          <div className="mt-1 text-[22px] font-black text-rose-700">{summary.overdue_count}</div>
          <div className="text-[10px] text-rose-400 font-bold">{fmt(summary.overdue_amount)} ج.م</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">مستحقة اليوم</span>
          <div className="mt-1 text-[22px] font-black text-amber-700">{summary.due_today}</div>
          <div className="text-[10px] text-amber-400 font-bold">يجب تحصيلها اليوم</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">عدد المدينين</span>
          <div className="mt-1 text-[22px] font-black text-slate-800">{summary.debtors}</div>
          <div className="text-[10px] text-slate-400 font-bold">{partyType === "customer" ? "عميل" : "مورد"} مديون</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو رقم الفاتورة..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-[13px] font-bold outline-none focus:border-slate-800"
          />
        </div>
        <div className="flex gap-1">
          {["", "open", "partial", "overdue", "paid"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-[11px] font-black border transition-all ${statusFilter === s ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"}`}
            >
              {s === "" ? "الكل" : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
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
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="8" className="py-16 text-center text-slate-400 font-bold animate-pulse">جاري جلب البيانات...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="py-16 text-center text-slate-400 font-bold">لا توجد ديون مطابقة</td></tr>
              ) : (
                filtered.map(debt => {
                  const remaining = Number(debt.original_amount) - Number(debt.paid_amount);
                  const st = STATUS_MAP[debt.status] || STATUS_MAP.open;
                  return (
                    <tr key={debt.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200 shrink-0">
                            {partyType === "supplier" ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                          </div>
                          <span className="text-[13px] font-black text-slate-800">{debt.party_name || debt.customer_name || debt.supplier_name || `#${debt.customer_id || debt.supplier_id}`}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-[12px] font-bold text-slate-600">{debt.source_type === "purchase" ? "مشتريات" : "فاتورة"}</div>
                        <div className="text-[10px] font-mono text-slate-400">#{debt.invoice_id || "—"}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className={`flex items-center gap-1.5 text-[12px] font-bold ${debt.status === "overdue" ? "text-rose-600" : "text-slate-600"}`}>
                          <Calendar className="h-3.5 w-3.5 opacity-60" />
                          {dateStr(debt.due_date)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono text-[13px] font-bold text-slate-700">{fmt(debt.original_amount)}</td>
                      <td className="px-5 py-3.5 text-left font-mono text-[13px] font-bold text-emerald-600">{fmt(debt.paid_amount)}</td>
                      <td className="px-5 py-3.5 text-left font-mono text-[13px] font-black text-slate-800">{fmt(remaining)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black ${st.color}`}>
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
      <Modal open={!!selectedDebt} onClose={() => setSelectedDebt(null)} title="تسجيل سداد">
        {selectedDebt && (
          <form onSubmit={handlePay} className="flex flex-col gap-4 mt-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col gap-1">
              <div className="flex justify-between text-[12px]">
                <span className="font-bold text-slate-500">{partyType === "customer" ? "العميل" : "المورد"}</span>
                <span className="font-black text-slate-800">{selectedDebt.party_name || selectedDebt.customer_name}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="font-bold text-slate-500">المبلغ الأصلي</span>
                <span className="font-black font-mono text-slate-700">{fmt(selectedDebt.original_amount)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="font-bold text-slate-500">المسدد</span>
                <span className="font-black font-mono text-emerald-600">{fmt(selectedDebt.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-[12px] border-t border-slate-200 pt-1 mt-1">
                <span className="font-black text-slate-700">المتبقي</span>
                <span className="font-black font-mono text-rose-600">{fmt(Number(selectedDebt.original_amount) - Number(selectedDebt.paid_amount))}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">المبلغ المدفوع</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[16px] font-black outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ملاحظات (اختياري)</label>
              <input
                type="text"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="مثال: دفعة نقدية..."
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold outline-none focus:border-slate-800"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setSelectedDebt(null)} className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-black text-slate-600 hover:bg-slate-100 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={paying} className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> {paying ? "جاري التسجيل..." : "تأكيد السداد"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
