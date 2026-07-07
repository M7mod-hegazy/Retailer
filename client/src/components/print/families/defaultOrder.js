// Canonical block order per family. Roll is faithful to the thermal stack.
// Page reuses the same set for now; its zone-aware layout lands in Phase 1b.
const COMMON = [
  "logo", "company_name", "branch", "address", "tax_id", "receipt_header_text",
  "doc_number", "doc_date", "customer", "cashier",
  "items_table", "subtotal", "discount", "increase", "tax", "grand_total", "payments",
  "notes", "footer_text", "qr", "barcode",
];

// Page-only additions: `watermark` is an absolutely-positioned overlay so its
// position in the order doesn't affect layout — placed first for clarity.
// `signature_lines` is a footer element, placed after notes/footer/qr/barcode.
export const DEFAULT_ORDER = {
  roll: [...COMMON, "receiver_signature"],
  page: ["watermark", ...COMMON, "signature_lines"],

  // Report scopes default orders
  bank_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date", "customer",
    "bank_statement_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  daily_treasury: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "daily_treasury_metrics",
    "daily_treasury_summaries",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  ajal_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date", "ajal_party",
    "ajal_statement_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  ajal_schedule: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date", "ajal_party",
    "ajal_schedule_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  ajal_full_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "ajal_full_statement_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  cheque_register: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "cheque_register_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  payment_methods_report: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "payment_methods_report_metrics",
    "payment_methods_by_method",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
  reports_generic: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "report_table",
    "notes", "footer_text", "signature_lines",
  ],
};

