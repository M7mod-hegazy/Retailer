const express = require("express");
const { createInvoice, getInvoiceWithLines, editInvoice, cancelInvoice, amendInvoice } = require("../services/invoiceService");
const { createReturn, createGeneralReturn, getReturns, getReturnDetails, cancelSalesReturn, amendSalesReturn, editSalesReturn } = require("../services/returnService");
const { adjustStock } = require("../services/stockService");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const NotificationModel = require("../models/notification.model");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("pos", "view"), (req, res) => {
  try {
    const db = getDb();
    const { date_from, date_to, sort = "created_at", dir = "desc", search = "", customer_id, user_id } = req.query;
    const allowedSort = ["created_at", "total", "invoice_no", "payment_type", "status"];
    const safeSort = allowedSort.includes(sort) ? `i.${sort}` : "i.created_at";
    const safeDir  = dir === "asc" ? "ASC" : "DESC";
    const conditions = [];
    const params = [];
    if (date_from && date_to) {
      conditions.push("date(i.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    } else if (date_from || date_to) {
      const day = date_from || date_to;
      conditions.push("date(i.created_at) = date(?)");
      params.push(day);
    }
    if (search) {
      conditions.push("(c.name LIKE ? OR i.invoice_no LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (customer_id) { conditions.push("i.customer_id = ?"); params.push(customer_id); }
    if (user_id) { conditions.push("i.user_id = ?"); params.push(user_id); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT i.id, i.invoice_no, i.subtotal, i.discount, i.total,
             i.payment_type, i.status, i.created_at,
             i.amended_by, i.amendment_of,
             (SELECT invoice_no FROM invoices WHERE id = i.amendment_of) AS amendment_of_no,
             (SELECT invoice_no FROM invoices WHERE id = i.amended_by)   AS amended_by_no,
             c.name AS customer_name, c.phone AS customer_phone,
             e.name AS seller_name,
             u.username AS cancelled_by_name,
             u2.username AS created_by_username,
             i.user_id AS created_by_user_id,
             (SELECT COUNT(*) FROM invoice_lines WHERE invoice_id = i.id) AS items_count
      FROM invoices i
      LEFT JOIN customers  c ON c.id = i.customer_id
      LEFT JOIN employees  e ON e.id = i.seller_id
      LEFT JOIN users      u ON u.id = i.cancelled_by
      LEFT JOIN users      u2 ON u2.id = i.user_id
      ${where}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT 100
    `).all(...params);
    const summary = rows.reduce((acc, r) => ({ count: acc.count + 1, total: acc.total + Number(r.total || 0) }), { count: 0, total: 0 });
    res.json({ success: true, data: rows, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Returns the most recent unit_price this item was sold at
router.get("/last-price/:itemId", requirePagePermission("pos", "view"), (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT il.unit_price
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      WHERE il.item_id = ? AND i.status != 'cancelled'
      ORDER BY i.created_at DESC
      LIMIT 1
    `).get(Number(req.params.itemId));
    res.json({ success: true, data: row?.unit_price ?? null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/returns", requirePagePermission("sales_returns", "view"), (req, res) => {
  try {
    const db = getDb();
    const { search = "", customer_id, date_from, date_to, sort = "created_at", dir = "desc", user_id = "" } = req.query;
    const conditions = ["1=1"];
    const params = [];
    if (search) {
      conditions.push("(c.name LIKE ? OR CAST(sr.id AS TEXT) LIKE ? OR i.invoice_no LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (customer_id) { conditions.push("sr.customer_id = ?"); params.push(customer_id); }
    if (date_from) { conditions.push("date(sr.created_at) >= date(?)"); params.push(date_from); }
    if (date_to) { conditions.push("date(sr.created_at) <= date(?)"); params.push(date_to); }
    if (user_id) { conditions.push("sr.created_by = ?"); params.push(user_id); }
    const allowedSort = ["created_at", "total", "doc_no", "refund_method", "status"];
    const safeSort = allowedSort.includes(sort) ? sort : "created_at";
    const safeDir = dir === "asc" ? "ASC" : "DESC";
    const returns = db.prepare(`
      SELECT sr.*, c.name AS customer_name, i.invoice_no AS original_invoice_no, u.username AS created_by_username
      FROM sales_returns sr
      LEFT JOIN customers c ON c.id = sr.customer_id
      LEFT JOIN invoices i ON i.id = sr.invoice_id
      LEFT JOIN users u ON u.id = sr.created_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${safeSort === "refund_method" ? "sr.refund_method" : `sr.${safeSort}`} ${safeDir}
    `).all(...params);
    const total = returns.reduce((s, x) => s + Number(x.total || 0), 0);
    res.json({ success: true, data: returns, summary: { count: returns.length, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/returns/:id", requirePagePermission("sales_returns", "view"), (req, res, next) => {
    try {
        const sr = getReturnDetails(Number(req.params.id));
        if (!sr) throw new Error("Return not found");
        res.json({ success: true, data: sr });
    } catch (e) { next(e); }
});

router.post("/general-return", requirePagePermission("sales_returns", "add"), (req, res, next) => {
  try {
    const result = createGeneralReturn({ ...req.body, user_id: req.user?.id || req.body.user_id || null });
    req.audit("create", "sales_return", { id: result?.id }, `↩️ تم إنشاء مرتجع مبيعات عام #${result?.id}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/returns/:id/cancel", requirePagePermission("sales_returns", "delete"), (req, res, next) => {
  try {
    const { reason, user_id } = req.body || {};
    const result = cancelSalesReturn(Number(req.params.id), reason, req.user?.id || user_id || null);
    req.audit("cancel", "sales_return", { id: Number(req.params.id), reason }, `↩️ تم إلغاء مرتجع مبيعات #${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.put("/returns/:id", requirePagePermission("sales_returns", "edit"), (req, res, next) => {
  try {
    const result = editSalesReturn(Number(req.params.id), req.body || {}, req.user?.id || req.body?.user_id || null);
    req.audit("edit", "sales_return", { id: Number(req.params.id) }, `↩️ تم تعديل مرتجع مبيعات #${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.put("/returns/:id/amend", requirePagePermission("sales_returns", "edit"), (req, res, next) => {
  try {
    const result = amendSalesReturn(Number(req.params.id), req.body || {}, req.user?.id || req.body?.user_id || null);
    req.audit("amend", "sales_return", { id: Number(req.params.id) }, `↩️ تم تعديل (أمندمنت) مرتجع مبيعات #${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/general-purchase-return", requirePagePermission("purchase_returns", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const { lines, supplier_id, refund_method, notes, reason } = req.body;
    if (!lines || !lines.length) { const e = new Error("يجب إضافة أصناف"); e.status = 400; throw e; }

    const result = db.transaction(() => {
      const docNo = "GPR-" + Date.now();
      let total = 0;
      for (const line of lines) {
        total += Number(line.quantity) * Number(line.unit_price);
      }

      const ret = db.prepare(`
        INSERT INTO purchase_returns (doc_no, purchase_id, supplier_id, total, refund_method, reason, notes, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(docNo, supplier_id || null, total, refund_method || 'cash_back', reason || 'other', notes || null);

      for (const line of lines) {
        const lineTotal = Number(line.quantity) * Number(line.unit_price);
        db.prepare("INSERT INTO purchase_return_lines (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, unit_price, line_total) VALUES (?, NULL, ?, ?, ?, ?, ?)").run(ret.lastInsertRowid, line.item_id, line.quantity, line.unit_price, line.unit_price, lineTotal);
        // Stock goes out on purchase return
        adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: -Number(line.quantity), movement_type: "purchase_return", reference_type: "purchase_return", reference_id: ret.lastInsertRowid });
      }

      if (refund_method === 'cash_back' || !refund_method) {
        const tId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(total, tId);
      } else if (refund_method === 'credit_note' && supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(total, supplier_id);
      }

      return { id: ret.lastInsertRowid, doc_no: docNo, total };
    })();

    req.audit("create", "purchase_return", { id: result.id, doc_no: result.doc_no, total: result.total }, `↩️ تم إنشاء مرتجع مشتريات عام #${result.id} بمبلغ ${result.total}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.get("/items-search", requirePagePermission("pos", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { q = "", invoice_search = "", customer_search = "", customer_id = "", user_id = "", date_from, date_to } = req.query;
    if (!q.trim()) return res.json({ success: true, data: [] });

    const conditions = ["i.status != 'cancelled'"];
    const params = [];

    conditions.push("(it.name LIKE ? OR it.code LIKE ? OR it.barcode LIKE ?)");
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);

    if (invoice_search.trim()) {
      conditions.push("i.invoice_no LIKE ?");
      params.push(`%${invoice_search.trim()}%`);
    }
    if (customer_search.trim()) {
      conditions.push("c.name LIKE ?");
      params.push(`%${customer_search.trim()}%`);
    }
    if (customer_id) { conditions.push("i.customer_id = ?"); params.push(customer_id); }
    if (user_id) { conditions.push("i.user_id = ?"); params.push(user_id); }
    if (date_from && date_to) {
      conditions.push("date(i.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    } else if (date_from || date_to) {
      conditions.push("date(i.created_at) = date(?)");
      params.push(date_from || date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT il.id AS line_id, il.invoice_id, i.invoice_no, i.created_at, i.status,
             i.customer_id, c.name AS customer_name,
             i.payment_type AS payment_method, i.user_id,
             u.username AS created_by_username,
             il.item_id, it.name AS item_name, it.code AS item_code, it.barcode, it.purchase_price,
             il.quantity, il.unit_price, il.line_total,
             COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl WHERE srl.invoice_line_id = il.id), 0) AS already_returned,
             (il.quantity - COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl WHERE srl.invoice_line_id = il.id), 0)) AS returnable_qty
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      JOIN items it ON it.id = il.item_id
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN users u ON u.id = i.user_id
      ${where}
      ORDER BY i.created_at DESC
      LIMIT 100
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/cancel-reasons", requirePagePermission("pos", "view"), (_req, res) => {
  res.json({
    success: true,
    data: [
      "خطأ في البيانات",
      "طلب العميل الإلغاء",
      "خطأ في السعر",
      "خطأ في الكمية",
      "تكرار الفاتورة",
      "تعديل الفاتورة",
    ],
  });
});

router.get("/:id", requirePagePermission("pos", "view"), (req, res, next) => {
  try {
    const invoice = getInvoiceWithLines(Number(req.params.id));
    if (!invoice) {
      const error = new Error("Invoice not found");
      error.status = 404;
      throw error;
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requirePagePermission("pos", "edit"), (req, res, next) => {
  try {
    const result = editInvoice(Number(req.params.id), req.body);
    req.audit("edit", "invoice", { id: Number(req.params.id) }, `🧾 تم تعديل فاتورة #${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/", requirePagePermission("pos", "add"), (req, res) => {
  const payload = { ...(req.body || {}), user_id: req.user?.id || null };
  const invoice = createInvoice(payload);
  req.audit("create", "invoice", { id: invoice?.id, invoice_no: invoice?.invoice_no, total: invoice?.total }, `🧾 تم إنشاء فاتورة #${invoice?.invoice_no || invoice?.id}`);
  // Notify on large invoice (total > 1000)
  try {
    if (invoice?.total > 1000 && invoice?.id) {
      const customerName = invoice?.customer_name || req.body?.customer_name || 'غير محدد';
      NotificationModel.create({
        title: "🧾 فاتورة بمبلغ كبير",
        body: `فاتورة #${invoice.id} للعميل ${customerName} — المبلغ: ${invoice.total}`,
        type: "info",
        link: `/invoices/${invoice.id}`,
      });
    }
  } catch (_) {}
  // Notify on large discount (> 20%)
  try {
    const discount = Number(payload.discount_percent || 0);
    if (discount > 20 && invoice?.id) {
      const db = getDb();
      const alreadyNotified = db.prepare(
        "SELECT id FROM notifications WHERE title = ? AND body LIKE ? AND date(created_at) = date('now') LIMIT 1"
      ).get('💸 خصم كبير مطبق', `%#${invoice.id}%`);
      if (!alreadyNotified) {
        NotificationModel.create({
          title: "💸 خصم كبير مطبق",
          body: `خصم ${discount}% على الفاتورة #${invoice.id}`,
          type: "warning",
          link: `/invoices/${invoice.id}`,
        });
      }
    }
  } catch (_) {}
  res.status(201).json({ success: true, data: invoice });
});

router.post("/:id/return", requirePagePermission("sales_returns", "add"), (req, res, next) => {
  try {
    const salesReturn = createReturn(Number(req.params.id), req.body || {});
    req.audit("create", "sales_return", { invoice_id: Number(req.params.id), return_id: salesReturn?.id }, `↩️ تم معالجة مرتجع للفاتورة #${req.params.id}`);
    try {
      const invoiceId = req.params.id;
      const returnTotal = salesReturn?.total ?? 0;
      NotificationModel.create({
        title: "↩️ تم معالجة مرتجع",
        body: `مرتجع على الفاتورة #${invoiceId} — بمبلغ ${returnTotal}`,
        type: "info",
        link: `/invoices`,
      });
    } catch (_) {}
    res.status(201).json({ success: true, data: salesReturn });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/void", requirePagePermission("pos", "void"), (req, res, next) => {
  try {
    if (!req.body.reason) {
      const error = new Error("Void reason is required");
      error.status = 400;
      throw error;
    }
    const { voidInvoice } = require("../services/invoiceService");
    const voided = voidInvoice(Number(req.params.id), req.body.reason, req.user?.id || 1);
    req.audit("void", "invoice", { id: Number(req.params.id), reason: req.body.reason }, `🧾 تم إلغاء فاتورة #${req.params.id}`);
    try {
      NotificationModel.create({
        title: "🧾 تم إلغاء فاتورة",
        body: `تم إلغاء الفاتورة رقم #${req.params.id}`,
        type: "warning",
        link: `/invoices/${req.params.id}`,
      });
    } catch (_) {}
    res.json({ success: true, data: voided });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requirePagePermission("pos", "delete"), (req, res, next) => {
  try {
    const result = cancelInvoice(Number(req.params.id), req.body?.reason, req.user?.id);
    req.audit("cancel", "invoice", { id: Number(req.params.id), reason: req.body?.reason }, `🧾 تم حذف/إلغاء فاتورة #${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/amend", requirePagePermission("pos", "edit"), (req, res, next) => {
  try {
    const result = amendInvoice(Number(req.params.id), req.body, req.user?.id);
    req.audit("amend", "invoice", { original_id: Number(req.params.id), new_id: result?.id }, `🧾 تم تعديل (أمندمنت) فاتورة #${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
