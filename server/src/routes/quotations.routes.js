const express = require("express");
const { getDb } = require("../config/database");
const QuotationModel = require("../models/quotation.model");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { adjustStock } = require("../services/stockService");
const { assertNotVariantParent } = require("./variants.routes");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

const PAYMENT_TYPES = ['cash', 'bank_transfer', 'credit', 'installments', 'multi'];

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
      warehouse_id: line.warehouse_id || null,
    };
  });
}

function buildQuotationPayload(payload = {}) {
  const lines = validateLines(payload.lines);
  const db = getDb();
  lines.forEach(line => assertNotVariantParent(db, line.item_id));
  const linesTotal = lines.reduce((sum, line) => sum + line.line_total, 0);
  const increase = Math.max(0, Number(payload.increase || 0));
  const decrease = Math.max(0, Number(payload.decrease || 0));
  const total = linesTotal + increase - decrease;
  return {
    customer_id: payload.customer_id ? Number(payload.customer_id) : null,
    doc_no: payload.doc_no || null,
    status: payload.status || "draft",
    notes: payload.notes || null,
    expires_at: payload.expires_at || null,
    lines,
    total,
    increase,
    decrease,
    tax_enabled: payload.tax_enabled,
    tax_rate: payload.tax_rate,
    payment_type: PAYMENT_TYPES.includes(payload.payment_type) ? payload.payment_type : 'cash',
    payment_note: payload.payment_note || null,
    _user: payload._user,
  };
}

router.get("/", requirePagePermission("quotations", "view"), (req, res) => {
  const { search = '', status = '', sort = 'q.id', order = 'DESC', page = '1', limit = '20', dateFrom = '', dateTo = '' } = req.query;
  const result = QuotationModel.all({
    search,
    status,
    sort,
    order,
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    dateFrom,
    dateTo,
  });
  res.json({ success: true, ...result });
});

router.get("/all", requirePagePermission("quotations", "view"), (req, res) => {
  const data = QuotationModel.allRaw();
  res.json({ success: true, data });
});

router.get("/export", requirePagePermission("quotations", "view"), async (req, res, next) => {
  try {
    const { search = '', status = '', dateFrom = '', dateTo = '' } = req.query;
    const result = QuotationModel.all({ search, status, dateFrom, dateTo, page: 1, limit: 100000 });
    const rows = result.data;

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Quotations");

    ws.columns = [
      { header: "#", key: "id", width: 8 },
      { header: "العميل", key: "customer_name", width: 25 },
      { header: "تاريخ الإصدار", key: "created_at", width: 18 },
      { header: "تاريخ الصلاحية", key: "expires_at", width: 18 },
      { header: "الحالة", key: "status", width: 14 },
      { header: "الإجمالي", key: "total", width: 16 },
      { header: "عدد الأصناف", key: "line_count", width: 12 },
      { header: "ملاحظات", key: "notes", width: 30 },
    ];

    ws.getRow(1).font = { bold: true, size: 12 };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

    rows.forEach(r => {
      ws.addRow({
        id: r.id,
        customer_name: r.customer_name || `—`,
        created_at: r.created_at,
        expires_at: r.expires_at || '—',
        status: r.status === 'draft' ? 'مسودة' : r.status === 'sent' ? 'مُرسل' : r.status === 'converted' ? 'تم التحويل' : r.status,
        total: Number(r.total || 0),
        line_count: (r.lines || []).length,
        notes: r.notes || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=quotations-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
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
    const created = QuotationModel.create(buildQuotationPayload({ ...(req.body || {}), _user: req.user }));
    req.audit("create", "quotations", { id: created.id }, `📋 تم إنشاء عرض سعر`);
    res.status(201).json({ success: true, data: created });
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
    const updated = QuotationModel.update(req.params.id, buildQuotationPayload({ ...(req.body || {}), _user: req.user }));
    req.audit("update", "quotations", { id: req.params.id }, `📋 تم تعديل عرض سعر`);
    res.json({ success: true, data: updated });
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
    req.audit("update", "quotations", { id: req.params.id }, `📋 تم إرسال عرض سعر`);
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
    req.audit("delete", "quotations", { id: req.params.id }, `📋 تم حذف عرض سعر`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/:id/duplicate", requirePagePermission("quotations", "add"), (req, res, next) => {
  try {
    const original = QuotationModel.findById(req.params.id);
    if (!original) { const e = new Error("Quotation not found"); e.status = 404; throw e; }
    const baseLinesTotal = (original.lines || []).reduce((s, l) => s + Number(l.line_total || 0), 0);
    const clone = QuotationModel.create({
      customer_id: original.customer_id,
      status: "draft",
      notes: original.notes,
      expires_at: original.expires_at,
      increase: original.increase,
      decrease: original.decrease,
      payment_type: original.payment_type,
      lines: (original.lines || []).map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_amount: l.discount_amount,
        description: l.description,
        line_total: l.line_total,
        warehouse_id: l.warehouse_id || null,
      })),
      total: baseLinesTotal + (original.increase || 0) - (original.decrease || 0) - (original.tax_type === 'exclusive' ? Number(original.tax_amount || 0) : 0),
      _existingTax: original,
      _user: req.user,
    });
    req.audit("create", "quotations", { id: clone.id }, `📋 تم تكرار عرض سعر`);
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

    // Stock validation (stock_levels — items table has no stock_quantity column)
    const stockIssues = [];
    const defaultWhId = 1;
    quotation.lines.forEach(line => {
      assertNotVariantParent(db, line.item_id);
      const whId = line.warehouse_id || defaultWhId;
      const item = db.prepare(`
        SELECT i.name,
          COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl WHERE sl.item_id = i.id), 0) AS stock_quantity
        FROM items i WHERE i.id = ?
      `).get(line.item_id);
      if (item) {
        const whStock = db.prepare(
          "SELECT COALESCE(quantity, 0) AS quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?",
        ).get(line.item_id, whId);
        const available = Number(whStock?.quantity ?? item.stock_quantity ?? 0);
        if (available < Number(line.quantity || 0)) {
          stockIssues.push(`${item.name}: المتاح ${available}، المطلوب ${line.quantity}`);
        }
      }
    });
    if (stockIssues.length > 0) {
      const error = new Error(`نقص في المخزون:\n${stockIssues.join('\n')}`);
      error.status = 409;
      throw error;
    }

    // Active shift
    const activeShift = req.user?.id
      ? db.prepare("SELECT id FROM shifts WHERE status = 'open' AND user_id = ? ORDER BY id DESC LIMIT 1").get(req.user.id)
      : null;

    // Use the requested payment type or fallback to quotation's or default 'credit'
    const paymentType = req.body.payment_type || quotation.payment_type || 'credit';

    const discountTotal = quotation.lines.reduce((sum, line) => sum + Number(line.discount_amount || 0), 0);
    const subtotalTotal = quotation.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);
    const increaseAmount = Math.max(0, Number(req.body.increase ?? quotation.increase ?? 0));
    const decreaseAmount = Math.max(0, Number(req.body.decrease ?? quotation.decrease ?? 0));

    const invoiceNumber = `QINV-${String(Date.now()).slice(-6)}`;
    const invoiceId = db.transaction(() => {
      const invoice = db.prepare(`
        INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, increase, payment_type, status, notes, shift_id, user_id, tax_enabled, tax_rate, tax_amount, tax_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber,
        quotation.customer_id || null,
        subtotalTotal,
        discountTotal + decreaseAmount,
        Number(quotation.total || 0) + increaseAmount,
        increaseAmount,
        paymentType,
        quotation.notes || null,
        activeShift?.id || null,
        req.user?.id || null,
        quotation.tax_enabled || 0,
        quotation.tax_rate || 0,
        quotation.tax_amount || 0,
        quotation.tax_type || null,
      );

      const insertLine = db.prepare(
        "INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, line_total, warehouse_id) VALUES (?, ?, ?, ?, ?, ?)",
      );
      quotation.lines.forEach((line) => {
        insertLine.run(
          invoice.lastInsertRowid,
          line.item_id,
          Number(line.quantity || 0),
          Number(line.unit_price || 0),
          Number(line.line_total || 0),
          line.warehouse_id || defaultWhId,
        );
      });

      quotation.lines.forEach((line) => {
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || defaultWhId,
          quantityDelta: -Number(line.quantity || 0),
          movement_type: "sale",
          reference_type: "invoice",
          reference_id: invoice.lastInsertRowid,
          notes: `تحويل من عرض سعر #${req.params.id}`,
          user_id: req.user?.id || null,
        });
      });

      QuotationModel.markConverted(req.params.id);
      return invoice.lastInsertRowid;
    })();

    req.audit("update", "quotations", { id: req.params.id, invoice_id: invoiceId },
      `📋 تم تحويل عرض سعر إلى فاتورة: ${invoiceNumber}`);
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
