function up(db) {
  try { db.exec("ALTER TABLE suppliers ADD COLUMN additional_phones TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN addresses TEXT"); } catch (_) {}
}

module.exports = { up };
