// Single source of truth for printable document types.
// Imported by server (CommonJS) and client (via ESM interop in Vite).
const DOC_TYPES = [
  "pos_receipt", "sales_invoice", "purchase_order", "sales_return", "purchase_return",
  "quotation", "branch_transfer", "bank_statement", "ajal_statement", "ajal_schedule",
  "ajal_full_statement", "cheque_register", "payment_receipt", "daily_treasury",
  "payment_methods_report", "reports_generic",
];
module.exports = { DOC_TYPES };
