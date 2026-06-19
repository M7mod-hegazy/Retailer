import { useState } from "react";
import { ShoppingCart, BarChart2, Users, Package, ArrowLeft, ArrowRight, X } from "lucide-react";

const STEPS = [
  {
    icon: "🎉",
    title: "مرحباً بك في نظام الحجازي",
    body: "تم تثبيت البرنامج بنجاح. سيرشدك هذا الدليل السريع إلى أبرز ما يقدمه النظام.",
  },
  {
    title: "ما يمكنك فعله",
    features: [
      { icon: ShoppingCart, label: "نقطة البيع",   desc: "فواتير سريعة مع دعم الباركود والطابعة الحرارية" },
      { icon: Package,      label: "المخزون",       desc: "تتبع الكميات والتنبيه عند النفاد عبر مستودعات متعددة" },
      { icon: Users,        label: "الحسابات",      desc: "حسابات العملاء والموردين والأقساط والسندات" },
      { icon: BarChart2,    label: "التقارير",      desc: "تقارير المبيعات والأرباح والمصروفات بضغطة زر" },
    ],
  },
  {
    icon: "✅",
    title: "أنت جاهز للبدء!",
    body: "يمكنك استيراد بياناتك الحالية من الإعدادات، أو البدء بإضافة الأصناف والعملاء مباشرةً.",
  },
];

export default function WelcomeWizard({ onClose }) {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 pt-6 pb-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 6,
                backgroundColor: i === step ? "var(--primary, #059669)" : "#e2e8f0",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-8 pt-6 min-h-[300px] flex flex-col justify-center">
          {current.features ? (
            <>
              <h2 className="text-xl font-black text-zinc-900 mb-5 text-center">{current.title}</h2>
              <div className="grid grid-cols-2 gap-3">
                {current.features.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" style={{ color: "var(--primary, #059669)" }} />
                      </div>
                      <span className="text-sm font-black text-zinc-800">{label}</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center">
              {current.icon && <div className="text-5xl mb-4">{current.icon}</div>}
              <h2 className="text-2xl font-black text-zinc-900 mb-3">{current.title}</h2>
              <p className="text-zinc-500 leading-relaxed">{current.body}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 pb-6">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className="flex items-center gap-1.5 text-sm font-bold text-zinc-400 hover:text-zinc-700 disabled:opacity-0 transition-colors"
          >
            <ArrowRight className="h-4 w-4" /> السابق
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="rounded-2xl px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all"
              style={{ backgroundColor: "var(--primary, #059669)" }}
            >
              ابدأ الاستخدام
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow transition-all"
              style={{ backgroundColor: "var(--primary, #059669)" }}
            >
              التالي <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
