// Static data for the Print Studio: doc-type catalog, paper geometry and the
// sample datasets the canvas renders. Pure data — no React.

export const PX_PER_MM = 3.7795;
export const SIZES = { roll: ["58mm", "80mm"], page: ["A5", "A4"] };
export const SHEET_W = { "58mm": "58mm", "80mm": "80mm", A5: "148mm", A4: "210mm" };
export const PAGE_H_MM = { A4: 297, A5: 210 };

export function familyOfSize(size) {
  return size === "58mm" || size === "80mm" ? "roll" : "page";
}

export function pageSizeStrFor(size) {
  return size === "58mm" ? "58mm auto"
    : size === "80mm" ? "80mm auto"
    : size === "A5" ? "148mm 210mm"
    : "210mm 297mm";
}

// Doc types that render through the block library (LayoutRenderer) and are
// therefore fully designable. The rest print via dedicated template
// components that only honor flat settings (fonts, header/footer, toggles).
export const BLOCK_DOCS = new Set([
  "pos_receipt", "sales_invoice", "purchase_order", "sales_return",
  "quotation", "branch_transfer", "purchase_return", "payment_receipt",
]);

// Scope catalog shown in the Studio switcher. `_global` is the shared design
// every doc type inherits unless it overrides a family layout.
export const STUDIO_SCOPES = [
  { key: "_global",                label: "التصميم العام",         group: "عام" },
  { key: "pos_receipt",            label: "إيصال نقطة البيع",      group: "مبيعات" },
  { key: "sales_invoice",          label: "فاتورة مبيعات",         group: "مبيعات" },
  { key: "sales_return",           label: "مرتجع مبيعات",          group: "مبيعات" },
  { key: "quotation",              label: "عرض سعر",               group: "مبيعات" },
  { key: "payment_receipt",        label: "إيصال دفع",             group: "مبيعات" },
  { key: "purchase_order",         label: "أمر شراء",              group: "مشتريات" },
  { key: "purchase_return",        label: "مرتجع مشتريات",         group: "مشتريات" },
  { key: "branch_transfer",        label: "تحويل فرع",             group: "مخزون" },
  { key: "bank_statement",         label: "كشف بنكي",              group: "تقارير" },
  { key: "ajal_statement",         label: "كشف آجل",               group: "تقارير" },
  { key: "ajal_schedule",          label: "جدول أقساط",            group: "تقارير" },
  { key: "ajal_full_statement",    label: "كشف حساب كامل",         group: "تقارير" },
  { key: "cheque_register",        label: "سجل شيكات",             group: "تقارير" },
  { key: "daily_treasury",         label: "تقرير الخزينة",         group: "تقارير" },
  { key: "payment_methods_report", label: "تقرير وسائل الدفع",     group: "تقارير" },
  { key: "reports_generic",        label: "قوالب تقارير (عام)",    group: "تقارير" },
];

export function scopeLabel(key) {
  return (STUDIO_SCOPES.find((s) => s.key === key) || {}).label || key;
}

// ── sample invoices for the canvas (block docs) ─────────────────────────────
const now = () => new Date().toISOString();

const NORMAL = {
  invoice_no: "INV-2026-0001",
  created_at: now(),
  customer_name: "عميل تجريبي",
  cashier_name: "الكاشير",
  lines: [
    { code: "K-100", item_name: "منتج تجريبي ١", quantity: 2, unit_price: 45 },
    { code: "K-200", item_name: "منتج تجريبي ٢", quantity: 1, unit_price: 120, discount_amount: 10 },
    { code: "K-300", item_name: "منتج تجريبي ٣", quantity: 3, unit_price: 15 },
  ],
  payments: [{ method_name: "نقدًا", amount: 245 }],
};

const STRESS = {
  ...NORMAL,
  customer_name: "عميل باسم طويل جداً لاختبار تجاوز العرض والالتفاف",
  lines: Array.from({ length: 30 }, (_, i) => ({
    code: `K-${100 + i}`,
    item_name: `منتج تجريبي رقم ${i + 1} باسم متوسط الطول`,
    quantity: (i % 4) + 1,
    unit_price: 10 + i * 3.5,
    discount_amount: i % 5 === 0 ? 5 : 0,
  })),
  payments: [{ method_name: "نقدًا", amount: 300 }, { method_name: "بطاقة", amount: 450 }],
};

const LONG_NAMES = {
  ...NORMAL,
  lines: [
    { code: "K-901", item_name: "جهاز تكييف سبليت انفرتر بارد فقط سعة واحد ونصف حصان موفر للطاقة", quantity: 1, unit_price: 14500 },
    { code: "K-902", item_name: "طقم أواني طهي من الستانلس ستيل المقاوم للصدأ مكوَّن من عشر قطع مع أغطية زجاجية", quantity: 2, unit_price: 890, discount_amount: 50 },
    { code: "K-903", item_name: "مكنسة كهربائية لاسلكية قابلة لإعادة الشحن مع ملحقات متعددة للأرضيات والسجاد", quantity: 1, unit_price: 2100 },
  ],
  payments: [{ method_name: "تحويل بنكي", amount: 18330 }],
};

export const SAMPLES = [
  { id: "normal", label: "بيانات عادية", data: NORMAL },
  { id: "stress", label: "٣٠ صنفاً", data: STRESS },
  { id: "long",   label: "أسماء طويلة", data: LONG_NAMES },
];

export function sampleById(id) {
  return (SAMPLES.find((s) => s.id === id) || SAMPLES[0]).data;
}

// ── mock data for template-rendered docs (reduced mode preview) ─────────────
export const TEMPLATE_MOCK = {
  bank_statement: {
    bank: { name: "البنك الأهلي", account_number: "SA00 0000 0000 0000 0000 0000", balance: 45500 },
    from: "2026-06-01", to: "2026-06-30",
    transactions: [
      { id: 1, created_at: now(), type: "deposit",  amount: 5000, note: "إيداع نقدي",   balance_after: 45500 },
      { id: 2, created_at: now(), type: "withdraw", amount: 1500, note: "سحب مصروفات", balance_after: 40500 },
      { id: 3, created_at: now(), type: "deposit",  amount: 12000, note: "تحصيل عميل", balance_after: 42000 },
    ],
  },
  ajal_statement: {
    debt: {
      customer_name: "محمد أحمد", original_amount: 5000, remaining: 3000, created_at: now(),
      payments: [
        { id: 1, payment_date: now(), method_name: "نقدي", amount: 1000 },
        { id: 2, payment_date: now(), method_name: "شبكة", amount: 1000 },
      ],
    },
  },
  ajal_schedule: {
    debt: {
      customer_name: "محمد أحمد", original_amount: 5000, remaining: 3000,
      schedule: [
        { id: 1, installment_no: 1, due_date: now(), amount: 1000, status: "paid" },
        { id: 2, installment_no: 2, due_date: new Date(Date.now() + 30 * 86400000).toISOString(), amount: 1000, status: "pending" },
        { id: 3, installment_no: 3, due_date: new Date(Date.now() + 60 * 86400000).toISOString(), amount: 1000, status: "pending" },
      ],
    },
  },
  cheque_register: {
    rows: [
      { id: 1, cheque_no: "CHQ-001", bank_name: "البنك الأهلي", drawer_name: "محمد سالم", due_date: now(), amount: 5000, status: "pending" },
      { id: 2, cheque_no: "CHQ-002", bank_name: "بنك مصر",      drawer_name: "أحمد علي",  due_date: now(), amount: 3500, status: "cleared" },
      { id: 3, cheque_no: "CHQ-003", bank_name: "البنك العربي", drawer_name: "سارة حسن",  due_date: now(), amount: 2000, status: "bounced" },
    ],
  },
  payment_methods_report: {
    rows: [
      { id: 1, doc_no: "INV-001", doc_type: "مبيعات",  amount: 1500, direction: "in",  party: "محمد أحمد", method_name: "نقدي", created_at: now() },
      { id: 2, doc_no: "INV-002", doc_type: "مبيعات",  amount: 2000, direction: "in",  party: "سالم علي",  method_name: "شبكة", created_at: now() },
      { id: 3, doc_no: "EXP-001", doc_type: "مصروفات", amount: 500,  direction: "out", party: "مورد",      method_name: "نقدي", created_at: now() },
    ],
    totalIn: 3500, totalOut: 500,
    filters: { from: "2026-06-01", to: "2026-06-30" },
  },
};

// Column catalog the items-table editor can add from. Keys must exist in
// ItemsTableBlock's VALUE map — anything else would silently render nothing.
export const COLUMN_CATALOG = [
  { key: "code",     label: "كود" },
  { key: "name",     label: "الصنف" },
  { key: "unit",     label: "الوحدة" },
  { key: "qty",      label: "كمية" },
  { key: "price",    label: "سعر" },
  { key: "discount", label: "الخصم" },
  { key: "total",    label: "إجمالي" },
];
