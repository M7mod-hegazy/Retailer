const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { getUploadsDir } = require("./middleware/upload");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth.routes");
const settingsRoutes = require("./routes/settings.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const itemsRoutes = require("./routes/items.routes");
const categoriesRoutes = require("./routes/categories.routes");
const unitsRoutes = require("./routes/units.routes");
const customersRoutes = require("./routes/customers.routes");
const suppliersRoutes = require("./routes/suppliers.routes");
const warehousesRoutes = require("./routes/warehouses.routes");
const treasuriesRoutes = require("./routes/treasuries.routes");
const banksRoutes = require("./routes/banks.routes");
const usersRoutes = require("./routes/users.routes");
const employeesRoutes = require("./routes/employees.routes");
const shiftsRoutes = require("./routes/shifts.routes");
const invoicesRoutes = require("./routes/invoices.routes");
const purchasesRoutes = require("./routes/purchases.routes");
const purchaseOrdersRoutes = require("./routes/purchaseOrders.routes");
const paymentsRoutes = require("./routes/payments.routes");
const chequesRoutes = require("./routes/cheques.routes");
const expensesRoutes = require("./routes/expenses.routes");
const revenuesRoutes = require("./routes/revenues.routes");
const withdrawalsRoutes = require("./routes/withdrawals.routes");
const stockRoutes = require("./routes/stock.routes");
const operationsRoutes = require("./routes/operations.routes");
const reportRoutes = require("./routes/report.routes");
const ownerStatementsRoutes = require("./routes/ownerStatements.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const promotionsRoutes = require("./routes/promotions.routes");
const helpRoutes = require("./routes/help.routes");
const documentsRoutes = require("./routes/documents.routes");
const backupRoutes = require("./routes/backup.routes");
const searchRoutes = require("./routes/search.routes");
const loyaltyRoutes = require("./routes/loyalty.routes");
const quotationsRoutes = require("./routes/quotations.routes");
const paymentMethodsRoutes = require("./routes/paymentMethods.routes");
const printSettingsRoutes = require("./routes/printSettings.routes");
const uploadRoutes = require("./routes/upload.routes");
const branchTransfersRoutes = require("./routes/branchTransfers.routes");
const branchesRoutes = require("./routes/branches.routes");
const dailySessionsRoutes = require("./routes/dailySessions.routes");
const ajalDebtsRoutes = require("./routes/ajalDebts.routes");
const auditRoutes = require("./routes/audit.routes");
const installmentsRoutes = require("./routes/installments.routes");
const posDraftsRoutes = require("./routes/posDrafts");
const posRoutes = require("./routes/pos.routes");
const pricingRoutes = require("./routes/pricing.routes");
const whatsappRoutes = require("./routes/whatsapp.routes");
const leadsRoutes = require("./routes/leads.routes");
const itemUnitsRoutes = require("./routes/itemUnits.routes");
const variantsRoutes = require("./routes/variants.routes");
const serialsRoutes = require("./routes/serials.routes");
const repairOrdersRoutes = require("./routes/repairOrders.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const goldRoutes = require("./routes/gold.routes");
const { errorHandler } = require("./middleware/errorHandler");
const logger = require("./config/logger");
const { getDb } = require("./config/database");

function createApp() {
  const app = express();

  // Serve uploaded images — lazy so UPLOADS_DIR env var is resolved at request time
  app.use("/uploads", (req, res, next) => {
    express.static(getUploadsDir(), { maxAge: "7d" })(req, res, next);
  });

  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin.includes("127.0.0.1") || origin.includes("localhost") || /^http:\/\/192\.168\./.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Origin not allowed"));
    },
    credentials: true,
  }));

  app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: "10mb" }));

  // Health check. Stays a 200 even if the DB probe fails (a momentary lock must NOT be
  // read as "server down" by the client), but reports db status for diagnostics. Wrapped
  // so it can never itself throw/hang and become a crash source.
  app.get(["/health", "/api/health"], (_req, res) => {
    let db = true;
    try {
      getDb().prepare("SELECT 1").get();
    } catch (_e) {
      db = false;
    }
    res.json({ ok: true, db });
  });

  // Best-effort client diagnostics sink — records WHY a renderer saw a disconnect
  // (timeout vs connection-refused vs crash vs port-mismatch) so a random production
  // incident is explainable from the server log. No auth, never throws.
  app.post("/api/diag/client-event", (req, res) => {
    try {
      logger.warn({ message: "client-diag", event: req.body || {} });
    } catch (_e) {
      /* diagnostics must never break anything */
    }
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/items", itemsRoutes);
  app.use("/api/items/:itemId/units", itemUnitsRoutes);
  app.use("/api/variants", variantsRoutes);
  app.use("/api/serials", serialsRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/units", unitsRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/suppliers", suppliersRoutes);
  app.use("/api/warehouses", warehousesRoutes);
  app.use("/api/treasuries", treasuriesRoutes);
  app.use("/api/banks", banksRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/employees", employeesRoutes);
  app.use("/api/shifts", shiftsRoutes);
  app.use("/api/invoices", invoicesRoutes);
  app.use("/api/purchases", purchasesRoutes);
  app.use("/api/purchase-orders", purchaseOrdersRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/cheques", chequesRoutes);
  app.use("/api/expenses", expensesRoutes);
  app.use("/api/revenues", revenuesRoutes);
  app.use("/api/withdrawals", withdrawalsRoutes);
  app.use("/api/stock", stockRoutes);
  app.use("/api/operations", operationsRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/owner-statements", ownerStatementsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/promotions", promotionsRoutes);
  app.use("/api/help", helpRoutes);
  app.use("/api/loyalty", loyaltyRoutes);
  app.use("/api/backup", backupRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/quotations", quotationsRoutes);
  app.use("/api/payment-methods", paymentMethodsRoutes);
  app.use("/api/print-settings-per-doc", printSettingsRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/branch-transfers", branchTransfersRoutes);
  app.use("/api/branches", branchesRoutes);
  app.use("/api/daily-sessions", dailySessionsRoutes);
  app.use("/api/ajal-debts", ajalDebtsRoutes);
  app.use("/api/installments", installmentsRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/documents", documentsRoutes);
  app.use("/api/pos-drafts", posDraftsRoutes);
  app.use("/api/pos", posRoutes);
  app.use("/api/pricing", pricingRoutes);
  app.use("/api/whatsapp", whatsappRoutes);
  app.use("/api/leads", leadsRoutes);
  app.use("/api/repair-orders", repairOrdersRoutes);
  app.use("/api/restaurant", restaurantRoutes);
  app.use("/api/gold", goldRoutes);

  // Serve built React frontend in production web mode (client/dist must exist)
  const path = require("path");
  const fs = require("fs");
  const clientDist = path.join(__dirname, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use("/assets", express.static(path.join(clientDist, "assets"), {
      maxAge: "1y",
      immutable: true,
    }));
    app.use(express.static(clientDist, {
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
