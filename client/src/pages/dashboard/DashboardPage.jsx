import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart, PackageSearch, Receipt, ArrowRightLeft,
  Wallet, TrendingDown, TrendingUp, Landmark, Boxes,
  Users, Building, FileSpreadsheet, Command, X, Play, Tag, Activity,
  Plus, CreditCard, ChevronLeft, ShieldCheck, Settings, BookOpenCheck,
  ClipboardList
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
      if (e.key === "F2") { e.preventDefault(); navigate("/pos"); }
      if (e.key === "F3") { e.preventDefault(); navigate("/analytics"); }
      if (e.key === "Escape" && purchaseModalOpen) { setPurchaseModalOpen(false); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, purchaseModalOpen]);

  return (
    <div className="flex flex-col min-h-full font-sans bg-[#F4F7FB] p-4 md:p-8 relative overflow-hidden" dir="rtl">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-emerald-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Modern Greeting */}
      <div className="flex items-center justify-between mb-8 relative z-10 mx-auto w-full max-w-[1400px]">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white p-3 rounded-[20px] shadow-[0_8px_20px_rgba(15,23,42,0.15)]">
            <Command className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              أهلاً بيك يا {user?.name?.split(' ')[0] || 'مدير'}
            </h1>
            <p className="text-[14px] font-bold text-slate-500 mt-1">المحطة المركزية لإدارة كافة العمليات بضغطة زر.</p>
          </div>
        </div>
        
        {/* Quick Insights Action */}
        <Link to="/analytics" className="hidden md:flex items-center gap-4 bg-white border border-slate-200 rounded-[20px] py-2 px-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group">
          <div className="flex flex-col text-left items-end">
            <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">نظرة عامة</span>
            <span className="text-[14px] font-bold text-slate-700">فتح التحليلات (F3)</span>
          </div>
          <div className="w-10 h-10 rounded-[14px] bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-500 transition-colors">
            <Activity className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {/* =======================
          THE STRICT BENTO GRID
          ======================= */}
      <div className="mx-auto w-full max-w-[1400px] grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-5 relative z-10 flex-1 auto-rows-max">
        
        {/* ROW 1: POS HERO & FINANCE 2x2 */}
        
        {/* POS BLOCK (Right Side - 8 cols) */}
        <div className="md:col-span-4 lg:col-span-8 relative group overflow-hidden rounded-[32px] bg-slate-900 shadow-xl flex flex-col justify-between border border-slate-800 min-h-[260px]">
          <div className="absolute left-[-5%] top-[-20%] opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
            <ShoppingCart className="w-96 h-96 text-emerald-400 rotate-[-15deg] transform group-hover:scale-110 transition-transform duration-700" />
          </div>
          
          <div className="p-8 relative z-10 flex flex-col flex-1 justify-center">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-[20px] bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                 <ShoppingCart className="w-7 h-7 text-emerald-400" />
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-1.5 rounded-full text-[12px] font-black font-mono tracking-widest uppercase">F2 Hotkey</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">شاشة الكاشير</h2>
            <p className="text-[16px] font-bold text-slate-300 opacity-80 max-w-xl leading-relaxed">بوابة المبيعات الرئيسية. انطلق لاستقبال العملاء وإصدار الفواتير بسرعة فائقة وبدون تأخير.</p>
          </div>

          <div className="px-6 pb-6 relative z-10">
            <Link to="/pos" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-[20px] py-4 text-[18px] font-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-3">
               <Play className="w-6 h-6 fill-slate-900" /> افتح الكاشير الآن
            </Link>
          </div>
        </div>

        {/* FINANCE BLOCK (Left Side - 4 cols, 2x2 Grid constraint) */}
        <div className="md:col-span-4 lg:col-span-4 bg-white rounded-[32px] p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between min-h-[260px]">
           <div className="flex items-center justify-between mb-4 px-1">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-[14px] bg-amber-50 text-amber-600 flex items-center justify-center">
                 <Wallet className="w-5 h-5" />
               </div>
               <div>
                 <h2 className="text-[16px] font-black text-slate-800">الماليات والخزينة</h2>
               </div>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-3 flex-1">
              <Link to="/revenues" className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col items-center justify-center gap-2 hover:border-teal-300 hover:shadow-[0_8px_20px_rgba(20,184,166,0.15)] hover:bg-white transition-all group">
                 <div className="w-10 h-10 rounded-full bg-white group-hover:bg-teal-50 text-teal-500 flex items-center justify-center shadow-sm border border-slate-100 group-hover:border-teal-100 transition-colors">
                   <TrendingUp className="w-5 h-5" />
                 </div>
                 <span className="text-[13px] font-black text-slate-700 group-hover:text-teal-700">سجل إيراد</span>
              </Link>

              <Link to="/expenses" className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col items-center justify-center gap-2 hover:border-rose-300 hover:shadow-[0_8px_20px_rgba(244,63,94,0.15)] hover:bg-white transition-all group">
                 <div className="w-10 h-10 rounded-full bg-white group-hover:bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm border border-slate-100 group-hover:border-rose-100 transition-colors">
                   <TrendingDown className="w-5 h-5" />
                 </div>
                 <span className="text-[13px] font-black text-slate-700 group-hover:text-rose-700">سجل مصروف</span>
              </Link>

              <Link to="/payments" className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-[0_8px_20px_rgba(99,102,241,0.15)] hover:bg-white transition-all group">
                 <div className="w-10 h-10 rounded-full bg-white group-hover:bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-sm border border-slate-100 group-hover:border-indigo-100 transition-colors">
                   <CreditCard className="w-5 h-5" />
                 </div>
                 <span className="text-[13px] font-black text-slate-700 group-hover:text-indigo-700">القبض والدفع</span>
              </Link>

              <Link to="/operations/treasury-transfer" className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col items-center justify-center gap-2 hover:border-amber-300 hover:shadow-[0_8px_20px_rgba(245,158,11,0.15)] hover:bg-white transition-all group">
                 <div className="w-10 h-10 rounded-full bg-white group-hover:bg-amber-50 text-amber-500 flex items-center justify-center shadow-sm border border-slate-100 group-hover:border-amber-100 transition-colors">
                   <Landmark className="w-5 h-5" />
                 </div>
                 <span className="text-[13px] font-black text-slate-700 group-hover:text-amber-700">التحويلات</span>
              </Link>
           </div>
        </div>

        {/* ROW 2: PURCHASES, RETURNS, INVENTORY */}
        
        {/* PURCHASES BLOCK (4 Cols) */}
        <div 
          className="md:col-span-2 lg:col-span-4 bg-white rounded-[32px] border border-slate-200/80 p-6 flex flex-col justify-center gap-4 cursor-pointer hover:border-violet-300 hover:shadow-[0_15px_30px_rgba(139,92,246,0.15)] transition-all group min-h-[220px]"
          onClick={() => setPurchaseModalOpen(true)}
        >
           <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-[20px] bg-violet-50 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors border border-violet-100">
                 <PackageSearch className="w-7 h-7" />
              </div>
              <span className="bg-violet-50 text-violet-600 px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border border-violet-100">بوابة المـوردين</span>
           </div>
           <div>
             <h3 className="text-[22px] font-black text-slate-800">إدارة المشتريات</h3>
             <p className="text-[13px] font-bold text-slate-400 mt-1">سجل فواتير وأوامر الشراء وإدارة حسابات الموردين من هنا.</p>
           </div>
        </div>

        {/* INVENTORY BLOCK (4 Cols) */}
        <div className="md:col-span-2 lg:col-span-4 bg-white rounded-[32px] border border-slate-200/80 p-6 flex flex-col justify-between min-h-[220px]">
           <div className="flex items-center gap-3 mb-4">
             <div className="w-12 h-12 rounded-[16px] bg-blue-50 text-blue-600 flex items-center justify-center">
               <Boxes className="w-6 h-6" />
             </div>
             <div>
               <h3 className="text-[18px] font-black text-slate-800 tracking-tight">مراقبة المخزون</h3>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-2 flex-1">
              <Link to="/stock/levels" className="bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-100 hover:border-blue-200 text-slate-700 rounded-[14px] flex items-center justify-center text-[13px] font-black transition-all p-3 shadow-sm text-center">
                 أرصدة المخازن
              </Link>
              <Link to="/stock/movements" className="bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-100 hover:border-blue-200 text-slate-700 rounded-[14px] flex items-center justify-center text-[13px] font-black transition-all p-3 shadow-sm text-center">
                 المـقـلـم
              </Link>
              <Link to="/stock/physical-count" className="bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-100 hover:border-blue-200 text-slate-700 rounded-[14px] flex items-center justify-center text-[13px] font-black transition-all p-3 shadow-sm text-center">
                 جرد فعلي وتسوية
              </Link>
              <Link to="/stock/transfer" className="bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-100 hover:border-blue-200 text-slate-700 rounded-[14px] flex items-center justify-center text-[13px] font-black transition-all p-3 shadow-sm text-center">
                 تحويل بضاعة
              </Link>
           </div>
        </div>

        {/* RETURNS SECTION (4 Cols, Stacked Vertically) */}
        <div className="md:col-span-4 lg:col-span-4 grid grid-rows-2 gap-5 min-h-[220px]">
           <Link to="/sales/returns" className="bg-white rounded-[24px] border border-slate-200/80 p-5 flex items-center gap-4 hover:border-orange-300 hover:shadow-[0_8px_20px_rgba(249,115,22,0.15)] transition-all group">
              <div className="w-12 h-12 rounded-[16px] bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors border border-orange-100 shrink-0">
                 <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[16px] font-black text-slate-800">مرتجعات مبيعات</h3>
                <p className="text-[12px] font-bold text-slate-400">استرجاع بضاعة واسترداد نقدي لعميل</p>
              </div>
           </Link>

           <Link to="/purchases/returns" className="bg-white rounded-[24px] border border-slate-200/80 p-5 flex items-center gap-4 hover:border-rose-300 hover:shadow-[0_8px_20px_rgba(244,63,94,0.15)] transition-all group">
              <div className="w-12 h-12 rounded-[16px] bg-rose-50 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors border border-rose-100 shrink-0">
                 <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[16px] font-black text-slate-800">مرتجعات مشتريات</h3>
                <p className="text-[12px] font-bold text-slate-400">إرجاع بضاعة تالفة وتسوية للمورد</p>
              </div>
           </Link>
        </div>

        {/* ROW 3: FOUNDATIONAL ENTITIES (12 cols, 4 uniform blocks) */}
        <div className="md:col-span-4 lg:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-5">
           <Link to="/definitions/items" className="bg-white border border-slate-200/80 rounded-[24px] p-5 flex items-center gap-4 hover:border-cyan-300 hover:shadow-[0_8px_20px_rgba(6,182,212,0.1)] transition-all group">
              <div className="w-12 h-12 rounded-[16px] bg-cyan-50 text-cyan-500 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-colors border border-cyan-100">
                <Tag className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-black text-slate-800 group-hover:text-cyan-700">دليل الأصناف</span>
                <span className="text-[12px] font-bold text-slate-400">كروت وتوليفة البضاعة</span>
              </div>
           </Link>

           <Link to="/definitions/customers" className="bg-white border border-slate-200/80 rounded-[24px] p-5 flex items-center gap-4 hover:border-emerald-300 hover:shadow-[0_8px_20px_rgba(16,185,129,0.1)] transition-all group">
              <div className="w-12 h-12 rounded-[16px] bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors border border-emerald-100">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-black text-slate-800 group-hover:text-emerald-700">قاعدة العملاء</span>
                <span className="text-[12px] font-bold text-slate-400">حسابات، بيانات، وأرصدة</span>
              </div>
           </Link>

           <Link to="/definitions/suppliers" className="bg-white border border-slate-200/80 rounded-[24px] p-5 flex items-center gap-4 hover:border-fuchsia-300 hover:shadow-[0_8px_20px_rgba(217,70,239,0.1)] transition-all group">
              <div className="w-12 h-12 rounded-[16px] bg-fuchsia-50 text-fuchsia-500 flex items-center justify-center group-hover:bg-fuchsia-500 group-hover:text-white transition-colors border border-fuchsia-100">
                <Building className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-black text-slate-800 group-hover:text-fuchsia-700">دليل الموردين</span>
                <span className="text-[12px] font-bold text-slate-400">محفظة الشركات الموردة</span>
              </div>
           </Link>
           
           <Link to="/settings" className="bg-slate-800 border border-slate-700 rounded-[24px] p-5 flex items-center gap-4 hover:bg-slate-900 shadow-md transition-all group">
              <div className="w-12 h-12 rounded-[16px] bg-slate-700 text-slate-300 flex items-center justify-center transition-colors">
                <Settings className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-black text-white px-1">إعدادات النظام</span>
                <span className="text-[12px] font-bold text-slate-400 px-1">تهيئة الفروع والمستخدمين</span>
              </div>
           </Link>
        </div>

      </div>

      {/* =======================
          THE PURCHASES MODAL OVERLAY
          ======================= */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPurchaseModalOpen(false)} />
           
           <div className="bg-white rounded-[32px] p-8 max-w-[800px] w-full shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-slate-200 relative z-10 animate-in zoom-in-95 duration-300 flex flex-col">
              <button onClick={() => setPurchaseModalOpen(false)} className="absolute top-6 left-6 w-10 h-10 bg-slate-50 hover:bg-rose-50 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-5 mb-8">
                 <div className="w-16 h-16 rounded-[24px] bg-violet-100 text-violet-600 flex items-center justify-center shadow-inner">
                   <PackageSearch className="w-8 h-8" />
                 </div>
                 <div>
                   <h2 className="text-3xl font-black text-slate-800">بوابة المشتريات</h2>
                   <p className="text-[14px] font-bold text-slate-500 mt-1">اختر العملية اللي محتاج تعملها مع الموردين</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Link to="/purchases" onClick={() => setPurchaseModalOpen(false)} className="bg-white border border-slate-200 rounded-[24px] p-6 flex flex-col items-start gap-4 hover:border-violet-400 hover:shadow-[0_10px_30px_rgba(139,92,246,0.15)] group transition-all">
                    <div className="w-14 h-14 rounded-[20px] bg-violet-50 group-hover:bg-violet-500 text-violet-600 group-hover:text-white border border-violet-100 flex items-center justify-center transition-colors">
                      <Plus className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-black text-slate-800 group-hover:text-violet-700 mb-1 transition-colors">فاتورة مشتريات جديدة</h3>
                      <p className="text-[13px] font-bold text-slate-500">سجل بضاعة جاتلك من المورد ودخلها المخزن على طول</p>
                    </div>
                 </Link>

                 <Link to="/purchases/returns" onClick={() => setPurchaseModalOpen(false)} className="bg-white border border-slate-200 rounded-[24px] p-6 flex flex-col items-start gap-4 hover:border-rose-400 hover:shadow-[0_10px_30px_rgba(244,63,94,0.15)] group transition-all">
                    <div className="w-14 h-14 rounded-[20px] bg-rose-50 group-hover:bg-rose-500 text-rose-600 group-hover:text-white border border-rose-100 flex items-center justify-center transition-colors">
                      <ArrowRightLeft className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-black text-slate-800 group-hover:text-rose-700 mb-1 transition-colors">مرتجع مشتريات</h3>
                      <p className="text-[13px] font-bold text-slate-500">هترجع بضاعة للمورد؟ سجلها هنا عشان تتخصم من الرصيد</p>
                    </div>
                 </Link>

                 <Link to="/purchases/orders" onClick={() => setPurchaseModalOpen(false)} className="bg-slate-50/50 border border-slate-200 rounded-[24px] p-5 flex flex-col items-start gap-3 hover:bg-white hover:border-blue-300 hover:shadow-sm group transition-all">
                    <div className="w-12 h-12 rounded-[16px] bg-white group-hover:bg-blue-50 text-blue-500 border border-slate-200 flex items-center justify-center shadow-sm transition-colors">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-black text-slate-800 group-hover:text-blue-700 mb-1 transition-colors">أوامر الشراء (طلبيات)</h3>
                      <p className="text-[12px] font-bold text-slate-500 truncate">تجهيز طلبيات هتبعتها للمورد</p>
                    </div>
                 </Link>

                 <Link to="/definitions/suppliers" onClick={() => setPurchaseModalOpen(false)} className="bg-slate-50/50 border border-slate-200 rounded-[24px] p-5 flex flex-col items-start gap-3 hover:bg-white hover:border-amber-300 hover:shadow-sm group transition-all">
                    <div className="w-12 h-12 rounded-[16px] bg-white group-hover:bg-amber-50 text-amber-500 border border-slate-200 flex items-center justify-center shadow-sm transition-colors">
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-black text-slate-800 group-hover:text-amber-700 mb-1 transition-colors">قاعدة الموردين</h3>
                      <p className="text-[12px] font-bold text-slate-500 truncate">راجِع أرصدتهم والمديونيات</p>
                    </div>
                 </Link>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
