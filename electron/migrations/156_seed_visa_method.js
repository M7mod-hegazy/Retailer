// Seeds the permanent "فيزا" (Visa) payment method.
//
// Visa is reworked from a special-cased "bank_transfer" tender into a permanent,
// record-only payment_method that behaves exactly like the digital wallets
// (Vodafone Cash, InstaPay): money is recorded as received but moves NO balance
// (target_id = NULL), it is excluded from the cash drawer, and it never requires
// a customer. It is marked is_system = 1 so it can't be deleted from the
// payment-methods UI (like نقدي / أجل), and category = 'card' is the stable marker
// the POS uses to find it (cash -> 'cash', credit -> 'credit', this -> 'card').
//
// Idempotent: only inserts when no system card method already exists. Does NOT
// hardcode an id (ids 1/2 are taken by نقدي/أجل) — it is matched by category.
exports.up = function (db) {
  // Ensure the columns this row relies on exist (older schemas).
  try { db.exec("ALTER TABLE payment_methods ADD COLUMN is_system INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE payment_methods ADD COLUMN excludes_from_treasury INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE payment_methods ADD COLUMN category TEXT DEFAULT 'cash';"); } catch (_) {}
  try { db.exec("ALTER TABLE payment_methods ADD COLUMN icon TEXT DEFAULT '💳';"); } catch (_) {}
  try { db.exec("ALTER TABLE payment_methods ADD COLUMN description TEXT;"); } catch (_) {}

  const existing = db
    .prepare("SELECT id FROM payment_methods WHERE is_system = 1 AND category = 'card'")
    .get();
  if (existing) return;

  db.prepare(
    `INSERT INTO payment_methods
       (name, type, target_id, is_active, is_system, excludes_from_treasury, category, icon, description)
     VALUES (?, 'card', NULL, 1, 1, 1, 'card', '💳', ?)`
  ).run("فيزا", "مدى / فيزا / تحويل بنكي — يُسجَّل خارج الخزينة");
};
