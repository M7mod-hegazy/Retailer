import React, { useState, useEffect, useCallback } from "react";
import { BookOpen, RefreshCw, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import api from "../../services/api";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const DOC_TYPES = {
  pos_invoice: "فاتورة POS",
  expense: "مصروف",
  revenue: "إيراد",
  purchase: "مشتريات",
  customer_payment: "دفعة عميل",
  withdrawal: "مسحوبات",
};

export default function PaymentTransactionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState([]);
  const [filters, setFilters] = useState({ method: "", type: "", direction: "", from: "", to: "", search: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load from all transaction types combined from daily sessions
      const params = new URLSearchParams({ type: "all", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const [txR, mR] = await Promise.all([
        api.get(`/api/daily-sessions/today/transactions?type=pos`),
        api.get("/api/payment-methods"),
      ]);
      setMethods(mR.data.data || []);
      setRows(txR.data.data || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full bg-slate-50" dir="rtl" data-help-root="payments">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0" data-help="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-200">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900">سجل المدفوعات</h1>
            <p className="text-[11px] font-bold text-slate-400">تاريخ كامل لجميع حركات المدفوعات</p>
          </div>
        </div>
        <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500">
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 shrink-0 flex-wrap" data-help="filters-bar">
        <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          placeholder="بحث بالكود أو المبلغ أو الوصف..."
          className="h-9 w-60 rounded-xl border border-slate-200 px-3 text-[12px] outline-none focus:border-blue-400" />
        <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
        <span className="text-slate-400 text-[12px]">إلى</span>
        <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
        <select value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
          className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none bg-white">
          <option value="">كل وسائل الدفع</option>
          {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none bg-white">
          <option value="">كل أنواع المستندات</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={load} className="h-9 rounded-xl bg-blue-600 px-4 text-[12px] font-black text-white hover:bg-blue-700">بحث</button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6" data-help="main-table">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-black">جاري التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
              <BookOpen className="h-10 w-10" />
              <span className="font-black text-[13px]">لا توجد حركات مطابقة</span>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["الكود", "النوع", "المبلغ", "الاتجاه", "الطرف", "التاريخ"].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-black text-slate-700">{r.doc_no || `#${r.id}`}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                        {DOC_TYPES[r.doc_type] || r.doc_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black font-mono text-slate-900">{fmt(r.amount)} ج.م</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black ${r.direction === "out" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.direction === "out" ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                        {r.direction === "out" ? "خارج" : "داخل"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[160px]">{r.party || r.description || "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("ar-EG-u-nu-latn") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-black text-slate-700 text-[12px]">
                    الإجمالي ({rows.length} حركة)
                  </td>
                  <td className="px-4 py-3 font-black font-mono text-slate-900">
                    {fmt(rows.reduce((s, r) => s + Number(r.amount || 0), 0))} ج.م
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
