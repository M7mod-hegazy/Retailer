import { formatNumber } from "../../utils/currency";
import { todayCairo } from "../../utils/dateHelpers";

export { resolveImageUrl } from "../../utils/resolveImageUrl";

export function formatMoney(value) {
  return formatNumber(value, { decimals: 3 });
}

export function formatArabicDate(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function toDateInput(date = new Date()) {
  return todayCairo(date);
}

export const WALK_IN_CUSTOMER = { id: null, name: "عميل نقدي", phone: "", opening_balance: 0 };
export const DEFAULT_WAREHOUSE = { id: "default", name: "المخزن الرئيسي" };

export const PAYMENT_STATUS_LABELS = {
  paid:    { label: "مدفوع",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "جزئي",    cls: "bg-amber-50 text-amber-700 border-amber-200"    },
  unpaid:  { label: "آجل",     cls: "bg-rose-50 text-rose-700 border-rose-200"       },
  voided:  { label: "ملغي",    cls: "bg-slate-100 text-slate-500 border-slate-200"   },
};
