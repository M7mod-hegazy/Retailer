import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  CheckCircle2,
  ArrowDownCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  Server,
  Zap,
} from "lucide-react";
import { useUpdateStore } from "../../stores/updateStore";
import { toast } from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";

const FADE_UP = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20 } },
};

const STAGGER = {
  visible: { transition: { staggerChildren: 0.15 } },
};

function MagneticButton({ children, onClick, className, disabled }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e) => {
    if (disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct * 20); // max 20px magnetic pull
    y.set(yPct * 20);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: mouseXSpring, y: mouseYSpring }}
      className={`relative overflow-hidden group ${className}`}
      whileTap={{ scale: 0.95 }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0" />
    </motion.button>
  );
}

const Shimmer = () => (
  <motion.div
    animate={{ x: ["-100%", "200%"] }}
    transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
    className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 z-0"
  />
);

export default function UpdatesPage() {
  usePageTour('updates');
  const { t } = useTranslation();
  const { available, downloaded, info, progress, error, checking, setChecking } = useUpdateStore();

  const [currentVersion, setCurrentVersion] = useState("1.0.0");
  const [lastCheckedAt, setLastCheckedAt] = useState(Date.now() - 86400000); 

  useEffect(() => {
    window.electronAPI?.invoke?.("system:get-version").then((v) => {
      if (v) setCurrentVersion(v);
    });
  }, []);

  const handleCheckNow = async () => {
    setChecking(true);
    setLastCheckedAt(Date.now());
    if (window.electronAPI) {
      await window.electronAPI.invoke("update:check");
    } else {
      setTimeout(() => setChecking(false), 2000);
    }
  };

  const handleDownload = async () => {
    setChecking(true);
    if (window.electronAPI) {
      await window.electronAPI.invoke("update:download");
    } else {
      setTimeout(() => setChecking(false), 2000);
    }
  };

  const handleInstallNow = async () => {
    window.electronAPI?.invoke("update:install-now");
  };

  // Ultra-premium mesh background
  const BackgroundMesh = () => (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center items-center opacity-60">
      <div className="absolute inset-0 bg-[#f8fafc] z-[-1]" />
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.15)_0%,transparent_70%)] blur-[80px]"
      />
      <motion.div
        animate={{ rotate: -360, scale: [1, 1.3, 1] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-30%] left-[-20%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(226,232,240,0.4)_0%,transparent_70%)] blur-[100px]"
      />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50 z-10" />
    </div>
  );

  return (
    <div dir="rtl" className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden text-zinc-900 font-sans">
      <BackgroundMesh />

      <motion.div
        variants={STAGGER}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto"
      >
        {/* Cinematic Header with Splitting Text Effect */}
        <motion.header variants={FADE_UP} className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <motion.div 
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100"
            >
              <Zap className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
            </motion.div>
            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              مركز التحكم
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-950 leading-[1.1] max-w-5xl">
            تحديثات <span className="text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-500">النظام</span>
          </h1>
          <p className="text-zinc-500 mt-6 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
            حافظ على استقرار وسرعة نظامك. تحديثات ذكية تُطبق بسلاسة دون مقاطعة سير عملك.
          </p>
        </motion.header>

        {/* Bento Grid with Liquid Glass & Precision Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 grid-flow-dense">
          
          {/* Main Status Panel (Col-span-8) */}
          <motion.div
            data-help="version-section"
            variants={FADE_UP}
            className="md:col-span-8 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-10 border border-white/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] relative overflow-hidden group"
          >
            {/* Interactive Ambient Light */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-100/0 group-hover:from-emerald-50/60 group-hover:to-transparent transition-colors duration-1000 pointer-events-none" />
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-12">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-zinc-950 text-white shadow-xl overflow-hidden">
                    {checking ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : available ? (
                      <ArrowDownCircle className="h-7 w-7 text-emerald-400" />
                    ) : (
                      <CheckCircle2 className="h-7 w-7" />
                    )}
                    {available && !checking && <Shimmer />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-950">
                      {checking
                        ? "جاري فحص الخوادم..."
                        : available
                        ? "تحديث جديد متاح!"
                        : "النظام محدث بالكامل"}
                    </h2>
                    <p className="text-zinc-500 font-bold text-sm mt-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {available ? `إصدار ${info?.version || "جديد"}` : `إصدار ${currentVersion}`}
                    </p>
                  </div>
                </div>

                <div className="text-zinc-600 leading-relaxed font-medium text-lg max-w-xl">
                  {error ? (
                    <span className="text-red-600 flex items-center gap-2 font-bold bg-red-50 p-4 rounded-2xl border border-red-100">
                      <AlertCircle className="w-5 h-5" />
                      {typeof error === "string" ? error : "فشل التحقق من التحديثات. يرجى مراجعة اتصال الإنترنت."}
                    </span>
                  ) : available && !downloaded ? (
                    "اكتشفنا تحسينات جديدة وميزات أمنية متقدمة. نقترح تثبيت التحديث لضمان أفضل أداء لمنشأتك."
                  ) : downloaded ? (
                    <span className="text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 inline-block">
                      تم تحميل التحديث بنجاح ومستعد للتثبيت. يرجى تأكيد العملية.
                    </span>
                  ) : (
                    "أنت تستخدم أحدث نسخة من النظام. جميع الميزات تعمل بأعلى كفاءة واستقرار تام."
                  )}
                </div>

                <AnimatePresence>
                  {progress && progress.percent > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 32 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
                        <span className="text-2xl font-black font-mono text-zinc-950">{progress.percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden p-0.5">
                        <motion.div
                          className="h-full bg-zinc-950 rounded-full shadow-sm"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress.percent}%` }}
                          transition={{ ease: "linear" }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-4">
                {error ? (
                  <MagneticButton
                    data-help="check-button"
                    onClick={handleCheckNow}
                    className="px-8 py-4 bg-zinc-950 text-white rounded-2xl font-bold hover:shadow-xl transition-shadow text-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> إعادة الفحص
                  </MagneticButton>
                ) : downloaded ? (
                  <MagneticButton
                    data-help="download-button"
                    onClick={handleInstallNow}
                    className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black hover:bg-emerald-600 transition-colors hover:shadow-xl shadow-emerald-500/20 text-sm"
                  >
                    تأكيد التثبيت وإعادة التشغيل
                  </MagneticButton>
                ) : available ? (
                  <MagneticButton
                    onClick={handleDownload}
                    disabled={checking}
                    className="px-8 py-4 bg-zinc-950 text-white rounded-2xl font-bold hover:shadow-xl transition-shadow disabled:opacity-50 text-sm"
                  >
                    تحميل التحديث الان
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    data-help="check-button"
                    onClick={handleCheckNow}
                    disabled={checking}
                    className="px-8 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-50 transition-colors disabled:opacity-50 text-sm shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
                    فحص الخوادم
                  </MagneticButton>
                )}
              </div>
            </div>
          </motion.div>

          {/* Technical Info Card (Col-span-4) */}
          <motion.div
            data-help="tech-card"
            variants={FADE_UP}
            className="md:col-span-4 bg-zinc-950 rounded-[2.5rem] p-10 relative overflow-hidden flex flex-col justify-between shadow-2xl"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiIvPjwvc3ZnPg==')] pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm tracking-widest uppercase">التشخيص التقني</h3>
                </div>
                <div className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
              </div>
              
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">
                    نسخة النواة
                  </p>
                  <p className="font-mono text-3xl font-black text-white tracking-tight">{currentVersion}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">
                    قناة التحديث
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-zinc-300">Stable (الرئيسية)</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">
                    آخر تزامن
                  </p>
                  <p className="text-sm font-bold text-zinc-300 font-mono">
                    {lastCheckedAt
                      ? new Intl.DateTimeFormat("en-US", {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }).format(new Date(lastCheckedAt))
                      : "--:--:--"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative z-10 mt-12 pt-6 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">حالة النظام</span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">ممتازة</span>
            </div>
          </motion.div>

          {/* Release Notes (Col-span-12) */}
          <motion.div
            data-help="release-notes"
            variants={FADE_UP}
            className="md:col-span-12 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-10 lg:p-14 border border-white/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)]"
          >
            <div className="flex items-center gap-4 mb-10 pb-8 border-b border-zinc-100">
              <div className="h-12 w-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-zinc-900" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-zinc-950">سجل التغييرات الشامل</h3>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Release Notes</p>
              </div>
            </div>
            
            <div className="prose prose-zinc prose-lg max-w-none text-zinc-600 font-medium leading-[2] prose-h3:text-zinc-950 prose-h3:font-black prose-h3:tracking-tight prose-a:text-emerald-600 hover:prose-a:text-emerald-700">
              {info?.releaseNotes ? (
                <ReactMarkdown>{info.releaseNotes}</ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="h-20 w-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100 shadow-sm"
                  >
                    <Server className="w-8 h-8 text-zinc-300" />
                  </motion.div>
                  <p className="text-xl font-black text-zinc-900 tracking-tight">لا توجد تفاصيل متاحة لهذا الإصدار</p>
                  <p className="text-zinc-400 mt-2 font-medium">سيتم عرض قائمة الميزات والإصلاحات هنا عند توفرها.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
