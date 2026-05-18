import React, { useEffect, useState } from "react";
import { Edit, Plus, Tag, Trash2, Calendar, Percent, Power, Loader2, Info } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";
import PageWrapper from "../../components/ui/PageWrapper";
import Modal from "../../components/ui/Modal";

export default function PromotionsPage() {
  usePageTour('promotions');
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState(null);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    rule_type: "percentage_off_total",
    rule_value: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  async function fetchPromotions() {
    setLoading(true);
    try {
      const res = await api.get("/api/promotions");
      if (res.data?.success) setPromotions(res.data.data);
    } catch {
      toast.error("تعذر تحميل العروض");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      id: null,
      name: "",
      rule_type: "percentage_off_total",
      rule_value: "",
      starts_at: "",
      ends_at: "",
      is_active: true,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const payload = {
        name: formData.name,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
        is_active: formData.is_active,
        rule_json: {
          type: formData.rule_type,
          value: Number(formData.rule_value),
        },
      };

      if (formData.id) {
        await api.put(`/api/promotions/${formData.id}`, payload);
        toast.success("تم تحديث العرض");
      } else {
        await api.post("/api/promotions", payload);
        toast.success("تمت إضافة العرض");
      }

      setOpenModal(false);
      resetForm();
      fetchPromotions();
    } catch {
      toast.error("حدث خطأ أثناء حفظ العرض");
    }
  }

  async function handleDelete() {
    if (!promotionToDelete) return;
    try {
      await api.delete(`/api/promotions/${promotionToDelete.id}`);
      toast.success("تم حذف العرض");
      setPromotionToDelete(null);
      fetchPromotions();
    } catch {
      toast.error("فشل حذف العرض");
    }
  }

  function openEdit(row) {
    let rule = {};
    try {
      rule = typeof row.rule_json === "string" ? JSON.parse(row.rule_json) : row.rule_json || {};
    } catch {
      rule = {};
    }

    setFormData({
      id: row.id,
      name: row.name,
      rule_type: rule.type || "percentage_off_total",
      rule_value: rule.value || "",
      starts_at: row.starts_at || "",
      ends_at: row.ends_at || "",
      is_active: Boolean(row.is_active),
    });
    setOpenModal(true);
  }

  return (
    <PageWrapper>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-12 animate-fade-in">
        
        {/* Custom Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col gap-2 relative z-10">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Tag className="w-5 h-5" />
              <span className="text-[11px] font-black uppercase tracking-widest">قواعد الخصم والعروض الزمنية</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">العروض الترويجية</h1>
            <p className="text-[13px] font-bold text-slate-500 max-w-lg leading-relaxed">
              إدارة حملات الخصم ضمن نفس اللغة البصرية للنظام، مع وضوح في المدة والحالة والإجراءات اليومية.
            </p>
          </div>
          <PermissionGate page="promotions" action="add">
            <button
              onClick={() => { resetForm(); setOpenModal(true); }}
              className="group relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-6 text-[13px] font-black text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(79,70,229,0.4)] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] skew-x-[-15deg] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
              <Plus className="h-4 w-4 relative z-10" />
              <span className="relative z-10">عرض جديد</span>
            </button>
          </PermissionGate>
        </div>

        {/* Main Content */}
        <div>
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span className="text-[12px] font-bold text-slate-500">جاري تحميل العروض...</span>
            </div>
          ) : promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center mt-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100">
                <Tag className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-800">لا يوجد عروض حالياً</h3>
                <p className="text-[13px] font-bold text-slate-500 mt-1">ابدأ بإنشاء أول عرض ترويجي لعملائك</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {promotions.map(promo => {
                 const isActive = promo.is_active;
                 let rule = {};
                 try { rule = typeof promo.rule_json === "string" ? JSON.parse(promo.rule_json) : promo.rule_json || {}; } catch { rule = {}; }
                 
                 return (
                   <div key={promo.id} className="group flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-[0_12px_30px_-10px_rgba(79,70,229,0.15)] relative overflow-hidden">
                      {/* Background accent */}
                      <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none transition-opacity duration-500 ${isActive ? 'bg-emerald-400/10 group-hover:bg-emerald-400/20' : 'bg-slate-300/10'}`} />
                      
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black tracking-widest uppercase ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50' : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200/50'}`}>
                            {isActive ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                            {isActive ? "نشط" : "متوقف"}
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                            <PermissionGate page="promotions" action="edit">
                              <button onClick={() => openEdit(promo)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </PermissionGate>
                            <PermissionGate page="promotions" action="delete">
                              <button onClick={() => setPromotionToDelete(promo)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </PermissionGate>
                          </div>
                        </div>
                        
                        <h3 className="text-[18px] font-black text-slate-800 mb-1 leading-tight">{promo.name}</h3>
                        
                        <div className="flex items-center gap-2 mt-4 text-[13px] font-bold text-slate-600">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                            <Percent className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase">قيمة الخصم</span>
                            <span className="text-[14px] font-black font-mono text-indigo-700">{rule.value}% <span className="text-[11px] font-bold text-slate-500 font-sans">من الإجمالي</span></span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex items-center gap-4 border-t border-slate-50 pt-4 relative z-10">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase"><Calendar className="w-3 h-3" /> يبدأ</span>
                          <span className="text-[12px] font-bold text-slate-700 font-mono">{promo.starts_at || "—"}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-100" />
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase"><Calendar className="w-3 h-3" /> ينتهي</span>
                          <span className="text-[12px] font-bold text-slate-700 font-mono">{promo.ends_at || "—"}</span>
                        </div>
                      </div>
                   </div>
                 );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={openModal} onClose={() => setOpenModal(false)} title={null} size="md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">{formData.id ? "تعديل عرض ترويجي" : "عرض ترويجي جديد"}</h2>
              <p className="text-[12px] font-bold text-slate-500 mt-0.5">قم بضبط إعدادات الخصم وفترة الصلاحية</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest">اسم العرض</label>
              <input 
                required 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} 
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-bold text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                placeholder="مثال: خصم عيد الفطر"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest">نوع الخصم</label>
                <div className="relative">
                  <select 
                    value={formData.rule_type} 
                    onChange={(e) => setFormData(p => ({...p, rule_type: e.target.value}))}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 py-3 text-[13px] font-bold text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="percentage_off_total">خصم نسبة (%) من الإجمالي</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest">النسبة (%)</label>
                <div className="relative">
                  <input 
                    required 
                    type="number" 
                    min="1" max="100" 
                    value={formData.rule_value} 
                    onChange={(e) => setFormData(p => ({...p, rule_value: e.target.value}))} 
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-black font-mono text-indigo-700 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 text-left"
                    placeholder="0"
                    dir="ltr"
                  />
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> يبدأ في</label>
                <input 
                  type="date" 
                  value={formData.starts_at} 
                  onChange={(e) => setFormData(p => ({...p, starts_at: e.target.value}))} 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-bold font-mono text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> ينتهي في</label>
                <input 
                  type="date" 
                  value={formData.ends_at} 
                  onChange={(e) => setFormData(p => ({...p, ends_at: e.target.value}))} 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-bold font-mono text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${formData.is_active ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${formData.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                    <Power className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[14px] font-black ${formData.is_active ? 'text-emerald-900' : 'text-slate-700'}`}>حالة العرض</span>
                    <span className={`text-[11px] font-bold ${formData.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>{formData.is_active ? 'العرض مفعل وجاهز للتطبيق' : 'العرض متوقف مؤقتاً'}</span>
                  </div>
                </div>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-1' : 'translate-x-6'}`} />
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setOpenModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[13px] font-black text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                إلغاء
              </button>
              <button 
                type="submit"
                className="flex-[2] rounded-xl bg-indigo-600 px-4 py-3.5 text-[14px] font-black text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-100 active:scale-[0.98]"
              >
                حفظ التغييرات
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal open={Boolean(promotionToDelete)} onClose={() => setPromotionToDelete(null)} title={null} size="sm">
        <div className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 mb-4">
            <Trash2 className="h-6 w-6 text-rose-600" />
          </div>
          <h3 className="text-[18px] font-black text-slate-800 mb-2">حذف العرض</h3>
          <p className="text-[13px] font-bold text-slate-500 mb-6">
            سيتم حذف العرض "{promotionToDelete?.name || ""}" نهائياً. هل تريد المتابعة؟
          </p>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setPromotionToDelete(null)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-black text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              تراجع
            </button>
            <button 
              type="button" 
              onClick={handleDelete}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-[13px] font-black text-white shadow-sm transition-all hover:bg-rose-700 active:scale-[0.98]"
            >
              نعم، احذف
            </button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
