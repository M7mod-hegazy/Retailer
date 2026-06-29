const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");
const { calculateEarnedPoints, earnPointsForInvoice } = require("./loyaltyService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("./dailySessionService");
const { getSnapshotCosts } = require("./waccService");
const { captureInvoiceLineOverrides } = require("./overrideTrackingService");
const { getMaxDiscountPercent, discountExceedsCap } = require("../utils/discountPolicy");
const { captureLeadFromSale } = require("./leadCapture");
const { assertNotVariantParent } = require("../routes/variants.routes");
const { validateAndSellSerials } = require("../utils/serialValidation");
const { isFeatureEnabled } = require("../utils/features");
const { nowSql, toSql } = require("../utils/datetime");
const { recordBankMovement } = require("./bankService");

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
    db.prepare("UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?").run(status, nowSql(), invoiceId);
  } else {
    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, invoiceId);
  }
  return { ...invoice, status, allocated, outstanding };
}

function getInvoiceWithLines(invoiceId) {
  const db = getDb();
  const invoice = db.prepare(`
    SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
           COALESCE(NULLIF(u.full_name, ''), u.username) AS created_by_username, u.full_name AS created_by_name,
           seller.username AS seller_username, seller.full_name AS seller_name,
           sh.id AS shift_number
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.id = i.user_id
    LEFT JOIN users seller ON seller.id = i.seller_id
    LEFT JOIN shifts sh ON sh.id = i.shift_id
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
    "SELECT id, original_amount, paid_amount FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice' AND status != 'voided' ORDER BY id DESC LIMIT 1"
  ).get(invoiceId);
  const debt_remaining = ajalDebt
    ? Math.max(0, Number(ajalDebt.original_amount) - Number(ajalDebt.paid_amount || 0))
    : 0;

  // Installment schedule (if this sale was sold on an installment plan) — lets the
  // receipt/A4 print the full plan on reprint, not just a single line.
  const installment_plan = ajalDebt
    ? db.prepare("SELECT installment_no, due_date, amount, status FROM ajal_schedules WHERE debt_id = ? ORDER BY installment_no").all(ajalDebt.id)
    : [];

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
    installment_plan,
  };
}

function createInvoice(payload) {
  const db = getDb();
  const tx = db.transaction(() => {
    const createdDate = normalizeDate(payload.created_at);
    assertCanWriteForDate(db, createdDate);
    // Honor the number the client already reserved via POST /api/documents/reserve
    // (that call already advanced the daily sequence). Regenerating here would consume
    // a second sequence number and the saved invoice would be one ahead of the number
    // the cashier saw on screen. Fall back to generating only when no reserved number
    // was sent, or when the reserved one is already taken (e.g. an amend reusing the
    // cancelled original's number) so we never collide.
    const reservedNo = typeof payload.doc_no === "string" ? payload.doc_no.trim() : "";
    const reservedAvailable = reservedNo
      && !db.prepare("SELECT 1 FROM invoices WHERE invoice_no = ? LIMIT 1").get(reservedNo);
    const invoiceNo = reservedAvailable ? reservedNo : generateDocNumber('pos_sale');
    let subtotal = 0;
    const lineErrors = [];

    const featureMultiUnit = (() => {
      try { return Boolean(db.prepare("SELECT feature_multi_unit FROM settings WHERE id = 1").get()?.feature_multi_unit); } catch { return false; }
    })();

    const normalizedLines = (payload.lines || []).map((line, index) => {
      let quantity = Number(line.quantity || 0);
      let unitPrice = Number(line.unit_price || 0);
      const lineDiscount = Number(line.discount || 0);
      const itemId = Number(line.item_id || 0);
      const warehouseId = Number(line.warehouse_id || payload.warehouse_id || 1);
      const item = db.prepare("SELECT id, name, name_en, barcode, purchase_price FROM items WHERE id = ?").get(itemId);

      // Multi-unit: when unit_id is present and feature is on, resolve base quantity and snapshot
      let soldUnitName = null, soldUnitFactor = null, soldUnitQty = null;
      if (featureMultiUnit && line.unit_id) {
        const unit = db.prepare("SELECT * FROM item_units WHERE id = ? AND item_id = ?").get(Number(line.unit_id), itemId);
        if (unit) {
          soldUnitQty = Number(line.sold_unit_qty || quantity);
          soldUnitFactor = unit.factor;
          soldUnitName = unit.unit_name;
          quantity = soldUnitQty * soldUnitFactor; // convert to base units for stock
          // unit.sale_price (or the client-sent unit_price) is the price for ONE sold-unit
          // (e.g. one carton). quantity is now in BASE units, so store unit_price PER BASE
          // unit — otherwise quantity × unit_price over-charges by the factor. The line money
          // is rounded to 2dp below so the carton total stays exact.
          const perSoldUnitPrice = unit.sale_price != null ? Number(unit.sale_price) : unitPrice;
          unitPrice = soldUnitFactor > 0 ? perSoldUnitPrice / soldUnitFactor : perSoldUnitPrice;
        }
      }
      const stockRow = db
        .prepare("SELECT quantity, wacc, last_purchase_cost FROM stock_levels WHERE item_id = ? AND warehouse_id = ?")
        .get(itemId, warehouseId);
      const currentStock = Number(stockRow?.quantity || 0);
      // Use WACC as true cost basis; fall back to last_purchase_cost then items.purchase_price
      const trueCost = Number(stockRow?.wacc || stockRow?.last_purchase_cost || item?.purchase_price || 0);
      const snapshotCosts = getSnapshotCosts(itemId, db, quantity);

      if (!item) lineErrors.push(`الصنف غير موجود (سطر ${index + 1})`);
      // Variant parent sellability guard (feature_variants)
      try { assertNotVariantParent(db, itemId); } catch (e) { lineErrors.push(e.message); }
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

      // Round line money to 2dp so multi-unit per-base prices (e.g. cartonPrice/factor)
      // don't accumulate float drift; a correctly-2dp price rounds to itself (no-op).
      const rowSubtotal = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
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
        cost_fifo:          snapshotCosts.cost_fifo,
        cost_lifo:          snapshotCosts.cost_lifo,
        is_below_cost:      isBelowCost,
        sold_unit_name:     soldUnitName,
        sold_unit_factor:   soldUnitFactor,
        sold_unit_qty:      soldUnitQty,
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
    const headerDiscount = Number(payload.discount || 0);
    const promotionDiscount = Math.max(0, Number(payload.promotion_discount || 0));

    // GAP-02: Discount Hard Limits (configurable, default 15%, can be disabled) —
    // checked on the manual header discount only (system promotions are not subject
    // to the cashier cap). Unless supervisor-overridden.
    if (discountExceedsCap(db, subtotal, headerDiscount) && !payload.supervisor_override) {
      const error = new Error(`Discount exceeds the maximum allowed limit of ${getMaxDiscountPercent(db)}%. Supervisor override required.`);
      error.status = 403;
      error.code = 'DISCOUNT_LIMIT_EXCEEDED';
      throw error;
    }

    const increaseAmount = Math.max(0, Number(payload.increase || 0));
    // total must reflect per-line discounts AND promotions, exactly like the client
    // (posStore.computeTotals): total = Σ(line_total) − header − promotion + increase.
    // line_total already nets each line's discount, so summing it captures line discounts.
    const lineNet = normalizedLines.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
    // Persist all invoice-level reductions in `discount` so subtotal − discount + increase
    // reconciles against line-level discounts left on the lines themselves.
    const discount = headerDiscount + promotionDiscount;
    const base = Math.max(0, lineNet - headerDiscount - promotionDiscount + increaseAmount);
    const { resolveTax } = require('../utils/salesTax');
    const taxResult = resolveTax(db, {
      requestedEnabled: payload.tax_enabled,
      requestedRate: payload.tax_rate,
      base,
      user: payload._user,
      existing: payload._existingTax,
    });
    const total = taxResult.total;
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
        "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, increase, total, payment_type, status, seller_id, user_id, amount_received, notes, tax_enabled, tax_rate, tax_amount, tax_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        payload.notes || null,
        taxResult.tax_enabled,
        taxResult.tax_rate,
        taxResult.tax_amount,
        taxResult.tax_type,
        nowSql(),
      );

    db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?")
      .run(`${createdDate} ${toSql(new Date()).slice(11)}`, inv.lastInsertRowid);

    const createdInvoiceLines = [];
    for (const line of normalizedLines) {
      const lr = db.prepare(
        `INSERT INTO invoice_lines
          (invoice_id, item_id, warehouse_id, quantity, unit_price, discount, line_total,
           item_name_ar, item_name_en, barcode, cost_wacc, cost_last_purchase, cost_fifo, cost_lifo,
           sold_unit_name, sold_unit_factor, sold_unit_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        line.cost_fifo,
        line.cost_lifo,
        line.sold_unit_name || null,
        line.sold_unit_factor || null,
        line.sold_unit_qty || null,
      );
      createdInvoiceLines.push({ id: lr.lastInsertRowid });

      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: -line.quantity,
        movement_type: "sale",
        reference_type: "invoice",
        reference_id: inv.lastInsertRowid,
      });

      // Recipe-based ingredient deduction (feature_restaurant)
      const recipeItem = db.prepare("SELECT has_recipe FROM items WHERE id = ?").get(line.item_id);
      if (recipeItem?.has_recipe) {
        const featureRestaurant = db.prepare("SELECT feature_restaurant FROM settings WHERE id = 1").get();
        if (featureRestaurant?.feature_restaurant) {
          const ingredients = db.prepare("SELECT * FROM item_recipes WHERE menu_item_id = ?").all(line.item_id);
          for (const ing of ingredients) {
            adjustStock({
              item_id: ing.ingredient_item_id,
              warehouse_id: line.warehouse_id || 1,
              quantityDelta: -(ing.quantity * line.quantity),
              movement_type: "recipe_deduction",
              reference_type: "invoice",
              reference_id: inv.lastInsertRowid,
            });
          }
        }
      }

      // Serial/IMEI validation (feature_serials) — flag-guarded inside the helper
      validateAndSellSerials(
        db,
        { item_id: line.item_id, quantity: line.quantity, serials: line.serials },
        inv.lastInsertRowid,
        lr.lastInsertRowid
      );

      // FEFO batch deduction for items with expiry tracking (only when feature enabled)
      const batchItem = isFeatureEnabled(db, "feature_expiry")
        ? db.prepare("SELECT track_expiry FROM items WHERE id = ?").get(line.item_id)
        : null;
      if (batchItem?.track_expiry) {
        let remaining = line.quantity;
        const batches = db.prepare(
          `SELECT id, quantity FROM item_batches
           WHERE item_id = ? AND warehouse_id = ? AND quantity > 0 AND expiry_date IS NOT NULL
           ORDER BY expiry_date ASC`
        ).all(line.item_id, line.warehouse_id || 1);
        for (const batch of batches) {
          if (remaining <= 0) break;
          const consume = Math.min(remaining, batch.quantity);
          db.prepare("UPDATE item_batches SET quantity = quantity - ? WHERE id = ?").run(consume, batch.id);
          remaining -= consume;
        }
      }
    }

    // Capture master_price_at_time for override tracking
    captureInvoiceLineOverrides(createdInvoiceLines, db);

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
        recordBankMovement(db, {
          bankId: payload.bank_id,
          type: "deposit",
          amount: amountReceived,
          reference: invoiceNo,
          notes: `فاتورة ${invoiceNo}`,
          userId: payload.user_id || 1,
          source: "pos_sale",
          refType: "invoice",
          refId: inv.lastInsertRowid,
        });
      }
    } else if (paymentType === "multi") {
      if (payload.payments && Array.isArray(payload.payments)) {
        // The distributed amounts must reconcile to the invoice total, otherwise
        // the credit portion (and the customer's owed balance) would be wrong.
        const paySum = payload.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        if (Math.abs(paySum - Number(total || 0)) > 0.01) {
          const e = new Error(`المبلغ الموزع (${paySum}) لا يساوي إجمالي الفاتورة (${total})`);
          e.status = 400;
          throw e;
        }
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
            recordBankMovement(db, {
              bankId: method.target_id,
              type: "deposit",
              amount,
              reference: invoiceNo,
              notes: `فاتورة ${invoiceNo}`,
              userId: payload.user_id || 1,
              source: "pos_sale",
              refType: "invoice",
              refId: inv.lastInsertRowid,
            });
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
          recordBankMovement(db, {
            bankId,
            type: "deposit",
            amount: splitBank,
            reference: invoiceNo,
            notes: `فاتورة ${invoiceNo}`,
            userId: payload.user_id || 1,
            source: "pos_sale",
            refType: "invoice",
            refId: inv.lastInsertRowid,
          });
        }
      }
    } else if (paymentType === "installments") {
      // Installments: upfront payment (if any) recorded to the specified method
      if (amountReceived > 0) {
        if (payload.bank_id) {
          recordBankMovement(db, {
            bankId: payload.bank_id, type: "deposit", amount: amountReceived,
            reference: invoiceNo, notes: `دفعة مقدمة - ${invoiceNo}`,
            userId: payload.user_id || 1, source: "pos_sale", refType: "invoice", refId: inv.lastInsertRowid,
          });
          const payment = db.prepare(`
            INSERT INTO payments (party_type, party_id, amount, method, notes, bank_id, allocated_amount, unallocated_amount, invoice_id)
            VALUES ('customer', ?, ?, 'bank_transfer', ?, ?, ?, 0, ?)
          `).run(payload.customer_id || 0, amountReceived, `دفعة مقدمة - ${invoiceNo}`, payload.bank_id, amountReceived, inv.lastInsertRowid);
          db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)")
            .run(payment.lastInsertRowid, inv.lastInsertRowid, amountReceived);
        } else {
          const treasuryId =
            payload.treasury_id ||
            db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
          if (treasuryId) {
            db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amountReceived, treasuryId);
            const payment = db.prepare(`
              INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, allocated_amount, unallocated_amount, invoice_id)
              VALUES ('customer', ?, ?, 'cash', ?, ?, ?, 0, ?)
            `).run(payload.customer_id || 0, amountReceived, `دفعة مقدمة - ${invoiceNo}`, treasuryId, amountReceived, inv.lastInsertRowid);
            db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)")
              .run(payment.lastInsertRowid, inv.lastInsertRowid, amountReceived);
          }
        }
      }

      if (remainingAmount > 0 && payload.customer_id) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(remainingAmount, payload.customer_id);

        // Multi-installment plan: the client sends the final, balanced rows so we persist them
        // as ajal_schedules at sale time (the customer-account tracker reads these). The debt's
        // due_date is set to the first installment's date so overdue summaries stay meaningful.
        const plan = Array.isArray(payload.installment_plan) ? payload.installment_plan : null;
        const firstDue = plan && plan.length ? plan[0].due_date : (payload.due_date || null);

        const debtRes = db.prepare(`
          INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
        `).run(
          inv.lastInsertRowid,
          payload.customer_id,
          remainingAmount,
          firstDue,
          payload.notes || null,
        );

        if (plan && plan.length) {
          const planSum = plan.reduce((s, r) => s + Number(r.amount || 0), 0);
          if (Math.abs(planSum - remainingAmount) > 0.01) {
            // Throwing rolls back the whole sale transaction — no orphan debt/schedules.
            throw new Error(`مجموع الأقساط (${planSum}) لا يساوي المبلغ المتبقي (${remainingAmount})`);
          }
          const insSched = db.prepare(
            "INSERT INTO ajal_schedules (debt_id, installment_no, due_date, amount, status) VALUES (?, ?, ?, ?, 'pending')"
          );
          plan.forEach((r, i) => {
            insSched.run(debtRes.lastInsertRowid, Number(r.installment_no) || (i + 1), r.due_date, Number(r.amount || 0));
          });
        }
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

    // Capture an anonymous walk-in WhatsApp number as a lead (best-effort, never blocks the sale).
    captureLeadFromSale(db, payload, normalizedLines);

    if (payload.quotation_id) {
      const qid = Number(payload.quotation_id);
      const q = db.prepare("SELECT id, status FROM quotations WHERE id = ?").get(qid);
      if (q && q.status !== "converted") {
        db.prepare("UPDATE quotations SET status = 'converted' WHERE id = ?").run(qid);
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
        db.prepare("UPDATE ajal_schedules SET status = 'voided' WHERE debt_id = ? AND status = 'pending'").run(debt.id);
      }
    }

    // ── Step 2: Reverse physical money (treasury / bank) based on payment type ──
    if (invoice.payment_type === "bank_transfer") {
      if (invoice.bank_id) {
        const amtToReverse = Number(invoice.amount_received ?? invoice.total);
        if (amtToReverse > 0) recordBankMovement(db, { bankId: invoice.bank_id, type: "withdrawal", amount: amtToReverse, reference: invoice.invoice_no, notes: `عكس فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
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
          recordBankMovement(db, { bankId: alloc.bank_id, type: "withdrawal", amount: alloc.amount, reference: invoice.invoice_no, notes: `عكس فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
        }
        // credit allocations: ajal_debt already voided in step 1
      }
    } else if (invoice.payment_type === "installments") {
      // Reverse the upfront payment (cash or bank) — ajal_debt already voided in step 1
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if ((a.method === "bank_transfer" || a.method === "bank") && a.bank_id)
          recordBankMovement(db, { bankId: a.bank_id, type: "withdrawal", amount: a.amount, reference: invoice.invoice_no, notes: `عكس فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
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

    const now = nowSql();
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
        db.prepare("UPDATE ajal_schedules SET status = 'voided' WHERE debt_id = ? AND status = 'pending'").run(debt.id);
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
      if (invoice.bank_id && amtToReverse > 0) recordBankMovement(db, { bankId: invoice.bank_id, type: "withdrawal", amount: amtToReverse, reference: invoice.invoice_no, notes: `عكس فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
    } else if (invoice.payment_type === "installments") {
      // Reverse the upfront payment (cash or bank) — ajal_debt already voided in step 1
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if ((a.method === "bank_transfer" || a.method === "bank") && a.bank_id)
          recordBankMovement(db, { bankId: a.bank_id, type: "withdrawal", amount: a.amount, reference: invoice.invoice_no, notes: `عكس فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
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
          recordBankMovement(db, { bankId: a.bank_id, type: "withdrawal", amount: a.amount, reference: invoice.invoice_no, notes: `عكس فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
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
    const editInvoiceLines = [];
    let subtotal = 0;
    let lineNet = 0;
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
      lineNet += lineTotal;
      const itemRow = db.prepare("SELECT name, name_en, barcode FROM items WHERE id = ?").get(line.item_id);
      const snap = getSnapshotCosts(line.item_id, db, Number(line.quantity));
      const elr = db.prepare(
        `INSERT INTO invoice_lines
          (invoice_id, item_id, warehouse_id, quantity, unit_price, discount, line_total,
           item_name_ar, item_name_en, barcode, cost_wacc, cost_last_purchase, cost_fifo, cost_lifo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(invoiceId, line.item_id, warehouseId, line.quantity, line.unit_price, lineDiscount, lineTotal,
            itemRow?.name || null, itemRow?.name_en || null, itemRow?.barcode || null,
            snap.cost_wacc, snap.cost_last_purchase, snap.cost_fifo, snap.cost_lifo);
      editInvoiceLines.push({ id: elr.lastInsertRowid });
      adjustStock({ item_id: line.item_id, warehouse_id: warehouseId, quantityDelta: -Number(line.quantity), movement_type: "sale", reference_type: "invoice", reference_id: invoiceId });
    }

    // Capture master_price_at_time for override tracking
    captureInvoiceLineOverrides(editInvoiceLines, db);

    const headerDiscount = Number(payload.discount ?? invoice.discount ?? 0);
    const promotionDiscount = Math.max(0, Number(payload.promotion_discount ?? 0));
    const discount = headerDiscount + promotionDiscount;
    const increase = Number(payload.increase ?? invoice.increase ?? 0);
    // Match create path / client: net of per-line discounts and promotions.
    const base = Math.max(0, lineNet - headerDiscount - promotionDiscount + increase);
    const { resolveTax } = require('../utils/salesTax');
    // `existing` makes resolveTax inherit enabled/rate/type from the stored row when the
    // payload doesn't specify them, without tripping the custom-rate permission check.
    const taxResult = resolveTax(db, {
      requestedEnabled: payload.tax_enabled,
      requestedRate: payload.tax_rate,
      base,
      user: payload._user,
      existing: invoice,
    });
    const newTotal = taxResult.total;
    const newPaymentType = payload.payment_type || oldPaymentType;
    const newCustomerId = payload.customer_id ?? oldCustomerId;
    const amountPaid = Number(payload.amount_paid ?? invoice.amount_received ?? newTotal);
    let amountReceived = Number.isFinite(amountPaid) ? amountPaid : newTotal;
    let remainingAmount = Math.max(0, newTotal - amountReceived);
    // Track physical payments preserved from old installment invoices so the
    // new-effects section below does not re-add them (avoids double-counting).
    let existingPaid = 0;
    if (oldPaymentType === 'installments') {
      existingPaid = Number(db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_allocations WHERE invoice_id = ?").get(invoiceId)?.total || 0);
    }

    // ── 3. Fully reverse OLD financial effects ───────────────────────────
    // 3a. Uniformly reverse any customer-balance debt tied to this invoice.
    //     credit, installments AND partial-cash all may carry an ajal_debt, so
    //     this must run for every payment type (the old per-type logic missed
    //     partial-cash entirely and over-reversed credit by the gross total).
    //     Mirrors cancelInvoice/voidInvoice: reverse only the still-OUTSTANDING
    //     amount (original − paid), never the gross total.
    if (oldCustomerId) {
      const oldDebt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice' AND status != 'voided'").get(invoiceId);
      if (oldDebt) {
        const rem = Number(oldDebt.original_amount) - Number(oldDebt.paid_amount || 0);
        if (rem > 0) db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(rem, oldCustomerId);
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(oldDebt.id);
        db.prepare("UPDATE ajal_schedules SET status = 'voided' WHERE debt_id = ? AND status = 'pending'").run(oldDebt.id);
      }
    }
    // 3b. Reverse physical money (treasury / bank) per old payment type.
    if (oldPaymentType === 'cash') {
      const tId = invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      const amt = invoice.amount_received ?? invoice.total;
      if (tId && amt > 0) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amt, tId);
    } else if (oldPaymentType === 'credit') {
      // ajal_debt reversed uniformly in 3a; no physical cash to undo
    } else if (oldPaymentType === 'bank_transfer') {
      const amt = invoice.amount_received ?? invoice.total;
      if (invoice.bank_id && amt > 0) recordBankMovement(db, { bankId: invoice.bank_id, type: "withdrawal", amount: amt, reference: invoice.invoice_no, notes: `تعديل فاتورة ${invoice.invoice_no} (عكس)`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
    } else if (oldPaymentType === 'installments') {
      // ajal_debt + schedules reversed uniformly in 3a
      // When switching to 'credit' (full credit conversion), reverse all cash
      // payments so the ENTIRE amount becomes debt.
      if (newPaymentType === 'credit') {
        // Reverse treasury/cash from the original cash payments
        const allocs = db.prepare(`
          SELECT pa.amount, p.method, p.treasury_id, p.bank_id FROM payment_allocations pa
          LEFT JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = ?
        `).all(invoiceId);
        for (const a of allocs) {
          if (a.method === 'cash' && a.treasury_id) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
          else if (a.method === 'bank' && a.bank_id) recordBankMovement(db, { bankId: a.bank_id, type: "withdrawal", amount: a.amount, reference: invoice.invoice_no, notes: `تعديل فاتورة ${invoice.invoice_no} (عكس)`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
        }
        // Cleanup block below will delete payment_allocations + payments
        amountReceived = 0;
        remainingAmount = newTotal;
      } else {
        // Preserve physical payments (original behavior)
        amountReceived = Math.max(amountReceived, existingPaid);
        remainingAmount = Math.max(0, newTotal - amountReceived);
      }
    } else if (oldPaymentType === 'multi') {
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === 'cash' && a.treasury_id) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if (a.method === 'bank' && a.bank_id) recordBankMovement(db, { bankId: a.bank_id, type: "withdrawal", amount: a.amount, reference: invoice.invoice_no, notes: `تعديل فاتورة ${invoice.invoice_no} (عكس)`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
      }
    }
    // Clean up old payment_allocations + payments (skipped for installment
    // unless converting to full credit — which reverses all cash).
    const skipCleanup = oldPaymentType === 'installments' && newPaymentType !== 'credit';
    if (!skipCleanup) {
      db.prepare("DELETE FROM payment_allocations WHERE invoice_id = ?").run(invoiceId);
      db.prepare(`
        DELETE FROM payments WHERE id IN (
          SELECT id FROM payments WHERE invoice_id = ? AND id NOT IN (
            SELECT COALESCE(payment_id,0) FROM payment_allocations WHERE invoice_id = ?
          )
        )
      `).run(invoiceId, invoiceId);
    }

    // ── 4. Update invoice header ─────────────────────────────────────────
    const newStatus = remainingAmount > 0 ? (amountReceived > 0 ? 'partial' : 'unpaid') : 'paid';
    db.prepare(`
      UPDATE invoices SET customer_id = ?, subtotal = ?, discount = ?, increase = ?, total = ?,
        payment_type = ?, amount_received = ?, status = ?, seller_id = ?, updated_at = ?,
        updated_by = ?, notes = ?, tax_enabled = ?, tax_rate = ?, tax_amount = ?, tax_type = ?
      WHERE id = ?
    `).run(
      newCustomerId, subtotal, discount, increase, newTotal,
      newPaymentType, amountReceived, newStatus,
      payload.seller_id ? Number(payload.seller_id) : invoice.seller_id,
      nowSql(),
      userId || null,
      payload.notes !== undefined ? (payload.notes || null) : (invoice.notes || null),
      taxResult.tax_enabled,
      taxResult.tax_rate,
      taxResult.tax_amount,
      taxResult.tax_type,
      invoiceId,
    );

    // ── 5. Apply NEW financial effects ───────────────────────────────────
    if (newPaymentType === 'bank_transfer') {
      const bankId = payload.bank_id || invoice.bank_id;
      if (bankId && amountReceived > 0) recordBankMovement(db, { bankId, type: "deposit", amount: amountReceived, reference: invoice.invoice_no, notes: `تعديل فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
    } else if (newPaymentType === 'multi') {
      if (payload.payments && Array.isArray(payload.payments)) {
        const paySum = payload.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        if (Math.abs(paySum - Number(newTotal || 0)) > 0.01) {
          const e = new Error(`المبلغ الموزع (${paySum}) لا يساوي إجمالي الفاتورة (${newTotal})`);
          e.status = 400;
          throw e;
        }
        for (const p of payload.payments) {
          const amt = Number(p.amount || 0); if (amt <= 0) continue;
          let method = p.method_id ? db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(p.method_id) : null;
          if (!method && p.method === 'cash') method = { type: 'cash', target_id: payload.treasury_id || invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || null };
          else if (!method && p.method === 'credit') method = { type: 'credit', target_id: null };
          if (!method) continue;
          if (method.type === 'cash' && method.target_id) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amt, method.target_id);
          else if (method.type === 'bank' && method.target_id) recordBankMovement(db, { bankId: method.target_id, type: "deposit", amount: amt, reference: invoice.invoice_no, notes: `تعديل فاتورة ${invoice.invoice_no}`, userId: userId || 1, source: "pos_sale", refType: "invoice", refId: invoiceId });
          const payment = db.prepare(`
            INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, bank_id, allocated_amount, unallocated_amount, invoice_id)
            VALUES ('customer', ?, ?, ?, ?, ?, ?, ?, 0, ?)
          `).run(newCustomerId || 0, amt, method.type === 'cash' ? 'cash' : method.type === 'credit' ? 'credit' : (method.name || method.type || method.category), `Invoice ${invoice.invoice_no}`, method.type === 'cash' ? method.target_id : null, method.type === 'bank' ? method.target_id : null, amt, invoiceId);
          db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)").run(payment.lastInsertRowid, invoiceId, amt);
        }
        // Credit portion → customer debt + correct amount_received/status.
        // (Mirrors createInvoice multi; was missing here, which orphaned the
        //  customer balance on edit — leaving a phantom "opening balance" and a
        //  0-impact invoice when the credit total changed.)
        let creditSum = 0;
        for (const p of payload.payments) {
          const amt = Number(p.amount || 0);
          if (amt <= 0) continue;
          let m = p.method_id ? db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(p.method_id) : null;
          if (!m && p.method === 'credit') m = { type: 'credit' };
          if (m && (m.type === 'credit' || m.category === 'credit')) creditSum += amt;
        }
        if (creditSum > 0 && newCustomerId) {
          const actualReceived = Math.max(0, paySum - creditSum);
          db.prepare("UPDATE invoices SET amount_received = ?, status = ? WHERE id = ?")
            .run(actualReceived, actualReceived > 0 ? 'partial' : 'unpaid', invoiceId);
          db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(creditSum, newCustomerId);
          db.prepare(`
            INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
            VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
          `).run(invoiceId, newCustomerId, creditSum, payload.due_date || null, payload.notes || null);
        }
      }
    } else if (newPaymentType === 'installments') {
      const tId = payload.treasury_id || invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      const netInstallmentCash = oldPaymentType === 'installments' ? Math.max(0, amountReceived - existingPaid) : amountReceived;
      if (tId && netInstallmentCash > 0) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(netInstallmentCash, tId);
        const pmt = db.prepare(`
          INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, allocated_amount, unallocated_amount, invoice_id)
          VALUES ('customer', ?, ?, 'cash', ?, ?, ?, 0, ?)
        `).run(newCustomerId || 0, netInstallmentCash, `دفعة مقدمة - ${invoice.invoice_no}`, tId, netInstallmentCash, invoiceId);
        db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)").run(pmt.lastInsertRowid, invoiceId, netInstallmentCash);
      }
      if (remainingAmount > 0 && newCustomerId) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(remainingAmount, newCustomerId);
        const plan = Array.isArray(payload.installment_plan) ? payload.installment_plan : null;
        const firstDue = plan && plan.length ? plan[0].due_date : (payload.due_date || null);
        const debtRes = db.prepare(`INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
        `).run(invoiceId, newCustomerId, remainingAmount, firstDue, payload.notes || null);
        if (plan && plan.length) {
          const planSum = plan.reduce((s, r) => s + Number(r.amount || 0), 0);
          if (Math.abs(planSum - remainingAmount) > 0.01) {
            throw new Error(`مجموع الأقساط (${planSum}) لا يساوي المبلغ المتبقي (${remainingAmount})`);
          }
          const insSched = db.prepare(
            "INSERT INTO ajal_schedules (debt_id, installment_no, due_date, amount, status) VALUES (?, ?, ?, ?, 'pending')"
          );
          plan.forEach((r, i) => {
            insSched.run(debtRes.lastInsertRowid, Number(r.installment_no) || (i + 1), r.due_date, Number(r.amount || 0));
          });
        }
      }
    } else if (newPaymentType === 'credit' && newCustomerId) {
      const debtAmount = remainingAmount > 0 ? remainingAmount : newTotal;
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(debtAmount, newCustomerId);
      db.prepare(`INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
      `).run(invoiceId, newCustomerId, debtAmount, payload.due_date || null, payload.notes || null);
    } else {
      // cash / default fallback — deposit received cash (subtract preserved
      // installment payments), AND book any unpaid remainder as a customer debt
      // (partial-cash sale). Mirrors createInvoice's debt branch so editing the
      // total correctly moves the customer's owed balance.
      const netCash = oldPaymentType === 'installments' ? Math.max(0, amountReceived - existingPaid) : amountReceived;
      const tId = payload.treasury_id || invoice.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId && netCash > 0) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(netCash, tId);
      if (remainingAmount > 0 && newCustomerId) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(remainingAmount, newCustomerId);
        db.prepare(`INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
        `).run(invoiceId, newCustomerId, remainingAmount, payload.due_date || null, payload.notes || null);
      }
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

  // carry forward the tax snapshot via resolveTax's `existing` inheritance —
  // `== null` matters: JSON cannot carry undefined, clients send null for "unspecified"
  newPayload._existingTax = original;
  if (newPayload.tax_enabled == null) delete newPayload.tax_enabled;
  if (newPayload.tax_rate == null) delete newPayload.tax_rate;
  // carry forward notes from original unless client sets them
  if (newPayload.notes == null) newPayload.notes = original.notes;
  // pass user through for permission checks
  newPayload._user = payload._user;

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
