import React, { useState } from "react";
import { Package, Shirt, Smartphone, Scale, Wrench, UtensilsCrossed, Gem, Lock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

const FEATURES = [
  {
    key: "feature_multi_unit",
    icon: Package,
    color: "bg-sky-600",
    ringColor: "ring-sky-200",
    name: "وحدات القياس المتعددة",
    desc: "بيع الصنف بوحدات مختلفة — كرتونة، دستة، قطعة — لكل منها سعر بيع وباركود مستقل. المخزون يُحسب دائماً بالوحدة الأساسية فقط.",
    recommendedFor: ["سوبر ماركت", "بقالة", "جملة ونصف جملة"],
    affectedPages: [
      "قاعدة الأصناف ← قسم «وحدات إضافية» في نافذة الصنف (اسم الوحدة، المعامل، سعر وباركود لكل وحدة)",
      "نقطة البيع ← زر اختيار وحدة البيع على كل سطر بالفاتورة + قراءة باركود الوحدة",
      "المخزون ← يُحسب دائماً بالوحدة الأساسية (بيع كرتونة = خصم عدد القطع تلقائياً)",
      "الفواتير والمرتجعات ← حفظ الوحدة المباعة وعرضها في تفاصيل الفاتورة",
      "التقارير ← تقرير «تشكيلة وحدات البيع»",
    ],
  },
  {
    key: "feature_variants",
    icon: Shirt,
    color: "bg-violet-600",
    ringColor: "ring-violet-200",
    name: "المتغيرات (مقاسات وألوان)",
    desc: "إنشاء مصفوفة مقاسات × ألوان لكل صنف أب، مع مخزون وسعر وباركود مستقل لكل متغير فرعي.",
    recommendedFor: ["ملابس", "أحذية", "إكسسوارات"],
    affectedPages: [
      "قاعدة الأصناف ← تبويب «المتغيرات» + مولّد مصفوفة (مقاس × لون) بسعر ومخزون وصورة لكل متغير",
      "قائمة الأصناف ← تجميع المتغيرات الفرعية تحت الصنف الأب",
      "فواتير المبيعات ← منع بيع الصنف الأب مباشرةً (يجب اختيار متغير)",
      "نقطة البيع ← نافذة اختيار المتغير عند اختيار الصنف الأب",
      "التقارير ← تجميع المبيعات حسب الصنف الأب + معدل تصريف لكل متغير",
    ],
    disableWarning: "البيانات تُحفظ — أصناف المتغيرات تعمل كأصناف عادية عند الإيقاف.",
  },
  {
    key: "feature_serials",
    icon: Smartphone,
    color: "bg-rose-600",
    ringColor: "ring-rose-200",
    name: "تتبع السيريال / IMEI",
    desc: "ربط رقم سيريال أو IMEI بكل قطعة مباعة ومشتراة، مع سجل كامل للحركة وحالة الضمان لكل رقم.",
    recommendedFor: ["محلات موبايل", "إلكترونيات", "أجهزة"],
    affectedPages: [
      "قاعدة الأصناف ← خانة «تتبع السيريال» وشهور الضمان لكل صنف",
      "نقطة البيع ← مسح أرقام السيريال عند البيع (وضع إلزامي أو مرن)",
      "المرتجعات ← اختيار السيريال من أرقام نفس الفاتورة فقط (منع التلاعب)",
      "المشتريات ← إدخال السيريالات عند استلام البضاعة",
      "الشريط الجانبي ← صفحة «بحث السيريال / IMEI» مع السجل وحالة الضمان (جديدة)",
    ],
  },
  {
    key: "feature_scale_barcodes",
    icon: Scale,
    color: "bg-amber-600",
    ringColor: "ring-amber-200",
    name: "باركود الميزان",
    desc: "قراءة باركود EAN-13 الصادر من الميزان الإلكتروني واستخراج الوزن أو السعر تلقائياً عند المسح في نقطة البيع.",
    recommendedFor: ["سوبر ماركت", "جزارة", "خضار وفاكهة", "أجبان"],
    affectedPages: [
      "نقطة البيع ← قراءة باركود الميزان واستخراج الوزن/السعر تلقائياً عند المسح",
      "قاعدة الأصناف ← حقل «كود الميزان (PLU)» لربط الصنف بالميزان",
      "الإعدادات ← لوح إعدادات الميزان (البادئة، طول الكود، نوع القيمة، الخانات العشرية)",
      "التقارير ← مبيعات أصناف الميزان بالوزن",
    ],
  },
  {
    key: "feature_repair_orders",
    icon: Wrench,
    color: "bg-orange-600",
    ringColor: "ring-orange-200",
    name: "أوامر الصيانة والإصلاح",
    desc: "نظام متكامل لإدارة طلبات الصيانة: استلام الجهاز، التشخيص، قطع الغيار، العمالة، الإيداع، وإصدار فاتورة عند التسليم.",
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
    color: "bg-emerald-600",
    ringColor: "ring-emerald-200",
    name: "وضع المطعم (طاولات + وصفات)",
    desc: "إدارة الطاولات والطلبات، المعدّلات (إضافات وتخصيصات)، الوصفات واستهلاك المكونات تلقائياً عند البيع، وطباعة تذكرة المطبخ.",
    recommendedFor: ["كافيه", "مطعم", "عصائر", "كشري"],
    affectedPages: [
      "الشريط الجانبي ← صفحة «طاولات المطعم» (خريطة بصرية — جديدة)",
      "نقطة البيع ← ربط الطلب بطاولة، اختيار الإضافات، ورسوم الخدمة",
      "قاعدة الأصناف ← تبويب «الوصفة» لخصم المكونات تلقائياً عند البيع",
      "المطبخ ← طباعة تذكرة المطبخ موجّهة حسب القسم",
      "الفواتير والخزينة ← إظهار رسوم الخدمة ضمن تفاصيل الفاتورة",
    ],
  },
  {
    key: "feature_gold",
    icon: Gem,
    color: "bg-yellow-600",
    ringColor: "ring-yellow-200",
    name: "تسعير الذهب والمجوهرات",
    desc: "تسعير أصناف الذهب بالوزن × سعر عيار اليوم مع المصنعية. إدخال يومي للأسعار، وتسعير تلقائي في نقطة البيع.",
    recommendedFor: ["محلات الذهب", "المجوهرات"],
    affectedPages: [
      "الشريط الجانبي ← صفحة «أسعار الذهب اليوم» لإدخال سعر العيار (جديدة)",
      "قاعدة الأصناف ← حقول الذهب (العيار، الوزن بالجرام، المصنعية)",
      "نقطة البيع ← تسعير تلقائي: وزن × سعر العيار + المصنعية + تنبيه إدخال سعر اليوم",
      "الفواتير ← حفظ تفاصيل الذهب وعرضها في التفاصيل والمطبوعات",
    ],
  },
];

function ConfirmEnableModal({ feature, onConfirm, onCancel, saving }) {
  const Icon = feature.icon;
  return (
    <Modal open title="" onClose={onCancel} maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${feature.color} text-white`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">تفعيل ميزة</p>
            <h3 className="text-lg font-black text-slate-900">{feature.name}</h3>
          </div>
        </div>

        <p className="text-[13px] text-slate-600 leading-relaxed border-b border-slate-100 pb-4">{feature.desc}</p>

        {/* Affected pages */}
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">كل التغييرات والتأثيرات التي ستحدث عند التفعيل:</p>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto pl-1">
            {feature.affectedPages.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-slate-700 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Irreversibility warning */}
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
          <div className="space-y-1">
            <p className="text-[12px] font-black text-red-800">تحذير هام — لا يمكن التراجع</p>
            <p className="text-[11px] text-red-700 font-bold leading-relaxed">
              بعد تفعيل هذه الميزة <strong>لن تتمكن من إيقافها</strong> لاحقاً.
              البيانات التي تُضاف بعد التفعيل (أرقام سيريال، وحدات، وصفات...) مرتبطة بالميزة وقد تتأثر إن أُوقفت.
              إذا لم تكن متأكداً، استشر مسؤول النظام أولاً.
            </p>
          </div>
        </div>

        {/* Recommended for */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">موصى به لـ:</span>
          {feature.recommendedFor.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{tag}</span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="flex-1">إلغاء</Button>
          <Button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? "جاري التفعيل..." : "تفعيل نهائياً ←"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FeatureCard({ feature, enabled, onRequestEnable }) {
  const Icon = feature.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border-2 transition-all ${
      enabled
        ? `border-emerald-200 bg-white shadow-sm ring-4 ${feature.ringColor}`
        : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white hover:shadow-sm"
    }`}>
      <div className="p-5 space-y-4">
        {/* Top row: icon + name + status/action */}
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${feature.color} text-white mt-0.5`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className={`text-sm font-black ${enabled ? "text-slate-900" : "text-slate-700"}`}>{feature.name}</h4>
              {enabled ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
                  <Lock className="h-3 w-3" />
                  مُفعّل نهائياً
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRequestEnable}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all px-3 py-1.5 text-[11px] font-black text-white"
                >
                  تفعيل ←
                </button>
              )}
            </div>
            <p className={`mt-1 text-[12px] font-bold leading-relaxed ${enabled ? "text-slate-600" : "text-slate-400"}`}>
              {feature.desc}
            </p>
          </div>
        </div>

        {/* Affected pages — collapsible when disabled, always visible when enabled */}
        {enabled ? (
          <ul className="space-y-1.5 border-t border-slate-100 pt-3">
            {feature.affectedPages.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                {p}
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setExpanded(p => !p)}
              className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "إخفاء التفاصيل" : `عرض الصفحات المتأثرة (${feature.affectedPages.length})`}
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                {feature.affectedPages.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500 font-bold">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Recommended for tags */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">موصى به لـ:</span>
          {feature.recommendedFor.map((tag) => (
            <span key={tag} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FeaturesTab({ settings, onChange, onSilentSave }) {
  const [confirmFeature, setConfirmFeature] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleEnable(key) {
    setSaving(true);
    onChange(key, 1);
    try {
      await onSilentSave({ ...settings, [key]: 1 });
      toast.success("تم تفعيل الميزة بنجاح");
    } catch {
      toast.error("تعذر تفعيل الميزة — تحقق من الاتصال");
      onChange(key, 0);
    } finally {
      setSaving(false);
      setConfirmFeature(null);
    }
  }

  const handleScaleChange = async (key, value) => {
    onChange(key, value);
    try {
      await onSilentSave({ ...settings, [key]: value });
    } catch {
      toast.error("تعذر حفظ إعداد الميزان");
    }
  };

  const enabledCount = FEATURES.filter(f => Boolean(settings[f.key])).length;

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <p className="text-sm font-black text-slate-800">وحدات النظام القابلة للتفعيل</p>
          <p className="text-[12px] text-slate-500 font-bold mt-0.5">
            {enabledCount === 0
              ? "لم يتم تفعيل أي ميزة بعد — النظام يعمل بالإعداد الافتراضي"
              : `${enabledCount} من ${FEATURES.length} ميزات مُفعّلة`}
          </p>
        </div>
        <div className="flex gap-1">
          {FEATURES.map(f => (
            <span
              key={f.key}
              title={f.name}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${Boolean(settings[f.key]) ? "bg-emerald-400" : "bg-slate-200"}`}
            />
          ))}
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
        <div className="space-y-1">
          <p className="text-[12px] font-black text-amber-900">تفعيل الميزات غير قابل للتراجع</p>
          <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
            بعد تفعيل أي ميزة <strong>لن تتمكن من إيقافها</strong>.
            كل ميزة مستقلة ولا تؤثر على الميزات الأخرى.
            البيانات لا تُحذف أبداً — الميزات تُضيف صفحات وإمكانيات جديدة فقط.
          </p>
        </div>
      </div>

      {/* Feature cards grid */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 items-start">
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.key}
            feature={feature}
            enabled={Boolean(settings[feature.key])}
            onRequestEnable={() => setConfirmFeature(feature)}
          />
        ))}
      </div>

      {/* Scale barcode config — only shown when feature is on */}
      {Boolean(settings.feature_scale_barcodes) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
          <h4 className="text-sm font-black text-amber-800 flex items-center gap-2">
            <Scale className="h-4 w-4" />
            إعدادات الميزان
          </h4>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Input
              label="بادئة الباركود (prefix)"
              value={settings.scale_prefix ?? "22"}
              onChange={e => handleScaleChange("scale_prefix", e.target.value)}
              placeholder="22"
            />
            <Input
              label="طول كود الصنف (PLU)"
              type="number"
              min={1} max={8}
              value={settings.scale_item_code_length ?? 5}
              onChange={e => handleScaleChange("scale_item_code_length", Number(e.target.value))}
            />
            <Select
              label="نوع القيمة"
              value={settings.scale_value_type ?? "weight"}
              onChange={e => handleScaleChange("scale_value_type", e.target.value)}
            >
              <option value="weight">وزن (كيلو)</option>
              <option value="price">سعر (جنيه)</option>
            </Select>
            <Input
              label="عدد الخانات العشرية"
              type="number"
              min={0} max={4}
              value={settings.scale_value_decimals ?? 3}
              onChange={e => handleScaleChange("scale_value_decimals", Number(e.target.value))}
            />
          </div>
          <p className="text-[11px] text-amber-700 font-bold">
            مثال: باركود <span dir="ltr" className="font-mono">2200123001500x</span> ← بادئة 22 + كود 00123 + قيمة 00150 (150 جرام).
          </p>
        </div>
      )}

      {/* Confirm enable modal */}
      {confirmFeature && (
        <ConfirmEnableModal
          feature={confirmFeature}
          saving={saving}
          onConfirm={() => handleEnable(confirmFeature.key)}
          onCancel={() => !saving && setConfirmFeature(null)}
        />
      )}
    </div>
  );
}
