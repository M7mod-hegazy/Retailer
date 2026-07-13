import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  Banknote, 
  ArrowRight, 
  Info, 
  FileText, 
  History,
  TrendingDown,
  TrendingUp,
  LayoutDashboard
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

function formatMoney(v) {
  return formatNumber(v);
}

export default function TreasuryTransfer() {
  const [treasuries, setTreasuries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    source_id: "",
    destination_id: "",
    amount: "",
    reference: "",
    notes: ""
  });
  const sourceRef = useRef(null);
  const destRef = useRef(null);
  const amountRef = useRef(null);
  const refRef = useRef(null);
  const notesRef = useRef(null);
  const formRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  useEffect(() => {
    fetchTreasuries();
  }, []);

  const fetchTreasuries = async () => {
    try {
      const res = await api.get("/api/treasuries");
      if (res.data?.success) setTreasuries(res.data.data);
    } catch (err) { toast.error("تعذر تحميل بيانات الخزائن"); }
  };

  const getSourceBalance = () => {
    const tr = treasuries.find((entry) => entry.id === Number(formData.source_id));
    return tr ? Number(tr.balance) : 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.source_id || !formData.destination_id || !formData.amount) {
      toast.error("يرجى استكمال الحقول المطلوبة");
      return;
    }
    
    if (Number(formData.amount) > getSourceBalance()) {
       if (!window.confirm("المبلغ المراد تحويله أكبر من رصيد الخزنة الحالي. هل تريد المتابعة؟")) return;
    }

    setLoading(true);
    try {
      await api.post("/api/operations/treasury-transfer", {
        ...formData,
        amount: Number(formData.amount),
      });
      toast.success("تم تنفيذ التحويل بنجاح");
      setFormData({ source_id: "", destination_id: "", amount: "", reference: "", notes: "" });
      fetchTreasuries();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر تنفيذ التحويل");
    } finally { setLoading(false); }
  };

  return (
    <div className="standard-page-container font-sans flex flex-col gap-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-800">تحويل النقدية (بين الخزائن)</h1>
          <p className="text-sm font-bold text-slate-400">نقل السيولة النقدية بين الصناديق الفرعية والرئيسية مع توثيق كلي للعملية</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 rounded-sm bg-slate-100 px-4 py-2 border border-slate-200">
              <History className="h-4 w-4 text-slate-400" />
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">تحويلات اليوم: 0</span>
           </div>
        </div>
      </div>

      {/* Treasury Balances Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {treasuries.map((tr) => (
          <div key={tr.id} className="group flex flex-col rounded-md border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-800">
            <div className="flex items-center justify-between">
               <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Banknote className="h-3 w-3" /> {tr.name}
               </span>
               <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--primary-glow)]"></div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
               <span className="text-[22px] font-black text-slate-800">{formatMoney(tr.balance)}</span>
               <span className="text-[11px] font-bold text-slate-400">ج.م</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Transfer Workspace */}
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-8 py-5 text-white">
           <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-white/10 shadow-inner">
                 <ArrowLeftRight className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-[16px] font-black uppercase tracking-wider">نموذج تحويل عهدة نقدية</h2>
                 <p className="text-[11px] font-bold text-white/50">تأكد من دقة المبالغ والتواريخ قبل التنفيذ</p>
              </div>
           </div>
           <LayoutDashboard className="h-6 w-6 text-white/10" />
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-10">
           <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
              
              {/* SOURCE --> DESTINATION Flow */}
              <div className="col-span-2 flex items-center justify-center gap-8 rounded-md bg-slate-50 border border-slate-100 p-8">
                 <div className="flex-1 space-y-2">
                    <label className="text-center block text-[11px] font-black uppercase text-slate-400 tracking-widest">من (المصدر)</label>
                     <select 
                       ref={sourceRef}
                       required
                       value={formData.source_id}
                       onChange={(e) => setFormData(p => ({ ...p, source_id: e.target.value }))}
                       onKeyDown={e => handleKeyDown(e, { nextRef: destRef })}
                       className="w-full rounded-sm border border-slate-200 py-3.5 px-4 text-[15px] font-black text-slate-800 outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-sm"
                     >
                        <option value="">اختيار الخزينة المصدر...</option>
                        {treasuries.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                     </select>
                    {formData.source_id && (
                       <div className="flex items-center justify-center gap-2 pt-1">
                          <TrendingDown className="h-3 w-3 text-rose-500" />
                          <span className="text-[11px] font-bold text-slate-500">الرصيد المتاح: {formatMoney(getSourceBalance())} ج.م</span>
                       </div>
                    )}
                 </div>

                 <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-slate-900/20">
                    <ArrowRight className="h-6 w-6 rtl:rotate-180" />
                 </div>

                 <div className="flex-1 space-y-2">
                    <label className="text-center block text-[11px] font-black uppercase text-slate-400 tracking-widest">إلى (المستقبل)</label>
                     <select 
                       ref={destRef}
                       required
                       value={formData.destination_id}
                       onChange={(e) => setFormData(p => ({ ...p, destination_id: e.target.value }))}
                       onKeyDown={e => handleKeyDown(e, { nextRef: amountRef, prevRef: sourceRef })}
                       className="w-full rounded-sm border border-slate-200 py-3.5 px-4 text-[15px] font-black text-slate-800 outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-sm"
                    >
                       <option value="">اختيار الخزينة المستلمة...</option>
                       {treasuries.map(tr => (
                         <option key={tr.id} value={tr.id} disabled={String(tr.id) === formData.source_id}>{tr.name}</option>
                       ))}
                    </select>
                    <div className="flex items-center justify-center gap-2 pt-1">
                       <TrendingUp className="h-3 w-3 text-emerald-500" />
                       <span className="text-[11px] font-bold text-slate-500">سيتم زيادة الرصيد فوراً</span>
                    </div>
                 </div>
              </div>

              {/* Amount & Reference */}
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest">
                       المبلغ المراد تحويله <Info className="h-3 w-3" />
                    </label>
                    <div className="relative">
                       <Banknote className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                        <input 
                          ref={amountRef}
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                          onKeyDown={e => handleKeyDown(e, { nextRef: refRef, prevRef: destRef })}
                          placeholder="0.00"
                          className="w-full rounded-sm border border-slate-200 py-3 pl-4 pr-12 text-[20px] font-black text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-sm"
                        />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">رقم المرجع / القيد</label>
                    <div className="relative">
                       <FileText className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                        <input 
                          ref={refRef}
                          type="text"
                          value={formData.reference}
                          onChange={(e) => setFormData(p => ({ ...p, reference: e.target.value }))}
                          onKeyDown={e => handleKeyDown(e, { nextRef: notesRef, prevRef: amountRef })}
                          placeholder="TR-..."
                          className="w-full rounded-sm border border-slate-200 py-3 pl-4 pr-12 text-sm font-bold text-slate-700 outline-none shadow-sm focus:border-slate-800"
                       />
                    </div>
                 </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">ملاحظات التحويل والسبب</label>
                  <textarea 
                    ref={notesRef}
                    rows="5"
                    value={formData.notes}
                    onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                    onKeyDown={e => handleKeyDown(e, { prevRef: refRef, onEnter: () => formRef.current?.requestSubmit() })}
                    placeholder="اكتب تفاصيل العملية هنا..."
                    className="w-full rounded-sm border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-800 shadow-sm resize-none"
                  />
              </div>
           </div>

           {/* Live plain-language summary of what will happen */}
           {(() => {
              const src = treasuries.find(t => String(t.id) === String(formData.source_id));
              const dst = treasuries.find(t => String(t.id) === String(formData.destination_id));
              const amt = Number(formData.amount || 0);
              if (!src || !dst || !amt) return null;
              const after = Number(src.balance) - amt;
              return (
                 <div className="mt-8 rounded-md border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-[13px] font-black text-slate-700 leading-relaxed">
                       سيتم خصم <b className="text-rose-600">{formatMoney(amt)} ج.م</b> من «{src.name}» وإضافتها فوراً إلى «{dst.name}».
                    </p>
                    <p className={`mt-1 text-[11px] font-bold ${after < 0 ? "text-rose-600" : "text-slate-500"}`}>
                       رصيد «{src.name}» بعد التحويل: {formatMoney(after)} ج.م
                       {after < 0 && " — أكبر من الرصيد المتاح!"}
                    </p>
                 </div>
              );
           })()}

           <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-8">
              <div className="flex items-center gap-3 rounded-sm bg-amber-50 px-4 py-2 border border-amber-100">
                 <Info className="h-4 w-4 text-amber-600" />
                 <span className="text-[11px] font-bold text-amber-700">هذه العملية غير قابلة للتراجع بعد الاعتماد</span>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-3 rounded-sm bg-primary px-12 py-3.5 text-[15px] font-black text-white shadow-xl transition-all hover:bg-primary-600 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'جاري التحويل...' : (
                   <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" /> تنفيذ التحويل البنكي/النقدي
                   </>
                )}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
