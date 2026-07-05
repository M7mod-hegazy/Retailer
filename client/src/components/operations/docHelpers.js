export const PAYMENT_LABELS = {
  cash: "نقدي",
  credit: "آجل",
  card: "بطاقة",
  bank: "بنك",
  bank_transfer: "حوالة بنكية",
  wallet: "محفظة",
  installments: "أقساط",
  future_due: "استحقاق لاحق",
  multi: "متعدد",
};

export const STATUS_LABELS = {
  paid: "مدفوعة",
  partial: "جزئية",
  unpaid: "غير مدفوعة",
  active: "نشطة",
  cancelled: "ملغاة",
  voided: "ملغاة",
  locked: "مقفلة",
};

export const REFUND_LABELS = {
  cash_back: "رد نقدي",
  credit_note: "إشعار دائن",
  store_credit: "رصيد عميل",
  split: "رد مقسم",
  account: "على الحساب",
  cash: "نقدي",
  bank: "بنك",
};

export const SETTLEMENT_LABELS = {
  cash: "استرداد نقدي",
  account: "خصم من الحساب",
};

export const STATUS_CLASSES = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  unpaid: "bg-rose-50 text-rose-700 border-rose-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  voided: "bg-slate-100 text-slate-500 border-slate-200",
  locked: "bg-slate-100 text-slate-600 border-slate-200",
};

export function statusBadge(status, fallback = "active") {
  const key = STATUS_LABELS[status] ? status : fallback;
  return {
    label: STATUS_LABELS[status] || STATUS_LABELS[fallback] || status || "—",
    cls: STATUS_CLASSES[key] || STATUS_CLASSES[fallback] || "bg-slate-100 text-slate-600 border-slate-200",
  };
}

export function money(value) {
  return Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  } catch {
    return String(value).slice(0, 16);
  }
}
