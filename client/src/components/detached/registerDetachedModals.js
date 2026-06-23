// Central registration file for all modals that support the detach feature.
// Eagerly imported from main.jsx so registrations are available in both the
// main window and child (detached) windows before any modal renders.
import { registerModal, defaultDeserialize } from "./modalRegistry";
import ConfirmDialog from "../ui/ConfirmDialog";
import DeleteImpactModal from "../ui/DeleteImpactModal";
import DetachedCustomerForm from "../modals/DetachedCustomerForm";
import DetachedSupplierForm from "../modals/DetachedSupplierForm";
import SupplierInfoModal from "../modals/SupplierInfoModal";
import CustomerInfoModal from "../modals/CustomerInfoModal";
import DefaultPermissionsModal from "../modals/DefaultPermissionsModal";
import ExpenseFormModal from "../../pages/expenses/ExpenseFormModal";
import RevenueFormModal from "../../pages/expenses/RevenueFormModal";
import GeneralPurchaseReturnModal from "../../components/returns/GeneralPurchaseReturnModal";
import GeneralReturnModal from "../../components/returns/GeneralReturnModal";
import QuickReturnModal from "../../components/returns/QuickReturnModal";
import PurchaseProfitModal from "../../components/purchases/PurchaseProfitModal";
import PosCashCheckoutModal from "../../components/pos/PosCashCheckoutModal";
import { DramaticDeleteConfirm } from "../../components/ui/DramaticDeleteConfirm";
import ShortcutCheatsheetModal from "../../shortcuts/ShortcutCheatsheetModal";
import PayInPayOutModal from "../../pages/pos/PayInPayOutModal";
import SupervisorPINModal from "../../components/auth/SupervisorPINModal";
import PermissionDeniedModal from "../../components/ui/PermissionDeniedModal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PDFExportDialog from "../../components/print/PDFExportDialog";
import LineConfigModal from "../../components/pos/LineConfigModal";
import GalleryModal from "../../pages/pos/parts/GalleryModal";
import HeldDropdown from "../../pages/pos/parts/HeldDropdown";
import POSTodayModal from "../../components/pos/POSTodayModal";
import InvoicePreviewModal from "../../components/pos/InvoicePreviewModal";
import TodayPurchasesModal, { PurchasePreviewModal } from "../../components/purchases/TodayPurchasesModal";
import PurchasePickerTodayModal from "../../components/purchases/PurchasePickerTodayModal";
import PurchaseReturnTodayModal from "../../components/purchases/PurchaseReturnTodayModal";
import InvoicePickerTodayModal from "../../components/sales/InvoicePickerTodayModal";
import SalesReturnTodayModal from "../../components/sales/SalesReturnTodayModal";
import BranchTransferTodayModal from "../../components/operations/BranchTransferTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import ShiftOpenModal from "../../pages/pos/ShiftOpenModal";
import ShiftCloseModal from "../../pages/pos/ShiftCloseModal";

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

