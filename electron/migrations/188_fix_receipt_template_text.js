// Fix receipt (sale) templates that incorrectly say "فاتورة شراء" (purchase receipt)
// instead of "فاتورة بيع" (sale receipt). Updates both message_templates and
// message_template_variants tables for existing databases.
module.exports = {
  up(db) {
    // Fix message_templates.body where kind='receipt'
    db.prepare(`
      UPDATE message_templates
      SET body = REPLACE(body, 'فاتورة شراء', 'فاتورة بيع'),
          updated_at = datetime('now')
      WHERE kind = 'receipt' AND body LIKE '%فاتورة شراء%'
    `).run();

    // Fix message_template_variants.body where category='receipt'
    db.prepare(`
      UPDATE message_template_variants
      SET body = REPLACE(body, 'فاتورة شراء', 'فاتورة بيع'),
          updated_at = datetime('now')
      WHERE category = 'receipt' AND body LIKE '%فاتورة شراء%'
    `).run();
  },
};
