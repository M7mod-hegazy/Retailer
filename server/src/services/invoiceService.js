const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");
const { calculateEarnedPoints, earnPointsForInvoice } = require("./loyaltyService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("./dailySessionService");
const { getSnapshotCosts } = require("./waccService");

function generateInvoiceNumber(db) {
  const settings = db.prepare("SELECT branch_code, invoice_prefix FROM settings WHERE id = 1").get() || {};
  const prefix = settings.invoice_prefix || "INV-";
  const branch = settings.branch_code ? `${settings.branch_code}-` : "";
  const count = db.prepare("SELECT COUNT(*) AS total FROM invoices").get().total + 1;
  return `${prefix}${branch}${String(count).padStart(6, "0")}`;
}

function recalculateInvoiceStatus(db, invoiceId) {
  const invoice = db.prepare(`
    SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
           (SELECT invoice_no FROM invoices WHERE id = i.amendment_of) AS amendment_of_no,
           (SELECT invoice_no FROM invoices WHERE id = i.amended_by)   AS amended_by_no
    FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `).get(invoiceId);
  if (!invoice) return null;

  const allocated = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_allocations WHERE invoice_id = ?")
    .get(invoiceId).total;

  const outstanding = Math.max(0, invoice.total - allocated);
  // Never override terminal states — cancelled/amended invoices stay cancelled.
  const status = (invoice.status === "cancelled" || invoice.amended_by)
    ? "cancelled"
    : outstanding === 0 ? "paid" : allocated > 0 ? "partial" : invoice.payment_type === "credit" ? "unpaid" : invoice.status;

  const becomesPaid = status === "paid" && invoice.status !== "paid";
  if (becomesPaid) {
    db.prepare("UPDATE invoices SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, invoiceId);
  } else {
    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, invoiceId);
  }
  return { ...invoice, status, allocated, outstanding };
}

function getInvoiceWithLines(invoiceId) {
  const db = getDb();
  const invoice = db.prepare(`
    SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
           u.username AS created_by_username
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.id = i.user_id
    WHERE i.id = ?
  `).get(invoiceId);
  if (!invoice) return null;

  const lines = db
    .prepare(
      `SELECT il.*, i.name AS item_name, i.barcode, i.code AS item_code, i.purchase_price
              ,COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl WHERE srl.invoice_line_id = il.id), 0) AS returned_quantity
       FROM invoice_lines il
       LEFT JOIN items i ON i.id = il.item_id
       WHERE il.invoice_id = ?
       ORDER BY il.id ASC`,
    )
    .all(invoiceId);

  const allocations = db
    .prepare(`
      SELECT pa.*, p.method AS method,
             (SELECT pm.name FROM payment_methods pm
              WHERE pm.type = p.method OR pm.category = p.method OR pm.name = p.method
              LIMIT 1) AS method_name
      FROM payment_allocations pa
      LEFT JOIN payments p ON p.id = pa.payment_id
      WHERE pa.invoice_id = ?
      ORDER BY pa.id ASC
    `)
    .all(invoiceId);

  // Remaining unpaid debt tied to this invoice (will be reversed on cancel/amend)
  const ajalDebt = db.prepare(
    "SELECT original_amount, paid_amount FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice' AND status != 'voided' ORDER BY id DESC LIMIT 1"
  ).get(invoiceId);
  const debt_remaining = ajalDebt
    ? Math.max(0, Number(ajalDebt.original_amount) - Number(ajalDebt.paid_amount || 0))
    : 0;

  return {
    ...recalculateInvoiceStatus(db, invoiceId),
    created_by_username: invoice.created_by_username || null,
    lines: lines.map((line) => ({
      ...line,
      returnable_quantity: Math.max(0, line.quantity - (line.returned_quantity || 0)),
    })),
    allocations,
    payments: allocations.map((allocation) => ({
      method: allocation.method,
      method_name: allocation.method_name || allocation.method,
      amount: allocation.amount,
    })),
    debt_remaining,
  };
}

function createInvoice(payload) {
  const db = getDb();
  const tx = db.transaction(() => {
    const createdDate = normalizeDate(payload.created_at);
    assertCanWriteForDate(db, createdDate);
    const invoiceNo = generateDocNumber('pos_sale');
    let subtotal = 0;
    const lineErrors = [];

    const normalizedLines = (payload.lines || []).map((line, index) => {
      const quantity = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price || 0);
      const lineDiscount = Number(line.discount || 0);
      const itemId = Number(line.item_id || 0);
      const warehouseId = Number(line.warehouse_id || payload.warehouse_id || 1);
      const item = db.prepare("SELECT id, name, name_en, barcode, purchase_price FROM items WHERE id = ?").get(itemId);
      const stockRow = db
        .prepare("SELECT quantity, wacc, last_purchase_cost FROM stock_levels WHERE item_id = ? AND warehouse_id = ?")
        .get(itemId, warehouseId);
      const currentStock = Number(stockRow?.quantity || 0);
      // Use WACC as true cost basis; fall back to last_purchase_cost then items.purchase_price
      const trueCost = Number(stockRow?.wacc || stockRow?.last_purchase_cost || item?.purchase_price || 0);
      const snapshotCosts = getSnapshotCosts(itemId, db);

      if (!item) lineErrors.push(`الصنف غير موجود (سطر ${index + 1})`);
      if (!Number.isFinite(quantity) || quantity <= 0) lineErrors.push(`الكمية غير صالحة في السطر ${index + 1}`);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) lineErrors.push(`السعر يجب أن يكون أكبر من صفر في السطر ${index + 1}`);
      if (quantity > currentStock) lineErrors.push(`المخزون غير كافٍ للصنف ${item?.name || itemId} (المتاح ${currentStock})`);
      // Soft warning: flag below-cost sales instead of hard blocking
      const isBelowCost = trueCost > 0 && unitPrice < trueCost;
      if (isBelowCost && !payload.allow_loss_sale) {
        // Log the below-cost attempt to audit_logs for daily review
        try {
          db.prepare(
            "INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)"
          ).run(
            payload.user_id || null, "invoice_line", itemId, "below_cost_sale",
            JSON.stringify({ item_name: item?.name, unit_price: unitPrice, wacc: trueCost, deficit: trueCost - unitPrice })
          );
        } catch (_) {}
      }

      const rowSubtotal = quantity * unitPrice;
      subtotal += rowSubtotal;

      return {
        item_id: itemId,
        warehouse_id: warehouseId,
        quantity,
        unit_price: unitPrice,
        discount: lineDiscount,
        line_total: Math.max(0, rowSubtotal - lineDiscount),
        item_name_ar:       item?.name      || null,
        item_name_en:       item?.name_en   || null,
        barcode:            item?.barcode   || null,
        cost_wacc:          snapshotCosts.cost_wacc,
        cost_last_purchase: snapshotCosts.cost_last_purchase,
        is_below_cost:      isBelowCost,
      };
    });

    if (!normalizedLines.length) {
      const error = new Error("الفاتورة يجب أن تحتوي على صنف واحد على الأقل");
      error.status = 400;
      throw error;
    }
    if (lineErrors.length) {
      const error = new Error(lineErrors[0]);
      error.status = 400;
      error.code = "INVALID_INVOICE_LINES";
      error.data = { errors: lineErrors };
      throw error;
    }
    const discount = Number(payload.discount || 0);

    // GAP-02: Discount Hard Limits (max 15%)
    // Unless overridden by a supervisor
    const maxDiscountAllowed = subtotal * 0.15;
    if (discount > maxDiscountAllowed && !payload.supervisor_override) {
      const error = new Error("Discount exceeds the maximum allowed limit of 15%. Supervisor override required.");
      error.status = 403;
      error.code = 'DISCOUNT_LIMIT_EXCEEDED';
      throw error;
    }

    const increaseAmount = Math.max(0, Number(payload.increase || 0));
    const total = Math.max(0, subtotal - discount + increaseAmount);
    const paymentType = payload.payment_type || "cash";
    const multiPaid = paymentType === "multi" && Array.isArray(payload.payments)
      ? payload.payments.reduce((sum, line) => sum + Number(line.amount || 0), 0)
      : null;
    const amountPaid = Number(payload.amount_paid ?? multiPaid ?? total);
    const amountReceived = Number.isFinite(amountPaid) ? amountPaid : total;
    const remainingAmount = Math.max(0, total - Math.max(0, amountReceived));
    if (paymentType === "credit" && !payload.customer_id) {
      const err = new Error("يجب اختيار عميل عند البيع الآجل");
      err.status = 400;
      throw err;
    }

    const inv = db
      .prepare(
        "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, increase, total, payment_type, status, seller_id, user_id, amount_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        invoiceNo,
        payload.customer_id || null,
        subtotal,
        discount,
        increaseAmount,
        total,
        paymentType,
        remainingAmount > 0 ? (amountReceived > 0 ? "partial" : "unpaid") : "paid",
        payload.seller_id ? Number(payload.seller_id) : null,
        payload.user_id ? Number(payload.user_id) : null,
        amountReceived,
      );

    db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?")
      .run(`${createdDate} ${new Date().toTimeString().slice(0, 8)}`, inv.lastInsertRowid);

    for (const line of normalizedLines) {
      db.prepare(
        `INSERT INTO invoice_lines
          (invoice_id, item_id, warehouse_id, quantity, unit_price, discount, line_total,
           item_name_ar, item_name_en, barcode, cost_wacc, cost_last_purchase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        inv.lastInsertRowid,
        line.item_id,
        line.warehouse_id || 1,
        line.quantity,
        line.unit_price,
        line.discount,
        line.line_total,
        line.item_name_ar,
        line.item_name_en,
        line.barcode,
        line.cost_wacc,
        line.cost_last_purchase,
      );

      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: -line.quantity,
        movement_type: "sale",
        reference_type: "invoice",
        reference_id: inv.lastInsertRowid,
      });
    }

    // ── Payment type handling ──────────────────────────────────────────
    // 1) Debt creation (credit + partial-payment non-installment)
    if ((paymentType === "credit" || (remainingAmount > 0 && paymentType !== "installments")) && payload.customer_id) {
      const debtAmount = remainingAmount > 0 ? remainingAmount : total;
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(
        debtAmount,
        payload.customer_id,
      );
      db.prepare(`
        INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
      `).run(
        inv.lastInsertRowid,
        payload.customer_id,
        debtAmount,
        payload.due_date || null,
        payload.notes || null,
      );
    }

    // 2) Actual cash-in / bank handlers (separate from debt so installments can do both)
    if (paymentType === "bank_transfer") {
      if (payload.bank_id && amountReceived > 0) {
        db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amountReceived, payload.bank_id);
      }
    } else if (paymentType === "multi") {
      if (payload.payments && Array.isArray(payload.payments)) {
        for (const p of payload.payments) {
          const amount = Number(p.amount || 0);
          if (amount <= 0) continue;

          let method = p.method_id ? db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(p.method_id) : null;

          // Built-in types (cash/credit) may arrive with no method_id
          if (!method && p.method === 'cash') {
            method = { type: 'cash', target_id: payload.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || null };
          } else if (!method && p.method === 'credit') {
            method = { type: 'credit', target_id: null };
          }

          if (!method) continue;

          if (method.type === 'cash' && method.target_id) {
            db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amount, method.target_id);
          } else if (method.type === 'bank' && method.target_id) {
            db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amount, method.target_id);
          }

          const payment = db.prepare(`
            INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, bank_id, allocated_amount, unallocated_amount, invoice_id)
            VALUES ('customer', ?, ?, ?, ?, ?, ?, ?, 0, ?)
          `).run(
            payload.customer_id || 0,
            amount,
            method.type === 'cash' ? 'cash' : method.type === 'credit' ? 'credit' : (method.name || method.type || method.category),
            `Invoice ${invoiceNo}`,
            method.type === "cash" ? method.target_id || payload.treasury_id || null : null,
            method.type === "bank" ? method.target_id || payload.bank_id || null : null,
            amount,
            inv.lastInsertRowid,
          );

          db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)")
            .run(payment.lastInsertRowid, inv.lastInsertRowid, amount);
        }

        // ── Multi: credit portion → create ajal_debt ─────────────────────
        let creditSum = 0;
        for (const p of payload.payments) {
          const amt = Number(p.amount || 0);
          if (amt <= 0) continue;
          let m = p.method_id ? db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(p.method_id) : null;
          if (!m && p.method === "credit") m = { type: "credit" };
          if (m && m.type === "credit") creditSum += amt;
        }
        if (creditSum > 0 && payload.customer_id) {
          const actualReceived = Math.max(0, amountReceived - creditSum);
          db.prepare("UPDATE invoices SET amount_received = ?, status = ? WHERE id = ?")
            .run(actualReceived, actualReceived > 0 ? "partial" : "unpaid", inv.lastInsertRowid);
          db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?")
            .run(creditSum, payload.customer_id);
          db.prepare(`
            INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
            VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
          `).run(inv.lastInsertRowid, payload.customer_id, creditSum, payload.due_date || null, payload.notes || null);
        }
      } else {
        // Fallback for legacy split_cash/split_bank if needed, but we prefer new format
        let splitCash = Number(payload.split_cash_amount || 0);
        let splitBank = Number(payload.split_bank_amount || 0);
        let bankId = payload.bank_id;
        if (splitCash > 0) {
          const tId = payload.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
          if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(splitCash, tId);
        }
        if (splitBank > 0 && bankId) {
          db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(splitBank, bankId);
        }
      }
    } else if (paymentType === "installments") {
      // Installments: upfront cash goes to treasury, remaining creates ajal_debt
      const treasuryId =
        payload.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (treasuryId && amountReceived > 0) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amountReceived, treasuryId);

        const payment = db.prepare(`
          INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, allocated_amount, unallocated_amount, invoice_id)
          VALUES ('customer', ?, ?, 'cash', ?, ?, ?, 0, ?)
        `).run(
          payload.customer_id || 0,
          amountReceived,
          `دفعة مقدمة - ${invoiceNo}`,
          treasuryId,
          amountReceived,
          inv.lastInsertRowid,
        );

        db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)")
          .run(payment.lastInsertRowid, inv.lastInsertRowid, amountReceived);
      }

      if (remainingAmount > 0 && payload.customer_id) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(remainingAmount, payload.customer_id);
        db.prepare(`
          INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
        `).run(
          inv.lastInsertRowid,
          payload.customer_id,
          remainingAmount,
          payload.due_date || null,
          payload.notes || null,
        );
      }
    } else if (amountReceived > 0) {
      // Plain cash / default fallback
      const treasuryId =
        payload.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (treasuryId && amountReceived > 0) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amountReceived, treasuryId);
      }
    }

    if (payload.customer_id) {
      const earnedPoints = calculateEarnedPoints(total);
      if (earnedPoints > 0) {
        earnPointsForInvoice(payload.customer_id, inv.lastInsertRowid, earnedPoints, payload.user_id || null);
      }
    }

    return getInvoiceWithLines(inv.lastInsertRowid);
  });

  return tx();
}

function voidInvoice(invoiceId, reason, userId) {
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) {
        let err = new Error("Invoice not found"); err.status=404; throw err;
    }
    if (invoice.status === 'cancelled') {
        let err = new Error("Invoice is already voided"); err.status=400; throw err;
    }

    // 1. Mark as cancelled with reason
    db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoiceId);

    const lines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);

    // 2. Reverse stock (only quantity not already restored by sales returns)
    for (const line of lines) {
      const returnedQty = db.prepare(
        "SELECT COALESCE(SUM(srl.quantity), 0) AS q FROM sales_return_lines srl JOIN sales_returns sr ON sr.id = srl.sales_return_id WHERE srl.invoice_line_id = ? AND sr.status != 'cancelled'"
      ).get(line.id)?.q || 0;
      const qtyToRestore = Number(line.quantity) - Number(returnedQty);
      if (qtyToRestore > 0) {
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || 1,
          quantityDelta: qtyToRestore,
          movement_type: "void_sale",
          reference_type: "invoice",
          reference_id: invoiceId,
        });
      }
    }

    // ── Step 1: Always void any ajal_debt tied to this invoice (covers credit,
    //   installments, partial-cash — any payment type can carry a debt).
    if (invoice.customer_id) {
      const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice' AND status != 'voided'").get(invoiceId);
      if (debt) {
        const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
        if (remaining > 0)
          db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, invoice.customer_id);
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
      }
    }

    // ── Step 2: Reverse physical money (treasury / bank) based on payment type ──
    if (invoice.payment_type === "bank_transfer") {
      if (invoice.bank_id) {
        const amtToReverse = Number(invoice.amount_received ?? invoice.total);
        if (amtToReverse > 0) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amtToReverse, invoice.bank_id);
      }
    } else if (invoice.payment_type === "multi") {
      const allocations = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const alloc of allocations) {
        if (alloc.method === "cash" && alloc.treasury_id) {
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(alloc.amount, alloc.treasury_id);
        } else if (alloc.method === "bank" && alloc.bank_id) {
          db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(alloc.amount, alloc.bank_id);
        }
        // credit allocations: ajal_debt already voided in step 1
      }
    } else if (invoice.payment_type === "installments") {
      // Reverse only the upfront cash portion (ajal_debt already voided in step 1)
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
      }
    } else {
      // cash / default fallback — reverse from treasury
      const tId = invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      const amtToReverse = Number(invoice.amount_received ?? invoice.total);
      if (tId && amtToReverse > 0) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amtToReverse, tId);
    }
    // credit payment type: ajal_debt already reversed in step 1, no physical cash movement to undo

    // 4. Audit Log
    try {
        db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
            userId || 1, 'invoice', invoiceId, 'void', JSON.stringify({ reason })
        );
    } catch(e) {} // skip if no audit log table

    return getInvoiceWithLines(invoiceId);
  })();
}

function cancelInvoice(invoiceId, reason, userId) {
  if (!reason || !reason.trim()) {
    const err = new Error("سبب الإلغاء مطلوب");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) { const e = new Error("الفاتورة غير موجودة"); e.status = 404; throw e; }
    if (invoice.status === "cancelled") { const e = new Error("الفاتورة ملغاة بالفعل"); e.status = 400; throw e; }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE invoices SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
      .run(now, userId || 1, reason.trim(), invoiceId);

    const lines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);
    for (const line of lines) {
      const returnedQty = db.prepare(
        "SELECT COALESCE(SUM(srl.quantity), 0) AS q FROM sales_return_lines srl JOIN sales_returns sr ON sr.id = srl.sales_return_id WHERE srl.invoice_line_id = ? AND sr.status != 'cancelled'"
      ).get(line.id)?.q || 0;
      const qtyToRestore = Number(line.quantity) - Number(returnedQty);
      if (qtyToRestore > 0) {
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || 1,
          quantityDelta: qtyToRestore,
          movement_type: "cancel_sale",
          reference_type: "invoice",
          reference_id: invoiceId,
        });
      }
    }

    // ── Step 1: Always void any ajal_debt tied to this invoice (covers credit,
    //   installments, AND partial-cash — any payment type can leave a debt).
    if (invoice.customer_id) {
      const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice' AND status != 'voided'").get(invoiceId);
      if (debt) {
        const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
        if (remaining > 0)
          db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, invoice.customer_id);
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
      }
    }

    // ── Step 2: Reverse physical money (treasury / bank) based on payment type ──
    if (invoice.payment_type === "cash") {
      const tId = invoice.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      const amtToReverse = Number(invoice.amount_received ?? invoice.total);
      if (tId && amtToReverse > 0) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amtToReverse, tId);
    } else if (invoice.payment_type === "bank_transfer") {
      const amtToReverse = Number(invoice.amount_received ?? invoice.total);
      if (invoice.bank_id && amtToReverse > 0) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amtToReverse, invoice.bank_id);
    } else if (invoice.payment_type === "installments") {
      // Only the upfront cash portion is in payment_allocations — ajal_debt already voided in step 1
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
      }
    } else if (invoice.payment_type === "multi") {
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if (a.method === "bank" && a.bank_id)
          db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(a.amount, a.bank_id);
        // credit-method allocations: already handled by ajal_debt void in step 1
      }
    }
    // credit payment type: ajal_debt already fully reversed in step 1, no physical money movement

    try {
      const pts = db.prepare("SELECT points FROM loyalty_transactions WHERE invoice_id = ? AND transaction_type = 'earn'").get(invoiceId);
      if (pts && invoice.customer_id) {
        db.prepare("UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?").run(pts.points, invoice.customer_id);
        db.prepare("INSERT INTO loyalty_transactions (customer_id, invoice_id, transaction_type, points, note) VALUES (?, ?, 'redeem', ?, ?)").run(
          invoice.customer_id, invoiceId, pts.points, `إلغاء فاتورة #${invoice.invoice_no}`
        );
      }
    } catch (_) {}

    try {
      db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
        userId || 1, "invoice", invoiceId, "cancel", JSON.stringify({ reason })
      );
    } catch (_) {}

    return getInvoiceWithLines(invoiceId);
  })();
}

function editInvoice(invoiceId, payload, userId) {
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) { const e = new Error("Invoice not found"); e.status = 404; throw e; }
    if (invoice.status === 'cancelled') { const e = new Error("Cannot edit cancelled invoice"); e.status = 400; throw e; }

    const hasReturn = db.prepare("SELECT 1 FROM sales_returns WHERE invoice_id = ? AND status != 'cancelled' LIMIT 1").get(invoiceId);
    if (hasReturn) { const e = new Error("لا يمكن تعديل الفاتورة لوجود مرتجعات مرتبطة بها"); e.status = 400; throw e; }

    const oldLines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);
    const oldPaymentType = invoice.payment_type;
    const oldCustomerId = invoice.customer_id;

    // ── 1. Reverse OLD stock ─────────────────────────────────────────────
    for (const line of oldLines) {
      adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: Number(line.quantity), movement_type: "void_sale", reference_type: "invoice", reference_id: invoiceId });
    }
    db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(invoiceId);

    // ── 2. Insert new lines ──────────────────────────────────────────────
    const newLines = payload.lines || [];
    let subtotal = 0;
    for (const line of newLines) {
      const lineDiscount = Number(line.discount || 0);
      const lineSubtotal = Number(line.quantity) * Number(line.unit_price);
      const lineTotal = Math.max(0, lineSubtotal - lineDiscount);
      const warehouseId = Number(line.warehouse_id || 1);
      const stockRow = db.prepare("SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(line.item_id, warehouseId);
      const available = Number(stockRow?.quantity || 0);
      if (available < Number(line.quantity)) {
        const item = db.prepare("SELECT name FROM items WHERE id = ?").get(line.item_id);
        const err = new Error(`الكمية المطلوبة (${line.quantity}) غير متوفرة في المخزن. المتاح: ${available} — الصنف: ${item?.name || line.item_id}`);
        err.status = 400;
        throw err;
      }
      subtotal += lineSubtotal;
      const itemRow = db.prepare("SELECT name, name_en, barcode FROM items WHERE id = ?").get(line.item_id);
      const snap = getSnapshotCosts(line.item_id, db);
      db.prepare(
        `INSERT INTO invoice_lines
          (invoice_id, item_id, warehouse_id, quantity, unit_price, discount, line_total,
           item_name_ar, item_name_en, barcode, cost_wacc, cost_last_purchase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(invoiceId, line.item_id, warehouseId, line.quantity, line.unit_price, lineDiscount, lineTotal,
            itemRow?.name || null, itemRow?.name_en || null, itemRow?.barcode || null,
            snap.cost_wacc, snap.cost_last_purchase);
      adjustStock({ item_id: line.item_id, warehouse_id: warehouseId, quantityDelta: -Number(line.quantity), movement_type: "sale", reference_type: "invoice", reference_id: invoiceId });
    }

    const discount = Number(payload.discount ?? invoice.discount ?? 0);
    const increase = Number(payload.increase ?? invoice.increase ?? 0);
    const newTotal = Math.max(0, subtotal - discount + increase);
    const newPaymentType = payload.payment_type || oldPaymentType;
    const newCustomerId = payload.customer_id ?? oldCustomerId;
    const amountPaid = Number(payload.amount_paid ?? invoice.amount_received ?? newTotal);
    const amountReceived = Number.isFinite(amountPaid) ? amountPaid : newTotal;
    const remainingAmount = Math.max(0, newTotal - amountReceived);

    // ── 3. Fully reverse OLD financial effects ───────────────────────────
    if (oldPaymentType === 'cash') {
      const tId = invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      const amt = invoice.amount_received ?? invoice.total;
      if (tId && amt > 0) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amt, tId);
    } else if (oldPaymentType === 'credit' && oldCustomerId) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(invoice.total, oldCustomerId);
      try { db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE invoice_id = ? AND source_type = 'invoice'").run(invoiceId); } catch (_) {}
    } else if (oldPaymentType === 'bank_transfer') {
      const amt = invoice.amount_received ?? invoice.total;
      if (invoice.bank_id && amt > 0) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amt, invoice.bank_id);
    } else if (oldPaymentType === 'installments') {
      const allocs = db.prepare(`
        SELECT pa.amount, p.treasury_id FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) { if (a.treasury_id) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id); }
      if (oldCustomerId) {
        const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice'").get(invoiceId);
        if (debt) {
          const rem = Number(debt.original_amount) - Number(debt.paid_amount || 0);
          if (rem > 0) db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(rem, oldCustomerId);
          db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
        }
      }
    } else if (oldPaymentType === 'multi') {
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === 'cash' && a.treasury_id) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if (a.method === 'bank' && a.bank_id) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(a.amount, a.bank_id);
      }
    }
    // Clean up old payment_allocations + payments for any old type
    db.prepare("DELETE FROM payment_allocations WHERE invoice_id = ?").run(invoiceId);
    db.prepare(`
      DELETE FROM payments WHERE id IN (
        SELECT id FROM payments WHERE invoice_id = ? AND id NOT IN (
          SELECT COALESCE(payment_id,0) FROM payment_allocations WHERE invoice_id = ?
        )
      )
    `).run(invoiceId, invoiceId);

    // ── 4. Update invoice header ─────────────────────────────────────────
    const newStatus = remainingAmount > 0 ? (amountReceived > 0 ? 'partial' : 'unpaid') : 'paid';
    db.prepare(`
      UPDATE invoices SET customer_id = ?, subtotal = ?, discount = ?, increase = ?, total = ?,
        payment_type = ?, amount_received = ?, status = ?, seller_id = ?, updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
      WHERE id = ?
    `).run(
      newCustomerId, subtotal, discount, increase, newTotal,
      newPaymentType, amountReceived, newStatus,
      payload.seller_id ? Number(payload.seller_id) : invoice.seller_id,
      userId || null,
      invoiceId,
    );

    // ── 5. Apply NEW financial effects ───────────────────────────────────
    if (newPaymentType === 'bank_transfer') {
      const bankId = payload.bank_id || invoice.bank_id;
      if (bankId && amountReceived > 0) db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amountReceived, bankId);
    } else if (newPaymentType === 'multi') {
      if (payload.payments && Array.isArray(payload.payments)) {
        for (const p of payload.payments) {
          const amt = Number(p.amount || 0); if (amt <= 0) continue;
          let method = p.method_id ? db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(p.method_id) : null;
          if (!method && p.method === 'cash') method = { type: 'cash', target_id: payload.treasury_id || invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || null };
          else if (!method && p.method === 'credit') method = { type: 'credit', target_id: null };
          if (!method) continue;
          if (method.type === 'cash' && method.target_id) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amt, method.target_id);
          else if (method.type === 'bank' && method.target_id) db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amt, method.target_id);
          const payment = db.prepare(`
            INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, bank_id, allocated_amount, unallocated_amount, invoice_id)
            VALUES ('customer', ?, ?, ?, ?, ?, ?, ?, 0, ?)
          `).run(newCustomerId || 0, amt, method.type === 'cash' ? 'cash' : method.type === 'credit' ? 'credit' : (method.name || method.type || method.category), `Invoice ${invoice.invoice_no}`, method.type === 'cash' ? method.target_id : null, method.type === 'bank' ? method.target_id : null, amt, invoiceId);
          db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)").run(payment.lastInsertRowid, invoiceId, amt);
        }
      }
    } else if (newPaymentType === 'installments') {
      const tId = payload.treasury_id || invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId && amountReceived > 0) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amountReceived, tId);
        const pmt = db.prepare(`
          INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, allocated_amount, unallocated_amount, invoice_id)
          VALUES ('customer', ?, ?, 'cash', ?, ?, ?, 0, ?)
        `).run(newCustomerId || 0, amountReceived, `دفعة مقدمة - ${invoice.invoice_no}`, tId, amountReceived, invoiceId);
        db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)").run(pmt.lastInsertRowid, invoiceId, amountReceived);
      }
      if (remainingAmount > 0 && newCustomerId) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(remainingAmount, newCustomerId);
        db.prepare(`INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
        `).run(invoiceId, newCustomerId, remainingAmount, payload.due_date || null, payload.notes || null);
      }
    } else if (newPaymentType === 'credit' && newCustomerId) {
      const debtAmount = remainingAmount > 0 ? remainingAmount : newTotal;
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(debtAmount, newCustomerId);
      db.prepare(`INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
      `).run(invoiceId, newCustomerId, debtAmount, payload.due_date || null, payload.notes || null);
    } else if (amountReceived > 0) {
      // cash / default fallback
      const tId = payload.treasury_id || invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amountReceived, tId);
    }

    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  })();
}

function amendInvoice(invoiceId, payload, userId) {
  if (!payload.reason || !payload.reason.trim()) {
    const err = new Error("سبب التعديل مطلوب");
    err.status = 400;
    throw err;
  }
  const db = getDb();

  const original = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  if (!original) { const e = new Error("الفاتورة غير موجودة"); e.status = 404; throw e; }
  if (original.status === "cancelled") { const e = new Error("لا يمكن تعديل فاتورة ملغاة"); e.status = 400; throw e; }
  if (original.amended_by) { const e = new Error("هذه الفاتورة عُدِّلت بالفعل — انظر الفاتورة الجديدة"); e.status = 400; throw e; }

  // Cancel the original invoice
  cancelInvoice(invoiceId, `تعديل — ${payload.reason.trim()}`, userId);

  // Create replacement invoice (createInvoice opens its own transaction — better-sqlite3 nests via savepoints)
  const newPayload = { ...payload };
  delete newPayload.reason;
  const newInvoice = createInvoice(newPayload);

  // Link original → new and new → original
  db.prepare("UPDATE invoices SET amended_by = ? WHERE id = ?").run(newInvoice.id, invoiceId);
  db.prepare("UPDATE invoices SET amendment_of = ? WHERE id = ?").run(invoiceId, newInvoice.id);

  try {
    db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
      userId || 1, "invoice", invoiceId, "amend", JSON.stringify({ new_invoice_id: newInvoice.id, reason: payload.reason })
    );
  } catch (_) {}

  return { original: getInvoiceWithLines(invoiceId), new_invoice: newInvoice };
}

module.exports = { createInvoice, getInvoiceWithLines, recalculateInvoiceStatus, voidInvoice, editInvoice, cancelInvoice, amendInvoice };
