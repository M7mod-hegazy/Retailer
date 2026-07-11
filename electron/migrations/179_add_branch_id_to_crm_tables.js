// Adds branch_id to customers and leads for per-branch data isolation in the
// WhatsApp CRM. All three tables need branch scoping so Branch A staff only see
// Branch A's contacts and conversations.
module.exports = {
  name: "179_add_branch_id_to_crm_tables",
  up(db) {
    const hasCol = (table, col) =>
      db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);

    if (!hasCol("customers", "branch_id")) {
      db.prepare("ALTER TABLE customers ADD COLUMN branch_id INTEGER REFERENCES branches(id)").run();
    }
    if (!hasCol("leads", "branch_id")) {
      db.prepare("ALTER TABLE leads ADD COLUMN branch_id INTEGER REFERENCES branches(id)").run();
    }
    if (!hasCol("wa_conversations", "branch_id")) {
      db.prepare("ALTER TABLE wa_conversations ADD COLUMN branch_id INTEGER REFERENCES branches(id)").run();
    }

    // Backfill existing conversations with branch_id from the matching customer or lead
    const nullConvs = db.prepare("SELECT id, phone_normalized FROM wa_conversations WHERE branch_id IS NULL").all();
    let updated = 0;
    for (const conv of nullConvs) {
      const phone = conv.phone_normalized;
      const cust = db.prepare("SELECT branch_id FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','')=? AND branch_id IS NOT NULL LIMIT 1").get(phone);
      if (cust?.branch_id) {
        db.prepare("UPDATE wa_conversations SET branch_id=? WHERE id=?").run(cust.branch_id, conv.id);
        updated++;
        continue;
      }
      const lead = db.prepare("SELECT branch_id FROM leads WHERE phone_normalized=? AND branch_id IS NOT NULL LIMIT 1").get(phone);
      if (lead?.branch_id) {
        db.prepare("UPDATE wa_conversations SET branch_id=? WHERE id=?").run(lead.branch_id, conv.id);
        updated++;
      }
    }
    console.log(`[179] Backfilled branch_id for ${updated}/${nullConvs.length} conversations`);
  },
};
