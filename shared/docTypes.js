// Single source of truth for printable document types.
// Imported by server (CommonJS) and client (via ESM interop in Vite).
const DOC_TYPES = [
  "pos_receipt", "purchase_order", "sales_return", "purchase_return",
  "quotation", "branch_transfer", "bank_statement", "ajal_statement", "ajal_schedule",
  "ajal_full_statement", "cheque_register", "payment_receipt", "daily_treasury",
  "payment_methods_report", "reports_generic", "owner_statement",
  "kitchen_ticket",
];


// Rows the print-settings store accepts: every doc type plus the pseudo-scope
// "_global" — the shared default layout every doc inherits unless it overrides.
// Kept separate so "_global" never leaks into doc-type pickers/iterators.
const LAYOUT_SCOPES = [...DOC_TYPES, "_global"];

module.exports = { DOC_TYPES, LAYOUT_SCOPES };
