import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Loader2,
  Pencil,
  Printer,
  X,
  User,
  Calendar,
  Layers,
  Clock,
  Wallet,
  AlertCircle,
  FileText,
  DollarSign,
  Tag,
  Star,
  Copy,
  Check,
  Award,
  ShieldCheck,
  Activity,
  Barcode,
  Truck,
  Database,
  Layers3,
  TrendingUp,
  Percent,
  CheckCircle,
  TrendingDown,
  CornerDownLeft,
  AlertTriangle
} from "lucide-react";
import api from "../../services/api";
import { dateTime, money, PAYMENT_LABELS, REFUND_LABELS, SETTLEMENT_LABELS, statusBadge } from "./docHelpers";

const TITLE = {
  invoice: "فاتورة بيع",
  sales_return: "مرتجع مبيعات",
  purchase: "فاتورة شراء",
  purchase_return: "مرتجع مشتريات",
  branch_transfer: "تحويل فرع",
  opening_balance: "رصيد افتتاحي",
};

const CONFIG = {
  invoice: {
    endpoint: (id) => `/api/invoices/${id}`,
    full: (id) => `/invoices/${id}`,
    edit: (id) => `/invoices/${id}`,
    numberKey: "invoice_no",
    partyLabel: "العميل",
    partyKey: "customer_name",
    partyPhoneKey: "customer_phone",
    partyFallback: "عميل نقدي",
    totalKey: "total",
  },
  sales_return: {
    endpoint: (id) => `/api/invoices/returns/${id}`,
    full: (id) => `/pos/sales-returns/${id}`,
    edit: (id) => `/sales/returns/amend?id=${id}`,
    numberKey: "doc_no",
    partyLabel: "العميل",
    partyKey: "customer_name",
    partyPhoneKey: "customer_phone",
    partyFallback: "عميل نقدي",
    totalKey: "total",
  },
  purchase: {
    endpoint: (id) => `/api/purchases/${id}`,
    full: (id) => `/purchases/${id}`,
    edit: (id) => `/purchases/${id}`,
    numberKey: "doc_no",
    partyLabel: "المورد",
    partyKey: "supplier_name",
    partyPhoneKey: "supplier_phone",
    partyFallback: "مورد نقدي",
    totalKey: "total",
  },
  purchase_return: {
    endpoint: (id) => `/api/purchases/returns/${id}`,
    full: (id) => `/purchases/returns/${id}`,
    edit: (id) => `/purchases/returns/amend?id=${id}`,
    numberKey: "doc_no",
    partyLabel: "المورد",
    partyKey: "supplier_name",
    partyPhoneKey: "supplier_phone",
    partyFallback: "مورد نقدي",
    totalKey: "total",
  },
  branch_transfer: {
    endpoint: (id) => `/api/branch-transfers/${id}`,
    full: (id) => `/operations/branch-transfer/edit/${id}`,
    edit: (id) => `/operations/branch-transfer/edit/${id}`,
    numberKey: "reference_no",
    partyLabel: "الفرع المقابل",
    partyKey: "partner_branch",
    partyFallback: "—",
    totalKey: null,
  },
  opening_balance: {
    endpoint: (id) => `/api/purchases/${id}`,
    full: (id) => `/purchases/${id}`,
    edit: (id) => `/purchases/${id}`,
    numberKey: "doc_no",
    partyLabel: "المصدر",
    partyKey: "supplier_name",
    partyFallback: "رصيد افتتاحي",
    totalKey: "total",
  },
};

function normalizeLines(doc, docType, highlightItemId) {
  const rows = doc?.lines || doc?.items || [];
  const targetId = highlightItemId == null ? null : Number(highlightItemId);
  return rows.map((line, index) => {
    const quantity = Number(line.quantity || 0);
    const unit = Number(line.unit_price ?? line.unit_cost ?? line.selling_price ?? 0);
    return {
      id: line.id || index,
      item_id: line.item_id,
      code: line.item_code || line.code || line.barcode || "—",
      name: line.item_name || line.item_name_ar || line.name || "—",
      quantity,
      unit,
      total: Number(line.line_total ?? (quantity * unit)),
      note: docType === "branch_transfer" ? (line.warehouse_name || "") : "",
      highlighted: targetId != null && Number(line.item_id) === targetId,
    };
  });
}

function paymentRows(doc, docType) {
  const rows = [];

  if (docType === "sales_return" || docType === "purchase_return") {
    const cashAmt = Number(doc?.cash_amount || 0);
    const creditAmt = Number(doc?.credit_amount || 0);
    const refundMethod = doc?.refund_method || doc?.settlement_type;
    if (cashAmt > 0) {
      rows.push({
        id: "refund-cash",
        label: doc?.treasury_name ? `استرداد نقدي - ${doc.treasury_name}` : "استرداد نقدي",
        amount: cashAmt,
        tone: "emerald",
      });
    }
    if (creditAmt > 0) {
      const partyLabel = docType === "sales_return" ? "رصيد العميل" : "رصيد المورد";
      rows.push({
        id: "refund-credit",
        label: doc?.customer_name || doc?.supplier_name ? `${partyLabel} - ${doc.customer_name || doc.supplier_name}` : partyLabel,
        amount: creditAmt,
        tone: "indigo",
      });
    }
    if (!rows.length && refundMethod) {
      rows.push({
        id: "refund-method",
        label: SETTLEMENT_LABELS[refundMethod] || REFUND_LABELS[refundMethod] || refundMethod,
        amount: Number(doc?.total || 0),
        tone: "slate",
      });
    }
    return rows;
  }

  if (Array.isArray(doc?.payments) && doc.payments.length) {
    return doc.payments.map((payment, index) => ({
      id: index,
      label: payment.method_name || PAYMENT_LABELS[payment.method] || PAYMENT_LABELS[payment.method_type] || payment.method || payment.method_type || "—",
      amount: Number(payment.amount || 0),
      tone: "slate",
    }));
  }

  const type = doc?.payment_type || doc?.payment_method;
  const total = Number(doc?.total || 0);
  if (!type || total <= 0) return [];
  const paid = Number(doc?.amount_received || doc?.amount_paid || total);
  return [{ id: "single", label: PAYMENT_LABELS[type] || type, amount: paid, tone: "slate" }];
}

function extraNotes(doc, docType) {
  const notes = [];
  if (docType === "sales_return" && doc?.original_invoice_no) {
    notes.push({ label: "الفاتورة الأصلية", value: doc.original_invoice_no });
  }
  if (docType === "purchase_return" && doc?.original_purchase_no) {
    notes.push({ label: "فاتورة الشراء الأصلية", value: doc.original_purchase_no });
  }
  if (doc?.amendment_of_no) notes.push({ label: "تعديل لمستند", value: doc.amendment_of_no });
  if (doc?.amended_by_no) notes.push({ label: "تم تعديله بـ", value: doc.amended_by_no, tone: "amber" });
  if (doc?.reason) notes.push({ label: "السبب", value: doc.reason });
  if (doc?.cancel_reason) notes.push({ label: "سبب الإلغاء", value: doc.cancel_reason, tone: "rose" });
  if (doc?.notes) notes.push({ label: "ملاحظات", value: doc.notes });
  const debt = Number(doc?.debt_remaining || 0);
  if (debt > 0) notes.push({ label: "متبقي على الذمة", value: money(debt) + " ج.م", tone: "rose" });
  return notes;
}

function infoBarFields(doc, docType, config) {
  if (!doc || !config) return [];
  const fields = [];
  // Anonymous sale with a captured walk-in contact → show it as the party
  const isWalkIn = !doc[config.partyKey] && config.partyKey === "customer_name" && doc.walk_in_phone;
  const party = doc[config.partyKey] || (isWalkIn ? `🚶 عميل نقدي${doc.walk_in_name ? ` — ${doc.walk_in_name}` : ""}` : config.partyFallback);
  const phone = (config.partyPhoneKey ? doc[config.partyPhoneKey] : null) || (isWalkIn ? doc.walk_in_phone : null);
  fields.push({ label: config.partyLabel, value: phone ? `${party} • ${phone}` : party, icon: User });
  fields.push({ label: "التاريخ", value: doc.created_at ? dateTime(doc.created_at).split(" -")[0] : "—", icon: Calendar });
  fields.push({
    label: "بواسطة",
    value: doc.created_by_name || doc.created_by_username || doc.seller_name || doc.seller_username || "—",
    icon: Clock
  });
  if (docType === "branch_transfer") {
    fields.push({ label: "نوع التحويل", value: doc.type === "receive" ? "استلام" : doc.type === "send" ? "إرسال" : doc.type || "—", icon: Tag });
    if (doc.from_warehouse_name) fields.push({ label: "من مخزن", value: doc.from_warehouse_name, icon: Layers });
    if (doc.to_warehouse_name) fields.push({ label: "إلى مخزن", value: doc.to_warehouse_name, icon: Layers });
  } else if (doc.shift_number) {
    fields.push({ label: "الوردية", value: `#${doc.shift_number}`, icon: Tag });
  }
  return fields;
}

function financialBreakdown(doc, docType) {
  if (!doc || docType === "branch_transfer") return [];
  const out = [];
  const discount = Number(doc.discount || 0);
  const increase = Number(doc.increase || 0);
  const taxAmount = Number(doc.tax_amount || 0);
  const total = Number(doc.total || 0);
  // Some documents (e.g. purchases) don't persist a subtotal — derive the
  // pre-adjustment total so the "before → after" flow always renders when a
  // discount/increase is applied.
  const rawSubtotal = Number(doc.subtotal || 0);
  const subtotal = rawSubtotal > 0 ? rawSubtotal : (total + discount - increase);
  if ((discount > 0 || increase > 0) && subtotal !== total) out.push({ label: "المجموع قبل الخصم/الزيادة", value: money(subtotal) });
  if (discount > 0) out.push({ label: "خصم الفاتورة", value: money(discount), tone: "amber" });
  if (increase > 0) out.push({ label: "زيادة الفاتورة", value: money(increase) });
  if (taxAmount > 0) out.push({ label: `ضريبة (${doc.tax_rate || 0}%)`, value: money(taxAmount), tone: "indigo" });
  if (out.length) out.push({ label: "الإجمالي النهائي", value: money(total), tone: "indigo" });
  return out;
}

const TONE_CLASSES = {
  emerald: "border-emerald-100 bg-emerald-50/40 text-emerald-800",
  indigo: "border-indigo-100 bg-indigo-50/40 text-indigo-800",
  rose: "border-rose-100 bg-rose-50/40 text-rose-700",
  slate: "border-slate-200 bg-slate-50/40 text-slate-800",
  amber: "border-amber-100 bg-amber-50/40 text-amber-800",
};

export default function DocumentPreviewModal({ open, docType, docId, highlightItemId, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = CONFIG[docType];

  useEffect(() => {
    if (!open || !config || !docId) return;
    setLoading(true);
    setDoc(null);
    setCopied(false);
    api.get(config.endpoint(docId))
      .then((res) => setDoc(res.data?.data || res.data || null))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [open, config, docId]);

  const lines = useMemo(() => normalizeLines(doc, docType, highlightItemId), [doc, docType, highlightItemId]);
  const payments = useMemo(() => paymentRows(doc, docType), [doc, docType]);
  const notes = useMemo(() => extraNotes(doc, docType), [doc, docType]);
  const infoFields = useMemo(() => infoBarFields(doc, docType, config), [doc, docType, config]);
  const breakdown = useMemo(() => financialBreakdown(doc, docType), [doc, docType]);

  if (!open || !config) return null;

  const docNo = doc?.[config.numberKey] || `#${docId}`;
  const total = config.totalKey ? Number(doc?.[config.totalKey] || 0) : lines.reduce((sum, line) => sum + line.total, 0);
  const status = doc?.status || (doc?.cancelled_at ? "cancelled" : "active");
  const statusInfo = statusBadge(status, "active");
  const paymentType = doc?.payment_type || doc?.payment_method;
  const refundType = doc?.refund_method || doc?.settlement_type;
  const docTitle = TITLE[docType] || "مستند";

  const handleCopy = () => {
    navigator.clipboard.writeText(docNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25 } },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 15 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
    exit: { opacity: 0, scale: 0.96, y: 15, transition: { duration: 0.18 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 18 } }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-xl p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-[2.5rem] bg-white border border-white/60 shadow-2xl overflow-hidden z-[200] font-sans"
          dir="rtl"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50/50 sticky top-0 z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-[11px] font-black text-white uppercase tracking-wider shadow-[0_2px_8px_rgba(15,23,42,0.15)]">
                  <FileText size={11} className="text-slate-300" /> {docTitle}
                </span>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-black ${statusInfo.cls}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-2.5 mt-1.5">
                <h2 className="font-mono text-xl font-black text-slate-800 tracking-tight leading-none" dir="ltr">
                  {docNo}
                </h2>
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-100 rounded-lg transition-all active:scale-90 flex items-center gap-1 text-[9px] font-bold"
                  title="نسخ رقم المستند"
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copied ? "تم النسخ!" : "نسخ"}</span>
                </button>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-20 text-slate-400">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
              <span className="text-xs font-black">جاري تحميل مستندات الأرشيف...</span>
            </div>
          ) : !doc ? (
            <div className="p-20 text-center text-xs font-black text-slate-400">
              تعذر تحميل وثيقة المستند المحددة
            </div>
          ) : (
            /* Split Panel Workspace Layout */
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 flex-1 overflow-auto p-6 bg-slate-50/20 scrollbar-thin">
              
              {/* Column 1: Thermal Receipt Card Mockup with CSS Jagged Torn Edges (Right Column in RTL) */}
              <div className="lg:col-span-1 flex flex-col justify-start">
                
                {/* 1. SALES SUPERMARKET RECEIPT MOCKUP (invoice) */}
                {docType === "invoice" && (
                  <div 
                    className="bg-[var(--bg-surface)] border-x border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(0,0,0,0.025),inset_0_1px_3px_white] relative flex flex-col min-h-[460px] overflow-hidden select-none"
                    style={{
                      clipPath: "polygon(0% 0%, 2.5% 1.5%, 5% 0%, 7.5% 1.5%, 10% 0%, 12.5% 1.5%, 15% 0%, 17.5% 1.5%, 20% 0%, 22.5% 1.5%, 25% 0%, 27.5% 1.5%, 30% 0%, 32.5% 1.5%, 35% 0%, 37.5% 1.5%, 40% 0%, 42.5% 1.5%, 45% 0%, 47.5% 1.5%, 50% 0%, 52.5% 1.5%, 55% 0%, 57.5% 1.5%, 60% 0%, 62.5% 1.5%, 65% 0%, 67.5% 1.5%, 70% 0%, 72.5% 1.5%, 75% 0%, 77.5% 1.5%, 80% 0%, 82.5% 1.5%, 85% 0%, 87.5% 1.5%, 90% 0%, 92.5% 1.5%, 95% 0%, 97.5% 1.5%, 100% 0%, 100% 100%, 97.5% 98.5%, 95% 100%, 92.5% 98.5%, 90% 100%, 87.5% 98.5%, 85% 100%, 82.5% 98.5%, 80% 100%, 77.5% 98.5%, 75% 100%, 72.5% 98.5%, 70% 100%, 67.5% 98.5%, 65% 100%, 62.5% 98.5%, 60% 100%, 57.5% 98.5%, 55% 100%, 52.5% 98.5%, 50% 100%, 47.5% 98.5%, 45% 100%, 42.5% 98.5%, 40% 100%, 37.5% 98.5%, 35% 100%, 32.5% 98.5%, 30% 100%, 27.5% 98.5%, 25% 100%, 22.5% 98.5%, 20% 100%, 17.5% 98.5%, 15% 100%, 12.5% 98.5%, 10% 100%, 7.5% 98.5%, 5% 100%, 2.5% 98.5%, 0% 100%)",
                    }}
                  >
                    {/* Emerald top header banner inside torn ticket to clearly signify sales */}
                    <div className="bg-emerald-600 text-white text-center py-3 font-black text-xs relative select-none uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5">
                      <CheckCircle size={13} /> فاتورة مبيعات معتمدة
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/[0.03] border-4 border-dashed border-emerald-500/10 rounded-full flex items-center justify-center pointer-events-none select-none">
                        <span className="text-emerald-500/10 text-[11px] font-black uppercase tracking-widest rotate-[-25deg]">مبيعات معتمدة</span>
                      </div>

                      <div className="text-center pb-4 border-b border-dashed border-[#dfd6be] relative z-10">
                        <h3 className="text-xs font-black text-slate-800 tracking-wide">شركة الحجاز لتجارة التجزئة</h3>
                        <p className="text-[9px] font-bold text-slate-400 mt-1">وثيقة تشغيلية رسمية معتمدة</p>
                      </div>

                      <div className="flex-1 py-4 space-y-3 relative z-10">
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-400 tracking-wider pb-1.5 border-b border-[#ece2c9] px-1">
                          <span>الصنف والبيان</span>
                          <div className="flex gap-7">
                            <span>الكمية</span>
                            <span>السعر</span>
                            <span>الإجمالي</span>
                          </div>
                        </div>

                        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="divide-y divide-[#ece2c9]/40">
                          {lines.map((line) => (
                            <motion.div variants={staggerItem} key={line.id} className={`flex items-center justify-between py-2.5 text-xs ${line.highlighted ? "bg-emerald-50/50 px-2 rounded-xl border border-emerald-200/20" : "px-1"}`}>
                              <div className="flex flex-col gap-0.5 max-w-[170px]">
                                <span className="font-black text-slate-700 block truncate">
                                  {line.highlighted && <Star size={11} className="text-emerald-500 fill-emerald-500 inline-block mr-1 shrink-0 animate-pulse" />}
                                  {line.name}
                                </span>
                                <span className="font-mono text-[9px] text-slate-400 block" dir="ltr">{line.code}</span>
                              </div>
                              <div className="flex items-center gap-7 font-mono text-slate-600 font-bold">
                                <span className="w-10 text-left">{money(line.quantity)}</span>
                                <span className="w-12 text-left">{money(line.unit)}</span>
                                <span className="w-14 text-left font-black text-slate-800">{money(line.total)}</span>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>

                      <div className="pt-4 border-t border-dashed border-[#dfd6be] space-y-2 relative z-10 px-1">
                        {breakdown.map((row, idx) => (
                          <div key={idx} className="flex justify-between text-xs font-bold text-slate-500">
                            <span>{row.label}</span>
                            <span className="font-mono text-slate-700">{row.value} ج.م</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-baseline pt-2 border-t border-[#efe8d5]">
                          <span className="text-xs font-black text-slate-800">صافي المدفوع</span>
                          <div className="flex items-baseline gap-0.5">
                            <span className="font-mono text-2xl font-black text-emerald-600">{money(total)}</span>
                            <span className="text-[11px] font-sans font-bold text-emerald-550">ج.م</span>
                          </div>
                        </div>
                      </div>

                      {/* Barcode representation */}
                      <div className="mt-5 pt-4 border-t border-[#dfd6be] flex flex-col items-center justify-center relative z-10">
                        <svg className="w-44 h-8 opacity-75" viewBox="0 0 100 30" preserveAspectRatio="none">
                          <rect x="0" y="0" width="3" height="30" fill="black" />
                          <rect x="5" y="0" width="1" height="30" fill="black" />
                          <rect x="8" y="0" width="4" height="30" fill="black" />
                          {Array.from(String(docNo)).map((c, i) => (
                            <rect key={i} x={15 + i * 5} y="0" width={(c.charCodeAt(0) % 2) + 1} height="30" fill="black" />
                          ))}
                          <rect x="92" y="0" width="2" height="30" fill="black" />
                          <rect x="96" y="0" width="3" height="30" fill="black" />
                        </svg>
                        <span className="text-[8px] font-mono font-bold text-slate-400 mt-2 uppercase tracking-widest">*{docNo}*</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PURCHASES CORPORATE INVOICE TEMPLATE (purchase) */}
                {docType === "purchase" && (
                  <div className="bg-[var(--info-bg)] border border-blue-200 rounded-[2.5rem] shadow-[0_8px_30px_rgba(59,130,246,0.03)] relative flex flex-col min-h-[460px] overflow-hidden p-0">
                    {/* Blue corporate voucher top banner to clearly distinguish purchases */}
                    <div className="bg-blue-600 text-white py-3 px-5 font-black text-xs flex justify-between items-center select-none uppercase tracking-wider shadow-sm">
                      <span className="flex items-center gap-1.5"><Layers3 size={13} /> فاتورة شراء وتوريد معتمدة</span>
                      <span className="font-mono opacity-85">SUPPLIER INVOICE</span>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/[0.02] border-4 border-dashed border-blue-500/10 rounded-full flex items-center justify-center pointer-events-none select-none">
                        <span className="text-blue-500/10 text-[11px] font-black uppercase tracking-widest rotate-[-25deg]">توريد مشتريات</span>
                      </div>

                      <div className="flex-1 py-2 space-y-3 relative z-10">
                        <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5 flex justify-between items-center text-xs font-bold text-slate-600">
                          <span>المورد الحالي: <strong className="text-blue-800 font-sans">{doc.supplier_name || "مورد نقدي"}</strong></span>
                          <span>رقم الحساب: <strong className="font-mono text-slate-700">#SUP-{doc.supplier_id || docId}</strong></span>
                        </div>

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-400 border-b border-blue-50 pb-1.5 px-1 uppercase tracking-wider">
                            <span>الصنف والبيان</span>
                            <span className="w-20 text-left">الكمية</span>
                            <span className="w-24 text-left">الإجمالي</span>
                          </div>

                          {lines.map((line) => (
                            <div key={line.id} className={`flex items-center justify-between py-2.5 text-xs border-b border-slate-50 ${line.highlighted ? "bg-blue-50/50 px-2 rounded-xl border border-blue-200/30" : "px-1"}`}>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-slate-700">{line.name}</span>
                                <span className="font-mono text-[9px] text-slate-400" dir="ltr">{line.code}</span>
                              </div>
                              <span className="w-20 text-left font-mono font-bold text-slate-600">{money(line.quantity)} وحدة</span>
                              <span className="w-24 text-left font-mono font-black text-slate-800">{money(line.total)} ج.م</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Received stamp for validation */}
                      <div className="pt-4 border-t border-blue-100 flex items-center justify-between relative z-10 mt-6">
                        <div className="border border-blue-300 bg-blue-50/50 rounded-xl p-2.5 max-w-[200px] text-right">
                          <span className="text-[8px] font-black text-blue-700 block uppercase tracking-wider mb-1">المراجعة والمطابقة</span>
                          <p className="text-[9px] font-bold text-blue-800 leading-normal">تم الفحص والاستلام ومطابقة جميع الكميات المذكورة بالمستند.</p>
                        </div>

                        <div className="text-left font-mono">
                          <span className="text-[11px] text-slate-400 block font-sans font-bold">إجمالي المشتريات</span>
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-xl font-black text-blue-700">{money(total)}</span>
                            <span className="text-[9px] font-sans font-bold text-blue-500">ج.م</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. SALES RETURNS WARNING MOCKUP (sales_return) */}
                {docType === "sales_return" && (
                  <div 
                    className="bg-[var(--bg-surface)] border-x border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(245,158,11,0.03)] relative flex flex-col min-h-[460px] overflow-hidden select-none p-0"
                    style={{
                      clipPath: "polygon(0% 0%, 2.5% 1.5%, 5% 0%, 7.5% 1.5%, 10% 0%, 12.5% 1.5%, 15% 0%, 17.5% 1.5%, 20% 0%, 22.5% 1.5%, 25% 0%, 27.5% 1.5%, 30% 0%, 32.5% 1.5%, 35% 0%, 37.5% 1.5%, 40% 0%, 42.5% 1.5%, 45% 0%, 47.5% 1.5%, 50% 0%, 52.5% 1.5%, 55% 0%, 57.5% 1.5%, 60% 0%, 62.5% 1.5%, 65% 0%, 67.5% 1.5%, 70% 0%, 72.5% 1.5%, 75% 0%, 77.5% 1.5%, 80% 0%, 82.5% 1.5%, 85% 0%, 87.5% 1.5%, 90% 0%, 92.5% 1.5%, 95% 0%, 97.5% 1.5%, 100% 0%, 100% 100%, 97.5% 98.5%, 95% 100%, 92.5% 98.5%, 90% 100%, 87.5% 98.5%, 85% 100%, 82.5% 98.5%, 80% 100%, 77.5% 98.5%, 75% 100%, 72.5% 98.5%, 70% 100%, 67.5% 98.5%, 65% 100%, 62.5% 98.5%, 60% 100%, 57.5% 98.5%, 55% 100%, 52.5% 98.5%, 50% 100%, 47.5% 98.5%, 45% 100%, 42.5% 98.5%, 40% 100%, 37.5% 98.5%, 35% 100%, 32.5% 98.5%, 30% 100%, 27.5% 98.5%, 25% 100%, 22.5% 98.5%, 20% 100%, 17.5% 98.5%, 15% 100%, 12.5% 98.5%, 10% 100%, 7.5% 98.5%, 5% 100%, 2.5% 98.5%, 0% 100%)",
                    }}
                  >
                    {/* Amber warning checkout header bar with diagonal warning stripes */}
                    <div className="bg-amber-500 text-slate-900 text-center py-3 font-black text-xs relative select-none uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5">
                      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,var(--text-primary),var(--text-primary)_10px,var(--bg-surface)_10px,var(--bg-surface)_20px)] pointer-events-none" />
                      <AlertCircle size={13} className="animate-spin-slow relative z-10" /> <span className="relative z-10">سند تسوية مرتجع المبيعات</span>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-500/[0.03] border-4 border-dashed border-amber-500/10 rounded-full flex items-center justify-center pointer-events-none select-none">
                        <span className="text-amber-500/10 text-[11px] font-black uppercase tracking-widest rotate-[-25deg]">مرتجع قيد التسوية</span>
                      </div>

                      <div className="flex-1 py-2 space-y-3 relative z-10">
                        {doc.original_invoice_no && (
                          <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-3 flex justify-between items-center text-xs font-bold text-amber-800">
                            <span>مرتجع عن الفاتورة الأصلية:</span>
                            <span className="font-mono text-amber-800 underline font-black">{doc.original_invoice_no}</span>
                          </div>
                        )}

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-400 border-b border-[#ece2c9] pb-1.5 px-1 uppercase tracking-wider">
                            <span>الصنف والبيان</span>
                            <div className="flex gap-7">
                              <span>الكمية</span>
                              <span>الإجمالي</span>
                            </div>
                          </div>

                          {lines.map((line) => (
                            <div key={line.id} className={`flex items-center justify-between py-2.5 text-xs border-b border-slate-50 ${line.highlighted ? "bg-amber-50/50 px-2 rounded-xl border border-amber-200/20" : "px-1"}`}>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-slate-700">{line.name}</span>
                                <span className="font-mono text-[9px] text-slate-400" dir="ltr">{line.code}</span>
                              </div>
                              <div className="flex items-center gap-7 font-mono text-slate-600 font-bold">
                                <span className="w-10 text-left">{money(line.quantity)}</span>
                                <span className="w-14 text-left text-slate-800">{money(line.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-dashed border-[#dfd6be] space-y-2 relative z-10 px-1 mt-6">
                        <div className="flex justify-between items-baseline pt-2">
                          <span className="text-xs font-black text-slate-800">إجمالي القيمة المستردة</span>
                          <div className="flex items-baseline gap-0.5">
                            <span className="font-mono text-2xl font-black text-amber-700">{money(total)}</span>
                            <span className="text-[11px] font-sans font-bold text-amber-500">ج.م</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. SUPPLIER DEBIT NOTE (purchase_return) */}
                {docType === "purchase_return" && (
                  <div className="bg-[var(--danger-bg)] border border-rose-200 rounded-[2.5rem] shadow-[0_8px_30px_rgba(239,68,68,0.03)] relative flex flex-col min-h-[460px] overflow-hidden p-0">
                    {/* Rose Caution Header bar with caution stripes for returns */}
                    <div className="bg-rose-600 text-white py-3 px-5 font-black text-xs flex justify-between items-center select-none uppercase tracking-wider shadow-sm relative">
                      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,var(--text-primary),var(--text-primary)_10px,var(--bg-surface)_10px,var(--bg-surface)_20px)] pointer-events-none" />
                      <span className="flex items-center gap-1.5 relative z-10"><AlertTriangle size={13} className="animate-bounce" /> إشعار مدين مرتجع مشتريات</span>
                      <span className="font-mono opacity-85 relative z-10">DEBIT NOTE</span>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-rose-500/[0.02] border-4 border-dashed border-rose-500/10 rounded-full flex items-center justify-center pointer-events-none select-none">
                        <span className="text-rose-500/10 text-[11px] font-black uppercase tracking-widest rotate-[-25deg]">مرتجع مورد</span>
                      </div>

                      <div className="flex-1 py-2 space-y-3 relative z-10">
                        {doc.original_purchase_no && (
                          <div className="bg-rose-50/30 border border-rose-100 rounded-xl p-3 flex justify-between items-center text-xs font-bold text-rose-800">
                            <span>عن فاتورة الشراء رقم:</span>
                            <span className="font-mono text-rose-800 underline font-black">{doc.original_purchase_no}</span>
                          </div>
                        )}

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-400 border-b border-rose-50 pb-1.5 px-1 uppercase tracking-wider">
                            <span>الصنف والبيان</span>
                            <span className="w-20 text-left">الكمية</span>
                            <span className="w-24 text-left">الإجمالي</span>
                          </div>

                          {lines.map((line) => (
                            <div key={line.id} className={`flex items-center justify-between py-2.5 text-xs border-b border-slate-50 ${line.highlighted ? "bg-rose-50/50 px-2 rounded-xl border border-rose-200/30" : "px-1"}`}>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-slate-700">{line.name}</span>
                                <span className="font-mono text-[9px] text-slate-400" dir="ltr">{line.code}</span>
                              </div>
                              <span className="w-20 text-left font-mono font-bold text-slate-600">{money(line.quantity)} وحدة</span>
                              <span className="w-24 text-left font-mono font-black text-slate-800">{money(line.total)} ج.م</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-rose-100 flex items-center justify-between relative z-10 mt-6">
                        <div className="border border-rose-300 bg-rose-50/50 rounded-xl p-2.5 max-w-[200px] text-right">
                          <span className="text-[8px] font-black text-rose-700 block uppercase tracking-wider mb-1">حالة التخفيض المالي</span>
                          <p className="text-[9px] font-bold text-rose-805 leading-normal">تم رد السلع للمورد وتم قيد القيمة الإجمالية تخفيضاً لحسابه المدين.</p>
                        </div>

                        <div className="text-left font-mono">
                          <span className="text-[11px] text-slate-400 block font-sans font-bold">قيمة الخصم المستحق</span>
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-xl font-black text-rose-700">{money(total)}</span>
                            <span className="text-[9px] font-sans font-bold text-rose-500">ج.م</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. BRANCH TRANSFERS LOGISTICS BILL (branch_transfer) */}
                {docType === "branch_transfer" && (
                  <div className="bg-[var(--info-bg)] border border-indigo-200 rounded-[2.5rem] shadow-[0_8px_30px_rgba(99,102,241,0.03)] relative flex flex-col min-h-[460px] overflow-hidden p-0">
                    {/* Indigo logistics header to clearly distinguish transfers */}
                    <div className="bg-indigo-600 text-white py-3 px-5 font-black text-xs flex justify-between items-center select-none uppercase tracking-wider shadow-sm">
                      <span className="flex items-center gap-1.5"><Truck size={13} className="animate-pulse" /> سند استلام وتحويل مخزني داخلي</span>
                      <span className="font-mono opacity-85">LOGISTICS DISPATCH</span>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/[0.02] border-4 border-dashed border-indigo-500/10 rounded-full flex items-center justify-center pointer-events-none select-none">
                        <span className="text-indigo-500/10 text-[11px] font-black uppercase tracking-widest rotate-[-25deg]">تحويل مخزني</span>
                      </div>

                      <div className="flex-1 py-2 space-y-4 relative z-10">
                        {/* Origin and destination warehouse map */}
                        <div className="bg-white border border-indigo-100/60 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-inner relative overflow-hidden">
                          <div className="absolute inset-0 opacity-[0.015] bg-[radial-gradient(var(--info-text)_1.5px,transparent_1.5px)] [background-size:12px_12px] pointer-events-none" />
                          
                          <div className="flex flex-col text-right z-10">
                            <span className="text-[8px] text-slate-400 font-bold block mb-0.5">من مخزن</span>
                            <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                              <Database size={11} className="text-indigo-500" />
                              {doc.from_warehouse_name || "الفرع الرئيسي"}
                            </span>
                          </div>

                          <div className="flex-1 flex items-center justify-center relative px-2 z-10">
                            <div className="h-0.5 bg-dashed bg-indigo-200 w-full relative flex items-center justify-center">
                              <span className="absolute bg-white px-2.5 py-0.5 text-[8px] font-black text-indigo-700 border border-indigo-200 rounded-lg shadow-sm">
                                شحنة محولة
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col text-left z-10">
                            <span className="text-[8px] text-slate-400 font-bold block mb-0.5">إلى مخزن</span>
                            <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                              <Database size={11} className="text-indigo-500" />
                              {doc.to_warehouse_name || doc.partner_branch || "الفرع المقابل"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-400 border-b border-indigo-200 pb-1.5 px-1 uppercase tracking-wider">
                            <span>الصنف والبيان</span>
                            <span className="w-24 text-left">الكمية المحولة</span>
                          </div>

                          {lines.map((line) => (
                            <div key={line.id} className={`flex items-center justify-between py-2.5 text-xs border-b border-slate-50 ${line.highlighted ? "bg-indigo-50/50 px-2 rounded-xl border border-indigo-200/30" : "px-1"}`}>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-slate-700">{line.name}</span>
                                <span className="font-mono text-[9px] text-slate-400" dir="ltr">{line.code}</span>
                              </div>
                              <span className="w-24 text-left font-mono font-black text-indigo-700">{money(line.quantity)} وحدة</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-indigo-100 flex items-center justify-between relative z-10 mt-6">
                        <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-2.5 text-right w-full">
                          <span className="text-[8px] font-black text-indigo-700 block uppercase tracking-wider mb-1">مسؤولية النقل والاستلام</span>
                          <div className="flex justify-between items-end mt-4">
                            <span className="text-[11px] font-bold text-slate-400">توقيع أمين المستودع: _____________________</span>
                            <span className="text-[11px] font-bold text-slate-400">تاريخ الاستلام الفعلي: _____________________</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. INITIAL BALANCE DOCUMENT SHEET (opening_balance) */}
                {docType === "opening_balance" && (
                  <div className="bg-[var(--bg-surface)] border border-slate-300 rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative flex flex-col min-h-[460px] overflow-hidden p-0">
                    {/* Slate setup balance header bar */}
                    <div className="bg-slate-700 text-white py-3 px-5 font-black text-xs flex justify-between items-center select-none uppercase tracking-wider shadow-sm">
                      <span className="flex items-center gap-1.5"><Database size={13} /> سند اعتماد رصيد افتتاحي تأسيسي</span>
                      <span className="font-mono opacity-85">INITIAL SETUP</span>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-slate-500/[0.02] border-4 border-dashed border-slate-500/10 rounded-full flex items-center justify-center pointer-events-none select-none">
                        <span className="text-slate-500/10 text-[11px] font-black uppercase tracking-widest rotate-[-25deg]">رصيد تأسيسي</span>
                      </div>

                      <div className="flex-1 py-2 space-y-3 relative z-10">
                        <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-3 flex justify-between items-center text-xs font-bold text-slate-600">
                          <span>أول رصيد للصنف لما اتسجل في النظام</span>
                          <span className="font-mono text-slate-500 font-black">جرد ابتدائي</span>
                        </div>

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-400 border-b border-slate-200 pb-1.5 px-1 uppercase tracking-wider">
                            <span>الصنف والبيان</span>
                            <span className="w-24 text-left">الكمية المسجلة</span>
                          </div>

                          {lines.map((line) => (
                            <div key={line.id} className="flex items-center justify-between py-2.5 text-xs border-b border-slate-50 px-1">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-slate-700">{line.name}</span>
                                <span className="font-mono text-[9px] text-slate-400" dir="ltr">{line.code}</span>
                              </div>
                              <span className="w-24 text-left font-mono font-black text-slate-800">{money(line.quantity)} وحدة</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between relative z-10 mt-6">
                        <div className="text-right">
                          <span className="text-[8px] font-black text-slate-500 block uppercase tracking-wider mb-1">الموافقة والاعتماد</span>
                          <p className="text-[9px] font-bold text-slate-400 leading-normal">تم إقرار الكميات المدخلة كرصيد افتتاحي لبداية السجل.</p>
                        </div>

                        <div className="text-left font-mono">
                          <span className="text-[11px] text-slate-400 block font-sans font-bold">القيمة التقديرية</span>
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-xl font-black text-slate-800">{money(total)}</span>
                            <span className="text-[9px] font-sans font-bold text-slate-500">ج.م</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Column 2: Financial Metadata Bento (Left Column in RTL) */}
              <div className="lg:col-span-1 space-y-4 flex flex-col justify-start">
                
                {/* Massive Total Pricing Bento Box */}
                {config.totalKey && (
                  <div className="rounded-[1.8rem] bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-[0_12px_24px_-10px_rgba(99,102,241,0.35)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full blur-2xl translate-x-8 -translate-y-8 pointer-events-none" />
                    <span className="text-[11px] font-black text-indigo-200 block mb-1 uppercase tracking-wider">الإجمالي المالي المعتمد</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-black tracking-tight" dir="ltr">
                        {money(total)}
                      </span>
                      <span className="text-sm font-bold text-indigo-100">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Bento Info Block Grid */}
                {infoFields.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {infoFields.map((field, index) => {
                      const Icon = field.icon || User;
                      return (
                        <div 
                          key={index} 
                          className="rounded-2xl border border-slate-200/60 bg-white p-4 flex items-center gap-3.5 hover:border-slate-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)]"
                        >
                          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl border border-slate-100">
                            <Icon size={16} className="stroke-[1.8]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">{field.label}</span>
                            <span className="text-xs font-black text-slate-700 block truncate">{field.value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Payment Methods Info boxes */}
                {(paymentType || refundType || Number(doc?.amount_received || 0) > 0) && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {refundType && (
                      <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/25 p-3.5 flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                          <Wallet size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold text-indigo-500 block">طريقة الرد</span>
                          <span className="text-[11px] font-black text-indigo-800 block truncate">{SETTLEMENT_LABELS[refundType] || REFUND_LABELS[refundType] || refundType}</span>
                        </div>
                      </div>
                    )}
                    {paymentType && (
                      <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/25 p-3.5 flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                          <Wallet size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold text-emerald-500 block">طريقة الدفع</span>
                          <span className="text-[11px] font-black text-emerald-800 block truncate">{PAYMENT_LABELS[paymentType] || paymentType}</span>
                        </div>
                      </div>
                    )}
                    {Number(doc?.amount_received || doc?.amount_paid || 0) > 0 && (
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
                        <div className="p-2 bg-slate-50 text-slate-500 rounded-lg border border-slate-100">
                          <DollarSign size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 block">المبلغ المدفوع</span>
                          <span className="font-mono text-xs font-black text-slate-800 block truncate" dir="ltr">
                            {money(doc.amount_received || doc.amount_paid)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Extra Audit alert notes */}
                {notes.length > 0 && (
                  <div className="space-y-2.5">
                    {notes.map((note, index) => (
                      <div key={index} className={`rounded-2xl border p-4 flex items-start gap-3.5 transition-colors ${TONE_CLASSES[note.tone] || TONE_CLASSES.slate}`}>
                        <div className="p-1.5 bg-white/80 rounded-lg border border-slate-200/10 text-slate-500 mt-0.5">
                          <AlertCircle size={14} />
                        </div>
                        <div className="flex-1">
                          <span className="text-[9px] font-bold opacity-80 block mb-0.5">{note.label}</span>
                          <span className="text-xs font-black leading-relaxed block">{note.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment Breakdown Details Grid */}
                {payments.length > 0 && (
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                    <div className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      {docType === "sales_return" || docType === "purchase_return" ? "تفاصيل رد المبالغ" : "تفاصيل استحقاقات الدفع"}
                    </div>
                    <div className="grid gap-2.5 grid-cols-2">
                      {payments.map((payment) => (
                        <div key={payment.id} className={`rounded-xl border p-3 flex items-center justify-between ${TONE_CLASSES[payment.tone] || TONE_CLASSES.slate}`}>
                          <span className="text-[11px] font-bold opacity-80">{payment.label}</span>
                          <span className="font-mono text-[11px] font-black" dir="ltr">
                            {money(payment.amount)} <span className="text-[9px] font-sans font-bold opacity-60 mr-0.5">ج.م</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/50 p-4 sticky bottom-0 z-10">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Link to={config.edit(docId)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4.5 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition-colors">
                <Pencil size={13} /> تعديل المستند
              </Link>
            </motion.div>
            <motion.div whileTap={{ scale: 0.96 }}>
              <Link to={config.full(docId)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4.5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <ExternalLink size={13} /> فتح كاملاً
              </Link>
            </motion.div>
            <motion.div whileTap={{ scale: 0.96 }}>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4.5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <Printer size={13} /> طباعة
              </button>
            </motion.div>
            <motion.button 
              whileTap={{ scale: 0.96 }}
              onClick={onClose} 
              className="btn-danger rounded-xl px-6 py-2.5 text-xs font-black transition-colors"
            >
              إغلاق نافذة العرض
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
