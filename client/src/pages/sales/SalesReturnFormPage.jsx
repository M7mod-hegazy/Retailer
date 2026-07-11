import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Trash2, Plus, Minus, RotateCcw, Clock,
  CheckCircle2, AlertCircle, Lock, Pencil, Printer, X, ExternalLink,
  Package, UserPlus, Calendar, Loader2, ChevronDown, Filter, Settings2,
  AlertTriangle, Send, Save,
} from "lucide-react";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import CategorySearchField from "../../components/ui/CategorySearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import WalkInCustomerInput from "../../components/pos/WalkInCustomerInput";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../services/api";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { sortByProximity } from "../../utils/itemSort";
import { useGridNavigation } from "../../hooks/useGridNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import PermissionGate from "../../components/ui/PermissionGate";
import { useAuthStore } from "../../stores/authStore";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import CustomerInfoModal from "../../components/modals/CustomerInfoModal";
import SalesReturnTodayModal from "../../components/sales/SalesReturnTodayModal";
import InvoicePickerTodayModal from "../../components/sales/InvoicePickerTodayModal";
import { ReturnSaveSuccess } from "../../components/returns/ReturnSaveSuccess";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { usePermission } from "../../hooks/usePermission";
import { formatNumber } from "../../utils/currency";
import useCollapsibleSidebar from "../../hooks/useCollapsibleSidebar";
import PanelEdgeRail from "../pos/parts/PanelEdgeRail";
import SalesReturnFormBottomBar from "./SalesReturnFormBottomBar";
import SmartTooltip from "../../components/ui/SmartTooltip";

function formatMoney(v) {
  return formatNumber(v);
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG-u-nu-latn");
}

// Live indicator of how far the entered return price is from the item's catalog price.
function PriceDelta({ entered, baseline, baseLabel = "سعر البيع", className = "" }) {
  const e = Number(entered) || 0;
  const b = Number(baseline) || 0;
  if (!b || !e) return <span className={`text-[11px] font-mono text-slate-400 ${className}`}>—</span>;
  const diff = e - b;
  const pct = (diff / b) * 100;
  if (Math.abs(diff) < 0.005) return <span className={`text-[11px] font-bold text-slate-400 ${className}`}>مطابق {baseLabel}</span>;
  const up = diff > 0;
  return (
    <span className={`text-[11px] number-fmt ${up ? "text-emerald-600" : "text-rose-600"} ${className}`}>
      {up ? "▲ أعلى بـ" : "▼ أقل بـ"} {formatMoney(Math.abs(diff))} ({up ? "+" : "−"}{Math.abs(pct).toFixed(1)}%)
    </span>
  );
}


const REASONS = [
  { value: "defective", label: "عيب في المنتج" },
  { value: "wrong_order", label: "خطأ في الطلب" },
  { value: "shipping_damage", label: "تلف أثناء الشحن" },
  { value: "not_as_described", label: "لا يطابق الوصف" },
  { value: "other", label: "أخرى" },
];


// ── Original Invoice Preview ──────────────────────────────────────────────────
function statusLabel(s) {
  const map = { paid: "مدفوع", partial: "جزئي", unpaid: "غير مدفوع", cancelled: "ملغي", draft: "مسودة" };
  return map[s] || s || "—";
}
function statusColor(s) {
  if (s === "paid") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "partial") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "cancelled") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}
function paymentTypeLabel(t) {
  const map = { cash: "نقداً", credit: "آجل", multi: "متعدد", bank: "بنك", future_due: "آجل مؤجل" };
  return map[t] || t || "—";
}

function OriginalInvoicePreview({ invoice }) {
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discount || 0);
  const increase = Number(invoice.increase || 0);
  const total = Number(invoice.total || 0);
  const lines = invoice.lines || [];
  return (
    <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white overflow-hidden text-2sm shadow-[0_2px_10px_rgba(251,191,36,0.1)] relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-[0.03] pointer-events-none mix-blend-multiply" />
      {/* Header */}
      <div className="px-3 py-2.5 bg-amber-100/50 border-b border-amber-200/60 flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-white border border-amber-200 shadow-sm shrink-0">
            <Clock className="h-3 w-3 text-amber-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-amber-700/80 leading-tight">الفاتورة الأصلية</span>
            <span className="text-[11px] font-black text-amber-900 font-mono tracking-tight leading-tight">#{invoice.invoice_no || invoice.doc_no}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {invoice.payment_type && (
            <span className="text-[11px] text-amber-700 font-bold bg-white px-1.5 py-0.5 rounded-md border border-amber-200">{paymentTypeLabel(invoice.payment_type)}</span>
          )}
          {invoice.status && (
            <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-black ${statusColor(invoice.status)}`}>{statusLabel(invoice.status)}</span>
          )}
        </div>
      </div>
      {/* Line items — name + sku + qty × price */}
      {lines.length > 0 && (
        <div className="border-b border-amber-200/50 px-3 py-2 flex flex-col gap-1 relative z-10">
          <span className="text-[9px] font-bold text-amber-700/70 uppercase tracking-widest mb-0.5">الأصناف ({lines.length})</span>
          {lines.map((l, i) => {
            const qty = Number(l.quantity || 0);
            const price = Number(l.unit_price || 0);
            const code = l.item_code || l.code || l.barcode;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-700 whitespace-normal break-words leading-tight">{l.item_name_ar || l.item_name || l.name || `#${l.item_id}`}</span>
                  {code && <span className="font-mono text-[8px] text-slate-400 leading-none">{code}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0 font-mono text-slate-500">
                  <span className="font-black text-slate-700">{qty}</span>
                  <span className="text-slate-300">×</span>
                  <span>{formatMoney(price)}</span>
                  <span className="text-slate-300">=</span>
                  <span className="font-black text-slate-700">{formatMoney(l.line_total || qty * price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Financials */}
      <div className="px-4 py-3 flex flex-col gap-2 relative z-10">
        <div className="flex justify-between items-center text-slate-600 text-[11px]">
          <span>المجموع الفرعي</span>
          <span className="font-bold">{formatMoney(subtotal)} <span className="font-sans text-[9px]">ج.م</span></span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center text-rose-600 text-[11px]">
            <span>الخصم</span>
            <span className="font-bold">− {formatMoney(discount)} <span className="font-sans text-[9px]">ج.م</span></span>
          </div>
        )}
        {increase > 0 && (
          <div className="flex justify-between items-center text-emerald-600 text-[11px]">
            <span>الزيادة</span>
            <span className="font-bold">+ {formatMoney(increase)} <span className="font-sans text-[9px]">ج.م</span></span>
          </div>
        )}
        <div className="flex justify-between items-center border-t border-amber-200/50 pt-2 mt-1 text-slate-900 font-black text-sm">
          <span>الإجمالي</span>
          <span>{formatMoney(total)} <span className="text-slate-500 font-sans text-[11px]">ج.م</span></span>
        </div>
      </div>
      {/* Payments */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="border-t border-amber-200/50 px-4 py-3 flex flex-col gap-2 bg-amber-50/50 relative z-10">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">وسائل الدفع</span>
          {invoice.payments.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-300"/>{p.method_name || p.method}</span>
              <span className="font-bold text-slate-900">{formatMoney(p.amount)} <span className="text-slate-500 font-sans text-[9px]">ج.م</span></span>
            </div>
          ))}
        </div>
      )}
      {/* Footer stamp */}
      <div className="border-t border-amber-200/80 px-3 py-2 bg-amber-100 flex items-center justify-center relative z-10">
        <span className="text-[9px] font-black tracking-widest text-amber-700 uppercase flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> للمعاينة فقط · غير قابل للتعديل
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SalesReturnFormPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const editReturnId = location.state?.edit_return_id || null;
  const isEditMode = !!editReturnId;

  const [mode, setMode] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const gridNavRef = useRef(null);
  const { focusLastRowQty } = useGridNavigation(gridNavRef, { qtyCol: "unit_price" });
  useShortcut("grid.editLast", () => focusLastRowQty());
  useShortcut("form.save", () => { if (total) setShowSaveConfirmModal(true); });

  const [cart, setCart] = useState([]);

  const [invoiceLines, setInvoiceLines] = useState([]);
  const [loadedInvoice, setLoadedInvoice] = useState(null);

  const [customer, setCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerLockedFromInvoice, setCustomerLockedFromInvoice] = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(null);
  const [ajalDebt, setAjalDebt] = useState(0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  // Walk-in customer (lightweight name/phone) — mutually exclusive with a real customer.
  const [waPhone, setWaPhone] = useState("");
  const [waName, setWaName] = useState("");
  const [walkInSet, setWalkInSet] = useState(false);

  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [reason, setReason] = useState("other");
  const [reasonOther, setReasonOther] = useState("");

  // Header-level خصم/زيادة on the return document (mirrors invoice discount/increase).
  // For from-invoice returns these are pro-rated from the original invoice until the user edits them.
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [headerIncrease, setHeaderIncrease] = useState(0);
  const [adjustmentTouched, setAdjustmentTouched] = useState(false);
  const [supervisorOverride, setSupervisorOverride] = useState(false);

  const [editActivation, setEditActivation] = useState(null);
  const [rawEditData, setRawEditData] = useState(null);

  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);
  const [stagingItem, setStagingItem] = useState(null);
  const [stagingQty, setStagingQty] = useState("1");
  const [stagingPrice, setStagingPrice] = useState("");
  const [stagingPurchasePrice, setStagingPurchasePrice] = useState("");
  const [stagingWarehouseId, setStagingWarehouseId] = useState("");
  const [stagingUnitId, setStagingUnitId] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listCategoryFilter, setListCategoryFilter] = useState(null);
  const [listCategoryQuery, setListCategoryQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});

  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  const [pendingBelowCostAdd, setPendingBelowCostAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [lastSavedReturn, setLastSavedReturn] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showEditWarnModal, setShowEditWarnModal] = useState(false);
  const [showSwitchInvoiceWarning, setShowSwitchInvoiceWarning] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todayReturnsOpen, setTodayReturnsOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [waSendOpen, setWaSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(null); // standalone returns only; null = follow settings (default ON)
  const [taxRate, setTaxRate] = useState(null);       // null = settings rate; number = privileged override

  const ALL_COLUMNS_DIRECT = [
    { id: "code", label: "الكود" },
    { id: "item", label: "الصنف" },
    { id: "warehouse", label: "المستودع" },
    { id: "unit", label: "الوحدة" },
    { id: "selling_price", label: "سعر البيع" },
    { id: "purchase_price", label: "سعر الشراء" },
    { id: "return_price", label: "سعر المرتجع" },
    { id: "quantity", label: "الكمية" },
    { id: "total", label: "الإجمالي" },
    { id: "actions", label: "" },
  ];
  const allDirectIds = ALL_COLUMNS_DIRECT.map(c => c.id);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { const s = localStorage.getItem("retailer.salesReturn.visibleColumns"); return s ? JSON.parse(s) : allDirectIds; } catch { return allDirectIds; }
  });
  useEffect(() => { localStorage.setItem("retailer.salesReturn.visibleColumns", JSON.stringify(visibleColumns)); }, [visibleColumns]);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    function h(e) { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Collapsible sidebar
  const sidebar = useCollapsibleSidebar({
    storageKeyPrefix: "retailer.sales_return",
    defaultWidth: 340,
    minWidth: 300,
  });
  const { panelWidth, panelEffectiveCollapsed, togglePanel, startPanelResize } = sidebar;

  const itemInputRef = useRef(null);
  const stagingWHRef = useRef(null);
  const stagingUnitRef = useRef(null);
  const stagingQtyRef = useRef(null);
  const stagingPriceRef = useRef(null);
  const addBtnRef = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);
  const searchAbortRef    = useRef(null);
  const currentQueryRef   = useRef("");

  // isDirty must be after all state declarations to avoid TDZ on `customer`
  const isDirty = isEditMode ? !isLocked : (cart.length > 0 || !!customer);

  const customerResults = useMemo(() => {
    if (!customerLookupOpen) return [];
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customers.filter(c => String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").includes(q))
      : customers.slice(0, 8);
    return list.slice(0, 8).map(c => ({
      ...c,
      sub_label: c.phone || "",
      price_label: "",
    }));
  }, [customerLookupOpen, customerQuery, customers]);
  const { blocker } = useUnsavedChangesGuard(isDirty);

  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("sales_return", editActivation);

  const subtotal = useMemo(() => {
    if (mode === "direct") return cart.reduce((acc, l) => acc + l.unit_price * l.quantity, 0);
    if (mode === "invoice") return invoiceLines.filter(l => l.checked).reduce((acc, l) => acc + l.unit_price * l.qty_to_return, 0);
    return 0;
  }, [mode, cart, invoiceLines]);

  // Net refundable = lines subtotal − خصم + زيادة (mirrors invoice total). Everything
  // downstream (refund, balance, treasury, payload) derives from this `total`.
  const total = useMemo(
    () => Math.max(0, subtotal - (Number(headerDiscount) || 0) + (Number(headerIncrease) || 0)),
    [subtotal, headerDiscount, headerIncrease],
  );

  const maxDiscountPercent = useAppSettingsStore(s => Number(s.settings?.max_discount_percent ?? 15));
  const discountCapEnabled = useAppSettingsStore(s => Number(s.settings?.discount_cap_enabled ?? 1) !== 0);
  const discountExceedsCap = discountCapEnabled && (Number(headerDiscount) || 0) > subtotal * (maxDiscountPercent / 100);

  const appSettings = useAppSettingsStore(s => s.settings);
  const canEditTaxRate = usePermission("pos", "edit_tax_rate");
  const taxFeatureOn = Number(appSettings?.tax_enabled ?? 0) === 1
    && (appSettings?.tax_type === "inclusive" || appSettings?.tax_type === "exclusive");

  // Mirrors server math (display only — server is authoritative):
  // linked returns inherit the parent invoice's snapshot; standalone returns follow settings.
  const taxInfo = useMemo(() => {
    const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
    const none = { applied: false, rate: 0, type: null, amount: 0, finalTotal: total, inherited: mode === "invoice" };
    const fromSnapshot = (src, inherited) => {
      const rate = Number(src.tax_rate || 0);
      const type = src.tax_type;
      if (type === "exclusive") {
        const amount = r2(total * rate / 100);
        return { applied: true, rate, type, amount, finalTotal: r2(total + amount), inherited };
      }
      if (type === "inclusive") {
        return { applied: true, rate, type, amount: r2(total * rate / (100 + rate)), finalTotal: total, inherited };
      }
      return none;
    };
    if (mode === "invoice") {
      const src = (loadedInvoice && Number(loadedInvoice.tax_enabled)) ? loadedInvoice
        : (isEditMode && rawEditData && Number(rawEditData.tax_enabled)) ? rawEditData : null;
      return src ? fromSnapshot(src, true) : none;
    }
    // standalone: explicit toggle wins; edit mode keeps the saved snapshot type/rate as base
    const enabled = taxEnabled == null
      ? (isEditMode && rawEditData ? Number(rawEditData.tax_enabled) === 1 : taxFeatureOn)
      : Boolean(Number(taxEnabled));
    if (!enabled) return none;
    const snapType = (isEditMode && rawEditData?.tax_type) ? rawEditData.tax_type : appSettings?.tax_type;
    const rate = taxRate != null ? Number(taxRate)
      : (isEditMode && rawEditData?.tax_rate != null ? Number(rawEditData.tax_rate) : Number(appSettings?.tax_rate || 0));
    return fromSnapshot({ tax_rate: rate, tax_type: snapType }, false);
  }, [mode, loadedInvoice, isEditMode, rawEditData, total, taxFeatureOn, taxEnabled, taxRate, appSettings]);

  // What actually leaves the treasury / lands on the customer balance.
  const refundTotal = taxInfo.finalTotal;

  const returnCreditEffect = useMemo(() => {
    if (!refundTotal) return 0;
    if (refundMethod === "store_credit") return refundTotal;
    if (refundMethod === "split") return Math.max(0, refundTotal - (Number(splitCashAmount) || 0));
    return 0;
  }, [refundMethod, refundTotal, splitCashAmount]);

  // In edit mode, the DB balance already has the ORIGINAL return's credit effect applied.
  // We compute the NET change so we never double-count.
  const originalCreditEffect = useMemo(() => {
    if (!isEditMode || !rawEditData) return 0;
    const origTotal = Number(rawEditData.total || 0);
    const origMethod = rawEditData.refund_method || "cash_back";
    if (origMethod === "store_credit") return origTotal;
    if (origMethod === "split") return Math.max(0, origTotal - Number(rawEditData.cash_amount || 0));
    return 0;
  }, [isEditMode, rawEditData]);

  // NET credit adjustment = what changes in the balance after saving this edit.
  // In create mode: netCreditAdjustment = returnCreditEffect (originalCreditEffect is 0)
  // In edit mode:   netCreditAdjustment = new - old (0 if same, positive if more credit, negative if less)
  const netCreditAdjustment = returnCreditEffect - originalCreditEffect;

  // Predicted balance = current DB balance minus the net change
  const predictedBalance = customerBalance !== null ? customerBalance - netCreditAdjustment : null;

  const hasCustomerBalance = customerBalance !== null && customerBalance > 0;

  useEffect(() => {
    api.get("/api/warehouses").then(r => {
      const wh = r.data.data || [];
      setWarehouses(wh);
      if (wh.length) setStagingWarehouseId(String(wh[0].id));
    }).catch(() => {});
    api.get("/api/units").then(r => {
      const u = r.data.data || [];
      setUnits(u);
      if (u.length) setStagingUnitId(String(u[0].id));
    }).catch(() => {});
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
    api.get("/api/stock/levels").then(r => {
      const grouped = {};
      (r.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = {};
        grouped[row.item_id][row.warehouse_id] = row.quantity;
      });
      setStockLevels(grouped);
    }).catch(() => {});
  }, []);

  // Effect 1: fetch edit data — sets non-cart fields only
  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
      const sr = r.data.data;
      setRawEditData(sr);
      setEditActivation({ docNo: sr.doc_no || "", createdAt: sr.created_at || new Date().toISOString() });
      setRefundMethod(sr.refund_method || "cash_back");
      if (sr.refund_method === "split") setSplitCashAmount(String(sr.cash_amount || ""));
      setReason(sr.reason || "other");
      setReturnNotes(sr.notes || "");
      if (sr.tax_enabled !== undefined && sr.tax_enabled !== null) setTaxEnabled(Number(sr.tax_enabled) ? 1 : 0);
      if (sr.tax_rate != null && Number(sr.tax_enabled)) setTaxRate(Number(sr.tax_rate));
      setHeaderDiscount(Number(sr.discount || 0));
      setHeaderIncrease(Number(sr.increase || 0));
      setAdjustmentTouched(true); // saved values — do not auto-recompute over the user's data
      if (sr.customer_id) { const name = sr.customer_name || String(sr.customer_id); setCustomer({ id: sr.customer_id, name }); setCustomerQuery(name); }
      else if (sr.walk_in_phone) { setWaPhone(sr.walk_in_phone); setWaName(sr.walk_in_name || ""); setWalkInSet(true); }
      setMode(sr.invoice_id ? "invoice" : "direct");
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  // Pro-rate the original invoice's خصم/زيادة onto the return by returned-value fraction,
  // recomputing as the returned quantities change — until the user manually edits the field.
  useEffect(() => {
    if (mode !== "invoice" || !loadedInvoice || adjustmentTouched) return;
    const invSub = Number(loadedInvoice.subtotal || 0);
    const invDisc = Number(loadedInvoice.discount || 0);
    const invInc = Number(loadedInvoice.increase || 0);
    if (invSub <= 0 || (invDisc === 0 && invInc === 0)) { setHeaderDiscount(0); setHeaderIncrease(0); return; }
    const ratio = Math.min(1, subtotal / invSub);
    setHeaderDiscount(Math.round(invDisc * ratio * 100) / 100);
    setHeaderIncrease(Math.round(invInc * ratio * 100) / 100);
  }, [mode, loadedInvoice, subtotal, adjustmentTouched]);

  // Effect 2: resolve warehouse/unit names once reference lists are loaded
  useEffect(() => {
    if (!rawEditData || !warehouses.length || !units.length) return;
    const sr = rawEditData;

    if (sr.invoice_id) {
      api.get(`/api/invoices/${sr.invoice_id}`).then(inv => {
        const invData = inv.data.data;
        setLoadedInvoice(invData);
        const returnedIds = new Set((sr.lines || []).map(l => l.invoice_line_id));
        setInvoiceLines((invData.lines || []).map(l => {
          const returnLine = (sr.lines || []).find(rl => rl.invoice_line_id === l.id);
          const alreadyReturned = Number(l.returned_quantity || 0);
          return {
            invoice_line_id: l.id,
            item_id: l.item_id,
            item_code: l.item_code || l.barcode || "",
            item_name: l.item_name_ar || l.item_name || l.name,
            unit_price: Number(l.unit_price || 0),
            purchase_price: Number(l.purchase_price || 0),
            original_qty: Number(l.quantity),
            already_returned: alreadyReturned,
            qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
            checked: !!returnLine,
            primary_image_url: l.primary_image_url || null,
          };
        }).filter(l => l.original_qty - l.already_returned > 0 || returnedIds.has(l.invoice_line_id)));
      }).catch(() => {});
    } else {
      setCart((sr.lines || []).map((l, idx) => ({
        key: `edit-${l.id || idx}`,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name || l.name,
        item_code: l.item_code || "",
        unit_price: Number(l.unit_price || 0),
        purchase_price: Number(l.purchase_price || 0),
        primary_image_url: l.primary_image_url || null,
        quantity: Number(l.quantity),
        warehouse_id: l.warehouse_id || "",
        warehouse_name: warehouses.find(w => String(w.id) === String(l.warehouse_id))?.name || "—",
        original_warehouse_id: l.warehouse_id || "",
        unit_id: String(l.unit_id || ""),
        unit_name: units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية",
      })));
    }
  }, [rawEditData, warehouses, units]);

  useEffect(() => {
    if (!customer?.id) { setCustomerBalance(null); setAjalDebt(0); return; }
    api.get(`/api/customers/${customer.id}`).then(r => setCustomerBalance(Number(r.data.data?.opening_balance || 0))).catch(() => {});
    api.get(`/api/ajal-debts?customer_id=${customer.id}&status=pending`).then(r => {
      setAjalDebt((r.data.data || []).reduce((s, d) => s + Number(d.remaining_amount || 0), 0));
    }).catch(() => {});
  }, [customer?.id]);

  const ITEM_PAGE = 20;
  useEffect(() => {
    const q = itemQuery.trim();
    pendingPickRef.current = false;
    if (!q || stagingItem) {
      setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false);
      itemSearchActiveRef.current = false;
      searchAbortRef.current?.abort();
      return;
    }
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    currentQueryRef.current = q;
    itemSearchActiveRef.current = true;
    const t = setTimeout(() => {
      const capturedQ = q;
      const params = { search: q, limit: ITEM_PAGE, offset: 0 };
      if (listCategoryFilter?.id) params.category_id = listCategoryFilter.id;
      api.get("/api/items", { params, signal: controller.signal })
        .then(r => {
          if (currentQueryRef.current !== capturedQ) return;
          const rows = r.data.data || [];
          setItemResults(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
          setLookupOpen(true);
          setActiveIndex(-1);
          if (pendingPickRef.current && rows.length > 0) {
            pendingPickRef.current = false;
            selectItemForStaging(rows[0]);
          } else {
            pendingPickRef.current = false;
          }
        })
        .catch((err) => {
          if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") pendingPickRef.current = false;
        })
        .finally(() => { itemSearchActiveRef.current = false; });
    }, 250);
    return () => { clearTimeout(t); controller.abort(); itemSearchActiveRef.current = false; };
  }, [itemQuery, stagingItem, listCategoryFilter]);

  useEffect(() => {
    if (itemQuery) setAllItemsMode(false);
  }, [itemQuery]);

  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  function loadMoreItems() {
    if (!itemHasMore || isLoadingMoreItems) return;
    const q = itemQuery.trim();
    if (!q && !allItemsMode) return;
    setIsLoadingMoreItems(true);
    const searchParam = allItemsMode ? "" : q;
    const params = { search: searchParam, limit: ITEM_PAGE, offset: itemOffset };
    if (listCategoryFilter?.id) params.category_id = listCategoryFilter.id;
    api.get("/api/items", { params })
      .then(r => {
        const rows = r.data.data || [];
        setItemResults(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMoreItems(false));
  }

  function showAllItems() {
    const SHOW_ALL_LIMIT = 200;
    const fmt = (item) => ({ ...item, name: item.name_ar || item.name, price_label: `${formatMoney(item.sale_price || 0)} ج.م` });
    const anchor = stagingItem;
    setAllItemsMode(true);
    setItemResults([]);
    setItemOffset(0);
    setItemHasMore(true);
    setIsLoadingMoreItems(true);

    if (listCategoryFilter?.id) {
      api.get("/api/items", { params: { category_id: listCategoryFilter.id, limit: SHOW_ALL_LIMIT, offset: 0 } })
        .then(r => {
          const rows = (r.data.data || []).map(fmt);
          setItemResults(sortByProximity(rows, anchor));
          setItemOffset(rows.length);
          setItemHasMore(Boolean(r.data?.meta?.has_more ?? rows.length === SHOW_ALL_LIMIT));
        }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
      return;
    }

    const allCall = api.get("/api/items", { params: { limit: SHOW_ALL_LIMIT, offset: 0 } });
    const catCall = anchor?.category_id
      ? api.get("/api/items", { params: { category_id: anchor.category_id, limit: 200 } })
      : Promise.resolve({ data: { data: [] } });
    Promise.all([catCall, allCall])
      .then(([catRes, allRes]) => {
        const catRows  = (catRes.data.data || []).map(fmt);
        const allRows  = (allRes.data.data || []).map(fmt);
        const pinnedId = anchor?.id ?? null;
        const sortedCat = sortByProximity(catRows, anchor).filter(r => r.id !== pinnedId);
        const catIds = new Set(catRows.map(r => r.id));
        if (pinnedId) catIds.add(pinnedId);
        const others = allRows.filter(r => !catIds.has(r.id))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        const merged = [...(pinnedId ? [fmt({ ...anchor })] : []), ...sortedCat, ...others];
        setItemResults(merged);
        setItemOffset(allRows.length);
        setItemHasMore(Boolean(allRes.data?.meta?.has_more ?? allRows.length === SHOW_ALL_LIMIT));
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  useEffect(() => {
    if (!customer) setRefundMethod(prev => prev === "store_credit" ? "cash_back" : prev);
  }, [customer]);

  function handleFieldKeyDown(e, nextRef, prevRef, isEnterSubmit = false) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isEnterSubmit) addStagingToCart();
      else nextRef?.current?.focus();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      prevRef?.current?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextRef?.current?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  }

  function selectItemForStaging(item) {
    setStagingItem(item);
    setStagingPrice(String(item.sale_price || "0"));
    setStagingPurchasePrice(String(item.purchase_price || item.unit_cost || "0"));
    setStagingQty("1");
    if (item.unit_id) {
      setStagingUnitId(String(item.unit_id));
    } else if (units.length > 0) {
      setStagingUnitId(String(units[0].id));
    } else {
      setStagingUnitId("");
    }
    const code = item.code || item.item_code;
    const displayName = item.name_ar || item.name;
    setItemQuery(code ? `[${code}] ${displayName}` : displayName);
    setItemResults([]);
    setLookupOpen(false);
    setActiveIndex(-1);
    const cat = categories.find(c => c.id === item.category_id) || categories.find(c => c.name === item.category_name) || null;
    const skuPrefix = cat?.sku_prefix ?? item?.sku_prefix ?? null;
    setListCategoryFilter(cat ? { id: cat.id, name: cat.name, sku_prefix: skuPrefix } : null);
    setListCategoryQuery("");
    setTimeout(() => { stagingQtyRef.current?.focus(); stagingQtyRef.current?.select?.(); }, 30);
  }

  function addStagingToCart() {
    if (!stagingItem) return;
    const qty = Math.max(0, Number(stagingQty) || 0);
    const price = Math.max(0, Number(stagingPrice) || 0);
    if (!qty) return;
    const purchasePrice = Number(stagingPurchasePrice || 0);
    if (purchasePrice > 0 && price > 0 && price < purchasePrice) {
      if (!pendingBelowCostAdd) {
        setPendingBelowCostAdd(true);
        setMessage({ text: `تحذير: السعر (${formatMoney(price)}) أقل من سعر الشراء (${formatMoney(purchasePrice)}). اضغط إضافة مرة أخرى للتأكيد.`, type: "warning" });
        setTimeout(() => { setMessage({ text: "", type: "" }); setPendingBelowCostAdd(false); }, 4000);
        return;
      }
      setPendingBelowCostAdd(false);
    } else {
      setPendingBelowCostAdd(false);
    }
    if (!invoiceIsActive) activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(stagingUnitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const finalQty = allowDecimal ? qty : Math.max(1, Math.round(qty));
    setCart(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === stagingItem.id && String(l.warehouse_id) === String(stagingWarehouseId) && l.key?.startsWith("direct-"));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + finalQty : Math.round(l.quantity) + finalQty,
          unit_price: price || l.unit_price,
        });
      }
      return [...prev, {
        key: `direct-${stagingItem.id}-${Date.now()}`,
        item_id: stagingItem.id,
        item_name: stagingItem.name_ar || stagingItem.name,
        item_code: stagingItem.code || stagingItem.item_code || "",
        unit_price: price,
        purchase_price: purchasePrice,
        sale_price: Number(stagingItem.sale_price || 0),
        primary_image_url: stagingItem.primary_image_url || null,
        quantity: finalQty,
        warehouse_id: stagingWarehouseId,
        warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
        original_warehouse_id: stagingWarehouseId,
        unit_id: stagingUnitId,
        unit_name: selectedUnit?.name || "أساسية",
      }];
    });
    setStagingItem(null); setStagingQty("1"); setStagingPrice(""); setStagingPurchasePrice("");
    setListCategoryFilter(null); setListCategoryQuery("");
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); setActiveIndex(-1);
    setTimeout(() => itemInputRef.current?.focus(), 30);
  }

  function removeCartLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }
  function updateCartQty(key, delta) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, l.quantity + delta) }).filter(l => l.quantity > 0));
  }
  function updateCartPrice(key, val) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, unit_price: Math.max(0, Number(val) || 0) }));
  }
  function updateCartWarehouse(key, warehouseId) {
    setCart(prev => prev.map(l => l.key !== key ? l : {
      ...l,
      warehouse_id: warehouseId,
      warehouse_name: warehouses.find(w => String(w.id) === String(warehouseId))?.name || "",
    }));
  }

  function selectMode(m) {
    if (m === "invoice") { setMode(m); setInvoicePickerOpen(true); }
    else { setMode(m); activateInvoice(); }
  }

  function resetToIdle() {
    setMode(null); setCart([]); setInvoiceLines([]); setLoadedInvoice(null);
    setCustomer(null); setCustomerLockedFromInvoice(false); setReason("other"); setReasonOther("");
    setWaPhone(""); setWaName(""); setWalkInSet(false);
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setStagingItem(null); setStagingQty("1");
    setStagingPrice(""); setStagingPurchasePrice(""); setListCategoryFilter(null); setListCategoryQuery(""); setInvoicePickerOpen(false); resetActivation();
    setHeaderDiscount(0); setHeaderIncrease(0); setAdjustmentTouched(false); setSupervisorOverride(false);
  }

  function handleBack() {
    if (mode === null || isEditMode) { navigate("/sales/returns"); return; }
    setShowWarningModal(true);
  }

  function loadInvoice(inv) {
    setLoadedInvoice(inv);
    setInvoiceLines((inv.lines || []).map(l => ({
      invoice_line_id: l.id,
      item_id: l.item_id,
      item_code: l.item_code || l.barcode || "",
      item_name: l.item_name_ar || l.item_name || l.name,
      unit_price: Number(l.unit_price || 0),
      purchase_price: Number(l.purchase_price || 0),
      original_qty: Number(l.quantity),
      already_returned: Number(l.returned_quantity || 0),
      qty_to_return: 0,
      checked: false,
      primary_image_url: l.primary_image_url || null,
    })).filter(l => l.original_qty - l.already_returned > 0));
    if (inv.customer_id) {
      const name = inv.customer_name || String(inv.customer_id);
      setCustomer({ id: inv.customer_id, name });
      setCustomerQuery(name);
      setCustomerLockedFromInvoice(true);
    } else if (inv.walk_in_phone) {
      // Inherit the source invoice's walk-in contact onto the return.
      setWaPhone(inv.walk_in_phone);
      setWaName(inv.walk_in_name || "");
      setWalkInSet(true);
    }
  }

  function handleDetailConfirm(inv) {
    loadInvoice(inv); setInvoicePickerOpen(false); activateInvoice();
  }

  function toggleInvoiceLine(invoice_line_id) {
    setInvoiceLines(prev => prev.map(l => {
      if (l.invoice_line_id !== invoice_line_id) return l;
      const checked = !l.checked;
      return { ...l, checked, qty_to_return: checked ? Math.max(0, l.original_qty - l.already_returned) : 0 };
    }));
  }

  function setInvoiceLineQty(invoice_line_id, val) {
    setInvoiceLines(prev => prev.map(l => {
      if (l.invoice_line_id !== invoice_line_id) return l;
      const max = l.original_qty - l.already_returned;
      return { ...l, qty_to_return: Math.max(0, Math.min(max, Number(val) || 0)) };
    }));
  }

  function handleTodayInvoicesClick() {
    if (mode === "invoice" && loadedInvoice) setShowSwitchInvoiceWarning(true);
    else setInvoicePickerOpen(true);
  }

  async function handleSave(opts = {}) {
    const lines = mode === "direct"
      ? cart.map(l => ({ item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price, warehouse_id: l.warehouse_id || null, unit_id: l.unit_id || null, invoice_line_id: null }))
      : invoiceLines.filter(l => l.checked && l.qty_to_return > 0).map(l => ({ invoice_line_id: l.invoice_line_id, item_id: l.item_id, quantity: l.qty_to_return, unit_price: l.unit_price }));
    if (!lines.length) { setMessage({ text: "أضف أصناف للمرتجع أولاً", type: "error" }); return; }
    if (discountExceedsCap && !supervisorOverride) {
      setMessage({ text: `الخصم يتجاوز ${maxDiscountPercent}% — فعّل موافقة المشرف للمتابعة`, type: "error" });
      return;
    }
    const payload = {
      doc_no: docNo || undefined, customer_id: customer?.id || null,
      walk_in_name: !customer?.id && walkInSet && waPhone.trim() ? (waName.trim() || null) : null,
      walk_in_phone: !customer?.id && walkInSet && waPhone.trim() ? waPhone.trim() : null,
      refund_method: refundMethod, treasury_id: null,
      cash_amount: refundMethod === "split" ? Math.max(0, Number(splitCashAmount) || 0) : undefined,
      reason: reason === "other" ? (reasonOther || "other") : reason, lines,
      discount: Number(headerDiscount) || 0,
      increase: Number(headerIncrease) || 0,
      supervisor_override: supervisorOverride,
      notes: returnNotes || null,
      // tax: linked returns inherit server-side from the parent — send nothing;
      // standalone returns send the toggle (and rate only when overridden)
      ...(mode === "direct" && taxFeatureOn ? {
        tax_enabled: taxEnabled == null ? 1 : (Number(taxEnabled) ? 1 : 0),
        ...(taxRate != null ? { tax_rate: Number(taxRate) } : {}),
      } : {}),
    };
    // Snapshot return data before states are cleared after save
    const returnSnap = {
      invoice_no: docNo,
      created_at: invoiceCreatedAt || new Date().toISOString(),
      customer_name: customer?.name,
      customer_id: customer?.id,
      customer_phone: customer?.phone,
      walk_in_name: !customer?.id && walkInSet ? (waName || null) : null,
      walk_in_phone: !customer?.id && walkInSet ? (waPhone || null) : null,
      cashier_name: user?.name || "",
      discount: Number(headerDiscount) || 0,
      increase: Number(headerIncrease) || 0,
      total: refundTotal || total || 0,
      subtotal: subtotal || 0,
      notes: returnNotes || "",
      payment_type: loadedInvoice?.payment_type || refundMethod,
      lines: (mode === "direct" ? cart : invoiceLines.filter(l => l.checked)).map(l => ({
        ...l,
        item_name: l.item_name,
        quantity: mode === "direct" ? l.quantity : l.qty_to_return,
        unit_price: l.unit_price,
        discount_amount: 0,
      })),
    };
    setLastSavedReturn(returnSnap);
    setIsSaving(true); setMessage({ text: "", type: "" });
    try {
      const savedDocNo = docNo;
      const successData = {
        docNo: savedDocNo,
        total: refundTotal,
        discount: Number(headerDiscount) || 0,
        increase: Number(headerIncrease) || 0,
        refundMethod,
        cashAmount: refundMethod === 'split' ? Math.max(0, Number(splitCashAmount) || 0) : null,
        creditAmount: returnCreditEffect,
        entityName: customer?.name,
        entityNewBalance: predictedBalance,
        type: 'sales_return',
      };
      if (isEditMode) {
        await api.put(`/api/invoices/returns/${editReturnId}`, payload);
        setIsLocked(true);
        if (!opts.printAfter && !opts.whatsappAfter) setSaveSuccess(successData);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      } else if (mode === "invoice" && loadedInvoice) {
        const res = await api.post(`/api/invoices/${loadedInvoice.id}/return`, payload);
        if (!opts.printAfter && !opts.whatsappAfter) setSaveSuccess({ ...successData, returnId: res.data.data?.id });
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
        setCart([]); setCustomer(null);
      } else {
        const res = await api.post("/api/invoices/general-return", payload);
        if (!opts.printAfter && !opts.whatsappAfter) setSaveSuccess({ ...successData, returnId: res.data.data?.id });
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
        setCart([]); setCustomer(null);
      }
      if (opts.printAfter) setPrintPreview(true);
      else if (opts.whatsappAfter) setWaSendOpen(true);
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  function handleSuccessDismiss() {
    const id = saveSuccess?.returnId;
    setSaveSuccess(null);
    if (!isEditMode) navigate("/sales/returns", { replace: true });
  }

  async function handleDelete() {
    if (!editReturnId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/invoices/returns/${editReturnId}`);
      navigate("/sales/returns", { replace: true });
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل حذف المرتجع", type: "error" });
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  }

  // ══ IDLE SCREEN ══
  if (mode === null && !isEditMode) {
    return (
      <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden relative">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

        <div className="flex items-center px-6 pt-5 pb-2 relative z-10">
          <button onClick={() => navigate("/sales/returns")}
            className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white border border-slate-200/60 shadow-sm text-slate-500 hover:bg-primary-600 hover:text-white hover:border-slate-900 transition-all active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-12 px-4 relative z-10 pb-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-100 text-emerald-700 shadow-xl shadow-emerald-600/10">
              <RotateCcw className="h-10 w-10" />
            </div>
            <h1 className="text-[32px] font-black text-slate-900 tracking-tight">إنشاء مرتجع مبيعات</h1>
            <p className="text-[15px] font-bold text-slate-500 max-w-[40ch] leading-relaxed">
              قم بتحديد الطريقة المناسبة لاستلام المرتجعات من العملاء لضمان تحديث المخزون بدقة.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
            <button onClick={() => selectMode("direct")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-white border border-slate-200/60 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-2xl hover:border-emerald-300 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="bg-slate-50 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-110 transition-all duration-500 mb-8 border border-slate-100">
                <RotateCcw className="h-8 w-8 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-slate-900 mb-2">مرتجع مباشر (حر)</span>
                <span className="text-sm font-bold text-slate-500 leading-relaxed">إضافة الأصناف يدوياً وتحديد الكميات والأسعار بدون الارتباط بفاتورة مبيعات مسبقة.</span>
              </div>
            </button>

            <button data-help="invoice-select" onClick={() => selectMode("invoice")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-emerald-600 border-b-4 border-emerald-800 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 hover:shadow-emerald-600/40 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
              <div className="bg-white/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-all duration-500 mb-8 backdrop-blur-sm">
                <Search className="h-8 w-8 text-white" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-white mb-2">من فاتورة سابقة</span>
                <span className="text-sm font-bold text-emerald-100 leading-relaxed">البحث برقم الفاتورة وتحديد الكميات المرتجعة منها بدقة لضمان التسعير والخصومات الصحيحة.</span>
              </div>
            </button>
          </div>
          {message.text && (
            <div className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {message.text}
            </div>
          )}
        </div>
        <InvoicePickerTodayModal open={invoicePickerOpen} onClose={() => { setInvoicePickerOpen(false); setMode(null); }} onSelectInvoice={handleDetailConfirm} customers={customers} />
        <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); }} />
      </div>
    );
  }

  // ══ ACTIVE SCREEN ══
  return (
    <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden animate-fade-in relative">
      <DocumentHeaderBar data-help="sr-form-header"
        accent="emerald"
        className="shadow-sm"
        onBack={handleBack}
        title={isEditMode ? "تعديل مرتجع مبيعات" : mode === "invoice" && loadedInvoice ? `مرتجع فاتورة #${loadedInvoice.invoice_no || loadedInvoice.doc_no}` : "مرتجع مبيعات جديد"}
        subtitle={isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : mode === "direct" ? "مرتجع مباشر" : "مرتجع من فاتورة"}
        extras={
          <>
            {isLocked && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <Lock className="h-3 w-3" /> محفوظة
              </div>
            )}
            {discountExceedsCap && !isLocked && (
              <div className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-black transition-all shadow-sm ${
                supervisorOverride
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
              }`}>
                {supervisorOverride ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span>
                  {supervisorOverride
                    ? "تم تفعيل موافقة المشرف على الخصم"
                    : `الخصم يتجاوز ${maxDiscountPercent}% — يتطلب موافقة المشرف`}
                </span>
              </div>
            )}
            {mode && (
              <div className="flex gap-1.5">
                <input readOnly value={invoiceIsActive ? (docNo || "") : "—"} className="h-7 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
                <input readOnly value={invoiceIsActive && invoiceCreatedAt ? new Date(invoiceCreatedAt).toLocaleString("en-US") : "—"} className="h-7 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
              </div>
            )}
            {mode === "invoice" && loadedInvoice && (
              <Link to={`/sales/returns?invoice_id=${loadedInvoice.id}`} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline shrink-0">
                <ExternalLink className="h-3.5 w-3.5" /> عرض كل مرتجعات هذه الفاتورة
              </Link>
            )}
          </>
        }
        actions={
          <>
            {message.text && (
              <div className={`flex items-center gap-1.5 rounded-sm px-3 py-1 text-2sm font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {message.text}
              </div>
            )}
            <DocumentActionButton variant="today" icon={Calendar} onClick={() => setTodayReturnsOpen(true)}>
              سجل المرتجعات
            </DocumentActionButton>
            <PermissionGate page="sales_returns" action="print">
              <DocumentActionButton variant="print" icon={Printer} onClick={() => setPrintPreview(true)} disabled={!total}>
                طباعة
              </DocumentActionButton>
            </PermissionGate>
            {isEditMode && isLocked && (
              <PermissionGate page="sales_returns" action="edit">
                <DocumentActionButton variant="edit" icon={Pencil} onClick={() => setShowEditWarnModal(true)}>
                  تعديل
                </DocumentActionButton>
              </PermissionGate>
            )}
            {isEditMode && !isLocked && (
              <PermissionGate page="sales_returns" action="delete">
                <DocumentActionButton variant="delete" icon={Trash2} onClick={() => setShowDeleteModal(true)}>
                  حذف
                </DocumentActionButton>
              </PermissionGate>
            )}
            {!isEditMode && (
              <DocumentActionButton variant="today" icon={RotateCcw} onClick={() => setShowWarningModal(true)}>
                مرتجع جديد
              </DocumentActionButton>
            )}
            {mode && !isLocked && (
              <PermissionGate page="sales_returns" action={isEditMode ? "edit" : "add"}>
                <SmartTooltip content={discountExceedsCap && !supervisorOverride ? `الخصم يتجاوز الحد المسموح به (${maxDiscountPercent}%) — يتطلب موافقة المشرف للمتابعة` : ""}>
                  <div className="inline-block">
                    <DocumentActionButton
                      variant="primary"
                      identity="emerald"
                      onClick={() => setShowSaveConfirmModal(true)}
                      disabled={isSaving || !total || (discountExceedsCap && !supervisorOverride)}
                      loading={isSaving}
                      data-help="sr-form-submit"
                    >
                      {isSaving ? "جاري الحفظ..." : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                    </DocumentActionButton>
                  </div>
                </SmartTooltip>
              </PermissionGate>
            )}
          </>
        }
      />

      <div className="flex flex-1 min-h-0" style={{ paddingBottom: panelEffectiveCollapsed ? "var(--bottom-bar-h, 90px)" : undefined }}>
        <aside className={`shrink-0 flex flex-col border-l border-slate-200 bg-white overflow-y-auto ${panelEffectiveCollapsed ? "hidden" : ""}`} style={{ width: panelWidth, minWidth: panelWidth }}>
          <div className="flex flex-col gap-5 p-5">
            <button onClick={handleTodayInvoicesClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-600 transition-all shadow-sm active:scale-[0.98]">
              <Clock className="h-4 w-4" /> فواتير المبيعات
            </button>

            {/* Customer */}
            <div className="flex flex-col gap-1.5" data-help="sr-form-customer">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">العميل</label>
                {!isLocked && !customerLockedFromInvoice && (
                  <button onClick={() => setCustomerCreateOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
                    <UserPlus className="h-3 w-3" /> عميل جديد
                  </button>
                )}
              </div>
              {!walkInSet && (
              <div className="relative">
                <input
                  type="text"
                  value={customerQuery}
                  placeholder={customer?.id ? customer.name : "ابحث عن عميل..."}
                  onChange={e => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); if (!e.target.value) setCustomer(null); }}
                  onFocus={() => { if (!customer?.id) setCustomerQuery(""); setCustomerLookupOpen(true); }}
                  onBlur={() => { setTimeout(() => { setCustomerLookupOpen(false); if (!customer?.id) setCustomerQuery(""); }, 200); }}
                  disabled={isLocked || customerLockedFromInvoice}
                  className={`w-full h-10 rounded-xl border px-3 text-sm font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400 ${hasCustomerBalance ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100" : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"}`}
                />
                {customerLookupOpen && !isLocked && !customerLockedFromInvoice && (
                  <SearchDropdown
                    items={customerResults}
                    onPick={c => { setCustomer({ id: c.id, name: c.name }); setCustomerQuery(c.name); setCustomerLookupOpen(false); }}
                    query={customerQuery}
                    emptyLabel="لم يتم العثور على عميل"
                  />
                )}
              </div>
              )}
              {/* Walk-in customer create UI (direct returns, or from-invoice when the invoice had no customer) */}
              {!customer?.id && !isLocked && !customerLockedFromInvoice && (
                <WalkInCustomerInput
                  phone={waPhone} name={waName}
                  onPhoneChange={setWaPhone} onNameChange={setWaName}
                  committed={walkInSet}
                  onCommit={() => setWalkInSet(true)}
                  onEdit={() => setWalkInSet(false)}
                  onRemove={() => { setWaPhone(""); setWaName(""); setWalkInSet(false); }}
                />
              )}
              {customerLockedFromInvoice && !isLocked && <p className="text-[11px] text-slate-400 font-medium">العميل محدد من الفاتورة الأصلية</p>}
              {customer?.id && (
                <button onClick={() => setCustomerInfoOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:text-blue-700 transition-colors">
                  <ExternalLink className="h-3 w-3" /> بيانات العميل
                </button>
              )}
              {customer?.id && customerBalance !== null && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${customerBalance > 0 ? "text-amber-700 bg-amber-100/50 border-amber-200" : "text-slate-600 bg-slate-100/50 border-slate-200"}`}>
                    الرصيد: {formatMoney(customerBalance)}
                  </div>
                  {netCreditAdjustment !== 0 && total > 0 && (
                    <>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${netCreditAdjustment > 0 ? "text-emerald-700 bg-emerald-100/50 border-emerald-200" : "text-rose-700 bg-rose-100/50 border-rose-200"}`}>
                        {netCreditAdjustment > 0 ? `خصم: −${formatMoney(netCreditAdjustment)}` : `إضافة: +${formatMoney(Math.abs(netCreditAdjustment))}`}
                      </div>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${predictedBalance > 0 ? "text-rose-700 bg-rose-100/50 border-rose-200" : "text-emerald-700 bg-emerald-100/50 border-emerald-200"}`}>
                        بعد المرتجع: {formatMoney(predictedBalance)}
                      </div>
                    </>
                  )}
                  {netCreditAdjustment === 0 && returnCreditEffect > 0 && total > 0 && (
                    <div className="text-[11px] font-black text-slate-500 bg-slate-100/50 border border-slate-200 px-2 py-1 rounded-sm">
                      لا تغيير في الرصيد
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer balance */}
            {customer && customerBalance !== null && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-slate-200" />
                <div className="flex justify-between items-center text-2sm">
                  <span className="font-bold text-slate-500">الرصيد الحالي</span>
                  <span className={`number-fmt-primary ${customerBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(customerBalance)} ج.م</span>
                </div>
                {total > 0 && netCreditAdjustment !== 0 && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600">
                        {netCreditAdjustment > 0 ? "الخصم من الرصيد" : "إضافة للرصيد"}
                      </span>
                      <span className={`text-sm number-fmt-primary ${netCreditAdjustment > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {netCreditAdjustment > 0 ? "−" : "+"}{formatMoney(Math.abs(netCreditAdjustment))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200/60 pt-1.5">
                      <span className="text-[11px] font-bold text-slate-600">الرصيد بعد الحفظ</span>
                      <span className={`text-sm number-fmt-primary ${predictedBalance > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {formatMoney(predictedBalance)}
                      </span>
                    </div>
                  </div>
                )}
                {total > 0 && netCreditAdjustment === 0 && returnCreditEffect > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-500 text-center">
                    لا تغيير في الرصيد — نفس التأثير كما كان مسجلاً
                  </div>
                )}
                {ajalDebt > 0 && (
                  <div className="flex justify-between items-center text-[11px] pt-2 mt-1 border-t border-slate-100 border-dashed">
                    <span className="font-bold text-amber-600">ديون آجل معلقة</span>
                    <span className="number-fmt-primary text-amber-700">{formatMoney(ajalDebt)} ج.م</span>
                  </div>
                )}
                <Link to={`/definitions/customers/${customer.id}`} className="flex items-center justify-center gap-1 mt-2 py-1.5 rounded-lg bg-slate-50 text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">
                  <ExternalLink className="h-3 w-3" /> عرض سجل العميل الكامل
                </Link>
              </div>
            )}

            <div className="w-full h-px bg-slate-100" />

            {/* Original-invoice خصم/زيادة preview (read-only) + this return's pro-rated share */}
            {mode === "invoice" && loadedInvoice && (Number(loadedInvoice.discount) > 0 || Number(loadedInvoice.increase) > 0) && (() => {
              const invSub = Number(loadedInvoice.subtotal || 0);
              const pct = invSub > 0 ? Math.min(100, (subtotal / invSub) * 100) : 0;
              return (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> تعديلات الفاتورة الأصلية #{loadedInvoice.invoice_no || loadedInvoice.doc_no}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] font-bold text-slate-500">خصم الفاتورة الكامل</label>
                      <input readOnly value={formatMoney(loadedInvoice.discount || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center text-2sm number-fmt-primary text-rose-600 cursor-not-allowed" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] font-bold text-slate-500">زيادة الفاتورة الكاملة</label>
                      <input readOnly value={formatMoney(loadedInvoice.increase || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center text-2sm number-fmt-primary text-emerald-600 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/70 border border-amber-200/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 leading-relaxed">
                    {subtotal > 0 ? (
                      <>هذا المرتجع = <span className="font-black text-amber-700">{pct.toFixed(1)}%</span> من الفاتورة، فيُطبَّق نصيبه:
                        {Number(headerDiscount) > 0 && <span className="text-rose-600 font-black"> خصم −{formatMoney(headerDiscount)}</span>}
                        {Number(headerIncrease) > 0 && <span className="text-emerald-600 font-black"> زيادة +{formatMoney(headerIncrease)}</span>}
                        {Number(headerDiscount) === 0 && Number(headerIncrease) === 0 && <span> لا شيء</span>}
                        {adjustmentTouched && <span className="text-slate-400"> (معدّل يدوياً)</span>}
                      </>
                    ) : (
                      <>اختر أصنافاً للإرجاع ليُحتسب نصيب هذا المرتجع من خصم/زيادة الفاتورة.</>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Return total breakdown — subtotal − خصم + زيادة = صافي */}
            {subtotal > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-2sm font-bold text-slate-600">إجمالي الأصناف</span>
                  <span className="text-sm font-black text-slate-700 number-fmt">{formatMoney(subtotal)} ج.م</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-2sm font-bold text-rose-600 shrink-0">خصم على المرتجع</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="any" value={headerDiscount || ""}
                      disabled={isLocked}
                      onChange={e => { setAdjustmentTouched(true); setHeaderDiscount(Math.max(0, Number(e.target.value) || 0)); }}
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      className={`w-24 rounded-lg border px-2 py-1 text-center text-sm number-fmt-primary outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${discountExceedsCap ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-200" : "border-rose-200 bg-white text-rose-700 focus:border-rose-400 focus:ring-rose-100"}`}
                    />
                    <span className="text-[11px] text-slate-400 shrink-0">ج.م</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-2sm font-bold text-emerald-700 shrink-0">زيادة على المرتجع</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="any" value={headerIncrease || ""}
                      disabled={isLocked}
                      onChange={e => { setAdjustmentTouched(true); setHeaderIncrease(Math.max(0, Number(e.target.value) || 0)); }}
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      className="w-24 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-center text-sm number-fmt-primary text-emerald-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    />
                    <span className="text-[11px] text-slate-400 shrink-0">ج.م</span>
                  </div>
                </div>
                {mode === "invoice" && (headerDiscount > 0 || headerIncrease > 0) && (
                  <div className="text-[11px] font-bold text-slate-400 -mt-1">
                    {adjustmentTouched ? "معدّل يدوياً" : "محسوب تلقائياً من الفاتورة الأصلية"}
                  </div>
                )}
                 {discountExceedsCap && !isLocked && (
                   <label className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-xs font-black cursor-pointer transition-all duration-300 ${
                     supervisorOverride
                       ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                       : "bg-rose-50 border-2 border-rose-500 text-rose-700 animate-pulse shadow-md shadow-rose-500/10"
                   }`}>
                     <input
                       type="checkbox"
                       checked={supervisorOverride}
                       onChange={e => setSupervisorOverride(e.target.checked)}
                       className={`w-4 h-4 rounded transition-all ${
                         supervisorOverride ? "accent-emerald-600" : "accent-rose-600 ring-2 ring-rose-500/30"
                       }`}
                     />
                     <AlertTriangle className={`h-4 w-4 shrink-0 ${supervisorOverride ? "text-emerald-500" : "text-rose-500"}`} />
                     <span>الخصم يتجاوز {maxDiscountPercent}% — موافقة المشرف</span>
                   </label>
                 )}
                {/* Tax: linked returns inherit the parent invoice snapshot (read-only); standalone returns get a toggle */}
                {taxInfo.inherited && taxInfo.applied && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                      ضريبة موروثة من الفاتورة ({taxInfo.rate}%{taxInfo.type === "inclusive" ? " شاملة" : ""})
                    </span>
                    <span className="text-sm number-fmt-primary text-indigo-700">{taxInfo.type === "exclusive" ? "+ " : ""}{formatMoney(taxInfo.amount)} ج.م</span>
                  </div>
                )}
                {mode === "direct" && taxFeatureOn && (
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-2sm font-bold text-indigo-600 shrink-0">
                      <input
                        type="checkbox"
                        className="accent-indigo-600"
                        disabled={isLocked}
                        checked={taxEnabled == null ? taxInfo.applied : Boolean(Number(taxEnabled))}
                        onChange={e => setTaxEnabled(e.target.checked ? 1 : 0)}
                      />
                      الضريبة{appSettings?.tax_type === "inclusive" ? " (شاملة)" : ""}
                    </label>
                    <div className="flex items-center gap-1">
                      {canEditTaxRate ? (
                        <input
                          type="number" min="0" max="100" step="0.01"
                          disabled={isLocked}
                          value={taxRate != null ? taxRate : (isEditMode && rawEditData?.tax_rate != null ? Number(rawEditData.tax_rate) : Number(appSettings?.tax_rate || 0))}
                          onChange={e => setTaxRate(e.target.value === "" ? null : Number(e.target.value))}
                          className="w-16 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-center text-sm number-fmt-primary text-indigo-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 disabled:opacity-60"
                        />
                      ) : (
                        <span className="text-2sm font-black text-indigo-500">{taxInfo.rate}%</span>
                      )}
                      <span className="text-sm number-fmt-primary text-indigo-700">{taxInfo.applied ? `${taxInfo.type === "exclusive" ? "+ " : ""}${formatMoney(taxInfo.amount)}` : "—"} ج.م</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-emerald-200/60 pt-2 mt-0.5">
                  <span className="text-2sm font-black text-emerald-700">صافي المرتجع</span>
                  <span className="text-[16px] font-black text-emerald-800">{formatMoney(refundTotal)} ج.م</span>
                </div>
              </div>
            )}

            {/* Refund method */}
            <div className="flex flex-col gap-1.5" data-help="sr-form-refund">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">طريقة الاسترداد</label>
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60 shadow-inner">
                {[
                  { value: "cash_back", label: "نقداً", desc: "استرداد كامل نقداً من الصندوق", requiresCustomer: false },
                  { value: "store_credit", label: "رصيد حساب", desc: "يُضاف للرصيد ويُخصم من دينه", requiresCustomer: true },
                  { value: "split", label: "مختلط", desc: "جزء نقداً والباقي يُضاف للرصيد", requiresCustomer: true },
                ].map(opt => {
                  const disabled = isLocked || (opt.requiresCustomer && !customer);
                  const active = refundMethod === opt.value;
                  const noCustomerBlocked = opt.requiresCustomer && !customer;
                  return (
                    <button key={opt.value} onClick={() => !disabled && setRefundMethod(opt.value)} disabled={disabled}
                      title={noCustomerBlocked ? "يجب اختيار عميل أولاً لاستخدام هذه الطريقة" : ""}
                      className={`flex-1 rounded-lg py-2 px-1 text-center transition-all disabled:cursor-not-allowed ${active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/50" : noCustomerBlocked ? "bg-red-50 text-red-500 border border-dashed border-red-200" : "text-slate-500 hover:text-slate-700 disabled:opacity-40"}`}>
                      <div className="text-2sm font-bold">{opt.label}</div>
                      <div className="text-[9px] font-medium leading-tight mt-0.5 hidden sm:block">
                        {noCustomerBlocked ? (
                          <span className="flex items-center justify-center gap-1 text-red-400"><AlertCircle className="h-2.5 w-2.5" />اختر عميلاً أولاً</span>
                        ) : opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
              {refundMethod === "split" && refundTotal > 0 && (
                <div className="flex flex-col gap-1 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <label className="text-[11px] font-bold text-indigo-600">المبلغ النقدي</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max={refundTotal} step="0.01"
                      value={splitCashAmount}
                      onChange={e => setSplitCashAmount(e.target.value)}
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="0.00"
                    />
                    <span className="text-[11px] text-slate-500 shrink-0">ج.م</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>رصيد حساب</span>
                    <span className="font-bold text-indigo-600">{formatMoney(Math.max(0, refundTotal - (Number(splitCashAmount) || 0)))} ج.م</span>
                  </div>
                </div>
              )}
            </div>

            {/* Reason — collapsible */}
            <div className="flex flex-col" data-help="sr-form-reason">
              <button onClick={() => setReasonOpen(o => !o)}
                className="flex w-full items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest">
                <span>سبب الاسترداد {reason !== "other" ? <span className="text-emerald-600 normal-case tracking-normal text-[11px] ml-1">({REASONS.find(r => r.value === reason)?.label})</span> : reasonOther ? <span className="text-emerald-600 normal-case tracking-normal text-[11px] ml-1">({reasonOther})</span> : ""}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
              </button>
              {reasonOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="relative">
                    <select value={reason} onChange={e => setReason(e.target.value)} disabled={isLocked}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm appearance-none">
                      {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {reason === "other" && !isLocked && (
                    <input value={reasonOther} onChange={e => setReasonOther(e.target.value)} placeholder="اذكر السبب بتفصيل..."
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-2sm font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 shadow-sm transition-all" />
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">ملاحظات</label>
              {isLocked ? (
                <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{returnNotes || "—"}</p>
              ) : (
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="ملاحظة اختيارية على المرتجع…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all"
                />
              )}
            </div>

            {/* Action buttons — mirrors header */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="w-full h-px bg-slate-100" />
              <div className="flex gap-2">
                <button onClick={() => setTodayReturnsOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 transition-all">
                  <Calendar className="h-4 w-4" /> سجل المرتجعات
                </button>
                <PermissionGate page="sales_returns" action="print">
                  <button onClick={() => setPrintPreview(true)} disabled={!total}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <Printer className="h-4 w-4" /> طباعة
                  </button>
                </PermissionGate>
              </div>
              {mode && !isLocked && (
                <PermissionGate page="sales_returns" action={isEditMode ? "edit" : "add"}>
                  <button onClick={() => setShowSaveConfirmModal(true)} disabled={isSaving || !total}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                    {!isSaving && <ShortcutKbd id="form.save" className="ms-1 rounded bg-white/20 px-1 text-[9px] font-mono text-white" />}
                  </button>
                </PermissionGate>
              )}
              <div className="flex gap-2">
                {isEditMode && isLocked && (
                  <PermissionGate page="sales_returns" action="edit">
                    <button onClick={() => setShowEditWarnModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-2sm font-black text-white hover:bg-indigo-700 transition-all">
                      <Pencil className="h-4 w-4" /> تعديل
                    </button>
                  </PermissionGate>
                )}
                {isEditMode && !isLocked && (
                  <PermissionGate page="sales_returns" action="delete">
                    <button onClick={() => setMessage({ text: "حذف المرتجع غير متاح حالياً", type: "error" })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-2sm font-black text-rose-600 hover:bg-rose-100 transition-all">
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                  </PermissionGate>
                )}
                {!isEditMode && (
                  <button onClick={() => setShowWarningModal(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 transition-all">
                    <RotateCcw className="h-4 w-4" /> مرتجع جديد
                  </button>
                )}
              </div>
            </div>

            {/* Invoice selected count */}
            {mode === "invoice" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-2sm font-bold text-slate-500 flex items-center gap-2 mt-2">
                <Package className="w-4 h-4 opacity-50" />
                {invoiceLines.filter(l => l.checked).length > 0 ? (
                  <span className="text-emerald-700">تم اختيار <span className="font-black">{invoiceLines.filter(l => l.checked).length}</span> أصناف للاسترداد</span>
                ) : (
                  "لم يتم تحديد أي أصناف للإرجاع"
                )}
              </div>
            )}

            {/* Original invoice preview — collapsible */}
            {mode === "invoice" && loadedInvoice && (
              <div className="mt-2 flex flex-col">
                <button onClick={() => setPreviewOpen(o => !o)}
                  className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> الفاتورة الأصلية · #{loadedInvoice.invoice_no || loadedInvoice.doc_no}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${previewOpen ? "rotate-180" : ""}`} />
                </button>
                {previewOpen && (
                  <div className="mt-3 animate-slide-up origin-top">
                    <OriginalInvoicePreview invoice={loadedInvoice} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-emerald-200 bg-emerald-700 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-emerald-300">سيتم استرداد</span>
                <span className="text-[11px] text-emerald-400">المبلغ المُعاد للعميل</span>
              </div>
              <span className="text-[20px] font-black text-white">{formatMoney(refundTotal)} ج.م</span>
            </div>
          </div>
        </aside>
        <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel} onResizeStart={(e) => startPanelResize(e, "right")} panelSide="right" />
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50 p-4 min-w-0">

          {mode === "direct" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              {!isLocked && (
                <div className="rounded-2xl border p-3 shadow-sm shrink-0" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
                  <div className="entry-bar">
                    <EntryItemThumb item={stagingItem} />
                    {/* Item search */}
                    <div className="entry-field entry-field--item">
                      <label className="entry-label">الصنف</label>
                      <CategorySearchField
                        categories={categories}
                        value={listCategoryFilter}
                        query={listCategoryQuery}
                        onQueryChange={setListCategoryQuery}
                        onChange={(cat) => {
                          setListCategoryFilter(cat);
                          setListCategoryQuery("");
                          setStagingItem(null);
                          setItemQuery("");
                        }}
                        onPickDone={(catId) => {
                          setTimeout(() => {
                            itemInputRef.current?.focus();
                            showAllItems();
                          }, 50);
                        }}
                      />
                      <ProductSearchField
                        ref={itemInputRef}
                              onNavigateNext={() => { stagingQtyRef.current?.focus(); stagingQtyRef.current?.select?.(); }}
                        query={itemQuery}
                        onQueryChange={(val) => { setItemQuery(val); if (stagingItem) { setStagingItem(null); setStagingPrice(""); setStagingPurchasePrice(""); } }}
                        results={itemResults.map(item => ({ ...item, name: item.name_ar || item.name, price_label: `${formatMoney(item.sale_price || 0)} ج.م` }))}
                        onPick={selectItemForStaging}
                        onEnterNoResults={() => { if (itemSearchActiveRef.current) pendingPickRef.current = true; }}
                        onClear={() => { setStagingItem(null); setStagingPrice(""); setStagingPurchasePrice(""); setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setTimeout(() => itemInputRef.current?.focus(), 30); }}
                        selectedItem={stagingItem}
                        showChip={false}
                        placeholder="ابحث عن صنف بالاسم أو الكود..."
                        onLoadMore={loadMoreItems}
                        hasMore={itemHasMore}
                        isLoadingMore={isLoadingMoreItems}
                        onShowAll={showAllItems}
                        hideZeroStock={false}
                        trailing={(
                          <button onClick={() => setAdvancedSearchOpen(true)}
                            className="entry-control flex w-[38px] shrink-0 items-center justify-center !p-0"
                            style={{ color: "var(--text-secondary)" }}
                            title="بحث متقدم">
                            <Filter className="h-4 w-4" />
                          </button>
                        )}
                      />
                    </div>

                    {/* Qty input */}
                    <div className="entry-field entry-field--qty">
                      <label className="entry-label">الكمية</label>
                      <input ref={stagingQtyRef} type="number" data-help="sr-form-qty"
                        min={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "0.001"}
                        step={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "any"}
                        value={stagingQty}
                        onChange={e => {
                          const u = units.find(u => String(u.id) === String(stagingUnitId));
                          setStagingQty(u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value);
                        }}
                        onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, stagingPriceRef, itemInputRef)}
                        className="entry-control text-center" />
                    </div>

                    {/* Return price input */}
                    <div className="entry-field entry-field--price">
                      <label className="entry-label">سعر المرتجع</label>
                      <input ref={stagingPriceRef} type="number" step="any" value={stagingPrice} onChange={e => setStagingPrice(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, stagingWHRef, stagingQtyRef)}
                        title={stagingItem ? `بيع ${Number(stagingItem.sale_price || 0).toFixed(2)} · شراء ${Number(stagingPurchasePrice || 0).toFixed(2)}` : undefined}
                        className={`entry-control text-center ${stagingItem && Number(stagingPurchasePrice) > 0 && Number(stagingPrice) > 0 && Number(stagingPrice) < Number(stagingPurchasePrice) ? "entry-control--error" : ""}`} />
                      {stagingItem && (
                        <div className="flex items-center justify-center gap-2 overflow-hidden">
                          <span className="text-[9px] font-mono shrink-0 truncate" style={{ color: "var(--text-muted)" }}>بيع {Number(stagingItem.sale_price || 0).toFixed(2)} · شراء {Number(stagingPurchasePrice || 0).toFixed(2)}</span>
                          <PriceDelta entered={stagingPrice} baseline={stagingItem.sale_price} className="shrink-0" />
                        </div>
                      )}
                    </div>

                    {/* Unit — read-only preview */}
                    <div className="entry-field entry-field--unit">
                      <label className="entry-label">الوحدة</label>
                      <div className="entry-control entry-control--readonly">
                        <span className="truncate">{stagingItem ? (units.find(u => String(u.id) === String(stagingUnitId))?.name || "أساسية") : "—"}</span>
                      </div>
                    </div>

                    {/* Warehouse — always-visible stock table (also the destination picker) */}
                    <div className="entry-field entry-field--wh">
                      <label className="entry-label">المستودع / المخزون</label>
                      <WarehouseSelect
                        ref={stagingWHRef}
                        value={stagingWarehouseId}
                        onChange={(id) => setStagingWarehouseId(id)}
                        emptyLabel="لا يوجد مخازن"
                        onKeyDown={e => handleFieldKeyDown(e, addBtnRef, stagingPriceRef)}
                        options={warehouses.map(w => {
                          const qty = stagingItem && stockLevels[stagingItem.id] ? (stockLevels[stagingItem.id][w.id] || 0) : 0;
                          const tone = qty <= 0 ? "out" : qty < 5 ? "low" : "normal";
                          return { id: w.id, name: w.name, qty, tone };
                        })}
                      />
                    </div>

                    {/* Add button */}
                    <button ref={addBtnRef} onClick={addStagingToCart} disabled={!stagingItem}
                      onKeyDown={e => handleFieldKeyDown(e, itemInputRef, stagingWHRef, true)}
                      className="entry-add-btn">
                      <Plus className="h-4 w-4" /> إضافة
                    </button>
                    <div ref={colSettingsRef} className="relative">
                      <button onClick={() => setColSettingsOpen(o => !o)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all active:scale-90"
                        title="إعدادات الأعمدة">
                        <Settings2 className="h-4 w-4" />
                      </button>
                      {colSettingsOpen && (
                        <div className="absolute left-0 top-full mt-1 z-[70] w-48 rounded-lg border border-slate-200 bg-white shadow-xl p-2">
                          {ALL_COLUMNS_DIRECT.filter(c => c.id !== "actions").map(c => (
                            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded cursor-pointer">
                              <input type="checkbox" checked={visibleColumns.includes(c.id)}
                                onChange={() => setVisibleColumns(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                                className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600" />
                              {c.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {cart.length > 0 ? (
                <div className="flex flex-1 flex-col gap-2 min-h-0" data-help="sr-form-items">
                  <div className="flex items-center gap-1 px-1 py-1.5 shrink-0">
                    <span className="text-2sm font-bold text-slate-500">الأصناف ({cart.length})</span>
                    <ShortcutKbd id="grid.editLast" />
                  </div>
                  <div className="rounded-2xl border p-2 shadow-sm flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
                  <div ref={gridNavRef} className="flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-right">
                    <thead className="border-b-2 border-slate-300 bg-slate-50 sticky top-0">
                      <tr className="[&>*+*]:border-r [&>*+*]:border-slate-200">
                        {visibleColumns.includes("code") && <th className="px-3 py-2.5 text-[11px] font-bold text-slate-400 text-center w-14">الكود</th>}
                        {visibleColumns.includes("item") && <th className="px-4 py-2.5 text-2sm font-bold text-slate-700">الصنف</th>}
                        {visibleColumns.includes("warehouse") && <th className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-center">المستودع</th>}
                        {visibleColumns.includes("unit") && <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 text-center">الوحدة</th>}
                        {visibleColumns.includes("selling_price") && <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-[11px] font-bold text-slate-400">سعر البيع</span>
                            <span className="text-[9px] font-medium text-slate-300 leading-none">للمعاينة فقط</span>
                          </div>
                        </th>}
                        {visibleColumns.includes("purchase_price") && <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-[11px] font-bold text-slate-400">سعر الشراء</span>
                            <span className="text-[9px] font-medium text-slate-300 leading-none">للمعاينة فقط</span>
                          </div>
                        </th>}
                        {visibleColumns.includes("return_price") && <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-2sm font-black text-emerald-700">سعر المرتجع</span>
                            <span className="text-[9px] font-medium text-slate-400 leading-none">قابل للتعديل</span>
                          </div>
                        </th>}
                        {visibleColumns.includes("quantity") && <th className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-center">الكمية</th>}
                        {visibleColumns.includes("total") && <th className="px-3 py-2.5 text-2sm font-black text-slate-700 text-center">الإجمالي</th>}
                        {!isLocked && visibleColumns.includes("actions") && <th className="px-3 py-2.5 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l, idx) => (
                        <tr key={l.key} className="border-b border-slate-100 hover:bg-slate-50/80 animate-slide-up [&>*+*]:border-r [&>*+*]:border-slate-100" style={{ animationDelay: `${idx * 50}ms` }}>
                          {visibleColumns.includes("code") && <td className="px-3 py-3 text-center text-[11px] font-mono text-slate-400">{l.item_code || "—"}</td>}
                          {visibleColumns.includes("item") && <td className="px-4 py-3 text-sm font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              {l.primary_image_url && (
                                <img src={resolveImageUrl(l.primary_image_url)} alt="" className="w-6 h-6 shrink-0 object-cover rounded-[4px] border border-slate-200" />
                              )}
                              {l.item_name}
                            </div>
                          </td>}
                          {visibleColumns.includes("warehouse") && (function(){
                            const whEl = !isLocked ? (
                              <div className="flex flex-col items-center gap-1">
                                <select value={l.warehouse_id} data-grid-cell data-row={idx} data-col="warehouse_id" onChange={e => updateCartWarehouse(l.key, e.target.value)} className="h-7 w-full rounded border border-slate-200 bg-slate-50 px-1.5 text-2sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-100 transition-colors cursor-pointer">
                                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {(() => {
                                  const wh = stockLevels[l.item_id] || {};
                                  const current = wh[Number(l.warehouse_id)] ?? wh[l.warehouse_id];
                                  if (current === undefined) return null;
                                  const after = current + l.quantity;
                                  return (
                                    <div className="flex items-center gap-1 text-[11px] number-fmt-primary">
                                      <span className="text-slate-400">{current}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className="text-emerald-600">{after}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-2sm font-bold text-slate-600">{l.warehouse_name}</span>
                            );
                            return <td className="px-2 py-2 text-center">{whEl}</td>;
                          })()}
                          {visibleColumns.includes("unit") && <td className="px-3 py-3 text-center text-2sm font-bold text-slate-500">{l.unit_name}</td>}
                          {visibleColumns.includes("selling_price") && <td className="px-3 py-2.5 text-center">
                            <div
                              className="inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-3 py-1 text-sm number-fmt text-slate-400 cursor-not-allowed select-none min-w-[80px]"
                              title="سعر البيع — للمعاينة فقط"
                            >
                              {l.sale_price > 0 ? formatMoney(l.sale_price) : "—"}
                            </div>
                          </td>}
                          {visibleColumns.includes("purchase_price") && <td className="px-3 py-2.5 text-center">
                            <div
                              className="inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-3 py-1 text-sm number-fmt text-slate-400 cursor-not-allowed select-none min-w-[80px]"
                              title="سعر الشراء — للمعاينة فقط"
                            >
                              {l.purchase_price > 0 ? formatMoney(l.purchase_price) : "—"}
                            </div>
                          </td>}
                          {visibleColumns.includes("return_price") && <td className="px-3 py-2.5 text-center">
                            {!isLocked ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <input type="number" step="any" min="0" value={l.unit_price}
                                  data-grid-cell data-row={idx} data-col="unit_price"
                                  onChange={e => updateCartPrice(l.key, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  className={`w-24 rounded border px-2 py-1 text-center text-sm number-fmt-primary outline-none focus:ring-1 transition-colors
                                    ${l.purchase_price > 0 && Number(l.unit_price) > 0 && Number(l.unit_price) < l.purchase_price
                                      ? "border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100"
                                      : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white focus:ring-emerald-200"}`} />
                                <PriceDelta entered={l.unit_price} baseline={l.sale_price} />
                              </div>
                            ) : (
                              <span className="text-sm font-black text-slate-700 number-fmt">{formatMoney(l.unit_price)}</span>
                            )}
                          </td>}
                          {visibleColumns.includes("quantity") && <td className="px-3 py-3 text-center">
                            {!isLocked ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => updateCartQty(l.key, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Minus className="h-3 w-3" /></button>
                                <span className="w-8 text-center text-sm font-black text-slate-800">{l.quantity}</span>
                                <button onClick={() => updateCartQty(l.key, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Plus className="h-3 w-3" /></button>
                              </div>
                            ) : <span className="text-sm font-black text-slate-700">{l.quantity}</span>}
                          </td>}
                          {visibleColumns.includes("total") && <td className="px-3 py-3 text-center text-sm font-black text-emerald-700 number-fmt">{formatMoney(l.unit_price * l.quantity)}</td>}
                          {!isLocked && visibleColumns.includes("actions") && <td className="px-3 py-3 text-center"><button onClick={() => removeCartLine(l.key)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white text-slate-400">
                  <RotateCcw className="h-10 w-10 opacity-30" />
                  <div className="text-sm font-bold">ابحث عن صنف وأضفه للمرتجع</div>
                </div>
              )}
            </div>
          )}

          {mode === "invoice" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-1 flex-col gap-4 overflow-hidden min-w-0">
                {!loadedInvoice ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
                    <Search className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-black">لم يتم اختيار فاتورة بعد</p>
                    <button onClick={() => setInvoicePickerOpen(true)} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800 transition-colors">
                      <Search className="h-4 w-4" /> اختيار فاتورة مبيعات
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shrink-0">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-black text-emerald-800">فاتورة #{loadedInvoice.invoice_no || loadedInvoice.doc_no}</span>
                        {loadedInvoice.customer_name && <span className="text-slate-600">العميل: <strong>{loadedInvoice.customer_name}</strong></span>}
                        <span className="text-slate-500">{formatDate(loadedInvoice.created_at)}</span>
                        <span className="font-bold text-emerald-700">الإجمالي: {formatMoney(loadedInvoice.total)} ج.م</span>
                      </div>
                      {!isLocked && (
                        <button onClick={() => setInvoicePickerOpen(true)} className="flex items-center gap-1.5 text-2sm font-bold text-rose-600 hover:text-rose-800">
                          <X className="h-3.5 w-3.5" /> تغيير الفاتورة
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm" data-help="sr-form-items">
                      <table className="w-full text-right">
                        <thead className="border-b border-slate-200 bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-3 w-8"></th>
                            <th className="px-2 py-3 text-[11px] font-bold text-slate-400 text-center w-20">الكود</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500">الصنف</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">السعر</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية الأصلية</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">إجمالي الفاتورة</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">المُرتجع سابقاً</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">كمية الإرجاع</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-emerald-600 text-center">إجمالي الإرجاع</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية المتبقية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceLines.map((l, idx) => {
                            const afterReturn = l.original_qty - l.already_returned - (l.checked ? l.qty_to_return : 0);
                            const originalTotal = l.original_qty * l.unit_price;
                            const returnTotal = l.checked ? l.qty_to_return * l.unit_price : 0;
                            return (
                              <tr key={l.invoice_line_id} className={`border-b border-slate-100 transition-colors animate-slide-up ${l.checked ? "bg-emerald-50/50" : "hover:bg-slate-50"}`} style={{ animationDelay: `${idx * 50}ms` }}>
                                <td className="px-3 py-3 text-center">
                                  <input type="checkbox" checked={l.checked} onChange={() => !isLocked && toggleInvoiceLine(l.invoice_line_id)} disabled={isLocked}
                                    className="h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed" />
                                </td>
                                <td className="px-2 py-3 text-center text-[11px] font-mono text-slate-400">{l.item_code || "—"}</td>
                                <td className="px-3 py-3 text-sm font-bold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    {l.primary_image_url && (
                                      <img src={resolveImageUrl(l.primary_image_url)} alt="" className="w-6 h-6 shrink-0 object-cover rounded-[4px] border border-slate-200" />
                                    )}
                                    {l.item_name}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`text-2sm number-fmt ${l.purchase_price > 0 && l.unit_price < l.purchase_price ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                                      {formatMoney(l.unit_price)}
                                    </span>
                                    {l.purchase_price > 0 && l.unit_price < l.purchase_price && (
                                      <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" title={`أقل من سعر المخزون (${formatMoney(l.purchase_price)})`} />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center text-sm text-slate-600">{l.original_qty}</td>
                                <td className="px-3 py-3 text-center text-2sm font-bold text-slate-700">{formatMoney(originalTotal)}</td>
                                <td className="px-3 py-3 text-center text-sm text-slate-500">{l.already_returned || "—"}</td>
                                <td className="px-3 py-3 text-center">
                                  <input type="number" min="0" max={l.original_qty - l.already_returned} value={l.qty_to_return} data-help="sr-form-qty"
                                    onChange={e => setInvoiceLineQty(l.invoice_line_id, e.target.value)}
                                    disabled={!l.checked || isLocked}
                                    className="w-16 rounded-sm border border-slate-200 px-2 py-1 text-center text-sm font-black text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                                </td>
                                <td className="px-3 py-3 text-center text-2sm font-black text-emerald-700">
                                  {l.checked && returnTotal > 0 ? formatMoney(returnTotal) : "—"}
                                </td>
                                <td className={`px-3 py-3 text-center text-sm font-bold ${afterReturn < 0 ? "text-rose-600" : "text-slate-500"}`}>{afterReturn}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {invoiceLines.length === 0 && (() => {
                        const fullyReturned = loadedInvoice?.status === "returned" || (loadedInvoice?.lines || []).length > 0;
                        return fullyReturned ? (
                          <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                              <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <div className="text-sm font-black text-emerald-700">تم إرجاع جميع أصناف هذه الفاتورة بالكامل</div>
                            <div className="text-2sm font-bold text-slate-400">لا توجد كميات متبقية قابلة للإرجاع</div>
                            <Link to={`/sales/returns?invoice_id=${loadedInvoice?.id}`} className="flex items-center gap-1 text-2sm font-bold text-emerald-600 hover:underline mt-1">
                              <ExternalLink className="h-3.5 w-3.5" /> عرض مرتجعات هذه الفاتورة
                            </Link>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                            <AlertCircle className="h-8 w-8 opacity-30" />
                            <div className="text-sm">لا توجد أصناف قابلة للإرجاع في هذه الفاتورة</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <SalesReturnFormBottomBar
        forceShow={panelEffectiveCollapsed}
        cart={cart}
        subtotal={subtotal}
        headerDiscount={headerDiscount}
        headerIncrease={headerIncrease}
        onHeaderDiscountChange={(val) => { setAdjustmentTouched(true); setHeaderDiscount(val); }}
        onHeaderIncreaseChange={(val) => { setAdjustmentTouched(true); setHeaderIncrease(val); }}
        taxInfo={taxInfo}
        taxFeatureOn={taxFeatureOn}
        taxEnabled={taxEnabled}
        onTaxEnabledChange={setTaxEnabled}
        taxRate={taxRate}
        onTaxRateChange={setTaxRate}
        refundTotal={refundTotal}
        refundMethod={refundMethod}
        onRefundMethodChange={setRefundMethod}
        splitCashAmount={splitCashAmount}
        onSplitCashAmountChange={setSplitCashAmount}
        customer={customer}
        customerBalance={customerBalance}
        netCreditAdjustment={netCreditAdjustment}
        predictedBalance={predictedBalance}
        returnCreditEffect={returnCreditEffect}
        isLocked={isLocked}
        customerLockedFromInvoice={customerLockedFromInvoice}
        isSaving={isSaving}
        onPrint={() => setPrintPreview(true)}
        onSave={handleSave}
        onCustomerInfo={() => setCustomerInfoOpen(true)}
        customerQuery={customerQuery}
        onCustomerQueryChange={setCustomerQuery}
        customerResults={customerResults}
        onCustomerPick={(c) => { setCustomer({ id: c.id, name: c.name }); setCustomerQuery(c.name); setCustomerLookupOpen(false); }}
        customerLookupOpen={customerLookupOpen}
        onCustomerLookupOpenChange={setCustomerLookupOpen}
        onCustomerClear={() => { setCustomer(null); setCustomerQuery(""); }}
        onCustomerCreate={() => setCustomerCreateOpen(true)}
        mode={mode}
        isEditMode={isEditMode}
        total={total}
      />

      <Modal open={showSaveConfirmModal} onClose={() => !isSaving && setShowSaveConfirmModal(false)} title="تأكيد حفظ المرتجع" showDetach={false}>
        <div className="flex flex-col gap-6 mt-2 animate-modal-enter">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">تأكيد حفظ المرتجع</p>
              <p className="text-2sm font-bold text-emerald-700 mt-0.5">سيتم {isEditMode ? "تعديل" : "تسجيل"} المرتجع بقيمة <span className="font-black text-[16px] number-fmt-primary">{formatMoney(refundTotal)}</span> ج.م وتحديث المخزون والحسابات.</p>
            </div>
          </div>

          {isSaving ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-2sm font-black text-slate-600 animate-pulse">جاري حفظ وتجهيز المرتجع...</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {/* Save & Print */}
              <button
                type="button"
                onClick={() => { setShowSaveConfirmModal(false); handleSave({ printAfter: true }); }}
                className="flex flex-col items-center justify-between gap-3 p-4 rounded-2xl border-2 border-indigo-50/50 bg-indigo-50/20 hover:bg-indigo-50/60 hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.97] group text-center cursor-pointer"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/10 group-hover:scale-105 transition-transform shrink-0">
                  <Printer className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-black text-slate-800">حفظ وطباعة</span>
                  <span className="text-[9px] font-bold text-slate-400 leading-tight">طباعة إيصال الاسترداد فوراً</span>
                </div>
              </button>

              {/* Save & WhatsApp */}
              <button
                type="button"
                onClick={() => { setShowSaveConfirmModal(false); handleSave({ whatsappAfter: true }); }}
                className="flex flex-col items-center justify-between gap-3 p-4 rounded-2xl border-2 border-[#25D366]/20 bg-[#25D366]/5 hover:bg-[#25D366]/10 hover:border-[#25D366]/50 hover:shadow-md transition-all active:scale-[0.97] group text-center cursor-pointer"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-md shadow-[#25D366]/20 group-hover:scale-105 transition-transform shrink-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-black text-slate-800">إرسال واتساب</span>
                  <span className="text-[9px] font-bold text-slate-400 leading-tight">إرسال الإيصال عبر واتساب</span>
                </div>
              </button>

              {/* Save Only */}
              <button
                type="button"
                onClick={() => { setShowSaveConfirmModal(false); handleSave(); }}
                className="flex flex-col items-center justify-between gap-3 p-4 rounded-2xl border-2 border-slate-100/50 bg-slate-50/20 hover:bg-slate-50/60 hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.97] group text-center cursor-pointer"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-600 text-white shadow-md shadow-slate-600/10 group-hover:scale-105 transition-transform shrink-0">
                  <Save className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-black text-slate-800">حفظ فقط</span>
                  <span className="text-[9px] font-bold text-slate-400 leading-tight">حفظ بدون طباعة أو إرسال</span>
                </div>
              </button>
            </div>
          )}

          {!isSaving && (
            <button
              type="button"
              onClick={() => setShowSaveConfirmModal(false)}
              className="w-full flex items-center justify-center py-2.5 rounded-xl border border-[var(--border-normal)] bg-white text-2sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] transition-colors cursor-pointer"
            >
              تراجع وإلغاء
            </button>
          )}
        </div>
      </Modal>

      <Modal open={showWarningModal} onClose={() => setShowWarningModal(false)} title="تأكيد الإلغاء" showDetach={false}>
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-sm text-slate-700">هل تريد إلغاء المرتجع الحالي؟ سيتم فقدان البيانات غير المحفوظة.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowWarningModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowWarningModal(false); resetToIdle(); }} className="rounded-md btn-danger px-5 py-2 text-sm font-bold transition-all active:scale-[0.98]">نعم، إلغاء</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditWarnModal} onClose={() => setShowEditWarnModal(false)} title="تعديل المرتجع" showDetach={false}>
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-sm text-slate-700">هل تريد تعديل هذا المرتجع؟ سيتم فتح المرتجع للتعديل.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowEditWarnModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowEditWarnModal(false); setIsLocked(false); }} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-all active:scale-[0.98]">نعم، تعديل</button>
          </div>
        </div>
      </Modal>

      <Modal open={showSwitchInvoiceWarning} onClose={() => setShowSwitchInvoiceWarning(false)} title="تغيير الفاتورة" showDetach={false}>
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-sm text-slate-700">يوجد مرتجع قيد التحرير. هل تريد حفظه أولاً قبل اختيار فاتورة أخرى؟</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSwitchInvoiceWarning(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowSwitchInvoiceWarning(false); setLoadedInvoice(null); setInvoiceLines([]); setInvoicePickerOpen(true); }} className="rounded-md btn-danger px-5 py-2 text-sm font-bold transition-all active:scale-[0.98]">تجاهل وتغيير</button>
            <button onClick={async () => { setShowSwitchInvoiceWarning(false); await handleSave(); setLoadedInvoice(null); setInvoiceLines([]); setInvoicePickerOpen(true); }} className="rounded-md bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 transition-all active:scale-[0.98]">حفظ ثم تغيير</button>
          </div>
        </div>
      </Modal>

      <InvoicePickerTodayModal open={invoicePickerOpen && !isEditMode} onClose={() => { setInvoicePickerOpen(false); if (!loadedInvoice) setMode(null); }} onSelectInvoice={handleDetailConfirm} customers={customers} />
      <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />
      <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); setCustomerCreateOpen(false); }} />
      <SalesReturnTodayModal open={todayReturnsOpen} onClose={() => setTodayReturnsOpen(false)} />
      <PrintPreviewModal
        open={printPreview}
        onClose={() => { setPrintPreview(false); setLastSavedReturn(null); }}
        docType="sales_return"
        invoice={lastSavedReturn || {
          invoice_no: docNo,
          created_at: invoiceCreatedAt || new Date().toISOString(),
          customer_name: customer?.name,
          walk_in_name: !customer?.id && walkInSet ? (waName || null) : null,
          walk_in_phone: !customer?.id && walkInSet ? (waPhone || null) : null,
          cashier_name: user?.name || "",
          discount: Number(headerDiscount) || 0,
          increase: Number(headerIncrease) || 0,
          total: total || 0,
          subtotal: subtotal || 0,
          notes: returnNotes || "",
          lines: (mode === "direct" ? cart : invoiceLines.filter(l => l.checked)).map(l => ({
            ...l,
            item_name: l.item_name,
            quantity: mode === "direct" ? l.quantity : l.qty_to_return,
            unit_price: l.unit_price,
            discount_amount: 0,
          })),
        }}
        settings={{}}
        operationLabel="مرتجع مبيعات"
        onConfirmPrint={() => handleSave({ printAfter: true })}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={() => handleSave()}
        saveOnlyLabel="حفظ بدون طباعة"
        isSaving={isSaving}
        onSendWhatsApp={() => setWaSendOpen(true)}
      />
      {waSendOpen && (
        <WhatsAppSendModal
          open={waSendOpen}
          onClose={() => { setWaSendOpen(false); setLastSavedReturn(null); }}
          kind="return_receipt"
          invoice={lastSavedReturn ? {
            invoice_no: lastSavedReturn.invoice_no,
            customer_id: lastSavedReturn.customer_id,
            customer_name: lastSavedReturn.customer_name,
            customer_phone: lastSavedReturn.customer_phone || lastSavedReturn.walk_in_phone,
            walk_in_name: lastSavedReturn.walk_in_name,
            walk_in_phone: lastSavedReturn.walk_in_phone,
            total: lastSavedReturn.total,
            discount: lastSavedReturn.discount,
            lines: lastSavedReturn.lines,
            created_by_username: lastSavedReturn.cashier_name,
            created_at: lastSavedReturn.created_at,
            payment_type: lastSavedReturn.payment_type,
          } : {
            invoice_no: docNo,
            customer_id: customer?.id,
            customer_name: customer?.name,
            customer_phone: customer?.phone || (!customer?.id && walkInSet ? waPhone : undefined),
            walk_in_name: !customer?.id && walkInSet ? (waName || null) : null,
            walk_in_phone: !customer?.id && walkInSet ? (waPhone || null) : null,
            total: refundTotal || total || 0,
          }}
        />
      )}
      <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); }} />
      <CustomerInfoModal open={customerInfoOpen} customerId={customer?.id} onClose={() => setCustomerInfoOpen(false)} onUpdated={(u) => { setCustomers(prev => prev.map(c => c.id === u.id ? u : c)); setCustomer({ id: u.id, name: u.name }); }} />
      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
      />

      {/* Delete warning modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-7">
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-[17px] font-black text-slate-900 mb-1">تأكيد حذف المرتجع</h2>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    سيتم حذف هذا المرتجع نهائياً وعكس تأثيره على المخزون ورصيد العميل. هذا الإجراء لا يمكن التراجع عنه.
                  </p>
                </div>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 mb-6 text-2sm font-bold text-rose-700">
                تأكد من صحة قرارك قبل المتابعة.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-2xl btn-danger text-sm font-black disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isDeleting ? "جاري الحذف..." : "نعم، احذف المرتجع"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="h-11 px-6 rounded-2xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {saveSuccess && (
        <ReturnSaveSuccess
          docNo={saveSuccess.docNo}
          total={saveSuccess.total}
          discount={saveSuccess.discount}
          increase={saveSuccess.increase}
          refundMethod={saveSuccess.refundMethod}
          cashAmount={saveSuccess.cashAmount}
          creditAmount={saveSuccess.creditAmount}
          entityName={saveSuccess.entityName}
          entityNewBalance={saveSuccess.entityNewBalance}
          type={saveSuccess.type}
          onDismiss={handleSuccessDismiss}
        />
      )}
    </div>
  );
}
