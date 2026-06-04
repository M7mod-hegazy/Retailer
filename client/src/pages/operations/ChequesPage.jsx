import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { 
  Plus, 
  Receipt, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Clock, 
  MoreVertical,
  Banknote,
  Search,
  Filter,
  ArrowRightLeft,
  DollarSign,
  X,
  Printer
} from "lucide-react";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ChequeRegisterTemplate from "../../components/print/templates/ChequeRegisterTemplate";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const configs = {
    pending: { label: "قيد الانتظار", class: "bg-amber-50 text-amber-600 border-amber-100" },
    deposited: { label: "تم الإيداع", class: "bg-blue-50 text-blue-600 border-blue-100" },
    cleared: { label: "تم التحصيل", class: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    bounced: { label: "مرتد / مرفوض", class: "bg-rose-50 text-rose-600 border-rose-100" },
    replaced: { label: "مستبدل", class: "bg-violet-50 text-violet-600 border-violet-100" },
  };
  const config = configs[status] || { label: status, class: "bg-slate-50 text-slate-400 border-slate-100" };
  return (
    <span className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest shadow-sm ${config.class}`}>
      {config.label}
    </span>
  );
}

export default function ChequesPage() {
  usePageTour('cheques');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("cards");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ cheque_no: "", bank_name: "", amount: "", due_date: "", drawer_name: "", notes: "", type: "received", replaces_id: null });
  const [adding, setAdding] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState([]);
  const [printOpen, setPrintOpen] = useState(false);

  async function loadRows() {
    setLoading(true);
    try {
      const response = await api.get("/api/cheques");
      setRows(response.data.data || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/api/cheques/${id}/status`, { status });
      toast.success(`تم تحديث حالة الشيك إلى: ${status === 'cleared' ? 'تم التحصيل' : status === 'bounced' ? 'مرتد' : 'مودع'}`);
      await loadRows();
    } catch (e) { toast.error("فشل تحديث الحالة"); }
  }

  async function handleAddCheque() {
    setAdding(true);
    try {
      await api.post("/api/cheques", {
        cheque_no: addForm.cheque_no,
        bank_name: addForm.bank_name,
        amount: Number(addForm.amount),
        due_date: addForm.due_date,
        drawer_name: addForm.drawer_name,
        notes: addForm.notes,
        type: addForm.type,
        status: "pending",
        replaces_id: addForm.replaces_id || null,
      });
      toast.success("تم إضافة الشيك");
      setAddOpen(false);
      setAddForm({ cheque_no: "", bank_name: "", amount: "", due_date: "", drawer_name: "", notes: "", type: "received", replaces_id: null });
      loadRows();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ في الحفظ"); }
    finally { setAdding(false); }
  }

  async function handleBatchUpdate(newStatus) {
    try {
      await Promise.all(batchSelected.map((id) => api.patch(`/api/cheques/${id}/status`, { status: newStatus })));
      toast.success(`تم تحديث ${batchSelected.length} شيك`);
      setBatchSelected([]);
      setBatchMode(false);
      loadRows();
    } catch (e) { toast.error("خطأ في التحديث"); }
  }

  function openReplacement(row) {
    setAddForm({
      cheque_no: "",
      bank_name: row.bank_name || "",
      amount: row.amount || "",
      due_date: "",
      drawer_name: row.drawer_name || "",
      notes: row.notes || "",
      type: row.type || "received",
      replaces_id: row.id,
    });
    setAddOpen(true);
  }

  const stats = useMemo(() => {
    const totalValue = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const pendingCount = rows.filter(r => r.status === 'pending').length;
    const bouncedValue = rows.filter(r => r.status === 'bounced').reduce((s, r) => s + Number(r.amount || 0), 0);
    return {
       total: formatMoney(totalValue),
       pending: pendingCount,
       bounced: formatMoney(bouncedValue)
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => 
      (r.cheque_no || "").includes(query) || 
      (r.bank_name || "").includes(query)
    );
  }, [rows, query]);

  const calendarData = useMemo(() => {
    const grouped = {};
    filteredRows.filter((r) => r.status === "pending").forEach((r) => {
      const day = r.due_date?.split("T")[0];
      if (!day) return;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(r);
    });
    return grouped;
  }, [filteredRows]);

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-800">إدارة أوراق القبض (الشيكات)</h1>
          <p className="text-sm font-bold text-slate-400">متابعة حصيلة الشيكات، تواريخ الاستحقاق، وحالات التحصيل والإرجاع البنكي</p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate page="cheques" action="print">
          <button onClick={() => setPrintOpen(true)} className="flex items-center gap-2 rounded-sm bg-white border border-slate-200 px-4 py-2.5 text-2sm font-black text-slate-700 transition-all hover:bg-slate-50">
            <Printer className="h-4 w-4" /> طباعة السجل
          </button>
          </PermissionGate>
          <PermissionGate page="cheques" action="edit">
          <button data-help="toggle-button" onClick={() => { setBatchMode(!batchMode); setBatchSelected([]); }} className={`flex items-center gap-2 rounded-sm px-4 py-2.5 text-2sm font-black transition-all ${batchMode ? "bg-violet-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
            {batchMode ? "إلغاء التحديد" : "تحديث متعدد"}
          </button>
          </PermissionGate>
          <PermissionGate page="cheques" action="add">
          <button data-help="add-button" onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-sm bg-slate-800 px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95">
            <Plus className="h-4 w-4" /> إضافة شيك يدوي
          </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-blue-500">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <ArrowUpRight className="h-3.5 w-3.5" /> إجمالي المحفظة
            </span>
            <div className="mt-1 flex items-baseline gap-1">
               <span className="text-[20px] font-black text-slate-800">{stats.total}</span>
               <span className="text-[11px] font-bold text-slate-400">ج.م</span>
            </div>
         </div>
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-amber-500">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <Clock className="h-3.5 w-3.5" /> قيد انتظار التحصيل
            </span>
            <span className="mt-1 text-[20px] font-black text-slate-800">{stats.pending} شيكات</span>
         </div>
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-rose-600 font-black">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <AlertCircle className="h-3.5 w-3.5" /> قيمة الشيكات المرتدة
            </span>
            <div className="mt-1 flex items-baseline gap-1 text-rose-600">
               <span className="text-[20px]">{stats.bounced}</span>
               <span className="text-[11px] font-bold">ج.م</span>
            </div>
         </div>
      </div>

      <div data-help="main-table" className="flex flex-col rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
           <div data-help="search-bar" className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="بحث برقم الشيك أو البنك..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-80 rounded-sm border border-slate-200 bg-white py-2 pl-3 pr-10 text-2sm font-bold outline-none focus:border-slate-800"
              />
           </div>
           <div className="flex items-center gap-4">
              <button onClick={() => setView(view === "cards" ? "calendar" : "cards")} className="flex items-center gap-2 text-2sm font-black text-violet-600 uppercase hover:text-violet-800">
                 <Calendar className="h-3.5 w-3.5" /> {view === "cards" ? "عرض التقويم" : "عرض البطاقات"}
              </button>
              {batchMode && batchSelected.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleBatchUpdate("cleared")} className="rounded-sm bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white">تحصيل</button>
                  <button onClick={() => handleBatchUpdate("deposited")} className="rounded-sm bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white">إيداع</button>
                  <button onClick={() => handleBatchUpdate("bounced")} className="rounded-sm bg-rose-600 px-3 py-1.5 text-[11px] font-black text-white">مرتد</button>
                </div>
              )}
              <button data-help="due-filter" className="flex items-center gap-2 text-2sm font-black text-slate-500 uppercase hover:text-slate-800">
                 <Filter className="h-3.5 w-3.5" /> تصفية النتائج
              </button>
           </div>
        </div>

        {view === "calendar" ? (
          <div className="space-y-2 p-6">
            {Object.entries(calendarData).sort(([a], [b]) => a.localeCompare(b)).map(([date, cheques]) => (
              <div key={date} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-slate-800">{new Date(date).toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                  <div className="text-[11px] text-slate-400">{cheques.length} شيك</div>
                </div>
                <div className="text-[16px] font-black text-violet-700">{formatMoney(cheques.reduce((s, c) => s + Number(c.amount || 0), 0))} ج.م</div>
              </div>
            ))}
            {Object.keys(calendarData).length === 0 && <div className="py-16 text-center text-2sm font-black text-slate-400">لا توجد شيكات معلقة في التقويم</div>}
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
             <div className="col-span-full py-20 text-center font-black text-slate-400 animate-pulse uppercase tracking-widest">تحميل محفظة الشيكات...</div>
          ) : filteredRows.length === 0 ? (
             <div className="col-span-full py-20 text-center font-bold text-slate-400">لا توجد أوراق قبض مسجلة حالياً</div>
          ) : (
            filteredRows.map(row => (
              <div key={row.id} className="group relative rounded-md border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-800 hover:shadow-lg">
                <div className="flex items-start justify-between">
                   <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                         {batchMode && (
                           <input
                             type="checkbox"
                             checked={batchSelected.includes(row.id)}
                             onChange={() => setBatchSelected((ids) => ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id])}
                           />
                         )}
                         <Receipt className="h-4 w-4 text-slate-400" />
                         <span className="font-mono text-[11px] font-black text-slate-400 uppercase tracking-tighter">CHK-{String(row.id).padStart(5, '0')}</span>
                      </div>
                      <h3 className="mt-2 text-[20px] font-black text-slate-800">{formatMoney(row.amount)} <span className="text-2sm text-slate-400">ج.م</span></h3>
                   </div>
                   <StatusBadge status={row.status} />
                </div>

                <div className="mt-6 space-y-3">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest"><CreditCard className="h-3.5 w-3.5" /> بنك الشيك</span>
                      <span className="text-2sm font-black text-slate-700">{row.bank_name || "غير محدد"}</span>
                   </div>
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest"><Calendar className="h-3.5 w-3.5" /> تاريخ الاستحقاق</span>
                      <span className="text-2sm font-black text-slate-700">{new Date(row.due_date).toLocaleDateString("ar-EG-u-nu-latn")}</span>
                   </div>
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest"><Search className="h-3.5 w-3.5" /> رقم الشيك</span>
                      <span className="font-mono text-2sm font-black text-slate-800">{row.cheque_no}</span>
                   </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                   <PermissionGate page="cheques" action="edit">
                   <button
                    onClick={() => updateStatus(row.id, 'cleared')}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-sm bg-emerald-50 py-3 text-[11px] font-black text-emerald-700 transition-all hover:bg-emerald-100"
                   >
                     <CheckCircle2 className="h-4 w-4" /> تحصيل
                   </button>
                   </PermissionGate>
                   <PermissionGate page="cheques" action="edit">
                   <button
                    onClick={() => updateStatus(row.id, 'deposited')}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-sm bg-blue-50 py-3 text-[11px] font-black text-blue-700 transition-all hover:bg-blue-100"
                   >
                     <ArrowRightLeft className="h-4 w-4" /> إيداع
                   </button>
                   </PermissionGate>
                   <PermissionGate page="cheques" action="edit">
                   <button
                    onClick={() => updateStatus(row.id, 'bounced')}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-sm bg-rose-50 py-3 text-[11px] font-black text-rose-700 transition-all hover:bg-rose-100"
                   >
                     <AlertCircle className="h-4 w-4" /> مرتد
                   </button>
                   </PermissionGate>
                </div>
                {row.status === "bounced" && (
                  <PermissionGate page="cheques" action="add">
                  <button onClick={() => openReplacement(row)}
                    className="mt-3 w-full rounded-sm bg-violet-50 py-2 text-[11px] font-black text-violet-700 hover:bg-violet-100">
                    استبدال بشيك جديد
                  </button>
                  </PermissionGate>
                )}
                
                <button className="absolute left-2 bottom-2 p-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-800">
                   <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
        )}
      </div>
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[480px] rounded-2xl bg-white shadow-2xl p-6" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-black text-slate-900">{addForm.replaces_id ? "استبدال شيك" : "إضافة شيك جديد"}</h2>
              <button onClick={() => setAddOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">نوع الشيك</label>
                <div className="flex gap-2">
                  {[["received", "مستلم (من عميل)"], ["issued", "صادر (لمورد)"]].map(([v, l]) => (
                    <button key={v} onClick={() => setAddForm(f => ({ ...f, type: v }))}
                      className={`flex-1 py-2 rounded-xl text-2sm font-black border ${addForm.type === v ? "bg-violet-600 text-white border-violet-600" : "border-slate-200 text-slate-600"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">رقم الشيك *</label>
                <input value={addForm.cheque_no} onChange={e => setAddForm(f => ({ ...f, cheque_no: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm font-black outline-none focus:border-violet-500" dir="ltr" /></div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">اسم البنك *</label>
                <input value={addForm.bank_name} onChange={e => setAddForm(f => ({ ...f, bank_name: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-2sm outline-none focus:border-violet-500" /></div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">المبلغ *</label>
                <input type="number" min="0" step="0.01" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm font-black outline-none focus:border-violet-500" dir="ltr" /></div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">تاريخ الاستحقاق *</label>
                <input type="date" value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-2sm outline-none focus:border-violet-500" /></div>
              <div className="col-span-2"><label className="text-[11px] font-black text-slate-600 block mb-1.5">اسم الساحب / المستفيد</label>
                <input value={addForm.drawer_name} onChange={e => setAddForm(f => ({ ...f, drawer_name: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-2sm outline-none" /></div>
              <div className="col-span-2"><label className="text-[11px] font-black text-slate-600 block mb-1.5">ملاحظات</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-2sm outline-none" /></div>
            </div>
            <PermissionGate page="cheques" action="add">
            <button onClick={handleAddCheque} disabled={!addForm.cheque_no || !addForm.bank_name || !addForm.amount || !addForm.due_date || adding}
              className="w-full mt-4 rounded-xl bg-violet-600 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-40">
              {adding ? "جاري الحفظ..." : "حفظ الشيك"}
            </button>
            </PermissionGate>
          </div>
        </div>
      )}
      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="cheque_register"
          renderContent={(settings) => <ChequeRegisterTemplate rows={filteredRows} settings={settings} />}
        />
      )}
    </div>
  );
}
