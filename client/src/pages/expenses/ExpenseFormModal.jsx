import React, { useEffect, useState, useRef } from "react";
import api from "../../services/api";
import { 
  DollarSign, 
  Tag, 
  FileText, 
  User, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  Calendar,
  Layers
} from "lucide-react";
import toast from "react-hot-toast";
import TitleBar from "../../components/ui/TitleBar";
import PermissionGate from "../../components/ui/PermissionGate";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useDetach } from "../../hooks/useDetach";
import FieldError from "../../components/ui/FieldError";

export default function ExpenseFormModal({ open, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [treasuries, setTreasuries] = useState([]);
  // Record-only payment methods (فيزا, محافظ رقمية) — money paid out is recorded
  // under the method name but moves no balance. Cash is handled separately (drawer).
  const [payMethods, setPayMethods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [form, setForm] = useState({
    amount: "",
    category_id: "",
    description: "",
    notes: "",
    payment_method: "cash",
    treasury_id: "",
    bank_id: "",
    employee_id: "",
    created_at: new Date().toISOString().split('T')[0]
  });
  const amountRef = useRef(null);
  const categoryRef = useRef(null);
  const descRef = useRef(null);
  const sourceRef = useRef(null);
  const employeeRef = useRef(null);
  const dateRef = useRef(null);
  const notesRef = useRef(null);
  const formRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const { handleDetach } = useDetach("expense-form", {
    onClose, getState: () => ({}), actions: { success: () => onSuccess?.() },
  });

  useEffect(() => {
    if (!open) return;
    loadSelectionData();
    setTimeout(() => amountRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  async function loadSelectionData() {
    try {
      const [cat, tr, pm, em] = await Promise.all([
        api.get("/api/expenses/categories"),
        api.get("/api/treasuries"),
        api.get("/api/payment-methods"),
        api.get("/api/employees")
      ]);
      setCategories(cat.data.data || []);
      setTreasuries(tr.data.data || []);
      // record-only methods only: exclude cash/credit/bank — those are not a "paid by" choice here
      setPayMethods((pm.data.data || []).filter(m => m.is_active !== 0 && m.category !== 'cash' && m.category !== 'credit' && m.category !== 'bank' && m.type !== 'bank'));
      setEmployees(em.data.data || []);
    } catch (e) {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    const newErrors = {};
    if (!form.amount) newErrors.amount = "أدخل المبلغ";
    if (!form.category_id) newErrors.category_id = "اختر التصنيف";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      await api.post("/api/expenses", {
        ...form,
        amount: Number(form.amount),
        category_id: Number(form.category_id),
        treasury_id: form.treasury_id ? Number(form.treasury_id) : null,
        bank_id: form.bank_id ? Number(form.bank_id) : null,
        employee_id: form.employee_id ? Number(form.employee_id) : null,
      });
      toast.success("تم تسجيل المصروف بنجاح");
      onSuccess?.();
      onClose?.();
      setForm({
        amount: "",
        category_id: "",
        description: "",
        notes: "",
        payment_method: "cash",
        treasury_id: "",
        bank_id: "",
        employee_id: "",
        created_at: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل التسجيل");
    } finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <TitleBar title="تسجيل مصروف جديد" subtitle="إضافة حركة مالية تابعة للمصروفات العمومية أو الإدارية" onClose={onClose} onDetach={handleDetach} />

         <form data-modal-content ref={formRef} onSubmit={handleSubmit} className="p-8">
           <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {/* Amount */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">قيمة المصروف</label>
                 <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                         ref={amountRef}
                         type="number"
                         required
                         value={form.amount}
                         onChange={(e) => { setForm(f => ({ ...f, amount: e.target.value })); setErrors(err => ({ ...err, amount: undefined })); }}
                         onKeyDown={e => handleKeyDown(e, { nextRef: categoryRef })}
                         placeholder="0.00"
                          className={`w-full rounded-sm border bg-white py-2.5 pl-4 pr-10 text-[18px] font-black text-slate-800 outline-none transition-all ${errors.amount ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:border-rose-600 focus:ring-1 focus:ring-rose-600"}`}
                      />
                  </div>
                  <FieldError error={errors.amount} />
              </div>

              {/* Category */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">تصنيف المصروف</label>
                 <div className="relative">
                    <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select 
                         ref={categoryRef}
                         required
                         value={form.category_id}
                         onChange={(e) => { setForm(f => ({ ...f, category_id: e.target.value })); setErrors(err => ({ ...err, category_id: undefined })); }}
                         onKeyDown={e => handleKeyDown(e, { nextRef: descRef, prevRef: amountRef })}
                         className={`w-full appearance-none rounded-sm border py-3 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all ${errors.category_id ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-slate-800"}`}
                      >
                         <option value="">اختيار الفئة...</option>
                         {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <FieldError error={errors.category_id} />
              </div>

              {/* Description */}
              <div className="col-span-2 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">وصف مختصر</label>
                 <div className="relative">
                    <FileText className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                     <input 
                        ref={descRef}
                        type="text"
                        value={form.description}
                        onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: sourceRef, prevRef: categoryRef })}
                        placeholder="مثلاً: فاتورة الكهرباء لشهر مارس..."
                         className="w-full rounded-sm border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                     />
                 </div>
              </div>

              {/* Payment Method */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">طريقة الدفع</label>
                 <select
                    value={form.payment_method}
                    onChange={(e) => setForm(f => ({ ...f, payment_method: e.target.value, treasury_id: e.target.value === 'cash' ? f.treasury_id : "" }))}
                    className="w-full rounded-sm border border-slate-200 py-2 pl-3 pr-3 text-2sm font-bold text-slate-700 outline-none"
                 >
                    <option value="cash">💵 نقدي</option>
                    {payMethods.map(m => <option key={m.id} value={m.name}>{(m.icon || '💳') + ' ' + m.name}</option>)}
                 </select>
              </div>

              {/* Source Selection — only for cash (treasury). Record-only methods move no balance. */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">المصدر المالي</label>
                 {form.payment_method === 'cash' ? (
                  <select
                     ref={sourceRef}
                     value={form.treasury_id}
                     onChange={(e) => setForm(f => ({ ...f, treasury_id: e.target.value }))}
                     onKeyDown={e => handleKeyDown(e, { nextRef: employeeRef, prevRef: descRef })}
                     className="w-full rounded-sm border border-slate-200 py-2 pl-3 pr-3 text-2sm font-bold text-slate-700 outline-none"
                  >
                     <option value="">اختر الخزينة...</option>
                     {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                 ) : (
                  <div className="w-full rounded-sm border border-dashed border-slate-200 bg-slate-50 py-2 px-3 text-2sm font-bold text-slate-400">يُسجَّل خارج الخزينة</div>
                 )}
              </div>

              {/* Employee */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">بمعرفة الموظف</label>
                 <div className="relative">
                    <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                     <select 
                        ref={employeeRef}
                        value={form.employee_id}
                        onChange={(e) => setForm(f => ({ ...f, employee_id: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: dateRef, prevRef: sourceRef })}
                        className="w-full appearance-none rounded-sm border border-slate-200 py-2 pl-4 pr-10 text-2sm font-bold text-slate-700 outline-none"
                     >
                        <option value="">اختيار الموظف (اختياري)...</option>
                        {employees.map(em => <option key={em.id} value={em.id}>{em.name}</option>)}
                     </select>
                 </div>
              </div>

              {/* Date */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">تاريخ المصروف</label>
                 <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                     <input 
                        ref={dateRef}
                        type="date"
                        value={form.created_at}
                        onChange={(e) => setForm(f => ({ ...f, created_at: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: notesRef, prevRef: employeeRef })}
                        className="w-full rounded-sm border border-slate-200 bg-white py-2 pl-4 pr-10 text-2sm font-black text-slate-800 outline-none"
                     />
                 </div>
              </div>

              {/* Notes */}
              <div className="col-span-2 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">ملاحظات داخلية</label>
                  <textarea 
                     ref={notesRef}
                     value={form.notes}
                     onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                     onKeyDown={e => handleKeyDown(e, { prevRef: dateRef, onEnter: () => formRef.current?.requestSubmit() })}
                      placeholder="اكتب أي تفاصيل أخرى هنا..."
                      className="w-full rounded-sm border border-slate-200 bg-white p-3 text-2sm font-bold text-slate-700 outline-none focus:bg-white resize-none"
                     rows="2"
                  />
              </div>
           </div>

           <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <button 
                 type="button"
                 onClick={onClose}
                  className="btn-ghost rounded-sm px-6 py-2.5 text-sm font-black transition-colors"
              >
                 إلغاء التغييرات
              </button>
               <PermissionGate page="expenses" action="add">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-sm bg-rose-900 px-10 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-800 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {loading ? 'جاري الحفظ...' : 'حفظ مصروف جديد'}
                  </button>
               </PermissionGate>
           </div>
        </form>
      </div>
    </div>
  );
}
