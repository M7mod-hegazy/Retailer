// Static data for the Print Studio: doc-type catalog, paper geometry and the
// sample datasets the canvas renders. Pure data — no React.

export const PX_PER_MM = 3.7795;
export const SIZES = { roll: ["58mm", "80mm"], page: ["A5", "A4"] };
export const SHEET_W = { "58mm": "58mm", "80mm": "80mm", A5: "148mm", A4: "210mm" };
export const SHEET_W_LANDSCAPE = { A5: "210mm", A4: "297mm" };
export const PAGE_H_MM = { A4: 297, A5: 210 };
export const PAGE_W_MM = { A4: 210, A5: 148 };
export const PAGE_W_LANDSCAPE_MM = { A5: 210 };
export const PAGE_H_LANDSCAPE_MM = { A5: 148 };

export function familyOfSize(size) {
  return size === "58mm" || size === "80mm" ? "roll" : "page";
}

export function pageDimensions(size, orientation = "portrait") {
  if (size === "58mm" || size === "80mm") {
    const w = parseFloat(size);
    return { wMm: w, hMm: 0 };
  }
  if (orientation === "landscape") {
    return { wMm: PAGE_W_LANDSCAPE_MM[size] || PAGE_W_MM[size], hMm: PAGE_H_LANDSCAPE_MM[size] || PAGE_H_MM[size] };
  }
  return { wMm: PAGE_W_MM[size], hMm: PAGE_H_MM[size] };
}

export function pageWidthStr(size, orientation = "portrait") {
  if (size === "58mm" || size === "80mm") return size;
  if (orientation === "landscape") return SHEET_W_LANDSCAPE[size] || SHEET_W[size];
  return SHEET_W[size];
}

export function pageHeightStr(size, orientation = "portrait") {
  if (size === "58mm" || size === "80mm") return "auto";
  const d = pageDimensions(size, orientation);
  return `${d.hMm}mm`;
}

export function pageSizeStrFor(size, orientation = "portrait") {
  if (size === "58mm" || size === "80mm") {
    return `${parseFloat(size)}mm auto`;
  }
  const d = pageDimensions(size, orientation);
  return `${d.wMm}mm ${d.hMm}mm`;
}

/**
 * Find natural page breaks by snapping to block boundaries instead of cutting
 * through blocks. Scans [data-block-key] elements and places breaks at the
 * nearest block boundary within a snap range (30mm) above the theoretical
 * page-height cut. Returns break positions in mm from content top.
 */
export function findNaturalBreaks(containerEl, pageHmm, pxPerMm = PX_PER_MM) {
  if (!containerEl || !pageHmm || pageHmm <= 0) return [];
  const blocks = containerEl.querySelectorAll("[data-block-key]");
  if (!blocks.length) return [];
  const blockBottoms = [];
  blocks.forEach((b) => {
    const top = b.offsetTop;
    const h = b.offsetHeight;
    if (h > 4 && top >= 0) blockBottoms.push(top + h);
  });
  if (!blockBottoms.length) return [];
  blockBottoms.sort((a, b) => a - b);
  const totalPx = blockBottoms[blockBottoms.length - 1];
  const pagePx = pageHmm * pxPerMm;
  const SNAP_PX = 30 * pxPerMm;
  const breaksMm = [];
  let cursorPx = pagePx;
  while (cursorPx < totalPx) {
    let bestPx = null;
    for (const btm of blockBottoms) {
      const diff = cursorPx - btm;
      if (diff >= 0 && diff <= SNAP_PX) {
        if (bestPx === null || (cursorPx - btm) < (cursorPx - bestPx)) bestPx = btm;
      }
    }
    const actualPx = bestPx !== null ? bestPx : cursorPx;
    breaksMm.push(Math.round((actualPx / pxPerMm) * 10) / 10);
    cursorPx = actualPx + pagePx;
  }
  return breaksMm;
}

// Doc types that render through the block library (LayoutRenderer) and are
// therefore fully designable. The rest print via dedicated template
// components that only honor flat settings (fonts, header/footer, toggles).
export const BLOCK_DOCS = new Set([
  "pos_receipt", "purchase_order", "sales_return",
  "quotation", "branch_transfer", "purchase_return", "payment_receipt",
  "bank_statement", "ajal_statement", "ajal_schedule", "ajal_full_statement",
  "cheque_register", "payment_methods_report", "daily_treasury", "reports_generic",
  "account_statement",
]);

// Scope catalog shown in the Studio switcher. `_global` is the shared design
// every doc type inherits unless it overrides a family layout.
export const STUDIO_SCOPES = [
  { key: "_global",                label: "التصميم العام",         group: "عام" },
  { key: "pos_receipt",            label: "فاتورة / إيصال المبيعات", group: "مبيعات" },
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
  { key: "reports_generic",        label: "إعدادات طباعة التقارير", group: "تقارير" },
  { key: "account_statement",      label: "كشف حساب (عميل / مورد)", group: "تقارير" },
];

export function scopeLabel(key) {
  return (STUDIO_SCOPES.find((s) => s.key === key) || {}).label || key;
}

// ── Template-doc presets ────────────────────────────────────────────────────
// Each preset is a complete flat-settings snapshot that transforms every
// template component. Properties map 1-to-1 to the inspector controls.
export const TEMPLATE_PRESETS = [
  {
    id: "professional_dark",
    label: "احترافي داكن",
    family: "page",
    isTemplate: true,
    tags: ["classic", "dark"],
    flat: {
      accent_color:        "#1e293b",
      header_style:        "band",
      print_font:          "Cairo",
      item_font_size:      11,
      page_padding:        16,
      table_header_style:  "filled",
      table_border:        "rows",
      table_zebra:         true,
      table_row_pad:       7,
    },
  },
  {
    id: "elegant_violet",
    label: "أنيق بنفسجي",
    family: "page",
    isTemplate: true,
    tags: ["elegant", "modern"],
    flat: {
      accent_color:        "#7c3aed",
      header_style:        "strip",
      print_font:          "Tajawal",
      item_font_size:      11,
      page_padding:        16,
      table_header_style:  "filled",
      table_border:        "rows",
      table_zebra:         true,
      table_row_pad:       7,
    },
  },
  {
    id: "corporate_navy",
    label: "أعمال أزرق",
    family: "page",
    isTemplate: true,
    tags: ["formal", "classic"],
    flat: {
      accent_color:        "#1e40af",
      header_style:        "classic",
      print_font:          "Cairo",
      item_font_size:      11,
      page_padding:        20,
      table_header_style:  "light",
      table_border:        "grid",
      table_zebra:         false,
      table_row_pad:       8,
    },
  },
  {
    id: "emerald_modern",
    label: "زمردي عصري",
    family: "page",
    isTemplate: true,
    tags: ["modern", "simple"],
    flat: {
      accent_color:        "#059669",
      header_style:        "band",
      print_font:          "Tajawal",
      item_font_size:      11,
      page_padding:        14,
      table_header_style:  "filled",
      table_border:        "rows",
      table_zebra:         true,
      table_row_pad:       6,
    },
  },
  {
    id: "warm_amber",
    label: "برتقالي دافئ",
    family: "page",
    isTemplate: true,
    tags: ["elegant", "warm"],
    flat: {
      accent_color:        "#b45309",
      header_style:        "strip",
      print_font:          "Cairo",
      item_font_size:      11,
      page_padding:        16,
      table_header_style:  "light",
      table_border:        "rows",
      table_zebra:         true,
      table_row_pad:       7,
    },
  },
  {
    id: "minimal_slate",
    label: "مبسّط رمادي",
    family: "page",
    isTemplate: true,
    tags: ["minimal", "simple"],
    flat: {
      accent_color:        "#475569",
      header_style:        "minimal",
      print_font:          "Cairo",
      item_font_size:      10,
      page_padding:        20,
      table_header_style:  "line",
      table_border:        "rows",
      table_zebra:         false,
      table_row_pad:       9,
    },
  },
  {
    id: "deep_crimson",
    label: "قرمزي رسمي",
    family: "page",
    isTemplate: true,
    tags: ["formal", "classic"],
    flat: {
      accent_color:        "#9f1239",
      header_style:        "band",
      print_font:          "Cairo",
      item_font_size:      11,
      page_padding:        16,
      table_header_style:  "filled",
      table_border:        "grid",
      table_zebra:         false,
      table_row_pad:       7,
    },
  },
];

// Report scope-specific custom presets with target block columns and ordering
export const SCOPE_PRESETS = {
  bank_statement: [
    {
      id: "bank_classic",
      label: "كشف كلاسيكي رسمي",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#1e40af", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "branch", "address", "tax_id", "doc_title", "doc_number", "doc_date", "bank_statement_metrics", "report_table", "footer_text"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#1e40af",
            headerColor: "#ffffff",
            columns: [
              { key: "created_at", label: "تاريخ الحركة", visible: true, align: "right" },
              { key: "type", label: "نوع العملية", visible: true, align: "center" },
              { key: "reference", label: "رقم المرجع", visible: true, align: "center" },
              { key: "notes", label: "البيان / ملاحظات", visible: true, align: "right" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" },
              { key: "reconciled", label: "حالة التسوية", visible: true, align: "center" },
            ]
          }
        }
      }
    },
    {
      id: "bank_modern",
      label: "كشف حركات عصري (Zebra)",
      family: "page",
      isTemplate: true,
      tags: ["modern", "simple"],
      flat: { accent_color: "#1e293b", print_font: "Tajawal", item_font_size: 11, header_style: "band", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "bank_statement_metrics", "report_table", "footer_text"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#0f172a",
            headerColor: "#ffffff",
            columns: [
              { key: "created_at", label: "التاريخ", visible: true, align: "right" },
              { key: "type", label: "النوع", visible: true, align: "center" },
              { key: "notes", label: "ملاحظات الحركة", visible: true, align: "right" },
              { key: "amount", label: "القيمة المالية", visible: true, align: "left" },
            ]
          }
        }
      }
    },
    {
      id: "bank_minimal",
      label: "سجل مالي بسيط",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#475569", print_font: "Cairo", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "bank_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: false,
            headerVariant: "light",
            columns: [
              { key: "created_at", label: "التاريخ", visible: true, align: "right" },
              { key: "type", label: "النوع", visible: true, align: "center" },
              { key: "notes", label: "ملاحظات", visible: true, align: "right" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" },
            ]
          }
        }
      }
    },
    {
      id: "bank_centered",
      label: "كشف حركات متمركز فخم",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#059669", print_font: "Tajawal", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "bank_statement_metrics", "report_table", "footer_text"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#059669",
            headerColor: "#ffffff",
            columns: [
              { key: "created_at", label: "تاريخ الحركة", visible: true, align: "right" },
              { key: "notes", label: "تفاصيل المعاملة البنكية", visible: true, align: "right" },
              { key: "amount", label: "المبلغ المالي", visible: true, align: "left" },
            ]
          }
        }
      }
    },
    {
      id: "bank_boxed",
      label: "كشف حساب شبكي (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#6d28d9", print_font: "Cairo", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["bank_statement_metrics", "report_table", "footer_text"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#6d28d9",
            headerColor: "#ffffff",
            columns: [
              { key: "created_at", label: "التاريخ", visible: true, align: "right" },
              { key: "type", label: "النوع", visible: true, align: "center" },
              { key: "notes", label: "البيان والوصف", visible: true, align: "right" },
              { key: "amount", label: "المبلغ الإجمالي", visible: true, align: "left" },
            ]
          }
        }
      }
    },
    {
      id: "bank_strip",
      label: "سجل جانبي مقسم (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#b45309", print_font: "Tajawal", item_font_size: 11, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["bank_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: true,
            headerVariant: "light",
            columns: [
              { key: "created_at", label: "التاريخ", visible: true, align: "right" },
              { key: "notes", label: "البيان", visible: true, align: "right" },
              { key: "amount", label: "القيمة ج.م", visible: true, align: "left" },
            ]
          }
        }
      }
    }
  ],
  ajal_statement: [
    {
      id: "ajal_official",
      label: "سند مطالبة مالي رسمي",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#7c3aed", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "branch", "address", "doc_title", "doc_number", "doc_date", "ajal_party", "ajal_statement_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#7c3aed",
            headerColor: "#ffffff",
            columns: [
              { key: "payment_date", label: "تاريخ الدفعة", visible: true, align: "right" },
              { key: "method_name", label: "طريقة السداد", visible: true, align: "center" },
              { key: "amount", label: "المبلغ المدفوع", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_minimal",
      label: "إشعار مديونية بسيط",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "simple"],
      flat: { accent_color: "#0f172a", print_font: "Tajawal", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "ajal_party", "ajal_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerVariant: "light",
            columns: [
              { key: "payment_date", label: "التاريخ", visible: true, align: "right" },
              { key: "amount", label: "المبلغ ج.م", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_modern",
      label: "سجل سداد عصري",
      family: "page",
      isTemplate: true,
      tags: ["modern", "simple"],
      flat: { accent_color: "#1d4ed8", print_font: "Tajawal", item_font_size: 11, header_style: "band", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "ajal_party", "ajal_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#1d4ed8",
            headerColor: "#ffffff",
            columns: [
              { key: "payment_date", label: "تاريخ السداد", visible: true, align: "right" },
              { key: "method_name", label: "الوسيلة", visible: true, align: "center" },
              { key: "amount", label: "القيمة المدفوعة", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_centered",
      label: "كشف مطالبة متمركز أنيق",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#d97706", print_font: "Cairo", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "ajal_party", "ajal_statement_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#d97706",
            headerColor: "#ffffff",
            columns: [
              { key: "payment_date", label: "التاريخ", visible: true, align: "right" },
              { key: "amount", label: "المبلغ المستلم", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_boxed",
      label: "إشعار مطالبة شبكي (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#dc2626", print_font: "Tajawal", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["ajal_party", "ajal_statement_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#dc2626",
            headerColor: "#ffffff",
            columns: [
              { key: "payment_date", label: "تاريخ الحركة", visible: true, align: "right" },
              { key: "method_name", label: "الوسيلة المستعملة", visible: true, align: "center" },
              { key: "amount", label: "المبلغ المدفوع", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_bilingual",
      label: "كشف سداد جانبي (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#059669", print_font: "Cairo", item_font_size: 11, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["ajal_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: false,
            headerVariant: "light",
            columns: [
              { key: "payment_date", label: "التاريخ", visible: true, align: "right" },
              { key: "amount", label: "المبلغ المقبوض ج.م", visible: true, align: "left" }
            ]
          }
        }
      }
    }
  ],
  ajal_schedule: [
    {
      id: "schedule_classic",
      label: "جدول أقساط رسمي",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#0284c7", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "ajal_party", "ajal_schedule_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#0284c7",
            headerColor: "#ffffff",
            columns: [
              { key: "installment_no", label: "القسط #", visible: true, align: "center" },
              { key: "due_date", label: "تاريخ الاستحقاق", visible: true, align: "right" },
              { key: "amount", label: "قيمة القسط", visible: true, align: "left" },
              { key: "status", label: "حالة السداد", visible: true, align: "center" },
              { key: "signature", label: "توقيع العميل المستلم", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "schedule_simple",
      label: "مستند أقساط مبسط",
      family: "page",
      isTemplate: true,
      tags: ["simple", "minimal"],
      flat: { accent_color: "#1e293b", print_font: "Tajawal", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "ajal_party", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerVariant: "light",
            columns: [
              { key: "installment_no", label: "قسط #", visible: true, align: "center" },
              { key: "due_date", label: "التاريخ", visible: true, align: "right" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" },
              { key: "status", label: "الحالة", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "schedule_warn",
      label: "جدول استحقاق منذر",
      family: "page",
      isTemplate: true,
      tags: ["formal", "classic"],
      flat: { accent_color: "#dc2626", print_font: "Cairo", item_font_size: 11, header_style: "band", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "ajal_party", "ajal_schedule_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#dc2626",
            headerColor: "#ffffff",
            columns: [
              { key: "installment_no", label: "رقم القسط", visible: true, align: "center" },
              { key: "due_date", label: "تاريخ الاستحقاق النهائي", visible: true, align: "right" },
              { key: "amount", label: "المستحق دفعه", visible: true, align: "left" },
              { key: "status", label: "الحالة الحالية", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "schedule_centered",
      label: "جدول أقساط متمركز عصري",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#059669", print_font: "Tajawal", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "ajal_party", "ajal_schedule_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#059669",
            headerColor: "#ffffff",
            columns: [
              { key: "installment_no", label: "القسط", visible: true, align: "center" },
              { key: "due_date", label: "تاريخ الاستحقاق", visible: true, align: "right" },
              { key: "amount", label: "المبلغ المطلوب", visible: true, align: "left" },
              { key: "status", label: "حالة السداد", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "schedule_boxed",
      label: "جدول التزامات شبكي (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#6d28d9", print_font: "Cairo", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["ajal_schedule_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#6d28d9",
            headerColor: "#ffffff",
            columns: [
              { key: "installment_no", label: "رقم القسط", visible: true, align: "center" },
              { key: "due_date", label: "الاستحقاق", visible: true, align: "right" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" },
              { key: "status", label: "الحالة", visible: true, align: "center" },
              { key: "signature", label: "التوقيع", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "schedule_elegant",
      label: "بيان أقساط جانبي (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#d97706", print_font: "Tajawal", item_font_size: 11, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["ajal_schedule_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: false,
            headerVariant: "light",
            columns: [
              { key: "installment_no", label: "القسط", visible: true, align: "center" },
              { key: "due_date", label: "تاريخ الاستحقاق", visible: true, align: "right" },
              { key: "amount", label: "القيمة الكلية ج.م", visible: true, align: "left" }
            ]
          }
        }
      }
    }
  ],
  daily_treasury: [
    {
      id: "treasury_closing",
      label: "تقرير إغلاق الوردية المفصل",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#0f172a", print_font: "Cairo", item_font_size: 11, header_style: "band", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "customer", "daily_treasury_metrics", "daily_treasury_summaries", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#0f172a",
            headerColor: "#ffffff",
            columns: [
              { key: "description", label: "بيان الحركة", visible: true, align: "right" },
              { key: "type", label: "الحالة", visible: true, align: "center" },
              { key: "method", label: "الوسيلة", visible: true, align: "center" },
              { key: "amount", label: "القيمة المالية", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "treasury_simple",
      label: "كشف حركة الصندوق المبسط",
      family: "page",
      isTemplate: true,
      tags: ["simple", "modern"],
      flat: { accent_color: "#0891b2", print_font: "Tajawal", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "daily_treasury_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerVariant: "light",
            columns: [
              { key: "description", label: "تفاصيل العملية", visible: true, align: "right" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "treasury_audit",
      label: "يومية مالي كلاسيكي",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#800000", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "branch", "address", "doc_title", "doc_number", "doc_date", "daily_treasury_metrics", "daily_treasury_summaries", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#800000",
            headerColor: "#ffffff",
            columns: [
              { key: "description", label: "البيان", visible: true, align: "right" },
              { key: "amount", label: "القيمة", visible: true, align: "left" },
              { key: "type", label: "نوع المعاملة", visible: true, align: "center" },
              { key: "method", label: "طريقة الدفع", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "treasury_centered",
      label: "حركة الخزينة متمركزة أنيقة",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#059669", print_font: "Tajawal", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "daily_treasury_metrics", "daily_treasury_summaries", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#059669",
            headerColor: "#ffffff",
            columns: [
              { key: "description", label: "تفاصيل المعاملة", visible: true, align: "right" },
              { key: "amount", label: "المبلغ المالي", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "treasury_boxed",
      label: "يومية خزينة شبكية (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#6d28d9", print_font: "Cairo", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["daily_treasury_metrics", "daily_treasury_summaries", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#6d28d9",
            headerColor: "#ffffff",
            columns: [
              { key: "description", label: "بيان الحركة المالية", visible: true, align: "right" },
              { key: "type", label: "نوعها", visible: true, align: "center" },
              { key: "method", label: "طريقة السداد", visible: true, align: "center" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "treasury_kpi_only",
      label: "يومية خزينة جانبية (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#047857", print_font: "Tajawal", item_font_size: 12, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["daily_treasury_metrics", "daily_treasury_summaries", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            columns: [
              { key: "description", label: "الحركة", visible: true, align: "right" },
              { key: "amount", label: "القيمة", visible: true, align: "left" }
            ]
          }
        }
      }
    }
  ],
  cheque_register: [
    {
      id: "cheques_classic",
      label: "سجل شيكات تجاري رسمي",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#1e3a8a", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "cheque_register_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#1e3a8a",
            headerColor: "#ffffff",
            columns: [
              { key: "cheque_no", label: "رقم الشيك", visible: true, align: "right" },
              { key: "bank_name", label: "البنك المسحوب عليه", visible: true, align: "center" },
              { key: "drawer_name", label: "الساحب / المستفيد", visible: true, align: "right" },
              { key: "due_date", label: "تاريخ الاستحقاق", visible: true, align: "center" },
              { key: "amount", label: "القيمة", visible: true, align: "left" },
              { key: "status", label: "حالة الشيك", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "cheques_simple",
      label: "كشف استحقاق شيكات بسيط",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "simple"],
      flat: { accent_color: "#4f46e5", print_font: "Tajawal", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerVariant: "light",
            columns: [
              { key: "cheque_no", label: "رقم الشيك", visible: true, align: "right" },
              { key: "bank_name", label: "البنك", visible: true, align: "center" },
              { key: "due_date", label: "الاستحقاق", visible: true, align: "center" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "cheques_audit",
      label: "قائمة تدقيق الشيكات",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#374151", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "cheque_register_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#374151",
            headerColor: "#ffffff",
            columns: [
              { key: "cheque_no", label: "رقم الشيك", visible: true, align: "right" },
              { key: "bank_name", label: "البنك", visible: true, align: "center" },
              { key: "due_date", label: "تاريخ الاستحقاق", visible: true, align: "center" },
              { key: "amount", label: "المبلغ ج.م", visible: true, align: "left" },
              { key: "status", label: "الحالة", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "cheques_centered",
      label: "سجل شيكات متمركز حديث",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#d97706", print_font: "Tajawal", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "cheque_register_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#d97706",
            headerColor: "#ffffff",
            columns: [
              { key: "cheque_no", label: "رقم الشيك", visible: true, align: "right" },
              { key: "bank_name", label: "البنك", visible: true, align: "center" },
              { key: "drawer_name", label: "الساحب / العميل", visible: true, align: "right" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "cheques_boxed",
      label: "حافظة شيكات شبكية (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#dc2626", print_font: "Cairo", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["cheque_register_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#dc2626",
            headerColor: "#ffffff",
            columns: [
              { key: "cheque_no", label: "رقم الشيك", visible: true, align: "right" },
              { key: "bank_name", label: "البنك", visible: true, align: "center" },
              { key: "due_date", label: "الاستحقاق", visible: true, align: "center" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" },
              { key: "status", label: "الحالة", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "cheques_minimal",
      label: "بيان شيكات جانبي (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#b45309", print_font: "Tajawal", item_font_size: 11, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: false,
            headerVariant: "light",
            columns: [
              { key: "cheque_no", label: "رقم الشيك", visible: true, align: "right" },
              { key: "bank_name", label: "اسم البنك", visible: true, align: "center" },
              { key: "amount", label: "القيمة المالية الكلية", visible: true, align: "left" }
            ]
          }
        }
      }
    }
  ],
  payment_methods_report: [
    {
      id: "pay_methods_classic",
      label: "تقرير بوابات الدفع والمحافظ",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#6d28d9", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "payment_methods_report_metrics", "payment_methods_by_method", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#6d28d9",
            headerColor: "#ffffff",
            columns: [
              { key: "doc_no", label: "رقم الحركة", visible: true, align: "center" },
              { key: "doc_type_label", label: "نوع الحركة", visible: true, align: "center" },
              { key: "direction", label: "الاتجاه", visible: true, align: "center" },
              { key: "party", label: "الطرف الثاني", visible: true, align: "right" },
              { key: "method_name", label: "الوسيلة", visible: true, align: "center" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" },
              { key: "created_at", label: "التاريخ", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "pay_methods_modern",
      label: "مخطط مقبوضات عصري",
      family: "page",
      isTemplate: true,
      tags: ["modern", "simple"],
      flat: { accent_color: "#059669", print_font: "Tajawal", item_font_size: 11, header_style: "band", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "payment_methods_report_metrics", "payment_methods_by_method", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#059669",
            headerColor: "#ffffff",
            columns: [
              { key: "doc_no", label: "كود المعاملة", visible: true, align: "center" },
              { key: "doc_type_label", label: "نوع المستند", visible: true, align: "center" },
              { key: "direction", label: "الاتجاه", visible: true, align: "center" },
              { key: "method_name", label: "وسيلة السداد", visible: true, align: "center" },
              { key: "amount", label: "المبلغ ج.م", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "pay_methods_minimal",
      label: "تقرير بوابات مبسط",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#475569", print_font: "Cairo", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "payment_methods_report_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: false,
            headerVariant: "light",
            columns: [
              { key: "method_name", label: "البوابة / المحفظة", visible: true, align: "center" },
              { key: "amount", label: "صافي الرصيد الحالي", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "pay_methods_centered",
      label: "تقرير بوابات متمركز أنيق",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#1e3a8a", print_font: "Tajawal", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "payment_methods_report_metrics", "payment_methods_by_method", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#1e3a8a",
            headerColor: "#ffffff",
            columns: [
              { key: "doc_no", label: "رقم المعاملة", visible: true, align: "center" },
              { key: "party", label: "المستلم / الطرف", visible: true, align: "right" },
              { key: "amount", label: "المبلغ المالي", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "pay_methods_boxed",
      label: "بيان بوابات شبكي (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#dc2626", print_font: "Cairo", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["payment_methods_report_metrics", "payment_methods_by_method", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#dc2626",
            headerColor: "#ffffff",
            columns: [
              { key: "doc_no", label: "رقم الحركة", visible: true, align: "center" },
              { key: "doc_type_label", label: "نوع المستند", visible: true, align: "center" },
              { key: "amount", label: "المبلغ ج.م", visible: true, align: "left" },
              { key: "method_name", label: "البوابة", visible: true, align: "center" }
            ]
          }
        }
      }
    },
    {
      id: "pay_methods_journal",
      label: "يومية محافظ جانبية (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#7c3aed", print_font: "Tajawal", item_font_size: 11, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["payment_methods_report_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#7c3aed",
            headerColor: "#ffffff",
            columns: [
              { key: "doc_no", label: "رقم الحركة", visible: true, align: "center" },
              { key: "direction", label: "الحالة", visible: true, align: "center" },
              { key: "method_name", label: "الوسيلة", visible: true, align: "center" },
              { key: "amount", label: "المبلغ", visible: true, align: "left" }
            ]
          }
        }
      }
    }
  ],
  ajal_full_statement: [
    {
      id: "ajal_full_classic",
      label: "التقرير الشامل لأرصدة الديون",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#9f1239", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "ajal_full_statement_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#9f1239",
            headerColor: "#ffffff",
            columns: [
              { key: "customer_name", label: "اسم العميل", visible: true, align: "right" },
              { key: "original_amount", label: "إجمالي الدين", visible: true, align: "left" },
              { key: "paid", label: "المسدد الكلي", visible: true, align: "left" },
              { key: "remaining", label: "المتبقي المستحق", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_full_modern",
      label: "سجل الديون الكلية مخطط",
      family: "page",
      isTemplate: true,
      tags: ["modern", "simple"],
      flat: { accent_color: "#1e3a8a", print_font: "Tajawal", item_font_size: 11, header_style: "band", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "ajal_full_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#1e3a8a",
            headerColor: "#ffffff",
            columns: [
              { key: "customer_name", label: "العميل", visible: true, align: "right" },
              { key: "original_amount", label: "الدين الإجمالي", visible: true, align: "left" },
              { key: "remaining", label: "المتبقي المستحق للتحصيل", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_full_minimal",
      label: "ملخص ديون مبسط",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#475569", print_font: "Cairo", item_font_size: 10, header_style: "minimal", page_layout_type: "standard" },
      layout: {
        order: ["doc_title", "doc_date", "ajal_full_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "none",
            zebra: false,
            headerVariant: "light",
            columns: [
              { key: "customer_name", label: "الاسم", visible: true, align: "right" },
              { key: "remaining", label: "المبلغ المتبقي المستحق", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_full_centered",
      label: "تقرير ديون متمركز أنيق",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#059669", print_font: "Tajawal", item_font_size: 11, header_style: "centered", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "ajal_full_statement_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "grid",
            headerBg: "#059669",
            headerColor: "#ffffff",
            columns: [
              { key: "customer_name", label: "اسم العميل الكلي", visible: true, align: "right" },
              { key: "remaining", label: "الدين المتبقي المستحق للتحصيل", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_full_boxed",
      label: "تقرير أرصدة شبكي (Executive)",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#6d28d9", print_font: "Cairo", item_font_size: 11, header_style: "boxed", page_layout_type: "executive" },
      layout: {
        order: ["ajal_full_statement_metrics", "report_table", "signature_lines"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#6d28d9",
            headerColor: "#ffffff",
            columns: [
              { key: "customer_name", label: "العميل", visible: true, align: "right" },
              { key: "original_amount", label: "إجمالي الدين", visible: true, align: "left" },
              { key: "remaining", label: "المتبقي الكلي", visible: true, align: "left" }
            ]
          }
        }
      }
    },
    {
      id: "ajal_full_collection",
      label: "كشف تحصيل جانبي (Sidebar)",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#d97706", print_font: "Tajawal", item_font_size: 11, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["ajal_full_statement_metrics", "report_table"],
        perBlock: {
          report_table: {
            tableBorder: "lines",
            zebra: true,
            headerBg: "#d97706",
            headerColor: "#ffffff",
            columns: [
              { key: "customer_name", label: "العميل", visible: true, align: "right" },
              { key: "remaining", label: "المتبقي المستحق", visible: true, align: "left" }
            ]
          }
        }
      }
    }
  ],
  reports_generic: [
    {
      id: "generic_classic",
      label: "تقرير كلاسيكي رسمي",
      family: "page",
      isTemplate: true,
      tags: ["classic", "formal"],
      flat: { accent_color: "#1e40af", print_font: "Cairo", item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "branch", "address", "doc_title", "doc_number", "doc_date", "report_table", "notes", "footer_text", "signature_lines"],
        perBlock: {
          report_table: { tableBorder: "grid", headerBg: "#1e40af", headerColor: "#ffffff" }
        }
      }
    },
    {
      id: "generic_centered",
      label: "تقرير متمركز فاخر",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "modern"],
      flat: { accent_color: "#7c3aed", print_font: "Cairo", item_font_size: 11, header_style: "centered" },
      layout: {
        order: ["logo", "company_name", "branch", "address", "doc_title", "doc_number", "doc_date", "report_table", "notes", "footer_text", "signature_lines"],
        perBlock: {
          report_table: { tableBorder: "grid", zebra: true, headerVariant: "light" }
        }
      }
    },
    {
      id: "generic_boxed",
      label: "تقرير مؤطر فخم",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "classic"],
      flat: { accent_color: "#059669", print_font: "Tajawal", item_font_size: 11, header_style: "boxed" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "report_table", "footer_text"],
        perBlock: {
          report_table: { tableBorder: "lines", zebra: true, headerBg: "#059669", headerColor: "#ffffff" }
        }
      }
    },
    {
      id: "generic_band",
      label: "تقرير ترويسة عريضة",
      family: "page",
      isTemplate: true,
      tags: ["modern", "simple"],
      flat: { accent_color: "#dc2626", print_font: "Cairo", item_font_size: 11, header_style: "band" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_number", "doc_date", "report_table", "footer_text"],
        perBlock: {
          report_table: { tableBorder: "grid", zebra: true, headerBg: "#dc2626", headerColor: "#ffffff" }
        }
      }
    },
    {
      id: "generic_strip",
      label: "تقرير بيان بسيط عريض",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "whitespace"],
      flat: { accent_color: "#d97706", print_font: "Tajawal", item_font_size: 11, header_style: "minimal" },
      layout: {
        order: ["doc_title", "doc_date", "report_table"],
        perBlock: {
          report_table: { tableBorder: "none", zebra: false, headerVariant: "light" }
        }
      }
    },
    {
      id: "generic_minimal",
      label: "تقرير مبسّط حديث",
      family: "page",
      isTemplate: true,
      tags: ["minimal", "modern"],
      flat: { accent_color: "#0f172a", print_font: "Tajawal", item_font_size: 10, header_style: "minimal" },
      layout: {
        order: ["doc_title", "doc_date", "report_table", "footer_text"],
        perBlock: {
          report_table: { tableBorder: "lines", zebra: true, headerVariant: "light" }
        }
      }
    }
  ],
  account_statement: [
    {
      id: "account_standard",
      label: "قياسي — مطابق لشاشة التقرير",
      family: "page",
      isTemplate: true,
      tags: ["standard", "default", "on-screen"],
      flat: { accent_color: "#1e40af", print_font: "Tajawal", body_font_size: 11, item_font_size: 11, header_style: "classic", page_layout_type: "standard" },
      layout: {
        order: ["logo", "company_name", "branch", "address", "doc_title", "doc_number", "doc_date", "account_statement_party", "account_statement_ledger", "account_statement_summary", "footer_text", "signature_lines"],
        perBlock: {
          account_statement_ledger: {
            tableBorder: "lines", zebra: true, headerVariant: "dark",
            columns: [
              { key: "index", label: "م", visible: true, align: "center", width: "4%" },
              { key: "date", label: "التاريخ", visible: true, align: "center", width: "14%" },
              { key: "debit", label: "مدين", visible: true, align: "center", width: "12%" },
              { key: "credit", label: "دائن", visible: true, align: "center", width: "12%" },
              { key: "running_balance", label: "الرصيد", visible: true, align: "center", width: "14%" },
              { key: "description", label: "الوصف", visible: true, align: "right", width: "44%" },
            ]
          }
        }
      }
    },
    {
      id: "account_ledger_book",
      label: "دفتر الأستاذ — ورق مسطر دافئ",
      family: "page",
      isTemplate: true,
      tags: ["classic", "warm", "ledger"],
      flat: { accent_color: "#92400e", print_font: "Cairo", body_font_size: 11, item_font_size: 11, header_style: "boxed", page_layout_type: "letterhead" },
      layout: {
        order: ["watermark", "logo", "company_name", "tax_id", "account_statement_party", "account_statement_ledger", "account_statement_summary", "signature_lines"],
        perBlock: {
          account_statement_ledger: {
            tableBorder: "lines", lineColor: "#d6d3d1", lineWidth: 2,
            zebra: true, headerVariant: "light", headerBg: "#fef3c7",
            columns: [
              { key: "index", label: "م", visible: true, align: "center", width: "4%" },
              { key: "date", label: "التاريخ", visible: true, align: "center", width: "14%" },
              { key: "debit", label: "مدين", visible: true, align: "center", width: "12%" },
              { key: "credit", label: "دائن", visible: true, align: "center", width: "12%" },
              { key: "running_balance", label: "الرصيد", visible: true, align: "center", width: "14%" },
              { key: "description", label: "البيان", visible: true, align: "right", width: "44%" },
            ]
          },
          account_statement_summary: {
            tableBorder: "lines", lineColor: "#d6d3d1", lineWidth: 2,
            accentColor: "#92400e",
          }
        }
      }
    },
    {
      id: "account_quick",
      label: "سريع — نظرة عامة مكثفة",
      family: "page",
      isTemplate: true,
      tags: ["compact", "minimal", "quick"],
      flat: { accent_color: "#0369a1", print_font: "Tajawal", body_font_size: 10, item_font_size: 9, header_style: "band", page_layout_type: "minimal-top" },
      layout: {
        order: ["doc_title", "doc_date", "account_statement_party", "account_statement_ledger", "account_statement_summary"],
        perBlock: {
          account_statement_ledger: {
            tableBorder: "none", zebra: true, headerVariant: "light",
            columns: [
              { key: "index", label: "م", visible: true, align: "center", width: "4%" },
              { key: "date", label: "التاريخ", visible: true, align: "center", width: "14%" },
              { key: "debit", label: "مدين", visible: true, align: "center", width: "12%" },
              { key: "credit", label: "دائن", visible: true, align: "center", width: "12%" },
              { key: "running_balance", label: "الرصيد", visible: true, align: "center", width: "14%" },
              { key: "description", label: "البيان", visible: true, align: "right", width: "44%" },
            ]
          }
        }
      }
    },
    {
      id: "account_executive",
      label: "تنفيذي — تقرير رسمي معتمد",
      family: "page",
      isTemplate: true,
      tags: ["elegant", "formal", "executive"],
      flat: { accent_color: "#6d28d9", print_font: "Cairo", body_font_size: 11, item_font_size: 11, header_style: "centered", page_layout_type: "executive" },
      layout: {
        order: ["watermark", "logo", "company_name", "branch", "address", "doc_title", "doc_number", "doc_date", "account_statement_party", "account_statement_ledger", "account_statement_summary", "notes", "footer_text", "signature_lines"],
        perBlock: {
          account_statement_ledger: {
            tableBorder: "grid", zebra: false, headerVariant: "dark", headerBg: "#6d28d9",
            columns: [
              { key: "index", label: "م", visible: true, align: "center", width: "4%" },
              { key: "date", label: "تاريخ الحركة", visible: true, align: "center", width: "14%" },
              { key: "debit", label: "مدين", visible: true, align: "center", width: "12%" },
              { key: "credit", label: "دائن", visible: true, align: "center", width: "12%" },
              { key: "running_balance", label: "الرصيد التراكمي", visible: true, align: "center", width: "14%" },
              { key: "description", label: "تفاصيل المعاملة", visible: true, align: "right", width: "44%" },
            ]
          }
        }
      }
    },
    {
      id: "account_sidebar",
      label: "شريط جانبي — عرض حديث منفصل",
      family: "page",
      isTemplate: true,
      tags: ["sidebar", "modern", "whitespace"],
      flat: { accent_color: "#d97706", print_font: "Tajawal", body_font_size: 11, item_font_size: 10, header_style: "minimal", page_layout_type: "sidebar" },
      layout: {
        order: ["logo", "company_name", "account_statement_party", "account_statement_ledger", "account_statement_summary"],
        perBlock: {
          account_statement_ledger: {
            tableBorder: "none", zebra: false, headerVariant: "light",
            columns: [
              { key: "index", label: "م", visible: true, align: "center", width: "4%" },
              { key: "date", label: "التاريخ", visible: true, align: "center", width: "16%" },
              { key: "debit", label: "مدين", visible: true, align: "center", width: "14%" },
              { key: "credit", label: "دائن", visible: true, align: "center", width: "14%" },
              { key: "running_balance", label: "الرصيد", visible: true, align: "center", width: "14%" },
              { key: "description", label: "البيان", visible: true, align: "right", width: "38%" },
            ]
          }
        }
      }
    },
    {
      id: "account_card",
      label: "بطاقة — تصميم كروتي مدمج",
      family: "page",
      isTemplate: true,
      tags: ["card", "compact", "colorful"],
      flat: { accent_color: "#be123c", print_font: "Tajawal", body_font_size: 11, item_font_size: 10, header_style: "band", page_layout_type: "split-header" },
      layout: {
        order: ["logo", "company_name", "doc_title", "doc_date", "account_statement_party", "account_statement_ledger", "account_statement_summary"],
        perBlock: {
          account_statement_ledger: {
            tableBorder: "grid", zebra: true, headerVariant: "dark", headerBg: "#be123c",
            columns: [
              { key: "index", label: "م", visible: true, align: "center", width: "5%" },
              { key: "date", label: "التاريخ", visible: true, align: "center", width: "16%" },
              { key: "debit", label: "مدين", visible: true, align: "center", width: "14%" },
              { key: "credit", label: "دائن", visible: true, align: "center", width: "14%" },
              { key: "running_balance", label: "الرصيد", visible: true, align: "center", width: "16%" },
              { key: "description", label: "الوصف", visible: true, align: "right", width: "35%" },
            ]
          }
        }
      }
    },
  ]
};



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
  daily_treasury: {
    date: "2026-07-05",
    shift_label: "وردية الصباح",
    treasuries: [
      { name: "الصندوق الرئيسي", opening: 5000, total_in: 8500, total_out: 3200, closing: 10300 },
      { name: "البنك الأهلي",    opening: 15000, total_in: 2000, total_out: 500,  closing: 16500 },
    ],
    grand_in: 10500, grand_out: 3700, grand_closing: 26800,
    transactions: [
      { description: "مبيعات نقطة البيع — وردية الصباح", amount: 7500, type: "in",  method: "نقدي" },
      { description: "تحصيل دين آجل — محمد أحمد",        amount: 1000, type: "in",  method: "شبكة" },
      { description: "مصروفات إيجار المحل",               amount: 2000, type: "out", method: "نقدي" },
      { description: "مصروفات فاتورة كهرباء",             amount: 500,  type: "out", method: "نقدي" },
      { description: "إيداع بنكي",                        amount: 700,  type: "out", method: "تحويل" },
    ],
  },
  ajal_full_statement: {
    debts: [
      { customer_name: "محمد أحمد العلي",   original_amount: 5000,  remaining: 3000,  created_at: now(), due_date: new Date(Date.now() + 15 * 86400000).toISOString(), status: "active" },
      { customer_name: "سالم محمد الشريف",  original_amount: 8000,  remaining: 8000,  created_at: now(), due_date: new Date(Date.now() + 5  * 86400000).toISOString(), status: "overdue" },
      { customer_name: "أحمد حسن الزهراني", original_amount: 12000, remaining: 4500,  created_at: now(), due_date: new Date(Date.now() + 30 * 86400000).toISOString(), status: "active" },
      { customer_name: "فاطمة علي الحربي",  original_amount: 3500,  remaining: 3500,  created_at: now(), due_date: new Date(Date.now() - 3  * 86400000).toISOString(), status: "overdue" },
    ],
    total_original: 28500, total_remaining: 19000,
    filters: { from: "2026-06-01", to: "2026-07-05" },
  },
  reports_generic: {
    title: "تقرير المخزون الحالي",
    subtitle: "حالة المخزون حتى 2026/07/05",
    columns: ["الكود", "اسم الصنف", "الوحدة", "الكمية", "سعر التكلفة", "الإجمالي"],
    rows: [
      ["K-001", "منتج تجريبي أول",         "قطعة", "15",  "45.00",  "675.00"],
      ["K-002", "منتج تجريبي ثاني",         "كرتون", "8",  "120.00", "960.00"],
      ["K-003", "منتج تجريبي ثالث",         "لتر",   "30", "15.50",  "465.00"],
      ["K-004", "منتج اسمه أطول لاختبار العرض", "قطعة", "5", "230.00", "1,150.00"],
    ],
    totals: { label: "إجمالي قيمة المخزون", value: "3,250.00" },
  },
  account_statement: {
    partyType: "customer",
    summary: {
      party_name: "محمد أحمد عبدالله",
      party_code: "CUST-001",
      opening_balance: 1950,
      closing_balance: 6360,
      total_debit: 8010,
      total_credit: 3600,
    },
    period: { from: "2026-06-01", to: "2026-07-09" },
    rows: [
      {
        type: "sales_return", ref_no: "SRT-20260705-012", date: "2026-07-05", datetime: "2026-07-05T14:25:00.000Z",
        description: "مرتجع مبيعات رقم SRT-20260705-012", debit: 0, credit: 400,
        running_balance: 1550, doc_discount: 20, doc_increase: 0, doc_total: 400,
        affects_balance: true, _has_items: true,
      },
      { _is_item: true, item_name: "قايم بجناح سوبر ماركت 2 متر ابيض ع · 22.1", item_code: "K-010", quantity: 2, unit_price: 210, line_total: 420 },
      {
        type: "sales_return", ref_no: "SRT-20260705-016", date: "2026-07-05", datetime: "2026-07-05T14:51:00.000Z",
        description: "مرتجع مبيعات رقم SRT-20260705-016", debit: 0, credit: 100,
        running_balance: 1350, doc_discount: 10, doc_increase: 0, doc_total: 200,
        affects_balance: true, _has_items: true,
      },
      { _is_item: true, item_name: "قايم بجناح سوبر ماركت 2 متر ابيض ع · 22.1", item_code: "K-010", quantity: 1, unit_price: 210, line_total: 210 },
      {
        type: "invoice", ref_no: "INV-20260705-001", date: "2026-07-05", datetime: "2026-07-05T15:10:00.000Z",
        description: "فاتورة مبيعات نقدية — مستلزمات مكتبية", debit: 3000, credit: 0,
        running_balance: 4350, doc_discount: 0, doc_increase: 0, doc_total: 3000,
        affects_balance: true, _has_items: true,
      },
      { _is_item: true, item_name: "طابعة ليزر HP LaserJet Pro M404", item_code: "K-001", quantity: 2, unit_price: 1250, line_total: 2500 },
      { _is_item: true, item_name: "كرتون ورق تصوير A4 70 جرام — 5000 ورقة", item_code: "K-002", quantity: 5, unit_price: 100, line_total: 500 },
      {
        type: "payment", ref_no: "PAY-20260706-001", date: "2026-07-06", datetime: "2026-07-06T10:30:00.000Z",
        description: "دفعة محصلة عبر التحويل البنكي", debit: 0, credit: 1000,
        running_balance: 3350, doc_discount: null, doc_increase: null, doc_total: null,
        affects_balance: true,
      },
      {
        type: "invoice", ref_no: "INV-20260707-002", date: "2026-07-07", datetime: "2026-07-07T09:45:00.000Z",
        description: "فاتورة مبيعات آجلة — تجهيزات وأثاث مكتبي", debit: 4760, credit: 0,
        running_balance: 8110, doc_discount: 240, doc_increase: 0, doc_total: 5000,
        affects_balance: true, _has_items: true,
      },
      { _is_item: true, item_name: "رفوف تخزين معدنية 5 أرفف مطلي كروم", item_code: "K-020", quantity: 3, unit_price: 1200, line_total: 3600 },
      { _is_item: true, item_name: "طاولة اجتماعات خشبية كبيرة 6 مقاعد", item_code: "K-021", quantity: 1, unit_price: 1400, line_total: 1400 },
      {
        type: "adjustment", ref_no: "ADJ-20260708-001", date: "2026-07-08", datetime: "2026-07-08T08:00:00.000Z",
        description: "تسوية رصيد — فرق سعر صرف العملة", debit: 250, credit: 0,
        running_balance: 8360, doc_discount: null, doc_increase: null, doc_total: null,
        affects_balance: false,
      },
      {
        type: "payment", ref_no: "PAY-20260709-002", date: "2026-07-09", datetime: "2026-07-09T11:15:00.000Z",
        description: "دفعة نقدية — تحصيل مستحقات عميل", debit: 0, credit: 2000,
        running_balance: 6360, doc_discount: null, doc_increase: null, doc_total: null,
        affects_balance: true,
      },
    ],
  },
};

// ── per-sample variants for report scopes ────────────────────────────────────
// Returns mock data shaped for the given scope, varying by sampleId so the
// Studio sample-switcher (بيانات عادية / ٣٠ صنفاً / أسماء طويلة) actually works.
export function templateMockBySample(scope, sampleId = "normal") {
  const base = TEMPLATE_MOCK[scope];
  if (!base) return base;

  if (sampleId === "normal") return base;

  const longNames = {
    bank_statement: {
      ...base,
      transactions: [
        { id: 1, created_at: now(), type: "deposit",  amount: 5000,  note: "إيداع نقدي من تحصيل العملاء عبر الشبكة البنكية",        balance_after: 45500 },
        { id: 2, created_at: now(), type: "withdraw", amount: 1500,  note: "سحب مصروفات إيجار المقر الرئيسي للشركة للربع الثالث",   balance_after: 40500 },
        { id: 3, created_at: now(), type: "deposit",  amount: 12000, note: "تحصيل دفعة من عميل مشاريع الإنشاء والتشييد المتكاملة",   balance_after: 52500 },
        { id: 4, created_at: now(), type: "withdraw", amount: 3200,  note: "مصروفات رواتب وأجور الموظفين للفترة من 1 إلى 15 يونيو",  balance_after: 49300 },
        { id: 5, created_at: now(), type: "deposit",  amount: 8000,  note: "تحويل وارد من حساب الفرع الثاني بالمنطقة الشرقية",       balance_after: 57300 },
      ],
    },
    ajal_statement: {
      debt: {
        customer_name: "محمد أحمد بن عبدالله السعيد",
        original_amount: 5000, remaining: 3000, created_at: now(),
        payments: [
          { id: 1, payment_date: now(), method_name: "نقدي — الصندوق الرئيسي",     amount: 1000 },
          { id: 2, payment_date: now(), method_name: "تحويل شبكة — البنك الأهلي", amount: 1000 },
        ],
      },
    },
    ajal_schedule: {
      debt: {
        customer_name: "محمد أحمد بن عبدالله السعيد",
        original_amount: 5000, remaining: 3000,
        schedule: [
          { id: 1, installment_no: 1, due_date: now(), amount: 1000, status: "paid" },
          { id: 2, installment_no: 2, due_date: new Date(Date.now() + 30 * 86400000).toISOString(), amount: 1000, status: "pending" },
          { id: 3, installment_no: 3, due_date: new Date(Date.now() + 60 * 86400000).toISOString(), amount: 1000, status: "pending" },
        ],
      },
    },
    cheque_register: {
      rows: [
        { id: 1, cheque_no: "CHQ-001", bank_name: "البنك الأهلي السعودي",    drawer_name: "محمد سالم بن عبدالرحمن الغامدي", due_date: now(), amount: 5000, status: "pending" },
        { id: 2, cheque_no: "CHQ-002", bank_name: "بنك الراجحي للتمويل",     drawer_name: "أحمد علي الزهراني والشركاء",       due_date: now(), amount: 3500, status: "cleared" },
        { id: 3, cheque_no: "CHQ-003", bank_name: "البنك العربي الوطني",     drawer_name: "سارة حسن محمد التميمي للتجارة",    due_date: now(), amount: 2000, status: "bounced" },
      ],
    },
    payment_methods_report: {
      ...base,
      rows: [
        { id: 1, doc_no: "INV-001", doc_type: "فاتورة مبيعات",  amount: 1500, direction: "in",  party: "محمد أحمد العلي التاجر",      method_name: "نقدي",            created_at: now() },
        { id: 2, doc_no: "INV-002", doc_type: "فاتورة مبيعات",  amount: 2000, direction: "in",  party: "شركة سالم للتوزيع والتجارة", method_name: "شبكة - بنك الراجحي", created_at: now() },
        { id: 3, doc_no: "EXP-001", doc_type: "مصاريف تشغيل",   amount: 500,  direction: "out", party: "مورد مستلزمات المكاتب",        method_name: "نقدي",            created_at: now() },
      ],
    },
    daily_treasury: base,
    ajal_full_statement: {
      debts: [
        { customer_name: "محمد أحمد عبدالله العلي الحارثي",   original_amount: 5000,  remaining: 3000,  created_at: now(), due_date: new Date(Date.now() + 15 * 86400000).toISOString(), status: "active" },
        { customer_name: "سالم محمد إبراهيم الشريف الغامدي",  original_amount: 8000,  remaining: 8000,  created_at: now(), due_date: new Date(Date.now() + 5  * 86400000).toISOString(), status: "overdue" },
        { customer_name: "أحمد حسن علي الزهراني المدني",       original_amount: 12000, remaining: 4500,  created_at: now(), due_date: new Date(Date.now() + 30 * 86400000).toISOString(), status: "active" },
        { customer_name: "فاطمة علي محمد الحربي الرشيدي",      original_amount: 3500,  remaining: 3500,  created_at: now(), due_date: new Date(Date.now() - 3  * 86400000).toISOString(), status: "overdue" },
      ],
      total_original: 28500, total_remaining: 19000,
      filters: base.filters,
    },
    reports_generic: {
      ...base,
      rows: [
        ["K-001", "منتج تجريبي أول ذو اسم مطول جداً للاختبار",     "قطعة", "15",  "45.00",  "675.00"],
        ["K-002", "منتج تجريبي ثاني وصف تفصيلي وطويل جداً",         "كرتون", "8",  "120.00", "960.00"],
        ["K-003", "منتج تجريبي ثالث واسمه اطول من اللازم اصلاً",    "لتر",   "30", "15.50",  "465.00"],
        ["K-004", "اسم منتج تجريبي رابع طويل جداً ليختبر العرض هنا", "قطعة",  "5",  "230.00", "1,150.00"],
      ],
    },
    account_statement: {
      ...base,
      summary: {
        ...base.summary,
        party_name: "محمد أحمد بن عبدالله بن علي السعيد التميمي",
        party_code: "CUST-00-001-2026",
      },
      rows: base.rows.map((r, i) => {
        if (r._is_item) {
          const names = [
            "قايم بجناح سوبر ماركت 2 متر ابيض ع · 22.1 (مقاوم للصدأ والصدأ)",
            "قايم بجناح سوبر ماركت 2 متر ابيض ع بلوطي داكن مطفي",
            "طابعة ليزر HP LaserJet Pro M404 متعددة الوظائف طباعة ونسخ ومسح",
            "كرتون ورق تصوير A4 70 جرام أبيض فاخر — 5000 ورقة للكرتون",
            "رفوف تخزين معدنية قابلة للتعديل 5 أرفف مطلي كروم ضد الصدأ",
            "طاولة اجتماعات خشبية كبيرة 6 مقاعد مع قاعدة معدنية متينة",
          ];
          const idx = r._item_index != null ? r._item_index % names.length : 0;
          return { ...r, item_name: names[idx % names.length] };
        }
        const longDescs = [
          "مرتجع مبيعات رقم SRT-20260705-012 — تلف في الشحنة بسبب سوء التخزين أثناء النقل من المستودع العام",
          "مرتجع مبيعات رقم SRT-20260705-016 — منتج غير مطابق للمواصفات القياسية المتفق عليها مع العميل",
          "فاتورة مبيعات نقدية — مستلزمات مكتبية متنوعة (طابعات وكراتين ورق وأدوات كتابية)",
          "دفعة محصلة عبر التحويل البنكي من البنك الأهلي المصري فرع الإسكندرية",
          "فاتورة مبيعات آجلة — أثاث مكتبي وتجهيزات قسم الإدارة العليا للشركة (رفوف وطاولات)",
          "تسوية رصيد — فرق سعر صرف العملة الأجنبية للفترة المحاسبية السابقة بقيمة ٢٥٠ ج",
          "دفعة نقدية — تحصيل مستحقات سابقة من عميل مشاريع الإنشاءات والمقاولات العامة",
        ];
        return {
          ...r,
          description: longDescs[i] || r.description,
          _has_items: r._has_items || (r.items && r.items.length > 0),
        };
      }).flatMap((r) => {
        if (r.items && r.items.length > 0) {
          const items = r.items;
          delete r.items;
          r._has_items = true;
          return [r, ...items.map((it, idx) => ({ ...it, _item_index: idx }))];
        }
        return [r];
      }),
    },
  };

  const stress = {
    bank_statement: {
      ...base,
      transactions: Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        created_at: now(),
        type: i % 3 === 0 ? "withdraw" : "deposit",
        amount: (i + 1) * 500 + 200,
        note: `معاملة بنكية ${i + 1}`,
        balance_after: 45500 + i * 300,
      })),
    },
    ajal_statement: {
      debt: {
        customer_name: "محمد أحمد",
        original_amount: 50000, remaining: 35000, created_at: now(),
        payments: Array.from({ length: 15 }, (_, i) => ({
          id: i + 1, payment_date: now(),
          method_name: i % 2 === 0 ? "نقدي" : "شبكة",
          amount: 1000,
        })),
      },
    },
    ajal_schedule: {
      debt: {
        customer_name: "محمد أحمد",
        original_amount: 30000, remaining: 25000,
        schedule: Array.from({ length: 30 }, (_, i) => ({
          id: i + 1, installment_no: i + 1,
          due_date: new Date(Date.now() + i * 30 * 86400000).toISOString(),
          amount: 1000,
          status: i < 5 ? "paid" : "pending",
        })),
      },
    },
    cheque_register: {
      rows: Array.from({ length: 20 }, (_, i) => ({
        id: i + 1, cheque_no: `CHQ-${String(i + 1).padStart(3, "0")}`,
        bank_name: ["البنك الأهلي", "بنك مصر", "البنك العربي", "بنك الراجحي"][i % 4],
        drawer_name: `عميل ${i + 1}`,
        due_date: now(), amount: (i + 1) * 500, status: ["pending", "cleared", "bounced"][i % 3],
      })),
    },
    payment_methods_report: {
      ...base,
      rows: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        doc_no: `DOC-${String(i + 1).padStart(3, "0")}`,
        doc_type: i % 2 === 0 ? "مبيعات" : "مصروفات",
        amount: (i + 1) * 300 + 100,
        direction: i % 3 === 0 ? "out" : "in",
        party: `طرف ${i + 1}`,
        method_name: ["نقدي", "شبكة", "تحويل", "شيك"][i % 4],
        created_at: now(),
      })),
      totalIn: 18500, totalOut: 3700,
    },
    daily_treasury: {
      ...base,
      transactions: Array.from({ length: 20 }, (_, i) => ({
        description: `حركة ${i + 1} — تفاصيل المعاملة`,
        amount: (i + 1) * 200 + 100,
        type: i % 3 === 0 ? "out" : "in",
        method: ["نقدي", "شبكة", "تحويل"][i % 3],
      })),
    },
    ajal_full_statement: {
      debts: Array.from({ length: 30 }, (_, i) => ({
        customer_name: `عميل ${i + 1}`,
        original_amount: (i + 1) * 500 + 1000, remaining: (i + 1) * 200 + 500,
        created_at: now(),
        due_date: new Date(Date.now() + (i - 5) * 5 * 86400000).toISOString(),
        status: i % 3 === 0 ? "overdue" : "active",
      })),
      total_original: 255000, total_remaining: 121500,
      filters: base.filters,
    },
    reports_generic: {
      ...base,
      rows: Array.from({ length: 30 }, (_, i) => [
        `K-${String(i + 1).padStart(3, "0")}`,
        `منتج تجريبي ${i + 1}`,
        ["قطعة", "كرتون", "لتر"][i % 3],
        String(Math.floor(Math.random() * 50) + 1),
        (10 + i * 5).toFixed(2),
        ((10 + i * 5) * (Math.floor(Math.random() * 50) + 1)).toFixed(2),
      ]),
    },
    account_statement: {
      ...base,
      rows: (() => {
        const types = ["invoice", "payment", "purchase", "sales_return", "adjustment"];
        const itemsPool = [
          { name: "طابعة ليزر HP LaserJet Pro", code: "K-001" },
          { name: "ماوس لاسلكي Logitech", code: "K-002" },
          { name: "كيبورد ميكانيكي RGB", code: "K-003" },
          { name: "شاشة ٢٤ بوصة LED", code: "K-004" },
          { name: "كاميرا مراقبة Hikvision", code: "K-005" },
          { name: "ماسح ضوئي HP ScanJet", code: "K-006" },
        ];
        let rb = 1950;
        const result = [];
        for (let i = 0; i < 30; i++) {
          const type = types[i % types.length];
          const isDebit = type === "invoice" || type === "purchase" || type === "adjustment";
          const amt = (i + 1) * 350 + 200;
          rb += isDebit ? amt : -amt;
          const typeLabel = type === "invoice" ? "فاتورة مبيعات" : type === "payment" ? "دفعة" : type === "purchase" ? "فاتورة مشتريات" : type === "sales_return" ? "مرتجع مبيعات" : "تسوية";
          const hasItems = i % 2 === 0 && (type === "invoice" || type === "purchase" || type === "sales_return");
          const doc_total = hasItems ? amt : (type === "payment" || type === "sales_return" ? amt : amt);
          const discount = i % 3 === 0 && isDebit ? 100 : 0;
          const increase = i % 5 === 0 && isDebit ? 50 : 0;
          const netOfDiscount = doc_total - discount + increase;
          const ledgerAmt = isDebit ? netOfDiscount : (type === "sales_return" ? Math.min(amt, netOfDiscount) : 0);
          const creditAmt = (!isDebit && type !== "sales_return") ? amt : (type === "sales_return" ? (doc_total - ledgerAmt) : 0);
          result.push({
            type, ref_no: i < 20 ? `DOC-${String(i + 1).padStart(3, "0")}` : `INV-2026-${String(i + 1).padStart(4, "0")}`,
            date: now(), datetime: now(),
            description: `معاملة رقم ${i + 1} — ${typeLabel} ${i < 10 ? "(الفترة الأولى)" : i < 20 ? "(الفترة الثانية)" : "(الفترة الثالثة)"}`,
            debit: isDebit ? netOfDiscount : 0,
            credit: !isDebit ? amt : (type === "sales_return" ? (doc_total - ledgerAmt) : 0),
            running_balance: rb,
            doc_discount: hasItems && discount > 0 ? discount : null,
            doc_increase: hasItems && increase > 0 ? increase : null,
            doc_total: hasItems ? doc_total : null,
            affects_balance: i !== 7 && i !== 19,
            _has_items: hasItems,
          });
          if (hasItems) {
            const itemCount = (i % 3) + 1;
            const itemPrice = amt / itemCount;
            result.push({
              _is_item: true, item_name: itemsPool[i % itemsPool.length].name,
              item_code: itemsPool[i % itemsPool.length].code,
              quantity: itemCount, unit_price: Math.round(itemPrice * 100) / 100, line_total: amt,
            });
            if (i % 3 === 0) {
              result.push({
                _is_item: true, item_name: itemsPool[(i + 1) % itemsPool.length].name,
                item_code: itemsPool[(i + 1) % itemsPool.length].code,
                quantity: 2, unit_price: amt / 4, line_total: amt / 2,
              });
            }
          }
        }
        return result;
      })(),
    },
  };

  if (sampleId === "stress") return stress[scope] || base;
  if (sampleId === "long")   return longNames[scope] || base;
  return base;
}

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
