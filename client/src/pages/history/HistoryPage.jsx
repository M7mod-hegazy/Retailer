import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import {
  History,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Lock,
  Activity,
  Calendar,
  User,
  Filter,
  Layers,
  Loader2,
  FileText,
  Package,
  DollarSign,
  Banknote,
  Barcode,
  Tag,
  Hash,
} from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

const ACTION_OPTIONS = [
  { value: "", label: "كل الإجراءات" },
  { value: "create", label: "إنشاء" },
  { value: "edit", label: "تعديل" },
  { value: "void", label: "إلغاء" },
  { value: "delete", label: "حذف" },
];

const ACTION_LABELS = {
  create: "إنشاء", edit: "تعديل", update: "تحديث", void: "إلغاء",
  cancel: "رفض", login: "دخول", delete: "حذف", transfer: "تحويل",
  adjust: "تسوية", amend: "تعديل",
};

const ACTION_COLORS = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-100",
  edit: "bg-blue-50 text-blue-700 border-blue-100",
  update: "bg-blue-50 text-blue-700 border-blue-100",
  void: "bg-rose-50 text-rose-700 border-rose-100",
  cancel: "bg-rose-50 text-rose-700 border-rose-100",
  delete: "bg-rose-50 text-rose-700 border-rose-100",
  login: "bg-violet-50 text-violet-700 border-violet-100",
  transfer: "bg-amber-50 text-amber-700 border-amber-100",
  adjust: "bg-amber-50 text-amber-700 border-amber-100",
  amend: "bg-blue-50 text-blue-700 border-blue-100",
};

const RESOURCE_LABELS = {
  invoices: "الفواتير", purchases: "المشتريات", stock: "المخزون",
  users: "المستخدمين", items: "الأصناف", settings: "الإعدادات",
  customers: "العملاء", suppliers: "الموردين", categories: "الفئات",
  units: "الوحدات", warehouses: "المستودعات", branches: "الفروع",
  banks: "البنوك", employees: "الموظفين", expenses: "المصروفات",
  revenues: "الإيرادات", withdrawals: "السحوبات", payments: "المدفوعات",
  cheques: "الشيكات", quotations: "عرض سعر",
  purchaseOrders: "طلبات التوريد", purchase_returns: "مرتجعات المشتريات",
  sales_return: "مرتجعات المبيعات", promotions: "العروض",
  treasuries: "الخزائن", shifts: "الورديات",
  expenseCategories: "فئات المصروفات", revenueCategories: "فئات الإيرادات",
  branchTransfers: "تحويلات الفروع", notifications: "الإشعارات",
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const BackgroundGraphic = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-40">
    <div className="absolute inset-0 bg-[var(--bg-base)]" />
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
    <motion.div
      animate={{ y: [0, -30, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[10%] left-[5%] w-[600px] h-[600px] rounded-full bg-zinc-200/50 blur-[100px]"
    />
  </div>
);

const FADE_UP = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20 } },
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
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX * 0.3);
    y.set(mouseY * 0.3);
  };

  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: mouseXSpring, y: mouseYSpring }}
      whileTap={{ scale: 0.95 }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
}

// Maps audit log resource names (singular) to their API fetch URLs
const RESOURCE_FETCH_MAP = {
  invoice:          (id) => `/api/invoices/${id}`,
  invoices:         (id) => `/api/invoices/${id}`,
  purchase:         (id) => `/api/purchases/${id}`,
  purchases:        (id) => `/api/purchases/${id}`,
  quotation:        (id) => `/api/quotations/${id}`,
  quotations:       (id) => `/api/quotations/${id}`,
  sales_return:     (id) => `/api/invoices/returns/${id}`,
  purchase_returns: (id) => `/api/purchases/returns/${id}`,
  purchase_return:  (id) => `/api/purchases/returns/${id}`,
};

const INVOICE_FIELD_LABELS = {
  invoice_no: "رقم الفاتورة", total: "الإجمالي", subtotal: "المجموع قبل الخصم",
  discount: "الخصم", payment_type: "طريقة الدفع", status: "الحالة",
  customer_name: "العميل", created_at: "التاريخ", seller_name: "البائع",
  items_count: "عدد الأصناف", debt_remaining: "المتبقي",
};
const PURCHASE_FIELD_LABELS = {
  doc_no: "رقم المستند", total: "الإجمالي", supplier_name: "المورد",
  payment_method: "طريقة الدفع", status: "الحالة", created_at: "التاريخ",
};
const STATUS_LABELS = { active: "نشط", cancelled: "ملغاة", voided: "ملغاة", draft: "مسودة", paid: "مدفوعة", partial: "جزئي" };
const PAYMENT_LABELS = { cash: "نقداً", credit: "آجل", multi: "متعدد", bank_transfer: "تحويل بنكي" };

const SETTINGS_FIELD_LABELS = {
  company_name: "اسم الشركة", company_name_en: "اسم الشركة (إنجليزي)", vat_number: "الرقم الضريبي",
  tax_rate: "نسبة الضريبة", wizard_completed: "تم إكمال المعالج", app_name: "اسم التطبيق",
  app_subtitle: "الاسم الفرعي", branch_name: "اسم الفرع", branch_code: "كود الفرع",
  address: "العنوان", phone: "الهاتف", commercial_register: "السجل التجاري",
  currency_symbol: "رمز العملة", currency_code: "كود العملة", decimal_places: "الخانات العشرية",
  tax_type: "نوع الضريبة", invoice_prefix: "بادئة الفاتورة", purchase_prefix: "بادئة الشراء",
  fiscal_year_start: "بداية السنة المالية", date_format: "تنسيق التاريخ", language: "اللغة",
  receipt_width: "عرض الإيصال", auto_backup_enabled: "النسخ الاحتياطي التلقائي",
  auto_backup_path: "مسار النسخ الاحتياطي", auto_backup_interval_hours: "فاصل النسخ (ساعات)",
  auto_backup_time: "وقت النسخ الاحتياطي", last_auto_backup_at: "آخر نسخ احتياطي",
  walk_in_customer_id: "معرف عميل المشي", default_warehouse_id: "المستودع الافتراضي",
  default_treasury_id: "الخزينة الافتراضية", setup_step: "خطوة الإعداد",
  setup_payload_json: "بيانات الإعداد", license_key: "مفتاح الترخيص", license_status: "حالة الترخيص",
  receipt_footer: "تذييل الإيصال", show_cashier_name: "إظهار اسم الكاشير",
  show_customer_name: "إظهار اسم العميل", show_tax: "إظهار الضريبة", show_footer: "إظهار التذييل",
  logo_url: "رابط الشعار", logo_on_invoices: "شعار الفواتير", logo_on_receipts: "شعار الإيصالات",
  logo_on_sidebar: "شعار القائمة الجانبية", logo_on_reports: "شعار التقارير",
  default_pos_view: "عرض البيع الافتراضي", min_margin_percent: "أدنى هامش ربح",
  additional_addresses: "عناوين إضافية", additional_phones: "هواتف إضافية",
  address_position: "موضع العنوان", show_phone: "إظهار الهاتف", show_address: "إظهار العنوان",
  show_tax_id: "إظهار الرقم الضريبي", show_qr: "إظهار QR", show_logo: "إظهار الشعار",
  show_subtotal: "إظهار المجموع", show_discount_line: "إظهار الخصم",
  show_payment_details: "إظهار تفاصيل الدفع", show_branch: "إظهار الفرع",
  show_invoice_date: "إظهار تاريخ الفاتورة", show_barcode_line: "إظهار الباركود",
  show_item_code: "إظهار كود الصنف", show_notes: "إظهار الملاحظات",
  header_font_size: "حجم خط الرأس", body_font_size: "حجم خط النص",
  footer_font_size: "حجم خط التذييل", item_font_size: "حجم خط الأصناف",
  logo_max_height: "أقصى ارتفاع للشعار", margin_top: "الهامش العلوي", margin_side: "الهامش الجانبي",
  qr_size: "حجم QR", print_font: "خط الطباعة", logo_alignment: "محاذاة الشعار",
  accent_color: "لون التمييز", receipt_header: "رأس الإيصال",
  return_prefix: "بادئة المرتجع", work_order_prefix: "بادئة أمر العمل",
  receipt_prefix: "بادئة الإيصال", address_font_size: "حجم خط العنوان",
  address_alignment: "محاذاة العنوان", tax_id_font_size: "حجم خط الرقم الضريبي",
  tax_id_alignment: "محاذاة الرقم الضريبي", audit_log_retention_days: "حفظ السجل (أيام)",
  margin_alert_cost_method: "طريقة حساب التكلفة", target_margin_percent: "الهامش المستهدف",
  max_discount_percent: "الحد الأقصى للخصم", discount_cap_enabled: "تفعيل حد الخصم",
  font_family: "نوع الخط", font_size: "حجم الخط", font_weight: "وزن الخط",
  number_font_family: "خط الأرقام", number_font_scale: "حجم الأرقام",
  number_font_weight: "وزن الأرقام", numeral_style: "نمط الأرقام",
  tax_enabled: "تفعيل الضريبة",
  feature_multi_unit: "الوحدات المتعددة", feature_variants: "المتغيرات",
  feature_serials: "تتبع السيريال", feature_scale_barcodes: "باركود الميزان",
  feature_repair_orders: "أوامر الصيانة", feature_restaurant: "وضع المطعم",
  feature_gold: "تسعير الذهب", feature_promotions: "العروض",
  serials_strict_mode: "الوضع الصارم للسيريال",
  scale_prefix: "بادئة باركود الميزان", scale_item_code_length: "طول كود PLU",
  scale_value_type: "نوع القيمة", scale_value_decimals: "الخانات العشرية",
  color_theme: "نظام الألوان", custom_theme_vars: "متغيرات الألوان",
  pos_voice_enabled: "الصوت في البيع", smart_lock_enabled: "القفل الذكي",
  smart_lock_timeout_minutes: "مدة القفل الذكي (دقائق)",
  held_yellow_hours: "التنبيه الأصفر (ساعات)", held_red_hours: "التنبيه الأحمر (ساعات)",
};

function getSettingFieldLabel(key) {
  return SETTINGS_FIELD_LABELS[key] || key;
}

function isSettingChange(val) {
  return typeof val === "object" && val !== null && "from" in val && "to" in val;
}

function cleanSettingValue(val) {
  if (val === null || val === undefined) return "—";
  const s = String(val);
  return s.replace(/\.0+$/, "");
}

function formatPayloadValue(key, val) {
  if (isSettingChange(val)) {
    return `من ${cleanSettingValue(val.from)} إلى ${cleanSettingValue(val.to)}`;
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val ?? "—");
}

function SummaryCard({ data, resource }) {
  const isInvoice = ["invoice", "invoices", "sales_return", "sales_returns"].includes(resource);
  const isPurchase = ["purchase", "purchases", "purchase_returns", "purchase_return"].includes(resource);
  const labels = isInvoice ? INVOICE_FIELD_LABELS : isPurchase ? PURCHASE_FIELD_LABELS : {};
  const SKIP = ["id", "lines", "payments", "allocations", "items", "amended_by", "amendment_of", "user_id", "customer_id", "supplier_id", "seller_id", "shift_id", "warehouse_id", "cancelled_by", "amendment_of_no", "amended_by_no", "created_by_user_id"];

  const entries = Object.entries(data)
    .filter(([k, v]) => !SKIP.includes(k) && v !== null && v !== undefined && v !== "")
    .filter(([k]) => Object.keys(labels).includes(k) || !isInvoice && !isPurchase);

  if (!entries.length) return null;

  const fmt = (key, val) => {
    if (["total", "subtotal", "discount", "debt_remaining"].includes(key)) return `${formatNumber(val)} ج`;
    if (key === "status") return STATUS_LABELS[val] || val;
    if (key === "payment_type" || key === "payment_method") return PAYMENT_LABELS[val] || val;
    if (key === "created_at") return new Date(val).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" });
    return String(val);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {entries.map(([key, val]) => (
        <div key={key} className="bg-white rounded-xl border border-zinc-200/60 px-3 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{labels[key] || key}</p>
          <p className="text-2sm font-black text-zinc-900 truncate" dir="ltr">{fmt(key, val)}</p>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ log, payload }) {
  const id = payload?.id || payload?.return_id || payload?.new_id || payload?.invoice_id;
  const resource = log.resource;

  const fetchUrlFn = RESOURCE_FETCH_MAP[resource];
  const fetchUrl = fetchUrlFn && id ? fetchUrlFn(id) : null;

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["audit-detail", resource, id],
    queryFn: () => api.get(fetchUrl).then((r) => r.data?.data),
    enabled: Boolean(fetchUrl),
  });

  const lines = detailData?.lines || detailData?.items || [];
  const payments = detailData?.payments || detailData?.allocations || [];

  const SKIP_PAYLOAD_KEYS = ["password_hash", "token", "id", "return_id", "new_id", "invoice_id", "original_id"];
  const usefulPayloadEntries = Object.entries(payload).filter(([k, v]) => !SKIP_PAYLOAD_KEYS.includes(k) && v !== null && v !== undefined && v !== "");

  return (
    <div className="bg-zinc-50/80 rounded-2xl border border-zinc-100 p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/50">
        <FileText className="w-4 h-4 text-zinc-500" />
        <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">تفاصيل العملية</span>
      </div>

      {detailLoading && (
        <div className="flex items-center gap-2 text-zinc-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[11px] font-bold">جاري تحميل التفاصيل...</span>
        </div>
      )}

      {detailData && !detailLoading && <SummaryCard data={detailData} resource={resource} />}

      {!detailData && !detailLoading && usefulPayloadEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {usefulPayloadEntries.map(([key, val]) => {
            const isSettings = resource === "settings";
            const label = isSettings ? getSettingFieldLabel(key) : key;
            const displayVal = isSettings && isSettingChange(val)
              ? `من ${cleanSettingValue(val.from)} إلى ${cleanSettingValue(val.to)}`
              : formatPayloadValue(key, val);
            return (
              <div key={key} className="bg-white rounded-xl border border-zinc-200/60 px-3 py-2.5">
                <p className="text-[9px] font-black tracking-widest text-zinc-400 mb-1">{label}</p>
                <p className="text-2sm font-black text-zinc-900 truncate">{displayVal}</p>
              </div>
            );
          })}
        </div>
      )}

      {!detailData && !detailLoading && usefulPayloadEntries.length === 0 && (
        <p className="text-[11px] text-zinc-400 text-center py-2">لا توجد بيانات إضافية</p>
      )}

      {lines.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-2">
            <Package className="w-3.5 h-3.5" />
            الأصناف ({lines.length})
          </h4>
          <div className="bg-white rounded-xl border border-zinc-200/60 max-h-60 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 sticky top-0">
                  <th className="text-right font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">#</th>
                  <th className="text-right font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">الكود</th>
                  <th className="text-right font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">الصنف</th>
                  <th className="text-right font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">الباركود</th>
                  <th className="text-center font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">الكمية</th>
                  <th className="text-left font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">السعر</th>
                  <th className="text-left font-bold text-zinc-400 px-3 py-2 whitespace-nowrap">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lines.map((line, i) => (
                  <tr key={line.id || i} className="hover:bg-zinc-50/50">
                    <td className="px-3 py-2.5 text-zinc-400 font-bold w-8">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      {line.item_code || line.sku ? (
                        <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px]">
                          <Hash className="w-3 h-3 inline ml-0.5 -mt-0.5 text-zinc-400" />
                          {line.item_code || line.sku}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-black text-zinc-800">{line.item_name || `#${line.item_id}`}</span>
                      {line.warehouse_id && (
                        <span className="text-[11px] text-zinc-400 mr-1">(م {line.warehouse_id})</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {line.barcode ? (
                        <span className="font-mono text-zinc-500 flex items-center gap-1">
                          <Barcode className="w-3 h-3 text-zinc-300" />
                          {line.barcode}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-zinc-700">{line.quantity}</td>
                    <td className="px-3 py-2.5 text-left font-black text-zinc-600">
                      {formatNumber(line.unit_price || line.unit_cost || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-left font-black text-zinc-900">
                      {formatNumber(line.line_total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-2">
            <Banknote className="w-3.5 h-3.5" />
            المدفوعات ({payments.length})
          </h4>
          <div className="bg-white rounded-xl border border-zinc-200/60 divide-y divide-zinc-100">
            {payments.map((pmt, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-[11px]">
                <span className="font-bold text-zinc-500">{pmt.method_name || pmt.method || "نقداً"}</span>
                <span className="font-black text-zinc-800">{formatNumber(pmt.amount || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailData && !detailLoading && "debt_remaining" in detailData && Number(detailData.debt_remaining) > 0 && (
        <div className="flex items-center gap-2 text-[11px] font-black text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
          <DollarSign className="w-3.5 h-3.5" />
          المتبقي: {formatNumber(detailData.debt_remaining)}
        </div>
      )}
    </div>
  );
}

function LogRow({ log, index, highlighted, autoExpand }) {
  const [expanded, setExpanded] = useState(false);
  const rowRef = useRef(null);

  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  useEffect(() => {
    if (!highlighted) return;
    // Delay scroll to wait for framer-motion entry animation to settle
    const t = setTimeout(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 500);
    return () => clearTimeout(t);
  }, [highlighted]);

  const resourceLabel = RESOURCE_LABELS[log.resource] || log.resource;
  const actionLabel = ACTION_LABELS[log.action] || log.action;
  const badgeClasses = ACTION_COLORS[log.action] || "bg-zinc-50 text-zinc-700 border-zinc-200";
  const initial = (log.username || log.full_name || "؟")[0]?.toUpperCase();

  const payload = React.useMemo(() => {
    if (!log.payload_json) return null;
    try { return JSON.parse(log.payload_json); } catch { return null; }
  }, [log.payload_json]);

  const hasDetails = payload && Object.keys(payload).length > 0;
  const descriptionText = log.description
    ? log.description.replace(/^\p{Emoji}\s*/u, "")
    : `${actionLabel} · ${resourceLabel || "سجل"}`;

  const payloadEntries = React.useMemo(() => {
    if (!hasDetails) return [];
    return Object.entries(payload).filter(([k]) => !["password_hash", "token"].includes(k));
  }, [hasDetails, payload]);

  return (
    <motion.div
      ref={rowRef}
      variants={FADE_UP}
      custom={index}
      className={`group relative border-b border-zinc-100/60 transition-all duration-500 ${highlighted ? "bg-amber-50/70 ring-2 ring-inset ring-amber-300/50" : "bg-white hover:bg-zinc-50/80"}`}
    >
      <div className="flex items-center gap-4 px-6 py-5">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-zinc-950 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-500 ease-out z-10" />
        
        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group-hover:-translate-y-1 transition-all duration-500 ease-out text-xl">
          {log.description?.match(/^\p{Emoji}/u)?.[0] || "📋"}
        </div>

        <div className="relative z-10 flex-1 min-w-0">
          <p className="text-sm font-black text-zinc-950 tracking-tight leading-snug group-hover:text-zinc-800 transition-colors truncate">
            {descriptionText}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {log.resource && (
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                {resourceLabel}
              </span>
            )}
            {log.action && (
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black tracking-wide ${badgeClasses}`}>
                {actionLabel}
              </span>
            )}
            {log.full_name && log.full_name !== log.username && (
              <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                👤 {log.full_name}
              </span>
            )}
            {hasDetails && payloadEntries.length > 0 && (
              <span className="text-[11px] font-bold text-zinc-300">·</span>
            )}
            {hasDetails && payloadEntries.slice(0, 3).map(([key, val]) => {
              const isSettings = log.resource === "settings";
              const label = isSettings ? getSettingFieldLabel(key) : key;
              let displayVal;
              if (isSettings && isSettingChange(val)) {
                displayVal = `${cleanSettingValue(val.from)} ← ${cleanSettingValue(val.to)}`;
              } else {
                const isMonetary = ["total", "amount", "subtotal", "price", "cost"].some(k => key.toLowerCase().includes(k));
                displayVal = isMonetary ? formatNumber(val) : (typeof val === "object" ? JSON.stringify(val) : String(val ?? "—"));
              }
              return (
                <span key={key} className="text-[11px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="text-zinc-400">{label}:</span>
                  <span>{displayVal}</span>
                </span>
              );
            })}
            {hasDetails && payloadEntries.length > 3 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-[11px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                +{payloadEntries.length - 3} المزيد
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2 bg-zinc-50 px-2.5 py-1 rounded-xl border border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-700 whitespace-nowrap">
              {log.username || log.full_name || "غير معروف"}
            </span>
            <div className="h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[8px] font-black shadow-sm">
              {initial}
            </div>
          </div>
          <time dir="ltr" className="text-[11px] font-mono font-bold text-zinc-400" title={log.created_at}>
            {log.created_at
              ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
                }).format(new Date(log.created_at))
              : "—"}
          </time>
          {log.ip_address && (
            <span dir="ltr" className="text-[9px] font-mono text-zinc-300">{log.ip_address}</span>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-1">
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all"
              title={expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-0 mr-[72px]">
              <DetailPanel log={log} payload={payload} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HistoryPage() {
  usePageTour('history');
  const { user, permissions } = useAuthStore();
  const canView =
    user?.role === "dev" ||
    user?.role === "admin" ||
    (Array.isArray(permissions?.history) && permissions.history.includes("view"));

  const [searchParams] = useSearchParams();
  const rawLogId = searchParams.get("log_id") ? Number(searchParams.get("log_id")) : null;
  const notifId = searchParams.get("notif_id") ? Number(searchParams.get("notif_id")) : null;

  // highlightLogId starts as whatever is in the URL, then gets resolved from notif_id lookup
  const [highlightLogId, setHighlightLogId] = React.useState(rawLogId);

  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 400);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
  const [userAction, setUserAction] = useState("");
  const [resource, setResource] = useState("");
  const searchRef = useRef(null);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const userIdRef = useRef(null);
  const userActionRef = useRef(null);
  const resourceRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  useEffect(() => { setPage(1); }, [search, from, to, userId, userAction, resource]);

  // Find which page the target audit log is on (works for both log_id and notif_id)
  const findPageEnabled = (Boolean(rawLogId) || Boolean(notifId)) && canView;
  const { data: findPageData } = useQuery({
    queryKey: ["audit-find-page", rawLogId, notifId],
    queryFn: () => api.get("/api/audit-logs/find-page", {
      params: { log_id: rawLogId || undefined, notif_id: notifId || undefined, per_page: 20 }
    }).then(r => r.data),
    enabled: findPageEnabled,
  });

  useEffect(() => {
    if (findPageData?.success) {
      if (findPageData.resolved_log_id) setHighlightLogId(findPageData.resolved_log_id);
      if (findPageData.page) setPage(findPageData.page);
    }
  }, [findPageData]);

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
    enabled: canView,
  });
  const users = usersData?.data || usersData || [];

  const PER_PAGE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", search, from, to, userId, userAction, resource, page],
    queryFn: () =>
      api.get("/api/audit-logs", {
        params: {
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
          user_id: userId || undefined,
          action: userAction || undefined,
          resource: resource || undefined,
          page,
          per_page: PER_PAGE,
        }
      }).then((r) => r.data),
    enabled: canView,
    keepPreviousData: true,
  });

  const logs = data?.data || [];
  const totalPages = data?.meta?.pages || 1;

  if (!canView) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-center space-y-4">
          <Lock className="mx-auto h-12 w-12 text-zinc-300" />
          <h2 className="text-2xl font-black text-zinc-900">غير مصرح</h2>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans">
      <BackgroundGraphic />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.header
          initial="hidden"
          animate="visible"
          variants={FADE_UP}
          className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-6">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white border border-zinc-200 shadow-sm text-zinc-900 relative"
              >
                <div className="absolute inset-1 rounded-xl border border-dashed border-zinc-300/50" />
                <Activity className="h-5 w-5" />
              </motion.div>
              <span className="text-xs font-black text-zinc-400 tracking-[0.2em] uppercase bg-white px-3 py-1.5 rounded-full border border-zinc-200">
                مراقبة النظام الشاملة
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-950 leading-[1.1] max-w-2xl">
              سجل <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-400">النشاط</span>
            </h1>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div data-help="search-bar" className="relative flex-1 md:w-80 group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
              <input
                type="text"
                ref={searchRef}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: fromRef, prevRef: null })}
                placeholder="ابحث في السجل..."
                className="w-full rounded-[1.25rem] border border-white bg-white/60 backdrop-blur-md py-4 pr-12 pl-4 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all"
              />
            </div>
            <MagneticButton
              data-help="filter-btn"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center justify-center h-[54px] w-[54px] rounded-[1.25rem] transition-all duration-300 shadow-sm border ${
                filtersOpen ? "bg-primary text-white border-primary" : "bg-white border-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </MagneticButton>
          </div>
        </motion.header>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="mb-10 overflow-hidden"
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100">
                  <Filter className="w-5 h-5 text-zinc-950" />
                  <h3 className="text-lg font-black text-zinc-950">تصفية متقدمة</h3>
                  {(from || to || userId || userAction || resource) && (
                    <button 
                      onClick={() => { setFrom(""); setTo(""); setUserId(""); setUserAction(""); setResource(""); }}
                      className="mr-auto text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      مسح الفلاتر
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" /> من تاريخ
                    </label>
                    <input 
                      type="date" 
                      ref={fromRef}
                      value={from} 
                      onChange={e => setFrom(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: toRef, prevRef: searchRef })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" /> إلى تاريخ
                    </label>
                    <input 
                      type="date" 
                      ref={toRef}
                      value={to} 
                      onChange={e => setTo(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: userIdRef, prevRef: fromRef })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest">
                      <User className="w-3.5 h-3.5" /> المستخدم
                    </label>
                    <select 
                      ref={userIdRef}
                      value={userId} 
                      onChange={e => setUserId(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: userActionRef, prevRef: toRef })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow"
                    >
                      <option value="">كل المستخدمين</option>
                      {Array.isArray(users) && users.map(u => (
                        <option key={u.id} value={u.id}>{u.username || u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest">
                      <Activity className="w-3.5 h-3.5" /> الإجراء
                    </label>
                    <select 
                      ref={userActionRef}
                      value={userAction} 
                      onChange={e => setUserAction(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: resourceRef, prevRef: userIdRef })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow"
                    >
                      {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest">
                      <Layers className="w-3.5 h-3.5" /> القسم
                    </label>
                    <select 
                      ref={resourceRef}
                      value={resource} 
                      onChange={e => setResource(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: null, prevRef: userActionRef })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-shadow"
                    >
                      <option value="">كل الأقسام</option>
                      {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] overflow-hidden"
        >
          {isLoading ? (
            <div className="p-20 text-center flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-zinc-300 animate-spin mb-4" />
              <p className="font-bold text-zinc-400 tracking-widest uppercase text-xs">جاري جلب البيانات</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-32 text-center flex flex-col items-center">
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="h-24 w-24 bg-zinc-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-zinc-100"
              >
                <History className="h-10 w-10 text-zinc-300" />
              </motion.div>
              <p className="font-black text-zinc-950 text-2xl tracking-tight">السجل فارغ تماماً</p>
              <p className="text-base font-medium text-zinc-500 mt-2 max-w-sm leading-relaxed">لم يتم تسجيل أي عمليات ضمن معايير البحث الحالية.</p>
            </div>
          ) : (
            <div data-help="main-table" className="flex flex-col relative">
              <div className="absolute right-[22px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-zinc-100 to-transparent z-0 hidden md:block" />
              {logs.map((log, index) => (
                <LogRow
                  key={log.id}
                  log={log}
                  index={index}
                  highlighted={log.id === highlightLogId}
                  autoExpand={log.id === highlightLogId}
                />
              ))}
            </div>
          )}

          {!isLoading && totalPages > 1 && (
            <div data-help="pagination" className="flex items-center justify-between px-10 py-6 border-t border-zinc-100/60 bg-zinc-50/50 backdrop-blur-sm">
              <MagneticButton
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-2 text-sm font-black text-zinc-950 px-6 py-3 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" /> الأحدث
              </MagneticButton>
              <span className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase">
                {page} / {totalPages}
              </span>
              <MagneticButton
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-2 text-sm font-black text-zinc-950 px-6 py-3 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30"
              >
                الأقدم <ChevronLeft className="h-4 w-4" />
              </MagneticButton>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}