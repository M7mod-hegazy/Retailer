// Migration 214 — enriches the quit/logout owner-alert templates so each
// closing message includes the full "day details" snapshot (accumulative
// footer with cash in/out/net, credit, bank, per-method, expected_cash).
// Before this migration, APP_QUIT / USER_LOGOUT sent only a 4-line message
// (user / reason / time) — the owner expected the same end-of-day report
// they get on every other event.
//
// Also seeds telegram_below_cost_sale (previously invisible to the UI)
// and resets the daily_close short variant so its "reset to default"
// matches the seeded body (single line, not three).
function up(db) {
  const upd = db.prepare("UPDATE message_templates SET body = ?, updated_at = datetime('now') WHERE kind = ?");
  const syncActive = db.prepare(
    "UPDATE message_template_variants SET body = ?, updated_at = datetime('now') WHERE category = ? AND is_active = 1"
  );
  const insertTemplate = db.prepare(
    "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
  );
  const insertVariant = db.prepare(
    "INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at) VALUES (?, ?, ?, 'telegram', ?, datetime('now'))"
  );
  const delVariants = db.prepare("DELETE FROM message_template_variants WHERE category = ?");

  // ── telegram_app_quit ──────────────────────────────────────────────
  const appQuitDetailed = [
    "🛑 *إغلاق التطبيق*",
    "",
    "👤 المستخدم: *{user_name}*",
    "📝 السبب: *{trigger_reason}*",
    "⏰ الوقت: {time}",
    "",
    "{daily_accumulative_footer}",
  ].join("\n");
  const appQuitShort = "🛑 إغلاق التطبيق | {user_name} | {trigger_reason} | {time}\n{daily_accumulative_footer}";

  const existingQuit = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get("telegram_app_quit");
  if (existingQuit) {
    upd.run(appQuitDetailed, "telegram_app_quit");
  } else {
    insertTemplate.run("telegram_app_quit", "إغلاق التطبيق", appQuitDetailed);
  }
  delVariants.run("telegram_app_quit");
  insertVariant.run("telegram_app_quit", "قياسي — مفصل", appQuitDetailed, 1);
  insertVariant.run("telegram_app_quit", "مختصر — سريع", appQuitShort, 0);

  // ── telegram_user_logout ───────────────────────────────────────────
  const userLogoutDetailed = [
    "🚪 *تسجيل خروج*",
    "",
    "👤 المستخدم: *{user_name}*",
    "📝 السبب: *{trigger_reason}*",
    "⏰ الوقت: {time}",
    "",
    "{daily_accumulative_footer}",
  ].join("\n");
  const userLogoutShort = "🚪 تسجيل خروج | {user_name} | {trigger_reason} | {time}\n{daily_accumulative_footer}";

  const existingLogout = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get("telegram_user_logout");
  if (existingLogout) {
    upd.run(userLogoutDetailed, "telegram_user_logout");
  } else {
    insertTemplate.run("telegram_user_logout", "تسجيل خروج", userLogoutDetailed);
  }
  delVariants.run("telegram_user_logout");
  insertVariant.run("telegram_user_logout", "قياسي — مفصل", userLogoutDetailed, 1);
  insertVariant.run("telegram_user_logout", "مختصر — سريع", userLogoutShort, 0);

  // ── telegram_below_cost_sale ──────────────────────────────────────
  // Previously the backend referenced this category but no template was
  // seeded and the UI had no editor card for it — it always fell through to
  // the hardcoded default. Seed a template here so the owner can customise.
  const belowCostDetailed = [
    "⚠️ *بيع تحت التكلفة*",
    "",
    "🧾 الفاتورة: *#{invoice_no}*",
    "👤 العميل: *{customer_name}*",
    "📦 الصنف: *{item_name}*",
    "💵 سعر البيع: *{selling_price}*",
    "🏭 التكلفة: *{cost_price}*",
    "📉 الخسارة: *{loss_amount}* ({loss_percent}%)",
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n");
  const belowCostShort = "⚠️ بيع تحت التكلفة | #{invoice_no} | {item_name} | {loss_amount} | {user_name}";
  insertTemplate.run("telegram_below_cost_sale", "بيع تحت التكلفة", belowCostDetailed);
  delVariants.run("telegram_below_cost_sale");
  insertVariant.run("telegram_below_cost_sale", "قياسي — مفصل", belowCostDetailed, 1);
  insertVariant.run("telegram_below_cost_sale", "مختصر — سريع", belowCostShort, 0);

  // ── daily_close short variant — match the seeded 1-line body ──────
  // The UI's "reset to default" previously returned a 3-line short body
  // (`📅 ...\n💵 نقداً: ...\n⚠️ فرق: ...`) while migration 213 seeds a
  // 1-line body (`📅 إغلاق يومية {date} | فرق: {discrepancy}`). Re-align
  // the seeded body with the UI default so reset does not change the body.
  const dailyCloseShort = "📅 إغلاق يومية {date} | فرق: {discrepancy}";
  const dcShortVariant = db.prepare(
    "SELECT 1 FROM message_template_variants WHERE category = ? AND label = ?"
  ).get("telegram_daily_close", "مختصر — سريع");
  if (dcShortVariant) {
    db.prepare(
      "UPDATE message_template_variants SET body = ?, updated_at = datetime('now') WHERE category = ? AND label = ?"
    ).run(dailyCloseShort, "telegram_daily_close", "مختصر — سريع");
  } else {
    insertVariant.run("telegram_daily_close", "مختصر — سريع", dailyCloseShort, 0);
  }
}

module.exports = { up, name: "214_quit_logout_day_report" };