// Shared helpers for the backup / export / empty UI.

const desktopApi = () => window.retailerAPI || window.electronAPI || null;

export function isDesktop() {
  return Boolean(desktopApi()?.invoke);
}

// Open an OS folder picker (Electron). Returns the chosen path or null.
export async function pickFolder() {
  const api = desktopApi();
  if (!api?.invoke) return null;
  const res = await api.invoke("dialog:open-file", {
    title: "اختر مجلد حفظ النسخ الاحتياطية",
    properties: ["openDirectory", "createDirectory"],
  });
  if (res?.canceled || !res?.filePaths?.length) return null;
  return res.filePaths[0];
}

// Open an OS save dialog for the export .zip. Returns the chosen path or null.
export async function pickSavePath(defaultName) {
  const api = desktopApi();
  if (!api?.invoke) return null;
  const res = await api.invoke("dialog:save-file", {
    title: "حفظ ملف النسخة المصدَّرة",
    defaultPath: defaultName,
    filters: [{ name: "Retailer Backup", extensions: ["zip"] }],
  });
  if (res?.canceled || !res?.filePath) return null;
  return res.filePath;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(iso);
  }
}

export function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return String(iso);
  }
}

const MONTH_NAMES = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function monthLabel(mm) {
  return MONTH_NAMES[Number(mm)] || mm;
}

export const TRIGGER_META = {
  manual: { label: "يدوي", className: "bg-bg-overlay text-text-primary" },
  auto: { label: "تلقائي", className: "bg-sky-100 text-sky-700" },
  "pre-restore": { label: "أمان قبل استعادة", className: "bg-amber-100 text-amber-700" },
  "pre-empty": { label: "أمان قبل تفريغ", className: "bg-amber-100 text-amber-700" },
  legacy: { label: "قديمة (بدون صور)", className: "bg-rose-100 text-rose-700" },
};

export function triggerMeta(type) {
  return TRIGGER_META[type] || TRIGGER_META.manual;
}

const COUNT_LABELS = {
  items: "الأصناف",
  customers: "العملاء",
  suppliers: "الموردين",
  invoices: "الفواتير",
  invoice_lines: "بنود الفواتير",
  purchases: "المشتريات",
  purchase_orders: "طلبات التوريد",
  payments: "المدفوعات",
  shifts: "الورديات",
  stock_movements: "حركات المخزون",
  expenses: "المصروفات",
  revenues: "الإيرادات",
  quotations: "عروض الأسعار",
};

export function countLabel(key) {
  return COUNT_LABELS[key] || key;
}
