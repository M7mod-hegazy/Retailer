const users = require("./queries/users");
const sales = require("./queries/sales");
const purchases = require("./queries/purchases");
const inventory = require("./queries/inventory");
const accounts = require("./queries/accounts");
const treasury = require("./queries/treasury");
const tax = require("./queries/tax");
const audit = require("./queries/audit");
const expenses = require("./queries/expenses");
const revenues = require("./queries/revenues");
const cheques = require("./queries/cheques");
const installments = require("./queries/installments");
const warehouses = require("./queries/warehouses");
const employees = require("./queries/employees");
const profit = require("./queries/profit");
const customers = require("./queries/customers");

const dispatcher = {
  // Sales
  "daily-sales": sales.dailySales,
  "detailed-sales": sales.detailedSales,
  "sales-by-item": sales.salesByItem,
  "sales-by-category": sales.salesByCategory,
  "sales-by-cashier": sales.salesByCashier,
  "sales-by-payment": sales.salesByPayment,
  "sales-heatmap": sales.salesHeatmap,
  "period-comparison": sales.periodComparison,
  "cashier-override-impact": sales.cashierOverrideImpactReport,
  "gross-net-sales": sales.grossNetSales,
  "sales-returns": sales.salesReturns,
  "sales-returns-summary": sales.salesReturnsSummary,
  "sales-returns-by-customer": sales.salesReturnsByCustomer,
  "discount-analysis": sales.discountAnalysis,
  "margin-by-item": sales.marginByItem,
  "margin-by-category": sales.marginByCategory,
  "margin-health": sales.marginHealth,
  "shift-history": sales.shiftHistory,

  // Purchases
  "purchase-summary": purchases.purchaseSummary,
  "detailed-purchases": purchases.detailedPurchases,
  "purchases-by-supplier": purchases.purchasesBySupplier,
  "purchases-by-item": purchases.purchasesByItem,
  "purchase-returns": purchases.purchaseReturns,
  "purchase-returns-summary": purchases.purchaseReturnsSummary,
  "purchase-returns-by-supplier": purchases.purchaseReturnsBySupplier,
  "supplier-pricing": purchases.supplierPricing,

  // Inventory
  "slow-moving": inventory.slowMoving,
  "stock-levels": inventory.stockLevels,
  "stock-movements": inventory.stockMovements,
  "stock-valuation": inventory.stockValuation,
  "count-sheet": inventory.countSheet,
  "reorder": inventory.reorderReport,
  "expiry": inventory.expiryReport,
  "inventory-aging": inventory.inventoryAging,
  "dead-stock": inventory.deadStock,
  "cost-movements": inventory.costMovementReport,
  "cost-method-comparison": inventory.costMethodComparison,
  "item-lifecycle": inventory.itemLifecycleReport,
  "margin-drift": inventory.marginDriftReport,
  "inventory-turnover": inventory.inventoryTurnoverReport,
  "stock-adjustment-audit": inventory.stockAdjustmentAuditReport,

  // Accounts
  "profit-loss": accounts.profitLoss,
  "customer-statement": accounts.customerStatement,
  "supplier-statement": accounts.supplierStatement,
  "daily-owner-snapshot": accounts.dailyOwnerSnapshot,
  "ar-aging": accounts.arAging,
  "ap-aging": accounts.apAging,
  "customer-balance-list": accounts.customerBalanceList,
  "supplier-balance-list": accounts.supplierBalanceList,

  // Customers
  "top-customers": customers.topCustomers,
  "collection-efficiency": customers.collectionEfficiency,
  "customer-loyalty": customers.customerLoyalty,

  // Purchases (supplier reports)
  "supplier-reliability": purchases.supplierReliabilityReport,

  // Treasury
  "cash-flow": treasury.cashFlow,
  "treasury": treasury.treasury,
  "cash-consistency": treasury.cashConsistency,
  "payment-method-flow": treasury.paymentMethodFlow,
  "payment-flow-summary": treasury.paymentFlowSummaryReport,
  "payment-flow-ledger": treasury.paymentFlowLedgerReport,
  "payment-flow-by-doc-type": treasury.paymentFlowByDocTypeReport,
  "payment-flow-by-direction": treasury.paymentFlowByDirectionReport,
  "payment-flow-running": treasury.paymentFlowRunningReport,
  "bank-cash-split": treasury.bankCashSplit,
  "reconciliation-exceptions": treasury.reconciliationExceptions,
  "daily-sessions": treasury.dailySessionsReport,
  "withdrawals-report": treasury.withdrawalsReport,

  // Tax
  "vat": tax.vat,
  "output-vat": tax.outputVat,
  "input-vat": tax.inputVat,
  "vat-filing-summary": tax.vatFilingSummary,
  "returns-tax-effect": tax.returnsTaxEffect,

  // Audit
  "exceptions": audit.exceptionsReport,
  "audit-log": audit.auditLog,
  "user-activity": audit.userActivity,

  // Expenses
  "expense-summary": expenses.expenseSummary,
  "detailed-expenses": expenses.detailedExpenses,
  "expenses-by-category": expenses.expensesByCategory,
  "expenses-by-payment": expenses.expensesByPayment,

  // Revenues
  "revenue-summary": revenues.revenueSummary,
  "detailed-revenues": revenues.detailedRevenues,
  "revenues-by-category": revenues.revenuesByCategory,
  "revenues-by-payment": revenues.revenuesByPayment,

  // Cheques
  "cheque-listing": cheques.chequeListing,
  "bank-transactions": cheques.bankTransactions,
  "bank-summary": cheques.bankSummary,

  // Installments
  "installment-plans": installments.installmentPlans,
  "installment-collections": installments.installmentCollections,
  "installments-by-customer": installments.installmentsByCustomer,
  "installment-delinquent": installments.installmentDelinquent,

  // Warehouses
  "branch-transfers": warehouses.branchTransfers,
  "warehouse-levels": warehouses.warehouseLevels,
  "warehouse-levels-summary": warehouses.warehouseLevelsSummary,

  // Employees
  "employee-adjustments": employees.employeeAdjustments,
  "employee-list": employees.employeeList,
  "employee-deductions": employees.employeeDeductions,
  "employee-bonuses": employees.employeeBonuses,
  "employee-advances": employees.employeeAdvances,
  "employee-payroll": employees.employeePayroll,
  "employee-full-history": employees.employeeFullHistory,

  // Profit
  "profit-by-category": profit.profitByCategory,
  "profit-by-customer": profit.profitByCustomer,
  "profit-by-period": profit.profitByPeriod,

  // Users
  "user-list": users.userList,
  "user-performance": users.userPerformance,
  "login-history": users.loginHistory,
};

function listRows(slug, startDate, endDate, opts = {}) {
  const fn = dispatcher[slug];
  if (!fn) return [];
  return fn(startDate, endDate, opts);
}

function listRowsBySource(sourceKey, classificationId, dataMode, startDate, endDate, opts = {}) {
  const { resolveQuerySlug } = require("./registry");
  const slug = resolveQuerySlug(sourceKey, classificationId, dataMode);
  if (!slug) return [];
  return listRows(slug, startDate, endDate, opts);
}

module.exports = { listRows, listRowsBySource, dispatcher };
