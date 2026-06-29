// The bank/visa rebuild removes "bank" as a payment channel. Any legacy
// non-system payment_methods rows of type/category 'bank' (e.g. "تحويل بنكي")
// are deactivated so they stop appearing in POS, the daily-treasury per-method
// cards, expense/revenue pickers, and reports. Their historical transactions are
// untouched (payments store the method by name), this only hides the method going
// forward. Visa replaces them as the record-only card tender (migration 156).
exports.up = function (db) {
  try {
    db.prepare(
      "UPDATE payment_methods SET is_active = 0 WHERE is_system = 0 AND (type = 'bank' OR category = 'bank')"
    ).run();
  } catch (_) {}
};
