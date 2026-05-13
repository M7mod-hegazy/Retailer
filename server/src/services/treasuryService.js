const { getDb } = require("../config/database");

function transferTreasury({ source_id, destination_id, amount, reference, notes, user_id }) {
  const db = getDb();
  const transferAmount = Number(amount || 0);

  if (!source_id || !destination_id || transferAmount <= 0) {
    const error = new Error("Source, destination, and valid amount are required.");
    error.status = 400;
    throw error;
  }

  if (Number(source_id) === Number(destination_id)) {
    const error = new Error("Source and destination treasuries must differ.");
    error.status = 400;
    throw error;
  }

  return db.transaction(() => {
    // 1. Check source balance
    const sourceTreasury = db.prepare("SELECT * FROM treasuries WHERE id = ?").get(source_id);
    if (!sourceTreasury) {
      const error = new Error("Source treasury not found.");
      error.status = 404;
      throw error;
    }

    if (sourceTreasury.balance < transferAmount) {
      const error = new Error("Insufficient funds in source treasury.");
      error.status = 400;
      throw error;
    }

    // 2. Check destination
    const destTreasury = db.prepare("SELECT * FROM treasuries WHERE id = ?").get(destination_id);
    if (!destTreasury) {
      const error = new Error("Destination treasury not found.");
      error.status = 404;
      throw error;
    }

    const now = new Date().toISOString();

    // 3. Deduct from source
    db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(transferAmount, source_id);

    // 4. Add to destination
    db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(transferAmount, destination_id);

    // 5. Create transfer record (if operations table existed, but we'll use audit log and simple returning for now, assuming movements table is coming later)
    // We log it as an audit log entry for now since there's no treasury_movements table specified in the schema
    const auditQuery = db.prepare(
      "INSERT INTO audit_logs (user_id, resource, action, payload_json) VALUES (?, ?, ?, ?)"
    );

    const auditDetails = JSON.stringify({
      from: sourceTreasury.name,
      to: destTreasury.name,
      amount: transferAmount,
      reference: reference || "",
      notes: notes || ""
    });

    try {
      auditQuery.run(user_id || null, "treasury_transfer", "transfer", auditDetails);
    } catch (e) {
        // if audit logs doesn't exist yet, ignore
    }

    return {
      success: true,
      data: {
        source_id,
        destination_id,
        amount: transferAmount,
        date: now
      }
    };
  })();
}

module.exports = { transferTreasury };
