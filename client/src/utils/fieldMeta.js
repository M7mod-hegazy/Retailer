const FIELD_META = {

  // ─── Identity / Branding ──────────────────────────────────────────
  app_name: {
    label: { ar: "اسم التطبيق (رئيسي)", en: "App Name" },
    hint: { ar: "يظهر في أعلى الشاشة وشريط العنوان", en: "Shown in the top bar and title bar" },
    placeholder: { ar: "مثال: إلهيجازي للتجزئة", en: "e.g. ElHegazi Retailer" },
    defaultValue: "إلهيجازي للتجزئة",
    group: "branding",
  },
  app_subtitle: {
    label: { ar: "الاسم الفرعي", en: "Sub-title" },
    hint: { ar: "يظهر تحت الاسم الرئيسي مباشرة", en: "Displayed below the main name" },
    placeholder: { ar: "مثال: نظام إدارة المبيعات والمخزون", en: "e.g. Sales & Inventory Management" },
    defaultValue: "",
    group: "branding",
  },
  logo_url: {
    label: { ar: "شعار التطبيق", en: "App Logo" },
    hint: { ar: "يظهر في الشريط العلوي ورأس الفواتير", en: "Displayed in the top bar and invoice headers" },
    defaultValue: null,
    group: "branding",
  },

  // ─── Branch Info ──────────────────────────────────────────────────
  company_name: {
    label: { ar: "اسم الشركة (عربي)", en: "Company Name (Arabic)" },
    hint: { ar: "الاسم القانوني للشركة — يظهر في رأس الفواتير والتقارير", en: "Legal company name — appears on invoices and reports" },
    placeholder: { ar: "مثال: شركة إلهيجازي للتجزئة", en: "e.g. ElHegazi Retail Co." },
    defaultValue: "",
    critical: true,
    group: "branch",
  },
  company_name_en: {
    label: { ar: "اسم الشركة (إنجليزي)", en: "Company Name (English)" },
    hint: { ar: "للفواتير الإنجليزية والمستندات الرسمية", en: "For English invoices and official documents" },
    placeholder: { ar: "مثال: ElHegazi Retail", en: "e.g. ElHegazi Retail" },
    defaultValue: "",
    group: "branch",
  },
  branch_name: {
    label: { ar: "اسم الفرع", en: "Branch Name" },
    hint: { ar: "اسم الفرع الذي يصدر الفاتورة منه", en: "The branch issuing invoices" },
    placeholder: { ar: "مثال: الفرع الرئيسي — القاهرة", en: "e.g. Main Branch — Cairo" },
    defaultValue: "",
    critical: true,
    group: "branch",
  },
  branch_code: {
    label: { ar: "كود الفرع", en: "Branch Code" },
    hint: { ar: "رمز مختصر للتعريف الداخلي للفرع", en: "Short identifier for internal branch reference" },
    placeholder: { ar: "مثال: BR-001", en: "e.g. BR-001" },
    defaultValue: "",
    group: "branch",
  },

  // ─── Official Documents ───────────────────────────────────────────
  commercial_register: {
    label: { ar: "السجل التجاري", en: "Commercial Register" },
    hint: { ar: "رقم السجل التجاري — يظهر في تذييل الفواتير", en: "CR number — appears in invoice footer" },
    placeholder: { ar: "مثال: 123456", en: "e.g. 123456" },
    defaultValue: "",
    critical: true,
    group: "official",
  },
  vat_number: {
    label: { ar: "الرقم الضريبي", en: "VAT Number" },
    hint: { ar: "رقم التسجيل الضريبي — يظهر في تذييل الفواتير", en: "Tax registration number — appears in invoice footer" },
    placeholder: { ar: "مثال: 310122393500003", en: "e.g. 310122393500003" },
    defaultValue: "",
    critical: true,
    group: "official",
  },

  // ─── Address / Phones ─────────────────────────────────────────────
  address: {
    label: { ar: "العنوان الرئيسي", en: "Main Address" },
    hint: { ar: "عنوان الفرع الرئيسي — يظهر في رأس الفواتير", en: "Main branch address — appears in invoice headers" },
    placeholder: { ar: "مثال: ١٢ شارع الثورة — القاهرة", en: "e.g. 12 Tahrir St. — Cairo" },
    defaultValue: "",
    critical: true,
    group: "address",
  },
  phone: {
    label: { ar: "الهاتف الرئيسي", en: "Main Phone" },
    hint: { ar: "رقم الهاتف الأساسي للفرع", en: "Primary phone number for the branch" },
    placeholder: { ar: "مثال: ٠١٢٣٤٥٦٧٨٩٠", en: "e.g. +201234567890" },
    defaultValue: "",
    critical: true,
    group: "address",
  },

  // ─── General / Display ────────────────────────────────────────────
  language: {
    label: { ar: "لغة العرض الافتراضية", en: "Default Language" },
    hint: { ar: "اللغة الافتراضية للمستخدمين الجدد — يمكن لكل مستخدم تغييرها", en: "Default language for new users — each user can override" },
    defaultValue: "ar",
    options: [
      { value: "ar", label: { ar: "العربية (RTL)", en: "Arabic (RTL)" } },
      { value: "en", label: { ar: "English (LTR)", en: "English (LTR)" } },
    ],
    group: "display",
  },
  default_pos_view: {
    label: { ar: "عرض نقطة البيع الافتراضي", en: "Default POS View" },
    hint: { ar: "شكل عرض الأصناف عند فتح شاشة البيع — شبكة تفصيلية أو قائمة", en: "Default item view in POS screen — grid or list" },
    defaultValue: "detailed",
    group: "display",
  },
  pos_voice_enabled: {
    label: { ar: "الصوت في نقطة البيع", en: "POS Sound" },
    hint: { ar: "إصدار صوت تنبيه عند إضافة صنف أو مسح باركود — يفضّل إيقافه في البيئات الهادئة", en: "Beep on item add or barcode scan — disable in quiet environments" },
    defaultValue: 1,
    group: "display",
  },
  smart_lock_enabled: {
    label: { ar: "قفل الشاشة الذكي", en: "Smart Lock" },
    hint: { ar: "قفل الشاشة تلقائياً بعد فترة من عدم النشاط لحماية الجلسة", en: "Auto-lock the screen after inactivity to protect your session" },
    defaultValue: 1,
    group: "display",
  },
  smart_lock_timeout_minutes: {
    label: { ar: "مدة عدم النشاط (دقائق)", en: "Inactivity Timeout (minutes)" },
    hint: { ar: "عدد الدقائق قبل قفل الشاشة تلقائياً", en: "Minutes of inactivity before auto-lock" },
    defaultValue: 15,
    min: 1, max: 999,
    group: "display",
  },

  // ─── Held Invoice Alerts ──────────────────────────────────────────
  held_yellow_hours: {
    label: { ar: "تنبيه أصفر بعد (ساعات)", en: "Yellow Alert After (Hours)" },
    hint: { ar: "بعد هذه المدة يتحول لون الفاتورة المعلقة إلى الأصفر", en: "After this time, held invoices turn yellow" },
    defaultValue: 2,
    min: 1, max: 72,
    group: "alerts",
  },
  held_red_hours: {
    label: { ar: "تنبيه أحمر بعد (ساعات)", en: "Red Alert After (Hours)" },
    hint: { ar: "بعد هذه المدة يتحول لون الفاتورة المعلقة إلى الأحمر لتنبيه المشرف", en: "After this time, held invoices turn red for supervisor attention" },
    defaultValue: 8,
    min: 1, max: 168,
    group: "alerts",
  },

  // ─── Audit Log ────────────────────────────────────────────────────
  audit_log_retention_days: {
    label: { ar: "مدة حفظ سجل النشاط", en: "Audit Log Retention" },
    hint: { ar: "الفترة التي يتم فيها الاحتفاظ بسجلات حركة المستخدمين قبل الحذف التلقائي", en: "How long user activity logs are kept before auto-deletion" },
    defaultValue: 30,
    options: [
      { value: 15, label: { ar: "١٥ يوماً", en: "15 Days" } },
      { value: 30, label: { ar: "٣٠ يوماً", en: "30 Days" } },
      { value: 60, label: { ar: "٦٠ يوماً", en: "60 Days" } },
      { value: 90, label: { ar: "٩٠ يوماً", en: "90 Days" } },
      { value: 180, label: { ar: "١٨٠ يوماً", en: "180 Days" } },
      { value: 365, label: { ar: "٣٦٥ يوماً", en: "365 Days" } },
    ],
    group: "audit",
  },

  // ─── Currency & Tax ───────────────────────────────────────────────
  currency_symbol: {
    label: { ar: "رمز العملة", en: "Currency Symbol" },
    hint: { ar: "الرمز الذي يظهر بجانب المبالغ في كل النظام", en: "Symbol displayed next to amounts throughout the system" },
    placeholder: { ar: "مثال: ر.س أو ج.م", en: "e.g. SAR or EGP" },
    defaultValue: "",
    critical: true,
    group: "financial",
  },
  decimal_places: {
    label: { ar: "كسور العملة", en: "Decimal Places" },
    hint: { ar: "عدد الأرقام العشرية بعد الفاصلة في المبالغ", en: "Number of decimal places for monetary values" },
    defaultValue: 2,
    options: [
      { value: 0, label: { ar: "٠ (بدون كسور)", en: "0 (No decimals)" } },
      { value: 2, label: { ar: "٢ (منزلتين)", en: "2 (Two places)" } },
      { value: 3, label: { ar: "٣ (ثلاث منازل)", en: "3 (Three places)" } },
    ],
    group: "financial",
  },
  tax_enabled: {
    label: { ar: "تفعيل الضريبة", en: "Enable Tax" },
    hint: { ar: "عند التفعيل تُضاف الضريبة على الفواتير وفق النوع المحدد", en: "When enabled, tax is applied to invoices per the selected type" },
    defaultValue: 0,
    options: [
      { value: 1, label: { ar: "مفعّل", en: "Enabled" } },
      { value: 0, label: { ar: "غير مفعّل", en: "Disabled" } },
    ],
    group: "financial",
  },
  tax_type: {
    label: { ar: "نوع الضريبة الافتراضي", en: "Default Tax Type" },
    hint: { ar: "شاملة: داخلة في السعر — غير شاملة: تضاف على السعر", en: "Inclusive: tax in price — Exclusive: tax added to price" },
    defaultValue: "none",
    options: [
      { value: "none", label: { ar: "بدون ضريبة", en: "No Tax" } },
      { value: "inclusive", label: { ar: "شاملة الضريبة", en: "Tax Inclusive" } },
      { value: "exclusive", label: { ar: "غير شاملة الضريبة", en: "Tax Exclusive" } },
    ],
    group: "financial",
  },
  tax_rate: {
    label: { ar: "نسبة الضريبة (%)", en: "Tax Rate (%)" },
    hint: { ar: "النسبة المئوية للضريبة المطبقة على الفواتير", en: "Percentage tax rate applied to invoices" },
    placeholder: { ar: "مثال: ١٥", en: "e.g. 15" },
    defaultValue: 0,
    min: 0, max: 100,
    group: "financial",
  },

  // ─── Discount Limits ───────────────────────────────────────────────
  discount_cap_enabled: {
    label: { ar: "حد الخصم الأقصى", en: "Discount Cap" },
    hint: { ar: "تفعيل حد أقصى للخصم المسموح به على الفواتير لحماية هامش الربح", en: "Enable a maximum discount limit on invoices to protect profit margins" },
    defaultValue: 1,
    options: [
      { value: 1, label: { ar: "مفعّل", en: "Enabled" } },
      { value: 0, label: { ar: "بدون حد (غير مفعّل)", en: "No Limit (Disabled)" } },
    ],
    group: "discount",
  },
  max_discount_percent: {
    label: { ar: "الحد الأقصى للخصم (%)", en: "Max Discount (%)" },
    hint: { ar: "أقصى خصم نسبة مئوية مسموح به على الفاتورة", en: "Maximum percentage discount allowed on invoices" },
    defaultValue: 15,
    min: 0, max: 100,
    group: "discount",
  },

  // ─── Profit Margins ───────────────────────────────────────────────
  margin_alert_cost_method: {
    label: { ar: "طريقة حساب التكلفة", en: "Cost Calculation Method" },
    hint: { ar: "الخوارزمية المستخدمة لحساب تكلفة المنتج في تقارير الربحية", en: "Algorithm used to calculate product cost in profitability reports" },
    defaultValue: "wacc",
    options: [
      { value: "wacc", label: { ar: "المتوسط المرجح (WACC)", en: "Weighted Average (WACC)" } },
      { value: "last_purchase", label: { ar: "آخر سعر شراء", en: "Last Purchase Price" } },
      { value: "standard", label: { ar: "تكلفة معيارية", en: "Standard Cost" } },
      { value: "fifo", label: { ar: "الوارد أولاً (FIFO)", en: "First In First Out (FIFO)" } },
      { value: "lifo", label: { ar: "الوارد أخيراً (LIFO)", en: "Last In First Out (LIFO)" } },
    ],
    group: "margin",
  },
  min_margin_percent: {
    label: { ar: "الحد الأدنى للهامش (%)", en: "Minimum Margin (%)" },
    hint: { ar: "إذا انخفض هامش الربح عن هذه النسبة يظهر تنبيه في التقارير", en: "If margin falls below this, an alert is shown in reports" },
    defaultValue: 15,
    min: 0, max: 100,
    group: "margin",
  },
  target_margin_percent: {
    label: { ar: "هامش الربح المستهدف (%)", en: "Target Margin (%)" },
    hint: { ar: "نسبة هامش الربح التي تسعى المنشأة لتحقيقها", en: "The profit margin percentage the business aims to achieve" },
    defaultValue: 25,
    min: 0, max: 100,
    group: "margin",
  },

  // ─── Backup ────────────────────────────────────────────────────────
  auto_backup_enabled: {
    label: { ar: "تفعيل النسخ اليومي", en: "Enable Daily Backup" },
    hint: { ar: "إنشاء نسخة احتياطية تلقائية يومياً في الوقت المحدد", en: "Create an automatic daily backup at the scheduled time" },
    defaultValue: 0,
    group: "backup",
  },
  auto_backup_time: {
    label: { ar: "وقت النسخة اليومية", en: "Backup Time" },
    hint: { ar: "الوقت الذي يتم فيه إنشاء النسخة الاحتياطية اليومية", en: "Time of day for the daily backup" },
    defaultValue: "02:00",
    group: "backup",
  },
  auto_backup_path: {
    label: { ar: "مجلد الحفظ", en: "Backup Folder" },
    hint: { ar: "المجلد الذي تُحفظ فيه النسخ الاحتياطية — الافتراضي: backups/", en: "Folder where backups are saved — default: backups/" },
    placeholder: { ar: "افتراضي: backups/", en: "Default: backups/" },
    defaultValue: "",
    group: "backup",
  },

  // ─── Font Settings ────────────────────────────────────────────────
  font_family: {
    label: { ar: "نوع الخط العام", en: "Font Family" },
    hint: { ar: "الخط الأساسي لكل نصوص النظام — يؤثر على الواجهة بالكامل", en: "Primary font for all system text — affects the entire UI" },
    defaultValue: "Noto Sans Arabic",
    group: "appearance",
  },
  font_size: {
    label: { ar: "حجم النص العام", en: "Font Size" },
    hint: { ar: "حجم الخط الأساسي — يؤثر في كل عناصر الواجهة", en: "Base font size — affects all UI elements" },
    defaultValue: "normal",
    group: "appearance",
  },
  number_font_family: {
    label: { ar: "خط الأرقام", en: "Number Font" },
    hint: { ar: "خط مستقل للأرقام — يمكن أن يختلف عن خط النص العام", en: "Separate font for numbers — can differ from body font" },
    defaultValue: "Outfit",
    group: "appearance",
  },
  number_font_scale: {
    label: { ar: "حجم الأرقام (بالنسبة للنص العام)", en: "Number Scale" },
    hint: { ar: "نسبة حجم الأرقام مقارنة بحجم النص العام", en: "Number size ratio relative to body text" },
    defaultValue: "normal",
    group: "appearance",
  },
  numeral_style: {
    label: { ar: "نمط الأرقام", en: "Numeral Style" },
    hint: { ar: "أرقام غربية (0123) أو عربية (٠١٢٣)", en: "Western (0123) or Arabic-Indic (٠١٢٣) numerals" },
    defaultValue: "western",
    group: "appearance",
  },
  font_weight: {
    label: { ar: "وزن الخط", en: "Font Weight" },
    hint: { ar: "درجة ثخانة النص العام في النظام", en: "General text font weight" },
    defaultValue: 700,
    group: "appearance",
  },
  number_font_weight: {
    label: { ar: "وزن الأرقام", en: "Number Weight" },
    hint: { ar: "درجة ثخانة الأرقام في النظام", en: "Number font weight" },
    defaultValue: 700,
    group: "appearance",
  },

  // ─── Printing — Paper & Margins ───────────────────────────────────
  receipt_width: {
    label: { ar: "مقاس الورق الافتراضي", en: "Default Paper Size" },
    hint: { ar: "المقاس الافتراضي للمستندات المطبوعة — يُستخدم عند عدم تحديد مقاس لكل نوع مستند", en: "Default paper size for printed documents" },
    defaultValue: "80mm",
    group: "printing",
  },
  margin_top: {
    label: { ar: "هامش علوي", en: "Top Margin" },
    hint: { ar: "المسافة الفارغة من أعلى الصفحة قبل بداية المحتوى", en: "Blank space at the top of the page before content" },
    defaultValue: 4,
    group: "printing",
  },
  margin_side: {
    label: { ar: "هامش جانبي", en: "Side Margin" },
    hint: { ar: "المسافة الفارغة من يمين ويسار الصفحة", en: "Blank space on the left and right sides" },
    defaultValue: 4,
    group: "printing",
  },
  accent_color: {
    label: { ar: "لون النظام", en: "Accent Color" },
    hint: { ar: "لون رؤوس الجداول والفواصل والعناوين في المستندات المطبوعة", en: "Color for table headers, separators, and titles" },
    defaultValue: "#0f172a",
    group: "printing",
  },
  qr_size: {
    label: { ar: "حجم رمز QR", en: "QR Code Size" },
    hint: { ar: "أبعاد رمز QR بالبكسل — يظهر في أسفل الإيصال أو الفاتورة", en: "QR code dimensions in pixels — shown at the bottom" },
    defaultValue: 44,
    group: "printing",
  },

  // ─── Printing — Prefixes ──────────────────────────────────────────
  invoice_prefix: {
    label: { ar: "بادئة فاتورة المبيعات", en: "Sales Invoice Prefix" },
    hint: { ar: "الحروف التي تسبق رقم الفاتورة — مثال: INV-0001", en: "Letters preceding the invoice number — e.g. INV-0001" },
    placeholder: { ar: "مثال: INV", en: "e.g. INV" },
    defaultValue: "INV",
    group: "printing",
  },
  purchase_prefix: {
    label: { ar: "بادئة أمر الشراء", en: "Purchase Order Prefix" },
    hint: { ar: "الحروف التي تسبق رقم أمر الشراء", en: "Letters preceding the purchase order number" },
    placeholder: { ar: "مثال: PO", en: "e.g. PO" },
    defaultValue: "PO",
    group: "printing",
  },
  return_prefix: {
    label: { ar: "بادئة مذكرة الإرجاع", en: "Return Note Prefix" },
    hint: { ar: "الحروف التي تسبق رقم مرتجع المبيعات أو المشتريات", en: "Letters preceding return note numbers" },
    placeholder: { ar: "مثال: RET", en: "e.g. RET" },
    defaultValue: "RET",
    group: "printing",
  },
  work_order_prefix: {
    label: { ar: "بادئة أمر العمل", en: "Work Order Prefix" },
    hint: { ar: "الحروف التي تسبق رقم أمر العمل", en: "Letters preceding work order numbers" },
    placeholder: { ar: "مثال: WO", en: "e.g. WO" },
    defaultValue: "WO",
    group: "printing",
  },
  receipt_prefix: {
    label: { ar: "بادئة إيصال الاستلام", en: "Receipt Prefix" },
    hint: { ar: "الحروف التي تسبق رقم إيصال الاستلام", en: "Letters preceding receipt numbers" },
    placeholder: { ar: "مثال: REC", en: "e.g. REC" },
    defaultValue: "REC",
    group: "printing",
  },

  // ─── Printing — Texts ─────────────────────────────────────────────
  receipt_header: {
    label: { ar: "نص الرأس الترحيبي", en: "Header Greeting" },
    hint: { ar: "نص يظهر أعلى كل مستند مطبوع — أسفل اسم الشركة", en: "Text shown at the top of every printed document" },
    placeholder: { ar: "مثال: أهلاً وسهلاً بكم", en: "e.g. Welcome" },
    defaultValue: "أهلاً وسهلاً بكم",
    group: "printing",
  },
  receipt_footer: {
    label: { ar: "نص التذييل", en: "Footer Text" },
    hint: { ar: "نص يظهر في أسفل كل مستند مطبوع — غالباً رسالة شكر", en: "Text at the bottom — typically a thank you message" },
    placeholder: { ar: "مثال: شكراً لزيارتكم", en: "e.g. Thank you for your visit" },
    defaultValue: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
    group: "printing",
  },

  // ─── Printing — Typography ────────────────────────────────────────
  print_font: {
    label: { ar: "خط الطباعة", en: "Print Font" },
    hint: { ar: "الخط المستخدم في المستندات المطبوعة — يؤثر على كل المقاسات", en: "Font used in all printed documents" },
    defaultValue: "Noto Sans Arabic",
    group: "printing",
  },
  header_font_size: {
    label: { ar: "حجم خط اسم الشركة", en: "Company Name Font Size" },
    hint: { ar: "حجم الخط المستخدم لاسم الشركة في رأس المستند", en: "Font size for the company name in the header" },
    defaultValue: 16,
    group: "printing",
  },
  body_font_size: {
    label: { ar: "حجم خط الجسم", en: "Body Font Size" },
    hint: { ar: "حجم الخط الافتراضي لنصوص الفاتورة", en: "Default font size for invoice body text" },
    defaultValue: 13,
    group: "printing",
  },
  footer_font_size: {
    label: { ar: "حجم خط التذييل", en: "Footer Font Size" },
    hint: { ar: "حجم الخط المستخدم في تذييل المستند", en: "Font size for the document footer" },
    defaultValue: 11,
    group: "printing",
  },
  item_font_size: {
    label: { ar: "حجم خط الأصناف", en: "Item Font Size" },
    hint: { ar: "حجم الخط المستخدم لجدول الأصناف في الفاتورة", en: "Font size for the items table in invoices" },
    defaultValue: 13,
    group: "printing",
  },
  logo_max_height: {
    label: { ar: "أقصى ارتفاع للشعار", en: "Max Logo Height" },
    hint: { ar: "الحد الأقصى لارتفاع الشعار بالبكسل في المستندات المطبوعة", en: "Maximum logo height in pixels in printed documents" },
    defaultValue: 48,
    group: "printing",
  },
  logo_alignment: {
    label: { ar: "محاذاة الشعار", en: "Logo Alignment" },
    hint: { ar: "جهة محاذاة الشعار في رأس المستند — وسط أو يمين أو يسار", en: "Logo alignment direction in the header" },
    defaultValue: "center",
    group: "printing",
  },

  // ─── Printing — Address / Tax ID ──────────────────────────────────
  address_position: {
    label: { ar: "موضع العنوان", en: "Address Position" },
    hint: { ar: "مكان ظهور العنوان والهاتف — في الرأس أو أسفل المستند", en: "Where address & phone appear — top or bottom" },
    defaultValue: "top",
    group: "printing",
  },
  address_font_size: {
    label: { ar: "حجم خط العنوان", en: "Address Font Size" },
    hint: { ar: "حجم الخط المستخدم للعنوان والهاتف في الفاتورة", en: "Font size for address and phone on invoices" },
    defaultValue: 9,
    group: "printing",
  },
  address_alignment: {
    label: { ar: "محاذاة العنوان", en: "Address Alignment" },
    hint: { ar: "جهة محاذاة نص العنوان — يمين أو وسط أو يسار", en: "Address text alignment — right, center, or left" },
    defaultValue: "right",
    group: "printing",
  },
  tax_id_font_size: {
    label: { ar: "حجم خط الرقم الضريبي", en: "Tax ID Font Size" },
    hint: { ar: "حجم الخط المستخدم للرقم الضريبي في الفاتورة", en: "Font size for the tax ID number on invoices" },
    defaultValue: 9,
    group: "printing",
  },
  tax_id_alignment: {
    label: { ar: "محاذاة الرقم الضريبي", en: "Tax ID Alignment" },
    hint: { ar: "جهة محاذاة الرقم الضريبي — يمين أو وسط أو يسار", en: "Tax ID alignment — right, center, or left" },
    defaultValue: "right",
    group: "printing",
  },

  // ─── Printing — Visibility Toggles ────────────────────────────────
  show_logo: {
    label: { ar: "إظهار الشعار", en: "Show Logo" },
    hint: { ar: "عرض شعار الشركة في رأس المستند المطبوع", en: "Display company logo in the printed document header" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_branch: {
    label: { ar: "إظهار اسم الفرع", en: "Show Branch Name" },
    hint: { ar: "عرض اسم الفرع أسفل اسم الشركة", en: "Display branch name below company name" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_address: {
    label: { ar: "إظهار العنوان", en: "Show Address" },
    hint: { ar: "عرض عنوان الفرع في رأس المستند", en: "Display branch address in the document header" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_phone: {
    label: { ar: "إظهار الهاتف", en: "Show Phone" },
    hint: { ar: "عرض رقم هاتف الفرع للتواصل", en: "Display branch phone number for contact" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_tax_id: {
    label: { ar: "إظهار الرقم الضريبي", en: "Show Tax ID" },
    hint: { ar: "عرض رقم التسجيل الضريبي في أسفل المستند", en: "Display tax registration number at the bottom" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_invoice_date: {
    label: { ar: "إظهار التاريخ", en: "Show Date" },
    hint: { ar: "عرض تاريخ الفاتورة في المستند المطبوع", en: "Display the invoice date on the printed document" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_customer_name: {
    label: { ar: "إظهار اسم العميل", en: "Show Customer Name" },
    hint: { ar: "عرض اسم العميل في رأس الفاتورة", en: "Display customer name on the invoice" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_cashier_name: {
    label: { ar: "إظهار اسم الكاشير", en: "Show Cashier Name" },
    hint: { ar: "عرض اسم موظف المبيعات الذي أصدر الفاتورة", en: "Display the cashier who issued the invoice" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_subtotal: {
    label: { ar: "إظهار الإجمالي الفرعي", en: "Show Subtotal" },
    hint: { ar: "عرض المجموع الفرعي قبل الضريبة والخصم", en: "Display the subtotal before tax and discount" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_discount_line: {
    label: { ar: "إظهار سطر الخصم", en: "Show Discount Line" },
    hint: { ar: "عرض سطر منفصل لمبلغ الخصم على الفاتورة", en: "Display a separate line for the discount amount" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_tax: {
    label: { ar: "إظهار سطر الضريبة", en: "Show Tax Line" },
    hint: { ar: "عرض مبلغ الضريبة بشكل منفصل في الفاتورة", en: "Display the tax amount as a separate line" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_payment_details: {
    label: { ar: "إظهار تفاصيل الدفع", en: "Show Payment Details" },
    hint: { ar: "عرض طريقة الدفع والمبالغ المدفوعة والمتبقية", en: "Display payment method and paid/remaining amounts" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_notes: {
    label: { ar: "إظهار الملاحظات", en: "Show Notes" },
    hint: { ar: "عرض الملاحظات المسجلة على المستند", en: "Display notes recorded on the document" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_footer: {
    label: { ar: "إظهار التذييل", en: "Show Footer" },
    hint: { ar: "عرض رسالة التذييل (الشكر) في أسفل المستند", en: "Display the footer (thank you) at the bottom" },
    defaultValue: 1,
    group: "printing_visibility",
  },
  show_qr: {
    label: { ar: "إظهار رمز QR", en: "Show QR Code" },
    hint: { ar: "عرض رمز الاستجابة السريعة للتحقق في أسفل الفاتورة", en: "Display verification QR code at the bottom" },
    defaultValue: 0,
    group: "printing_visibility",
  },
  qr_alignment: {
    label: { ar: "محاذاة رمز QR", en: "QR Code Alignment" },
    hint: { ar: "محاذاة رمز QR في أسفل المستند — يمين أو وسَط أو يسار", en: "QR code alignment at the bottom of the document" },
    defaultValue: "right",
    group: "printing",
  },
  qr_content: {
    label: { ar: "محتوى رمز QR", en: "QR Code Content" },
    hint: { ar: "رابط أو نص مخصص لترميزه في QR — اتركه فارغاً لاستخدام بيانات الفاتورة تلقائياً", en: "Custom URL or text to encode in the QR — leave empty for auto invoice data" },
    defaultValue: "",
    group: "printing",
  },
  show_barcode_line: {
    label: { ar: "إظهار باركود المنتج", en: "Show Product Barcode" },
    hint: { ar: "عرض رمز الباركود لكل صنف في جدول الأصناف", en: "Display barcode for each item in the items table" },
    defaultValue: 0,
    group: "printing_visibility",
  },
  show_item_code: {
    label: { ar: "إظهار كود المنتج", en: "Show Item Code (SKU)" },
    hint: { ar: "عرض كود الصنف في جدول الأصناف في المستندات المطبوعة", en: "Display item SKU code in the items table" },
    defaultValue: 1,
    group: "printing_visibility",
  },

  // ─── WhatsApp ─────────────────────────────────────────────────────
  wa_status: {
    label: { ar: "حالة اتصال واتساب", en: "WhatsApp Connection Status" },
    hint: { ar: "حالة ربط حساب واتساب التجاري — يتطلب تشغيل التطبيق عبر Electron", en: "WhatsApp business account connection status — requires Electron" },
    defaultValue: "disconnected",
    group: "whatsapp",
  },
};

export function getMeta(key) {
  return FIELD_META[key] || null;
}

export function getDefault(key) {
  const m = FIELD_META[key];
  return m ? m.defaultValue : undefined;
}

export function getLabel(key, lang = "ar") {
  const m = FIELD_META[key];
  return m?.label?.[lang] || key;
}

export function getHint(key, lang = "ar") {
  const m = FIELD_META[key];
  return m?.hint?.[lang] || "";
}

export function getPlaceholder(key, lang = "ar") {
  const m = FIELD_META[key];
  return m?.placeholder?.[lang] || "";
}

export function getGroup(key) {
  const m = FIELD_META[key];
  return m?.group || "general";
}

const CRITICAL_KEYS = Object.entries(FIELD_META)
  .filter(([, meta]) => meta.critical)
  .map(([key]) => key);

export function getCriticalFields(lang = "ar") {
  return CRITICAL_KEYS.map((key) => {
    const meta = FIELD_META[key];
    return { key, label: meta?.label?.[lang] || key, hint: meta?.hint?.[lang] || "" };
  });
}

export function findMissingCritical(settings, lang = "ar") {
  const fields = getCriticalFields(lang);
  return fields.filter(({ key }) => {
    const val = settings[key];
    const meta = FIELD_META[key];
    if (val === undefined || val === null) return true;
    if (val === "") return true;
    if (meta && meta.defaultValue !== undefined && meta.defaultValue !== null && meta.defaultValue !== "") {
      if (val === meta.defaultValue) return true;
    }
    return false;
  });
}

const GROUP_TO_TAB = {
  branding: "identity",
  branch: "identity",
  official: "identity",
  address: "identity",
  financial: "financial",
  display: "general",
  alerts: "general",
  audit: "general",
  discount: "financial",
  margin: "financial",
  backup: "maintenance",
  appearance: "appearance",
  printing: "printing",
  printing_visibility: "printing",
  whatsapp: "whatsapp",
};

export function fieldKeyToTab(key) {
  const group = getGroup(key);
  return GROUP_TO_TAB[group] || "identity";
}

export default FIELD_META;
