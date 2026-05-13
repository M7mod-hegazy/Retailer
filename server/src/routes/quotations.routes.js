const express = require("express");
const { getDb } = require("../config/database");
const QuotationModel = require("../models/quotation.model");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    const error = new Error("Quotation must include at least one line");
    error.status = 400;
    throw error;
  }
  return lines.map((line) => {
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unit_price || 0);
    const discountAmount = Number(line.discount_amount || 0);
    const itemId = Number(line.item_id || 0);
    if (!itemId || quantity <= 0) {
      const error = new Error("Each quotation line requires a valid item and quantity");
      error.status = 400;
      throw error;
    }
    const lineTotal = Math.max(0, quantity * unitPrice - discountAmount);
    return {
      item_id: itemId,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      description: line.description || null,
      line_total: lineTotal,
    };
  });
}

function buildQuotationPayload(payload = {}) {
  const lines = validateLines(payload.lines);
  const total = lines.reduce((sum, line) => sum + line.line_total, 0);
  if (!payload.customer_id) {
    const error = new Error("Customer is required");
    error.status = 400;
    throw error;
  }
  return {
    customer_id: Number(payload.customer_id),
    status: payload.status || "draft",
    notes: payload.notes || null,
    expires_at: payload.expires_at || null,
    lines,
    total,
  };
}

router.get("/", requirePagePermission("quotations", "view"), (req, res) => {
  const { search = "", status } = req.query;
  let data = QuotationModel.all();
  if (search) {
    const s = search.toLowerCase();
    data = data.filter(q =>
      (q.customer_name || "").toLowerCase().includes(s) ||
      String(q.id).includes(s)
    );
  }
  if (status) data = data.filter(q => q.status === status);
  res.json({ success: true, data });
});

router.get("/:id", requirePagePermission("quotations", "view"), (req, res, next) => {
  try {
    const quotation = QuotationModel.findById(req.params.id);
    if (!quotation) {
      const error = new Error("Quotation not found");
      error.status = 404;
      throw error;
    }
    res.json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePagePermission("quotations", "add"), (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: QuotationModel.create(buildQuotationPayload(req.body || {})) });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requirePagePermission("quotations", "edit"), (req, res, next) => {
  try {
    const existing = QuotationModel.findById(req.params.id);
    if (!existing) {
      const error = new Error("Quotation not found");
      error.status = 404;
      throw error;
    }
    if (existing.status === "converted") {
      const error = new Error("Converted quotations cannot be edited");
      error.status = 409;
      throw error;
    }
    res.json({ success: true, data: QuotationModel.update(req.params.id, buildQuotationPayload(req.body || {})) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/send", requirePagePermission("quotations", "edit"), (req, res, next) => {
  try {
    const q = QuotationModel.findById(req.params.id);
    if (!q) { const e = new Error("Quotation not found"); e.status = 404; throw e; }
    if (q.status === "converted") { const e = new Error("Converted quotations cannot be modified"); e.status = 409; throw e; }
    getDb().prepare("UPDATE quotations SET status = 'sent' WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: QuotationModel.findById(req.params.id) });
  } catch (error) { next(error); }
});

router.delete("/:id", requirePagePermission("quotations", "delete"), (req, res, next) => {
  try {
    const db = getDb();
    const q = QuotationModel.findById(req.params.id);
    if (!q) { const e = new Error("Quotation not found"); e.status = 404; throw e; }
    if (q.status === "converted") { const e = new Error("Cannot delete a converted quotation"); e.status = 409; throw e; }
    db.prepare("DELETE FROM quotation_lines WHERE quotation_id = ?").run(req.params.id);
    db.prepare("DELETE FROM quotations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/:id/duplicate", requirePagePermission("quotations", "add"), (req, res, next) => {
  try {
    const original = QuotationModel.findById(req.params.id);
    if (!original) { const e = new Error("Quotation not found"); e.status = 404; throw e; }
    const clone = QuotationModel.create({
      customer_id: original.customer_id,
      status: "draft",
      notes: original.notes,
      expires_at: original.expires_at,
      lines: (original.lines || []).map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_amount: l.discount_amount,
        description: l.description,
        line_total: l.line_total,
      })),
      total: original.total,
    });
    res.status(201).json({ success: true, data: clone });
  } catch (error) { next(error); }
});

router.post("/:id/convert-to-invoice", requirePagePermission("quotations", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const quotation = QuotationModel.findById(req.params.id);
    if (!quotation) {
      const error = new Error("Quotation not found");
      error.status = 404;
      throw error;
    }
    if (!quotation.lines?.length) {
      const error = new Error("Quotation does not contain items");
      error.status = 400;
      throw error;
    }
    if (quotation.status === "converted") {
      const error = new Error("Quotation already converted");
      error.status = 409;
      throw error;
    }

    const invoiceNumber = `QINV-${String(Date.now()).slice(-6)}`;
    const invoiceId = db.transaction(() => {
      const invoice = db
        .prepare(
          "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status) VALUES (?, ?, ?, ?, ?, 'credit', 'unpaid')",
        )
        .run(
          invoiceNumber,
          quotation.customer_id || null,
          quotation.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0),
          quotation.lines.reduce((sum, line) => sum + Number(line.discount_amount || 0), 0),
          Number(quotation.total || 0),
        );

      const insertLine = db.prepare(
        "INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)",
      );
      quotation.lines.forEach((line) => {
        insertLine.run(
          invoice.lastInsertRowid,
          line.item_id,
          Number(line.quantity || 0),
          Number(line.unit_price || 0),
          Number(line.line_total || 0),
        );
      });
      QuotationModel.markConverted(req.params.id);
      return invoice.lastInsertRowid;
    })();

    res.json({
      success: true,
      data: {
        quotation_id: Number(req.params.id),
        invoice_id: invoiceId,
        invoice_no: invoiceNumber,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
