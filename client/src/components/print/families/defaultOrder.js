// Canonical block order per family. Roll is faithful to the thermal stack.
// Page reuses the same set for now; its zone-aware layout lands in Phase 1b.
const COMMON = [
  "logo", "company_name", "branch", "address", "tax_id", "receipt_header_text",
  "doc_number", "doc_date", "customer", "cashier",
  "items_table", "subtotal", "discount", "increase", "tax", "grand_total", "payments",
  "notes", "footer_text",
];

// Page-only additions: `watermark` is an absolutely-positioned overlay so its
// position in the order doesn't affect layout — placed first for clarity.
// `signature_lines` is a footer element, placed after notes/footer/qr/barcode.
export const DEFAULT_ORDER = {
  roll: [...COMMON, "receiver_signature", "vendor_branding"],
  // Page must stay a superset of roll — a roll-only block silently disappears
  // when the same doc is printed on A4/A5 otherwise.
  page: ["watermark", ...COMMON, "receiver_signature", "signature_lines", "vendor_branding"],

  // Report scopes default orders
  bank_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date", "customer",
    "bank_statement_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  daily_treasury: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "daily_treasury_metrics",
    "daily_treasury_summaries",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  ajal_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date", "ajal_party",
    "ajal_statement_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  ajal_schedule: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date", "ajal_party",
    "ajal_schedule_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  ajal_full_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "ajal_full_statement_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  cheque_register: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "cheque_register_metrics",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  payment_methods_report: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "payment_methods_report_metrics",
    "payment_methods_by_method",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  reports_generic: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "report_table",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  account_statement: [
    "watermark", "logo", "company_name", "branch", "address", "tax_id",
    "doc_title", "doc_number", "doc_date",
    "account_statement_party",
    "account_statement_ledger",
    "account_statement_summary",
    "notes", "footer_text", "signature_lines", "vendor_branding",
  ],
  branch_transfer: {
    roll: [
      "logo", "company_name", "branch", "address", "tax_id",
      "doc_number", "doc_date",
      "items_table",
      "notes", "footer_text", "receiver_signature", "vendor_branding",
    ],
    page: [
      "watermark", "logo", "company_name", "branch", "address", "tax_id",
      "doc_title", "doc_number", "doc_date",
      "items_table",
      "notes", "footer_text", "signature_lines", "receiver_signature", "vendor_branding",
    ]
  },

  kitchen_ticket: {
    roll: [
      "kitchen_order_header", "kitchen_order_meta",
      "kitchen_items", "kitchen_notes", "kitchen_order_footer", "vendor_branding",
    ],
    page: [
      "watermark", "kitchen_order_header", "kitchen_order_meta",
      "kitchen_items", "kitchen_notes", "kitchen_order_footer", "signature_lines", "vendor_branding",
    ],
  },

  owner_statement: {
    page: [
      "watermark", "logo", "company_name", "branch", "address", "tax_id",
      "doc_title", "doc_number", "doc_date",
      "owner_dashboard_metrics",
      "owner_assets_liabilities",
      "owner_revenue_breakdown",
      "owner_expense_categories",
      "owner_payment_flow",
      "owner_net_profit",
      "owner_period_comparison",
      "notes", "footer_text", "signature_lines", "vendor_branding",
    ],
  },
};

