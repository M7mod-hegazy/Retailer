import React, { useState, useEffect, useCallback } from "react";
import { BookOpen, RefreshCw, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import api from "../../services/api";
import { formatNumber } from "../../utils/currency";

const fmt = (n) => formatNumber(n);

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
    <div className="flex flex-col h-full bg-bg-overlay" dir="rtl" data-help-root="payments">
      <header className="bg-bg-surface border-b border-border-normal px-6 py-4 flex items-center justify-between shrink-0" data-help="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-200">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-text-primary">سجل المدفوعات</h1>
            <p className="text-[11px] font-bold text-text-muted">تاريخ كامل لجميع حركات المدفوعات</p>
          </div>
        </div>
        <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-normal hover:bg-bg-overlay text-text-secondary">
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {/* Filters */}
      <div className="bg-bg-surface border-b border-border-subtle px-6 py-3 flex items-center gap-3 shrink-0 flex-wrap" data-help="filters-bar">
        <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          placeholder="بحث بالكود أو المبلغ أو الوصف..."
          className="h-9 w-60 rounded-xl border border-border-normal px-3 text-2sm outline-none focus:border-blue-400" />
        <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          className="h-9 rounded-xl border border-border-normal px-3 text-2sm outline-none" />
        <span className="text-text-muted text-2sm">إلى</span>
        <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          className="h-9 rounded-xl border border-border-normal px-3 text-2sm outline-none" />
        <select value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
          className="h-9 rounded-xl border border-border-normal px-3 text-2sm outline-none bg-bg-surface">
          <option value="">كل وسائل الدفع</option>
          {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="h-9 rounded-xl border border-border-normal px-3 text-2sm outline-none bg-bg-surface">
          <option value="">كل أنواع المستندات</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={load} className="h-9 rounded-xl bg-blue-600 px-4 text-2sm font-black text-white hover:bg-blue-700">بحث</button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6" data-help="main-table">
        <div className="bg-bg-surface rounded-2xl border border-border-normal shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-text-muted font-black">جاري التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
              <BookOpen className="h-10 w-10" />
              <span className="font-black text-sm">لا توجد حركات مطابقة</span>
            </div>
          ) : (
            <table className="w-full text-2sm">
              <thead className="bg-bg-overlay border-b border-border-normal">
                <tr>
                  {["الكود", "النوع", "المبلغ", "الاتجاه", "الطرف", "التاريخ"].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-black text-text-secondary text-[11px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border-subtle hover:bg-bg-overlay transition-colors">
                    <td className="px-4 py-3 font-black text-text-primary">{r.doc_no || `#${r.id}`}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-bg-overlay px-2 py-0.5 text-[11px] font-black text-text-secondary">
                        {DOC_TYPES[r.doc_type] || r.doc_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 number-fmt-primary text-text-primary">{fmt(r.amount)} ج.م</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-[11px] font-black ${r.direction === "out" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.direction === "out" ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                        {r.direction === "out" ? "خارج" : "داخل"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary truncate max-w-[160px]">{r.party || r.description || "—"}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("ar-EG-u-nu-latn") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-bg-overlay border-t border-border-normal">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-black text-text-primary text-2sm">
                    الإجمالي ({rows.length} حركة)
                  </td>
                  <td className="px-4 py-3 number-fmt-primary text-text-primary">
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
