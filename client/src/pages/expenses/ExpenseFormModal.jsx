import React, { useEffect, useState, useRef } from "react";
import api from "../../services/api";
import { 
  X, 
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
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

export default function ExpenseFormModal({ open, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [treasuries, setTreasuries] = useState([]);
  const [banks, setBanks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  
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

  useEffect(() => {
    if (!open) return;
    loadSelectionData();
  }, [open]);

  async function loadSelectionData() {
    try {
      const [cat, tr, bn, em] = await Promise.all([
        api.get("/api/expenses/categories"),
        api.get("/api/treasuries"),
        api.get("/api/banks"),
        api.get("/api/employees")
      ]);
      setCategories(cat.data.data || []);
      setTreasuries(tr.data.data || []);
      setBanks(bn.data.data || []);
      setEmployees(em.data.data || []);
    } catch (e) {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.category_id) {
      toast.error("يرجى إدخال المبلغ والتصنيف");
      return;
    }

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-rose-900 text-white shadow-lg">
                <DollarSign className="h-6 w-6" />
             </div>
             <div className="flex flex-col">
                <h2 className="text-[16px] font-black text-slate-800">تسجيل مصروف جديد</h2>
                <p className="text-[11px] font-bold text-slate-400">إضافة حركة مالية تابعة للمصروفات العمومية أو الإدارية</p>
             </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

         <form ref={formRef} onSubmit={handleSubmit} className="p-8">
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
                        onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: categoryRef })}
                        placeholder="0.00"
                        className="w-full rounded-sm border border-slate-200 py-2.5 pl-4 pr-10 text-[18px] font-black text-slate-800 outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600"
                     />
                 </div>
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
                        onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: descRef, prevRef: amountRef })}
                        className="w-full appearance-none rounded-sm border border-slate-200 py-3 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                     >
                        <option value="">اختيار الفئة...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                 </div>
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
                        className="w-full rounded-sm border border-slate-200 py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                     />
                 </div>
              </div>

              {/* Payment Method */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">طريقة الدفع</label>
                 <div className="grid grid-cols-2 gap-2">
                    <button 
                       type="button"
                       onClick={() => setForm(f => ({ ...f, payment_method: 'cash', bank_id: "" }))}
                       className={`flex items-center justify-center gap-2 rounded-sm border py-2 text-[11px] font-black transition-all ${form.payment_method === 'cash' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                       <Banknote className="h-3.5 w-3.5" /> نقدي
                    </button>
                    <button 
                       type="button"
                       onClick={() => setForm(f => ({ ...f, payment_method: 'bank_transfer', treasury_id: "" }))}
                       className={`flex items-center justify-center gap-2 rounded-sm border py-2 text-[11px] font-black transition-all ${form.payment_method === 'bank_transfer' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                       <CreditCard className="h-3.5 w-3.5" /> بنك / فيزا
                    </button>
                 </div>
              </div>

              {/* Source Selection */}
              <div className="col-span-1 space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">المصدر المالي</label>
                  <select 
                     ref={sourceRef}
                     value={form.payment_method === 'cash' ? form.treasury_id : form.bank_id}
                     onChange={(e) => setForm(f => ({ ...f, [form.payment_method === 'cash' ? 'treasury_id' : 'bank_id']: e.target.value }))}
                     onKeyDown={e => handleKeyDown(e, { nextRef: employeeRef, prevRef: descRef })}
                     className="w-full rounded-sm border border-slate-200 py-2 pl-3 pr-3 text-2sm font-bold text-slate-700 outline-none"
                  >
                     <option value="">{form.payment_method === 'cash' ? 'اختر الخزينة...' : 'اختر الحساب البنكي...'}</option>
                     {form.payment_method === 'cash' ? treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
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
                        className="w-full rounded-sm border border-slate-200 py-2 pl-4 pr-10 text-2sm font-black text-slate-800 outline-none"
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
                     className="w-full rounded-sm border border-slate-200 bg-slate-50 p-3 text-2sm font-bold text-slate-700 outline-none focus:bg-white resize-none"
                     rows="2"
                  />
              </div>
           </div>

           <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <button 
                 type="button"
                 onClick={onClose}
                 className="rounded-sm border border-slate-200 px-6 py-2.5 text-sm font-black text-slate-500 hover:bg-slate-50 transition-colors"
              >
                 إلغاء التغييرات
              </button>
              <button 
                 type="submit"
                 disabled={loading}
                 className="flex items-center gap-2 rounded-sm bg-rose-900 px-10 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-800 active:scale-95 disabled:opacity-50"
              >
                 {loading ? 'جاري الحفظ...' : (
                    <>
                       <CheckCircle2 className="h-4 w-4" /> حفظ مصروف جديد
                    </>
                 )}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
