import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, ChevronRight, Edit3, Printer, RefreshCw, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import PrintPreviewModal from "../print/PrintPreviewModal";
import AjalStatementTemplate from "../print/templates/AjalStatementTemplate";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("ar-EG-u-nu-latn") : "-");

export default function InstallmentsTab({ party, partyType = "customer", accent = "amber", onChanged }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [payMethod, setPayMethod] = useState("");
  const [paying, setPaying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ due_date: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const [printType, setPrintType] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const isSupplier = partyType === "supplier";
  const idKey = isSupplier ? "supplier_id" : "customer_id";
  const theme = accent === "orange"
    ? { main: "bg-orange-600 hover:bg-orange-700", text: "text-orange-700", border: "border-orange-200", soft: "bg-orange-50" }
    : { main: "bg-blue-600 hover:bg-blue-700", text: "text-blue-700", border: "border-blue-200", soft: "bg-blue-50" };

  const loadSchedules = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/ajal-schedules/by-party/${partyType}/${party.id}`);
      setSchedules(r.data.data || []);
    } catch { setSchedules([]); }
    finally { setLoading(false); }
  }, [party, partyType]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);
  useEffect(() => {
    api.get("/api/payment-methods").then(r => { const all = r.data.data || []; setPaymentMethods(all.filter(m => m.id !== 2)); }).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    return schedules.reduce((acc, s) => {
      acc.total += Number(s.amount || 0);
      if (s.status === "paid") acc.paid += Number(s.amount || 0);
      else {
        acc.remaining += Number(s.amount || 0);
        if (s.due_date < today) acc.overdue += 1;
      }
      return acc;
    }, { total: 0, paid: 0, remaining: 0, overdue: 0 });
  }, [schedules, today]);

  const filtered = useMemo(() => {
    if (!search) return schedules;
    const q = search.toLowerCase();
    return schedules.filter(s => (s.invoice_no || "").toLowerCase().includes(q));
  }, [schedules, search]);

  async function handleSelect(schedule) {
    setSelected(schedule);
    setEditMode(false);
    setPayMethod("");
    setEditForm({ due_date: schedule.due_date || "", amount: String(schedule.amount || "") });
  }

  async function handlePay() {
    if (!selected) return;
    setPaying(true);
    try {
      await api.post(`/api/ajal-schedules/${selected.id}/pay`, {
        payment_method_id: Number(payMethod) || 1,
        payment_date: today,
      });
      toast.success("تم تسديد القسط");
      setSelected(null);
      await loadSchedules();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل تسديد القسط");
    } finally { setPaying(false); }
  }

  async function handleEdit() {
    if (!selected) return;
    setSaving(true);
    try {
      const body = {};
      if (editForm.due_date) body.due_date = editForm.due_date;
      if (editForm.amount && Number(editForm.amount) > 0) body.amount = Number(editForm.amount);
      if (Object.keys(body).length === 0) { toast.error("لا توجد تغييرات"); setSaving(false); return; }
      const r = await api.patch(`/api/ajal-schedules/${selected.id}`, body);
      setSelected(r.data.data);
      setEditMode(false);
      await loadSchedules();
      toast.success("تم تحديث القسط");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل التحديث");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-slate-400">إجمالي الأقساط</div>
          <div className="mt-1 text-[20px] font-black font-mono text-slate-900">{fmt(stats.total)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-slate-400">المسدد</div>
          <div className="mt-1 text-[20px] font-black font-mono text-emerald-700">{fmt(stats.paid)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-slate-400">المتبقي</div>
          <div className="mt-1 text-[20px] font-black font-mono text-amber-700">{fmt(stats.remaining)}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-rose-400">متأخر</div>
          <div className="mt-1 text-[20px] font-black font-mono text-rose-700">{stats.overdue}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-[12px] font-bold outline-none focus:border-slate-400"
            placeholder="بحث برقم الفاتورة..." />
        </div>
        <button onClick={loadSchedules} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* Schedule list */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-[13px] font-black text-slate-400">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <span className="text-[14px] font-black text-emerald-600">{search ? "لا توجد نتائج" : "لا توجد أقساط مسجلة"}</span>
              <span className="text-[12px] font-bold text-slate-400">{search ? "حاول بحثاً آخر" : "لم يتم إنشاء جدول أقساط بعد"}</span>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>{["الفاتورة", "القسط", "تاريخ الاستحقاق", "المبلغ", "الحالة", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-[11px] font-black text-slate-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isOverdue = s.status !== "paid" && s.due_date < today;
                  const statusLabel = s.status === "paid" ? "مدفوع" : isOverdue ? "متأخر" : "معلق";
                  const statusCls = s.status === "paid" ? "bg-emerald-100 text-emerald-700" : isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700";
                  const rowCls = s.status === "paid" ? "" : isOverdue ? "bg-rose-50/50" : "";
                  return (
                    <tr key={s.id} onClick={() => handleSelect(s)}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${rowCls} ${selected?.id === s.id ? "bg-slate-100" : ""}`}>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{s.invoice_no || `AJAL-${s.debt_id}`}</td>
                      <td className="px-4 py-3 font-black">{s.installment_no}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(s.due_date)}</td>
                      <td className="px-4 py-3 font-black font-mono text-slate-800">{fmt(s.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusCls}`}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.status !== "paid" && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-black ${theme.text}`}>
                            دفع <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        <div className="min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-center text-slate-300">
              <AlertCircle className="h-10 w-10" />
              <span className="text-[13px] font-black">اختر قسطاً للعرض</span>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className={`flex items-center justify-between border-b ${theme.border} ${theme.soft} px-4 py-3`}>
                <div>
                  <div className="text-[13px] font-black text-slate-900">{selected.invoice_no || `AJAL-${selected.debt_id}`}</div>
                  <div className="text-[11px] font-bold text-slate-500">القسط {selected.installment_no}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPrintType("statement")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-900">
                    <Printer className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setEditMode(!editMode); if (!editMode) setEditForm({ due_date: selected.due_date || "", amount: String(selected.amount || "") }); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/70 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="border-b border-slate-100 bg-white p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2 text-center">
                    <div className="text-[10px] font-black text-slate-400">مبلغ القسط</div>
                    <div className="text-[15px] font-black font-mono text-slate-800">{fmt(selected.amount)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2 text-center">
                    <div className="text-[10px] font-black text-slate-400">تاريخ الاستحقاق</div>
                    <div className="text-[15px] font-black font-mono text-slate-800">{fmtDate(selected.due_date)}</div>
                  </div>
                </div>

                {/* Invoice preview */}
                {selected.invoice_no && (
                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                    <div className="text-[10px] font-black text-slate-400 mb-1">الفاتورة</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-black text-slate-900">{selected.invoice_no}</span>
                      <span className="text-[12px] font-black font-mono text-slate-700">
                        {fmt(selected.invoice_total)} ج.م
                      </span>
                    </div>
                    {selected.payment_splits && (
                      <div className="text-[9px] text-slate-400 mt-0.5">{selected.payment_splits.replace(/\|\|\|/g, " | ")}</div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(selected.invoice_date)}</div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Pay section */}
                {selected.status !== "paid" && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400">تسديد القسط</div>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-4 text-[12px] font-bold outline-none focus:border-slate-500">
                      {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <button onClick={handlePay} disabled={paying}
                      className={`w-full rounded-xl py-2.5 text-[12px] font-black text-white disabled:opacity-40 ${theme.main}`}>
                      {paying ? "جاري التسديد..." : "تسديد القسط"}
                    </button>
                  </div>
                )}

                {/* Edit section */}
                {editMode && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <div className="text-[10px] font-black text-slate-400">تعديل القسط</div>
                    <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-300 px-4 text-[12px] outline-none focus:border-slate-500" />
                    <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-300 px-4 text-[14px] font-black outline-none focus:border-slate-500" />
                    <button onClick={handleEdit} disabled={saving}
                      className="w-full rounded-xl bg-slate-800 py-2.5 text-[12px] font-black text-white hover:bg-slate-900 disabled:opacity-40">
                      {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                    </button>
                  </div>
                )}

                {/* Debt info */}
                <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>الأصل:</span><span className="font-mono font-black text-slate-700">{fmt(selected.original_amount)}</span></div>
                  <div className="flex justify-between"><span>المدفوع:</span><span className="font-mono font-black text-emerald-700">{fmt(selected.paid_amount)}</span></div>
                  <div className="flex justify-between"><span>المتبقي:</span><span className="font-mono font-black text-rose-700">{fmt(selected.original_amount - selected.paid_amount)}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print modal */}
      {selected && printType && (
        <PrintPreviewModal
          open={!!printType}
          onClose={() => setPrintType(null)}
          docType="ajal_statement"
          renderContent={(settings) => (
            <AjalStatementTemplate debt={selected} settings={settings} />
          )}
        />
      )}
    </div>
  );
}
