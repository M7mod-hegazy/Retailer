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
  roll: [...COMMON],
  page: ["watermark", ...COMMON, "signature_lines"],
};
