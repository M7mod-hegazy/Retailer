import React, { useEffect, useRef, useState } from "react";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
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
import PermissionGate from "../../components/ui/PermissionGate";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

export default function PaymentMethodsPage() {
  const handleKeyDown = useFieldNavigation();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const nameRef = useRef(null);
  const typeRef = useRef(null);
  const targetIdRef = useRef(null);
  const submitBtnRef = useRef(null);
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
    const ok = await confirm({ title: "تأكيد الحذف", message: "حذف هذه الطريقة سيؤدي لفقدان الارتباط في العمليات الجديدة. هل أنت متأكد؟" });
    if (!ok) return;
    try {
      await api.delete(`/api/payment-methods/${id}`);
      toast.success("تم الحذف بنجاح");
      loadData();
    } catch (e) { toast.error("فشل الحذف"); }
  }

  return (
    <div className="standard-page-container font-sans flex flex-col gap-8" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
             <ArrowRightLeft className="h-4 w-4" />
             <span className="text-[11px] font-black uppercase tracking-widest">إعدادات الخزينة</span>
          </div>
          <h1 className="text-[24px] font-black" style={{ color: "var(--text-primary)" }}>قنوات الدفع والتحصيل</h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>إدارة كافة الوسائل المستخدمة في استلام وتوريد النقدية (خزينة، بنك، فيزا...)</p>
        </div>
        <PermissionGate page="payment_methods" action="add">
          <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:bg-primary-600 active:scale-95"
          >
            <Plus className="h-4 w-4" /> تعريف قناة دفع
          </button>
        </PermissionGate>
      </div>

      {/* Methods Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
           <>
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse rounded-md border p-6 shadow-sm" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-sm bg-slate-200"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="mt-6 h-10 bg-slate-200 rounded"></div>
                </div>
              ))}
           </>
        ) : methods.length === 0 ? (
           <div className="col-span-full py-20 text-center font-bold rounded-md border-2 border-dashed" style={{ color: "var(--text-muted)", borderColor: "var(--border-normal)" }}>لم يتم تعريف أي قنوات دفع بعد</div>
        ) : (
          methods.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-md border p-6 shadow-sm transition-all hover:shadow-xl" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
               <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-sm shadow-inner ${m.type === 'cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                     {m.type === 'cash' ? <Banknote className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[16px] font-black" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                     <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                        {m.type === 'cash' ? 'خزينة / صندوق' : 'حساب بنكي / فيزا'}
                     </span>
                  </div>
               </div>

               <div className="mt-6 flex items-center justify-between rounded-sm px-4 py-2 border" style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black uppercase" style={{ color: "var(--text-muted)" }}>يوجه إلى</span>
                     <span className="text-2sm font-bold truncate max-w-[120px]" style={{ color: "var(--text-secondary)" }}>
                        {m.target_name || (m.type === 'cash' ? treasuries.find(t => t.id === m.target_id)?.name : banks.find(b => b.id === m.target_id)?.name) || "مصدر افتراضي"}
                     </span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
               </div>
               
               <div className="absolute left-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <PermissionGate page="payment_methods" action="delete">
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-sm transition-all hover:bg-rose-50 hover:text-rose-600" style={{ color: "var(--text-muted)" }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </PermissionGate>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Slide-over Form Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-sm">
           <div className="h-full w-full max-w-lg shadow-2xl animate-in slide-in-from-left duration-300" style={{ backgroundColor: "var(--bg-surface)" }}>
              <header className="flex items-center justify-between border-b px-8 py-6" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}>
                 <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-white shadow-lg">
                       <ArrowRightLeft className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[16px] font-black" style={{ color: "var(--text-primary)" }}>تعريف وسيلة دفع جديدة</h2>
                       <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>إعدادات الخزينة والمالية</p>
                    </div>
                 </div>
                 <button onClick={() => setModalOpen(false)} className="rounded-full p-2 transition-colors hover:bg-slate-200" style={{ color: "var(--text-muted)" }}>
                    <X className="h-5 w-5" />
                 </button>
              </header>

              <form onSubmit={handleAdd} className="p-10 flex flex-col h-[calc(100%-88px)]">
                 <div className="space-y-8 flex-1">
                    <div className="space-y-1.5 px-1">
                       <label className="text-[11px] font-black uppercase tracking-widest flex items-center justify-between" style={{ color: "var(--text-muted)" }}>
                          اسم الوسيلة (مثلاً: فودافون كاش، بنك مصر)
                          <span className="text-[9px] text-rose-500">مطلوب*</span>
                       </label>
                        <input 
                          ref={nameRef}
                          required
                          value={form.name}
                          onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                          onKeyDown={e => handleKeyDown(e, { nextRef: typeRef })}
                          placeholder="الاسم التعريفي..."
                          className="w-full rounded-sm border py-3 px-4 text-sm font-bold outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                          style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }}
                        />
                    </div>

                    <div className="space-y-1.5 px-1">
                       <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>تصنيف القناة</label>
                        <select 
                           ref={typeRef}
                           value={form.type}
                           onChange={(e) => setForm(p => ({ ...p, type: e.target.value, target_id: "" }))}
                           onKeyDown={e => {
                             const target = form.type === "cash" || form.type === "bank" ? targetIdRef : submitBtnRef;
                             handleKeyDown(e, { nextRef: target, prevRef: nameRef });
                           }}
                           className="w-full rounded-sm border py-3 px-4 text-sm font-bold outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                           style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }}
                        >
                           <option value="cash">نقدي (خزينة)</option>
                           <option value="bank">بنكي (حساب بنك)</option>
                           <option value="other">أخرى</option>
                        </select>
                    </div>

                    {(form.type === 'cash' || form.type === 'bank') && (
                       <div className="space-y-1.5 px-1">
                          <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>التوجيه المالي (المصدر)</label>
                           <select 
                              ref={targetIdRef}
                              required
                              value={form.target_id}
                              onChange={(e) => setForm(p => ({ ...p, target_id: e.target.value }))}
                              onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: typeRef })}
                              className="w-full rounded-sm border py-3 px-4 text-sm font-bold outline-none transition-all focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                              style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }}
                           >
                              <option value="">اختيار المصدر المالي...</option>
                              {form.type === 'cash' ? treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                           </select>
                       </div>
                    )}
                 </div>

                 <div className="mt-auto pt-10 border-t flex items-center gap-4" style={{ borderColor: "var(--border-subtle)" }}>
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)}
                      className="flex-1 rounded-sm border py-3 text-sm font-black transition-colors hover:bg-slate-50" style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}
                    >
                       إلغاء
                    </button>
                     <button 
                       ref={submitBtnRef}
                       type="submit" 
                       disabled={isSubmitting}
                       className="flex-[1.5] flex items-center justify-center gap-3 rounded-sm bg-primary py-3 text-sm font-black text-white shadow-xl transition-all hover:bg-primary-600 active:scale-95 disabled:opacity-50"
                     >
                        {isSubmitting ? (
                           <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                           <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                        {isSubmitting ? 'جاري الحفظ...' : 'تأكيد إضافة القناة'}
                     </button>
                 </div>
              </form>
           </div>
           <div className="flex-1 cursor-pointer rtl:order-first" onClick={() => setModalOpen(false)}></div>
        </div>
      )}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
