// ── Client-side Reports Config ───────────────────────────────────────
// Hardcoded labels and data that were previously in the client-side
// reportsCenterConfig.js. Now served from the server as a single API call.

const SOURCE_LABELS = {
  sales: "المبيعات", purchases: "المشتريات", "purchase-returns": "مرتجعات المشتريات",
  "sales-returns": "مرتجعات المبيعات", suppliers: "الموردين", customers: "العملاء",
  employees: "الموظفين", users: "المستخدمين", installments: "أنظمة التقسيط",
  items: "الأصناف", warehouses: "المخازن", expenses: "المصروفات",
  revenues: "الإيرادات الأخرى", treasury: "الخزينة", "payment-flow": "سجل التدفقات المالية",
  "profit-loader": "مجمل ربح المبيعات", "net-profit": "صافي الربح", expiry: "انتهاء الصلاحية",
  cheques: "الشيكات والبنوك", "owner-statement": "لوحة صاحب المحل", tax: "الضرائب",
};

const CAT_LABELS = {
  sales: "المبيعات", purchases: "المشتريات", inventory: "المخزون",
  accounts: "الحسابات", treasury: "الخزينة والبنوك", tax: "الضرائب",
  profitability: "الأرباح", audit: "الأفراد والرقابة", users: "المستخدمين",
};

// Icon string names match lucide-react component names for client-side mapping
const SOURCE_ICONS = {
  sales: "TrendingUp", purchases: "Package", "purchase-returns": "RotateCcw",
  "sales-returns": "RotateCcw", suppliers: "Truck", customers: "Users",
  employees: "UserCheck", users: "Users", installments: "CalendarCheck",
  items: "Package", warehouses: "Layers", expenses: "Receipt",
  revenues: "TrendingUp", treasury: "Wallet", "payment-flow": "Wallet",
  "profit-loader": "Percent", "net-profit": "LineChart", expiry: "Clock",
  cheques: "Landmark", "owner-statement": "ClipboardCheck", tax: "Receipt",
};

const CAT_ICONS = {
  sales: "TrendingUp", purchases: "Package", inventory: "Layers",
  accounts: "Wallet", treasury: "Landmark", tax: "FileText",
  profitability: "BadgePercent", audit: "Shield", users: "Users",
};

const FORMAT_ICON_NAMES = {
  pdf: "FileImage", excel: "FileSpreadsheet", word: "FileText", print: "Printer",
};

