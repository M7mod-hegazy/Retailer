import React, { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppShell from "./components/layout/AppShell";
import ServerDownOverlay from "./components/ServerDownOverlay";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./stores/authStore";
import ScreenLock from "./components/auth/ScreenLock";
import GlobalSearchPage from "./pages/search/GlobalSearchPage";
import FullPageLoader from "./components/ui/FullPageLoader";
import { useCanView } from "./hooks/usePermission";
import { useUpdateStore } from "./stores/updateStore";
const UnauthorizedPage = lazy(() => import("./pages/auth/UnauthorizedPage"));
const NotFoundPage = lazy(() => import("./pages/error/NotFoundPage"));
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const AnalyticsPage = lazy(() => import("./pages/dashboard/AnalyticsPage"));
const FinanceWorkspacePage = lazy(() => import("./pages/workspaces/FinanceWorkspacePage"));
const PurchasesWorkspacePage = lazy(() => import("./pages/workspaces/PurchasesWorkspacePage"));
const InventoryWorkspacePage = lazy(() => import("./pages/workspaces/InventoryWorkspacePage"));
const OperationsWorkspacePage = lazy(() => import("./pages/workspaces/OperationsWorkspacePage"));
const CatalogWorkspacePage = lazy(() => import("./pages/workspaces/CatalogWorkspacePage"));
const PartiesWorkspacePage = lazy(() => import("./pages/workspaces/PartiesWorkspacePage"));
const ResourcesWorkspacePage = lazy(() => import("./pages/workspaces/ResourcesWorkspacePage"));
const TeamWorkspacePage = lazy(() => import("./pages/workspaces/TeamWorkspacePage"));
const CategoriesPage = lazy(() => import("./pages/definitions/CategoriesPage"));
const ItemsListPage = lazy(() => import("./pages/items/ItemsListPage"));
const CustomersListPage = lazy(() => import("./pages/customers/CustomersListPage"));
const SuppliersListPage = lazy(() => import("./pages/suppliers/SuppliersListPage"));
const RevenueCategoriesPage = lazy(() => import("./pages/definitions/RevenueCategoriesPage"));
const FinancialCategoriesPage = lazy(() => import("./pages/definitions/FinancialCategoriesPage"));
const WithdrawalsListPage = lazy(() => import("./pages/expenses/WithdrawalsListPage"));
const UnitsPage = lazy(() => import("./pages/definitions/UnitsPage"));
const WarehousesPage = lazy(() => import("./pages/definitions/WarehousesPage"));
const BranchesPage = lazy(() => import("./pages/definitions/BranchesPage"));
const BanksPage = lazy(() => import("./pages/definitions/BanksPage"));
const UsersPage = lazy(() => import("./pages/definitions/UsersPage"));
const EmployeesPage = lazy(() => import("./pages/definitions/EmployeesPage"));
const POSPage = lazy(() => import("./pages/pos/POSPage"));
const InvoiceDetailPage = lazy(() => import("./pages/pos/InvoiceDetailPage"));
const SalesReturnDetailPage = lazy(() => import("./pages/pos/SalesReturnDetailPage"));
const PurchaseReturnDetailPage = lazy(() => import("./pages/purchases/PurchaseReturnDetailPage"));
const PurchaseReturnsListPage = lazy(() => import("./pages/purchases/PurchaseReturnsListPage"));
const SalesReturnFormPage = lazy(() => import("./pages/sales/SalesReturnFormPage"));
const SalesReturnsListPage = lazy(() => import("./pages/sales/SalesReturnsListPage"));
const PurchaseFormPage = lazy(() => import("./pages/purchases/PurchaseFormPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/purchases/PurchaseOrdersPage"));
const PurchaseOrderFormPage = lazy(() => import("./pages/purchases/PurchaseOrderFormPage"));
const PurchaseReturnFormPage = lazy(() => import("./pages/purchases/PurchaseReturnFormPage"));
const PaymentsListPage = lazy(() => import("./pages/payments/PaymentsListPage"));
const PaymentFormPage = lazy(() => import("./pages/payments/PaymentFormPage"));
const ChequesPage = lazy(() => import("./pages/operations/ChequesPage"));
const ExpensesListPage = lazy(() => import("./pages/expenses/ExpensesListPage"));
const RevenuesListPage = lazy(() => import("./pages/expenses/RevenuesListPage"));
const StockLevelsPage = lazy(() => import("./pages/stock/StockLevelsPage"));
const StockMovementsPage = lazy(() => import("./pages/stock/StockMovementsPage"));
const StockTransferPage = lazy(() => import("./pages/stock/StockTransferPage"));
const PhysicalCountPage = lazy(() => import("./pages/stock/PhysicalCountPage"));
const BulkPriceUpdatePage = lazy(() => import("./pages/operations/BulkPriceUpdate"));
const EmployeeAdjustmentsPage = lazy(() => import("./pages/operations/EmployeeAdjustments"));
const QuotationsPage = lazy(() => import("./pages/operations/QuotationsPage"));
const BranchTransferPage = lazy(() => import("./pages/operations/BranchTransferPage"));
const BranchTransferFormPage = lazy(() => import("./pages/operations/BranchTransferFormPage"));
const QuotationFormPage = lazy(() => import("./pages/operations/QuotationFormPage"));
const ReportsCenterPage = lazy(() => import("./pages/reports/ReportsCenter"));
const ReportWorkspacePage = lazy(() => import("./pages/reports/ReportWorkspacePage"));
const SourceWorkspacePage = lazy(() => import("./pages/reports/SourceWorkspacePage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"));
const PromotionsPage = lazy(() => import("./pages/definitions/PromotionsPage"));
const DailyTreasuryPage = lazy(() => import("./pages/pos/DailyTreasuryPage"));
const PaymentMethodsPage = lazy(() => import("./pages/operations/PaymentMethodsPage"));
const PaymentTransactionsPage = lazy(() => import("./pages/operations/PaymentTransactionsPage"));
const CustomerProfilePage = lazy(() => import("./pages/definitions/CustomerProfilePage"));
const SupplierProfilePage = lazy(() => import("./pages/definitions/SupplierProfilePage"));
const BankOperationsPage = lazy(() => import("./pages/operations/BankOperationsPage"));
const ExpenseCategoriesPage = lazy(() => import("./pages/definitions/ExpenseCategoriesPage"));
const CustomerAccountsPage = lazy(() => import("./pages/accounts/CustomerAccountsPage"));
const SupplierAccountsPage = lazy(() => import("./pages/accounts/SupplierAccountsPage"));
const UpdatesPage = lazy(() => import("./pages/updates/UpdatesPage"));
const HistoryPage = lazy(() => import("./pages/history/HistoryPage"));

function PermissionRoute({ page, children }) {
  const canView = useCanView(page);
  if (!canView) return <Navigate to="/unauthorized" replace />;
  return children;
}


function AuthGuard({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { setAvailable, setNotAvailable, setProgress, setDownloaded, setError } = useUpdateStore();

  useEffect(() => {
    const cleanups = [
      window.electronAPI?.on('update:available', (info) => setAvailable(info)),
      window.electronAPI?.on('update:not-available', () => setNotAvailable()),
      window.electronAPI?.on('update:progress', (p) => setProgress(p)),
      window.electronAPI?.on('update:downloaded', (info) => setDownloaded(info)),
      window.electronAPI?.on('update:error', (e) => setError(e)),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [setAvailable, setNotAvailable, setProgress, setDownloaded, setError]);

  return (
    <Suspense fallback={<FullPageLoader />}>
      <ServerDownOverlay />
      <Toaster position="top-left" toastOptions={{ duration: 3000, style: { fontSize: "13px", fontWeight: 700, fontFamily: "inherit" } }} />
      <ScreenLock />
      <GlobalSearchPage />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<NotFoundPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppShell>
                <QueryClientProvider client={queryClient}>
                <Routes>
                  <Route path="unauthorized" element={<UnauthorizedPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="analytics" element={<PermissionRoute page="analytics"><AnalyticsPage /></PermissionRoute>} />
                    <Route path="workspace/finance" element={<FinanceWorkspacePage />} />
                    <Route path="workspace/purchases" element={<PurchasesWorkspacePage />} />
                    <Route path="workspace/inventory" element={<InventoryWorkspacePage />} />
                    <Route path="workspace/operations" element={<OperationsWorkspacePage />} />
                    <Route path="workspace/catalog" element={<CatalogWorkspacePage />} />
                    <Route path="workspace/parties" element={<PartiesWorkspacePage />} />
                    <Route path="workspace/resources" element={<ResourcesWorkspacePage />} />
                    <Route path="workspace/team" element={<TeamWorkspacePage />} />
                    <Route path="definitions/categories" element={<PermissionRoute page="categories"><CategoriesPage /></PermissionRoute>} />
                    <Route path="definitions/items" element={<PermissionRoute page="items"><ItemsListPage /></PermissionRoute>} />
                    <Route path="definitions/customers" element={<PermissionRoute page="customers"><CustomersListPage /></PermissionRoute>} />
                    <Route path="definitions/customers/:id" element={<PermissionRoute page="customers"><CustomerProfilePage /></PermissionRoute>} />
                    <Route path="definitions/suppliers" element={<PermissionRoute page="suppliers"><SuppliersListPage /></PermissionRoute>} />
                    <Route path="definitions/suppliers/:id" element={<PermissionRoute page="suppliers"><SupplierProfilePage /></PermissionRoute>} />
                    <Route path="definitions/expense-categories" element={<PermissionRoute page="financial_categories"><ExpenseCategoriesPage /></PermissionRoute>} />
                    <Route path="definitions/revenue-categories" element={<PermissionRoute page="financial_categories"><RevenueCategoriesPage /></PermissionRoute>} />
                    <Route path="definitions/financial-categories" element={<PermissionRoute page="financial_categories"><FinancialCategoriesPage /></PermissionRoute>} />
                    <Route path="definitions/units" element={<PermissionRoute page="units"><UnitsPage /></PermissionRoute>} />
                    <Route path="definitions/warehouses" element={<PermissionRoute page="warehouses"><WarehousesPage /></PermissionRoute>} />
                    <Route path="definitions/branches" element={<PermissionRoute page="branches"><BranchesPage /></PermissionRoute>} />
                    <Route path="definitions/treasuries" element={<Navigate to="/dashboard" replace />} />
                    <Route path="definitions/banks" element={<PermissionRoute page="banks"><BanksPage /></PermissionRoute>} />
                    <Route path="definitions/users" element={<PermissionRoute page="users"><UsersPage /></PermissionRoute>} />
                    <Route path="definitions/employees" element={<PermissionRoute page="employees"><EmployeesPage /></PermissionRoute>} />
                    <Route path="pos" element={<PermissionRoute page="pos"><POSPage /></PermissionRoute>} />
                    <Route path="invoices/:id" element={<PermissionRoute page="pos"><InvoiceDetailPage /></PermissionRoute>} />
                    <Route path="daily-treasury" element={<PermissionRoute page="daily_treasury"><DailyTreasuryPage /></PermissionRoute>} />
                    <Route path="operations/payment-methods" element={<PermissionRoute page="payment_methods"><PaymentMethodsPage /></PermissionRoute>} />
                    <Route path="operations/payment-transactions" element={<PermissionRoute page="payments"><PaymentTransactionsPage /></PermissionRoute>} />
                    <Route path="sales/returns" element={<PermissionRoute page="sales_returns"><SalesReturnsListPage /></PermissionRoute>} />
                    <Route path="sales/returns/new" element={<PermissionRoute page="sales_returns"><SalesReturnFormPage /></PermissionRoute>} />
                    <Route path="sales/returns/amend" element={<PermissionRoute page="sales_returns"><SalesReturnFormPage /></PermissionRoute>} />
                    <Route path="purchases" element={<Navigate to="/purchases/new" replace />} />
                    <Route path="purchases/new" element={<PermissionRoute page="purchases"><PurchaseFormPage /></PermissionRoute>} />
                    <Route path="purchases/:id" element={<PermissionRoute page="purchases"><PurchaseFormPage /></PermissionRoute>} />
                    <Route path="purchases/orders" element={<PermissionRoute page="purchase_orders"><PurchaseOrdersPage /></PermissionRoute>} />
                    <Route path="purchases/orders/new" element={<PermissionRoute page="purchase_orders"><PurchaseOrderFormPage /></PermissionRoute>} />
                    <Route path="purchases/returns" element={<PermissionRoute page="purchase_returns"><PurchaseReturnsListPage /></PermissionRoute>} />
                    <Route path="purchases/returns/new" element={<PermissionRoute page="purchase_returns"><PurchaseReturnFormPage /></PermissionRoute>} />
                    <Route path="purchases/returns/amend" element={<PermissionRoute page="purchase_returns"><PurchaseReturnFormPage /></PermissionRoute>} />
                    <Route path="purchases/returns/:id" element={<PermissionRoute page="purchase_returns"><PurchaseReturnDetailPage /></PermissionRoute>} />
                    <Route path="pos/sales-returns/:id" element={<PermissionRoute page="sales_returns"><SalesReturnDetailPage /></PermissionRoute>} />
                    <Route path="payments" element={<PermissionRoute page="payments"><PaymentsListPage /></PermissionRoute>} />
                    <Route path="payments/new" element={<PermissionRoute page="payments"><PaymentFormPage /></PermissionRoute>} />
                    <Route path="accounts/customers" element={<PermissionRoute page="customer_accounts"><CustomerAccountsPage /></PermissionRoute>} />
                    <Route path="accounts/suppliers" element={<PermissionRoute page="supplier_accounts"><SupplierAccountsPage /></PermissionRoute>} />
                    <Route path="operations/ajal-tracker" element={<Navigate to="/accounts/customers" replace />} />
                    <Route path="operations/cheques" element={<PermissionRoute page="cheques"><ChequesPage /></PermissionRoute>} />
                    <Route path="operations/payment-transactions" element={<Navigate to="/operations/payment-methods" replace />} />
                    <Route path="operations/treasury-transfer" element={<Navigate to="/expenses" replace />} />
                    <Route path="operations/installments" element={<Navigate to="/accounts/customers" replace />} />
                    <Route path="operations/bank-operations" element={<PermissionRoute page="bank_operations"><BankOperationsPage /></PermissionRoute>} />
                    <Route path="operations/bulk-price-update" element={<PermissionRoute page="bulk_price_update"><BulkPriceUpdatePage /></PermissionRoute>} />
                    <Route path="operations/employee-adjustments" element={<PermissionRoute page="employee_adjustments"><EmployeeAdjustmentsPage /></PermissionRoute>} />
                    <Route path="operations/branch-transfer" element={<PermissionRoute page="branch_transfer"><BranchTransferPage /></PermissionRoute>} />
                    <Route path="operations/branch-transfer/new" element={<PermissionRoute page="branch_transfer"><BranchTransferFormPage /></PermissionRoute>} />
                    <Route path="operations/branch-transfer/edit/:id" element={<PermissionRoute page="branch_transfer"><BranchTransferFormPage /></PermissionRoute>} />
                    <Route path="operations/quotations" element={<PermissionRoute page="quotations"><QuotationsPage /></PermissionRoute>} />
                    <Route path="operations/quotations/new" element={<PermissionRoute page="quotations"><QuotationFormPage /></PermissionRoute>} />
                    <Route path="reports/center" element={<PermissionRoute page="reports"><ReportsCenterPage /></PermissionRoute>} />
                    <Route path="reports/source/:sourceKey/:classificationId/:dataMode" element={<PermissionRoute page="reports"><SourceWorkspacePage /></PermissionRoute>} />
                    <Route path="reports/:reportSlug" element={<PermissionRoute page="reports"><ReportWorkspacePage /></PermissionRoute>} />
                    <Route path="settings" element={<PermissionRoute page="settings"><SettingsPage /></PermissionRoute>} />
                    <Route path="notifications" element={<PermissionRoute page="notifications"><NotificationsPage /></PermissionRoute>} />
                    <Route path="updates" element={<PermissionRoute page="updates"><UpdatesPage /></PermissionRoute>} />
                    <Route path="history" element={<PermissionRoute page="history"><HistoryPage /></PermissionRoute>} />
                    <Route path="definitions/promotions" element={<PermissionRoute page="promotions"><PromotionsPage /></PermissionRoute>} />
                    <Route path="expenses" element={<PermissionRoute page="expenses"><ExpensesListPage /></PermissionRoute>} />
                    <Route path="revenues" element={<PermissionRoute page="revenues"><RevenuesListPage /></PermissionRoute>} />
                    <Route path="withdrawals" element={<PermissionRoute page="withdrawals"><WithdrawalsListPage /></PermissionRoute>} />
                    <Route path="stock/levels" element={<PermissionRoute page="stock"><StockLevelsPage /></PermissionRoute>} />
                    <Route path="stock/movements" element={<PermissionRoute page="stock"><StockMovementsPage /></PermissionRoute>} />
                    <Route path="stock/transfer" element={<PermissionRoute page="stock_transfer"><StockTransferPage /></PermissionRoute>} />
                    <Route path="stock/physical-count" element={<PermissionRoute page="physical_count"><PhysicalCountPage /></PermissionRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                  </QueryClientProvider>
                </AppShell>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    );
  }
