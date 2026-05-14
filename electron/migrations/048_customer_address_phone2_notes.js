function up(db) {
  // Add columns for additional phones, addresses, and notes
  // additional_phones and addresses stored as pipe-separated values
  try { db.exec("ALTER TABLE customers ADD COLUMN additional_phones TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE customers ADD COLUMN addresses TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE customers ADD COLUMN notes TEXT"); } catch (_) {}
}

module.exports = { up };
