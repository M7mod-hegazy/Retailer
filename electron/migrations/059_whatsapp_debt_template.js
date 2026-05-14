module.exports = {
  up(db) {
    db.exec(`
      INSERT OR IGNORE INTO settings_kv (key, value) VALUES
        ('whatsapp_debt_template', 'مرحباً {name}، نذكركم بأن لديكم دين بقيمة {amount} ج.م بتاريخ استحقاق {due_date}. نرجو السداد في أقرب وقت. شكراً لكم.');
    `);
  },
  down(db) {
    db.exec(`DELETE FROM settings_kv WHERE key = 'whatsapp_debt_template';`);
  },
};
