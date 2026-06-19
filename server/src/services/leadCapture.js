const { normalizeDigits } = require("../utils/phone");

// Capture a lead from a completing sale. Runs INSIDE the invoice transaction.
// Only fires for anonymous sales (no customer_id) where the cashier typed a WhatsApp number.
// Must never throw in a way that fails the sale — caller wraps in try/catch, but we also guard here.
function captureLeadFromSale(db, payload, normalizedLines) {
  try {
    const cap = payload && payload.lead_capture;
    if (!cap || !cap.phone) return;
    if (payload.customer_id) return; // real customer → already in customers, not a lead

    const norm = normalizeDigits(cap.phone);
    if (!norm) return; // invalid number → skip silently, never block the sale

    // Derive last-purchase context from the first line (best-effort).
    const first = (normalizedLines && normalizedLines[0]) || null;
    const lastItem = first ? first.item_name_ar || null : null;
    let lastCategory = null;
    if (first && first.item_id) {
      try {
        const row = db
          .prepare("SELECT c.name AS cat FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE i.id = ?")
          .get(first.item_id);
        lastCategory = row?.cat || null;
      } catch (_) {}
    }

    const name = cap.name && String(cap.name).trim() ? String(cap.name).trim() : null;

    db.prepare(`
      INSERT INTO leads (phone_normalized, phone_raw, name, source, last_purchase_item, last_purchase_category)
      VALUES (?, ?, ?, 'pos_sale', ?, ?)
      ON CONFLICT(phone_normalized) DO UPDATE SET
        name = COALESCE(leads.name, excluded.name),
        last_purchase_item = excluded.last_purchase_item,
        last_purchase_category = excluded.last_purchase_category,
        updated_at = datetime('now', 'localtime')
    `).run(norm, String(cap.phone), name, lastItem, lastCategory);
  } catch (_) {
    // swallow — lead capture must never break invoice creation
  }
}

module.exports = { captureLeadFromSale };
