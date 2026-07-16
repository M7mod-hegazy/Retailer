import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Zap, Wallet, ShieldCheck, LockKeyhole, CheckCircle2, ShieldAlert, Settings2, X } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { usePerformanceStore, applyToDOM } from "../../stores/performanceStore";
import api from "../../services/api";
import { applyColorTheme } from "../../utils/applyColorTheme";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import PerformanceSettings from "../../components/ui/PerformanceSettings";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useServerClock } from "../../hooks/useServerClock";
import ElHegaziMark from "../../components/branding/ElHegaziMark";

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

// The card's torn-receipt top edge — a zigzag silhouette in the paper color,
// poking up past the card's flat top into the dark surrounding panel so the
// card reads as if it were torn off a longer roll. Pure geometry, no image asset.
function ReceiptTornEdge({ teeth = 22, height = 13 }) {
  const w = 100;
  const step = w / teeth;
  const pts = [`0,${height}`];
  for (let i = 0; i <= teeth; i++) {
    pts.push(`${i * step},${i % 2 === 0 ? 0 : height}`);
  }
  pts.push(`${w},${height}`);
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: `${height}px`, position: "absolute", top: -height + 1, insetInlineStart: 0 }}
      aria-hidden="true"
    >
      <polygon points={pts.join(" ")} fill="#FBF8F1" />
    </svg>
  );
}

// Underline-style ledger field — replaces the boxed pill inputs with something
// closer to a line on a receipt: label above, a rule below that lights up gold
// on focus. Lighter and less "generic SaaS form" than a heavy rounded border box.
function LedgerField({ label, value, onChange, focused, onFocus, onBlur, inputRef, onKeyDown, type = "text", tag, trailing, placeholder }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#8A8578]">{label}</span>
        {tag && <span className="text-[9px] font-black uppercase tracking-widest text-[#B8B0A0]">{tag}</span>}
      </div>
      <div className={`relative flex items-center gap-2 border-b-2 transition-colors duration-300 ${focused ? "border-primary" : "border-[#E7E1D3] hover:border-[#D8CFB9]"}`}>
        <input
          ref={inputRef}
          type={type}
          required
          autoComplete={type === "password" ? "current-password" : "username"}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          dir="ltr"
          style={{ textAlign: "right" }}
          className="w-full bg-transparent py-3 text-[#16241D] placeholder-[#B8B0A0] focus:outline-none font-bold text-[17px] leading-normal"
        />
        {trailing}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [form, setForm] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "idle", message: "" });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    window.electronAPI?.getVersion?.().then((v) => {
      if (v) setAppVersion(v);
    });
  }, []);

  const { clockTime, clockDate } = useServerClock();
  const [customerBranding, setCustomerBranding] = useState({ logo_url: null, company_name: "", branch_name: "" });
  const perfPreset = usePerformanceStore((s) => s.preset);
  const perfSettings = usePerformanceStore((s) => s.settings);
  const handleKeyDown = useFieldNavigation();
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const submitBtnRef = useRef(null);

  useEffect(() => {
    api.get("/api/settings").then((res) => {
      const data = res.data?.data || {};
      // Refine the boot theme with the full settings payload so the rest of the
      // app (post-login) reflects the shop's selected color theme. This page's
      // own chrome stays on the fixed الحجازي brand identity regardless.
      applyColorTheme(data);
      setCustomerBranding({
        logo_url: resolveImageUrl(data.logo_url || null),
        company_name: data.company_name || "",
        branch_name: data.branch_name || "",
        app_name: data.app_name || "",
        app_subtitle: data.app_subtitle || "",
      });
    }).catch(() => { });
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
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-[#06120E] text-[#16241D] font-sans selection:bg-emerald-500/30" dir="rtl">

      {/* ─── Ambient ink environment ─── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/3 right-[-10%] w-[900px] h-[900px] rounded-full opacity-40 blur-[160px]" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-30 blur-[140px]" style={{ background: "radial-gradient(circle, rgba(245,166,35,0.18) 0%, transparent 70%)" }} />
        {/* faint ledger-line grain across the whole environment */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0px, #fff 1px, transparent 1px, transparent 34px)" }} />
        {/* one orchestrated moment: a scan-line sweeps down once on load */}
        <motion.div
          initial={{ top: "-5%", opacity: 0 }}
          animate={{ top: "105%", opacity: [0, 0.5, 0.5, 0] }}
          transition={{ duration: 2.2, ease: "easeInOut", delay: 0.15 }}
          className="absolute inset-x-0 h-24"
          style={{ background: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.16), transparent)" }}
        />
      </div>

      {/* ─── MAIN LAYOUT ─── */}
      <div className="relative z-10 w-full max-w-[1320px] mx-auto p-6 md:p-12 min-h-screen flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">

          {/* RIGHT (visual first, RTL): brand environment */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col space-y-8 order-2 lg:order-1 relative z-20"
          >
            {/* Shop's own branding (white-label) — separate from the الحجازي vendor identity below */}
            {(customerBranding.logo_url || customerBranding.company_name) && (
              <div className="flex items-center gap-3 w-max bg-white/[0.06] border border-white/10 px-4 py-2 rounded-full backdrop-blur-xl">
                {customerBranding.logo_url ? (
                  <img src={customerBranding.logo_url} alt="" className="w-7 h-7 rounded-full object-contain border border-white/20 bg-white/90" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center border border-white/15" />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-black tracking-widest text-white/85 uppercase">{customerBranding.company_name}</span>
                  {customerBranding.branch_name && (
                    <span className="text-[10px] font-bold text-white/45">{customerBranding.branch_name}</span>
                  )}
                </div>
              </div>
            )}

            {/* Mark + wordmark — the support number rides fused directly under the
                mark so it's never a detached footnote, always read as one unit */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <ElHegaziMark size={56} glow />
                <span dir="ltr" className="text-[11px] font-black tracking-wide text-white border border-white/30 rounded-full px-2.5 py-0.5" style={{ background: "rgba(255, 255, 255, 0.12)", fontVariantNumeric: "tabular-nums" }}>
                  01032440775
                </span>
              </div>
              <div>
                <h1
                  className="text-6xl md:text-7xl lg:text-[80px] font-bold leading-[1.15] text-white"
                  style={{ fontFamily: "'El Messiri', var(--font-body)" }}
                >
                  {customerBranding.app_name || "الحجازي"}
                </h1>
              </div>
            </div>
            <div className="-mt-4 space-y-3">
              <h2 className="text-2xl md:text-3xl font-black text-[#34D399]">
                {customerBranding.app_subtitle || "منظومة التجزئة الذكية"}
              </h2>
              <p className="text-[15px] md:text-base text-white/50 max-w-lg leading-[1.9] font-medium">
                نظام نقاط بيع صُمم خصيصاً للسرعة القصوى، دقة العمليات المحاسبية، وتوفير بيئة تشغيلية آمنة ومريحة لكل فروعك.
              </p>
            </div>

            {/* Feature readout — quiet dark rows, not glass cards */}
            <div className="space-y-1 pt-2">
              {highlights.map((item, idx) => (
                <div key={idx} className="group flex items-center gap-4 py-3.5 border-t border-white/[0.08] first:border-t-0">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 border border-emerald-400/15 group-hover:bg-emerald-400/15 transition-colors">
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white/90">{item.title}</h3>
                    <p className="text-[13px] text-white/40 font-medium leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* الحجازي vendor credit — quiet footer of the dark panel */}
            <div className="flex items-center gap-2 pt-2 text-white/30" dir="ltr">
              <span className="text-[11px] font-bold tracking-wide">01032440775</span>
              <span className="text-[11px]">·</span>
              <span dir="rtl" className="text-[11px] font-bold">الدعم الفني — الحجازي</span>
            </div>
          </motion.div>

          {/* LEFT (visual second, RTL): the receipt-card auth form */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="relative w-full max-w-[440px] mx-auto lg:mr-0 lg:ml-auto order-1 lg:order-2"
          >
            <div className="relative">
              <ReceiptTornEdge />
              <div className="relative bg-[#FBF8F1] rounded-b-[1.75rem] rounded-t-sm p-9 md:p-11 shadow-[0_30px_80px_-15px_rgba(0,0,0,0.55)]">

                {/* Receipt-style datetime stamp */}
                <div className="flex items-center justify-between mb-7 text-[#B8B0A0]" dir="ltr">
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-number)" }}>ELHEGAZI · POS</span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ fontFamily: "var(--font-number)" }}>{clockDate} — {clockTime}</span>
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 flex items-center justify-center bg-[#16241D] rounded-2xl text-primary shrink-0">
                    <LockKeyhole className="w-[22px] h-[22px]" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-[26px] font-black text-[#16241D] tracking-tight leading-tight">تسجيل الدخول</h2>
                    <p className="text-[13px] text-[#8A8578] font-bold mt-0.5">أدخل بياناتك لبدء جلسة عمل جديدة</p>
                  </div>
                </div>

                <form onSubmit={onSubmit} className="space-y-7">
                  <LedgerField
                    label="اسم المستخدم"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    focused={focusedField === "username"}
                    onFocus={() => setFocusedField("username")}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: passwordRef })}
                    inputRef={usernameRef}
                  />

                  <LedgerField
                    label="كلمة المرور"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    focused={focusedField === "password"}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: usernameRef })}
                    inputRef={passwordRef}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="shrink-0 p-1 text-[#B8B0A0] hover:text-[#16241D] transition-colors"
                        aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    }
                  />

                  <button
                    ref={submitBtnRef}
                    type="submit"
                    disabled={submitting}
                    className="group relative w-full flex items-center justify-center bg-primary text-white font-black text-[17px] py-[18px] rounded-2xl overflow-hidden transition-all duration-300 hover:bg-primary-600 hover:shadow-[0_14px_34px_var(--primary-glow)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
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

                  <AnimatePresence>
                    {feedback.type !== "idle" && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className={`p-4 rounded-xl flex items-center gap-3 border ${feedback.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-red-50 border-red-200 text-red-800"
                          }`}
                      >
                        {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0" />}
                        <p className="text-sm font-bold leading-relaxed">{feedback.message}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

                {/* Footer — dashed tear rule echoing a receipt's cut line */}
                <div className="mt-8 pt-5 border-t border-dashed border-[#D8CFB9] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#B8B0A0]">
                    <ElHegaziMark size={14} />
                    <span className="text-[10px] font-black tracking-widest">الحجازي</span>
                    {appVersion && <span className="text-[10px] font-bold" dir="ltr">· {appVersion.replace(/^v/i, "")}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPerf(true)}
                    title="إعدادات الرسوميات والأداء"
                    className="p-1.5 text-[#B8B0A0] hover:text-[#16241D] transition-colors"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Settings Modal */}
            {showPerf && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPerf(false)}>
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
          </motion.div>

        </div>
      </div>
    </div>
  );
}
