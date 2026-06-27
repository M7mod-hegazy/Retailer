import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, LifeBuoy, Trash2, Loader2, Bot, ShieldCheck, ArrowLeft, ThumbsUp, ThumbsDown, Clock, ChevronLeft, ChevronRight, ListChecks, Database, GraduationCap, AlertTriangle, Download, Pin, Search, BarChart3 } from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";
import { useAuthStore } from "../../stores/authStore";
import { getIntentById } from "../../help/helpIndex";
import SupportThread from "./SupportThread";
import DevConsole from "./DevConsole";
import DailyTip from "./DailyTip";
import ChartCard from "./ChartCard";
import DrillDown from "./DrillDown";
import Pinboard from "./Pinboard";
import QuickRefCards from "./QuickRefCards";
import TrainingPanel from "./TrainingPanel";
import WeaknessAnalytics from "./WeaknessAnalytics";
import ManagerAssignments from "./ManagerAssignments";
import { QUERY_EXAMPLES, exportQueryResult, saveToPinboard, fetchPinboard } from "../../services/queryEngine";

const SUGGESTIONS_BY_PAGE = {
  "/pos": ["ازاي اعمل خصم على الفاتورة؟", "ازاي اطبع إيصال؟", "ازاي اشيل صنف من الفاتورة؟"],
  "/pos/": ["ازاي اعمل خصم على الفاتورة؟", "ازاي اطبع إيصال؟", "ازاي اشيل صنف من الفاتورة؟"],
  "/invoices": ["ازاي اشوف تفاصيل الفاتورة؟", "ازاي اطبع الفاتورة تاني؟", "ازاي الغي الفاتورة؟"],
  "/daily-treasury": ["ازاي اشوف تقرير الخزنة النهاري؟", "ازاي اعمل تسوية خزنة؟", "ازاي اعمل تحويل بين الخزن؟"],
  "/sales": ["ازاي اعمل مرتجع مبيعات؟", "ازاي اشوف تقرير مبيعات؟", "ازاي الغي فاتورة بيع؟"],
  "/sales/": ["ازاي اعمل مرتجع مبيعات؟", "ازاي اشوف تقرير مبيعات؟", "ازاي الغي فاتورة بيع؟"],
  "/stock/levels": ["ازاي اشوف رصيد صنف؟", "ازاي اعرف الأصناف الناقصة؟", "ازاي اطبع تقرير المخزون؟"],
  "/stock/movements": ["ازاي اشوف حركة صنف معين؟", "ازاي اعرف مين عمل إيه في الصنف؟", "ازاي اتتبع دخول وخروج صنف؟"],
  "/stock/transfer": ["ازاي انقل بضاعة بين المخازن؟", "ازاي اعمل تحويل مخزني؟", "ازاي انقل كمية من مخزن لمخزن؟"],
  "/stock/physical-count": ["ازاي اعمل جرد مخزون؟", "ازاي اظبط أرصدة المخزون؟", "ازاي اسوي المخزون الفعلي مع النظام؟"],
  "/stock/serials": ["ازاي ادور على رقم تسلسلي؟", "ازاي اتتبع جهاز بالرقم التسلسلي؟", "ازاي اعرف رقم سيريال فين؟"],
  "/stock": ["ازاي اشوف رصيد صنف؟", "ازاي انقل بضاعة بين المخازن؟", "ازاي اعمل جرد مخزون؟"],
  "/stock/": ["ازاي اشوف رصيد صنف؟", "ازاي انقل بضاعة بين المخازن؟", "ازاي اعمل جرد مخزون؟"],
  "/purchases/new": ["ازاي اعمل فاتورة مشتريات جديدة؟", "ازاي اسجل بضاعة جديدة؟", "ازاي ازود المخزون بالمشتريات؟"],
  "/purchases/orders": ["ازاي اعمل أمر شراء؟", "ازاي اطلب بضاعة من المورد؟", "ازاي استقبل شحنة أمر التوريد؟"],
  "/purchases/orders/": ["ازاي اعمل أمر شراء؟", "ازاي اطلب بضاعة من المورد؟", "ازاي استقبل شحنة أمر التوريد؟"],
  "/purchases/returns": ["ازاي اعمل مرتجع مشتريات؟", "ازاي ارجع بضاعة للمورد؟", "ازاي اسجل مرتجع شراء؟"],
  "/purchases/returns/": ["ازاي اعمل مرتجع مشتريات؟", "ازاي ارجع بضاعة للمورد؟", "ازاي اسجل مرتجع شراء؟"],
  "/purchases": ["ازاي اعمل فاتورة مشتريات؟", "ازاي اعمل أمر شراء؟", "ازاي اعمل مرتجع مشتريات؟"],
  "/purchases/": ["ازاي اعمل فاتورة مشتريات؟", "ازاي اعمل أمر شراء؟", "ازاي اعمل مرتجع مشتريات؟"],
  "/reports": ["ازاي اشوف تقرير الأرباح؟", "ازاي اطلب تقرير شهرين؟", "ازاي اسحب تقرير اكسل؟"],
  "/reports/": ["ازاي اشوف تقرير الأرباح؟", "ازاي اطلب تقرير شهرين؟", "ازاي اسحب تقرير اكسل؟"],
  "/reports/center": ["ازاي اشوف تقرير الأرباح؟", "ازاي اعمل تقرير مبيعات؟", "ازاي اعرض تقرير المخزون؟"],
  "/reports/expiry-report": ["ازاي اعرف الأصناف منتهية الصلاحية؟", "ازاي اعمل تقرير انتهاء الصلاحية؟", "ازاي اتابع تواريخ انتهاء الصلاحية؟"],
  "/reports/owner-statement": ["ازاي اشوف كشف حساب المالك؟", "ازاي اعرف صافي الأرباح؟", "ازاي اعرض حساب رأس المال؟"],
  "/definitions/categories": ["ازاي اضيف قسم جديد؟", "ازاي اعدل اسم القسم؟", "ازاي احذف قسم؟"],
  "/definitions/items": ["ازاي اضيف صنف جديد؟", "ازاي اعدل بيانات صنف؟", "ازاي استورد الأصناف من ملف؟"],
  "/definitions/items/": ["ازاي اضيف صنف جديد؟", "ازاي اعدل بيانات صنف؟", "ازاي استورد الأصناف من ملف؟"],
  "/definitions/customers": ["ازاي اضيف عميل جديد؟", "ازاي اشوف حساب عميل؟", "ازاي اعدل بيانات عميل؟"],
  "/definitions/customers/": ["ازاي اشوف تفاصيل العميل؟", "ازاي اعرف رصيد العميل؟", "ازاي اعرف كام للعميل عندي؟"],
  "/definitions/suppliers": ["ازاي اضيف مورد جديد؟", "ازاي اشوف حساب مورد؟", "ازاي اعدل بيانات مورد؟"],
  "/definitions/suppliers/": ["ازاي اشوف تفاصيل المورد؟", "ازاي اعرف المستحق للمورد؟", "ازاي اطبع كشف حساب مورد؟"],
  "/definitions/units": ["ازاي اضيف وحدة قياس جديدة؟", "ازاي اربط وحدة كبيرة بصغيرة؟", "ازاي اظبط وحدات الأصناف؟"],
  "/definitions/warehouses": ["ازاي اضيف مخزن جديد؟", "ازاي اعدل بيانات المخزن؟", "ازاي احذف مخزن؟"],
  "/definitions/branches": ["ازاي اضيف فرع جديد؟", "ازاي اعدل بيانات الفرع؟", "ازاي اشوف فروع المحل؟"],
  "/definitions/banks": ["ازاي اضيف بنك جديد؟", "ازاي اربط حساب بنكي؟", "ازاي اعدل بيانات البنك؟"],
  "/definitions/users": ["ازاي اضيف مستخدم جديد؟", "ازاي اظبط صلاحيات الموظف؟", "ازاي اتحكم في صلاحيات المستخدمين؟"],
  "/definitions/employees": ["ازاي اضيف موظف جديد؟", "ازاي اظبط مرتبات الموظفين؟", "ازاي احسب عمولة موظف؟"],
  "/definitions/promotions": ["ازاي اعمل عرض تخفيضات؟", "ازاي اظبط خصم تلقائي على أصناف؟", "ازاي اعمل عرض موسمي؟"],
  "/definitions/expense-categories": ["ازاي اضيف فئة مصروفات؟", "ازاي اعدل تصنيف مصروف؟", "ازاي اظبط أنواع المصروفات؟"],
  "/definitions/revenue-categories": ["ازاي اضيف فئة إيراد؟", "ازاي اعدل تصنيف إيراد؟", "ازاي اظبط أنواع الإيرادات؟"],
  "/definitions/financial-categories": ["ازاي اظبط التصنيفات المالية؟", "ازاي اعدل تصنيف مالي؟", "ازاي اضيف فئة مالية جديدة؟"],
  "/expenses": ["ازاي اسجل مصروف؟", "ازاي اشف المصروفات؟", "ازاي اعرف مصاريف الشهر؟"],
  "/revenues": ["ازاي اسجل إيراد؟", "ازاي اضيف دخل غير البيع؟", "ازاي اشوف الإيرادات؟"],
  "/withdrawals": ["ازاي اسجل سحب نقدية؟", "ازاي اعمل سحب من الخزنة؟", "ازاي اظبط حركة السحوبات؟"],
  "/payments": ["ازاي اسجل دفعة؟", "ازاي اشوف المدفوعات والتحصيلات؟", "ازاي ادفع لمورد؟"],
  "/payments/new": ["ازاي ادفع لمورد؟", "ازاي احصل فلوس من عميل؟", "ازاي اسجل دفعة جديدة؟"],
  "/accounts/customers": ["ازاي اشوف حسابات العملاء؟", "ازاي اعرف مين مديون؟", "ازاي اعمل تقرير أعمار العملاء؟"],
  "/accounts/suppliers": ["ازاي اشوف حسابات الموردين؟", "ازاي اعرف المستحق لكل مورد؟", "ازاي اعمل تسوية مورد؟"],
  "/operations/cheques": ["ازاي اسجل شيك وارد؟", "ازاي اتابع الشيكات؟", "ازاي اعمل تحصيل شيك؟"],
  "/operations/bank-operations": ["ازاي اعمل ايداع بنكي؟", "ازاي اعمل سحب بنكي؟", "ازاي اظبط حركة البنك؟"],
  "/operations/bulk-price-update": ["ازاي اغير اسعار كل الأصناف مرة واحدة؟", "ازاي اعمل زيادة اسعار شاملة؟", "ازاي احدث أسعار البيع بالجملة؟"],
  "/operations/employee-adjustments": ["ازاي اظبط مرتب موظف؟", "ازاي اضيف عمولة لموظف؟", "ازاي اعمل تسوية للموظفين؟"],
  "/operations/quotations": ["ازاي اعمل عرض سعر؟", "ازاي اطبع عرض سعر للعميل؟", "ازاي احول عرض سعر لفاتورة؟"],
  "/operations/branch-transfer": ["ازاي انقل بضاعة بين الفروع؟", "ازاي اعمل تحويل بين الفروع؟", "ازاي اتابع النقل بين الفروع؟"],
  "/operations/items": ["ازاي اشوف حركات صنف؟", "ازاي اعرف تاريخ صنف؟", "ازاي اتتبع صنف معين؟"],
  "/operations/payment-methods": ["ازاي اضيف طريقة دفع جديدة؟", "ازاي اظبط طرق الدفع؟", "ازاي اعدل طريقة دفع؟"],
  "/operations/payment-transactions": ["ازاي اشوف كل المدفوعات؟", "ازاي اعرف حركة الدفع؟", "ازاي اتابع المعاملات المالية؟"],
  "/settings": ["ازاي اعمل نسخة احتياطية؟", "ازاي اظبط إعدادات البرنامج؟", "ازاي افعل خاصية معينة؟"],
  "/notifications": ["ازاي اشوف الإشعارات؟", "ازاي اتابع التنبيهات؟", "ازاي اعرف إيه الجديد؟"],
  "/updates": ["ازاي احدث البرنامج؟", "ازاي اشوف إصدار البرنامج؟", "ازاي احمل تحديث جديد؟"],
  "/history": ["ازاي اشوف سجل الحركات؟", "ازاي اعرف مين عمل إيه في البرنامج؟", "ازاي اتابع تاريخ التعديلات؟"],
  "/dashboard": ["ازاي اشوف الملخص اليومي؟", "ازاي اعرف مبيعات النهارده؟", "ازاي افتح التقارير السريعة؟"],
  "/analytics": ["ازاي اشوف التحليلات؟", "ازاي اعرف اتجاهات المبيعات؟", "ازاي اعمل تحليل أرباح؟"],
  "/workspace": ["ازاي استخدم ورش العمل؟", "ازاي ادخل على مساحة العمل؟", "ازاي اتصفح واجهات البرنامج؟"],
  "/workspace/": ["ازاي استخدم ورش العمل؟", "ازاي ادخل على مساحة العمل؟", "ازاي اتصفح واجهات البرنامج؟"],
  "/gold/rates": ["ازاي اظبط أسعار الذهب؟", "ازاي احدث سعر الذهب؟", "ازاي اشتغل بالذهب في البرنامج؟"],
  "/restaurant": ["ازاي اظبط المطاعم؟", "ازاي اشتغل بخريطة الطاولات؟", "ازاي اطلب من الطاولة؟"],
  "/repairs": ["ازاي اسجل طلب صيانة؟", "ازاي اتابع أمر الإصلاح؟", "ازاي اعمل أمر صيانة لجهاز؟"],
  "/search": ["ازاي ادور على حاجة في البرنامج؟", "ازاي اعمل بحث عام؟", "ازاي الاقي صنف بسرعة؟"],
};

const DEFAULT_SUGGESTIONS = [
  "ازاي اعمل خصم على الفاتورة؟",
  "ازاي اعمل مرتجع مبيعات؟",
  "ازاي انقل بضاعة بين المخازن؟",
  "ازاي اضيف صنف جديد؟",
  "ازاي اعمل فاتورة مشتريات؟",
  "ازاي اشوف تقرير الأرباح؟",
  "ازاي استورد الأصناف من ملف؟",
  "ازاي اعمل جرد مخزون؟",
];

function RatingButtons({ messageId, currentRating, onRate, t }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 px-1">
      <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>هل كان الرد مفيداً؟</span>
      <button type="button" onClick={() => onRate(messageId, currentRating === "up" ? null : "up")}
        className={`rounded-lg p-1 transition-colors ${currentRating === "up" ? "text-primary" : ""}`}
        style={{ color: currentRating === "up" ? "var(--primary)" : "var(--text-muted)" }}>
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => onRate(messageId, currentRating === "down" ? null : "down")}
        className={`rounded-lg p-1 transition-colors ${currentRating === "down" ? "text-red-500" : ""}`}
        style={{ color: currentRating === "down" ? "var(--danger)" : "var(--text-muted)" }}>
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}

function RichCard({ entry, onNavigate, onAsk, t }) {
  const followups = (entry.followups || []).map((id) => getIntentById(id)).filter(Boolean).slice(0, 3);
  if (entry.display === "guide" && entry.steps) return <GuideCard entry={entry} onNavigate={onNavigate} t={t} />;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22, mass: 0.5 }}
      className="rounded-2xl border p-3.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-black text-primary">{entry.title}</span>
      </div>
      <p className="whitespace-pre-wrap text-[12px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{entry.answer}</p>
      {entry.route && (
        <button type="button" onClick={() => onNavigate(entry.route)}
          className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[12px] font-black text-white shadow-sm transition-transform hover:scale-[1.02]">
          <ArrowLeft strokeWidth={2.4} className="h-3.5 w-3.5" />
          {t("assistant.goToPage")}
        </button>
      )}
      {followups.length > 0 && (
        <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--border-normal)" }}>
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t("assistant.relatedQuestions")}</span>
          <div className="flex flex-wrap gap-1.5">
            {followups.map((f) => (
              <button type="button" key={f.id} onClick={() => onAsk(f.title)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-primary"
                style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>{f.title}</button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function GuideCard({ entry, onNavigate, t }) {
  const [step, setStep] = useState(0);
  const steps = entry.steps || [];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22, mass: 0.5 }}
      className="rounded-2xl border p-3.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="mb-2 flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black text-primary">{entry.title}</span></div>
      <div className="mb-2 flex gap-1">{steps.map((_, i) => (<div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-black/10"}`} />))}</div>
      <p className="text-[13px] font-black mb-1" style={{ color: "var(--text-primary)" }}>{t("assistant.step")} {step + 1}/{steps.length}</p>
      <p className="whitespace-pre-wrap text-[12px] font-semibold leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>{steps[step]}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold disabled:opacity-30"
          style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}><ChevronRight className="h-3 w-3" /> {t("assistant.previous")}</button>
        <button type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-30">
          {t("assistant.next")} <ChevronLeft className="h-3 w-3" /></button>
        {step === steps.length - 1 && entry.route && (
          <button type="button" onClick={() => onNavigate(entry.route)}
            className="mr-auto rounded-xl px-2.5 py-1 text-[11px] font-bold text-primary"
            style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>{t("assistant.goToPage")}</button>
        )}
      </div>
    </motion.div>
  );
}

function TypewriterText({ text, speed = 25 }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!text) { setDone(true); return; }
    const words = text.split(" ");
    let i = 0;
    setDisplayed("");
    setDone(false);
    const timer = setInterval(() => {
      i++;
      setDisplayed(words.slice(0, i).join(" "));
      if (i >= words.length) { clearInterval(timer); setDone(true); }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return (
    <span>
      {displayed}
      {!done && <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block w-[2px] h-[14px] mr-0.5" style={{ background: "var(--primary)" }} />}
    </span>
  );
}

function AiMessage({ message, t, onRate }) {
  const [showFull, setShowFull] = useState(false);
  if (message.loading) return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="flex items-center gap-2 px-1 text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
      <div className="flex gap-0.5">
        <motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
        <motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
        <motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
      </div>
      <span>{t("assistant.aiThinking")}</span>
    </motion.div>
  );
  if (message.error || !message.text) return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] font-bold leading-relaxed px-1" style={{ color: "var(--text-muted)" }}>{t("assistant.aiError")}</motion.div>;
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.6 }}
      className="rounded-2xl border p-3.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="mb-1.5 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">{t("assistant.aiBadge")}</span></div>
      <p className="whitespace-pre-wrap text-[12px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {message.text.length > 80 && !showFull ? (
          <>{message.text.slice(0, 80)}... <button onClick={() => setShowFull(true)} className="text-primary hover:underline text-[11px] font-black">{t("assistant.showMore") || "عرض المزيد"}</button></>
        ) : (
          <TypewriterText text={message.text} speed={15} />
        )}
      </p>
      {onRate && <RatingButtons messageId={message.id} currentRating={message.rating} onRate={onRate} t={t} />}
    </motion.div>
  );
}

const messageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 } },
};

function BotMessage({ message, t, onNavigate, onAsk, onRate }) {
  if (message.kind === "ai") return <AiMessage message={message} t={t} onRate={onRate} />;
  const results = message.results || [];
  if (results.length === 0) return <motion.div variants={messageVariants} initial="hidden" animate="visible" className="text-[12px] font-bold leading-relaxed px-1" style={{ color: "var(--text-muted)" }}>{t("assistant.noAnswer")}</motion.div>;
  const [top, ...rest] = results;
  return (
    <motion.div variants={messageVariants} initial="hidden" animate="visible" className="flex flex-col gap-2">
      <RichCard entry={top} onNavigate={onNavigate} onAsk={onAsk} t={t} />
      {onRate && <RatingButtons messageId={message.id} currentRating={message.rating} onRate={onRate} t={t} />}
      {rest.length > 0 && (
        <div className="px-1">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t("assistant.didYouMean")}</span>
          <div className="flex flex-wrap gap-1.5">{rest.map((e) => (<button type="button" key={e.id} onClick={() => onAsk(e.title)} className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-primary" style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>{e.title}</button>))}</div>
        </div>
      )}
    </motion.div>
  );
}

function QueryResultCard({ result, onDrillDown, onExport, onSavePinboard, t }) {
  const [showChart, setShowChart] = useState(true);
  const type = result?.type;
  const hasChart = type === "chart" && result?.data?.length > 0;
  const hasComparison = type === "comparison" && result?.periodA && result?.periodB;
  const hasSummary = type === "summary" && result?.parts;
  const hasRows = result?.rows?.length > 0;
  const hasValue = result?.value != null;

  const handleExport = (format) => onExport?.(result, format);

  const SUMMARY_LABELS = useMemo(() => ({
    sales: t("summary.sales") || "المبيعات",
    expenses: t("summary.expenses") || "المصروفات",
    returns: t("summary.returns") || "المرتجعات",
    customers: t("summary.customers") || "العملاء",
    invoices_count: t("summary.invoices") || "الفواتير",
  }), [t]);

  const tableRows = useMemo(() => {
    if (result?.rows?.length > 0) return result.rows;
    if (hasChart) return result.data.map(d => ({ name: d.label, value: d.value }));
    return [];
  }, [result, hasChart]);

  const comparisonChange = hasComparison
    ? result.periodB.value > 0
      ? ((result.periodA.value - result.periodB.value) / result.periodB.value * 100).toFixed(1)
      : 0
    : 0;

  return (
    <div className="rounded-2xl border p-3.5 space-y-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-black text-primary">{result?.label || result?.intent || ""}</span>
        </div>
        <div className="flex items-center gap-1">
          {hasChart && (
            <button onClick={() => setShowChart(!showChart)}
              className="rounded-lg px-2 py-0.5 text-[9px] font-bold"
              style={{ background: showChart ? "var(--primary)" : "transparent", color: showChart ? "white" : "var(--text-muted)", border: "1px solid var(--border-normal)" }}>
              {showChart ? (t("queries.table") || "جدول") : (t("queries.chart") || "رسم بياني")}
            </button>
          )}
          <button onClick={() => handleExport("csv")} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }} title={t("queries.export") || "تصدير"}>
            <Download className="h-3 w-3" />
          </button>
          <button onClick={onSavePinboard} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }} title={t("queries.savePinboard") || "حفظ"}>
            <Pin className="h-3 w-3" />
          </button>
        </div>
      </div>

      {result?.summary && (
        <p className="text-[12px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{result.summary}</p>
      )}

      {hasValue && !hasComparison && !hasSummary && (
        <div className="text-center py-2">
          <span className="text-[28px] font-black" style={{ color: "var(--text-primary)" }}>
            {typeof result.value === "number" ? result.value.toLocaleString("en-US") : result.value}
          </span>
          {result.unit && <span className="text-[12px] font-bold mr-1" style={{ color: "var(--text-muted)" }}>{result.unit}</span>}
          {result.count > 0 && <span className="block text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{t("queries.count") || "العدد"}: {result.count}</span>}
        </div>
      )}

      {hasComparison && (
        <div className="grid grid-cols-3 gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--border-normal)" }}>
          <div className="text-center">
            <span className="block text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>{result.periodA.label || t("queries.current") || "الحالي"}</span>
            <span className="text-[14px] font-black" style={{ color: "var(--text-primary)" }}>{result.periodA.value.toLocaleString("en-US")}</span>
          </div>
          <div className="text-center">
            <span className="block text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>{result.periodB.label || t("queries.previous") || "السابق"}</span>
            <span className="text-[14px] font-black" style={{ color: "var(--text-primary)" }}>{result.periodB.value.toLocaleString("en-US")}</span>
          </div>
          <div className="text-center">
            <span className="block text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>{t("queries.change") || "التغير"}</span>
            <span className="text-[14px] font-black"
            style={{ color: comparisonChange >= 0 ? "var(--success-text)" : "var(--danger)" }}>
              {comparisonChange >= 0 ? "+" : ""}{comparisonChange}%
            </span>
          </div>
        </div>
      )}

      {hasSummary && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(result.parts).map(([key, part]) => (
            <div key={key} className="rounded-xl border p-2 text-center" style={{ borderColor: "var(--border-normal)" }}>
              <span className="block text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>{SUMMARY_LABELS[key] || key}</span>
              <span className="block text-[16px] font-black" style={{ color: "var(--text-primary)" }}>
                {typeof part.value === "number" ? part.value.toLocaleString("en-US") : part.value}
              </span>
              {part.count > 0 && <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>{t("queries.count") || "العدد"}: {part.count}</span>}
            </div>
          ))}
        </div>
      )}

      {hasChart && showChart && (
        <ChartCard data={result.data.map(d => ({ label: d.label, value: d.value }))} />
      )}

      {tableRows.length > 0 && !showChart && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {tableRows.slice(0, 15).map((row, i) => (
            <div key={i}
              onClick={() => onDrillDown?.(row)}
              className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer hover-primary-5 transition-colors"
              style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>
              <span>{row.name || row.label || `#${i + 1}`}</span>
              <span className="text-primary">{row.value?.toLocaleString?.("en-US") || row.value || row.sales?.toLocaleString?.("en-US") || row.sales}</span>
            </div>
          ))}
        </div>
      )}

      {result?.drillDown && (
        <button onClick={() => onDrillDown?.(result.drillDown)}
          className="w-full rounded-xl py-1.5 text-[11px] font-bold text-primary transition-colors hover-primary-20"
          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
          {t("queries.drillDown") || "عرض التفاصيل"} ↓
        </button>
      )}
    </div>
  );
}

function AnomalyBanner({ anomalies, t }) {
  if (!anomalies || anomalies.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {anomalies.map((a, i) => (
        <div key={i}
          className="rounded-xl border p-2.5 text-[11px] font-bold flex items-start gap-2"
          style={{
            background: a.severity === "critical" ? "var(--danger-bg)" : "var(--warning-bg)",
            borderColor: a.severity === "critical" ? "var(--danger-border)" : "var(--warning-border)",
            color: a.severity === "critical" ? "var(--danger-text)" : "var(--warning-text)",
          }}>
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0"
            style={{ color: a.severity === "critical" ? "var(--danger)" : "var(--warning-text)" }} />
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function AssistantDrawer() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const activeTab = useAssistantStore((s) => s.activeTab);
  const messages = useAssistantStore((s) => s.messages);
  const searchHistory = useAssistantStore((s) => s.searchHistory);
  const queryLoading = useAssistantStore((s) => s.queryLoading);
  const queryResult = useAssistantStore((s) => s.queryResult);
  const queryError = useAssistantStore((s) => s.queryError);
  const queryContext = useAssistantStore((s) => s.queryContext);
  const anomalies = useAssistantStore((s) => s.anomalies);
  const close = useAssistantStore((s) => s.close);
  const setTab = useAssistantStore((s) => s.setTab);
  const ask = useAssistantStore((s) => s.ask);
  const clearConversation = useAssistantStore((s) => s.clearConversation);
  const clearHistory = useAssistantStore((s) => s.clearHistory);
  const rateMessage = useAssistantStore((s) => s.rateMessage);
  const devMode = useAssistantStore((s) => s.devMode);
  const toggleDevMode = useAssistantStore((s) => s.toggleDevMode);
  const executeQuery = useAssistantStore((s) => s.executeQuery);
  const clearQuery = useAssistantStore((s) => s.clearQuery);
  const currentUser = useAuthStore((s) => s.user);
  const isDevAccount = currentUser?.username === "m7mod";

  const [input, setInput] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [drillItem, setDrillItem] = useState(null);
  const [pinboardTab, setPinboardTab] = useState(false);
  const [trainingSubTab, setTrainingSubTab] = useState("tracks");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const queryInputRef = useRef(null);

  const suggestions = useMemo(() => {
    const path = Object.keys(SUGGESTIONS_BY_PAGE).find((p) => location.pathname.startsWith(p));
    return path ? SUGGESTIONS_BY_PAGE[path] : DEFAULT_SUGGESTIONS;
  }, [location.pathname]);

  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 150); }, [isOpen]);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const submit = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    ask(q, location.pathname);
    setInput("");
  };

  const handleQuerySubmit = () => {
    const q = queryInput.trim();
    if (!q) return;
    setDrillItem(null);
    executeQuery(q);
    setQueryInput("");
  };

  const handleQueryExample = (text, intentId) => {
    setDrillItem(null);
    executeQuery(text, intentId);
    setQueryInput("");
  };

  const handleNavigate = (route) => { if (route) navigate(route); close(); };

  const handleExport = async (result, format) => {
    await exportQueryResult(result?.intent || "query", result?.label || "Query", result, format);
  };

  const handleSavePinboard = async () => {
    if (!queryResult) return;
    await saveToPinboard(queryResult?.label || queryResult?.intent || "Query", queryContext?.lastQuery || "");
  };

  const tabs = [
    { id: "assistant", label: t("assistant.tabAssistant"), icon: Sparkles },
    { id: "queries", label: t("queries.tab") || "الاستعلامات", icon: Database },
    { id: "training", label: t("training.tab") || "التدريب", icon: GraduationCap },
    { id: "support", label: t("assistant.tabSupport"), icon: LifeBuoy },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <style>{`
            .hover-primary-5:hover { background: color-mix(in srgb, var(--primary) 5%, transparent); }
            .hover-primary-20:hover { background: color-mix(in srgb, var(--primary) 20%, transparent); }
          `}</style>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close} className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]" />
          <motion.aside dir="rtl" initial={{ x: "-105%" }} animate={{ x: 0 }} exit={{ x: "-105%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 start-0 z-[61] flex w-[400px] max-w-[92vw] flex-col p-4">
            <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl"
              style={{ background: "var(--bg-topbar)", borderColor: "var(--border-normal)" }}>
              <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: "var(--border-normal)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md"><Sparkles strokeWidth={2.2} className="h-4.5 w-4.5" /></div>
                  <span className="text-sm font-black tracking-tight" style={{ color: "var(--text-primary)" }}>{t("assistant.title")}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isDevAccount && (
                    <button type="button" onClick={toggleDevMode} aria-label={t("dev.title")} title={t("dev.title")}
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                      style={{ color: devMode ? "var(--primary)" : "var(--text-muted)" }}>
                      <ShieldCheck strokeWidth={2.2} className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" onClick={close} aria-label={t("assistant.dismiss")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
                    <X strokeWidth={2.2} className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {devMode ? <DevConsole /> : (
              <>
              <div className="flex gap-1 px-3 pt-3">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button type="button" key={tab.id} onClick={() => setTab(tab.id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-black transition-all ${
                        active ? "bg-primary text-white shadow-md" : "hover:bg-black/5"
                      }`} style={active ? undefined : { color: "var(--text-secondary)" }}>
                      <tab.icon strokeWidth={2.2} className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "assistant" && (
                <>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                    <DailyTip t={t} />
                    {messages.length === 0 ? (
                      <div className="flex flex-col gap-4 pt-2">
                        <p className="px-1 text-[13px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t("assistant.greeting")}</p>
                        {searchHistory.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between px-1 mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                                <Clock className="inline h-3 w-3 ml-1" />{t("assistant.recent")}
                              </span>
                              <button type="button" onClick={clearHistory} className="text-[9px] font-bold text-primary hover:underline">{t("assistant.clear")}</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {searchHistory.slice(0, 5).map((q) => (
                                <button type="button" key={q} onClick={() => submit(q)}
                                  className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-primary"
                                  style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>{q}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <span className="px-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t("assistant.suggestionsTitle")}</span>
                          {suggestions.map((q) => (
                            <button type="button" key={q} onClick={() => submit(q)}
                              className="rounded-xl border px-3.5 py-2.5 text-right text-[12px] font-bold transition-all hover:shadow-sm"
                              style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>{q}</button>
                          ))}
                        </div>
                        <QuickRefCards currentRoute={location.pathname} t={t} />
                      </div>
                    ) : (
                      <>
                        {messages.map((m) =>
                          m.role === "user" ? (
                            <motion.div key={m.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className="flex justify-start">
                              <div className="max-w-[85%] rounded-2xl rounded-bs-sm bg-primary px-3.5 py-2 text-[12px] font-bold text-white shadow-sm">{m.text}</div>
                            </motion.div>
                          ) : (
                            <motion.div key={m.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className="flex justify-end">
                              <div className="w-[92%]"><BotMessage message={m} t={t} onNavigate={handleNavigate} onAsk={submit} onRate={rateMessage} /></div>
                            </motion.div>
                          )
                        )}
                      </>
                    )}
                  </div>
                  <div className="border-t p-3" style={{ borderColor: "var(--border-normal)" }}>
                    {messages.length > 0 && (
                      <button type="button" onClick={clearConversation}
                        className="mb-2 flex items-center gap-1 px-1 text-[10px] font-black uppercase tracking-widest transition-colors hover:text-primary"
                        style={{ color: "var(--text-muted)" }}>
                        <Trash2 className="h-3 w-3" /> {t("assistant.clear")}
                      </button>
                    )}
                    <div className="flex items-center gap-2 rounded-2xl border px-3 py-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
                      <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                        placeholder={t("assistant.placeholder")}
                        className="flex-1 bg-transparent py-1.5 text-[13px] font-bold outline-none" style={{ color: "var(--text-primary)" }} />
                      <button type="button" onClick={() => submit()} disabled={!input.trim()} aria-label={t("assistant.send")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-all disabled:opacity-40">
                        <Send strokeWidth={2.2} className="h-4 w-4 -scale-x-100" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "queries" && (
                <>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                    <AnomalyBanner anomalies={anomalies} t={t} />

                      {pinboardTab ? (
                      <div>
                        <button onClick={() => setPinboardTab(false)}
                          className="flex items-center gap-1 text-[11px] font-bold mb-2 hover:text-primary transition-colors" style={{ color: "var(--text-muted)" }}>
                          <ChevronLeft className="h-3.5 w-3.5" /> {t("queries.backToQuery") || "رجوع للاستعلام"}
                        </button>
                        <Pinboard onSelectQuery={handleQueryExample} t={t} />
                      </div>
                    ) : drillItem ? (
                      <DrillDown item={drillItem} onBack={() => setDrillItem(null)} onNavigate={handleNavigate} t={t} />
                    ) : (
                      <>
                        {/* Always show query examples and pinboard */}
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {QUERY_EXAMPLES.map((ex, i) => (
                              <button key={i} onClick={() => handleQueryExample(ex.textAr, ex.intentId)}
                                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all hover:border-primary"
                                style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
                                <span>{ex.icon}</span> {ex.textAr}
                              </button>
                            ))}
                          </div>
                          <Pinboard onSelectQuery={handleQueryExample} t={t} />
                        </div>

                        {queryLoading && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
                            <span className="mr-2 text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{t("queries.loading") || "جاري جلب البيانات..."}</span>
                          </div>
                        )}

                        {queryError && (
                          <div className="rounded-2xl border p-3 text-[12px] font-bold"
                            style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}>{queryError}</div>
                        )}

                        {queryResult && !queryLoading && (
                          <QueryResultCard
                            result={queryResult}
                            onDrillDown={(item) => setDrillItem(item)}
                            onExport={handleExport}
                            onSavePinboard={handleSavePinboard}
                            t={t}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <div className="border-t p-3" style={{ borderColor: "var(--border-normal)" }}>
                    <div className="flex items-center gap-2 rounded-2xl border px-3 py-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
                      <input ref={queryInputRef} value={queryInput} onChange={(e) => setQueryInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuerySubmit()}
                        placeholder={t("queries.placeholder") || "اسأل عن البيانات..."}
                        className="flex-1 bg-transparent py-1.5 text-[13px] font-bold outline-none" style={{ color: "var(--text-primary)" }} />
                      <button type="button" onClick={() => setPinboardTab(true)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
                        <Pin strokeWidth={2.2} className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={handleQuerySubmit} disabled={!queryInput.trim() || queryLoading}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-all disabled:opacity-40">
                        <Search strokeWidth={2.2} className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "training" && (
                <>
                  <div className="flex gap-1 px-3 pt-2">
                    {[
                      { id: "tracks", label: t("training.tracks") || "المسارات", icon: GraduationCap },
                      { id: "weaknesses", label: t("training.weaknesses") || "نقاط الضعف", icon: AlertTriangle },
                      { id: "assignments", label: t("training.assignments") || "التكليفات", icon: ListChecks },
                    ].map((sub) => {
                      const active = trainingSubTab === sub.id;
                      return (
                        <button key={sub.id} onClick={() => setTrainingSubTab(sub.id)}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black transition-all ${
                            active ? "bg-primary text-white" : "hover:bg-black/5"
                          }`} style={active ? undefined : { color: "var(--text-secondary)" }}>
                          <sub.icon className="h-3 w-3" /> {sub.label}
                        </button>
                      );
                    })}
                  </div>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                    {trainingSubTab === "tracks" && <TrainingPanel onNavigate={handleNavigate} t={t} />}
                    {trainingSubTab === "weaknesses" && <WeaknessAnalytics t={t} />}
                    {trainingSubTab === "assignments" && <ManagerAssignments t={t} />}
                  </div>
                </>
              )}

              {activeTab === "support" && <SupportThread />}
              </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
