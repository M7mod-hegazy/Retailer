const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("./dailySessionService");
const { getSnapshotCosts } = require("./waccService");

function generateAmendmentDocNo(originalDocNo, db, table) {
  const base = originalDocNo.replace(/-A\d+$/, "");
  const existing = db.prepare(
    `SELECT doc_no FROM ${table} WHERE doc_no LIKE ? ORDER BY CAST(SUBSTR(doc_no, INSTR(doc_no, '-A') + 2) AS INTEGER) DESC LIMIT 1`
  ).get(`${base}-A%`);
  if (!existing) return `${base}-A1`;
  const num = parseInt(existing.doc_no.match(/-A(\d+)$/)[1]) + 1;
  return `${base}-A${num}`;
}

function createReturn(invoiceId, payload) {
  const db = getDb();

  return db.transaction(() => {
    const createdDate = normalizeDate(payload.created_at);
    assertCanWriteForDate(db, createdDate);
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) {
      const err = new Error("Invoice not found");
      err.status = 404;
      throw err;
    }

    let total = 0;
    const preparedLines = [];

    for (const requestedLine of payload.lines || []) {
      const invoiceLine = db
        .prepare("SELECT * FROM invoice_lines WHERE id = ? AND invoice_id = ?")
        .get(requestedLine.invoice_line_id, invoiceId);

      if (!invoiceLine) {
        const err = new Error("Invoice line not found");
        err.status = 404;
        throw err;
      }

      const previousReturned =
        db
          .prepare(
            "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM sales_return_lines WHERE invoice_line_id = ? AND sales_return_id IN (SELECT id FROM sales_returns WHERE status != 'cancelled')",
          )
          .get(invoiceLine.id).quantity || 0;

      const remaining = invoiceLine.quantity - previousReturned;
      if (requestedLine.quantity <= 0 || requestedLine.quantity > remaining) {
        const err = new Error("Invalid return quantity");
        err.status = 400;
        throw err;
      }

      const lineTotal = invoiceLine.unit_price * requestedLine.quantity;
      total += lineTotal;

      // Snapshot costs + names
      const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(invoiceLine.item_id);
      const snap = getSnapshotCosts(invoiceLine.item_id, db);
      preparedLines.push({
        invoice_line_id: invoiceLine.id,
        item_id: invoiceLine.item_id,
        quantity: requestedLine.quantity,
        unit_price: invoiceLine.unit_price,
        line_total: lineTotal,
        // warehouse from original invoice line (Option A)
        warehouse_id: invoiceLine.warehouse_id || 1,
        item_name_ar: itemRow?.name    || invoiceLine.item_name_ar || null,
        item_name_en: itemRow?.name_en || invoiceLine.item_name_en || null,
        cost_wacc:          snap.cost_wacc,
        cost_last_purchase: snap.cost_last_purchase,
      });
    }

    const docNo = generateDocNumber('sales_return');
    const result = db
      .prepare(
        "INSERT INTO sales_returns (doc_no, invoice_id, customer_id, total, reason, refund_method, notes, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
      )
      .run(
        docNo,
        invoiceId,
        invoice.customer_id || null,
        total,
        payload.reason || null,
        payload.refund_method || "cash_back",
        payload.notes || null,
        payload.user_id || null,
        `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
      );

    const returnId = result.lastInsertRowid;

    for (const line of preparedLines) {
      db.prepare(
        `INSERT INTO sales_return_lines
          (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total,
           warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(returnId, line.invoice_line_id, line.item_id, line.quantity,
            line.unit_price, line.line_total, line.warehouse_id,
            line.item_name_ar, line.item_name_en, line.cost_wacc, line.cost_last_purchase);

      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id,
        quantityDelta: line.quantity,
        movement_type: "sales_return",
        reference_type: "sales_return",
        reference_id: returnId,
      });
    }

    if (invoice.customer_id && (invoice.payment_type === "credit" || payload.refund_method === "credit_note")) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(
        total, invoice.customer_id,
      );
      db.prepare("UPDATE ajal_debts SET original_amount = original_amount - ? WHERE invoice_id = ? AND status = 'open'").run(
        total, invoiceId,
      );
    } else if (invoice.payment_type === "bank_transfer" && invoice.bank_id) {
      db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(total, invoice.bank_id);
    } else if (invoice.payment_type === "multi") {
      const allocations = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      const invoiceTotal = Number(invoice.total) || 1;
      for (const alloc of allocations) {
        const portion = (Number(alloc.amount) / invoiceTotal) * total;
        if (alloc.method === "cash" && alloc.treasury_id) {
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(portion, alloc.treasury_id);
        } else if (alloc.method === "bank" && alloc.bank_id) {
          db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(portion, alloc.bank_id);
        }
      }
    } else if (invoice.payment_type === "cash" || payload.refund_method === "cash_back") {
      const treasuryId =
        payload.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (treasuryId) {
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(total, treasuryId);
      }
    }

    const invoiceLines = db.prepare("SELECT id, quantity FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);
    const fullyReturned = invoiceLines.every((line) => {
      const returnedQty =
        db.prepare(
          "SELECT COALESCE(SUM(srl.quantity), 0) AS quantity FROM sales_return_lines srl JOIN sales_returns sr ON sr.id = srl.sales_return_id WHERE srl.invoice_line_id = ? AND sr.status != 'cancelled'"
        ).get(line.id).quantity || 0;
      return returnedQty >= line.quantity;
    });
    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(
      fullyReturned ? "returned" : "partially_returned",
      invoiceId,
    );

    return db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
  })();
}

function createGeneralReturn(payload) {
  const db = getDb();
  return db.transaction(() => {
    const { lines, customer_id, refund_method, notes, reason, user_id, treasury_id } = payload;
    if (!lines || !lines.length) { const e = new Error("يجب إضافة أصناف"); e.status = 400; throw e; }

    const docNo = generateDocNumber('sales_return');
    let total = 0;
    for (const line of lines) total += Number(line.quantity) * Number(line.unit_price);

    const ret = db.prepare(
      "INSERT INTO sales_returns (doc_no, invoice_id, customer_id, total, refund_method, reason, notes, status, created_by, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, 'active', ?, datetime('now', 'localtime'))"
    ).run(docNo, customer_id || null, total, refund_method || 'cash_back', reason || 'other', notes || null, user_id || null);

    const returnId = ret.lastInsertRowid;

    for (const line of lines) {
      const lineTotal = Number(line.quantity) * Number(line.unit_price);
      const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(line.item_id);
      const snap = getSnapshotCosts(line.item_id, db);
      const warehouseId = Number(line.warehouse_id || 1);

      db.prepare(
        `INSERT INTO sales_return_lines
          (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total,
           warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(returnId, line.item_id, line.quantity, line.unit_price, lineTotal,
            warehouseId, itemRow?.name || null, itemRow?.name_en || null,
            snap.cost_wacc, snap.cost_last_purchase);

      adjustStock({ item_id: line.item_id, warehouse_id: warehouseId, quantityDelta: Number(line.quantity), movement_type: "sales_return", reference_type: "sales_return", reference_id: returnId });
    }

    if (refund_method === 'cash_back' || !refund_method) {
      const tId = treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(total, tId);
    } else if (refund_method === 'credit_note' && customer_id) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(total, customer_id);
    }

    return { id: returnId, doc_no: docNo, total };
  })();
}

function cancelSalesReturn(returnId, reason, userId) {
  if (!reason || !reason.trim()) { const e = new Error("سبب الإلغاء مطلوب"); e.status = 400; throw e; }
  const db = getDb();
  return db.transaction(() => {
    const sr = db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
    if (!sr) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
    if (sr.status === 'cancelled') { const e = new Error("المرتجع ملغى بالفعل"); e.status = 400; throw e; }
    if (sr.amended_by) { const e = new Error("هذا المرتجع عُدِّل بالفعل"); e.status = 400; throw e; }

    const lines = db.prepare("SELECT * FROM sales_return_lines WHERE sales_return_id = ?").all(returnId);

    // Reverse stock (remove what was added back)
    for (const line of lines) {
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: -line.quantity,
        movement_type: "cancel_sales_return",
        reference_type: "sales_return",
        reference_id: returnId,
      });
    }

    // Reverse financials
    const refundMethod = sr.refund_method;
    if (refundMethod === 'cash_back') {
      const tId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(sr.total, tId);
    } else if (refundMethod === 'credit_note' && sr.customer_id) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(sr.total, sr.customer_id);
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE sales_returns SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
      .run(now, userId || null, reason.trim(), returnId);

    // Recalculate original invoice status if linked
    if (sr.invoice_id) {
      const { recalculateInvoiceStatus } = require("./invoiceService");
      try { recalculateInvoiceStatus(db, sr.invoice_id); } catch (_) {}
    }

    try {
      db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
        userId || 1, "sales_return", returnId, "cancel", JSON.stringify({ reason })
      );
    } catch (_) {}

    return db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
  })();
}

function amendSalesReturn(returnId, payload, userId) {
  if (!payload.reason || !payload.reason.trim()) { const e = new Error("سبب التعديل مطلوب"); e.status = 400; throw e; }
  const db = getDb();

  const original = db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
  if (!original) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
  if (original.status === 'cancelled') { const e = new Error("لا يمكن تعديل مرتجع ملغى"); e.status = 400; throw e; }
  if (original.amended_by) { const e = new Error("هذا المرتجع عُدِّل بالفعل — انظر المرتجع الجديد"); e.status = 400; throw e; }

  return db.transaction(() => {
  // Cancel original
  cancelSalesReturn(returnId, `تعديل — ${payload.reason.trim()}`, userId);

  // Create new return
  const newPayload = { ...payload, user_id: userId };
  delete newPayload.reason;

  let newReturn;
  if (original.invoice_id && !payload.is_general) {
    newReturn = createReturn(original.invoice_id, newPayload);
  } else {
    newReturn = createGeneralReturn(newPayload);
  }

  // Override doc_no with amendment suffix
  const newDocNo = generateAmendmentDocNo(original.doc_no, db, "sales_returns");
  db.prepare("UPDATE sales_returns SET doc_no = ?, amendment_of = ? WHERE id = ?")
    .run(newDocNo, original.id, newReturn.id);

  // Link original → new
  db.prepare("UPDATE sales_returns SET amended_by = ? WHERE id = ?").run(newReturn.id, original.id);

  try {
    db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
      userId || 1, "sales_return", original.id, "amend", JSON.stringify({ new_return_id: newReturn.id, reason: payload.reason })
    );
  } catch (_) {}

  return {
    original: db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(original.id),
    new_return: db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(newReturn.id),
  };
  })();
}

function getReturns() {
  const db = getDb();
  return db.prepare(`
    SELECT sr.*, c.name as customer_name, i.invoice_no as original_invoice_no
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN invoices i ON i.id = sr.invoice_id
    ORDER BY sr.id DESC
  `).all();
}

function getReturnDetails(id) {
  const db = getDb();
  const sr = db.prepare(`
    SELECT sr.*,
           c.name AS customer_name,
           i.invoice_no AS original_invoice_no,
           (SELECT doc_no FROM sales_returns WHERE id = sr.amendment_of) AS amendment_of_no,
           (SELECT doc_no FROM sales_returns WHERE id = sr.amended_by)   AS amended_by_no
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN invoices i ON i.id = sr.invoice_id
    WHERE sr.id = ?
  `).get(id);
  if (!sr) return null;
  const lines = db.prepare(`
    SELECT srl.*, COALESCE(srl.item_name_ar, i.name) as item_name
    FROM sales_return_lines srl
    LEFT JOIN items i ON i.id = srl.item_id
    WHERE srl.sales_return_id = ?
  `).all(id);
  return { ...sr, lines };
}

function editSalesReturn(returnId, payload, userId) {
  const db = getDb();
  return db.transaction(() => {
    const sr = db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
    if (!sr) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
    if (sr.status === "cancelled") { const e = new Error("لا يمكن تعديل مرتجع ملغى"); e.status = 400; throw e; }

    const oldLines = db.prepare("SELECT * FROM sales_return_lines WHERE sales_return_id = ?").all(returnId);

    // 1. Reverse old stock
    for (const line of oldLines) {
      adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: -line.quantity, movement_type: "cancel_sales_return", reference_type: "sales_return", reference_id: returnId });
    }

    // 2. Reverse old financials
    if (sr.refund_method === "cash_back") {
      const tId = sr.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(sr.total, tId);
    } else if (sr.refund_method === "credit_note" && sr.customer_id) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(sr.total, sr.customer_id);
    }

    // 3. Build new lines
    const newLines = payload.lines || [];
    let newTotal = 0;
    const preparedLines = [];

    for (const requestedLine of newLines) {
      if (!sr.invoice_id) {
        const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(requestedLine.item_id);
        const snap = getSnapshotCosts(requestedLine.item_id, db);
        const lineTotal = Number(requestedLine.quantity) * Number(requestedLine.unit_price);
        newTotal += lineTotal;
        preparedLines.push({ invoice_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_price: Number(requestedLine.unit_price), line_total: lineTotal, warehouse_id: payload.warehouse_id || 1, item_name_ar: itemRow?.name || null, item_name_en: itemRow?.name_en || null, cost_wacc: snap.cost_wacc, cost_last_purchase: snap.cost_last_purchase });
      } else {
        const invoiceLine = db.prepare("SELECT * FROM invoice_lines WHERE id = ? AND invoice_id = ?").get(requestedLine.invoice_line_id, sr.invoice_id);
        if (!invoiceLine) continue;
        const previousReturned = db.prepare(
          "SELECT COALESCE(SUM(srl.quantity), 0) AS quantity FROM sales_return_lines srl JOIN sales_returns sr2 ON sr2.id = srl.sales_return_id WHERE srl.invoice_line_id = ? AND sr2.status != 'cancelled' AND sr2.id != ?"
        ).get(invoiceLine.id, returnId).quantity || 0;
        const remaining = invoiceLine.quantity - previousReturned;
        const qty = Math.min(Number(requestedLine.quantity), remaining);
        if (qty <= 0) continue;
        const lineTotal = invoiceLine.unit_price * qty;
        newTotal += lineTotal;
        preparedLines.push({ invoice_line_id: invoiceLine.id, item_id: invoiceLine.item_id, quantity: qty, unit_price: invoiceLine.unit_price, line_total: lineTotal, warehouse_id: payload.warehouse_id || invoiceLine.warehouse_id || 1, item_name_ar: invoiceLine.item_name_ar, item_name_en: invoiceLine.item_name_en, cost_wacc: invoiceLine.cost_wacc, cost_last_purchase: invoiceLine.cost_last_purchase });
      }
    }

    // 4. Delete old lines, insert new
    db.prepare("DELETE FROM sales_return_lines WHERE sales_return_id = ?").run(returnId);
    for (const line of preparedLines) {
      db.prepare(
        `INSERT INTO sales_return_lines (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total, warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(returnId, line.invoice_line_id, line.item_id, line.quantity, line.unit_price, line.line_total, line.warehouse_id, line.item_name_ar, line.item_name_en, line.cost_wacc || 0, line.cost_last_purchase || 0);
      adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id, quantityDelta: line.quantity, movement_type: "sales_return", reference_type: "sales_return", reference_id: returnId });
    }

    // 5. Apply new financials
    const newRefundMethod = payload.refund_method || sr.refund_method;
    const newTreasuryId = payload.treasury_id || sr.treasury_id;
    const newCustomerId = payload.customer_id || sr.customer_id;
    if (newRefundMethod === "cash_back") {
      const tId = newTreasuryId || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(newTotal, tId);
    } else if (newRefundMethod === "credit_note" && newCustomerId) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(newTotal, newCustomerId);
    }

    // 6. Update header — preserve doc_no and created_at
    db.prepare(
      "UPDATE sales_returns SET total = ?, refund_method = ?, warehouse_id = ?, customer_id = ?, reason = ?, notes = ?, treasury_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(newTotal, newRefundMethod, payload.warehouse_id || sr.warehouse_id, newCustomerId, payload.reason || sr.reason, payload.notes || sr.notes, newTreasuryId || null, returnId);

    // 7. Recalculate linked invoice status
    if (sr.invoice_id) {
      const { recalculateInvoiceStatus } = require("./invoiceService");
      try { recalculateInvoiceStatus(db, sr.invoice_id); } catch (_) {}
    }

    try {
      db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(userId || 1, "sales_return", returnId, "edit", JSON.stringify({ lines_count: preparedLines.length, total: newTotal }));
    } catch (_) {}

    return getReturnDetails(returnId);
  })();
}

module.exports = { createReturn, createGeneralReturn, getReturns, getReturnDetails, cancelSalesReturn, amendSalesReturn, editSalesReturn };
