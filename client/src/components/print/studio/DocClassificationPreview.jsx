import React, { useState } from "react";
import {
  Receipt, FileText, FileBarChart2, Package, CreditCard, TrendingUp,
  ChevronDown, ChevronUp, ExternalLink, Printer
} from "lucide-react";

/**
 * Classification categories with their doc types and page references.
 * Maps each doc type to where it's used in the app.
 */
const CLASSIFICATIONS = [
  {
    id: "sales",
    label: "المبيعات",
    icon: Receipt,
    color: "#1e40af",
    items: [
      {
        key: "pos_receipt",
        label: "فاتورة مبيعات / إيصال نقطة البيع",
        pages: ["نقطة البيع (POS)", "سجل المبيعات"],
        description: "الفاتورة الأساسية الصادرة عند بيع المنتجات للعملاء",
      },
      {
        key: "sales_return",
        label: "مرتجع مبيعات",
        pages: ["مرتجع المبيعات"],
        description: "سند إرجاع البضاعة من العميل مع استرداد المبلغ",
      },
      {
        key: "quotation",
        label: "عرض سعر",
        pages: ["عروض الأسعار"],
        description: "عرض أسعار مسبق للعميل قبل إتمام البيع",
      },
      {
        key: "payment_receipt",
        label: "إيصال دفع",
        pages: ["السندات المالية"],
        description: "سند قبض أو صرف نقدي (يدوياً أو من شاشة الدفع)",
      },
    ],
  },
  {
    id: "purchases",
    label: "المشتريات",
    icon: FileBarChart2,
    color: "#059669",
    items: [
      {
        key: "purchase_order",
        label: "أمر شراء",
        pages: ["أوامر الشراء"],
        description: "طلب شراء رسمي يُرسل للمورد لتخزين البضائع",
      },
      {
        key: "purchase_return",
        label: "مرتجع مشتريات",
        pages: ["مرتجع المشتريات"],
        description: "إرجاع البضاعة للمورد واسترداد تكلفتها",
      },
    ],
  },
  {
    id: "inventory",
    label: "المخزون",
    icon: Package,
    color: "#7c3aed",
    items: [
      {
        key: "branch_transfer",
        label: "تحويل فرع",
        pages: ["تحويلات الفروع"],
        description: "سند نقل مخزني بين فروع الشركة",
      },
    ],
  },
  {
    id: "accounts",
    label: "الحسابات",
    icon: CreditCard,
    color: "#dc2626",
    items: [
      {
        key: "account_statement",
        label: "كشف حساب (عميل/مورد)",
        pages: ["حسابات العملاء", "حسابات الموردين"],
        description: "كشف حركات مالية شامل لعميل أو مورد معين",
      },
      {
        key: "ajal_statement",
        label: "كشف آجل (مديونية)",
        pages: ["الحسابات الآجلة"],
        description: "كشف مديونية عميل مع جدول السداد",
      },
      {
        key: "ajal_schedule",
        label: "جدول أقساط",
        pages: ["المبيعات الآجلة والأقساط"],
        description: "جدول تواريخ وأقساط دين محدد",
      },
      {
        key: "ajal_full_statement",
        label: "كشف حساب كامل",
        pages: ["تقرير الديون الشامل"],
        description: "سجل جميع الديون والأرصدة الآجلة لجميع العملاء",
      },
    ],
  },
  {
    id: "treasury",
    label: "الخزينة والمالية",
    icon: TrendingUp,
    color: "#d97706",
    items: [
      {
        key: "daily_treasury",
        label: "تقرير الخزينة اليومي",
        pages: ["حركة الخزينة اليومية"],
        description: "تقرير إغلاق يومي للصناديق والخزائن مع جرد النقد",
      },
      {
        key: "bank_statement",
        label: "كشف بنكي",
        pages: ["كشوف البنوك"],
        description: "كشف حركات حساب بنكي معين خلال فترة محددة",
      },
      {
        key: "cheque_register",
        label: "سجل شيكات",
        pages: ["شؤون الشيكات والأوراق المالية"],
        description: "سجل الشيكات الصادرة والواردة وتواريخ التحصيل",
      },
      {
        key: "payment_methods_report",
        label: "تقرير وسائل الدفع",
        pages: ["مبيعات وسائل الدفع"],
        description: "تحليل المقبوضات والمدفوعات حسب الوسيلة المالية",
      },
      {
        key: "owner_statement",
        label: "لوحة صاحب المحل",
        pages: ["لوحة صاحب المحل"],
        description: "كشف الإقفال المالي الشهري مع المؤشرات الأساسية",
      },
    ],
  },
  {
    id: "reports",
    label: "التقارير العامة",
    icon: FileText,
    color: "#0f172a",
    items: [
      {
        key: "reports_generic",
        label: "قوالب تقارير (عام)",
        pages: ["مركز التقارير", "قوائم المخزون", "جرد المستودعات"],
        description: "القالب الموحد لكافة تقارير النظام العامة",
      },
    ],
  },
];

function ClassificationCard({ cls, isOpen, onToggle, docSettings }) {
  const Icon = cls.icon;
  return (
    <div className="rounded-xl border border-[var(--border-normal)] overflow-hidden transition-all">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-input-hover)] transition-colors"
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white shrink-0"
          style={{ backgroundColor: cls.color }}
        >
          <Icon size={16} />
        </div>
        <div className="flex-1 text-right">
          <div className="text-sm font-black text-[var(--text-primary)]">{cls.label}</div>
          <div className="text-[10px] font-bold text-[var(--text-muted)]">
            {cls.items.length} مستندات
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cls.items.map((item) => {
            const hasSettings = !!docSettings[item.key];
            return (
              <div
                key={item.key}
                className={`h-2 w-2 rounded-full transition-colors ${
                  hasSettings ? "bg-success-text" : "bg-[var(--border-normal)]"
                }`}
                title={item.label}
              />
            );
          })}
          {isOpen ? (
            <ChevronUp size={16} className="text-[var(--text-muted)]" />
          ) : (
            <ChevronDown size={16} className="text-[var(--text-muted)]" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {isOpen && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {cls.items.map((item) => {
              const docCfg = docSettings[item.key] || {};
              return (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 hover:border-[var(--border-strong)] hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-[11px] font-black text-[var(--text-primary)] leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[9px] font-bold text-[var(--text-muted)] mt-1">
                        {item.description}
                      </div>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black leading-none"
                      style={{
                        backgroundColor: `${cls.color}15`,
                        color: cls.color,
                        border: `1px solid ${cls.color}30`,
                      }}
                    >
                      {docCfg.paper_size || "A4"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {item.pages.map((page) => (
                      <span
                        key={page}
                        className="inline-flex items-center gap-1 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[8px] font-bold text-[var(--text-muted)]"
                      >
                        <ExternalLink size={8} />
                        {page}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DocClassificationPreview — Shows a classification-based view of all doc types
 * with where each is used in the app.
 *
 * @param {Object} props
 * @param {Object} props.docSettings - Current per-doc settings from API
 */
export default function DocClassificationPreview({ docSettings = {} }) {
  const [openCls, setOpenCls] = useState(["sales"]);

  const toggleCls = (id) => {
    setOpenCls((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-2">
      {CLASSIFICATIONS.map((cls) => (
        <ClassificationCard
          key={cls.id}
          cls={cls}
          isOpen={openCls.includes(cls.id)}
          onToggle={() => toggleCls(cls.id)}
          docSettings={docSettings}
        />
      ))}
    </div>
  );
}

export { CLASSIFICATIONS };
