import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { 
  Plus, 
  Trash2, 
  Banknote, 
  CreditCard, 
  Layers, 
  Settings2, 
  ChevronRight, 
  CheckCircle2, 
  Search, 
  Activity, 
  ArrowRightLeft,
  X,
  Database
} from "lucide-react";
import toast from "react-hot-toast";

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState([]);
  const [treasuries, setTreasuries] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash", target_id: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [m, t, b] = await Promise.all([
        api.get("/api/payment-methods"),
        api.get("/api/treasuries"),
        api.get("/api/banks")
      ]);
      setMethods(m.data.data || []);
      setTreasuries(t.data.data || []);
      setBanks(b.data.data || []);
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name) {
      toast.error("يرجى إدخال اسم الطريقة");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/api/payment-methods", form);
      toast.success("تمت إضافة الطريقة بنجاح");
      setModalOpen(false);
      setForm({ name: "", type: "cash", target_id: "" });
      loadData();
    } catch (e) { toast.error("فشل إضافة الطريقة"); }
    finally { setIsSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("حذف هذه الطريقة سيؤدي لفقدان الارتباط في العمليات الجديدة. هل أنت متأكد؟")) return;
    try {
      await api.delete(`/api/payment-methods/${id}`);
      toast.success("تم الحذف بنجاح");
      loadData();
    } catch (e) { toast.error("فشل الحذف"); }
  }

  return (
    <div className="standard-page-container font-sans flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400">
             <ArrowRightLeft className="h-4 w-4" />
             <span className="text-[11px] font-black uppercase tracking-widest">إعدادات الخزينة</span>
          </div>
          <h1 className="text-[24px] font-black text-slate-800">قنوات الدفع والتحصيل</h1>
          <p className="text-sm font-bold text-slate-400">إدارة كافة الوسائل المستخدمة في استلام وتوريد النقدية (خزينة، بنك، فيزا...)</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:bg-primary-600 active:scale-95"
        >
          <Plus className="h-4 w-4" /> تعريف قناة دفع
        </button>
      </div>

      {/* Methods Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
           <div className="col-span-full py-20 text-center font-black animate-pulse text-slate-400">جاري تحميل القنوات...</div>
        ) : methods.length === 0 ? (
           <div className="col-span-full py-20 text-center font-bold text-slate-400 border-2 border-dashed border-slate-200 rounded-md">لم يتم تعريف أي قنوات دفع بعد</div>
        ) : (
          methods.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-md border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-800 hover:shadow-xl">
               <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-sm shadow-inner ${m.type === 'cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                     {m.type === 'cash' ? <Banknote className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[16px] font-black text-slate-800">{m.name}</span>
                     <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        {m.type === 'cash' ? 'خزينة / صندوق' : 'حساب بنكي / فيزا'}
                     </span>
                  </div>
               </div>

               <div className="mt-6 flex items-center justify-between rounded-sm bg-slate-50 px-4 py-2 border border-slate-100">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black uppercase text-slate-400">يوجه إلى</span>
                     <span className="text-2sm font-bold text-slate-600 truncate max-w-[120px]">
                        {m.target_name || (m.type === 'cash' ? treasuries.find(t => t.id === m.target_id)?.name : banks.find(b => b.id === m.target_id)?.name) || "مصدر افتراضي"}
                     </span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
               </div>
               
               <div className="absolute left-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDelete(m.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Slide-over Form Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-slate-900/60 backdrop-blur-sm">
           <div className="h-full w-full max-w-lg bg-white shadow-2xl animate-in slide-in-from-left duration-300">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-8 py-6">
                 <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-white shadow-lg">
                       <ArrowRightLeft className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[16px] font-black text-slate-800">تعريف وسيلة دفع جديدة</h2>
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">إعدادات الخزينة والمالية</p>
                    </div>
                 </div>
                 <button onClick={() => setModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 transition-colors">
                    <X className="h-5 w-5" />
                 </button>
              </header>

              <form onSubmit={handleAdd} className="p-10 flex flex-col h-[calc(100%-88px)]">
                 <div className="space-y-8 flex-1">
                    <div className="space-y-1.5 px-1">
                       <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
                          اسم الوسيلة (مثلاً: فودافون كاش، بنك مصر)
                          <span className="text-[9px] text-rose-500">مطلوب*</span>
                       </label>
                       <input 
                         required
                         value={form.name}
                         onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                         placeholder="الاسم التعريفي..."
                         className="w-full rounded-sm border border-slate-200 py-3 px-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800 bg-slate-50 focus:bg-white"
                       />
                    </div>

                    <div className="space-y-1.5 px-1">
                       <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">تصنيف القناة</label>
                       <select 
                          value={form.type}
                          onChange={(e) => setForm(p => ({ ...p, type: e.target.value, target_id: "" }))}
                          className="w-full rounded-sm border border-slate-200 py-3 px-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800 bg-slate-50 focus:bg-white"
                       >
                          <option value="cash">نقدي (خزينة)</option>
                          <option value="bank">بنكي (حساب بنك)</option>
                          <option value="other">أخرى</option>
                       </select>
                    </div>

                    {(form.type === 'cash' || form.type === 'bank') && (
                       <div className="space-y-1.5 px-1">
                          <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">التوجيه المالي (المصدر)</label>
                          <select 
                             required
                             value={form.target_id}
                             onChange={(e) => setForm(p => ({ ...p, target_id: e.target.value }))}
                             className="w-full rounded-sm border border-slate-200 py-3 px-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800 bg-slate-50 focus:bg-white"
                          >
                             <option value="">اختيار المصدر المالي...</option>
                             {form.type === 'cash' ? treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                       </div>
                    )}
                 </div>

                 <div className="mt-auto pt-10 border-t border-slate-100 flex items-center gap-4">
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)}
                      className="flex-1 rounded-sm border border-slate-200 py-3 text-sm font-black text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                       إلغاء
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-[1.5] flex items-center justify-center gap-3 rounded-sm bg-primary py-3 text-sm font-black text-white shadow-xl transition-all hover:bg-primary-600 active:scale-95 disabled:opacity-50"
                    >
                       {isSubmitting ? 'جاري الحفظ...' : (
                          <>
                             <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 
                             تأكيد إضافة القناة
                          </>
                       )}
                    </button>
                 </div>
              </form>
           </div>
           <div className="flex-1 cursor-pointer rtl:order-first" onClick={() => setModalOpen(false)}></div>
        </div>
      )}
    </div>
  );
}
