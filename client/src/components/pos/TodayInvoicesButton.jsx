import React, { useState, useCallback, useRef } from "react";
import { Receipt, X, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";
import { todayCairo } from "../../utils/dateHelpers";

const PAYMENT_LABELS = {
  cash: "نقدي", bank_transfer: "بنك/فيزا", credit: "آجل",
  installments: "أقساط", multi: "متعدد",
};

function fmt(n) {
  return formatNumber(n);
}

function todayStr() {
  return todayCairo();
}

export default function TodayInvoicesButton({ variant = "default" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [userId, setUserId] = useState("");
  const [usersList, setUsersList] = useState([]);
  const handleKeyDown = useFieldNavigation();
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const userSelectRef = useRef(null);
  const submitBtnRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: 200 });
      if (userId) params.set("user_id", userId);
      const r = await api.get(`/api/invoices?${params}`);
      setInvoices(r.data.data || r.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, userId]);

  function handleOpen() {
    setOpen(true);
    load();
    if (!usersList.length) {
      api.get("/api/users").then(r => setUsersList(r.data.data || [])).catch(() => {});
    }
  }

  const activeInvoices = invoices.filter(i => i.status !== "cancelled");
  const total = activeInvoices.reduce((s, i) => s + Number(i.total || 0), 0);

  const buttonClass =
    variant === "compact"
      ? "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:border-emerald-400 hover:text-emerald-700 shadow-sm transition-colors"
      : variant === "pill"
      ? "flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-2sm font-black text-white hover:bg-emerald-700 shadow-md transition-colors"
      : variant === "ghost"
      ? "flex items-center gap-1.5 rounded-xl px-3 py-2 text-2sm font-black text-emerald-700 hover:bg-emerald-50 transition-colors"
      : "flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-2sm font-black text-white hover:bg-primary-600 shadow-sm transition-colors";

  return (
    <>
      <button onClick={handleOpen} className={buttonClass}>
        <Receipt className="h-4 w-4 shrink-0" />
        فواتير اليوم
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-[900px] max-h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-slate-900">فواتير اليوم</h2>
                  <p className="text-[11px] font-bold text-slate-400">
                    {activeInvoices.length} فاتورة نشطة — إجمالي {fmt(total)} ج.م
                    {invoices.length > activeInvoices.length && <span className="text-rose-400 mr-2">({invoices.length - activeInvoices.length} ملغي)</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Date filters */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-white shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-500">من:</span>
                <input
                  ref={dateFromRef}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-2sm font-bold outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-500">إلى:</span>
                <input
                  ref={dateToRef}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: userSelectRef, prevRef: dateFromRef })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-2sm font-bold outline-none focus:border-emerald-400"
                />
              </div>
              {usersList.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-slate-500">المستخدم:</span>
                  <select ref={userSelectRef} value={userId} onChange={(e) => setUserId(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: dateToRef })}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-2sm font-bold outline-none focus:border-emerald-400">
                    <option value="">الكل</option>
                    {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select>
                </div>
              )}
              <button
                ref={submitBtnRef}
                onClick={load}
                onKeyDown={e => handleKeyDown(e, { prevRef: userSelectRef })}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
              </button>

              {/* Summary pills */}
              <div className="flex items-center gap-2 mr-auto">
                <div className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-black text-emerald-700">
                  {invoices.length} فاتورة
                </div>
                <div className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-[11px] font-black text-white font-mono">
                  {fmt(total)} ج.م
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 font-black animate-pulse">
                  جاري التحميل...
                </div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
                  <Receipt className="h-10 w-10" />
                  <span className="font-black">لا توجد فواتير</span>
                </div>
              ) : (
                <table className="w-full text-2sm border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      {["رقم الفاتورة", "العميل", "الأصناف", "الإجمالي", "طريقة الدفع", "الحالة", "تعديل", "المستخدم", "الوقت"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr
                        key={inv.id}
                        onClick={() => { setOpen(false); navigate(`/invoices/${inv.id}`); }}
                        className={`border-b border-slate-50 hover:bg-emerald-50 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                      >
                        <td className="px-4 py-3 font-mono text-2sm font-black text-slate-700">{inv.invoice_no}</td>
                        <td className="px-4 py-3 text-2sm font-bold text-slate-800 max-w-[140px] truncate">
                          {inv.customer_name || "زبون نقدي"}
                        </td>
                        <td className="px-4 py-3 text-center text-2sm font-bold text-slate-600">
                          {inv.items_count || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-black text-emerald-700">
                          {fmt(inv.total)} ج.م
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600">
                          {PAYMENT_LABELS[inv.payment_type] || inv.payment_type || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : inv.status === "partial"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : inv.status === "cancelled"
                                ? "bg-slate-100 text-slate-500 border-slate-200 line-through"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {inv.status === "paid" ? "مدفوع" : inv.status === "partial" ? "جزئي" : inv.status === "cancelled" ? "ملغي" : "آجل"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {inv.amended_by && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap" title={`عُدِّلت → ${inv.amended_by_no || inv.amended_by}`}>
                                مُعدَّلة ← {inv.amended_by_no || inv.amended_by}
                              </span>
                            )}
                            {inv.amendment_of && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap" title={`تعديل على: ${inv.amendment_of_no || inv.amendment_of}`}>
                                تعديل ↑ {inv.amendment_of_no || inv.amendment_of}
                              </span>
                            )}
                            {!inv.amended_by && !inv.amendment_of && <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                          {inv.created_by_username || "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-400 whitespace-nowrap font-mono">
                          {inv.created_at
                            ? new Date(inv.created_at).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
