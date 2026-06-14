import React, { useEffect, useState, useMemo } from "react";
import { 
  Banknote, 
  Receipt, 
  User, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Search, 
  Table as TableIcon,
  ArrowRightLeft,
  ChevronLeft,
  Info,
  DollarSign,
  Briefcase
} from "lucide-react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import PermissionGate from "../../components/ui/PermissionGate";
import toast from "react-hot-toast";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export default function PaymentFormPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState([]);
  const [parties, setParties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [form, setForm] = useState({
    party_type: "customer",
    party_id: "",
    amount: "",
    method_id: "",
    notes: "",
    created_at: new Date().toISOString().split('T')[0]
  });

  const [context, setContext] = useState({ open_invoices: [], party: null });
  const [selectedAllocations, setSelectedAllocations] = useState({});

  // 1. Load Initial Data
  async function loadInitialData() {
    try {
      const methodsRes = await api.get("/api/payment-methods");
      setMethods(methodsRes.data.data || []);
      if (methodsRes.data.data?.length > 0) {
        setForm(f => ({ ...f, method_id: String(methodsRes.data.data[0].id) }));
      }
    } catch (e) { toast.error("فشل تحميل طرق الدفع"); }
  }

  // 2. Load Parties for Selection
  async function searchParties() {
    try {
      const endpoint = form.party_type === "customer" ? "/api/customers" : "/api/suppliers";
      const res = await api.get(endpoint);
      setParties(res.data.data || []);
    } catch (e) {}
  }

  // 3. Load Party Context (Open Invoices)
  async function loadContext() {
    if (!form.party_id) return;
    try {
      const response = await api.get("/api/payments/context", {
        params: { party_type: form.party_type, party_id: form.party_id },
      });
      setContext(response.data.data || { open_invoices: [] });
      setSelectedAllocations({});
    } catch (e) {
      setContext({ open_invoices: [] });
    }
  }

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { searchParties(); }, [form.party_type]);
  useEffect(() => { loadContext(); }, [form.party_id, form.party_type]);

  const filteredParties = useMemo(() => {
    return parties.filter(p => (p.name || "").includes(searchTerm) || (p.phone || "").includes(searchTerm));
  }, [parties, searchTerm]);

  const totalAllocated = useMemo(() => {
    return Object.values(selectedAllocations).reduce((sum, v) => sum + Number(v || 0), 0);
  }, [selectedAllocations]);

  const remainingToAllocate = useMemo(() => {
    return Math.max(0, Number(form.amount || 0) - totalAllocated);
  }, [form.amount, totalAllocated]);

  function handleAutoAllocate() {
    let amountLeft = Number(form.amount || 0);
    const newAllocations = {};
    
    // Sort invoices by date or ID (assume oldest first for FIFO)
    const sortedInvoices = [...(context.open_invoices || [])].sort((a, b) => a.id - b.id);
    
    for (const inv of sortedInvoices) {
      if (amountLeft <= 0) break;
      const canPay = Math.min(inv.outstanding, amountLeft);
      newAllocations[inv.id] = canPay;
      amountLeft -= canPay;
    }
    setSelectedAllocations(newAllocations);
  }

  function toggleInvoice(invoice) {
    if (selectedAllocations[invoice.id]) {
      const next = { ...selectedAllocations };
      delete next[invoice.id];
      setSelectedAllocations(next);
    } else {
      const amount = Math.min(invoice.outstanding, remainingToAllocate);
      setSelectedAllocations(prev => ({ ...prev, [invoice.id]: amount }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.party_id || !form.amount || !form.method_id) {
      toast.error("يرجى ملء جميع الحقول الأساسية");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/payments", {
        party_type: form.party_type,
        party_id: Number(form.party_id),
        amount: Number(form.amount),
        method_id: Number(form.method_id),
        notes: form.notes,
        created_at: form.created_at,
        allocations: Object.entries(selectedAllocations)
          .filter(([, amount]) => Number(amount) > 0)
          .map(([invoiceId, amount]) => ({ invoice_id: Number(invoiceId), amount: Number(amount) })),
      });
      toast.success("تم تسجيل الحركة بنجاح");
      navigate("/payments");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل التسجيل");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[15px] font-black text-slate-800">تسجيل حركة مالية جديدة</h1>
            <p className="text-[11px] font-bold text-slate-400">إدارة القبض، السداد، وتوزيع المبالغ على فواتير الآجل</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-sm bg-blue-50 px-3 py-1.5 border border-blue-100">
             <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
             <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Workspace Active</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* RIGHT SIDEBAR (Arabic RTL: is logically the first panel) */}
        <aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto scrollbar-thin p-6">
          <div className="space-y-6">
            {/* 1. Transaction Type */}
            <div className="space-y-3">
               <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">نوع المعاملة والطرف</label>
               <div className="grid grid-cols-2 gap-2">
                 <button 
                  onClick={() => setForm(f => ({ ...f, party_type: 'customer', party_id: "" }))}
                  className={`flex items-center justify-center gap-2 rounded-sm border py-2.5 text-2sm font-black transition-all ${form.party_type === 'customer' ? 'border-primary bg-primary text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                 >
                   <User className="h-4 w-4" /> عميل (تحصيل)
                 </button>
                 <button 
                  onClick={() => setForm(f => ({ ...f, party_type: 'supplier', party_id: "" }))}
                  className={`flex items-center justify-center gap-2 rounded-sm border py-2.5 text-2sm font-black transition-all ${form.party_type === 'supplier' ? 'border-primary bg-primary text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                 >
                   <Briefcase className="h-4 w-4" /> مورد (سداد)
                 </button>
               </div>

               <div className="relative mt-3">
                 <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                 <input 
                  type="text"
                  placeholder={`البحث عن ${form.party_type === 'customer' ? 'عميل' : 'مورد'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-sm border border-slate-200 py-2.5 pl-4 pr-10 text-sm font-bold outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                 />
                 {searchTerm && (
                   <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl scrollbar-thin">
                     {filteredParties.length === 0 ? (
                       <div className="p-4 text-center text-2sm font-bold text-slate-400">لا توجد نتائج</div>
                     ) : (
                       filteredParties.map(p => (
                         <button 
                          key={p.id}
                          onClick={() => { setForm(f => ({ ...f, party_id: String(p.id) })); setSearchTerm(""); }}
                          className="flex w-full items-center justify-between border-b border-slate-50 px-4 py-2.5 transition-colors hover:bg-slate-50"
                         >
                           <span className="text-sm font-bold text-slate-700">{p.name}</span>
                           <span className="text-[11px] font-mono text-slate-400">{p.phone}</span>
                         </button>
                       ))
                     )}
                   </div>
                 )}
               </div>
               
               {form.party_id && (
                 <div className="flex items-center gap-3 rounded-md bg-slate-900 p-4 text-white">
                   <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/10"><User className="h-5 w-5" /></div>
                   <div className="flex flex-col">
                     <span className="text-[11px] font-black uppercase tracking-widest text-white/50">الطرف المحدد</span>
                     <span className="text-sm font-black">{context.party?.name || parties.find(p => String(p.id) === form.party_id)?.name}</span>
                   </div>
                 </div>
               )}
            </div>

            <div className="h-px bg-slate-100" />

            {/* 2. Amount and Method */}
            <div className="space-y-4">
               <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase text-slate-400 tracking-widest">قيمة الحركة والجدولة</label>
                  <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number"
                      placeholder="المبلغ المراد تسجيله..."
                      value={form.amount}
                      onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full rounded-sm border border-slate-200 py-3 pl-4 pr-10 text-[18px] font-black text-slate-800 outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                    />
                  </div>
               </div>

               <div>
                 <label className="mb-1.5 block text-[11px] font-black uppercase text-slate-400 tracking-widest">وسيلة الدفع</label>
                 <select 
                  value={form.method_id}
                  onChange={(e) => setForm(f => ({ ...f, method_id: e.target.value }))}
                  className="w-full rounded-sm border border-slate-200 py-2.5 px-3 text-sm font-bold outline-none focus:border-slate-800"
                 >
                   {methods.map(m => (
                     <option key={m.id} value={m.id}>{m.name} ({m.type === 'cash' ? 'خزينة' : 'بنك'})</option>
                   ))}
                 </select>
               </div>

               <div>
                 <label className="mb-1.5 block text-[11px] font-black uppercase text-slate-400 tracking-widest">تاريخ الاستحقاق / المعاملة</label>
                 <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="date"
                      value={form.created_at}
                      onChange={(e) => setForm(f => ({ ...f, created_at: e.target.value }))}
                      className="w-full rounded-sm border border-slate-200 py-2.5 pl-4 pr-10 text-sm font-bold outline-none focus:border-slate-800"
                    />
                 </div>
               </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* 3. Additional Info */}
            <div className="space-y-3">
               <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">ملاحظات إضافية</label>
               <textarea 
                placeholder="اكتب أي ملاحظات اختيارية هنا..."
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-sm border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:bg-white focus:border-slate-800 resize-none min-h-[80px]"
               />
            </div>

            {/* Submit */}
            <PermissionGate page="payments" action="add">
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-sm bg-primary py-4 text-sm font-black text-white shadow-lg transition-all hover:bg-primary-600 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5" /> {loading ? 'جاري الحفظ...' : 'تأكيد وحفظ الحركة الماليّة'}
              </button>
            </PermissionGate>
          </div>
        </aside>

        {/* MAIN AREA: Allocation Tablet */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 p-6 overflow-hidden">
           <div className="flex h-full flex-col gap-6">
              {/* Context Summary Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                 <div className="flex flex-col rounded-md border border-blue-100 bg-white p-5 shadow-sm border-r-4 border-r-blue-500">
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">إجمالي المديونية الحالية</span>
                    <div className="flex items-baseline gap-1 mt-1">
                       <span className="text-[20px] font-black text-slate-800">{formatMoney(context.party?.balance_total || 0)}</span>
                       <span className="text-[11px] font-bold text-slate-400">ج.م</span>
                    </div>
                 </div>
                 <div className="flex flex-col rounded-md border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">المبلغ الجاري توزيعه</span>
                    <div className="flex items-baseline gap-1 mt-1">
                       <span className="text-[20px] font-black text-emerald-600">{formatMoney(form.amount)}</span>
                       <span className="text-[11px] font-bold text-slate-400">ج.m</span>
                    </div>
                 </div>
                 <div className="flex flex-col rounded-md border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-slate-800">
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">متبقي بدون تخصيص</span>
                    <div className="flex items-baseline gap-1 mt-1">
                       <span className="text-[20px] font-black text-slate-500">{formatMoney(remainingToAllocate)}</span>
                       <span className="text-[11px] font-bold text-slate-400">ج.م</span>
                    </div>
                 </div>
              </div>

              {/* Allocation List */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
                 <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white"><TableIcon className="h-4 w-4" /></div>
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">تخصيص السداد على الفواتير المفتوحة</h3>
                    </div>
                    <button 
                      onClick={handleAutoAllocate}
                      className="flex items-center gap-2 rounded-sm bg-white border border-slate-300 px-4 py-2 text-[11px] font-black text-slate-600 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                       <ArrowRightLeft className="h-3.5 w-3.5" /> توزيع آلي (Auto-Allocate)
                    </button>
                 </div>

                 <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
                    {(!context.open_invoices || context.open_invoices.length === 0) ? (
                      <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                         <Info className="mb-3 h-12 w-12" />
                         <p className="max-w-[280px] text-sm font-bold leading-relaxed">
                            {form.party_id ? "لا توجد فواتير مفتوحة (آجل) لهذا الطرف حالياً." : "يرجى اختيار العميل أو المورد أولاً لإظهار الفواتير المفتوحة."}
                         </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-[150px_1fr_120px_120px_150px] gap-4 px-4 pb-2 text-[11px] font-black uppercase text-slate-400 tracking-widest">
                           <div>رقم الفاتورة</div>
                           <div>التاريخ</div>
                           <div className="text-left">الإجمالي</div>
                           <div className="text-left">المتبقي</div>
                           <div className="text-center">المبلغ الموزع</div>
                        </div>
                        {context.open_invoices.map(inv => {
                          const isAllocated = !!selectedAllocations[inv.id];
                          return (
                            <div 
                              key={inv.id}
                              onClick={() => toggleInvoice(inv)}
                              className={`group cursor-pointer grid grid-cols-[150px_1fr_120px_120px_150px] items-center gap-4 rounded-md border p-4 transition-all ${isAllocated ? 'border-blue-500 bg-blue-50/20 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/50'}`}
                            >
                               <div className="font-mono text-sm font-black text-slate-800">{inv.invoice_no}</div>
                               <div className="text-2sm font-bold text-slate-500 line-clamp-1">{new Date(inv.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</div>
                               <div className="text-left text-sm font-bold text-slate-400">{formatMoney(inv.total)}</div>
                               <div className="text-left text-sm font-black text-slate-800">{formatMoney(inv.outstanding)}</div>
                               <div className="flex items-center justify-center gap-3">
                                  <input 
                                    type="number"
                                    value={selectedAllocations[inv.id] || ""}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setSelectedAllocations(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                    placeholder="0.00"
                                    className={`w-[110px] rounded-sm border bg-white px-3 py-1.5 text-center font-black text-sm outline-none transition-all ${isAllocated ? 'border-blue-500 text-blue-800 ring-2 ring-blue-100' : 'border-slate-200 text-slate-400 group-hover:border-slate-400'}`}
                                  />
                                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${isAllocated ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                     {isAllocated && <CheckCircle2 className="h-3 w-3 text-white" />}
                                  </div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                 </div>
                 
                 {/* Footer Summary */}
                 <div className="border-t border-slate-100 bg-slate-900 px-8 py-5 text-white">
                    <div className="flex items-center justify-between">
                       <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">إجمالي المبلغ المطلوب توزيعه</span>
                          <span className="text-[20px] font-black text-white">{formatMoney(form.amount)} ج.م</span>
                       </div>
                       <div className="h-10 w-px bg-white/10" />
                       <div className="flex flex-col text-center">
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">تم توزيعه بالفعل</span>
                          <span className={`text-[20px] font-black ${totalAllocated > Number(form.amount) ? 'text-rose-400' : 'text-emerald-400'}`}>
                             {formatMoney(totalAllocated)} ج.م
                          </span>
                       </div>
                       <div className="h-10 w-px bg-white/10" />
                       <div className="flex flex-col text-left">
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">المتبقي للتوزيع</span>
                          <span className="text-[20px] font-black text-amber-400">{formatMoney(remainingToAllocate)} ج.م</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </main>
      </div>
    </div>
  );
}
