const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("./dailySessionService");
const { getSnapshotCosts } = require("./waccService");
const { captureSalesReturnLineOverrides } = require("./overrideTrackingService");
const { getMaxDiscountPercent, discountExceedsCap } = require("../utils/discountPolicy");
const { isFeatureEnabled } = require("../utils/features");
const { validateAndReturnSerials } = require("../utils/serialValidation");
const { nowSql, toSql } = require("../utils/datetime");
const { recordBankMovement } = require("./bankService");
const { notifyOwner, EVENT_TYPES: TG } = require("./telegramService");

function isCreditMethod(pm) {
  return !!pm && (pm.type === "credit" || pm.category === "credit");
}

function processSalesReturnPayments(db, payments, total, customerId, userId, invoiceNo, returnId) {
  if (!payments || !Array.isArray(payments)) return { cashAmount: 0, creditAmount: 0, paymentsJson: '[]' };
  const paySum = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (Math.abs(paySum - Number(total || 0)) > 0.01) {
    const e = new Error(`المبلغ الموزع (${paySum}) لا يساوي إجمالي المرتجع (${total})`);
    e.status = 400;
    throw e;
  }
  let cashAmount = 0, creditAmount = 0;
  const defaultTid = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
  for (const pmt of payments) {
    const amount = Number(pmt.amount || 0);
    if (amount <= 0) continue;
    if (pmt.method === 'credit' || isCreditMethod(pmt)) {
      creditAmount += amount;
      continue;
    }
    let pm;
    if (pmt.method_id) {
      pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(pmt.method_id));
    }
    if (!pm && pmt.method === 'cash') {
      pm = { type: 'cash', category: 'cash', target_id: defaultTid };
    }
    if (!pm) {
      pm = { type: 'cash', category: 'cash', target_id: defaultTid };
    }
    if (pm.type === 'cash' && pm.target_id) {
      db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
      cashAmount += amount;
    } else if (pm.type === 'bank' && pm.target_id) {
      recordBankMovement(db, {
        bankId: pm.target_id,
        type: "withdrawal",
        amount,
        reference: invoiceNo || `مرتجع #${returnId}`,
        notes: `مرتجع مبيعات ${invoiceNo || `#${returnId}`}`,
        userId: userId || 1,
        source: "sales_return",
        refType: "sales_return",
        refId: returnId,
      });
      cashAmount += amount;
    } else {
      cashAmount += amount;
    }
  }
  const paymentsJson = JSON.stringify(payments.map(p => ({
    method: p.method_name || p.method,
    method_id: p.method_id || null,
    amount: Number(p.amount || 0),
  })));
  return { cashAmount, creditAmount, paymentsJson };
}

function reverseSalesReturnPayments(db, returnRecord) {
  const defaultTid = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
  let payments;
  try { payments = JSON.parse(returnRecord.payments || '[]'); } catch (_) { payments = []; }
  if (!payments.length) {
    payments = [];
    if (Number(returnRecord.cash_amount || 0) > 0) payments.push({ method: 'cash', amount: Number(returnRecord.cash_amount) });
    if (Number(returnRecord.credit_amount || 0) > 0) payments.push({ method: 'credit', amount: Number(returnRecord.credit_amount) });
  }
  const usrId = 1;
  for (const p of payments) {
    const amount = Number(p.amount || 0);
    if (amount <= 0) continue;
    if (p.method === 'credit' || p.method_type === 'credit') {
      continue;
    }
    let pm;
    if (p.method_id) {
      pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(p.method_id));
    }
    if (!pm && p.method === 'cash') pm = { type: 'cash', target_id: defaultTid };
    if (!pm) pm = { type: 'cash', target_id: defaultTid };
    if (pm.type === 'cash' && pm.target_id) {
      db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amount, pm.target_id);
    } else if (pm.type === 'bank' && pm.target_id) {
      recordBankMovement(db, {
        bankId: pm.target_id,
        type: "deposit",
        amount,
        reference: returnRecord.doc_no || `مرتجع #${returnRecord.id}`,
        notes: `إلغاء مرتجع مبيعات ${returnRecord.doc_no || `#${returnRecord.id}`}`,
        userId: usrId,
        source: "cancel_sales_return",
        refType: "sales_return",
        refId: returnRecord.id,
      });
    }
  }
  if (Number(returnRecord.credit_amount || 0) > 0 && returnRecord.customer_id) {
    db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(Number(returnRecord.credit_amount), returnRecord.customer_id);
  }
}

function generateAmendmentDocNo(originalDocNo, db, table) {
  const base = originalDocNo.replace(/-A\d+$/, "");
  const existing = db.prepare(
    `SELECT doc_no FROM ${table} WHERE doc_no LIKE ? ORDER BY CAST(SUBSTR(doc_no, INSTR(doc_no, '-A') + 2) AS INTEGER) DESC LIMIT 1`
  ).get(`${base}-A%`);
  if (!existing) return `${base}-A1`;
  const num = parseInt(existing.doc_no.match(/-A(\d+)$/)[1]) + 1;
  return `${base}-A${num}`;
}

// Header-level خصم/زيادة on a return. Mirrors the invoice discount cap
// (invoiceService GAP-02), configurable via settings.max_discount_percent.
// `total = subtotal − discount + increase`.
function applyReturnAdjustment(subtotal, payload) {
  const discount = Math.max(0, Number(payload.discount || 0));
  const increase = Math.max(0, Number(payload.increase || 0));
  const db = getDb();
  if (discountExceedsCap(db, subtotal, discount) && !payload.supervisor_override) {
    const err = new Error(`الخصم يتجاوز الحد الأقصى المسموح (${getMaxDiscountPercent(db)}%). يتطلب موافقة المشرف.`);
    err.status = 400;
    err.code = "DISCOUNT_LIMIT_EXCEEDED";
    throw err;
  }
  const total = Math.max(0, subtotal - discount + increase);
  return { discount, increase, total };
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
      const snap = getSnapshotCosts(invoiceLine.item_id, db, requestedLine.quantity);
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
        cost_fifo:          snap.cost_fifo,
        cost_lifo:          snap.cost_lifo,
        serials: requestedLine.serials,
      });
    }

    const { discount, increase, total: adjTotal } = applyReturnAdjustment(total, payload);

    // Inherit tax from parent invoice snapshot (direct calculation — no settings read,
    // so rate changes after original sale don't affect linked returns)
    const { round2 } = require('../utils/salesTax');
    let taxFields = { tax_enabled: 0, tax_rate: 0, tax_amount: 0, tax_type: null };
    let finalTotal = adjTotal;
    if (Number(invoice.tax_enabled)) {
      const parentRate = Number(invoice.tax_rate || 0);
      const parentType = invoice.tax_type;
      if (parentType === 'exclusive') {
        const tax_amount = round2(adjTotal * parentRate / 100);
        taxFields = { tax_enabled: 1, tax_rate: parentRate, tax_amount, tax_type: parentType };
        finalTotal = round2(adjTotal + tax_amount);
      } else if (parentType === 'inclusive') {
        const tax_amount = round2(adjTotal * parentRate / (100 + parentRate));
        taxFields = { tax_enabled: 1, tax_rate: parentRate, tax_amount, tax_type: parentType };
        // inclusive: total stays the same
      }
    }

    const refundMethod = payload.refund_method || "cash_back";
    let cashAmt = 0, creditAmt = 0, paymentsJson = '[]';

    if (refundMethod === 'multi') {
      const result = processSalesReturnPayments(db, payload.payments, finalTotal, invoice.customer_id, payload.user_id, invoice.invoice_no, null);
      cashAmt = result.cashAmount;
      creditAmt = result.creditAmount;
      paymentsJson = result.paymentsJson;
    } else {
      cashAmt = refundMethod === "cash_back" ? finalTotal
        : refundMethod === "split" ? Math.max(0, Number(payload.cash_amount || 0))
        : 0;
      creditAmt = (refundMethod === "credit_note" || refundMethod === "store_credit") ? finalTotal
        : refundMethod === "split" ? Math.max(0, finalTotal - cashAmt)
        : 0;
    }

    const docNo = generateDocNumber('sales_return');
    // From-invoice return inherits the source invoice's walk-in contact; the
    // payload can override (e.g. the invoice had no customer and the cashier
    // adds a name/phone at return time).
    const wName = payload.walk_in_name || invoice.walk_in_name || null;
    const wPhone = payload.walk_in_phone || invoice.walk_in_phone || null;
    const result = db
      .prepare(
        "INSERT INTO sales_returns (doc_no, invoice_id, customer_id, walk_in_name, walk_in_phone, total, discount, increase, reason, refund_method, cash_amount, credit_amount, payments, notes, status, created_by, created_at, tax_enabled, tax_rate, tax_amount, tax_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)",
      )
      .run(
        docNo,
        invoiceId,
        invoice.customer_id || null,
        wName,
        wPhone,
        finalTotal,
        discount,
        increase,
        payload.reason || null,
        refundMethod,
        cashAmt,
        creditAmt,
        paymentsJson,
        payload.notes || null,
        payload.user_id || null,
        `${createdDate} ${toSql(new Date()).slice(11)}`,
        taxFields.tax_enabled,
        taxFields.tax_rate,
        taxFields.tax_amount,
        taxFields.tax_type,
      );

    const returnId = result.lastInsertRowid;

    const createdReturnLines = [];
    for (const line of preparedLines) {
      const rlr = db.prepare(
        `INSERT INTO sales_return_lines
          (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total,
           warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase, cost_fifo, cost_lifo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(returnId, line.invoice_line_id, line.item_id, line.quantity,
            line.unit_price, line.line_total, line.warehouse_id,
            line.item_name_ar, line.item_name_en, line.cost_wacc, line.cost_last_purchase,
            line.cost_fifo, line.cost_lifo);
      createdReturnLines.push({ id: rlr.lastInsertRowid });

      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id,
        quantityDelta: line.quantity,
        movement_type: "sales_return",
        reference_type: "sales_return",
        reference_id: returnId,
      });

      // Recipe ingredient stock restoration (feature_restaurant)
      const recipeItem = db.prepare("SELECT has_recipe FROM items WHERE id = ?").get(line.item_id);
      if (recipeItem?.has_recipe) {
        const feRest = db.prepare("SELECT feature_restaurant FROM settings WHERE id = 1").get();
        if (feRest?.feature_restaurant) {
          const ingredients = db.prepare("SELECT * FROM item_recipes WHERE menu_item_id = ?").all(line.item_id);
          for (const ing of ingredients) {
            adjustStock({
              item_id: ing.ingredient_item_id,
              warehouse_id: line.warehouse_id,
              quantityDelta: ing.quantity * line.quantity,
              movement_type: "recipe_restore",
              reference_type: "sales_return",
              reference_id: returnId,
            });
          }
        }
      }

      // FEFO batch restore: add returned qty to newest-expiry dated batch (only when feature enabled)
      const batchItem = isFeatureEnabled(db, "feature_expiry")
        ? db.prepare("SELECT track_expiry FROM items WHERE id = ?").get(line.item_id)
        : null;
      if (batchItem?.track_expiry) {
        const newestBatch = db.prepare(
          "SELECT id FROM item_batches WHERE item_id = ? AND warehouse_id = ? AND expiry_date IS NOT NULL ORDER BY expiry_date DESC LIMIT 1"
        ).get(line.item_id, line.warehouse_id);
        if (newestBatch) {
          db.prepare("UPDATE item_batches SET quantity = quantity + ? WHERE id = ?").run(line.quantity, newestBatch.id);
        }
      }

      // Serial return validation (feature_serials) — flag-guarded inside the helper
      if (line.serials) {
        validateAndReturnSerials(db, { item_id: line.item_id, serials: line.serials, quantity: line.quantity }, invoiceId);
      }
    }
    captureSalesReturnLineOverrides(createdReturnLines, db);

    if (creditAmt > 0 && invoice.customer_id) {
      if (invoice.payment_type === "credit") {
        db.prepare("UPDATE ajal_debts SET original_amount = original_amount - ? WHERE invoice_id = ? AND status = 'open'").run(creditAmt, invoiceId);
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

    try {
      const payments = JSON.parse(paymentsJson || '[]');
      const customerRow = invoice.customer_id ? db.prepare("SELECT name FROM customers WHERE id=?").get(invoice.customer_id) : null;
      notifyOwner(TG.RETURN_PAYMENT, {
        customerName: customerRow?.name || invoice.customer_name || wName || "غير محدد",
        amount: finalTotal,
        method: refundMethod,
        date: `${createdDate} ${toSql(new Date()).slice(11)}`,
        payments,
      });
    } catch (_) {}

    return db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
  })();
}

function createGeneralReturn(payload) {
  const db = getDb();
  return db.transaction(() => {
    const { lines, customer_id, refund_method, notes, reason, user_id, treasury_id, walk_in_name, walk_in_phone } = payload;
    if (!lines || !lines.length) { const e = new Error("يجب إضافة أصناف"); e.status = 400; throw e; }

    const docNo = generateDocNumber('sales_return');
    let subtotal = 0;
    for (const line of lines) subtotal += Number(line.quantity) * Number(line.unit_price);
    const { discount, increase, total } = applyReturnAdjustment(subtotal, payload);

    const { resolveTax } = require('../utils/salesTax');
    const taxResult = resolveTax(db, {
      requestedEnabled: payload.tax_enabled,
      requestedRate: payload.tax_rate,
      base: total,
      user: payload._user,
    });
    const finalTotal = taxResult.total;

    const genRefundMethod = refund_method || 'cash_back';
    let genCashAmt = 0, genCreditAmt = 0, genPaymentsJson = '[]';

    if (genRefundMethod === 'multi') {
      const gpResult = processSalesReturnPayments(db, payload.payments, finalTotal, customer_id, user_id, null, null);
      genCashAmt = gpResult.cashAmount;
      genCreditAmt = gpResult.creditAmount;
      genPaymentsJson = gpResult.paymentsJson;
    } else {
      genCashAmt = genRefundMethod === 'cash_back' ? finalTotal
        : genRefundMethod === 'split' ? Math.max(0, Number(payload.cash_amount || 0))
        : 0;
      genCreditAmt = (genRefundMethod === 'credit_note' || genRefundMethod === 'store_credit') ? finalTotal
        : genRefundMethod === 'split' ? Math.max(0, finalTotal - genCashAmt)
        : 0;
    }

    const ret = db.prepare(
      "INSERT INTO sales_returns (doc_no, invoice_id, customer_id, walk_in_name, walk_in_phone, total, discount, increase, refund_method, cash_amount, credit_amount, payments, reason, notes, status, created_by, created_at, tax_enabled, tax_rate, tax_amount, tax_type) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)"
    ).run(docNo, customer_id || null, walk_in_name || null, walk_in_phone || null, finalTotal, discount, increase, genRefundMethod, genCashAmt, genCreditAmt, genPaymentsJson, reason || 'other', notes || null, user_id || null, nowSql(), taxResult.tax_enabled, taxResult.tax_rate, taxResult.tax_amount, taxResult.tax_type);

    const returnId = ret.lastInsertRowid;

    const genReturnLines = [];
    for (const line of lines) {
      const lineTotal = Number(line.quantity) * Number(line.unit_price);
      const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(line.item_id);
      const snap = getSnapshotCosts(line.item_id, db, Number(line.quantity));
      const warehouseId = Number(line.warehouse_id || 1);

      const grr = db.prepare(
        `INSERT INTO sales_return_lines
          (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total,
           warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase, cost_fifo, cost_lifo)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(returnId, line.item_id, line.quantity, line.unit_price, lineTotal,
            warehouseId, itemRow?.name || null, itemRow?.name_en || null,
            snap.cost_wacc, snap.cost_last_purchase, snap.cost_fifo, snap.cost_lifo);
      genReturnLines.push({ id: grr.lastInsertRowid });

      adjustStock({ item_id: line.item_id, warehouse_id: warehouseId, quantityDelta: Number(line.quantity), movement_type: "sales_return", reference_type: "sales_return", reference_id: returnId });

      // Recipe ingredient stock restoration (feature_restaurant)
      const recipeGen = db.prepare("SELECT has_recipe FROM items WHERE id = ?").get(line.item_id);
      if (recipeGen?.has_recipe) {
        const feRestGen = db.prepare("SELECT feature_restaurant FROM settings WHERE id = 1").get();
        if (feRestGen?.feature_restaurant) {
          const ingredientsGen = db.prepare("SELECT * FROM item_recipes WHERE menu_item_id = ?").all(line.item_id);
          for (const ing of ingredientsGen) {
            adjustStock({
              item_id: ing.ingredient_item_id,
              warehouse_id: warehouseId,
              quantityDelta: ing.quantity * Number(line.quantity),
              movement_type: "recipe_restore",
              reference_type: "sales_return",
              reference_id: returnId,
            });
          }
        }
      }

      // FEFO batch restore for standalone returns (only when feature enabled)
      const batchItem2 = isFeatureEnabled(db, "feature_expiry")
        ? db.prepare("SELECT track_expiry FROM items WHERE id = ?").get(line.item_id)
        : null;
      if (batchItem2?.track_expiry) {
        const newestBatch2 = db.prepare(
          "SELECT id FROM item_batches WHERE item_id = ? AND warehouse_id = ? AND expiry_date IS NOT NULL ORDER BY expiry_date DESC LIMIT 1"
        ).get(line.item_id, warehouseId);
        if (newestBatch2) {
          db.prepare("UPDATE item_batches SET quantity = quantity + ? WHERE id = ?").run(Number(line.quantity), newestBatch2.id);
        }
      }
    }
    captureSalesReturnLineOverrides(genReturnLines, db);

    try {
      const payments = JSON.parse(genPaymentsJson || '[]');
      const customerRow = customer_id ? db.prepare("SELECT name FROM customers WHERE id=?").get(customer_id) : null;
      notifyOwner(TG.RETURN_PAYMENT, {
        customerName: customerRow?.name || walk_in_name || "غير محدد",
        amount: finalTotal,
        method: genRefundMethod,
        date: nowSql(),
        payments,
      });
    } catch (_) {}

    return db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
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

      // Reverse recipe ingredient restoration (feature_restaurant)
      const recipeCanc = db.prepare("SELECT has_recipe FROM items WHERE id = ?").get(line.item_id);
      if (recipeCanc?.has_recipe) {
        const feRestCanc = db.prepare("SELECT feature_restaurant FROM settings WHERE id = 1").get();
        if (feRestCanc?.feature_restaurant) {
          const ingredientsCanc = db.prepare("SELECT * FROM item_recipes WHERE menu_item_id = ?").all(line.item_id);
          for (const ing of ingredientsCanc) {
            adjustStock({
              item_id: ing.ingredient_item_id,
              warehouse_id: line.warehouse_id || 1,
              quantityDelta: -(ing.quantity * line.quantity),
              movement_type: "cancel_recipe_restore",
              reference_type: "sales_return",
              reference_id: returnId,
            });
          }
        }
      }
    }

    // Reverse financials — handles multi-payment via payments JSON
    reverseSalesReturnPayments(db, sr);

    const now = nowSql();
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
    WHERE sr.status != 'cancelled'
    ORDER BY sr.id DESC
  `).all();
}

function getReturnDetails(id) {
  const db = getDb();
  const sr = db.prepare(`
    SELECT sr.*,
           c.name AS customer_name,
           c.phone AS customer_phone,
           i.invoice_no AS original_invoice_no,
           t.name AS treasury_name,
           COALESCE(
             COALESCE(NULLIF(u.full_name, ''), u.username),
             COALESCE(NULLIF(ui.full_name, ''), ui.username),
             'النظام'
           ) AS created_by_username,
           u.full_name AS created_by_name,
           (SELECT doc_no FROM sales_returns WHERE id = sr.amendment_of) AS amendment_of_no,
           (SELECT doc_no FROM sales_returns WHERE id = sr.amended_by)   AS amended_by_no
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN invoices i ON i.id = sr.invoice_id
    LEFT JOIN treasuries t ON t.id = sr.treasury_id
    LEFT JOIN users u ON u.id = sr.created_by
    LEFT JOIN users ui ON ui.id = i.user_id
    WHERE sr.id = ?
  `).get(id);
  if (!sr) return null;
  const lines = db.prepare(`
    SELECT srl.*,
           COALESCE(srl.item_name_ar, i.name) as item_name,
           i.code as item_code,
           i.unit_id,
           i.purchase_price
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

      // Reverse recipe ingredient restoration from old return (feature_restaurant)
      const recipeOld = db.prepare("SELECT has_recipe FROM items WHERE id = ?").get(line.item_id);
      if (recipeOld?.has_recipe) {
        const feOld = db.prepare("SELECT feature_restaurant FROM settings WHERE id = 1").get();
        if (feOld?.feature_restaurant) {
          const ingsOld = db.prepare("SELECT * FROM item_recipes WHERE menu_item_id = ?").all(line.item_id);
          for (const ing of ingsOld) {
            adjustStock({
              item_id: ing.ingredient_item_id,
              warehouse_id: line.warehouse_id || 1,
              quantityDelta: -(ing.quantity * line.quantity),
              movement_type: "cancel_recipe_restore",
              reference_type: "sales_return",
              reference_id: returnId,
            });
          }
        }
      }
    }

    // 2. Reverse old financials — handles multi-payment via payments JSON
    reverseSalesReturnPayments(db, sr);

    // 3. Build new lines
    const newLines = payload.lines || [];
    let newTotal = 0;
    const preparedLines = [];

    for (const requestedLine of newLines) {
      if (!sr.invoice_id) {
        const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(requestedLine.item_id);
        const snap = getSnapshotCosts(requestedLine.item_id, db, Number(requestedLine.quantity));
        const lineTotal = Number(requestedLine.quantity) * Number(requestedLine.unit_price);
        newTotal += lineTotal;
        preparedLines.push({ invoice_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_price: Number(requestedLine.unit_price), line_total: lineTotal, warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1, item_name_ar: itemRow?.name || null, item_name_en: itemRow?.name_en || null, cost_wacc: snap.cost_wacc, cost_last_purchase: snap.cost_last_purchase, cost_fifo: snap.cost_fifo, cost_lifo: snap.cost_lifo, serials: requestedLine.serials });
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
        preparedLines.push({ invoice_line_id: invoiceLine.id, item_id: invoiceLine.item_id, quantity: qty, unit_price: invoiceLine.unit_price, line_total: lineTotal, warehouse_id: payload.warehouse_id || invoiceLine.warehouse_id || 1, item_name_ar: invoiceLine.item_name_ar, item_name_en: invoiceLine.item_name_en, cost_wacc: invoiceLine.cost_wacc, cost_last_purchase: invoiceLine.cost_last_purchase, cost_fifo: invoiceLine.cost_fifo, cost_lifo: invoiceLine.cost_lifo, serials: requestedLine.serials });
      }
    }

    // 4. Delete old lines, insert new
    db.prepare("DELETE FROM sales_return_lines WHERE sales_return_id = ?").run(returnId);
    for (const line of preparedLines) {
      db.prepare(
        `INSERT INTO sales_return_lines (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total, warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase, cost_fifo, cost_lifo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(returnId, line.invoice_line_id, line.item_id, line.quantity, line.unit_price, line.line_total, line.warehouse_id, line.item_name_ar, line.item_name_en, line.cost_wacc || 0, line.cost_last_purchase || 0, line.cost_fifo || 0, line.cost_lifo || 0);
      adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id, quantityDelta: line.quantity, movement_type: "sales_return", reference_type: "sales_return", reference_id: returnId });

      // Recipe ingredient stock restoration for new return lines (feature_restaurant)
      const recipeNew = db.prepare("SELECT has_recipe FROM items WHERE id = ?").get(line.item_id);
      if (recipeNew?.has_recipe) {
        const feNew = db.prepare("SELECT feature_restaurant FROM settings WHERE id = 1").get();
        if (feNew?.feature_restaurant) {
          const ingsNew = db.prepare("SELECT * FROM item_recipes WHERE menu_item_id = ?").all(line.item_id);
          for (const ing of ingsNew) {
            adjustStock({
              item_id: ing.ingredient_item_id,
              warehouse_id: line.warehouse_id,
              quantityDelta: ing.quantity * line.quantity,
              movement_type: "recipe_restore",
              reference_type: "sales_return",
              reference_id: returnId,
            });
          }
        }
      }

      // Serial return validation (feature_serials) — flag-guarded inside the helper
      if (line.serials && sr.invoice_id) {
        validateAndReturnSerials(db, { item_id: line.item_id, serials: line.serials, quantity: line.quantity }, sr.invoice_id);
      }
    }

    // 5. Apply new financials — header خصم/زيادة fall back to existing values if not sent
    const { discount: newDiscount, increase: newIncrease, total: newAdjTotal } = applyReturnAdjustment(newTotal, {
      discount: payload.discount ?? sr.discount,
      increase: payload.increase ?? sr.increase,
      supervisor_override: payload.supervisor_override,
    });

    // Tax computation: linked returns use stored snapshot; standalone returns use resolveTax
    const { round2, resolveTax } = require('../utils/salesTax');
    let newTaxFields = { tax_enabled: 0, tax_rate: 0, tax_amount: 0, tax_type: null };
    let finalAdjTotal = newAdjTotal;

    if (sr.invoice_id) {
      // Linked return: use stored tax snapshot
      const snapshotRate = Number(sr.tax_rate || 0);
      const snapshotType = sr.tax_type;
      if (Number(sr.tax_enabled) || (snapshotRate > 0 && snapshotType)) {
        if (snapshotType === 'exclusive') {
          const tax_amount = round2(newAdjTotal * snapshotRate / 100);
          newTaxFields = { tax_enabled: 1, tax_rate: snapshotRate, tax_amount, tax_type: snapshotType };
          finalAdjTotal = round2(newAdjTotal + tax_amount);
        } else if (snapshotType === 'inclusive') {
          const tax_amount = round2(newAdjTotal * snapshotRate / (100 + snapshotRate));
          newTaxFields = { tax_enabled: 1, tax_rate: snapshotRate, tax_amount, tax_type: snapshotType };
          // finalAdjTotal unchanged (inclusive)
        }
      }
    } else {
      // Standalone return: resolveTax inherits enabled/rate/type from the stored row
      // when the payload doesn't specify them (no silent re-rating at current settings).
      const taxResult = resolveTax(db, {
        requestedEnabled: payload.tax_enabled,
        requestedRate: payload.tax_rate,
        base: newAdjTotal,
        user: payload._user,
        existing: sr,
      });
      newTaxFields = { tax_enabled: taxResult.tax_enabled, tax_rate: taxResult.tax_rate, tax_amount: taxResult.tax_amount, tax_type: taxResult.tax_type };
      finalAdjTotal = taxResult.total;
    }

    const edDefaultTId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
    const newRefundMethod = payload.refund_method || sr.refund_method;
    const newTreasuryId = payload.treasury_id || sr.treasury_id;
    const newCustomerId = payload.customer_id || sr.customer_id;
    let newCashAmt = 0, newCreditAmt = 0, newPaymentsJson = '[]';

    if (newRefundMethod === 'multi') {
      const edResult = processSalesReturnPayments(db, payload.payments, finalAdjTotal, newCustomerId, userId, sr.doc_no, returnId);
      newCashAmt = edResult.cashAmount;
      newCreditAmt = edResult.creditAmount;
      newPaymentsJson = edResult.paymentsJson;
    } else {
      newCashAmt = newRefundMethod === "cash_back" ? finalAdjTotal
        : newRefundMethod === "split" ? Math.max(0, Number(payload.cash_amount || 0))
        : 0;
      newCreditAmt = (newRefundMethod === "credit_note" || newRefundMethod === "store_credit") ? finalAdjTotal
        : newRefundMethod === "split" ? Math.max(0, finalAdjTotal - newCashAmt)
        : 0;
      if (newCashAmt > 0) {
        const tId = newTreasuryId || edDefaultTId;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(newCashAmt, tId);
      }
      if (newCreditAmt > 0 && newCustomerId) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(newCreditAmt, newCustomerId);
      }
    }

    // 6. Update header — preserve doc_no and created_at
    const edWalkInName = payload.walk_in_name !== undefined ? payload.walk_in_name : sr.walk_in_name;
    const edWalkInPhone = payload.walk_in_phone !== undefined ? payload.walk_in_phone : sr.walk_in_phone;
    db.prepare(
      "UPDATE sales_returns SET total = ?, discount = ?, increase = ?, refund_method = ?, cash_amount = ?, credit_amount = ?, payments = ?, warehouse_id = ?, customer_id = ?, walk_in_name = ?, walk_in_phone = ?, reason = ?, notes = ?, treasury_id = ?, tax_enabled = ?, tax_rate = ?, tax_amount = ?, tax_type = ?, updated_at = ? WHERE id = ?"
    ).run(finalAdjTotal, newDiscount, newIncrease, newRefundMethod, newCashAmt, newCreditAmt, newPaymentsJson, payload.warehouse_id || sr.warehouse_id, newCustomerId, edWalkInName || null, edWalkInPhone || null, payload.reason || sr.reason, payload.notes || sr.notes, newTreasuryId || null, newTaxFields.tax_enabled, newTaxFields.tax_rate, newTaxFields.tax_amount, newTaxFields.tax_type, nowSql(), returnId);

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

module.exports = { applyReturnAdjustment, createReturn, createGeneralReturn, getReturns, getReturnDetails, cancelSalesReturn, amendSalesReturn, editSalesReturn };
