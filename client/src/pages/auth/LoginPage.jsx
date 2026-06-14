import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, LogIn, Loader2, X, Monitor, Zap, Wallet, ShieldCheck, Barcode, Receipt, CreditCard, ShoppingCart, Tag, Banknote, Calculator, Radar, LockKeyhole, CheckCircle2, ShieldAlert, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { usePerformanceStore, applyToDOM } from "../../stores/performanceStore";
import api from "../../services/api";
import { applyColorTheme } from "../../utils/applyColorTheme";
import PerformanceSettings from "../../components/ui/PerformanceSettings";

const highlights = [
  {
    title: "نقطة بيع أسرع",
    description: "إدخال واضح بدون خطوات زائدة، مع تركيز على السرعة داخل الفاتورة.",
    icon: Zap,
  },
  {
    title: "تحكم مالي مباشر",
    description: "المبيعات، الخزائن، وحركة التحصيل في نفس السياق وبنفس اللغة البصرية.",
    icon: Wallet,
  },
  {
    title: "أمان تشغيلي ثابت",
    description: "صلاحيات واضحة، تتبع أدق، وتجربة متسقة لكل فروعك.",
    icon: ShieldCheck,
  },
];

const posParticles = [
  { Icon: Barcode, size: 36, top: '15%', left: '10%', delay: '0s', duration: '14s' },
  { Icon: Receipt, size: 48, top: '25%', left: '85%', delay: '2s', duration: '18s' },
  { Icon: CreditCard, size: 40, top: '75%', left: '15%', delay: '1s', duration: '15s' },
  { Icon: ShoppingCart, size: 56, top: '80%', left: '80%', delay: '4s', duration: '20s' },
  { Icon: Tag, size: 32, top: '45%', left: '55%', delay: '5s', duration: '12s' },
  { Icon: Banknote, size: 50, top: '60%', left: '30%', delay: '1.5s', duration: '16s' },
  { Icon: Calculator, size: 44, top: '20%', left: '60%', delay: '3s', duration: '19s' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [form, setForm] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "idle", message: "" });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [customerBranding, setCustomerBranding] = useState({ logo_url: null, company_name: "", branch_name: "" });
  const perfPreset = usePerformanceStore((s) => s.preset);
  const perfSettings = usePerformanceStore((s) => s.settings);

  useEffect(() => {
    api.get("/api/settings").then((res) => {
      const data = res.data?.data || {};
      // Refine the boot theme with the full settings payload so the login screen
      // reflects the shop's selected color theme (including custom-theme variables).
      applyColorTheme(data);
      setCustomerBranding({
        logo_url: data.logo_url || null,
        company_name: data.company_name || "",
        branch_name: data.branch_name || "",
        app_name: data.app_name || "",
        app_subtitle: data.app_subtitle || "",
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    applyToDOM(perfPreset, perfSettings);
  }, [perfPreset, perfSettings]);

  useEffect(() => {
    if (feedback.type !== "success") return undefined;
    const timer = window.setTimeout(() => navigate("/dashboard"), 1400);
    return () => window.clearTimeout(timer);
  }, [feedback.type, navigate]);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFeedback({ type: "idle", message: "" });

    try {
      const response = await api.post("/api/auth/login", form);
      setSession(response.data.data);
      const loggedUsername = String(response?.data?.data?.user?.username || "").trim().toLowerCase();
      
      setFeedback({ 
        type: "success", 
        message: loggedUsername === "m7mod"
                 ? "تم تسجيل دخول المطور بنجاح. جاري فتح النظام..."
                 : "تم التحقق بنجاح. جاري فتح النظام..."
      });
    } catch (_error) {
      setFeedback({
        type: "error",
        message: "فشل الدخول. الرجاء التحقق من الحساب وكلمة المرور.",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-[var(--bg-base)] text-slate-800 font-sans selection:bg-emerald-500/20" dir="rtl">
      
      {/* ─── FULL-BLEED POS ANIMATED ENVIRONMENT ─── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        
        {/* Sky/Atmosphere Layer */}
        <div className="absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-emerald-50/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-t from-teal-50/60 to-transparent opacity-80" />
        
        {/* Volumetric Lights */}
        <div className="absolute top-[-5%] left-[50%] w-[1000px] h-[1000px] bg-emerald-200/50 rounded-full blur-[140px] animate-[spin_50s_linear_infinite] mix-blend-multiply origin-center" />
        <div className="absolute top-[20%] right-[70%] w-[800px] h-[800px] bg-cyan-200/40 rounded-full blur-[120px] animate-[spin_40s_reverse_linear_infinite] mix-blend-multiply origin-center" />
        
        {/* Floating Point-of-Sale Elements inside Glass Spheres */}
        {posParticles.map((p, i) => (
          <div 
            key={i} 
            className="absolute flex items-center justify-center bg-white/30 backdrop-blur-md border border-white/60 shadow-[0_8px_32px_rgba(5,150,105,0.06)] rounded-3xl animate-[float_10s_ease-in-out_infinite]"
            style={{ 
              top: p.top, 
              left: p.left, 
              width: p.size * 2.2, 
              height: p.size * 2.2,
              animationDuration: p.duration,
              animationDelay: p.delay,
              transform: `rotate(${i % 2 === 0 ? '-10deg' : '15deg'})`
            }}
          >
            <p.Icon size={p.size} className="text-emerald-700/30" strokeWidth={1.5} />
          </div>
        ))}
        
        {/* Architectural Grid Overlay for Depth */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, var(--primary-600) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>

      {/* ─── MAIN LAYOUT ─── */}
      <div className="relative z-10 w-full max-w-[1320px] mx-auto p-6 md:p-12 min-h-screen flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* LEFT: Branding & Typography */}
          <div className="flex flex-col space-y-8 order-2 lg:order-1 relative z-20">
            {/* Shop Branding — customer logo + company name (if set) */}
            {customerBranding.logo_url || customerBranding.company_name ? (
              <div className="flex items-center space-x-3 space-x-reverse w-max bg-white/80 border border-white px-5 py-2.5 rounded-full backdrop-blur-xl shadow-[0_4px_16px_rgba(5,150,105,0.06)] group cursor-default">
                {customerBranding.logo_url ? (
                  <img src={customerBranding.logo_url} alt="" className="w-8 h-8 rounded-full object-contain border border-slate-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center border border-emerald-200/60 shadow-inner">
                    <Radar className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-2sm font-black tracking-[0.2em] text-emerald-800 uppercase leading-tight">{customerBranding.company_name || "ElHegazi POS"}</span>
                  {customerBranding.branch_name && (
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider">{customerBranding.branch_name}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 space-x-reverse w-max bg-white/80 border border-white px-5 py-2.5 rounded-full backdrop-blur-xl shadow-[0_4px_16px_rgba(5,150,105,0.06)] group cursor-default">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center border border-emerald-200/60 shadow-inner animate-[subtle-drift_4s_ease-in-out_infinite] group-hover:scale-110 transition-transform duration-500">
                  <Radar className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-2sm font-black tracking-[0.2em] text-emerald-800 uppercase" style={{ fontFamily: 'var(--font-number)' }}>ElHegazi POS Framework</span>
              </div>
            )}

            {/* Massive Brand Showcase */}
            <div className="space-y-4 pt-2">
              <h1 className="text-6xl md:text-7xl lg:text-[86px] font-black leading-[1.3] text-slate-900 drop-shadow-sm">
                {customerBranding.app_name || "الحجازي"}
              </h1>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 drop-shadow-sm pb-2 leading-[1.5]">
                {customerBranding.app_subtitle || "منظومة التجزئة الذكية"}
              </h2>
              <p className="text-lg md:text-xl text-slate-500 max-w-lg leading-[1.8] font-medium mt-4">
                نظام نقاط بيع صُمم خصيصاً للسرعة القصوى، دقة العمليات المحاسبية، وتوفير بيئة تشغيلية آمنة ومريحة لكل فروعك.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-5 mt-4">
              {highlights.map((item, idx) => (
                <div key={idx} className="group relative flex items-start space-x-5 space-x-reverse p-6 rounded-3xl bg-white/70 border border-white hover:bg-white hover:border-emerald-100/50 hover:shadow-[0_16px_40px_rgba(5,150,105,0.08),0_4px_16px_rgba(5,150,105,0.04)] hover:-translate-y-1 transition-all duration-500 backdrop-blur-xl">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-50/0 to-emerald-50/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="relative z-10 flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/30 text-emerald-600 border border-emerald-100/50 group-hover:scale-110 group-hover:bg-emerald-100 group-hover:rotate-3 transition-all duration-500 shadow-sm">
                    <item.icon className="w-6 h-6 stroke-[2px]" />
                  </div>
                  <div className="relative z-10 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-slate-900 mb-1.5">{item.title}</h3>
                    <p className="text-[15px] text-slate-500 font-medium leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: The Authentication Form */}
          <div className="relative w-full max-w-[460px] mx-auto lg:mr-auto lg:ml-0 order-1 lg:order-2">
            
            {/* Form Container (Premium Soft Glass) */}
            <div className="relative bg-white/95 backdrop-blur-3xl border-t border-l border-white border-r border-b border-slate-200/60 rounded-[2.5rem] p-10 md:p-12 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.08),0_0_1px_1px_rgba(15,23,42,0.03)]">
              
              <div className="flex flex-col mb-10 text-right">
                <div className="flex items-center gap-3 mb-6">
                  {customerBranding.logo_url && (
                    <img src={customerBranding.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain border border-slate-200" />
                  )}
                  <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/80 rounded-[1.25rem] text-emerald-600 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_12px_rgba(5,150,105,0.08)] animate-[subtle-drift_4s_ease-in-out_infinite_reverse]">
                    <LockKeyhole className="w-8 h-8 stroke-[2px]" />
                  </div>
                </div>
                <div className="text-[11px] font-black text-emerald-500 tracking-[0.2em] uppercase mb-3">Secure Sign-in</div>
                <h2 className="text-[32px] font-black text-slate-900 tracking-tight mb-2 leading-tight">تسجيل الدخول</h2>
                <p className="text-[15px] text-slate-500 font-medium mt-1">أدخل بياناتك لبدء جلسة عمل جديدة داخل النظام.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-6">
                
                {/* Username Field */}
                <div className={`relative rounded-2xl border-2 transition-all duration-300 bg-slate-50/80 group overflow-hidden ${focusedField === 'username' ? 'border-emerald-500 bg-white shadow-[0_4px_20px_rgba(5,150,105,0.12)]' : 'border-slate-200/80 hover:border-slate-300 hover:bg-white'}`}>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <span className={`text-2sm font-black tracking-widest uppercase transition-colors duration-300 ${focusedField === 'username' ? 'text-emerald-500' : 'text-slate-400 group-hover:text-slate-500'}`}>ID</span>
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-transparent py-4 pl-4 pr-16 text-slate-900 placeholder-slate-400 focus:outline-none transition-all font-bold text-[17px] leading-normal"
                    placeholder="اسم المستخدم"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                  {focusedField === 'username' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />}
                </div>

                {/* Password Field with Added View Toggle */}
                <div className={`relative rounded-2xl border-2 transition-all duration-300 bg-slate-50/80 group overflow-hidden ${focusedField === 'password' ? 'border-emerald-500 bg-white shadow-[0_4px_20px_rgba(5,150,105,0.12)]' : 'border-slate-200/80 hover:border-slate-300 hover:bg-white'}`}>
                   <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <span className={`text-2sm font-black tracking-widest uppercase transition-colors duration-300 ${focusedField === 'password' ? 'text-emerald-500' : 'text-slate-400 group-hover:text-slate-500'}`}>PW</span>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-transparent py-4 pl-14 pr-16 text-slate-900 placeholder-slate-400 focus:outline-none transition-all font-mono tracking-widest text-[17px] leading-normal selection:bg-emerald-200"
                    placeholder="••••••••"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                  <div className="absolute inset-y-0 left-2 flex items-center z-10 my-auto">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                        showPassword 
                          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' 
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {focusedField === 'password' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />}
                </div>

                {/* Action Area */}
                <div className="pt-4 flex flex-col gap-4 relative z-10 w-full overflow-hidden">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group relative w-full flex items-center justify-center bg-[var(--primary)] text-white font-black text-[18px] py-[20px] rounded-2xl overflow-hidden transition-all duration-300 hover:bg-[var(--primary-600)] hover:shadow-[0_12px_32px_var(--primary-glow)] hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {/* Embedded sheen effect over the button */}
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-0 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-[shine_1.5s]" />
                    <span className="relative z-10 flex items-center gap-3">
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                          جاري التحقق...
                        </>
                      ) : (
                        "دخول النظام"
                      )}
                    </span>
                  </button>
                </div>

                {/* Feedback Alerts */}
                {feedback.type !== "idle" && (
                  <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-2 ${
                    feedback.type === "success" 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-[0_4px_16px_rgba(5,150,105,0.1)]" 
                      : "bg-red-50 border-red-200 text-red-800 shadow-[0_4px_16px_rgba(220,38,38,0.1)]"
                  }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0" />}
                    <p className="text-sm font-bold leading-relaxed">{feedback.message}</p>
                  </div>
                )}

                {/* Performance settings toggle */}
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPerf(true)}
                    className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Graphics
                  </button>
                </div>
              </form>
            </div>
            
            {/* Form Bottom Footnote */}
            <p className="text-center text-slate-400 text-sm font-semibold mt-8 drop-shadow-sm">الجلسة محلية وآمنة. تم اعتماد مظهر موحد للنظام بالكامل.</p>

            {/* Performance Settings Modal */}
            {showPerf && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowPerf(false)}>
                <div
                  className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black text-slate-900">إعدادات الرسوميات والأداء</h2>
                    <button
                      type="button"
                      onClick={() => setShowPerf(false)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <PerformanceSettings />
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
