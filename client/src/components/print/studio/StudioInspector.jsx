import React, { useRef, useState } from "react";
import {
  Bold, Italic, AlignRight, AlignCenter, AlignLeft, Eye, EyeOff, Trash2,
  ArrowUp, ArrowDown, Copy, ClipboardPaste, Wrench, RotateCcw, Stamp,
  Type, Image as ImageIcon, Move, X,
} from "lucide-react";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { PLACEHOLDER_KEYS } from "../blocks/placeholders";
import { g } from "../blocks/blockUtils";
import { COMPUTED_FIELDS } from "../blocks/CustomFieldBlock";
import { PRINT_FONT_FAMILIES } from "../../../services/printFonts";
import { COLUMN_CATALOG, PHYSICAL_COUNT_COLUMN_CATALOG, BLOCK_DOC_SCOPES } from "./studioData";
import { defaultReportColumns } from "../layout/layoutModel";

const BLOCK_VARIANTS = {
  company_name: [
    { value: "standard", label: "افتراضي" },
    { value: "retro-brutalist", label: "شريط معبأ (Brutalist)" },
    { value: "underline-accent", label: "حاشية جانبية (Underline)" },
    { value: "stacked-bilingual", label: "ثنائي اللغة (Bilingual)" },
    { value: "initial-cap", label: "حرف بداية ضخم" },
    { value: "boxed", label: "مؤطر بحدود" },
    { value: "minimal", label: "صغير وبسيط" },
  ],
  grand_total: [
    { value: "band", label: "شريط معبّأ" },
    { value: "boxed", label: "صندوق مزدوج" },
    { value: "plain", label: "سطر بخط علوي" },
    { value: "huge", label: "رقم ضخم متمركز" },
    { value: "dual-row", label: "سطر مزدوج مع التفقيط" },
    { value: "stripe", label: "شريط ممتد عريض" },
    { value: "receipt-tape", label: "نمط إيصال (متقطع)" },
    { value: "tag", label: "شارة السعر (تاغ)" },
    { value: "split-amount", label: "مبلغ إجمالي منقسم" },
    { value: "tafqeet-band", label: "شريط أسود + تفقيط" },
    { value: "stacked", label: "مبلغ فوق وسطر تحت" },
    { value: "double-line", label: "حدود مزدوجة أعلى وأسفل" },
    { value: "reverse-band", label: "شريط معكوس (أبيض على أسود)" },
  ],
  payments: [
    { value: "standard", label: "افتراضي" },
    { value: "status-stamp", label: "ختم الحالة" },
    { value: "table-row", label: "صفوف الجدول الموزعة" },
    { value: "badge-pill", label: "كبسولات ملونة" },
    { value: "compact", label: "مضغوط جداً" },
    { value: "summary", label: "ملخص سطر واحد" },
    { value: "inline", label: "مدمج بفواصل" },
    { value: "minimal", label: "بسيط بلا حدود" },
    { value: "dashed-box", label: "صواديف متقطعة لكل دفعة" },
    { value: "columns", label: "جدول عمودين (الطريقة/المبلغ)" },
    { value: "labeled-stamp", label: "ختم مدفوع مع التفاصيل" },
    { value: "arrow", label: "سهم فاصل ←" },
  ],
  items_table: [
    { value: "standard", label: "جدول تقليدي" },
    { value: "cards", label: "كروت منفصلة (فاخر)" },
    { value: "minimalist-list", label: "قائمة مبسطة (هادئ)" },
    { value: "ledger", label: "دفتر أستاذ (Monospace)" },
    { value: "receipt", label: "إيصال كلاسيكي (نقاط)" },
    { value: "ticket", label: "تذكرة طلب (مرقّم)" },
    { value: "dashed", label: "صواديف متقطعة" },
    { value: "boxed-items", label: "صناديق منفصلة لكل صنف" },
    { value: "numbered", label: "نقاط مرمّزة (1. 2. 3.)" },
    { value: "two-line", label: "سطرين لكل صنف" },
    { value: "striped", label: "خطوط متناوبة (Striped)" },
    { value: "receipt-wide", label: "إيصال عريض 4 أعمدة" },
    { value: "compact", label: "مضغوط جداً" },
    { value: "borderless", label: "بلا حدود (نقاط فقط)" },
  ],
  report_table: [
    { value: "standard", label: "جدول تقليدي" },
    { value: "cards", label: "كروت منفصلة" },
    { value: "minimalist-list", label: "قائمة مبسطة" },
    { value: "ledger", label: "دفتر أستاذ" },
    { value: "bordered-cards", label: "كروت بحدود ملونة" },
    { value: "compact-row", label: "صفوف مضغوطة" },
    { value: "highlighted", label: "أعمدة مميزة" },
    { value: "split-label", label: "تسمية | قيمة" },
    { value: "numbered", label: "مرقّم تلقائي" },
    { value: "accent-stripe", label: "شريط جانبي مميز" },
  ],
  doc_title: [
    { value: "standard", label: "عنوان عادي باللون المميز" },
    { value: "badge", label: "شارة ملونة ممتلئة" },
    { value: "ruled", label: "عنوان محاط بخطوط" },
    { value: "brutalist", label: "مربع بروتالي حاد" },
  ],
  doc_number: [
    { value: "standard", label: "الرقم كجزء من قائمة" },
    { value: "boxed", label: "صندوق بارز ملون" },
    { value: "inline", label: "رقم مدمج مبسط" },
    { value: "giant", label: "رقم ضخم أعلى المستند" },
    { value: "minimal", label: "رقم صغير مركزي" },
  ],
  doc_date: [
    { value: "standard", label: "تاريخ عادي مع الوقت" },
    { value: "inline", label: "سطر واحد خفيف" },
    { value: "badge", label: "شارة تقويمية صغيرة" },
    { value: "ruled", label: "بين خطين أفقيين" },
    { value: "minimal", label: "تاريخ صغير مركزي" },
  ],
  customer: [
    { value: "standard", label: "افتراضي جانبي" },
    { value: "stacked", label: "تسمية فوق الاسم عريض" },
    { value: "boxed", label: "صندوق بيانات العميل" },
    { value: "two-column", label: "تقسيم لعمودين متقابلين" },
    { value: "inline", label: "سطر مدمج بسيط" },
    { value: "minimal", label: "معلومات مصغرة" },
    { value: "compact", label: "مضغوط بخط منقّط" },
  ],
  cashier: [
    { value: "standard", label: "افتراضي" },
    { value: "inline", label: "بسطر واحد خفيف" },
    { value: "badge", label: "شارة موظف" },
    { value: "boxed", label: "صندوق محاط بحدود" },
    { value: "minimal", label: "بلا عنوان صغير" },
    { value: "compact", label: "مضغوط بخط منقّط" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "name-only", label: "الاسم فقط بدون عنوان" },
  ],
  logo: [
    { value: "standard", label: "شعار طبيعي" },
    { value: "circle", label: "دائري مع حدود" },
    { value: "rounded", label: "زوايا ناعمة" },
    { value: "boxed", label: "مؤطر بصندوق خفيف" },
    { value: "framed", label: "بخطوط أفقيين أعلى وأسفل" },
    { value: "centered-large", label: "كبير ومتمركز" },
  ],
  qr: [
    { value: "standard", label: "افتراضي" },
    { value: "centered", label: "متمركز في المنتصف" },
    { value: "boxed", label: "مؤطر مع ترويسة" },
    { value: "with-border", label: "مع إطار وتفاصيل" },
  ],
  notes: [
    { value: "standard", label: "سطور ملاحظات عادية" },
    { value: "boxed", label: "مربع إحاطة خفيف" },
    { value: "alert", label: "تنبيه باللون التحذيري" },
    { value: "quote", label: "مقتبس بخط جانبي سميك" },
    { value: "inline", label: "سطر مدمج بسيط" },
    { value: "minimal", label: "صغير وبسيط" },
    { value: "compact", label: "مضغوط بخط منقّط" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "boxed-centered", label: "صندوق متمركز" },
  ],
  divider: [
    { value: "solid", label: "مستمر" },
    { value: "dashed", label: "متقطع" },
    { value: "dotted", label: "منقط" },
    { value: "double", label: "مزدوج" },
    { value: "dots", label: "رموز نقاط · · ·" },
    { value: "dash", label: "رموز شرطات — —" },
    { value: "wave", label: "رموز موجات ∼ ∼" },
  ],
  spacer: [
    { value: "small", label: "تباعد صغير 8px" },
    { value: "medium", label: "تباعد متوسط 16px" },
    { value: "large", label: "تباعد كبير 32px" },
  ],
  barcode: [
    { value: "standard", label: "افتراضي بالرقم أسفله" },
    { value: "centered", label: "متمركزي بلا نص" },
    { value: "compact", label: "مضغوط صغير" },
    { value: "framed", label: "مؤطر بحدود" },
    { value: "minimal", label: "بلا نص فقط الشريط" },
  ],
  order_number: [
    { value: "standard", label: "افتراضي" },
    { value: "huge", label: "رقم ضخم جداً" },
    { value: "badge", label: "شارة طلب دائرية" },
    { value: "boxed", label: "محاط بحدود مزدوجة" },
    { value: "inline", label: "سطر مدمج بسيط" },
    { value: "compact", label: "رقم صغير مدمج" },
  ],
  receipt_header_text: [
    { value: "standard", label: "افتراضي" },
    { value: "boxed", label: "صندوق محاط بحدود" },
    { value: "centered", label: "متمركزي متباعد" },
    { value: "underline-accent", label: "خط سفلي سميك" },
    { value: "minimal", label: "صغير وبسيط" },
  ],
  footer_text: [
    { value: "standard", label: "افتراضي" },
    { value: "boxed", label: "مؤطر بحدود خفيفة" },
    { value: "centered", label: "متمركزي متباعد" },
    { value: "minimal", label: "صغير وبسيط" },
    { value: "bordered", label: "خط فاصل علوي" },
    { value: "compact", label: "مضغوط صغير" },
    { value: "framed", label: "بنجوم ★ ومزدوج" },
  ],
  signature_lines: [
    { value: "standard", label: "افتراضي سطرين متقابلين" },
    { value: "split", label: "ثلاثة خطوط موزعة" },
    { value: "boxed", label: "مربعات توقيع مغلقة" },
  ],
  vendor_branding: [
    { value: "minimal", label: "سطر هادئ (خط علوي رفيع)" },
    { value: "badge", label: "شارة بيضاوية" },
    { value: "ribbon", label: "شريط ممتد" },
    { value: "stamp", label: "ختم مصغّر" },
  ],
  branch: [
    { value: "standard", label: "افتراضي" },
    { value: "badge", label: "شارة ملونة ممتلئة" },
    { value: "inline", label: "سطر واحد خفيف" },
    { value: "boxed", label: "صندوق محاط بحدود" },
  ],
  address: [
    { value: "standard", label: "افتراضي متسلسل" },
    { value: "inline", label: "سطر مدمج بنقاط" },
    { value: "boxed", label: "صندوق محاط بحدود" },
    { value: "badge", label: "شارة صغيرة" },
  ],
  tax_id: [
    { value: "standard", label: "افتراضي" },
    { value: "boxed", label: "شارة رقمية مؤطرة" },
    { value: "inline", label: "نص مدمج خفيف" },
    { value: "badge", label: "شارة دائرية ملونة" },
    { value: "minimal", label: "رقم صغير خفيف" },
  ],
  subtotal: [
    { value: "standard", label: "افتراضي" },
    { value: "plain", label: "بين خطين متقطعين" },
    { value: "boxed", label: "صندوق مظلل ملون" },
    { value: "badge", label: "شارة دائرية" },
    { value: "ruled", label: "بين خطين سميكين" },
    { value: "inline", label: "سطر صغير خفيف" },
    { value: "compact", label: "مضغوط بخط منقّط" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "dotted", label: "بنقاط منقطة" },
  ],
  discount: [
    { value: "standard", label: "افتراضي أحمر" },
    { value: "badge", label: "شارة خصم ممتلئة" },
    { value: "plain", label: "خط أحمر مدمج" },
    { value: "underline-accent", label: "خط سفلي سميك أحمر" },
    { value: "inline", label: "سطر صغير خفيف" },
    { value: "boxed", label: "صندوق محمر" },
    { value: "compact", label: "مضغوط بخط منقّط" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "dotted", label: "بنقاط منقطة" },
  ],
  increase: [
    { value: "standard", label: "افتراضي أخضر" },
    { value: "plain", label: "خط رسوم مدمج" },
    { value: "boxed", label: "صندوق رسوم مظلل" },
    { value: "badge", label: "شارة دائرية" },
    { value: "inline", label: "سطر صغير خفيف" },
    { value: "minimal", label: "بلا عنوان مدمج" },
    { value: "compact", label: "مضغوط بخط منقّط" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "dotted", label: "بنقاط منقطة" },
  ],
  tax: [
    { value: "standard", label: "افتراضي" },
    { value: "inline", label: "نص رمادي صغير" },
    { value: "plain", label: "بين خطين متقطعين" },
    { value: "ruled", label: "بين خط سميك" },
    { value: "boxed", label: "صندوق محاط بحدود" },
    { value: "badge", label: "شارة دائرية" },
    { value: "compact", label: "مضغوط بخط منقّط" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "dotted", label: "بنقاط منقطة" },
  ],
  watermark: [
    { value: "standard", label: "افتراضي (متوسط)" },
    { value: "light", label: "شفاف خفيف جداً" },
    { value: "strong", label: "شبه ظاهر ممتلئ" },
  ],
  receiver_signature: [
    { value: "standard", label: "افتراضي متسلسل" },
    { value: "boxed", label: "صندوق توقيع مغلق" },
    { value: "split", label: "توزيع ثنائي متقابل" },
    { value: "compact", label: "مضغوط صغير" },
  ],
  custom_text: [
    { value: "standard", label: "نص عادي" },
    { value: "alert", label: "تنبيه تحذيري ملون" },
    { value: "badge", label: "شارة ممتلئة ملونة" },
    { value: "banner", label: "بنر عريض بخلفية ممتلئة" },
    { value: "minimal", label: "صغير وبسيط" },
  ],
  custom_field: [
    { value: "standard", label: "افتراضي" },
    { value: "boxed", label: "صندوق محاط بحدود" },
    { value: "inline", label: "مدمج خفيف" },
    { value: "highlighted", label: "شارة ممتلئة ملونة" },
  ],
  image: [
    { value: "standard", label: "صورة عادية" },
    { value: "card", label: "كرت بحدود وظل" },
    { value: "banner", label: "بنر ممتد بالكامل" },
  ],
  // Physical count blocks
  physical_count_header: [
    { value: "standard", label: "قياسي" },
    { value: "boxed", label: "مؤطر بحدود" },
    { value: "minimal", label: "صغير وبسيط" },
  ],
  physical_count_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "compact", label: "مضغوط بحد سفلي" },
    { value: "minimal", label: "أعمدة مركزيّة بحد" },
    { value: "boxed", label: "صواني بحدود ملونة" },
  ],
  physical_count_items_table: [
    { value: "standard", label: "جدول تقليدي" },
    { value: "variance-only", label: "فروقات فقط" },
    { value: "grouped-by-warehouse", label: "مُجمّع حسب المستودع" },
    { value: "grouped-by-category", label: "مُجمّع حسب الفئة" },
    { value: "color-coded", label: "ملون حسب الفرق" },
  ],
  physical_count_signatures: [
    { value: "two-line", label: "سطرين" },
    { value: "three-line", label: "ثلاثة خطوط" },
    { value: "with-stamps", label: "مع ختم" },
    { value: "minimal", label: "سطر واحد" },
  ],
  bank_details: [
    { value: "standard", label: "بطاقة محاطة بحدود" },
    { value: "inline", label: "سطر مدمج" },
    { value: "boxed", label: "صندوق بحدود متينة" },
    { value: "minimal", label: "نص صغير بسيط" },
    { value: "lined", label: "بحدود سفلية لكل سطر" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
  ],
  doc_grid: [
    { value: "standard", label: "جدول شبكي" },
    { value: "compact", label: "مضغوط بسيط" },
    { value: "borderless", label: "بلا حدود (نقاط فقط)" },
    { value: "boxed", label: "محاط بحدود" },
    { value: "centered", label: "متمركزي بحدود متقطعة" },
    { value: "lined", label: "بحدود سفلية لكل سطر" },
  ],
  // Kitchen ticket blocks
  kitchen_order_header: [
    { value: "standard", label: "ترويسة بسيطة" },
    { value: "badge", label: "شارة ملونة" },
    { value: "minimal", label: "最小 بفاصل" },
    { value: "boxed", label: "محاط بحدود" },
    { value: "striped", label: "شريط مخطط" },
  ],
  kitchen_order_meta: [
    { value: "standard", label: "بيانات بفاصل متقطّع" },
    { value: "badge", label: "شارات ملونة" },
    { value: "inline", label: "سطر واحد مدمج" },
    { value: "compact", label: "مضغوط مركزي" },
    { value: "ruled", label: "محاط بحدود جانبية" },
  ],
  kitchen_items: [
    { value: "standard", label: "قائمة بسيطة" },
    { value: "cards", label: "بطاقات بحدود جانبية" },
    { value: "minimal", label: "قائمة مختصرة" },
    { value: "ticket", label: "ستايل تيكت بفاصل" },
    { value: "numbered", label: "مرقّم بدوائر" },
  ],
  kitchen_notes: [
    { value: "standard", label: "ملاحظة على خلفية صفراء" },
    { value: "alert", label: "تنبيه أحمر بحدود جانبية" },
    { value: "minimal", label: "ملاحظة بخط مائل" },
    { value: "boxed", label: "ملاحظة في صندوق متقطّع" },
    { value: "centered", label: "ملاحظة متمركزة" },
  ],
  kitchen_order_footer: [
    { value: "standard", label: "تذييل بسيط" },
    { value: "badge", label: "وقت في شارة" },
    { value: "minimal", label: "وقت فقط مركزي" },
    { value: "centered", label: "متمركز بفاصل متقطّع" },
    { value: "ruled", label: "محاط بحدود جانبية" },
  ],
  // Owner statement blocks
  owner_dashboard_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  owner_revenue_breakdown: [
    { value: "standard", label: "قائمة ب نقاط ملونة" },
    { value: "cards", label: "شبكة بطاقات" },
    { value: "bar", label: "أعمدة أفقية" },
    { value: "minimal", label: "أعمدة مركزيّة بحد" },
    { value: "compact", label: "قائمة مختصرة بفاصل" },
  ],
  owner_expense_categories: [
    { value: "standard", label: "قائمة ب مربّعات ملونة" },
    { value: "cards", label: "شبكة بطاقات (٣ أعمدة)" },
    { value: "pie", label: "رسم دائري + تفصيل" },
    { value: "minimal", label: "أعمدة تقدّمية" },
    { value: "badge", label: "وسوم ملوّنة" },
  ],
  owner_net_profit: [
    { value: "standard", label: "ثلاث بطاقات KPI" },
    { value: "band", label: "شريط ملوّن كامل" },
    { value: "minimal", label: "رقم ضخم بحد سفلي" },
    { value: "boxed", label: "ثلاث صواني ملوّنة" },
    { value: "stripe", label: "ثلاث خلفيات ملوّنة متتالية" },
  ],
  owner_period_comparison: [
    { value: "standard", label: "جدول مقارنة بأعمدة" },
    { value: "cards", label: "شبكة بطاقات مع نسب" },
    { value: "bar", label: "أعمدة مزدوجة (حالي/سابق)" },
    { value: "minimal", label: "أعمدة مركزيّة مختصرة" },
    { value: "compact", label: "قائمة مختصرة بنسب مئوية" },
  ],
  // Report/account metric blocks (shared MetricCard variants)
  bank_statement_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  ajal_statement_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  ajal_schedule_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  ajal_full_statement_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  daily_treasury_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  cheque_register_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  payment_methods_report_metrics: [
    { value: "standard", label: "بطاقات KPI بحدود علوية" },
    { value: "accent-band", label: "شريط ملون علوي" },
    { value: "minimal-rule", label: "حد سفلي ملوّن" },
    { value: "boxed", label: "صواني بحدود ملونة" },
    { value: "stripe", label: "شريط ملوّن علوي رفيع" },
  ],
  // Table summary blocks
  daily_treasury_summaries: [
    { value: "standard", label: "جدول تقليدي" },
    { value: "striped-compact", label: "مضغوط بترويسة ملونة" },
  ],
  payment_methods_by_method: [
    { value: "standard", label: "جدول تقليدي" },
    { value: "striped-compact", label: "مضغوط بترويسة ملونة" },
  ],
  // Party blocks
  ajal_party: [
    { value: "standard", label: "بطاقة رمادية بسيطة" },
    { value: "boxed-accent", label: "بحدود جانبية ملوّنة" },
  ],
  account_statement_party: [
    { value: "standard", label: "جدول بيانات برويسة ملوّنة" },
    { value: "boxed-accent", label: "بحدود جانبية ملوّنة" },
  ],
  // Ledger/summary blocks
  account_statement_ledger: [
    { value: "standard", label: "جدول تقليدي" },
    { value: "banded", label: "بألوان خلفية ملوّنة" },
  ],
  account_statement_summary: [
    { value: "standard", label: "جدول ملخص عادي" },
    { value: "boxed-strip", label: "مغلّف بحدود ملوّنة" },
  ],
  // Decorative divider
  pattern_divider: [
    { value: "standard", label: "خط مستمر" },
    { value: "double", label: "خط مزدوج" },
    { value: "dots", label: "نقاط متتالية" },
    { value: "dash-dot", label: "شرطة نقطة" },
    { value: "geometric", label: "رموز هندسية ◆◇◆" },
    { value: "star", label: "نجوم ✦✦✦" },
  ],
};

// Where an inserted element sits in the flow — any block, or the very top.
function InsertPosition({ st, ins, fam, inputCls }) {
  return (
    <label className="mt-2 flex items-center justify-between gap-2 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
      <span className="shrink-0">الموضع</span>
      <select value={ins.after} onChange={(e) => st.setInsert(ins.id, { after: e.target.value })} className={`${inputCls} w-40`}>
        <option value="__top__">أعلى المستند</option>
        {fam.order.map((t) => <option key={t} value={t}>بعد: {BLOCK_REGISTRY[t]?.label || t}</option>)}
      </select>
    </label>
  );
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SYSTEM_FONTS = [
  { value: "Tahoma", label: "Tahoma" },
  { value: "sans-serif", label: "Arial" },
  { value: "serif", label: "Times" },
  { value: "monospace", label: "Courier" },
];

// Blocks with no meaningful typography — they get only the controls that
// actually change their output (the audit rule: no for-show controls).
const NO_TYPOGRAPHY = new Set(["logo", "qr", "image", "divider", "spacer", "barcode"]);
// Blocks where the surface/box styling makes no sense either.
const NO_BOX = new Set(["spacer", "divider", "watermark"]);

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-[var(--border-subtle)] p-2.5">
    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</div>
    {children}
  </div>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
    <span className="shrink-0">{label}</span>
    {children}
  </div>
);

const inputCls = "h-8 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] px-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]";
const btnCls = (active) => `flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[11px] font-bold transition-colors disabled:opacity-30 ${active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"}`;

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border-normal)] px-3 py-2 hover:bg-[var(--bg-input)]">
      <span className="text-[11px] font-bold text-[var(--text-secondary)]">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg-surface transition-all ${checked ? "right-0.5" : "right-[18px]"}`} />
      </button>
    </label>
  );
}

// Color swatch + clear ("وراثة") — clearing removes the override entirely.
function ColorField({ value, onChange, onClear, fallback = "#0f172a" }) {
  return (
    <div className="flex items-center gap-1">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded-md border border-[var(--border-normal)]" />
      {value && onClear && (
        <button type="button" title="إزالة اللون (وراثة)" onClick={onClear}
          className="flex h-8 w-6 items-center justify-center rounded-md border border-[var(--border-normal)] text-[var(--text-muted)] hover:text-[var(--danger)]"><X size={11} /></button>
      )}
    </div>
  );
}

// Right panel: contextual inspector — every control shown maps to a value the
// renderer actually consumes for the selected element type.
export default function StudioInspector({ st }) {
  const [copiedStyle, setCopiedStyle] = useState(null);
  const logoFileRef = useRef(null);
  const imageFileRef = useRef(null);
  const overlayImgRef = useRef(null);

  const { selected, family, merged, fam } = st;
  const selInsert = selected ? (fam.inserted || []).find((b) => b.id === selected) : null;
  const selOverlay = selected && family === "page" ? st.overlays.find((o) => o.id === selected) : null;
  const selInOrder = selected && fam.order.includes(selected);
  const isBlockSel = !!selected && !selOverlay && (selInOrder || selInsert);
  const selType = selInsert ? selInsert.type : selected;
  const selOv = isBlockSel ? st.ov(selected) : {};
  const tblKey = selected === "report_table" ? "report_table"
    : selected === "physical_count_items_table" ? "physical_count_items_table"
    : "items_table";
  const isAbs = isBlockSel && selOv.abs && selOv.abs.xMm != null;
  const isNudged = isBlockSel && selOv.rel && (selOv.rel.dxMm || selOv.rel.dyMm);
  const hasTypography = isBlockSel && !NO_TYPOGRAPHY.has(selType);
  const hasBox = isBlockSel && !NO_BOX.has(selType);
  const selLabel = selected
    ? (selOverlay ? ({ text: "نص حر", stamp: "ختم", image: "صورة" }[selOverlay.type] || "عنصر حر")
      : (BLOCK_REGISTRY[selType]?.label || selected))
    : null;

  const readFile = (file, cb) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };

  const setOv = (patch) => st.setOverride(selected, patch);
  const setAbs = (patch) => st.setOverride(selected, { abs: { ...selOv.abs, ...patch } });

  // ── template docs: full inspector (mirrors block-doc flat settings) ──────
  if (!st.isBlockDoc) {
    const logoRef = logoFileRef;
    return (
      <div className="flex w-[310px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--border-normal)] bg-[var(--bg-surface)] p-3">

        {/* ── Branding ─────────────────────────────────────── */}
        <Section title="الهوية والشعار">
          <input ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setFlat("logo_url", src))} />
          <button type="button" onClick={() => logoRef.current?.click()}
            className="mb-2 w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
            {merged.logo_url ? "تغيير الشعار…" : "رفع شعار…"}
          </button>
          <Row label="ارتفاع الشعار (px)">
            <input type="number" value={Number(merged.logo_max_height) || 48}
              onChange={(e) => st.setFlat("logo_max_height", Math.max(16, Math.min(200, Number(e.target.value) || 48)))}
              className={`${inputCls} w-20`} />
          </Row>
          <Row label="لون العلامة التجارية">
            <ColorField value={merged.accent_color} fallback="#1e40af"
              onChange={(v) => st.setFlat("accent_color", v)}
              onClear={() => st.setFlat("accent_color", undefined)} />
          </Row>
          <Row label="شكل رأس المستند">
            <select value={fam.headerStyle || "band"}
              onChange={(e) => st.setFamLayout(() => ({ headerStyle: e.target.value }))}
              className={`${inputCls} w-36`}>
              <option value="band">شريط ملوّن عرضي</option>
              <option value="classic">كلاسيكي بحد سفلي</option>
              <option value="minimal">بسيط متباعد</option>
              <option value="centered">متمركز بالوسط</option>
              <option value="boxed">مؤطر في صندوق</option>
              <option value="asymmetric">شكل جانبي مدمج</option>
              <option value="brutalist">صندوق بروتالي حاد</option>
              <option value="inline">شريط أفقي مبسط</option>
              <option value="badge">شكل بطاقة أنيقة</option>
            </select>
          </Row>
        </Section>

        {/* ── Typography ───────────────────────────────────── */}
        <Section title="الخط والحجم">
          <Row label="الخط">
            <select value={merged.print_font || "Tajawal"}
              onChange={(e) => st.setFlat("print_font", e.target.value)}
              className={`${inputCls} w-40`}>
              {PRINT_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f} (مضمّن)</option>)}
              {SYSTEM_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Row>
          <Row label="حجم الخط الأساسي (px)">
            <div className="flex items-center gap-1">
              <button type="button" className={btnCls(false)}
                onClick={() => st.setFlat("item_font_size", Math.max(7, (Number(merged.item_font_size) || 11) - 1))}>−</button>
              <input type="number" value={Number(merged.item_font_size) || 11}
                onChange={(e) => st.setFlat("item_font_size", Math.max(7, Math.min(20, Number(e.target.value) || 11)))}
                className={`${inputCls} w-12 text-center`} />
              <button type="button" className={btnCls(false)}
                onClick={() => st.setFlat("item_font_size", Math.min(20, (Number(merged.item_font_size) || 11) + 1))}>+</button>
            </div>
          </Row>
        </Section>

        {/* ── Layout ───────────────────────────────────────── */}
        <Section title="الورق والهوامش">
          <Row label="حجم الورق الافتراضي">
            <select value={merged.paper_size || ""}
              onChange={(e) => st.setFlat("paper_size", e.target.value)}
              className={`${inputCls} w-28`}>
              <option value="">يرث العام</option>
              {["A5", "A4"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Row>
          {family === "page" && (
            <Row label="تخطيط الصفحة">
              <select value={fam.pageLayoutType || "standard"}
                onChange={(e) => st.setFamLayout(() => ({ pageLayoutType: e.target.value }))}
                className={`${inputCls} w-28`}>
                <option value="standard">افتراضي</option>
                <option value="sidebar">جانبي حديث</option>
                <option value="executive">رسمي مزدوج</option>
              </select>
            </Row>
          )}
          <Row label="الحشو الداخلي (px)">
            <div className="flex items-center gap-1">
              <button type="button" className={btnCls(false)}
                onClick={() => st.setFlat("page_padding", Math.max(8, (Number(merged.page_padding) || 16) - 4))}>−</button>
              <input type="number" value={Number(merged.page_padding) || 16}
                onChange={(e) => st.setFlat("page_padding", Math.max(8, Math.min(48, Number(e.target.value) || 16)))}
                className={`${inputCls} w-12 text-center`} />
              <button type="button" className={btnCls(false)}
                onClick={() => st.setFlat("page_padding", Math.min(48, (Number(merged.page_padding) || 16) + 4))}>+</button>
            </div>
          </Row>
        </Section>

        {/* ── Table style ─────────────────────────────────── */}
        <Section title="شكل الجداول">
          <Row label="رأس الجدول">
            <select value={merged.table_header_style || "filled"}
              onChange={(e) => st.setFlat("table_header_style", e.target.value)}
              className={`${inputCls} w-32`}>
              <option value="filled">شريط معبّأ</option>
              <option value="light">خلفية فاتحة</option>
              <option value="line">خط سفلي فقط</option>
            </select>
          </Row>
          <Row label="حدود الجدول">
            <select value={merged.table_border || "rows"}
              onChange={(e) => st.setFlat("table_border", e.target.value)}
              className={`${inputCls} w-32`}>
              <option value="rows">خطوط أفقية</option>
              <option value="grid">شبكة كاملة</option>
              <option value="none">بلا حدود</option>
            </select>
          </Row>
          <Toggle label="تظليل الصفوف (زيبرا)"
            checked={merged.table_zebra !== false}
            onChange={(v) => st.setFlat("table_zebra", v)} />
          <Row label="ارتفاع الصفوف (px)">
            <div className="flex items-center gap-1">
              <button type="button" className={btnCls(false)}
                onClick={() => st.setFlat("table_row_pad", Math.max(3, (Number(merged.table_row_pad) || 7) - 1))}>−</button>
              <input type="number" value={Number(merged.table_row_pad) || 7}
                onChange={(e) => st.setFlat("table_row_pad", Math.max(3, Math.min(20, Number(e.target.value) || 7)))}
                className={`${inputCls} w-12 text-center`} />
              <button type="button" className={btnCls(false)}
                onClick={() => st.setFlat("table_row_pad", Math.min(20, (Number(merged.table_row_pad) || 7) + 1))}>+</button>
            </div>
          </Row>
        </Section>

        {/* ── Visibility ─────────────────────────────────── */}
        <Section title="الإظهار">
          <div className="space-y-1.5">
            {[
              ["show_logo",                "الشعار"],
              ["show_address",             "العنوان"],
              ["show_phone",               "الهاتف"],
              ["show_watermark",           "العلامة المائية"],
              ["show_signature_lines",     "خطوط التوقيع (صفحة)"],
              ["show_receiver_signature",  "توقيع المستلم (رول/صفحة)"],
            ].map(([k, lbl]) => (
              <Toggle key={k} label={lbl} checked={merged[k] !== false} onChange={(v) => st.setFlat(k, v)} />
            ))}
          </div>
        </Section>

        {/* ── Texts ──────────────────────────────────────── */}
        <Section title="نصوص المستند">
          {[
            ["receipt_header",  "رأس المستند"],
            ["receipt_footer",  "تذييل المستند"],
            ["watermark_text",  "نص العلامة المائية"],
          ].map(([k, lbl]) => (
            <label key={k} className="mb-2 block space-y-1">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">{lbl}</span>
              <input value={merged[k] || ""} onChange={(e) => st.setFlat(k, e.target.value)} className={`${inputCls} w-full`} />
            </label>
          ))}
        </Section>

      </div>
    );
  }


  return (
    <div className="flex w-[310px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--border-normal)] bg-[var(--bg-surface)] p-3">

      {/* ── Inheritance paused banner ──────────────────────── */}
      {st.isInheritable && st.inheritGlobal && (
        <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--primary)]/15">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--primary)]">
                <path d="M12 3v18" /><path d="M3 12h18" />
              </svg>
            </div>
            <span className="text-[11px] font-black text-[var(--primary)]">وضع الارث مفعّل — {st.family === "roll" ? "رول" : "صفحة"}</span>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-muted)] leading-relaxed">
            التصميم الحالي يُرث من <strong>التصميم العام</strong> لهذا المقاس ({st.family === "roll" ? "رول" : "صفحة"}). التغييرات المحلية محفوظة لكنها غير معتمدة حالياً.
          </p>
          <button
            type="button"
            onClick={() => st.toggleInheritGlobal?.()}
            className="mt-2 w-full rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 py-1.5 text-[10px] font-black text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
          >
            تعطيل الارث ({st.family === "roll" ? "رول" : "صفحة"}) واستعمال التصميم الخاص
          </button>
        </div>
      )}

      {st.isInheritable && !st.inheritGlobal && (
        <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--success)]/15">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--success-text)]">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[11px] font-black text-[var(--success-text)]">تصميم خاص مفعّل — {st.family === "roll" ? "رول" : "صفحة"}</span>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-muted)] leading-relaxed mt-1">
            التصميم الخاص بـ <strong>{st.scope}</strong> ({st.family === "roll" ? "رول" : "صفحة"}) معتمد. يمكنك تعديله بحرية.
          </p>
        </div>
      )}

      {/* ── نصوص المستند (ظاهرة دوماً) ──────────────────────── */}
      <Section title="نصوص المستند">
        {[
          ["receipt_header",  "رأس المستند"],
          ["receipt_footer",  "تذييل المستند"],
          ["receipt_notes",   "ملاحظات الفاتورة"],
        ].map(([k, lbl]) => (
          <label key={k} className="mb-2 block space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]">{lbl}</span>
            <textarea value={merged[k] || ""} onChange={(e) => st.setFlat(k, e.target.value)}
              className="h-14 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
          </label>
        ))}
        <Toggle label='ختم "نسخة" عند إعادة الطباعة' checked={merged.reprint_stamp === true} onChange={(v) => st.setFlat("reprint_stamp", v)} />
      </Section>

      {/* ═══ selected free overlay (page decorations) ═══ */}
      {selOverlay && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-[var(--text-primary)]">عنصر حر: {selLabel}</span>
            <button type="button" title="حذف" onClick={() => st.removeOverlay(selOverlay.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--danger-border)] text-[var(--danger)] hover:bg-[var(--danger-light)]"><Trash2 size={12} /></button>
          </div>
          <Section title="المحتوى">
            {(selOverlay.type === "text" || selOverlay.type === "stamp") && (
              <textarea value={selOverlay.props?.text || ""} onChange={(e) => st.setOverlay(selOverlay.id, { props: { text: e.target.value } })}
                className="h-16 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
            )}
            {selOverlay.type === "image" && (
              <>
                <input ref={overlayImgRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setOverlay(selOverlay.id, { props: { src } }))} />
                <button type="button" onClick={() => overlayImgRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
                  {selOverlay.props?.src ? "تغيير الصورة…" : "اختيار صورة…"}
                </button>
              </>
            )}
            {selOverlay.type !== "image" && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Row label="حجم الخط">
                  <input type="number" value={selOverlay.props?.fontSize || 12} onChange={(e) => st.setOverlay(selOverlay.id, { props: { fontSize: clamp(Number(e.target.value) || 12, 6, 90) } })} className={`${inputCls} w-16`} />
                </Row>
                <Row label="اللون">
                  <ColorField value={selOverlay.props?.color} fallback="#0f172a"
                    onChange={(v) => st.setOverlay(selOverlay.id, { props: { color: v } })} />
                </Row>
              </div>
            )}
            {selOverlay.type === "stamp" && (
              <Row label="شفافية">
                <input type="range" min="0.2" max="1" step="0.1" value={selOverlay.props?.opacity ?? 0.9}
                  onChange={(e) => st.setOverlay(selOverlay.id, { props: { opacity: Number(e.target.value) } })} className="w-24" />
              </Row>
            )}
          </Section>
          <Section title="الموضع (مم) — أو اسحبه على الورقة">
            <div className="grid grid-cols-2 gap-2">
              <Row label="س"><input type="number" value={selOverlay.xMm} onChange={(e) => st.setOverlay(selOverlay.id, { xMm: Number(e.target.value) || 0 })} className={`${inputCls} w-16`} /></Row>
              <Row label="ص"><input type="number" value={selOverlay.yMm} onChange={(e) => st.setOverlay(selOverlay.id, { yMm: Number(e.target.value) || 0 })} className={`${inputCls} w-16`} /></Row>
              <Row label="عرض"><input type="number" value={selOverlay.widthMm || ""} placeholder="تلقائي" onChange={(e) => st.setOverlay(selOverlay.id, { widthMm: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-16`} /></Row>
              <Row label="زاوية°"><input type="number" value={selOverlay.props?.angle || 0} onChange={(e) => st.setOverlay(selOverlay.id, { props: { angle: Number(e.target.value) || 0 } })} className={`${inputCls} w-16`} /></Row>
            </div>
          </Section>
        </>
      )}

      {/* ═══ selected block ═══ */}
      {isBlockSel && (
        <>
          {/* header: name + quick actions that apply to every block */}
          <div className="flex items-center justify-between gap-1">
            <span className="min-w-0 truncate text-[11px] font-black text-[var(--text-primary)]">{selLabel}</span>
            <div className="flex shrink-0 items-center gap-1">
              {family === "roll" && (
                <>
                  <button type="button" className={btnCls(false)} title="تحريك لأعلى" disabled={!selInOrder} onClick={() => st.nudge(-1)}><ArrowUp size={12} /></button>
                  <button type="button" className={btnCls(false)} title="تحريك لأسفل" disabled={!selInOrder} onClick={() => st.nudge(1)}><ArrowDown size={12} /></button>
                </>
              )}
              <button type="button" className={btnCls(false)} title="إخفاء/إظهار" disabled={!selInOrder} onClick={() => st.toggleVisible(selected)}>
                {st.isVisible(selected) ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              {selInsert && <button type="button" className={btnCls(false)} title="تكرار (Ctrl+D)" onClick={st.duplicateSelected}><Copy size={12} /></button>}
              <button type="button" className={btnCls(false)} title="حذف (Delete)" onClick={st.deleteSelected}><Trash2 size={12} /></button>
            </div>
          </div>
          
          {/* block style / version navigator */}
          {(() => {
            const variants = BLOCK_VARIANTS[selType];
            if (!variants) return null;

            // Get current variant
            let currentVal = "standard";
            if (selInsert) {
              if (selType === "divider") {
                currentVal = selInsert.props?.style || "solid";
              } else if (selType === "spacer") {
                const h = selInsert.props?.height ?? 8;
                currentVal = h <= 8 ? "small" : h <= 16 ? "medium" : "large";
              } else {
                currentVal = selInsert.props?.variant || "standard";
              }
            } else {
              currentVal = st.ov(selected).variant || "standard";
            }

            const currentIndex = variants.findIndex(v => v.value === currentVal);
            const activeIndex = currentIndex >= 0 ? currentIndex : 0;

            const handleVariantChange = (newVal) => {
              if (selInsert) {
                if (selType === "divider") {
                  st.setInsert(selInsert.id, { props: { style: newVal } });
                } else if (selType === "spacer") {
                  const h = newVal === "small" ? 8 : newVal === "medium" ? 16 : 32;
                  st.setInsert(selInsert.id, { props: { height: h } });
                } else {
                  st.setInsert(selInsert.id, { props: { variant: newVal } });
                }
              } else {
                st.setOverride(selected, { variant: newVal });
              }
            };

            const goPrev = () => {
              const prevIdx = (activeIndex - 1 + variants.length) % variants.length;
              handleVariantChange(variants[prevIdx].value);
            };

            const goNext = () => {
              const nextIdx = (activeIndex + 1) % variants.length;
              handleVariantChange(variants[nextIdx].value);
            };

            return (
              <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">
                  <span>شكل العنصر / نسخة التصميم</span>
                  <span className="text-[9px] opacity-75">
                    {activeIndex + 1} من {variants.length}
                  </span>
                </div>
                
                {/* Navigator controls */}
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={goPrev}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] text-xs font-black">
                    ◄
                  </button>
                  <div className="flex-1 text-center">
                    <div className="text-[12px] font-extrabold text-[var(--text-primary)]">
                      {variants[activeIndex]?.label || "افتراضي"}
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] font-mono">
                      {variants[activeIndex]?.value}
                    </div>
                  </div>
                  <button type="button" onClick={goNext}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] text-xs font-black">
                    ►
                  </button>
                </div>

                {/* Grid of variant badges/buttons */}
                <div className="mt-2.5 grid grid-cols-2 gap-1 max-h-32 overflow-y-auto pr-1">
                  {variants.map((v) => {
                    const isSelected = v.value === currentVal;
                    return (
                      <button key={v.value} type="button" onClick={() => handleVariantChange(v.value)}
                        className={`rounded-lg px-2 py-1.5 text-center text-[10px] font-bold transition-all border ${
                          isSelected 
                            ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-sm" 
                            : "bg-[var(--bg-surface)] border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"
                        }`}>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* free position — every block, every paper size */}
          <Section title="الموضع">
            {/* relative nudge (default): stays in the flow, respects neighbors */}
            {!isAbs && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">إزاحة أفقية (مم)
                  <input type="number" value={selOv.rel?.dxMm ?? 0} onChange={(e) => setOv({ rel: { ...(selOv.rel || {}), dxMm: Number(e.target.value) || 0 } })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">إزاحة رأسية (مم)
                  <input type="number" value={selOv.rel?.dyMm ?? 0} onChange={(e) => setOv({ rel: { ...(selOv.rel || {}), dyMm: Number(e.target.value) || 0 } })} className={`${inputCls} w-full`} />
                </label>
              </div>
            )}
            <div className="mt-2">
              <Toggle label="تثبيت مطلق (فوق التدفق — لا يتأثر بما فوقه)" checked={!!isAbs} onChange={(v) => st.setPinMode(selected, v)} />
            </div>
            {isAbs && (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[["xMm", "س"], ["yMm", "ص"], ["widthMm", "عرض"]].map(([k, lbl]) => (
                    <label key={k} className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">{lbl} (مم)
                      <input type="number" value={selOv.abs[k] ?? ""} onChange={(e) => setAbs({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-full`} />
                    </label>
                  ))}
                </div>
                <div className="mt-1.5">
                  <Toggle label="حجز مساحته الأصلية (لا يُزاح الباقي)" checked={Number(selOv.abs.holdMm) > 0}
                    onChange={(v) => setAbs({ holdMm: v ? Math.max(2, Number(selOv.abs.holdMm) || 6) : 0 })} />
                </div>
              </>
            )}
            {(isNudged || isAbs) && (
              <button type="button" onClick={() => st.resetPosition(selected)}
                className="mt-2 w-full rounded-lg border border-[var(--border-normal)] py-1.5 text-[10px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
                إعادة العنصر لمكانه الطبيعي
              </button>
            )}
            <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold leading-relaxed text-[var(--text-muted)]">
              <Move size={10} /> اسحب العنصر على الورقة لتحريكه — يبقى ضمن التدفق ويحترم ما فوقه ما لم تفعّل "التثبيت المطلق"{family === "roll" ? "، و Ctrl+سحب لإعادة الترتيب" : ""}.
            </div>
          </Section>

          {/* typography — text-driven blocks only */}
          {hasTypography && (
            <Section title="النص">
              <Row label="الخط">
                <select value={selOv.fontFamily || ""} onChange={(e) => setOv({ fontFamily: e.target.value || undefined })} className={`${inputCls} w-36`}>
                  <option value="">وراثة</option>
                  {PRINT_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  {SYSTEM_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Row>
              <div className="flex flex-wrap items-center gap-1 py-1">
                <button type="button" className={btnCls(false)} title="تصغير"
                  onClick={() => setOv({ fontSize: clamp((Number(selOv.fontSize) || Number(merged.item_font_size) || 11) - 1, 6, 90) })}>−</button>
                <input type="number" value={selOv.fontSize || ""} placeholder="—"
                  onChange={(e) => setOv({ fontSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 6, 90) })}
                  className={`${inputCls} w-12 text-center`} title="حجم الخط (px)" />
                <button type="button" className={btnCls(false)} title="تكبير"
                  onClick={() => setOv({ fontSize: clamp((Number(selOv.fontSize) || Number(merged.item_font_size) || 11) + 1, 6, 90) })}>+</button>
                <button type="button" className={btnCls(!!selOv.bold)} title="عريض" onClick={() => setOv({ bold: !selOv.bold })}><Bold size={12} /></button>
                <button type="button" className={btnCls(!!selOv.italic)} title="مائل" onClick={() => setOv({ italic: !selOv.italic })}><Italic size={12} /></button>
                <button type="button" className={btnCls(selOv.align === "right")} title="يمين" onClick={() => setOv({ align: selOv.align === "right" ? undefined : "right" })}><AlignRight size={12} /></button>
                <button type="button" className={btnCls(selOv.align === "center")} title="وسط" onClick={() => setOv({ align: selOv.align === "center" ? undefined : "center" })}><AlignCenter size={12} /></button>
                <button type="button" className={btnCls(selOv.align === "left")} title="يسار" onClick={() => setOv({ align: selOv.align === "left" ? undefined : "left" })}><AlignLeft size={12} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Row label="اللون">
                  <ColorField value={selOv.color} onChange={(v) => setOv({ color: v })} onClear={() => setOv({ color: undefined })} />
                </Row>
                <Row label="ارتفاع السطر">
                  <input type="number" step="0.1" value={selOv.lineHeight ?? ""} placeholder="—"
                    onChange={(e) => setOv({ lineHeight: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0.8, 3) })} className={`${inputCls} w-16`} />
                </Row>
              </div>
            </Section>
          )}

          {/* box / surface — background, border, padding, width, spacing */}
          {hasBox && (
            <Section title="الصندوق">
              {!isAbs && (
                <Row label="العرض">
                  <div className="flex items-center gap-1">
                    <button type="button" className={btnCls(false)} onClick={() => setOv({ width: clamp((Number(selOv.width) || 100) - 5, 10, 100) })}>−</button>
                    <span className="min-w-10 text-center text-[11px] font-bold text-[var(--text-secondary)]">{selOv.width ? `${selOv.width}%` : "كامل"}</span>
                    <button type="button" className={btnCls(false)} onClick={() => setOv({ width: clamp((Number(selOv.width) || 100) + 5, 10, 100) })}>+</button>
                    {selOv.width && <button type="button" className={btnCls(false)} title="عرض كامل" onClick={() => setOv({ width: undefined })}><X size={11} /></button>}
                  </div>
                </Row>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Row label="الخلفية">
                  <ColorField value={selOv.background} fallback="#ffffff"
                    onChange={(v) => setOv({ background: v })} onClear={() => setOv({ background: undefined })} />
                </Row>
                <Row label="حشو (px)">
                  <input type="number" value={selOv.padding ?? ""} placeholder="0"
                    onChange={(e) => setOv({ padding: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 40) })} className={`${inputCls} w-14`} />
                </Row>
              </div>
              <Row label="الإطار">
                <div className="flex items-center gap-1">
                  <input type="number" value={selOv.borderWidth ?? ""} placeholder="0" title="سماكة"
                    onChange={(e) => setOv({ borderWidth: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 5) })} className={`${inputCls} w-12`} />
                  <select value={selOv.borderStyle || "solid"} onChange={(e) => setOv({ borderStyle: e.target.value })} className={`${inputCls} w-18`}>
                    <option value="solid">متصل</option><option value="dashed">متقطع</option><option value="dotted">منقّط</option><option value="double">مزدوج</option>
                  </select>
                  <ColorField value={selOv.borderColor} fallback="#000000"
                    onChange={(v) => setOv({ borderColor: v })} onClear={() => setOv({ borderColor: undefined })} />
                </div>
              </Row>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">استدارة
                  <input type="number" value={selOv.borderRadius ?? ""} placeholder="0"
                    onChange={(e) => setOv({ borderRadius: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 24) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">تباعد علوي
                  <input type="number" value={selOv.marginTop ?? ""} placeholder="0"
                    onChange={(e) => setOv({ marginTop: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">تباعد سفلي
                  <input type="number" value={selOv.marginBottom ?? ""} placeholder="0"
                    onChange={(e) => setOv({ marginBottom: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button type="button" className={btnCls(false)} title="نسخ التنسيق" onClick={() => setCopiedStyle({ ...selOv, abs: undefined })}><Copy size={12} /> <span className="mr-1 text-[9px]">نسخ التنسيق</span></button>
                <button type="button" className={btnCls(false)} title="لصق التنسيق" disabled={!copiedStyle} onClick={() => copiedStyle && setOv(copiedStyle)}><ClipboardPaste size={12} /> <span className="mr-1 text-[9px]">لصق</span></button>
              </div>
            </Section>
          )}

          {/* ── block-specific controls ─────────────────────────────────── */}
          {selInsert && selInsert.type === "custom_text" && (
            <Section title="نص العنصر">
              <textarea value={selInsert.props?.text || ""} onChange={(e) => st.setInsert(selInsert.id, { props: { text: e.target.value } })}
                className="h-20 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PLACEHOLDER_KEYS.map((k) => (
                  <button key={k} type="button" title="إدراج متغير — يُستبدل بقيمته الحقيقية عند الطباعة"
                    onClick={() => st.setInsert(selInsert.id, { props: { text: `${selInsert.props?.text || ""}{${k}}` } })}
                    className="rounded border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                    {`{${k}}`}
                  </button>
                ))}
              </div>
              <InsertPosition st={st} ins={selInsert} fam={fam} inputCls={inputCls} />
            </Section>
          )}

          {selInsert && selInsert.type === "custom_field" && (
            <Section title="الحقل المخصص">
              <Row label="المصدر">
                <select value={selInsert.props?.source || "text"} onChange={(e) => st.setInsert(selInsert.id, { props: { source: e.target.value } })} className={`${inputCls} w-36`}>
                  <option value="text">نص/رقم ثابت</option>
                  <option value="token">متغير ديناميكي</option>
                  <option value="computed">قيمة محسوبة</option>
                </select>
              </Row>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية (يمين — فارغة = القيمة فقط)</span>
                <input value={selInsert.props?.label ?? ""} onChange={(e) => st.setInsert(selInsert.id, { props: { label: e.target.value } })} className={`${inputCls} w-full`} />
              </label>
              {(selInsert.props?.source || "text") === "computed" ? (
                <>
                  <Row label="القيمة">
                    <select value={selInsert.props?.compute || "grand_total"} onChange={(e) => st.setInsert(selInsert.id, { props: { compute: e.target.value } })} className={`${inputCls} w-40`}>
                      {COMPUTED_FIELDS.filter(f => {
                        const isReport = st.scope !== "_global" && !BLOCK_DOC_SCOPES.has(st.scope);
                        return !isReport || ["grand_total", "daily_no"].includes(f.key);
                      }).map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </Row>
                  <Toggle label="عرضها كعملة" checked={selInsert.props?.money !== false} onChange={(v) => st.setInsert(selInsert.id, { props: { money: v } })} />
                </>
              ) : (
                <label className="mt-1 block space-y-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">{(selInsert.props?.source === "token") ? "النص مع المتغيرات {…}" : "القيمة الثابتة"}</span>
                  <input value={selInsert.props?.value ?? ""} onChange={(e) => st.setInsert(selInsert.id, { props: { value: e.target.value } })} className={`${inputCls} w-full`} />
                </label>
              )}
              {selInsert.props?.source === "token" && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PLACEHOLDER_KEYS.map((k) => (
                    <button key={k} type="button"
                      onClick={() => st.setInsert(selInsert.id, { props: { value: `${selInsert.props?.value || ""}{${k}}` } })}
                      className="rounded border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                      {`{${k}}`}
                    </button>
                  ))}
                </div>
              )}
              <Row label="التخطيط">
                <select value={selInsert.props?.align || "between"} onChange={(e) => st.setInsert(selInsert.id, { props: { align: e.target.value } })} className={`${inputCls} w-28`}>
                  <option value="between">تسمية ⟷ قيمة</option>
                  <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                </select>
              </Row>
              <InsertPosition st={st} ins={selInsert} fam={fam} inputCls={inputCls} />
            </Section>
          )}

          {selInsert && selInsert.type === "divider" && (
            <Section title="شكل الفاصل">
              <Row label="نوع الخط">
                <select value={selInsert.props?.style || "solid"} onChange={(e) => st.setInsert(selInsert.id, { props: { style: e.target.value } })} className={`${inputCls} w-32`}>
                  <option value="solid">مستمر (Solid)</option>
                  <option value="dashed">متقطع (Dashed)</option>
                  <option value="dotted">منقط (Dotted)</option>
                  <option value="double">مزدوج (Double)</option>
                  <option value="dots">رموز نقاط (· · ·)</option>
                  <option value="dash">رموز شرطات (— —)</option>
                  <option value="wave">رموز موجات (∼ ∼)</option>
                </select>
              </Row>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الخط
                  <ColorField value={selInsert.props?.color} fallback="#000000"
                    onChange={(v) => st.setInsert(selInsert.id, { props: { color: v } })} onClear={() => st.setInsert(selInsert.id, { props: { color: undefined } })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">السماكة (px)
                  <input type="number" min={1} max={8} value={selInsert.props?.thickness ?? 1}
                    onChange={(e) => st.setInsert(selInsert.id, { props: { thickness: Number(e.target.value) } })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">هامش علوي (px)
                  <input type="number" value={selInsert.props?.marginTop ?? 5}
                    onChange={(e) => st.setInsert(selInsert.id, { props: { marginTop: Number(e.target.value) } })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">هامش سفلي (px)
                  <input type="number" value={selInsert.props?.marginBottom ?? 5}
                    onChange={(e) => st.setInsert(selInsert.id, { props: { marginBottom: Number(e.target.value) } })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <InsertPosition st={st} ins={selInsert} fam={fam} inputCls={inputCls} />
            </Section>
          )}

          {selInsert && selInsert.type === "spacer" && (
            <Section title="المسافة">
              <Row label="الارتفاع (px)">
                <input type="number" value={selInsert.props?.height ?? 8}
                  onChange={(e) => st.setInsert(selInsert.id, { props: { height: clamp(Number(e.target.value) || 8, 2, 120) } })} className={`${inputCls} w-20`} />
              </Row>
              <Row label="لون الخلفية">
                <ColorField value={selInsert.props?.background} fallback="transparent"
                  onChange={(v) => st.setInsert(selInsert.id, { props: { background: v } })} onClear={() => st.setInsert(selInsert.id, { props: { background: undefined } })} />
              </Row>
              <Row label="العرض">
                <input value={selInsert.props?.width ?? "100%"} placeholder="100% أو 50px"
                  onChange={(e) => st.setInsert(selInsert.id, { props: { width: e.target.value } })} className={`${inputCls} w-24`} />
              </Row>
              <InsertPosition st={st} ins={selInsert} fam={fam} inputCls={inputCls} />
            </Section>
          )}

          {(selected === "items_table" || selected === "report_table" || selected === "physical_count_items_table") && (
            <Section title="أعمدة الجدول">
              <div className="space-y-0.5">
                {st.columns.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-1.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} title="لأعلى"
                        onClick={() => { const n = [...st.columns]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; st.setColumns(n); }}
                        className="text-[8px] leading-none text-[var(--text-muted)] disabled:opacity-20">▲</button>
                      <button type="button" disabled={i === st.columns.length - 1} title="لأسفل"
                        onClick={() => { const n = [...st.columns]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; st.setColumns(n); }}
                        className="text-[8px] leading-none text-[var(--text-muted)] disabled:opacity-20">▼</button>
                    </div>
                    <input value={c.label} title="اسم العمود على الورقة"
                      onChange={(e) => st.setColumns(st.columns.map((x) => x.key === c.key ? { ...x, label: e.target.value } : x))}
                      className="w-14 rounded border border-[var(--border-normal)] bg-[var(--bg-input)] px-1 py-0.5 text-[10px] text-[var(--text-primary)]" />
                    <select value={c.align || "right"}
                      onChange={(e) => st.setColumns(st.columns.map((x) => x.key === c.key ? { ...x, align: e.target.value } : x))}
                      className="rounded border border-[var(--border-normal)] bg-[var(--bg-input)] px-1 py-0.5 text-[10px] text-[var(--text-primary)]">
                      <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                    </select>
                    <button type="button" title={c.visible === false ? "إظهار" : "إخفاء"}
                      onClick={() => st.setColumns(st.columns.map((x) => x.key === c.key ? { ...x, visible: x.visible === false } : x))}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {c.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button type="button" title="إزالة العمود"
                      onClick={() => st.setColumns(st.columns.filter((x) => x.key !== c.key))}
                      className="mr-auto text-[var(--text-muted)] hover:text-[var(--danger)]"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              {(() => {
                const catalog = selected === "report_table" ? defaultReportColumns(st.scope)
                  : selected === "physical_count_items_table" ? PHYSICAL_COUNT_COLUMN_CATALOG
                  : COLUMN_CATALOG;
                const unadded = catalog.filter((c) => !st.columns.some((x) => x.key === c.key));
                if (unadded.length === 0) return null;
                return (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {unadded.map((c) => (
                      <button key={c.key} type="button"
                        onClick={() => st.setColumns([...st.columns, { key: c.key, label: c.label, visible: true, align: "center" }])}
                        className="rounded border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                        + {c.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
              <div className="mt-2 space-y-1.5">
                {family === "page" && (
                  <Row label="طريقة العرض">
                    <select value={st.ov(tblKey).variant || "standard"} onChange={(e) => st.setOverride(tblKey, { variant: e.target.value })} className={`${inputCls} w-28`}>
                      {(BLOCK_VARIANTS[tblKey] || []).map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </Row>
                )}
                <Row label="الحدود">
                  <select value={st.ov(tblKey).tableBorder || (family === "roll" ? "grid" : "none")} onChange={(e) => st.setOverride(tblKey, { tableBorder: e.target.value })} className={`${inputCls} w-24`}>
                    <option value="none">بلا</option><option value="lines">خطوط أفقية</option><option value="grid">شبكة كاملة</option>
                  </select>
                </Row>
                <Row label="رأس الجدول">
                  <select value={st.ov(tblKey).headerVariant || "dark"} onChange={(e) => st.setOverride(tblKey, { headerVariant: e.target.value })} className={`${inputCls} w-24`}>
                    <option value="dark">شريط معبّأ</option><option value="light">خط سفلي</option><option value="none">بلا رأس</option>
                  </select>
                </Row>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">سماكة الخطوط (px)
                    <input type="number" value={st.ov(tblKey).lineWidth ?? ""} placeholder="1"
                      onChange={(e) => st.setOverride(tblKey, { lineWidth: e.target.value === "" ? undefined : clamp(Number(e.target.value), 1, 4) })} className={`${inputCls} w-full`} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">ارتفاع الصفوف (px)
                    <input type="number" value={st.ov(tblKey).rowPad ?? ""} placeholder={family === "roll" ? "2" : "3"}
                      onChange={(e) => st.setOverride(tblKey, { rowPad: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 16) })} className={`${inputCls} w-full`} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">عرض عمود الصنف %
                    <input type="number" value={st.ov(tblKey).nameWidth ?? ""} placeholder="60"
                      onChange={(e) => st.setOverride(tblKey, { nameWidth: e.target.value === "" ? undefined : clamp(Number(e.target.value), 20, 85) })} className={`${inputCls} w-full`} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">حجم خط الرأس
                    <input type="number" value={st.ov(tblKey).headerFontSize ?? ""} placeholder="10"
                      onChange={(e) => st.setOverride(tblKey, { headerFontSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 7, 20) })} className={`${inputCls} w-full`} />
                  </label>
                </div>
                <Row label="حجم خط الجدول">
                  <input type="number" value={st.ov(tblKey).fontSize || ""} placeholder={String(merged.item_font_size || 13)}
                    onChange={(e) => st.setOverride(tblKey, { fontSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 7, 24) })} className={`${inputCls} w-16`} />
                </Row>
                <Row label="محاذاة الخلايا رأسياً">
                  <select value={st.ov(tblKey).cellValign || "middle"} onChange={(e) => st.setOverride(tblKey, { cellValign: e.target.value })} className={`${inputCls} w-24`}>
                    <option value="top">أعلى</option><option value="middle">وسط</option><option value="bottom">أسفل</option>
                  </select>
                </Row>
                <Toggle label="إخفاء السعر/الإجمالي الصفري" checked={st.ov(tblKey).hideZeroPrice === true} onChange={(v) => st.setOverride(tblKey, { hideZeroPrice: v })} />
                {family === "page" && (
                  <>
                    <Toggle label="تظليل الصفوف (زيبرا)" checked={st.ov(tblKey).zebra !== false} onChange={(v) => st.setOverride(tblKey, { zebra: v })} />
                    <Toggle label="عمود الترقيم #" checked={st.ov(tblKey).showRowNum !== false} onChange={(v) => st.setOverride(tblKey, { showRowNum: v })} />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الخطوط
                        <ColorField value={st.ov(tblKey).lineColor} fallback="#e2e8f0"
                          onChange={(v) => st.setOverride(tblKey, { lineColor: v })} onClear={() => st.setOverride(tblKey, { lineColor: undefined })} />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">خلفية الرأس
                        <ColorField value={st.ov(tblKey).headerBg} fallback={merged.accent_color || "#0f172a"}
                          onChange={(v) => st.setOverride(tblKey, { headerBg: v })} onClear={() => st.setOverride(tblKey, { headerBg: undefined })} />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">نص الرأس
                        <ColorField value={st.ov(tblKey).headerColor} fallback="#ffffff"
                          onChange={(v) => st.setOverride(tblKey, { headerColor: v })} onClear={() => st.setOverride(tblKey, { headerColor: undefined })} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">خلفية زيبرا
                        <ColorField value={st.ov(tblKey).zebraBgColor} fallback="#f8fafc"
                          onChange={(v) => st.setOverride(tblKey, { zebraBgColor: v })} onClear={() => st.setOverride(tblKey, { zebraBgColor: undefined })} />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون نص الخلايا
                        <ColorField value={st.ov(tblKey).textColor} fallback="#000000"
                          onChange={(v) => st.setOverride(tblKey, { textColor: v })} onClear={() => st.setOverride(tblKey, { textColor: undefined })} />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </Section>
          )}

          {selected === "grand_total" && (
            <Section title="سطر الإجمالي">
              <Row label="الشكل">
                <select value={st.ov("grand_total").variant || "band"} onChange={(e) => st.setOverride("grand_total", { variant: e.target.value })} className={`${inputCls} w-32`}>
                  <option value="band">شريط معبّأ</option>
                  <option value="boxed">صندوق مزدوج</option>
                  <option value="plain">سطر بخط علوي</option>
                  <option value="huge">رقم ضخم متمركز</option>
                  <option value="dual-row">سطر مزدوج مع التفقيط</option>
                  <option value="stripe">شريط ممتد عريض</option>
                  <option value="receipt-tape">نمط إيصال (متقطع)</option>
                  <option value="tag">شارة السعر (تاغ)</option>
                  <option value="split-amount">مبلغ إجمالي منقسم</option>
                </select>
              </Row>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">التسمية
                  <input value={st.ov("grand_total").label ?? ""} placeholder="الإجمالي"
                    onChange={(e) => st.setOverride("grand_total", { label: e.target.value })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">الزخرفة (فارغة = بلا)
                  <input value={st.ov("grand_total").decor ?? "✦"} placeholder="✦"
                    onChange={(e) => st.setOverride("grand_total", { decor: e.target.value })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">موضع الزخرفة
                  <select value={st.ov("grand_total").decorPos || "both"} onChange={(e) => st.setOverride("grand_total", { decorPos: e.target.value })} className={`${inputCls} w-full`}>
                    <option value="both">قبل وبعد</option>
                    <option value="before">قبل فقط</option>
                    <option value="after">بعد فقط</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">حجم التسمية (px)
                  <input type="number" value={st.ov("grand_total").labelSize ?? ""} placeholder="تلقائي"
                    onChange={(e) => st.setOverride("grand_total", { labelSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 7, 40) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">حجم الرقم (px)
                  <input type="number" value={st.ov("grand_total").amountSize ?? ""} placeholder="تلقائي"
                    onChange={(e) => st.setOverride("grand_total", { amountSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 8, 60) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">الكسور العشرية
                  <select value={st.ov("grand_total").decimals ?? 2} onChange={(e) => st.setOverride("grand_total", { decimals: Number(e.target.value) })} className={`${inputCls} w-full`}>
                    <option value={0}>0 (بلا كسور)</option>
                    <option value={1}>1 (كالمطاعم)</option>
                    <option value={2}>2 (افتراضي)</option>
                    <option value={3}>3 (كالوقود/الذهب)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">موضع العملة
                  <select value={st.ov("grand_total").currencyPlacement || "before"} onChange={(e) => st.setOverride("grand_total", { currencyPlacement: e.target.value })} className={`${inputCls} w-full`}>
                    <option value="before">قبل الرقم (ر.س 100)</option>
                    <option value="after">بعد الرقم (100 ر.س)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">بادئة التفقيط
                  <input value={st.ov("grand_total").tafqeetPrefix ?? ""} placeholder="فقط"
                    onChange={(e) => st.setOverride("grand_total", { tafqeetPrefix: e.target.value })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لاحقة التفقيط
                  <input value={st.ov("grand_total").tafqeetSuffix ?? ""} placeholder="لا غير"
                    onChange={(e) => st.setOverride("grand_total", { tafqeetSuffix: e.target.value })} className={`${inputCls} w-full`} />
                </label>
                {family === "page" && (
                  <>
                    <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الشريط/الإطار
                      <ColorField value={st.ov("grand_total").background} fallback={merged.accent_color || "#0f172a"}
                        onChange={(v) => st.setOverride("grand_total", { background: v })} onClear={() => st.setOverride("grand_total", { background: undefined })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون النص
                      <ColorField value={st.ov("grand_total").textColor} fallback="#ffffff"
                        onChange={(v) => st.setOverride("grand_total", { textColor: v })} onClear={() => st.setOverride("grand_total", { textColor: undefined })} />
                    </label>
                  </>
                )}
              </div>
              {family === "roll" && (
                <div className="mt-1 text-[9px] font-bold text-[var(--text-muted)]">على الرول الحراري تبقى الألوان أسود/أبيض — لكن الشكل والأحجام والزخرفة والتسمية كلها حرة.</div>
              )}
            </Section>
          )}

          {selected === "logo" && (
            <Section title="الشعار">
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setFlat("logo_url", src))} />
              <button type="button" onClick={() => logoFileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
                {merged.logo_url ? "تغيير الشعار…" : "رفع شعار…"}
              </button>
              <Row label="المحاذاة">
                <div className="flex gap-1">
                  {[["right", "يمين"], ["center", "وسط"], ["left", "يسار"]].map(([a, lbl]) => (
                    <button key={a} type="button" onClick={() => st.setOverride("logo", { align: a })} className={btnCls((st.ov("logo").align || merged.logo_alignment || "center") === a)}>{lbl}</button>
                  ))}
                </div>
              </Row>
              <Row label="الارتفاع (px)">
                <input type="number" value={st.ov("logo").maxHeight ?? merged.logo_max_height ?? 48}
                  onChange={(e) => st.setOverride("logo", { maxHeight: clamp(Number(e.target.value) || 48, 16, 400) })} className={`${inputCls} w-20`} />
              </Row>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">إطار (px)
                  <input type="number" value={st.ov("logo").borderWidth ?? 0}
                    onChange={(e) => st.setOverride("logo", { borderWidth: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الإطار
                  <ColorField value={st.ov("logo").borderColor} fallback="#000000"
                    onChange={(v) => st.setOverride("logo", { borderColor: v })} onClear={() => st.setOverride("logo", { borderColor: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">نوع الإطار
                  <select value={st.ov("logo").borderStyle || "solid"} onChange={(e) => st.setOverride("logo", { borderStyle: e.target.value })} className={`${inputCls} w-full`}>
                    <option value="solid">مستمر</option><option value="dashed">متقطع</option><option value="dotted">منقط</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">تداور الحواف (px)
                  <input type="number" value={st.ov("logo").borderRadius ?? 0}
                    onChange={(e) => st.setOverride("logo", { borderRadius: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <Row label="الظل">
                <select value={st.ov("logo").shadow || "none"} onChange={(e) => st.setOverride("logo", { shadow: e.target.value })} className={`${inputCls} w-24`}>
                  <option value="none">بلا ظل</option><option value="sm">خفيف</option><option value="md">متوسط</option><option value="lg">قوي</option>
                </select>
              </Row>
            </Section>
          )}

          {(selected === "qr" || (selInsert && selInsert.type === "qr")) && (
            <Section title="رمز QR">
              <div className="mb-2 rounded-lg bg-[var(--info-bg)] p-2 text-[9px] font-bold leading-relaxed text-[var(--info-text)]">
                رمز استجابة سريعة يُمسحه العميل بكامرة هاتفه. يظهر له بيانات الفاتورة (الاسم، المبلغ، التاريخ) أو يفتح صفحة التحقق الضريبي.
              </div>
              <Row label="النوع">
                <select value={merged.qr_mode || "free_text"} onChange={(e) => st.setFlat("qr_mode", e.target.value)} className={`${inputCls} w-36`}>
                  <option value="free_text">نص حر</option>
                  <option value="zatca">فاتورة إلكترونية ZATCA</option>
                  <option value="eta">إيصال ضريبي ETA</option>
                </select>
              </Row>
              {(merged.qr_mode || "free_text") === "free_text" && (
                <label className="mt-1 block space-y-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">محتوى الرمز (رابط أو نص)</span>
                  <input value={merged.qr_content || ""} onChange={(e) => st.setFlat("qr_content", e.target.value)} className={`${inputCls} w-full`} />
                </label>
              )}
              {merged.qr_mode === "zatca" && (
                <div className="mt-1 rounded-lg bg-[var(--info-bg)] p-2 text-[9px] font-bold leading-relaxed text-[var(--info-text)]">
                  يُولَّد الرمز تلقائياً من اسم الشركة والرقم الضريبي وبيانات الفاتورة وفق مواصفة ZATCA.
                </div>
              )}
              {merged.qr_mode === "eta" && (
                <div className="mt-1 rounded-lg bg-[var(--info-bg)] p-2 text-[9px] font-bold leading-relaxed text-[var(--info-text)]">
                  {"يُولَّد رابط التحقق تلقائياً من UUID الإيصال وتاريخ الإصدار على منصة الضريبة الإلكترونية المصرية ETA."}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الرمز
                  <ColorField value={st.ov("qr").fgColor} fallback="#000000"
                    onChange={(v) => st.setOverride("qr", { fgColor: v })} onClear={() => st.setOverride("qr", { fgColor: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الخلفية
                  <ColorField value={st.ov("qr").bgColor} fallback="#ffffff"
                    onChange={(v) => st.setOverride("qr", { bgColor: v })} onClear={() => st.setOverride("qr", { bgColor: undefined })} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <Row label="الحجم (px)">
                  <input type="number" value={Number(merged.qr_size) || 44}
                    onChange={(e) => st.setFlat("qr_size", clamp(Number(e.target.value) || 44, 24, 400))} className={`${inputCls} w-16`} />
                </Row>
                <Row label="المحاذاة">
                  <select value={merged.qr_alignment || "right"} onChange={(e) => st.setFlat("qr_alignment", e.target.value)} className={`${inputCls} w-20`}>
                    <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                  </select>
                </Row>
              </div>
              <Row label="الهامش (الهدوء)">
                <input type="number" value={st.ov("qr").margin ?? 1}
                  onChange={(e) => st.setOverride("qr", { margin: clamp(Number(e.target.value) || 0, 0, 8) })} className={`${inputCls} w-16`} />
              </Row>
            </Section>
          )}

          {selected === "image" && (
            <Section title="صورة / بانر">
              <input ref={imageFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setOverride("image", { src }))} />
              <button type="button" onClick={() => imageFileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
                {st.ov("image").src ? "تغيير الصورة…" : "رفع صورة…"}
              </button>
              <Row label="المحاذاة">
                <select value={st.ov("image").align || "center"} onChange={(e) => st.setOverride("image", { align: e.target.value })} className={`${inputCls} w-24`}>
                  <option value="center">وسط</option><option value="right">يمين</option><option value="left">يسار</option>
                </select>
              </Row>
              <Row label="الارتفاع (px)">
                <input type="number" value={st.ov("image").maxHeight ?? 60}
                  onChange={(e) => st.setOverride("image", { maxHeight: clamp(Number(e.target.value) || 60, 16, 400) })} className={`${inputCls} w-20`} />
              </Row>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">إطار (px)
                  <input type="number" value={st.ov("image").borderWidth ?? 0}
                    onChange={(e) => st.setOverride("image", { borderWidth: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الإطار
                  <ColorField value={st.ov("image").borderColor} fallback="#000000"
                    onChange={(v) => st.setOverride("image", { borderColor: v })} onClear={() => st.setOverride("image", { borderColor: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">نوع الإطار
                  <select value={st.ov("image").borderStyle || "solid"} onChange={(e) => st.setOverride("image", { borderStyle: e.target.value })} className={`${inputCls} w-full`}>
                    <option value="solid">مستمر</option><option value="dashed">متقطع</option><option value="dotted">منقط</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">تداور الحواف (px)
                  <input type="number" value={st.ov("image").borderRadius ?? 0}
                    onChange={(e) => st.setOverride("image", { borderRadius: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <Row label="الظل">
                <select value={st.ov("image").shadow || "none"} onChange={(e) => st.setOverride("image", { shadow: e.target.value })} className={`${inputCls} w-24`}>
                  <option value="none">بلا ظل</option><option value="sm">خفيف</option><option value="md">متوسط</option><option value="lg">قوي</option>
                </select>
              </Row>
              {family === "roll" && (
                <Toggle label="معالجة حرارية (أبيض/أسود)" checked={st.ov("image").thermalProcess !== false}
                  onChange={(v) => st.setOverride("image", { thermalProcess: v })} />
              )}
            </Section>
          )}

          {selected === "order_number" && (
            <Section title="رقم الطلب">
              <Row label="المصدر">
                <select value={st.ov("order_number").source || "doc"} onChange={(e) => st.setOverride("order_number", { source: e.target.value })} className={`${inputCls} w-36`}>
                  <option value="doc">رقم المستند الكامل</option>
                  <option value="daily">رقم يومي (يبدأ من ١ ويتصفّر يومياً)</option>
                </select>
              </Row>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية فوق الرقم (اتركها فارغة لإخفائها)</span>
                <input value={st.ov("order_number").label ?? "رقم الطلب"}
                  onChange={(e) => st.setOverride("order_number", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <Row label="حجم الرقم (px)">
                <input type="number" value={st.ov("order_number").fontSize ?? 34}
                  onChange={(e) => st.setOverride("order_number", { fontSize: clamp(Number(e.target.value) || 34, 14, 120) })} className={`${inputCls} w-20`} />
              </Row>
            </Section>
          )}

          {selected === "watermark" && (
            <Section title="العلامة المائية">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">النص</span>
                <input value={merged.watermark_text || ""} onChange={(e) => st.setFlat("watermark_text", e.target.value)} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">الشفافية (0-1)
                  <input type="number" step="0.01" value={st.ov("watermark").opacity ?? 0.08}
                    onChange={(e) => st.setOverride("watermark", { opacity: clamp(Number(e.target.value) || 0.08, 0.01, 1) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">الزاوية (درجة)
                  <input type="number" value={st.ov("watermark").angle ?? -30}
                    onChange={(e) => st.setOverride("watermark", { angle: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">حجم الخط (px)
                  <input type="number" value={st.ov("watermark").fontSize ?? 64}
                    onChange={(e) => st.setOverride("watermark", { fontSize: Math.max(8, Number(e.target.value)) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون النص
                  <ColorField value={st.ov("watermark").color} fallback="#0f172a"
                    onChange={(v) => st.setOverride("watermark", { color: v })} onClear={() => st.setOverride("watermark", { color: undefined })} />
                </label>
              </div>
              <div className="mt-1.5">
                <Toggle label="إظهار العلامة المائية" checked={merged.show_watermark === true} onChange={(v) => st.setFlat("show_watermark", v)} />
              </div>
            </Section>
          )}

          {selected === "address" && (
            <Section title="العنوان والهاتف">
              <Row label="الموضع">
                <select value={merged.address_position || "top"} onChange={(e) => st.setFlat("address_position", e.target.value)} className={`${inputCls} w-32`}>
                  <option value="top">في رأس المستند</option>
                  <option value="bottom">أسفل المستند</option>
                </select>
              </Row>
            </Section>
          )}

          {selected === "company_name" && (
            <Section title="اسم الشركة">
              <Row label="طريقة العرض">
                <select value={st.ov("company_name").variant || "standard"} onChange={(e) => st.setOverride("company_name", { variant: e.target.value })} className={`${inputCls} w-32`}>
                  {(BLOCK_VARIANTS.company_name || []).map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </Row>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">شعار الشركة / النص الفرعي</span>
                <input value={st.ov("company_name").slogan ?? ""} placeholder="أدخل شعار الشركة هنا..."
                  onChange={(e) => st.setOverride("company_name", { slogan: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              {st.ov("company_name").variant === "stacked-bilingual" && (
                <label className="mt-1 block space-y-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">الاسم بالإنجليزية</span>
                  <input value={st.ov("company_name").englishName ?? ""} placeholder="English Company Name"
                    onChange={(e) => st.setOverride("company_name", { englishName: e.target.value })} className={`${inputCls} w-full`} />
                </label>
              )}
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">حجم خط الشعار
                  <input type="number" value={st.ov("company_name").sloganSize ?? 11}
                    onChange={(e) => st.setOverride("company_name", { sloganSize: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">محاذاة الشعار
                  <select value={st.ov("company_name").sloganAlign || "right"} onChange={(e) => st.setOverride("company_name", { sloganAlign: e.target.value })} className={`${inputCls} w-full`}>
                    <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                  </select>
                </label>
              </div>
              <div className="mt-1.5 flex gap-4">
                <Toggle label="شعار عريض" checked={st.ov("company_name").sloganBold === true} onChange={(v) => st.setOverride("company_name", { sloganBold: v })} />
                <Toggle label="شعار مائل" checked={st.ov("company_name").sloganItalic === true} onChange={(v) => st.setOverride("company_name", { sloganItalic: v })} />
              </div>
            </Section>
          )}

          {selected === "payments" && (
            <Section title="تفاصيل الدفع">
              <Row label="شكل الدفع">
                <select value={st.ov("payments").variant || "standard"} onChange={(e) => st.setOverride("payments", { variant: e.target.value })} className={`${inputCls} w-32`}>
                  <option value="standard">افتراضي</option>
                  <option value="status-stamp">ختم الحالة (مدفوع / آجل)</option>
                  <option value="table-row">صفوف الجدول الموزعة</option>
                  <option value="badge-pill">كبسولات ملونة</option>
                </select>
              </Row>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">تسمية طريقة الدفع</span>
                <input value={st.ov("payments").label ?? "طريقة الدفع"}
                  onChange={(e) => st.setOverride("payments", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">تسمية الدفع نقداً</span>
                <input value={st.ov("payments").renameMap?.cash ?? ""} placeholder="نقداً"
                  onChange={(e) => st.setOverride("payments", { renameMap: { ...(st.ov("payments").renameMap || {}), cash: e.target.value } })} className={`${inputCls} w-full`} />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">تسمية الدفع بالشبكة/الفيزا</span>
                <input value={st.ov("payments").renameMap?.card ?? ""} placeholder="شبكة مدى"
                  onChange={(e) => st.setOverride("payments", { renameMap: { ...(st.ov("payments").renameMap || {}), card: e.target.value } })} className={`${inputCls} w-full`} />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">تسمية الدفع بالتحويل البنكي</span>
                <input value={st.ov("payments").renameMap?.bank ?? ""} placeholder="حساب بنكي"
                  onChange={(e) => st.setOverride("payments", { renameMap: { ...(st.ov("payments").renameMap || {}), bank: e.target.value } })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1.5">
                <Toggle label="عرض خط الفكة / الباقي" checked={st.ov("payments").showChange !== false} onChange={(v) => st.setOverride("payments", { showChange: v })} />
              </div>
            </Section>
          )}

          {(selected === "doc_grid" || (selInsert && selInsert.type === "doc_grid")) && (
            <Section title="شبكة بيانات المستند">
              <Row label="الأعمدة">
                <select value={st.ov("doc_grid").cols || 2} onChange={(e) => st.setOverride("doc_grid", { cols: Number(e.target.value) })} className={`${inputCls} w-20`}>
                  <option value={2}>عمودين</option>
                  <option value={3}>3 أعمدة</option>
                </select>
              </Row>
              <Row label="الحدود">
                <select value={st.ov("doc_grid").border || "grid"} onChange={(e) => st.setOverride("doc_grid", { border: e.target.value })} className={`${inputCls} w-24`}>
                  <option value="grid">شبكة كاملة</option>
                  <option value="lines">خطوط أفقية</option>
                  <option value="none">بلا حدود</option>
                </select>
              </Row>
              <Toggle label="تظليل زيبرا" checked={st.ov("doc_grid").zebra !== false} onChange={(v) => st.setOverride("doc_grid", { zebra: v })} />
            </Section>
          )}

          {(selected === "bank_details" || (selInsert && selInsert.type === "bank_details")) && (
            <Section title="بيانات الحساب البنكي">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">اسم البنك</span>
                <input value={st.ov("bank_details").bankName || ""} placeholder="مثال: مصرف الراجحي" onChange={(e) => st.setOverride("bank_details", { bankName: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">اسم الحساب</span>
                <input value={st.ov("bank_details").accountName || ""} placeholder="اسم الشركة المستفيدة" onChange={(e) => st.setOverride("bank_details", { accountName: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">رقم الآيبان IBAN</span>
                <input value={st.ov("bank_details").iban || ""} placeholder="SA..." onChange={(e) => st.setOverride("bank_details", { iban: e.target.value })} className={`${inputCls} w-full`} />
              </label>
            </Section>
          )}

          {(selected === "pattern_divider" || (selInsert && selInsert.type === "pattern_divider")) && (
            <Section title="فاصل زخرفي">
              <Row label="الشكل">
                <select value={st.ov("pattern_divider").style || "double"} onChange={(e) => st.setOverride("pattern_divider", { style: e.target.value })} className={`${inputCls} w-32`}>
                  <option value="double">خط مزدوج</option>
                  <option value="dots">منقّط سميك</option>
                  <option value="dash-dot">متقطع ونقطة</option>
                  <option value="geometric">رموز معينات (◆◇◆)</option>
                  <option value="star">نجوم (✦✦✦)</option>
                </select>
              </Row>
              <Row label="الارتفاع (px)">
                <input type="number" value={st.ov("pattern_divider").height ?? 8} onChange={(e) => st.setOverride("pattern_divider", { height: clamp(Number(e.target.value) || 8, 2, 80) })} className={`${inputCls} w-20`} />
              </Row>
            </Section>
          )}

          {selected === "doc_number" && (
            <Section title="رقم المستند">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("doc_number").label ?? ""} placeholder="رقم الفاتورة"
                  onChange={(e) => st.setOverride("doc_number", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">بادئة الرقم</span>
                <input value={st.ov("doc_number").prefix ?? ""} placeholder="مثال: INV-"
                  onChange={(e) => st.setOverride("doc_number", { prefix: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1.5">
                <Toggle label="إظهار التسمية" checked={st.ov("doc_number").showLabel !== false}
                  onChange={(v) => st.setOverride("doc_number", { showLabel: v })} />
              </div>
            </Section>
          )}

          {selected === "doc_date" && (
            <Section title="التاريخ والوقت">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("doc_date").label ?? ""} placeholder="التاريخ"
                  onChange={(e) => st.setOverride("doc_date", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <Row label="تنسيق التاريخ">
                <select value={st.ov("doc_date").format || ""}
                  onChange={(e) => st.setOverride("doc_date", { format: e.target.value || undefined })} className={`${inputCls} w-36`}>
                  <option value="">تنسيق النظام (افتراضي)</option>
                  <option value="dd/MM/yyyy">يوم/شهر/سنة (25/12/2026)</option>
                  <option value="MM/yyyy">شهر/سنة (12/2026)</option>
                  <option value="yyyy-MM-dd">سنة-شهر-يوم (2026-12-25)</option>
                </select>
              </Row>
              <div className="mt-1.5">
                <Toggle label="إظهار الوقت" checked={st.ov("doc_date").showTime !== false}
                  onChange={(v) => st.setOverride("doc_date", { showTime: v })} />
              </div>
            </Section>
          )}

          {selected === "customer" && (
            <Section title="بيانات العميل">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("customer").label ?? ""} placeholder="العميل"
                  onChange={(e) => st.setOverride("customer", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <Row label="تنسيق المظهر">
                <select value={st.ov("customer").layoutStyle || "inline"} onChange={(e) => st.setOverride("customer", { layoutStyle: e.target.value })} className={`${inputCls} w-28`}>
                  <option value="inline">سطر واحد (Inline)</option>
                  <option value="stacked">متعدد الأسطر (Stacked)</option>
                </select>
              </Row>
              <div className="mt-2 space-y-1.5">
                <Toggle label="عرض هاتف العميل" checked={st.ov("customer").showPhone === true}
                  onChange={(v) => st.setOverride("customer", { showPhone: v })} />
                <Toggle label="عرض عنوان العميل" checked={st.ov("customer").showAddress === true}
                  onChange={(v) => st.setOverride("customer", { showAddress: v })} />
                <Toggle label="عرض الرقم الضريبي للعميل" checked={st.ov("customer").showTaxId === true}
                  onChange={(v) => st.setOverride("customer", { showTaxId: v })} />
                <Toggle label="عرض رصيد العميل المتبقي" checked={st.ov("customer").showBalance === true}
                  onChange={(v) => st.setOverride("customer", { showBalance: v })} />
                <Toggle label="عرض نقاط الولاء للعميل" checked={st.ov("customer").showPoints === true}
                  onChange={(v) => st.setOverride("customer", { showPoints: v })} />
              </div>
            </Section>
          )}

          {selected === "cashier" && (
            <Section title="الكاشير">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("cashier").label ?? ""} placeholder="الكاشير"
                  onChange={(e) => st.setOverride("cashier", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1.5">
                <Toggle label="إخفاء إذا كان فارغاً" checked={st.ov("cashier").hideIfEmpty === true}
                  onChange={(v) => st.setOverride("cashier", { hideIfEmpty: v })} />
              </div>
            </Section>
          )}

          {selected === "subtotal" && (
            <Section title="الإجمالي الفرعي">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("subtotal").label ?? ""} placeholder="الإجمالي الفرعي"
                  onChange={(e) => st.setOverride("subtotal", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
            </Section>
          )}

          {selected === "discount" && (
            <Section title="الخصم">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("discount").label ?? ""} placeholder="الخصم"
                  onChange={(e) => st.setOverride("discount", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
            </Section>
          )}

          {selected === "tax" && (
            <Section title="الضريبة">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("tax").label ?? ""} placeholder="الضريبة"
                  onChange={(e) => st.setOverride("tax", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1.5">
                <Toggle label="عرض نسبة الضريبة (مثال: %١٥)" checked={st.ov("tax").showRate !== false}
                  onChange={(v) => st.setOverride("tax", { showRate: v })} />
              </div>
            </Section>
          )}

          {selected === "increase" && (
            <Section title="رسوم إضافية">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("increase").label ?? ""} placeholder="رسوم إضافية"
                  onChange={(e) => st.setOverride("increase", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
            </Section>
          )}

          {selected === "notes" && (
            <Section title="ملاحظات الفاتورة">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">النص البديل (يتجاوز نص الفاتورة)</span>
                <textarea value={g(st.merged, "receipt_notes") || "مثال: يرجى التواصل قبل الاستبدال — صالحة خلال 7 أيام من تاريخ الشراء."} placeholder="اترك فارغاً لاستخدام نص الفاتورة الأصلي"
                  onChange={(e) => st.setFlat("receipt_notes", e.target.value)}
                  className="h-16 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
              </label>
              <label className="mt-1 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية</span>
                <input value={st.ov("notes").label ?? ""} placeholder="ملاحظات"
                  onChange={(e) => st.setOverride("notes", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <Row label="الحد الأقصى للحروف">
                <input type="number" value={st.ov("notes").maxChars ?? ""} placeholder="بلا حد"
                  onChange={(e) => st.setOverride("notes", { maxChars: e.target.value === "" ? undefined : Math.max(1, Number(e.target.value)) })} className={`${inputCls} w-24`} />
              </Row>
            </Section>
          )}

          {selected === "footer_text" && (
            <Section title="نص التذييل">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">النص البديل</span>
                <textarea value={st.ov("footer_text").text || "شكراً لتعاملكم معنا — نرحب بزيارتكم دائماً"} placeholder="تجاوز النص التلقائي للتذييل..."
                  onChange={(e) => st.setOverride("footer_text", { text: e.target.value })}
                  className="h-16 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
              </label>
              <Row label="المحاذاة">
                <div className="flex gap-1">
                  {[["right", "يمين"], ["center", "وسط"], ["left", "يسار"]].map(([a, lbl]) => (
                    <button key={a} type="button" onClick={() => st.setOverride("footer_text", { align: a })} className={btnCls((st.ov("footer_text").align || "center") === a)}>{lbl}</button>
                  ))}
                </div>
              </Row>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">خلفية النص
                  <ColorField value={st.ov("footer_text").background} fallback="transparent"
                    onChange={(v) => st.setOverride("footer_text", { background: v })} onClear={() => st.setOverride("footer_text", { background: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">إطار (px)
                  <input type="number" min={0} value={st.ov("footer_text").borderWidth ?? 0}
                    onChange={(e) => st.setOverride("footer_text", { borderWidth: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الإطار
                  <ColorField value={st.ov("footer_text").borderColor} fallback="#e2e8f0"
                    onChange={(v) => st.setOverride("footer_text", { borderColor: v })} onClear={() => st.setOverride("footer_text", { borderColor: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">الحشوة (padding)
                  <input type="number" min={0} value={st.ov("footer_text").padding ?? 0}
                    onChange={(e) => st.setOverride("footer_text", { padding: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <Row label="نوع الإطار">
                <select value={st.ov("footer_text").borderStyle || "solid"} onChange={(e) => st.setOverride("footer_text", { borderStyle: e.target.value })} className={`${inputCls} w-32`}>
                  <option value="solid">مستمر</option><option value="dashed">متقطع</option><option value="dotted">منقط</option>
                </select>
              </Row>
            </Section>
          )}

          {selected === "vendor_branding" && (
            <Section title="بصمة الحجازي">
              <Toggle label="إظهار الشعار" checked={st.ov("vendor_branding").showIcon !== false}
                onChange={(v) => st.setOverride("vendor_branding", { showIcon: v })} />
              <div className="mt-1.5">
                <Toggle label="إظهار رقم الدعم الفني" checked={st.ov("vendor_branding").showPhone !== false}
                  onChange={(v) => st.setOverride("vendor_branding", { showPhone: v })} />
              </div>
              <div className="mt-1.5">
                <Toggle label="إظهار الوصف الفرعي" checked={!!st.ov("vendor_branding").showTagline}
                  onChange={(v) => st.setOverride("vendor_branding", { showTagline: v })} />
              </div>
            </Section>
          )}

          {selected === "receipt_header_text" && (
            <Section title="نص الترويسة">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">النص البديل</span>
                <textarea value={st.ov("receipt_header_text").text || "أهلاً وسهلاً — نرحب بكم في متجرنا"} placeholder="تجاوز نص الترويسة التلقائي..."
                  onChange={(e) => st.setOverride("receipt_header_text", { text: e.target.value })}
                  className="h-16 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
              </label>
              <Row label="المحاذاة">
                <div className="flex gap-1">
                  {[["right", "يمين"], ["center", "وسط"], ["left", "يسار"]].map(([a, lbl]) => (
                    <button key={a} type="button" onClick={() => st.setOverride("receipt_header_text", { align: a })} className={btnCls((st.ov("receipt_header_text").align || "center") === a)}>{lbl}</button>
                  ))}
                </div>
              </Row>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">خلفية النص
                  <ColorField value={st.ov("receipt_header_text").background} fallback="transparent"
                    onChange={(v) => st.setOverride("receipt_header_text", { background: v })} onClear={() => st.setOverride("receipt_header_text", { background: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">إطار (px)
                  <input type="number" min={0} value={st.ov("receipt_header_text").borderWidth ?? 0}
                    onChange={(e) => st.setOverride("receipt_header_text", { borderWidth: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">لون الإطار
                  <ColorField value={st.ov("receipt_header_text").borderColor} fallback="#e2e8f0"
                    onChange={(v) => st.setOverride("receipt_header_text", { borderColor: v })} onClear={() => st.setOverride("receipt_header_text", { borderColor: undefined })} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">الحشوة (padding)
                  <input type="number" min={0} value={st.ov("receipt_header_text").padding ?? 0}
                    onChange={(e) => st.setOverride("receipt_header_text", { padding: Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <Row label="نوع الإطار">
                <select value={st.ov("receipt_header_text").borderStyle || "solid"} onChange={(e) => st.setOverride("receipt_header_text", { borderStyle: e.target.value })} className={`${inputCls} w-32`}>
                  <option value="solid">مستمر</option><option value="dashed">متقطع</option><option value="dotted">منقط</option>
                </select>
              </Row>
            </Section>
          )}

          {selected === "signature_lines" && (
            <Section title="خطوط التوقيع">
              <Row label="عدد التوقيعات">
                <div className="flex gap-1">
                  {[[2, "خطّين"], [3, "3 خطوط"]].map(([c, lbl]) => (
                    <button key={c} type="button" onClick={() => st.setOverride("signature_lines", { count: c })} className={btnCls((st.ov("signature_lines").count || 2) === c)}>{lbl}</button>
                  ))}
                </div>
              </Row>
              <div className="mt-2 space-y-1.5">
                {[0, 1, 2].slice(0, st.ov("signature_lines").count || 2).map((idx) => {
                  const defaultLabel = (st.ov("signature_lines").count || 2) === 3 
                    ? ["توقيع البائع", "توقيع المستلم", "توقيع المدير"][idx]
                    : ["توقيع البائع", "توقيع المستلم"][idx];
                  const currentLabels = Array.isArray(st.ov("signature_lines").labels) ? [...st.ov("signature_lines").labels] : [];
                  return (
                    <label key={idx} className="block space-y-1">
                      <span className="text-[10px] font-bold text-[var(--text-muted)]">تسمية الموقّع {idx + 1}</span>
                      <input value={currentLabels[idx] ?? ""} placeholder={defaultLabel}
                        onChange={(e) => {
                          const newLabels = [...currentLabels];
                          newLabels[idx] = e.target.value;
                          st.setOverride("signature_lines", { labels: newLabels });
                        }} className={`${inputCls} w-full`} />
                    </label>
                  );
                })}
              </div>
            </Section>
          )}

          {selected === "receiver_signature" && (
            <Section title="توقيع المستلم">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">عنوان المربع</span>
                <input value={st.ov("receiver_signature").label ?? ""} placeholder="استلمت البضاعة / الخدمة"
                  onChange={(e) => st.setOverride("receiver_signature", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-2 space-y-1.5">
                <Toggle label="عرض حقل الاسم" checked={st.ov("receiver_signature").showName !== false}
                  onChange={(v) => st.setOverride("receiver_signature", { showName: v })} />
                <Toggle label="عرض حقل الهوية" checked={st.ov("receiver_signature").showId === true}
                  onChange={(v) => st.setOverride("receiver_signature", { showId: v })} />
                <Toggle label="عرض حقل التاريخ" checked={st.ov("receiver_signature").showDate !== false}
                  onChange={(v) => st.setOverride("receiver_signature", { showDate: v })} />
                <Toggle label="عرض مربع الختم" checked={st.ov("receiver_signature").showStamp === true}
                  onChange={(v) => st.setOverride("receiver_signature", { showStamp: v })} />
                <Toggle label="مظهر مضغوط" checked={st.ov("receiver_signature").compact === true}
                  onChange={(v) => st.setOverride("receiver_signature", { compact: v })} />
              </div>
            </Section>
          )}

          {selected === "barcode" && (
            <Section title="الباركود">
              <div className="mb-2 rounded-lg bg-[var(--info-bg)] p-2 text-[9px] font-bold leading-relaxed text-[var(--info-text)]">
                شريط رمزي لرقم الفاتورة. يُمسح بجهاز الباركود في الكاشير للبحث السريع عن الفاتورة عند المرتجعات أو الاستفسارات.
              </div>
              <Row label="نوع الرمز">
                <select value={st.ov("barcode").type || "CODE128"}
                  onChange={(e) => st.setOverride("barcode", { type: e.target.value })} className={`${inputCls} w-32`}>
                  <option value="CODE128">CODE128 (افتراضي)</option>
                  <option value="QR">رمز استجابة سريعة QR</option>
                  <option value="EAN13">EAN-13 (كود السلعة)</option>
                </select>
              </Row>
              <Row label="الارتفاع (مم)">
                <input type="number" value={st.ov("barcode").height ?? ""} placeholder={family === "page" ? "12" : "10"}
                  onChange={(e) => st.setOverride("barcode", { height: e.target.value === "" ? undefined : clamp(Number(e.target.value), 4, 40) })} className={`${inputCls} w-20`} />
              </Row>
              <Row label="المحاذاة">
                <select value={st.ov("barcode").align || "center"}
                  onChange={(e) => st.setOverride("barcode", { align: e.target.value })} className={`${inputCls} w-24`}>
                  <option value="center">وسط</option>
                  <option value="right">يمين</option>
                  <option value="left">يسار</option>
                </select>
              </Row>
              <div className="mt-2 space-y-1.5 border-t border-[var(--border-subtle)] pt-1.5">
                <Toggle label="إظهار النص المقروء تحت الباركود" checked={st.ov("barcode").showText !== false}
                  onChange={(v) => st.setOverride("barcode", { showText: v })} />
                <Row label="حجم خط النص (px)">
                  <input type="number" value={st.ov("barcode").textFontSize ?? 10}
                    onChange={(e) => st.setOverride("barcode", { textFontSize: clamp(Number(e.target.value) || 10, 7, 24) })} className={`${inputCls} w-16`} />
                </Row>
              </div>
            </Section>
          )}

          {selected === "doc_title" && (
            <Section title="عنوان المستند">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">نص العنوان</span>
                <input value={st.ov("doc_title").text ?? ""} placeholder="تلقائي (فاتورة مبيعات، إلخ)"
                  onChange={(e) => st.setOverride("doc_title", { text: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1.5">
                <Toggle label="إظهار العنوان" checked={st.ov("doc_title").show !== false}
                  onChange={(v) => st.setOverride("doc_title", { show: v })} />
              </div>
            </Section>
          )}

          {selected === "branch" && (
            <Section title="الفرع">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">اسم الفرع بديل</span>
                <input value={st.ov("branch").label ?? ""} placeholder="الفرع الرئيسي، إلخ"
                  onChange={(e) => st.setOverride("branch", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-2 space-y-1.5">
                <Toggle label="إظهار هاتف الفرع" checked={st.ov("branch").showPhone === true}
                  onChange={(v) => st.setOverride("branch", { showPhone: v })} />
                <Toggle label="إظهار الرقم الضريبي للفرع" checked={st.ov("branch").showTaxId === true}
                  onChange={(v) => st.setOverride("branch", { showTaxId: v })} />
              </div>
            </Section>
          )}

          <button type="button" onClick={() => st.setSelected(null)}
            className="rounded-lg border border-[var(--border-normal)] py-1.5 text-[10px] font-bold text-[var(--text-muted)] hover:bg-[var(--bg-input)]">
            إلغاء التحديد — عرض إعدادات الورقة
          </button>
        </>
      )}

      {/* ═══ nothing selected: paper / typography panel ═══ */}
      {!selected && (
        <>
          <Section title="الخط والألوان">
            <Row label="الخط">
              <select value={merged.print_font || "Tajawal"} onChange={(e) => st.setFlat("print_font", e.target.value)} className={`${inputCls} w-40`}>
                {PRINT_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f} (مضمّن)</option>)}
                {SYSTEM_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Row>
            {family === "page" && (
              <Row label="لون العناوين">
                <ColorField value={merged.accent_color} fallback="#0f172a" onChange={(v) => st.setFlat("accent_color", v)} />
              </Row>
            )}
            <Row label="الأرقام">
              <select value={merged.print_numerals || "western"} onChange={(e) => st.setFlat("print_numerals", e.target.value)} className={`${inputCls} w-32`}>
                <option value="western">1 2 3</option>
                <option value="arabic">١ ٢ ٣</option>
              </select>
            </Row>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[["header_font_size", "اسم الشركة", 10, 32, 16], ["body_font_size", "نص الجسم", 8, 18, 13],
                ["item_font_size", "جدول الأصناف", 8, 16, 13], ["footer_font_size", "التذييل", 8, 16, 11]].map(([k, lbl, min, max, dflt]) => (
                <label key={k} className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">خط {lbl}
                  <input type="number" value={Number(merged[k]) || dflt}
                    onChange={(e) => st.setFlat(k, clamp(Number(e.target.value) || dflt, min, max))} className={`${inputCls} w-full`} />
                </label>
              ))}
            </div>
            <div className="mt-1 text-[9px] font-bold leading-relaxed text-[var(--text-muted)]">
              إن حدّدت حجم خط لعنصر بعينه (بالنقر عليه) فهو يتقدّم على هذه القيم العامة.
            </div>
          </Section>

          {family === "roll" && (
            <Section title="الطباعة الحرارية">
              <Toggle label="أسود نقي (وضوح أقصى)" checked={merged.thermal_pure_black !== false} onChange={(v) => st.setFlat("thermal_pure_black", v)} />
              <div className="mt-2 rounded-lg border border-[var(--border-normal)] p-2.5">
                <div className="text-[10px] font-black text-[var(--text-secondary)]">الطابعة: <span className="font-bold text-[var(--text-muted)]">{st.printerName || "غير معيّنة"}</span></div>
                {st.calibration && (
                  <div className="mt-1 text-[9px] font-bold text-[var(--text-muted)]">
                    منطقة الطباعة: {st.calibration.printAreaWidthMm ? `${st.calibration.printAreaWidthMm}مم` : "افتراضية"} · إزاحة: {st.calibration.shiftXMm || 0}مم
                  </div>
                )}
                <button type="button" onClick={st.openCalibration}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-normal)] py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
                  <Wrench size={12} /> معالج المعايرة
                </button>
              </div>
            </Section>
          )}

          {family === "page" && (
            <Section title="تصميم الصفحة">
              <Row label="تخطيط الصفحة">
                <select value={fam.pageLayoutType || "standard"}
                  onChange={(e) => st.setFamLayout(() => ({ pageLayoutType: e.target.value }))}
                  className={`${inputCls} w-28`}>
                  <option value="standard">افتراضي</option>
                  <option value="sidebar">جانبي حديث</option>
                  <option value="executive">رسمي مزدوج</option>
                  <option value="split-header">رأس مقسوم</option>
                  <option value="ticket">تذكرة مركزية</option>
                  <option value="letterhead">ترويسة رسمية</option>
                  <option value="minimal-top">علوي بسيط</option>
                </select>
              </Row>
              <Row label="شكل الترويسة">
                <select value={(fam.headerStyle) || "band"} onChange={(e) => st.setFamLayout(() => ({ headerStyle: e.target.value }))} className={`${inputCls} w-28`}>
                  <option value="band">شريط ملوّن عرضي</option>
                  <option value="classic">كلاسيكي بحد سفلي</option>
                  <option value="minimal">بسيط متباعد</option>
                  <option value="centered">متمركز بالوسط</option>
                  <option value="boxed">مؤطر في صندوق</option>
                  <option value="asymmetric">شكل جانبي مدمج</option>
                  <option value="brutalist">صندوق بروتالي حاد</option>
                  <option value="inline">شريط أفقي مبسط</option>
                  <option value="badge">شكل بطاقة أنيقة</option>
                </select>
              </Row>
              <Row label="محاذاة بيانات الرأس">
                <select value={fam.headerMetaAlign || "left"} onChange={(e) => st.setFamLayout(() => ({ headerMetaAlign: e.target.value }))} className={`${inputCls} w-24`}>
                  <option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option>
                </select>
              </Row>
              <Row label="هامش الصفحة (مم)">
                <input type="number" min={0} max={25}
                  value={Number.isFinite(Number(merged.page_padding)) && merged.page_padding !== "" && merged.page_padding != null ? Number(merged.page_padding) : 2}
                  onChange={(e) => st.setFlat("page_padding", Math.max(0, Math.min(25, Number(e.target.value) || 0)))}
                  className={`${inputCls} w-20`} />
              </Row>
            </Section>
          )}

          {family === "page" && (
            <Section title="عناصر حرة (بالمليمتر)">
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => st.addOverlay("text")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] py-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <Type size={13} /> نص حر
                </button>
                <button type="button" onClick={() => st.addOverlay("stamp")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] py-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <Stamp size={13} /> ختم
                </button>
                <button type="button" onClick={() => st.addOverlay("image")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] py-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <ImageIcon size={13} /> صورة
                </button>
              </div>
              {st.overlays.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {st.overlays.map((o) => (
                    <button key={o.id} type="button" onClick={() => st.setSelected(o.id)}
                      className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-right text-[10px] font-bold ${st.selected === o.id ? "border-[var(--primary)] bg-[var(--accent-soft)]" : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"}`}>
                      <span className="flex-1 truncate">{{ text: "نص حر", stamp: "ختم", image: "صورة" }[o.type]}{o.props?.text ? `: ${o.props.text}` : ""}</span>
                      <span className="text-[8px] text-[var(--text-muted)]">{o.xMm}،{o.yMm}مم</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          )}

          <button type="button" onClick={st.resetFamily}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-normal)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <RotateCcw size={12} /> إعادة ضبط تخطيط {family === "roll" ? "الرول" : "الصفحة"}
          </button>
        </>
      )}
    </div>
  );
}
