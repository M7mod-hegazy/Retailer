// Central registration file for all modals that support the detach feature.
// Eagerly imported from main.jsx so registrations are available in both the
// main window and child (detached) windows before any modal renders.
//
// PERF: every component here is registered as React.lazy. The registry's
// components are ONLY rendered by DetachedModalHost (inside a child window),
// so eager imports would drag ~35 heavy modals — plus the whole print,
// purchases and returns dependency trees — into the entry bundle that weak
// devices must parse before the login screen can paint. Lazy registration
// keeps registration itself instant; the actual code loads on first render of
// a detached window, behind DetachedModalHost's Suspense spinner.
import { lazy } from "react";
import { registerModal, defaultDeserialize } from "./modalRegistry";

const ConfirmDialog = lazy(() => import("../ui/ConfirmDialog"));
const DeleteImpactModal = lazy(() => import("../ui/DeleteImpactModal"));
const DetachedCustomerForm = lazy(() => import("../modals/DetachedCustomerForm"));
const DetachedSupplierForm = lazy(() => import("../modals/DetachedSupplierForm"));
const SupplierInfoModal = lazy(() => import("../modals/SupplierInfoModal"));
const CustomerInfoModal = lazy(() => import("../modals/CustomerInfoModal"));
const DefaultPermissionsModal = lazy(() => import("../modals/DefaultPermissionsModal"));
const ExpenseFormModal = lazy(() => import("../../pages/expenses/ExpenseFormModal"));
const RevenueFormModal = lazy(() => import("../../pages/expenses/RevenueFormModal"));
const GeneralPurchaseReturnModal = lazy(() => import("../../components/returns/GeneralPurchaseReturnModal"));
const GeneralReturnModal = lazy(() => import("../../components/returns/GeneralReturnModal"));
const QuickReturnModal = lazy(() => import("../../components/returns/QuickReturnModal"));
const PurchaseProfitModal = lazy(() => import("../../components/purchases/PurchaseProfitModal"));
const PosCashCheckoutModal = lazy(() => import("../../components/pos/PosCashCheckoutModal"));
const DramaticDeleteConfirm = lazy(() =>
  import("../../components/ui/DramaticDeleteConfirm").then((m) => ({ default: m.DramaticDeleteConfirm })),
);
const ShortcutCheatsheetModal = lazy(() => import("../../shortcuts/ShortcutCheatsheetModal"));
const PayInPayOutModal = lazy(() => import("../../pages/pos/PayInPayOutModal"));
const SupervisorPINModal = lazy(() => import("../../components/auth/SupervisorPINModal"));
const PermissionDeniedModal = lazy(() => import("../../components/ui/PermissionDeniedModal"));
const PrintPreviewModal = lazy(() => import("../../components/print/PrintPreviewModal"));
const PDFExportDialog = lazy(() => import("../../components/print/PDFExportDialog"));
const LineConfigModal = lazy(() => import("../../components/pos/LineConfigModal"));
const GalleryModal = lazy(() => import("../../pages/pos/parts/GalleryModal"));
const HeldDropdown = lazy(() => import("../../pages/pos/parts/HeldDropdown"));
const POSTodayModal = lazy(() => import("../../components/pos/POSTodayModal"));
const InvoicePreviewModal = lazy(() => import("../../components/pos/InvoicePreviewModal"));
const TodayPurchasesModal = lazy(() => import("../../components/purchases/TodayPurchasesModal"));
const PurchasePreviewModal = lazy(() =>
  import("../../components/purchases/TodayPurchasesModal").then((m) => ({ default: m.PurchasePreviewModal })),
);
const PurchasePickerTodayModal = lazy(() => import("../../components/purchases/PurchasePickerTodayModal"));
const PurchaseReturnTodayModal = lazy(() => import("../../components/purchases/PurchaseReturnTodayModal"));
const PurchaseReturnPreviewModal = lazy(() =>
  import("../../components/purchases/PurchaseReturnTodayModal").then((m) => ({ default: m.ReturnPreviewModal })),
);
const InvoicePickerTodayModal = lazy(() => import("../../components/sales/InvoicePickerTodayModal"));
const SalesReturnTodayModal = lazy(() => import("../../components/sales/SalesReturnTodayModal"));
const SalesReturnPreviewModal = lazy(() =>
  import("../../components/sales/SalesReturnTodayModal").then((m) => ({ default: m.ReturnPreviewModal })),
);
const BranchTransferTodayModal = lazy(() => import("../../components/operations/BranchTransferTodayModal"));
const AdvancedSearchModal = lazy(() => import("../../components/pos/AdvancedSearchModal"));
const ShiftOpenModal = lazy(() => import("../../pages/pos/ShiftOpenModal"));
const ShiftCloseModal = lazy(() => import("../../pages/pos/ShiftCloseModal"));

// ── add-customer ──────────────────────────────────────────────────────────
registerModal(
  "add-customer",
  DetachedCustomerForm,
  (props) => ({ initialState: props.initialState, token: props.token }),
  (state, sendAction) => ({
    initialState: state.initialState,
    token: state.token,
    sendAction,
  }),
);

// ── add-supplier ─────────────────────────────────────────────────────────
registerModal(
  "add-supplier",
  DetachedSupplierForm,
  (props) => ({ initialState: props.initialState, token: props.token }),
  (state, sendAction) => ({
    initialState: state.initialState,
    token: state.token,
    sendAction,
  }),
);

// ── supplier-info ───────────────────────────────────────────────────────
registerModal(
  "supplier-info",
  SupplierInfoModal,
  (props) => ({ supplierId: props.supplierId }),
  (state, sendAction) => ({
    open: true,
    supplierId: state.supplierId,
    onClose: () => sendAction("close"),
    onUpdated: (data) => sendAction("updated", data),
  }),
);

// ── customer-info ───────────────────────────────────────────────────────
registerModal(
  "customer-info",
  CustomerInfoModal,
  (props) => ({ customerId: props.customerId }),
  (state, sendAction) => ({
    open: true,
    customerId: state.customerId,
    onClose: () => sendAction("close"),
    onUpdated: (data) => sendAction("updated", data),
  }),
);

// ── default-permissions ─────────────────────────────────────────────────
registerModal(
  "default-permissions",
  DefaultPermissionsModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
  }),
);

// ── expense-form ────────────────────────────────────────────────────────
registerModal(
  "expense-form",
  ExpenseFormModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
    onSuccess: () => sendAction("success"),
  }),
);

// ── revenue-form ────────────────────────────────────────────────────────
registerModal(
  "revenue-form",
  RevenueFormModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
    onSuccess: () => sendAction("success"),
  }),
);

// ── general-purchase-return ─────────────────────────────────────────────
registerModal(
  "general-purchase-return",
  GeneralPurchaseReturnModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
    onSuccess: () => sendAction("success"),
  }),
);

// ── general-return ──────────────────────────────────────────────────────
registerModal(
  "general-return",
  GeneralReturnModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
    onSuccess: () => sendAction("success"),
  }),
);

// ── quick-return ────────────────────────────────────────────────────────
registerModal(
  "quick-return",
  QuickReturnModal,
  (props) => ({ mode: props.mode, initialDocId: props.initialDocId }),
  (state, sendAction) => ({
    open: true,
    mode: state.mode,
    initialDocId: state.initialDocId,
    onClose: () => sendAction("close"),
    onSuccess: () => sendAction("success"),
  }),
);

// ── purchase-profit ─────────────────────────────────────────────────────
registerModal(
  "purchase-profit",
  PurchaseProfitModal,
  (props) => ({ lines: props.lines }),
  (state, sendAction) => ({
    lines: state.lines,
    onClose: () => sendAction("close"),
  }),
);

// ── pos-cash-checkout ────────────────────────────────────────────────────
registerModal(
  "pos-cash-checkout",
  PosCashCheckoutModal,
  (props) => ({ total: props.total }),
  (state, sendAction) => ({
    open: true,
    total: state.total,
    onClose: () => sendAction("close"),
    onConfirm: (data) => sendAction("confirm", data),
  }),
);

// ── dramatic-delete-confirm ─────────────────────────────────────────────
registerModal(
  "dramatic-delete-confirm",
  DramaticDeleteConfirm,
  (props) => ({ itemName: props.itemName }),
  (state, sendAction) => ({
    itemName: state.itemName,
    onCancel: () => sendAction("close"),
    onConfirm: () => sendAction("confirm"),
  }),
);

// ── shortcut-cheatsheet ─────────────────────────────────────────────────
registerModal(
  "shortcut-cheatsheet",
  ShortcutCheatsheetModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
  }),
);

// ── pay-in-pay-out ──────────────────────────────────────────────────────
registerModal(
  "pay-in-pay-out",
  PayInPayOutModal,
  (props) => ({ type: props.type }),
  (state, sendAction) => ({
    open: true,
    type: state.type,
    onClose: () => sendAction("close"),
  }),
);

// ── supervisor-pin ──────────────────────────────────────────────────────
registerModal(
  "supervisor-pin",
  SupervisorPINModal,
  (props) => ({ action: props.action, details: props.details }),
  (state, sendAction) => ({
    open: true,
    action: state.action,
    details: state.details,
    onClose: () => sendAction("close"),
    onSuccess: () => sendAction("success"),
  }),
);

// ── permission-denied ───────────────────────────────────────────────────
registerModal(
  "permission-denied",
  PermissionDeniedModal,
  (props) => ({ page: props.page, action: props.action }),
  (state, sendAction) => ({
    open: true,
    page: state.page,
    action: state.action,
    onClose: () => sendAction("close"),
  }),
);

// ── print-preview ───────────────────────────────────────────────────────
registerModal(
  "print-preview",
  PrintPreviewModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => sendAction("close"),
    onConfirmPrint: () => sendAction("confirmPrint"),
    onSaveOnly: () => sendAction("saveOnly"),
    onExportAllColumns: () => sendAction("exportAllColumns"),
  }),
);

// ── pdf-export ──────────────────────────────────────────────────────────
registerModal(
  "pdf-export",
  PDFExportDialog,
  (props) => ({ columns: props.columns, title: props.title }),
  (state, sendAction) => ({
    open: true,
    columns: state.columns,
    title: state.title,
    onClose: () => sendAction("close"),
    onExport: () => sendAction("export"),
  }),
);

// ── line-config ─────────────────────────────────────────────────────────
registerModal(
  "line-config",
  LineConfigModal,
  (props) => ({ line: props.line, item: props.item }),
  (state, sendAction) => ({
    line: state.line,
    item: state.item,
    onClose: () => sendAction("close"),
    onApply: () => sendAction("apply"),
  }),
);

// ── gallery ─────────────────────────────────────────────────────────────
registerModal(
  "gallery",
  GalleryModal,
  (props) => ({ images: props.images, idx: props.idx }),
  (state, sendAction) => ({
    open: true,
    images: state.images,
    idx: state.idx,
    onClose: () => sendAction("close"),
  }),
);

// ── held-dropdown ───────────────────────────────────────────────────────
registerModal(
  "held-dropdown",
  HeldDropdown,
  (props) => ({ heldInvoices: props.heldInvoices }),
  (state, sendAction) => ({
    heldInvoices: state.heldInvoices,
    onClose: () => sendAction("close"),
    onResume: (id) => sendAction("resume", id),
    onDiscard: (id) => sendAction("discard", id),
  }),
);

// ── post-today ────────────────────────────────────────────────────────────
registerModal(
  "post-today",
  POSTodayModal,
  () => ({}),
  (state, sendAction) => ({
    open: true,
    onClose: () => {
      window.electronAPI?.closeModalWindow?.();
      sendAction("close");
    },
    onNavigate: (path) => sendAction("navigate", path),
    initialFilters: {
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      sort: state.sort,
      dir: state.dir,
      userId: state.userId,
      docSearch: state.docSearch,
      itemSearch: state.itemSearch,
      customerQuery: state.customerQuery,
      customerId: state.customerId,
    },
  }),
);

// ── invoice-preview ────────────────────────────────────────────────────────
registerModal(
  "invoice-preview",
  InvoicePreviewModal,
  (props) => ({ invoiceId: props.inv?.id }),
  (state, sendAction) => ({
    inv: { id: state.invoiceId },
    onClose: () => window.electronAPI?.closeModalWindow?.(),
    onNavigate: (path) => window.electronAPI?.navigateParent?.(path),
  }),
);

// ── confirm-dialog ───────────────────────────────────────────────────────
registerModal(
  "confirm-dialog",
  ConfirmDialog,
  (props) => ({ title: props.title, message: props.message }),
  (state, sendAction) => ({
    open: true,
    title: state.title,
    message: state.message,
    onConfirm: () => sendAction("confirm"),
    onCancel: () => sendAction("cancel"),
  }),
);

// ── delete-impact ────────────────────────────────────────────────────────
registerModal(
  "delete-impact",
  DeleteImpactModal,
  (props) => ({
    itemName: props.itemName,
    impact: props.impact,
    loading: props.loading,
    confirming: props.confirming,
  }),
  (state, sendAction) => ({
    open: true,
    itemName: state.itemName,
    impact: state.impact,
    loading: state.loading,
    confirming: state.confirming,
    onCancel: () => sendAction("cancel"),
    onConfirm: () => sendAction("confirm"),
  }),
);

// ── purchases-today ────────────────────────────────────────────────────────
// Standard filter-modal: defaultDeserialize maps the captured filters to
// initialFilters and wires close/navigate. (Navigation inside the window uses
// window.electronAPI.navigateParent directly.)
registerModal("purchases-today", TodayPurchasesModal);

// ── purchase-preview ───────────────────────────────────────────────────────
// Sub-window opened from a purchases list. Receives the full purchase row.
registerModal(
  "purchase-preview",
  PurchasePreviewModal,
  undefined,
  (state) => ({
    purchase: state.purchase,
    onClose: () => window.electronAPI?.closeModalWindow?.(),
    onNavigate: (path) => window.electronAPI?.navigateParent?.(path),
  }),
);

// ── purchase-picker-today ──────────────────────────────────────────────────
// Picker: a selection is sent back to the (still-mounted, hidden) opener via the
// IPC "selectPurchase" action it registered in useDetach.
registerModal(
  "purchase-picker-today",
  PurchasePickerTodayModal,
  undefined,
  (state, sendAction) => ({
    ...defaultDeserialize(state, sendAction),
    onSelectPurchase: (p) => {
      sendAction("selectPurchase", p);
      window.electronAPI?.closeModalWindow?.();
    },
  }),
);

// ── purchase-return-today ──────────────────────────────────────────────────
registerModal("purchase-return-today", PurchaseReturnTodayModal);

// ── purchase-return-preview ────────────────────────────────────────────────
registerModal(
  "purchase-return-preview",
  PurchaseReturnPreviewModal,
  undefined,
  (state) => ({
    ret: state.ret,
    onClose: () => window.electronAPI?.closeModalWindow?.(),
    onNavigate: (path) => window.electronAPI?.navigateParent?.(path),
  }),
);

// ── invoice-picker-today ───────────────────────────────────────────────────
registerModal(
  "invoice-picker-today",
  InvoicePickerTodayModal,
  undefined,
  (state, sendAction) => ({
    ...defaultDeserialize(state, sendAction),
    onSelectInvoice: (inv) => {
      sendAction("selectInvoice", inv);
      window.electronAPI?.closeModalWindow?.();
    },
  }),
);

// ── sales-return-today ─────────────────────────────────────────────────────
registerModal("sales-return-today", SalesReturnTodayModal);

// ── sales-return-preview ───────────────────────────────────────────────────
registerModal(
  "sales-return-preview",
  SalesReturnPreviewModal,
  undefined,
  (state) => ({
    ret: state.ret,
    onClose: () => window.electronAPI?.closeModalWindow?.(),
    onNavigate: (path) => window.electronAPI?.navigateParent?.(path),
  }),
);

// ── branch-transfer-today ──────────────────────────────────────────────────
registerModal("branch-transfer-today", BranchTransferTodayModal);

// ── advanced-search ────────────────────────────────────────────────────────
registerModal("advanced-search", AdvancedSearchModal);

// ── shift-open ─────────────────────────────────────────────────────────────
// openingCash/userId arrive as flat props via defaultDeserialize; onSuccess is
// relayed to the opener so the POS page reacts to the opened shift.
registerModal(
  "shift-open",
  ShiftOpenModal,
  undefined,
  (state, sendAction) => ({
    ...defaultDeserialize(state, sendAction),
    onSuccess: (data) => {
      sendAction("success", data);
      window.electronAPI?.closeModalWindow?.();
    },
  }),
);

// ── shift-close ────────────────────────────────────────────────────────────
// The shift object is reconstructed from the flat fields captured by getState.
registerModal(
  "shift-close",
  ShiftCloseModal,
  undefined,
  (state, sendAction) => ({
    ...defaultDeserialize(state, sendAction),
    shift: { id: state.shiftId, opening_cash: state.openingCash, current_total: state.currentTotal },
    onSuccess: (data) => {
      sendAction("success", data);
      window.electronAPI?.closeModalWindow?.();
    },
  }),
);

