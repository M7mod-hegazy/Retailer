/** Shared quotation helpers — status labels, POS prefill, print payload */

export const QUOTATION_STATUS = {
  draft: {
    label: "مسودة",
    shortLabel: "مسودة",
    hint: "لم يُرسل للعميل بعد — ما زال قيد الإعداد",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
  sent: {
    label: "مُرسل للعميل",
    shortLabel: "مُرسل",
    hint: "أُرسل للعميل وبانتظار موافقته — لم يُحوَّل لفاتورة بيع بعد",
    cls: "bg-blue-50 text-blue-700 border-blue-100",
  },
  converted: {
    label: "تحوّل لبيع",
    shortLabel: "مُباع",
    hint: "تم تحويله إلى فاتورة بيع فعلية في نقطة البيع",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  expired: {
    label: "منتهي الصلاحية",
    shortLabel: "منتهي",
    hint: "انتهت صلاحية العرض دون تحويل لبيع",
    cls: "bg-rose-50 text-rose-700 border-rose-100",
  },
};

export const PAYMENT_TYPE_LABELS = {
  cash: "نقدي",
  bank_transfer: "بنك / فيزا",
  credit: "آجل",
  installments: "أقساط",
  multi: "متعدد",
};

export function formatQuotationNo(id) {
  return `QTN-${String(id || 0).padStart(5, "0")}`;
}

import { formatNumber } from "../../utils/currency";

export function formatMoney(v) {
  return formatNumber(v);
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG-u-nu-latn");
}

export function effectiveQuotationStatus(row) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (row.status !== "converted" && row.expires_at && new Date(row.expires_at) < today) {
    return "expired";
  }
  return row.status || "draft";
}

/** Build React Router state for opening POS from a quotation */
export function buildQuotationPosState(quotation) {
  return {
    from_quotation_id: quotation.id,
    prefill: {
      quotation_no: formatQuotationNo(quotation.id),
      quotation_created_at: quotation.created_at,
      quotation_expires_at: quotation.expires_at || null,
      customer_id: quotation.customer_id,
      customer_name: quotation.customer_name,
      payment_type: quotation.payment_type || "cash",
      discount: Number(quotation.decrease || 0),
      increase: Number(quotation.increase || 0),
      notes: quotation.notes || "",
      tax_enabled: quotation.tax_enabled,
      tax_rate: quotation.tax_rate,
      lines: (quotation.lines || []).map((l) => ({
        item_id: l.item_id,
        item_name: l.item_name,
        code: l.item_code || l.barcode || "",
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: Number(l.discount_amount || 0),
        warehouse_id: l.warehouse_id || null,
        unit_name: l.unit_name || "",
      })),
    },
  };
}

/** Build print preview document from quotation record or form state */
export function buildQuotationPrintDoc({ quotation, cart, customer, totals, expiresAt, notes, paymentType, editId }) {
  const lines = quotation?.lines || cart?.map((i) => ({
    item_code: i.code,
    item_name: i.name,
    quantity: i.qty,
    unit_price: i.price,
    discount_amount: i.discount,
    line_total: Math.max(0, Number(i.qty || 0) * Number(i.price || 0) - Number(i.discount || 0)),
    unit_name: i.unit_name,
  })) || [];

  const id = quotation?.id || editId;
  return {
    invoice_number: id ? formatQuotationNo(id) : "QTN-مسودة",
    invoice_no: id ? formatQuotationNo(id) : "QTN-مسودة",
    created_at: quotation?.created_at || new Date().toISOString(),
    customer_name: quotation?.customer_name || customer?.name || "—",
    expires_at: quotation?.expires_at || expiresAt || null,
    notes: quotation?.notes || notes || "",
    payment_type: quotation?.payment_type || paymentType || "cash",
    total: quotation?.total ?? totals?.total ?? 0,
    tax_amount: quotation?.tax_amount ?? totals?.taxAmount ?? 0,
    tax_rate: quotation?.tax_rate ?? totals?.taxRate ?? 0,
    lines: lines.map((l) => ({
      item_code: l.item_code || l.code,
      item_name: l.item_name || l.name,
      quantity: l.quantity ?? l.qty,
      unit_price: l.unit_price ?? l.price,
      discount_amount: l.discount_amount ?? l.discount ?? 0,
      line_total: l.line_total ?? Math.max(0, Number(l.quantity ?? l.qty ?? 0) * Number(l.unit_price ?? l.price ?? 0) - Number(l.discount_amount ?? l.discount ?? 0)),
      unit_name: l.unit_name || "",
    })),
  };
}
