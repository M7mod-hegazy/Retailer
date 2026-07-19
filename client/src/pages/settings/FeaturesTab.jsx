import React, { useState } from "react";
import {
  Package, Shirt, Smartphone, Scale, Wrench, UtensilsCrossed,
  Gem, CalendarClock, ScrollText, Lock, AlertTriangle, Receipt,
  CheckCircle2, ChevronDown, ChevronUp, Info, Shield,
  Link2, XCircle, Settings2, TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

// ─── Feature definitions ──────────────────────────────────────────────────────
const FEATURES = [
  {
    key: "feature_multi_unit",
    icon: Package,
    colorRole: "info",
    name: "وحدات القياس المتعددة",
    desc: "تبيع الصنف بكذا وحدة — كرتونة، دستة، قطعة — وكل وحدة ليها سعر وباركود لوحدها. المخزون بيتخصم بالقطعة عشان مفيش حاجة تتلخبط.",
    recommendedFor: ["سوبر ماركت", "بقالة", "جملة ونصف جملة"],
    affectedPages: [
      "قاعدة الأصناف ← قسم «وحدات إضافية» في نافذة الصنف (اسم الوحدة، المعامل، سعر وباركود لكل وحدة)",
      "نقطة البيع ← زر اختيار وحدة البيع على كل سطر بالفاتورة + قراءة باركود الوحدة",
      "المخزون ← يُحسب دائماً بالوحدة الأساسية (بيع كرتونة = خصم عدد القطع تلقائياً)",
      "الفواتير والمرتجعات ← حفظ الوحدة المباعة وعرضها في تفاصيل الفاتورة",
      "التقارير ← تقرير «تشكيلة وحدات البيع»",
    ],
    worksWellWith: ["feature_variants"],
  },
  {
    key: "feature_variants",
    icon: Shirt,
    colorRole: "primary",
    name: "المقاسات والألوان",
    desc: "تعمل صنف أساسي وتحته ألوان ومقاسات كتير، وكل واحد فيهم ليه سعر ومخزون وباركود خاص بيه.",
    recommendedFor: ["ملابس", "أحذية", "إكسسوارات"],
    affectedPages: [
      "قاعدة الأصناف ← تبويب «المتغيرات» + مولّد مصفوفة (مقاس × لون) بسعر ومخزون وصورة لكل متغير",
      "قائمة الأصناف ← تجميع المتغيرات الفرعية تحت الصنف الأب",
      "فواتير المبيعات ← منع بيع الصنف الأب مباشرةً (يجب اختيار متغير)",
      "نقطة البيع ← نافذة اختيار المتغير عند اختيار الصنف الأب",
      "التقارير ← تجميع المبيعات حسب الصنف الأب + معدل تصريف لكل متغير",
    ],
    existingDataNote: "تحذير: مولّد المصفوفة على الأصناف الموجودة قد يُضيف متغيرات جديدة ولن يحذف المتغيرات القديمة. الأصناف الحالية تبقى كما هي حتى تحوّلها يدوياً لصنف أب.",
    worksWellWith: ["feature_multi_unit"],
  },
  {
    key: "feature_serials",
    icon: Smartphone,
    colorRole: "danger",
    name: "تتبع السيريال / IMEI",
    desc: "تربط كل قطعة بسيريال أو IMEI، عشان تتابع حركة كل جهاز من ساعة ما تشتريه لحد ما تبيعه وتعرف حالة الضمان بتاعته.",
    recommendedFor: ["محلات موبايل", "إلكترونيات", "أجهزة"],
    affectedPages: [
      "قاعدة الأصناف ← خانة «تتبع السيريال» وشهور الضمان لكل صنف",
      "نقطة البيع ← مسح أرقام السيريال عند البيع (وضع إلزامي أو مرن)",
      "المرتجعات ← اختيار السيريال من أرقام نفس الفاتورة فقط (منع التلاعب)",
      "المشتريات ← إدخال السيريالات عند استلام البضاعة",
      "الشريط الجانبي ← صفحة «بحث السيريال / IMEI» مع السجل وحالة الضمان (جديدة)",
    ],
    existingDataNote: "تنبيه: الأصناف التي لديها مخزون حالي لن تحتوي على أرقام سيريال تلقائياً — السجلات السابقة تبقى بدون تتبع حتى تُدخلها يدوياً من شاشة المخزون.",
    conflictsWith: ["feature_multi_unit"],
  },
  {
    key: "feature_scale_barcodes",
    icon: Scale,
    colorRole: "warning",
    name: "باركود الميزان",
    desc: "البرنامج هيقرا الباركود اللي بيطلعه ميزان الباركود ويحسب الوزن أو السعر لوحده أول ما تضربه على الكاشير.",
    recommendedFor: ["سوبر ماركت", "جزارة", "خضار وفاكهة", "أجبان"],
    affectedPages: [
      "نقطة البيع ← قراءة باركود الميزان واستخراج الوزن/السعر تلقائياً عند المسح",
      "قاعدة الأصناف ← حقل «كود الميزان (PLU)» لربط الصنف بالميزان",
      "التقارير ← مبيعات أصناف الميزان بالوزن",
    ],
    // hasInlineConfig: renders ScaleConfigPanel inside the card when enabled
    hasInlineConfig: "scale",
  },
  {
    key: "feature_repair_orders",
    icon: Wrench,
    colorRole: "warning",
    name: "أوامر الصيانة والإصلاح",
    desc: "تستلم الأجهزة من الزباين للصيانة، وتسجل الأعطال وقطع الغيار والعمالة والفلوس اللي اتدفعت مقدم، وتطلع فاتورة في الآخر.",
    recommendedFor: ["صيانة موبايل وكمبيوتر", "أجهزة منزلية", "ترزي"],
    affectedPages: [
      "الشريط الجانبي ← صفحة «أوامر الصيانة» (جديدة تظهر فوراً)",
      "نموذج الطلب ← استلام الجهاز، التشخيص، قطع الغيار، العمالة، الإيداع",
      "المخزون ← خصم قطع الغيار من المخزون تلقائياً عند إضافتها",
      "الخزينة ← الإيداع يمر عبر المدفوعات (يظهر في الخزينة والوردية)",
      "التسليم ← تحويل الطلب لفاتورة بضغطة واحدة مع خصم الإيداع",
    ],
  },
  {
    key: "feature_restaurant",
    icon: UtensilsCrossed,
    colorRole: "success",
    name: "نظام المطاعم والكافيهات",
    desc: "تنظيم الترابيزات، الإضافات على الأكل، ومكونات الوجبات عشان تتخصم من المخزن لوحدها مع كل طلب، وتطبع شيت للمطبخ.",
    recommendedFor: ["كافيه", "مطعم", "عصائر", "كشري"],
    affectedPages: [
      "الشريط الجانبي ← صفحة «طاولات المطعم» (خريطة بصرية — جديدة)",
      "نقطة البيع ← ربط الطلب بطاولة، اختيار الإضافات، ورسوم الخدمة",
      "قاعدة الأصناف ← تبويب «الوصفة» لخصم المكونات تلقائياً عند البيع",
      "المطبخ ← طباعة تذكرة المطبخ موجّهة حسب القسم",
      "الفواتير والخزينة ← إظهار رسوم الخدمة ضمن تفاصيل الفاتورة",
    ],
    existingDataNote: "ملاحظة: حقول الطاولة ونوع الطلب موجودة في قاعدة البيانات بشكل دائم (مشتركة مع النظام الأساسي). تفعيل هذه الميزة يُظهر الواجهة فقط ولا يُنشئ جداول منفصلة.",
  },
  {
    key: "feature_gold",
    icon: Gem,
    colorRole: "warning",
    name: "تسعير الذهب والمجوهرات",
    desc: "البرنامج بيحسب سعر الذهب (الوزن × سعر العيار بتاع النهاردة + المصنعية) لوحده أول ما تبيع.",
    recommendedFor: ["محلات الذهب", "المجوهرات"],
    affectedPages: [
      "الشريط الجانبي ← صفحة «أسعار الذهب اليوم» لإدخال سعر العيار (جديدة)",
      "قاعدة الأصناف ← حقول الذهب (العيار، الوزن بالجرام، المصنعية)",
      "نقطة البيع ← تسعير تلقائي: وزن × سعر العيار + المصنعية + تنبيه إدخال سعر اليوم",
      "الفواتير ← حفظ تفاصيل الذهب وعرضها في التفاصيل والمطبوعات",
      "التقارير ← هامش الربح على أصناف الذهب يُحسب من وزن × سعر العيار",
    ],
    existingDataNote: "ملاحظة: أصناف الذهب الموجودة حالياً ستحتاج إلى إدخال بيانات العيار والوزن يدوياً من شاشة قاعدة الأصناف بعد التفعيل.",
  },
  {
    key: "feature_expiry",
    icon: CalendarClock,
    colorRole: "warning",
    name: "تواريخ الصلاحية (FEFO)",
    desc: "تتابع البضاعة بتواريخ صلاحيتها، والبرنامج يخصم من القديم اللي هيخلص الأول، وينبهك لو في حاجة قربت تخلص صلاحيتها.",
    recommendedFor: ["سوبر ماركت", "صيدلية", "أغذية ومشروبات", "ألبان"],
    affectedPages: [
      "قاعدة الأصناف ← خانة «تتبع تواريخ الانتهاء (FEFO)» لكل صنف (يجب تفعيلها على كل صنف منفرداً)",
      "المشتريات ← إدخال تاريخ الانتهاء ورقم الدفعة عند استلام الأصناف المتتبَّعة",
      "فواتير المبيعات ← خصم المخزون من الدفعة الأقرب انتهاءً أولاً (FEFO) للأصناف المفعّل عليها التتبع فقط",
      "المرتجعات ← إعادة الكمية المرتجعة إلى أحدث دفعة للصنف",
      "التقارير ← تقرير «انتهاء الصلاحية» (منتهي / حرج / تحذير / ساري)",
      "لوحة التحليلات ← بطاقة رصد صلاحية الدفعات القريبة من الانتهاء",
    ],
    existingDataNote: "تنبيه: المخزون الحالي لن يحتوي على دفعات أو تواريخ انتهاء تلقائياً — FEFO يبدأ العمل فقط على المشتريات الجديدة بعد التفعيل. الأصناف القديمة تستمر بالصرف العادي حتى تُنشئ دفعة لها.",
  },
  {
    key: "feature_cheques",
    icon: ScrollText,
    colorRole: "info",
    name: "إدارة الشيكات",
    desc: "تسجل الشيكات اللي ليك واللي عليك، وتتابع مواعيدها وإيه اللي اتحصل وإيه اللي رجع.",
    recommendedFor: ["جملة", "شركات", "تجارة بالآجل"],
    affectedPages: [
      "الشريط الجانبي ← صفحة «إدارة الشيكات» (تظهر فور التفعيل)",
      "ملف العميل / المورد ← تبويب «الشيكات»",
      "التقارير ← تقرير سجل الشيكات",
    ],
  },
  {
    key: "feature_tax",
    icon: Receipt,
    colorRole: "danger",
    name: "ضريبة القيمة المضافة",
    desc: "تزود ضريبة على الفواتير، وتطلع تقارير وإقرارات ضريبية للمبيعات والمشتريات.",
    recommendedFor: ["شركات", "تجارة إلكترونية", "جملة"],
    affectedPages: [
      "الإعدادات ← تبويب «الضرائب» لإعداد النسبة والنوع (داخل/خارج السعر)",
      "فواتير البيع ← تفعيل حقل الضريبة على مستوى الفاتورة والصنف",
      "التقارير ← تبويب «الضرائب» مع تصنيفات ضريبة القيمة المضافة",
    ],
  },
];

// ─── Semantic color role → Tailwind class map ─────────────────────────────────
// Uses only bg-*/text-*/border-* semantic classes where possible.
// Tailwind raw tokens only for icon backgrounds since semantic doesn't cover all hues.
const COLOR_ROLE = {
  info:    { icon: "bg-info-bg text-info-text", border: "border-info-border", badge: "bg-info-bg text-info-text", tag: "bg-info-bg text-info-text" },
  primary: { icon: "bg-primary-50 text-primary", border: "border-primary", badge: "bg-primary-50 text-primary", tag: "bg-primary-50 text-primary" },
  danger:  { icon: "bg-danger-bg text-danger-text", border: "border-danger-border", badge: "bg-danger-bg text-danger-text", tag: "bg-danger-bg text-danger-text" },
  warning: { icon: "bg-warning-bg text-warning-text", border: "border-warning-border", badge: "bg-warning-bg text-warning-text", tag: "bg-warning-bg text-warning-text" },
  success: { icon: "bg-success-bg text-success-text", border: "border-success-border", badge: "bg-success-bg text-success-text", tag: "bg-success-bg text-success-text" },
};

// ─── Compute bidirectional conflict keys for a feature ────────────────────────
function getConflictKeys(feature) {
  const direct = feature.conflictsWith || [];
  const reverse = FEATURES
    .filter(f => f.conflictsWith?.includes(feature.key))
    .map(f => f.key);
  return [...new Set([...direct, ...reverse])];
}

// ─── Confirmation modal ───────────────────────────────────────────────────────
function ConfirmEnableModal({ feature, onConfirm, onCancel, saving, hasActiveConflict, activeConflictNames }) {
  const Icon = feature.icon;
  const role = COLOR_ROLE[feature.colorRole] || COLOR_ROLE.info;

  return (
    <Modal open title={`تفعيل ${feature.name}`} onClose={onCancel} maxWidth="max-w-lg" showDetach={false}>
      <div className="space-y-5">
        <p className="text-sm text-text-secondary font-bold leading-relaxed border-b border-border-subtle pb-4">
          {feature.desc}
        </p>

        <div className="space-y-2">
          <p className="text-xs font-black text-text-muted uppercase tracking-wider">كل الصفحات والتغييرات المتأثرة:</p>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto pl-1">
            {feature.affectedPages.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-primary font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-success-text" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Existing data warning */}
        {feature.existingDataNote && (
          <div className="flex items-start gap-3 rounded-xl bg-warning-bg border border-warning-border p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning-text" />
            <p className="text-xs font-bold text-warning-text leading-relaxed">
              {feature.existingDataNote}
            </p>
          </div>
        )}

        {/* Active conflict warning — shown in modal too */}
        {hasActiveConflict && (
          <div className="flex items-start gap-3 rounded-xl bg-danger-bg border border-danger-border p-3">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger-text" />
            <div>
              <p className="text-xs font-black text-danger-text">تعارض مع ميزة مفعّلة</p>
              <p className="text-xs font-bold text-danger-text opacity-80 mt-0.5 leading-relaxed">
                هذه الميزة تتعارض جزئياً مع: {activeConflictNames.join("، ")}. يمكنك تفعيلها لكن بعض الخيارات قد تكون مقيّدة.
              </p>
            </div>
          </div>
        )}

        {/* Permission note */}
        <div className="flex items-start gap-3 rounded-xl bg-info-bg border border-info-border p-4">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-info-text" />
          <div className="space-y-1">
            <p className="text-xs font-black text-info-text">التحكم بالصلاحيات</p>
            <p className="text-xs font-bold text-info-text opacity-80 leading-relaxed">
              بعد التفعيل، يمكنك التحكم في وصول المستخدمين لهذه الميزة من خلال شاشة «المستخدمين» ← إدارة الصلاحيات.
            </p>
          </div>
        </div>

        {/* Irreversible warning — shown once here, not repeated at page bottom */}
        <div className="flex items-start gap-3 rounded-xl border border-danger-border bg-danger-bg p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-danger-text" />
          <div className="space-y-1">
            <p className="text-xs font-black text-danger-text">تحذير هام — لا يمكن التراجع</p>
            <p className="text-xs font-bold text-danger-text leading-relaxed opacity-80">
              بعد تفعيل هذه الميزة <strong>لن تتمكن من إيقافها</strong> لاحقاً.
              البيانات التي تُضاف بعد التفعيل مرتبطة بالميزة وقد تتأثر إن أوقفت.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-black text-text-muted uppercase tracking-wider">موصى به لـ:</span>
          {feature.recommendedFor.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-bg-input px-2 py-0.5 text-xs font-bold text-text-secondary">{tag}</span>
          ))}
        </div>

        <div className="flex gap-3 pt-1 border-t border-border-subtle">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">إلغاء</Button>
          <Button type="button" disabled={saving} onClick={onConfirm} className="flex-1">
            {saving ? "جاري التفعيل..." : "تفعيل ←"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Inline config panels ─────────────────────────────────────────────────────
function ScaleConfigPanel({ settings, onInlineChange, handleKeyDown }) {
  const prefixRef = React.useRef(null);
  const codeLengthRef = React.useRef(null);
  const valueTypeRef = React.useRef(null);
  const decimalsRef = React.useRef(null);

  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-4 space-y-3">
      <h5 className="text-xs font-black text-warning-text flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5" /> إعدادات الميزان
      </h5>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          ref={prefixRef}
          label="بادئة الباركود (prefix)"
          value={settings.scale_prefix ?? "22"}
          onChange={(e) => onInlineChange("scale_prefix", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, { nextRef: codeLengthRef })}
          placeholder="22"
        />
        <Input
          ref={codeLengthRef}
          label="طول كود الصنف (PLU)"
          type="number" min={1} max={8}
          value={settings.scale_item_code_length ?? 5}
          onChange={(e) => onInlineChange("scale_item_code_length", Number(e.target.value))}
          onKeyDown={(e) => handleKeyDown(e, { nextRef: valueTypeRef, prevRef: prefixRef })}
        />
        <Select
          ref={valueTypeRef}
          label="نوع القيمة"
          value={settings.scale_value_type ?? "weight"}
          onChange={(e) => onInlineChange("scale_value_type", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, { nextRef: decimalsRef, prevRef: codeLengthRef })}
        >
          <option value="weight">وزن (كيلو)</option>
          <option value="price">سعر (جنيه)</option>
        </Select>
        <Input
          ref={decimalsRef}
          label="عدد الخانات العشرية"
          type="number" min={0} max={4}
          value={settings.scale_value_decimals ?? 3}
          onChange={(e) => onInlineChange("scale_value_decimals", Number(e.target.value))}
          onKeyDown={(e) => handleKeyDown(e, { prevRef: valueTypeRef })}
        />
      </div>
      <p className="text-xs text-warning-text font-bold opacity-80">
        مثال: باركود <span dir="ltr" className="font-mono">2200123001500x</span> ← بادئة 22 + كود 00123 + قيمة 00150 (150 جرام).
      </p>
    </div>
  );
}

function SerialConfigPanel({ settings, onInlineChange }) {
  return (
    <div className="rounded-xl border border-danger-border bg-danger-bg p-4 space-y-3">
      <h5 className="text-xs font-black text-danger-text flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5" /> إعدادات السيريال / IMEI
      </h5>
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          role="checkbox"
          aria-checked={settings.serials_strict_mode !== 0}
          tabIndex={0}
          onClick={() => onInlineChange("serials_strict_mode", settings.serials_strict_mode !== 0 ? 0 : 1)}
          onKeyDown={(e) => e.key === " " && onInlineChange("serials_strict_mode", settings.serials_strict_mode !== 0 ? 0 : 1)}
          className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer shrink-0 ${settings.serials_strict_mode !== 0 ? "bg-danger-text" : "bg-border-normal"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg-surface shadow transition-all ${settings.serials_strict_mode !== 0 ? "right-0.5" : "left-0.5"}`} />
        </div>
        <span className="text-xs font-bold text-danger-text">الوضع الصارم — يتطلب إدخال سيريال لكل وحدة من الصنف</span>
      </label>
      <p className="text-xs text-danger-text opacity-80 font-bold">
        عند التفعيل، يجب مسح أو إدخال رقم سيريال لكل كمية عند البيع والاستلام. عند الإيقاف، يمكن ترك بعض السيريالات فارغة.
      </p>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ feature, enabled, settings, onRequestEnable, onInlineChange, handleKeyDown }) {
  const Icon = feature.icon;
  const role = COLOR_ROLE[feature.colorRole] || COLOR_ROLE.info;
  // Enabled cards start expanded; disabled start collapsed
  const [expanded, setExpanded] = useState(enabled);

  // Bidirectional conflict keys (fix #8)
  const allConflictKeys = getConflictKeys(feature);
  // Only show chips for features that are currently active (fix #9)
  const activeConflictKeys = allConflictKeys.filter(k => Boolean(settings[k]));
  const activeConflictNames = activeConflictKeys.map(k => FEATURES.find(f => f.key === k)?.name || k);
  const hasActiveConflict = activeConflictKeys.length > 0;

  // Works-well-with — only show for enabled peers
  const activeWorksWellKeys = (feature.worksWellWith || []).filter(k => Boolean(settings[k]));

  return (
    <div className={`rounded-xl border-2 transition-all ${
      enabled
        ? `${role.border} bg-bg-surface shadow-card`
        : hasActiveConflict
          ? "border-warning-border bg-warning-bg/30 hover:border-warning-border hover:shadow-sm"
          : "border-border-subtle bg-bg-surface hover:border-primary hover:bg-bg-surface hover:shadow-sm"
    }`}>
      <div className="p-5 space-y-4">

        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${role.icon} mt-0.5`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-black text-text-primary">{feature.name}</h4>

              {enabled ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-xs font-black text-success-text">
                  <Lock className="h-3 w-3" />
                  مُفعّل
                </span>
              ) : hasActiveConflict ? (
                // Fix #10 — conflict warning button instead of plain activate
                <button
                  type="button"
                  onClick={onRequestEnable}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-warning-bg border border-warning-border hover:bg-warning-border active:scale-95 transition-all px-3 py-1.5 text-xs font-black text-warning-text"
                >
                  <TriangleAlert className="h-3 w-3" />
                  تفعيل (تعارض)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRequestEnable}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary hover:bg-primary-600 active:scale-95 transition-all px-3 py-1.5 text-xs font-black text-white"
                >
                  تفعيل ←
                </button>
              )}
            </div>

            <p className="mt-1 text-xs font-bold leading-relaxed text-text-muted">
              {feature.desc}
            </p>

            {/* Relationship chips — only for active peers (fix #8, #9) */}
            {(activeConflictKeys.length > 0 || activeWorksWellKeys.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activeWorksWellKeys.map(k => {
                  const name = FEATURES.find(f => f.key === k)?.name || k;
                  return (
                    <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-info-bg text-info-text border border-info-border">
                      <Link2 className="h-2.5 w-2.5 shrink-0" /> يعمل مع: {name}
                    </span>
                  );
                })}
                {activeConflictKeys.map(k => {
                  const name = FEATURES.find(f => f.key === k)?.name || k;
                  return (
                    <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-warning-bg text-warning-text border border-warning-border">
                      <XCircle className="h-2.5 w-2.5 shrink-0" /> تعارض مع: {name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recommended-for tags */}
        <div className={`flex flex-wrap items-center gap-1.5 border-t pt-3 ${enabled ? "border-border-subtle" : "border-border-subtle"}`}>
          <span className="text-xs font-black text-text-muted uppercase tracking-wider">موصى به لـ:</span>
          {feature.recommendedFor.map((tag) => (
            <span key={tag} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
              enabled ? "bg-success-bg text-success-text" : "bg-bg-input text-text-secondary"
            }`}>
              {tag}
            </span>
          ))}
        </div>

        {/* Affected pages — collapsible for both enabled AND disabled (fix #6) */}
        <div className="border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => setExpanded(p => !p)}
            className="flex items-center gap-1 text-xs font-black text-text-muted hover:text-text-secondary transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "إخفاء التفاصيل" : `عرض الصفحات المتأثرة (${feature.affectedPages.length})`}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1.5">
              {feature.affectedPages.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-bold text-text-secondary">
                  {enabled
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-success-text" />
                    : <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-border-normal" />}
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Inline config panel — rendered inside card when enabled (fix #12) */}
        {enabled && feature.hasInlineConfig === "scale" && (
          <ScaleConfigPanel settings={settings} onInlineChange={onInlineChange} handleKeyDown={handleKeyDown} />
        )}
        {enabled && feature.key === "feature_serials" && (
          <SerialConfigPanel settings={settings} onInlineChange={onInlineChange} />
        )}

      </div>
    </div>
  );
}

// ─── Main tab component ───────────────────────────────────────────────────────
export default function FeaturesTab({ settings, onChange }) {
  const [confirmFeature, setConfirmFeature] = useState(null);
  const [saving, setSaving] = useState(false);
  const handleKeyDown = useFieldNavigation();

  const enabledCount = FEATURES.filter((f) => Boolean(settings[f.key])).length;

  function handleEnable(key) {
    onChange(key, 1);
    setConfirmFeature(null);
  }

  const handleInlineChange = (key, value) => {
    onChange(key, value);
  };

  // Conflict data for the confirmation modal
  const confirmConflictKeys = confirmFeature ? getConflictKeys(confirmFeature).filter(k => Boolean(settings[k])) : [];
  const confirmConflictNames = confirmConflictKeys.map(k => FEATURES.find(f => f.key === k)?.name || k);

  return (
    <div className="space-y-6">

      {/* Header — simple count, no misleading progress bar (fix #5) */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-bg-surface px-5 py-4">
        <div>
          <p className="text-sm font-black text-text-primary">إضافات وميزات النظام</p>
          <p className="text-xs text-text-muted font-bold mt-0.5">
            {enabledCount === 0
              ? "مفيش أي ميزة شغالة — النظام شغال على قد الأساسيات بس"
              : `مشغل ${enabledCount} من أصل ${FEATURES.length} ميزة — كل ميزة بتفتحلك صفحات واختيارات جديدة`}
          </p>
        </div>
        {enabledCount > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1.5 text-sm font-black text-success-text">
            <Lock className="h-3.5 w-3.5" />
            {enabledCount}/{FEATURES.length}
          </span>
        )}
      </div>

      {/* Permission management note — only when something is enabled */}
      {enabledCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-info-bg border border-info-border p-4">
          <Shield className="h-5 w-5 shrink-0 mt-0.5 text-info-text" />
          <div className="space-y-1">
            <p className="text-xs font-black text-info-text">التحكم بصلاحيات الميزات للمستخدمين</p>
            <p className="text-xs font-bold text-info-text opacity-80 leading-relaxed">
              بعد تفعيل أي ميزة، يمكنك تحديد المستخدمين المسموح لهم بالوصول إليها من خلال
              {' '}<strong>الإعدادات ← المستخدمين ← إدارة الصلاحيات</strong>.
              كل صفحة جديدة مرتبطة بميزة تظهر كبند مستقل في قائمة الصلاحيات.
            </p>
          </div>
        </div>
      )}

      {/* Feature grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.key}
            feature={feature}
            enabled={Boolean(settings[feature.key])}
            settings={settings}
            onRequestEnable={() => setConfirmFeature(feature)}
            onInlineChange={handleInlineChange}
            handleKeyDown={handleKeyDown}
          />
        ))}
      </div>

      {/* Confirmation modal */}
      {confirmFeature && (
        <ConfirmEnableModal
          feature={confirmFeature}
          saving={saving}
          hasActiveConflict={confirmConflictKeys.length > 0}
          activeConflictNames={confirmConflictNames}
          onConfirm={() => handleEnable(confirmFeature.key)}
          onCancel={() => setConfirmFeature(null)}
        />
      )}

      {/* Global irreversible warning REMOVED — shown in the modal at point-of-action only (fix #7) */}

    </div>
  );
}
