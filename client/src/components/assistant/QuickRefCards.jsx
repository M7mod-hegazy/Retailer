import React, { useRef } from "react";
import { FileText, Printer } from "lucide-react";
import { printContent, getPrinterForPageSize } from "../../services/printService";

const QUICK_REFS = [
  {
    page: "/pos",
    titleAr: "نقطة البيع",
    titleEn: "POS",
    shortcuts: [
      { key: "F2", descAr: "بحث عن صنف", descEn: "Search item" },
      { key: "F4", descAr: "فتح شاشة الدفع", descEn: "Open payment" },
      { key: "F8", descAr: "تعليق الفاتورة", descEn: "Hold invoice" },
      { key: "Esc", descAr: "إلغاء آخر صنف", descEn: "Remove last item" },
    ],
  },
  {
    page: "/sales/returns",
    titleAr: "المرتجعات",
    titleEn: "Returns",
    shortcuts: [
      { key: "F2", descAr: "بحث عن فاتورة", descEn: "Search invoice" },
      { key: "Ctrl+N", descAr: "مرتجع جديد", descEn: "New return" },
    ],
  },
  {
    page: "/stock/levels",
    titleAr: "المخزون",
    titleEn: "Stock",
    shortcuts: [
      { key: "F2", descAr: "بحث عن صنف", descEn: "Search item" },
      { key: "Ctrl+E", descAr: "تصدير Excel", descEn: "Export Excel" },
    ],
  },
  {
    page: "/purchases/new",
    titleAr: "المشتريات",
    titleEn: "Purchases",
    shortcuts: [
      { key: "F2", descAr: "بحث عن مورد", descEn: "Search supplier" },
      { key: "F4", descAr: "حفظ الفاتورة", descEn: "Save invoice" },
    ],
  },
];

export default function QuickRefCards({ currentRoute, t }) {
  const refs = currentRoute
    ? QUICK_REFS.filter(r => currentRoute.startsWith(r.page))
    : QUICK_REFS;
  const contentRef = useRef(null);

  const handlePrint = () => {
    if (!contentRef.current) return;
    printContent({
      contentHtml: contentRef.current.innerHTML,
      pageSizeStr: "210mm 297mm",
      deviceName: getPrinterForPageSize("210mm 297mm"),
      docType: "_global",
      docLabel: "بطاقات الاختصارات",
    });
  };

  if (refs.length === 0) {
    return (
      <div className="rounded-2xl border p-3 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
        <FileText className="mx-auto h-5 w-5 mb-1" style={{ color: "var(--text-muted)" }} />
        <p className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
          {t?.("quickRef.noShortcuts") || "لا يوجد اختصارات مسجلة لهذه الصفحة"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          <FileText className="inline h-3 w-3 ml-1" /> {t?.("quickRef.title") || "بطاقات الاختصارات"}
        </span>
        <button onClick={handlePrint}
          className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
          <Printer className="h-3 w-3" /> {t?.("quickRef.print") || "طباعة"}
        </button>
      </div>

      <div ref={contentRef}>
      {refs.map(ref => (
        <div key={ref.page}
          className="rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          <h4 className="text-[11px] font-black mb-2" style={{ color: "var(--text-primary)" }}>{ref.titleAr}</h4>
          <div className="space-y-1">
            {ref.shortcuts.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <kbd className="rounded-md border px-1.5 py-0.5 text-[10px] font-black shadow-sm"
                  style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)", background: "var(--bg-surface)" }}>
                  {s.key}
                </kbd>
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{s.descAr}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
