export const REPORT_SOURCES = [
  { id: "sales", label: "المبيعات" },
  { id: "purchases", label: "المشتريات" },
  { id: "purchase-returns", label: "مرتجعات المشتريات" },
  { id: "sales-returns", label: "مرتجعات المبيعات" },
  { id: "suppliers", label: "الموردين" },
  { id: "customers", label: "العملاء" },
  { id: "employees", label: "الموظفين" },
  { id: "users", label: "المستخدمين" },
  { id: "installments", label: "أنظمة التقسيط" },
  { id: "items", label: "الأصناف والمخزون" },
  { id: "warehouses", label: "المخازن" },
  { id: "expenses", label: "المصروفات" },
  { id: "revenues", label: "الإيرادات" },
  { id: "treasury", label: "الخزينة" },
  { id: "payment-flow", label: "سجل التدفقات المالية" },
  { id: "profit", label: "الأرباح" },
  { id: "expiry", label: "انتهاء الصلاحية" },
  { id: "owner-statement", label: "لوحة صاحب المحل" },
  { id: "tax", label: "الضرائب" },
];

export const REPORT_SOURCE_KEYS = REPORT_SOURCES.map(s => "report_" + s.id);
