import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, ChevronRight, MessageCircle, Printer, RefreshCw, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import MultiPaymentInput from "../payment/MultiPaymentInput";
import PrintPreviewModal from "../print/PrintPreviewModal";
import AjalStatementTemplate from "../print/templates/AjalStatementTemplate";
import AjalScheduleTemplate from "../print/templates/AjalScheduleTemplate";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("ar-EG") : "-");

const STATUS = {
  open: { label: "مفتوح", cls: "bg-blue-100 text-blue-700" },
  partial: { label: "جزئي", cls: "bg-amber-100 text-amber-700" },
  overdue: { label: "متأخر", cls: "bg-rose-100 text-rose-700" },
  paid: { label: "مسدد", cls: "bg-emerald-100 text-emerald-700" },
};

function normalizedDebt(debt, party) {
  return {
    ...debt,
    customer_name: debt.customer_name || debt.party_name || debt.supplier_name || party?.name,
    customer_phone: debt.customer_phone || debt.party_phone || debt.supplier_phone || party?.phone,
  };
}

export default function PartyDebtPanel({ party, partyType = "customer", accent = "amber", onChanged }) {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "all", search: "" });
  const [selected, setSelected] = useState(null);
  const [activePanel, setActivePanel] = useState("pay");
  const [payAmount, setPayAmount] = useState("");
  const [payments, setPayments] = useState([]);
  const [notes, setNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [schedForm, setSchedForm] = useState({ installments: 3, frequency: "monthly", start_date: "" });
  const [scheduling, setScheduling] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPayments, setBulkPayments] = useState([]);
  const [printType, setPrintType] = useState(null);

  const isSupplier = partyType === "supplier";
  const theme = accent === "orange"
    ? { main: "bg-orange-600 hover:bg-orange-700", text: "text-orange-700", border: "border-orange-200", soft: "bg-orange-50" }
    : { main: "bg-blue-600 hover:bg-blue-700", text: "text-blue-700", border: "border-blue-200", soft: "bg-blue-50" };

  const loadDebts = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const idKey = isSupplier ? "supplier_id" : "customer_id";
      const r = await api.get(`/api/ajal-debts?party_type=${partyType}&${idKey}=${party.id}&status=${filters.status}&search=${encodeURIComponent(filters.search)}`);
      setDebts((r.data.data || []).map((debt) => normalizedDebt(debt, party)));
    } catch {
      setDebts([]);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, isSupplier, party, partyType]);

  useEffect(() => { loadDebts(); }, [loadDebts]);

  async function loadDetail(id) {
    try {
      const r = await api.get(`/api/ajal-debts/${id}`);
      const detail = normalizedDebt(r.data.data, party);
      setSelected(detail);
      setPayAmount(detail.remaining > 0 ? String(detail.remaining) : "");
      setPayments([]);
      setNotes("");
    } catch {
      toast.error("تعذر تحميل تفاصيل الدين");
    }
  }

  const stats = useMemo(() => {
    return debts.reduce((acc, debt) => {
      const remaining = Number(debt.remaining ?? (debt.original_amount - debt.paid_amount) ?? 0);
      if (debt.status !== "paid") {
        acc.open += 1;
        acc.total += remaining;
      }
      if (debt.status === "overdue") {
        acc.overdue += 1;
        acc.overdueAmount += remaining;
      }
      if (debt.due_date === new Date().toISOString().slice(0, 10) && debt.status !== "paid") acc.dueToday += 1;
      return acc;
    }, { total: 0, open: 0, overdue: 0, overdueAmount: 0, dueToday: 0 });
  }, [debts]);

  async function handlePay() {
    if (!selected) return;
    const totalPaid = payments.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    if (totalPaid <= 0) return toast.error("أدخل مبلغ الدفع");
    setPaying(true);
    try {
      await api.post(`/api/ajal-debts/${selected.id}/pay`, {
        amount: totalPaid,
        payments,
        notes,
      });
      toast.success(isSupplier ? "تم سداد دفعة للمورد" : "تم تحصيل دفعة من العميل");
      await loadDetail(selected.id);
      await loadDebts();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في السداد");
    } finally {
      setPaying(false);
    }
  }

  async function handleSchedule() {
    if (!selected) return;
    setScheduling(true);
    try {
      await api.post(`/api/ajal-debts/${selected.id}/schedule`, {
        installments: Number(schedForm.installments),
        frequency: schedForm.frequency,
        start_date: schedForm.start_date || undefined,
      });
      toast.success("تم إنشاء جدول الأقساط");
      await loadDetail(selected.id);
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في الجدولة");
    } finally {
      setScheduling(false);
    }
  }

  async function handleBulkPay() {
    const selectedDebts = debts.filter((debt) => bulkSelected.includes(debt.id));
    const totalRemaining = selectedDebts.reduce((sum, debt) => sum + Number(debt.remaining || 0), 0);
    const totalPaid = bulkPayments.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    if (!selectedDebts.length || totalPaid <= 0) return toast.error("أدخل مبلغ الدفع");
    if (totalPaid > totalRemaining) return toast.error("المبلغ أكبر من المتبقي");

    setPaying(true);
    try {
      let remainingPayment = totalPaid;
      for (const debt of selectedDebts) {
        if (remainingPayment <= 0) break;
        const amountForDebt = Math.min(remainingPayment, Number(debt.remaining || 0));
        const scaledPayments = bulkPayments
          .filter((line) => Number(line.amount || 0) > 0)
          .map((line) => ({
            ...line,
            amount: Number(((Number(line.amount || 0) / totalPaid) * amountForDebt).toFixed(2)),
          }))
          .filter((line) => line.amount > 0);
        await api.post(`/api/ajal-debts/${debt.id}/pay`, {
          amount: amountForDebt,
          payments: scaledPayments,
          notes: "تحصيل متعدد",
        });
        remainingPayment -= amountForDebt;
      }
      toast.success("تم تسجيل الدفع المحدد");
      setBulkOpen(false);
      setBulkMode(false);
      setBulkSelected([]);
      setBulkPayments([]);
      await loadDebts();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في الدفع");
    } finally {
      setPaying(false);
    }
  }

  function handleWhatsAppReminder(debt) {
    const name = debt.customer_name || party?.name || "";
    const msg = isSupplier
      ? `السلام عليكم ${name}،\nنذكركم بموعد سداد مستحق بقيمة ${fmt(debt.remaining)} ج.م\nتاريخ الاستحقاق: ${fmtDate(debt.due_date)}`
      : `السلام عليكم ${name}،\nنذكركم بموعد سداد قسط بمبلغ ${fmt(debt.remaining)} ج.م\nتاريخ الاستحقاق: ${fmtDate(debt.due_date)}`;
    const phone = debt.customer_phone?.replace(/\D/g, "");
    if (phone) {
      window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      return;
    }
    navigator.clipboard?.writeText(msg);
    toast.success("تم نسخ الرسالة");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-slate-400">إجمالي المفتوح</div>
          <div className="mt-1 text-[20px] font-black font-mono text-slate-900">{fmt(stats.total)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-slate-400">عدد الديون</div>
          <div className={`mt-1 text-[20px] font-black font-mono ${theme.text}`}>{stats.open}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-slate-400">مستحق اليوم</div>
          <div className="mt-1 text-[20px] font-black font-mono text-slate-700">{stats.dueToday}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-black text-rose-400">متأخر</div>
          <div className="mt-1 text-[20px] font-black font-mono text-rose-700">{stats.overdue}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-[12px] font-bold outline-none focus:border-slate-400"
            placeholder="بحث برقم المستند..."
          />
        </div>
        {["all", "open", "partial", "overdue", "paid"].map((status) => (
          <button
            key={status}
            onClick={() => setFilters((f) => ({ ...f, status }))}
            className={`rounded-xl px-3 py-2 text-[11px] font-black ${filters.status === status ? `${theme.main} text-white` : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {status === "all" ? "الكل" : STATUS[status]?.label}
          </button>
        ))}
        <button
          onClick={() => { setBulkMode((v) => !v); setBulkSelected([]); }}
          className={`rounded-xl px-3 py-2 text-[11px] font-black ${bulkMode ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
        >
          {bulkMode ? "إلغاء التحديد" : "دفع متعدد"}
        </button>
        {bulkSelected.length > 0 && (
          <button onClick={() => setBulkOpen(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white">
            دفع المحدد ({bulkSelected.length})
          </button>
        )}
        <button onClick={loadDebts} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-[13px] font-black text-slate-400">جاري التحميل...</div>
          ) : debts.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-300">
              <Calendar className="h-9 w-9" />
              <span className="text-[13px] font-black">لا توجد ديون أجل لهذا الحساب</span>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>{["", "المستند", "الأصل", "المدفوع", "المتبقي", "الاستحقاق", "الحالة", "إجراء"].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-[11px] font-black text-slate-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {debts.map((debt) => (
                  <tr key={debt.id} onClick={() => loadDetail(debt.id)} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${debt.status === "overdue" ? "bg-rose-50/50" : ""}`}>
                    <td className="px-4 py-3">
                      {bulkMode && (
                        <input
                          type="checkbox"
                          checked={bulkSelected.includes(debt.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            setBulkSelected((ids) => ids.includes(debt.id) ? ids.filter((id) => id !== debt.id) : [...ids, debt.id]);
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{debt.invoice_no || `AJAL-${debt.id}`}</td>
                    <td className="px-4 py-3 font-black font-mono">{fmt(debt.original_amount)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-700">{fmt(debt.paid_amount)}</td>
                    <td className="px-4 py-3 font-black font-mono text-rose-700">{fmt(debt.remaining)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(debt.due_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS[debt.status]?.cls || "bg-slate-100 text-slate-600"}`}>
                        {STATUS[debt.status]?.label || debt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-black ${theme.text}`}>
                        فتح <ChevronRight className="h-3 w-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-center text-slate-300">
              <AlertCircle className="h-10 w-10" />
              <span className="text-[13px] font-black">اختر دينا لعرض الدفع والجدولة</span>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className={`flex items-center justify-between border-b ${theme.border} ${theme.soft} px-4 py-3`}>
                <div>
                  <div className="text-[13px] font-black text-slate-900">{selected.invoice_no || `AJAL-${selected.id}`}</div>
                  <div className="text-[11px] font-bold text-slate-500">{fmt(selected.remaining)} ج.م متبقي</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleWhatsAppReminder(selected)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPrintType("statement")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-900">
                    <Printer className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPrintType("schedule")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700">
                    <Calendar className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/70 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 p-3">
                {[["الأصل", selected.original_amount], ["المدفوع", selected.paid_amount], ["المتبقي", selected.remaining]].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white p-2 text-center">
                    <div className="text-[10px] font-black text-slate-400">{label}</div>
                    <div className="text-[13px] font-black font-mono text-slate-800">{fmt(value)}</div>
                  </div>
                ))}
              </div>

              <div className="flex border-b border-slate-100">
                {[["pay", "دفع"], ["schedule", "أقساط"], ["history", "السجل"]].map(([id, label]) => (
                  <button key={id} onClick={() => setActivePanel(id)} className={`flex-1 py-2.5 text-[12px] font-black ${activePanel === id ? `${theme.text} border-b-2 border-current` : "text-slate-500 hover:text-slate-800"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {activePanel === "pay" && (
                  <div className="space-y-4">
                    <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-10 w-full rounded-xl border border-slate-300 px-4 text-center text-[14px] font-black outline-none focus:border-slate-500" placeholder={`المتبقي: ${fmt(selected.remaining)}`} />
                    <MultiPaymentInput totalAmount={Number(payAmount) || 0} value={payments} onChange={setPayments} allowPartial={true} />
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 w-full rounded-xl border border-slate-300 px-4 text-[12px] outline-none focus:border-slate-500" placeholder="ملاحظات" />
                    <button onClick={handlePay} disabled={!payAmount || paying} className={`w-full rounded-xl py-3 text-[13px] font-black text-white disabled:opacity-40 ${theme.main}`}>
                      {paying ? "جاري التسجيل..." : isSupplier ? "تسجيل سداد للمورد" : "تسجيل تحصيل من العميل"}
                    </button>
                  </div>
                )}

                {activePanel === "schedule" && (
                  <div className="space-y-4">
                    <input type="number" min="2" max="60" value={schedForm.installments} onChange={(e) => setSchedForm((f) => ({ ...f, installments: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-300 px-4 text-center text-[14px] font-black outline-none focus:border-slate-500" />
                    <select value={schedForm.frequency} onChange={(e) => setSchedForm((f) => ({ ...f, frequency: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-4 text-[12px] font-bold outline-none focus:border-slate-500">
                      <option value="weekly">أسبوعي</option>
                      <option value="biweekly">كل أسبوعين</option>
                      <option value="monthly">شهري</option>
                    </select>
                    <input type="date" value={schedForm.start_date} onChange={(e) => setSchedForm((f) => ({ ...f, start_date: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-300 px-4 text-[12px] outline-none focus:border-slate-500" />
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="text-[11px] font-bold text-amber-700">قسط تقريبي</div>
                      <div className="text-[18px] font-black font-mono text-amber-800">{fmt(Number(selected.remaining || 0) / Number(schedForm.installments || 1))}</div>
                    </div>
                    <button onClick={handleSchedule} disabled={scheduling} className="w-full rounded-xl bg-slate-800 py-3 text-[13px] font-black text-white hover:bg-slate-900 disabled:opacity-40">
                      {scheduling ? "جاري الجدولة..." : "إنشاء جدول الأقساط"}
                    </button>
                    {selected.schedule?.length > 0 && (
                      <div className="space-y-1.5">
                        {selected.schedule.map((row) => (
                          <div key={row.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[11px] ${row.status === "paid" ? "bg-emerald-50" : "bg-slate-50"}`}>
                            <span className="font-black">قسط {row.installment_no}</span>
                            <span>{fmtDate(row.due_date)}</span>
                            <span className="font-black font-mono">{fmt(row.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activePanel === "history" && (
                  <div className="space-y-2">
                    {(!selected.payments || selected.payments.length === 0) ? (
                      <div className="py-8 text-center text-[12px] font-black text-slate-400">لا توجد مدفوعات مسجلة</div>
                    ) : selected.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                        <div>
                          <div className="text-[12px] font-black text-emerald-800">{fmt(payment.amount)} ج.م</div>
                          <div className="text-[10px] font-bold text-emerald-600">{payment.method_name} - {fmtDate(payment.payment_date)}</div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[460px] rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-slate-900">دفع متعدد</h2>
              <button onClick={() => setBulkOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <div className="text-[10px] font-black text-slate-400">إجمالي المحدد</div>
              <div className="text-[20px] font-black font-mono text-slate-900">
                {fmt(debts.filter((debt) => bulkSelected.includes(debt.id)).reduce((sum, debt) => sum + Number(debt.remaining || 0), 0))} ج.م
              </div>
            </div>
            <MultiPaymentInput
              totalAmount={debts.filter((debt) => bulkSelected.includes(debt.id)).reduce((sum, debt) => sum + Number(debt.remaining || 0), 0)}
              value={bulkPayments}
              onChange={setBulkPayments}
              allowPartial={true}
            />
            <button onClick={handleBulkPay} disabled={paying || !bulkPayments.length} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-40">
              {paying ? "جاري التسجيل..." : "تأكيد الدفع"}
            </button>
          </div>
        </div>
      )}

      {selected && printType && (
        <PrintPreviewModal
          open={!!printType}
          onClose={() => setPrintType(null)}
          docType={printType === "schedule" ? "ajal_schedule" : "ajal_statement"}
          renderContent={(settings) => printType === "schedule"
            ? <AjalScheduleTemplate debt={selected} settings={settings} />
            : <AjalStatementTemplate debt={selected} settings={settings} />
          }
        />
      )}
    </div>
  );
}
