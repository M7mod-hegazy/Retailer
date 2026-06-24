import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Trash2, Plus, Minus, RotateCcw, Clock,
  CheckCircle2, AlertCircle, Lock, Pencil, Printer, X, ExternalLink,
  Package, UserPlus, Calendar, Loader2, ChevronDown, Filter, Settings2,
} from "lucide-react";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../services/api";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import AddSupplierModal from "../../components/modals/AddSupplierModal";
import SupplierInfoModal from "../../components/modals/SupplierInfoModal";
import PurchaseReturnTodayModal from "../../components/purchases/PurchaseReturnTodayModal";
import PurchasePickerTodayModal from "../../components/purchases/PurchasePickerTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import { ReturnSaveSuccess } from "../../components/returns/ReturnSaveSuccess";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { sortByProximity } from "../../utils/itemSort";
import { useGridNavigation } from "../../hooks/useGridNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import { formatNumber } from "../../utils/currency";
import useCollapsibleSidebar from "../../hooks/useCollapsibleSidebar";
import PanelEdgeRail from "../pos/parts/PanelEdgeRail";
import PurchaseReturnFormBottomBar from "./PurchaseReturnFormBottomBar";

function formatMoney(v) {
  return formatNumber(v);
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG-u-nu-latn");
}

// Live indicator of how far the entered return cost is from the item's catalog purchase price.
function PriceDelta({ entered, baseline, baseLabel = "سعر الشراء", className = "" }) {
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


function paymentMethodLabel(m) {
  const map = { cash: "نقداً", credit: "آجل", multi: "متعدد", bank: "بنك", future_due: "آجل مؤجل" };
  return map[m] || m || "—";
}

function OriginalPurchasePreview({ purchase }) {
  const total = Number(purchase.total || 0);
  const discount = Number(purchase.discount || 0);
  const increase = Number(purchase.increase || 0);
  const lines = purchase.lines || [];
  const subtotal = Number(purchase.subtotal || 0)
    || lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unit_cost || l.unit_price || 0), 0);
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
            <span className="text-[11px] font-bold text-amber-700/80 leading-tight">أمر الشراء الأصلي</span>
            <span className="text-[11px] font-black text-amber-900 font-mono tracking-tight leading-tight">#{purchase.doc_no}</span>
          </div>
        </div>
        {purchase.payment_method && (
          <span className="text-[11px] text-amber-700 font-bold bg-white px-1.5 py-0.5 rounded-md border border-amber-200 shrink-0">{paymentMethodLabel(purchase.payment_method)}</span>
        )}
      </div>
      {/* Line items — name + sku + qty × cost */}
      {lines.length > 0 && (
        <div className="border-b border-amber-200/50 px-3 py-2 flex flex-col gap-1 relative z-10">
          <span className="text-[9px] font-bold text-amber-700/70 uppercase tracking-widest mb-0.5">الأصناف ({lines.length})</span>
          {lines.map((l, i) => {
            const qty = Number(l.quantity || 0);
            const price = Number(l.unit_cost || l.unit_price || 0);
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
      {purchase.payments && purchase.payments.length > 0 && (
        <div className="border-t border-amber-200/50 px-4 py-3 flex flex-col gap-2 bg-amber-50/50 relative z-10">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">وسائل الدفع</span>
          {purchase.payments.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-300"/>{p.method_name || p.method_type || "—"}</span>
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
export default function PurchaseReturnFormPage() {
  const handleKeyDown = useFieldNavigation();
  const gridNavRef = useRef(null);
  const { focusLastRowQty } = useGridNavigation(gridNavRef, { qtyCol: "unit_cost" });
  useShortcut("grid.editLast", () => focusLastRowQty());
  useShortcut("form.save", () => { if (total) setShowSaveConfirmModal(true); });
  const navigate = useNavigate();
  const location = useLocation();
  const editReturnId = location.state?.edit_return_id || null;
  const isEditMode = !!editReturnId;

  const [mode, setMode] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const [cart, setCart] = useState([]);

  const [purchaseLines, setPurchaseLines] = useState([]);
  const [loadedPurchase, setLoadedPurchase] = useState(null);

  const [supplier, setSupplier] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierLockedFromPurchase, setSupplierLockedFromPurchase] = useState(false);
  const [supplierCreateOpen, setSupplierCreateOpen] = useState(false);
  const [supplierInfoOpen, setSupplierInfoOpen] = useState(false);
  const [supplierBalance, setSupplierBalance] = useState(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);

  const [settlementType, setSettlementType] = useState("cash");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [reason, setReason] = useState("other");
  const [reasonOther, setReasonOther] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  // Header-level خصم/زيادة on the return document (mirrors purchase discount/increase).
  // For from-order returns these are pro-rated from the original purchase until the user edits them.
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
  const [stagingCost, setStagingCost] = useState("");
  const [stagingWarehouseId, setStagingWarehouseId] = useState("");
  const [stagingUnitId, setStagingUnitId] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});

  const [purchasePickerOpen, setPurchasePickerOpen] = useState(false);

  const [pendingBelowCostAdd, setPendingBelowCostAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showEditWarnModal, setShowEditWarnModal] = useState(false);
  const [showSwitchPurchaseWarning, setShowSwitchPurchaseWarning] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todayReturnsOpen, setTodayReturnsOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  const ALL_COLUMNS_DIRECT = [
    { id: "code", label: "الكود" },
    { id: "item", label: "الصنف" },
    { id: "warehouse", label: "المستودع" },
    { id: "unit", label: "الوحدة" },
    { id: "selling_price", label: "سعر البيع" },
    { id: "purchase_price", label: "سعر الشراء" },
    { id: "return_cost", label: "سعر المرتجع" },
    { id: "quantity", label: "الكمية" },
    { id: "total", label: "الإجمالي" },
    { id: "actions", label: "" },
  ];
  const allDirectIds = ALL_COLUMNS_DIRECT.map(c => c.id);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { const s = localStorage.getItem("retailer.purchaseReturn.visibleColumns"); return s ? JSON.parse(s) : allDirectIds; } catch { return allDirectIds; }
  });
  useEffect(() => { localStorage.setItem("retailer.purchaseReturn.visibleColumns", JSON.stringify(visibleColumns)); }, [visibleColumns]);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    function h(e) { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const itemInputRef = useRef(null);
  const stagingWHRef = useRef(null);
  const stagingUnitRef = useRef(null);
  const stagingQtyRef = useRef(null);
  const stagingCostRef = useRef(null);
  const addBtnRef = useRef(null);
  const supplierInputRef = useRef(null);
  const reasonRef = useRef(null);
  const reasonOtherRef = useRef(null);
  const notesRef = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);

  // Collapsible sidebar
  const sidebar = useCollapsibleSidebar({
    storageKeyPrefix: "retailer.purchase_return",
    defaultWidth: 340,
    minWidth: 300,
  });
  const { panelWidth, panelEffectiveCollapsed, togglePanel, startPanelResize } = sidebar;

  // isDirty must be after all state declarations to avoid TDZ on `supplier`
  const isDirty = isEditMode ? !isLocked : (cart.length > 0 || !!supplier);

  const supplierResults = useMemo(() => {
    if (!supplierLookupOpen) return [];
    const q = supplierQuery.trim().toLowerCase();
    const list = q
      ? suppliers.filter(s => String(s.name || "").toLowerCase().includes(q) || String(s.phone || "").includes(q))
      : suppliers.slice(0, 8);
    return list.slice(0, 8).map(s => ({
      ...s,
      sub_label: s.phone || "",
      price_label: "",
    }));
  }, [supplierLookupOpen, supplierQuery, suppliers]);
  const { blocker } = useUnsavedChangesGuard(isDirty);

  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("purchase_return", editActivation);

  const subtotal = useMemo(() => {
    if (mode === "direct") return cart.reduce((acc, l) => acc + l.unit_cost * l.quantity, 0);
    if (mode === "purchase") return purchaseLines.filter(l => l.checked).reduce((acc, l) => acc + l.unit_cost * l.qty_to_return, 0);
    return 0;
  }, [mode, cart, purchaseLines]);

  // Net return value = lines subtotal − خصم + زيادة. Everything downstream derives from `total`.
  const total = useMemo(
    () => Math.max(0, subtotal - (Number(headerDiscount) || 0) + (Number(headerIncrease) || 0)),
    [subtotal, headerDiscount, headerIncrease],
  );

  const maxDiscountPercent = useAppSettingsStore(s => Number(s.settings?.max_discount_percent ?? 15));
  const discountCapEnabled = useAppSettingsStore(s => Number(s.settings?.discount_cap_enabled ?? 1) !== 0);
  const discountExceedsCap = discountCapEnabled && (Number(headerDiscount) || 0) > subtotal * (maxDiscountPercent / 100);

  const returnCreditEffect = useMemo(() => {
    if (!total) return 0;
    if (settlementType === "account") return total;
    if (settlementType === "split") return Math.max(0, total - (Number(splitCashAmount) || 0));
    return 0;
  }, [settlementType, total, splitCashAmount]);

  // In edit mode, the DB balance already has the ORIGINAL return's credit effect applied.
  // Compute the NET change so we never double-count.
  const originalCreditEffect = useMemo(() => {
    if (!isEditMode || !rawEditData) return 0;
    const origTotal = Number(rawEditData.total || 0);
    const origMethod = rawEditData.settlement_type || "cash";
    if (origMethod === "account") return origTotal;
    if (origMethod === "split") return Math.max(0, origTotal - Number(rawEditData.cash_amount || 0));
    return 0;
  }, [isEditMode, rawEditData]);

  // NET credit adjustment = what changes in the supplier balance after saving.
  // In create mode: netCreditAdjustment = returnCreditEffect (original is 0)
  // In edit mode:   = new - old (0 if same, positive if more credit, negative if less)
  const netCreditAdjustment = returnCreditEffect - originalCreditEffect;

  // Predicted balance = current DB balance minus the net change
  const predictedBalance = supplierBalance !== null ? supplierBalance - netCreditAdjustment : null;

  const hasSupplierBalance = supplierBalance !== null && supplierBalance > 0;

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
    api.get("/api/suppliers?limit=500").then(r => setSuppliers(r.data.data || [])).catch(() => {});
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
    api.get(`/api/purchases/returns/${editReturnId}`).then(r => {
      const pr = r.data.data;
      setRawEditData(pr);
      setEditActivation({ docNo: pr.doc_no || "", createdAt: pr.created_at || new Date().toISOString() });
      setSettlementType(pr.settlement_type || "account");
      if (pr.settlement_type === "split") setSplitCashAmount(String(pr.cash_amount || ""));
      setReason(pr.reason || "other");
      setReturnNotes(pr.notes || "");
      setHeaderDiscount(Number(pr.discount || 0));
      setHeaderIncrease(Number(pr.increase || 0));
      setAdjustmentTouched(true); // saved values — do not auto-recompute over the user's data
      if (pr.supplier_id) { const name = pr.supplier_name || String(pr.supplier_id); setSupplier({ id: pr.supplier_id, name }); setSupplierQuery(name); }
      setMode(pr.purchase_id ? "purchase" : "direct");
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  // Pro-rate the original purchase's خصم/زيادة onto the return by returned-value fraction,
  // recomputing as returned quantities change — until the user manually edits the field.
  useEffect(() => {
    if (mode !== "purchase" || !loadedPurchase || adjustmentTouched) return;
    const invDisc = Number(loadedPurchase.discount || 0);
    const invInc = Number(loadedPurchase.increase || 0);
    const invSub = Number(loadedPurchase.subtotal || 0)
      || (loadedPurchase.lines || []).reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unit_cost || l.unit_price || 0), 0);
    if (invSub <= 0 || (invDisc === 0 && invInc === 0)) { setHeaderDiscount(0); setHeaderIncrease(0); return; }
    const ratio = Math.min(1, subtotal / invSub);
    setHeaderDiscount(Math.round(invDisc * ratio * 100) / 100);
    setHeaderIncrease(Math.round(invInc * ratio * 100) / 100);
  }, [mode, loadedPurchase, subtotal, adjustmentTouched]);

  // Effect 2: resolve warehouse/unit names once reference lists are loaded
  useEffect(() => {
    if (!rawEditData || !warehouses.length || !units.length) return;
    const pr = rawEditData;

    if (pr.purchase_id) {
      api.get(`/api/purchases/${pr.purchase_id}`).then(pur => {
        const purData = pur.data.data;
        setLoadedPurchase(purData);
        const returnedIds = new Set((pr.lines || []).map(l => l.purchase_line_id));
        setPurchaseLines((purData.lines || []).map(l => {
          const returnLine = (pr.lines || []).find(rl => rl.purchase_line_id === l.id);
          const alreadyReturned = Number(l.returned_quantity || 0);
          return {
            purchase_line_id: l.id,
            item_id: l.item_id,
            warehouse_id: l.warehouse_id || 1,
            item_code: l.item_code || l.barcode || "",
            item_name: l.item_name_ar || l.item_name || l.name,
            unit_cost: Number(l.unit_cost || l.unit_price || 0),
            purchase_price: Number(l.purchase_price || 0),
            original_qty: Number(l.quantity),
            already_returned: alreadyReturned,
            qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
            checked: !!returnLine,
            primary_image_url: l.primary_image_url || null,
          };
        }).filter(l => l.original_qty - l.already_returned > 0 || returnedIds.has(l.purchase_line_id)));
      }).catch(() => {});
    } else {
      setCart((pr.lines || []).map((l, idx) => ({
        key: `edit-${l.id || idx}`,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name || l.name,
        item_code: l.item_code || "",
        unit_cost: Number(l.unit_cost || l.unit_price || 0),
        purchase_price: Number(l.purchase_price || 0),
        sale_price: 0,
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
    if (!supplier?.id) { setSupplierBalance(null); return; }
    api.get(`/api/suppliers/${supplier.id}`).then(r => setSupplierBalance(Number(r.data.data?.opening_balance || 0))).catch(() => {});
  }, [supplier?.id]);

  const ITEM_PAGE = 20;
  useEffect(() => {
    pendingPickRef.current = false;
    if (!itemQuery.trim() || stagingItem) { setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); itemSearchActiveRef.current = false; return; }
    itemSearchActiveRef.current = true;
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(itemQuery)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
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
        .catch(() => { pendingPickRef.current = false; })
        .finally(() => { itemSearchActiveRef.current = false; });
    }, 250);
    return () => { clearTimeout(t); itemSearchActiveRef.current = false; };
  }, [itemQuery, stagingItem]);

  useEffect(() => {
    if (itemQuery) setAllItemsMode(false);
  }, [itemQuery]);

  function loadMoreItems() {
    if (!itemHasMore || isLoadingMoreItems) return;
    const q = itemQuery.trim();
    if (!q && !allItemsMode) return;
    setIsLoadingMoreItems(true);
    const searchParam = allItemsMode ? "" : q;
    api.get(`/api/items?search=${encodeURIComponent(searchParam)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
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
    const fmt = (item) => ({ ...item, name: item.name_ar || item.name, price_label: `${formatMoney(item.purchase_price || item.unit_cost || 0)} ج.م` });
    const anchor = stagingItem;
    setAllItemsMode(true);
    setItemResults([]);
    setItemOffset(0);
    setItemHasMore(true);
    setIsLoadingMoreItems(true);
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

  function selectItemForStaging(item) {
    setStagingItem(item);
    setStagingCost(String(item.purchase_price || item.unit_cost || "0"));
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
    setItemQuery(code ? `${code} - ${displayName}` : displayName);
    setItemResults([]); setItemOffset(0); setItemHasMore(false);
    setLookupOpen(false);
    setActiveIndex(-1);
    setTimeout(() => stagingWHRef.current?.focus(), 30);
  }

  function addStagingToCart() {
    if (!stagingItem) return;
    const qty = Math.max(0, Number(stagingQty) || 0);
    const cost = Math.max(0, Number(stagingCost) || 0);
    if (!qty) return;
    const purchasePrice = Number(stagingItem.purchase_price || 0);
    if (purchasePrice > 0 && cost > 0 && cost < purchasePrice) {
      if (!pendingBelowCostAdd) {
        setPendingBelowCostAdd(true);
        setMessage({ text: `تحذير: السعر (${formatMoney(cost)}) أقل من سعر الشراء (${formatMoney(purchasePrice)}). اضغط إضافة مرة أخرى للتأكيد.`, type: "warning" });
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
      const existingIdx = prev.findIndex(l => l.item_id === stagingItem.id && l.key?.startsWith("direct-"));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + finalQty : Math.round(l.quantity) + finalQty,
          unit_cost: cost || l.unit_cost,
        });
      }
      return [...prev, {
        key: `direct-${stagingItem.id}-${Date.now()}`,
        item_id: stagingItem.id,
        item_name: stagingItem.name_ar || stagingItem.name,
        item_code: stagingItem.code || stagingItem.item_code || "",
        unit_cost: cost,
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
    setStagingItem(null); setStagingQty("1"); setStagingCost("");
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); setActiveIndex(-1);
    setTimeout(() => itemInputRef.current?.focus(), 30);
  }

  function removeCartLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }
  function updateCartQty(key, delta) {
    setCart(prev => prev.map(l => {
      if (l.key !== key) return l;
      const newQty = l.quantity + delta;
      const stockAvailable = stockLevels[l.item_id]?.[l.warehouse_id] ?? Infinity;
      return { ...l, quantity: Math.max(0, Math.min(newQty, stockAvailable)) };
    }).filter(l => l.quantity > 0));
  }
  function updateCartPrice(key, val) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, unit_cost: Math.max(0, Number(val) || 0) }));
  }
  function updateCartWarehouse(key, warehouseId) {
    setCart(prev => prev.map(l => l.key !== key ? l : {
      ...l,
      warehouse_id: warehouseId,
      warehouse_name: warehouses.find(w => String(w.id) === String(warehouseId))?.name || "",
    }));
  }

  function selectMode(m) {
    if (m === "purchase") { setMode(m); setPurchasePickerOpen(true); }
    else { setMode(m); activateInvoice(); }
  }

  function resetToIdle() {
    setMode(null); setCart([]); setPurchaseLines([]); setLoadedPurchase(null);
    setSupplier(null); setSupplierLockedFromPurchase(false); setReason("other"); setReasonOther("");
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setStagingItem(null); setStagingQty("1");
    setStagingCost(""); setPurchasePickerOpen(false); resetActivation();
    setHeaderDiscount(0); setHeaderIncrease(0); setAdjustmentTouched(false); setSupervisorOverride(false);
  }

  useEffect(() => {
    if (!supplier) setSettlementType(prev => prev === "account" ? "cash" : prev);
  }, [supplier]);

  function handleBack() {
    if (mode === null || isEditMode) { navigate("/purchases/returns"); return; }
    setShowWarningModal(true);
  }

  function loadPurchase(pur) {
    setLoadedPurchase(pur);
    setPurchaseLines((pur.lines || []).map(l => ({
      purchase_line_id: l.id,
      item_id: l.item_id,
      warehouse_id: l.warehouse_id || 1,
      item_code: l.item_code || l.barcode || "",
      item_name: l.item_name_ar || l.item_name || l.name,
      unit_cost: Number(l.unit_cost || l.unit_price || 0),
      purchase_price: Number(l.purchase_price || 0),
      original_qty: Number(l.quantity),
      already_returned: Number(l.returned_quantity || 0),
      qty_to_return: 0,
      checked: false,
      primary_image_url: l.primary_image_url || null,
    })).filter(l => l.original_qty - l.already_returned > 0));
    if (pur.supplier_id) {
      const name = pur.supplier_name || String(pur.supplier_id);
      setSupplier({ id: pur.supplier_id, name });
      setSupplierQuery(name);
      setSupplierLockedFromPurchase(true);
    }
  }

  function handleDetailConfirm(pur) {
    loadPurchase(pur); setPurchasePickerOpen(false); activateInvoice();
  }

  function togglePurchaseLine(purchase_line_id) {
    setPurchaseLines(prev => prev.map(l => {
      if (l.purchase_line_id !== purchase_line_id) return l;
      const checked = !l.checked;
      return { ...l, checked, qty_to_return: checked ? Math.max(0, l.original_qty - l.already_returned) : 0 };
    }));
  }

  function setPurchaseLineQty(purchase_line_id, val) {
    setPurchaseLines(prev => prev.map(l => {
      if (l.purchase_line_id !== purchase_line_id) return l;
      const maxFromQty = l.original_qty - l.already_returned;
      const stockAvailable = stockLevels[l.item_id]?.[l.warehouse_id] ?? Infinity;
      const max = Math.min(maxFromQty, stockAvailable);
      return { ...l, qty_to_return: Math.max(0, Math.min(max, Number(val) || 0)) };
    }));
  }

  function handlePurchasesClick() {
    if (mode === "purchase" && loadedPurchase) setShowSwitchPurchaseWarning(true);
    else setPurchasePickerOpen(true);
  }

  async function handleSave() {
    const lines = mode === "direct"
      ? cart.map(l => ({ item_id: l.item_id, quantity: l.quantity, unit_cost: l.unit_cost, warehouse_id: l.warehouse_id || null, unit_id: l.unit_id || null, purchase_line_id: null }))
      : purchaseLines.filter(l => l.checked && l.qty_to_return > 0).map(l => ({ purchase_line_id: l.purchase_line_id, item_id: l.item_id, quantity: l.qty_to_return, unit_cost: l.unit_cost }));
    if (!lines.length) { setMessage({ text: "أضف أصناف للمرتجع أولاً", type: "error" }); return; }
    if (discountExceedsCap && !supervisorOverride) {
      setMessage({ text: `الخصم يتجاوز ${maxDiscountPercent}% — فعّل موافقة المشرف للمتابعة`, type: "error" });
      return;
    }
    const payload = {
      doc_no: docNo || undefined, supplier_id: supplier?.id || null,
      settlement_type: settlementType, treasury_id: null,
      cash_amount: settlementType === "split" ? Math.max(0, Number(splitCashAmount) || 0) : undefined,
      reason: reason === "other" ? (reasonOther || "other") : reason, lines,
      discount: Number(headerDiscount) || 0,
      increase: Number(headerIncrease) || 0,
      supervisor_override: supervisorOverride,
      notes: returnNotes || null,
    };
    setIsSaving(true); setMessage({ text: "", type: "" });
    try {
      const savedDocNo = docNo;
      const successData = {
        docNo: savedDocNo,
        total,
        discount: Number(headerDiscount) || 0,
        increase: Number(headerIncrease) || 0,
        refundMethod: settlementType,
        cashAmount: settlementType === 'split' ? Math.max(0, Number(splitCashAmount) || 0) : null,
        creditAmount: returnCreditEffect,
        entityName: supplier?.name,
        entityNewBalance: predictedBalance,
        type: 'purchase_return',
      };
      if (isEditMode) {
        await api.put(`/api/purchases/returns/${editReturnId}`, payload);
        setIsLocked(true);
        setSaveSuccess(successData);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      } else if (mode === "purchase" && loadedPurchase) {
        const res = await api.post(`/api/purchases/${loadedPurchase.id}/return`, payload);
        setSaveSuccess({ ...successData, returnId: res.data.data?.id });
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
        setCart([]); setSupplier(null);
      } else {
        const res = await api.post("/api/invoices/general-purchase-return", payload);
        setSaveSuccess({ ...successData, returnId: res.data.data?.id });
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
        setCart([]); setSupplier(null);
      }
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  function handleSuccessDismiss() {
    const id = saveSuccess?.returnId;
    setSaveSuccess(null);
    if (!isEditMode) navigate("/purchases/returns", { replace: true });
  }

  async function handleDelete() {
    if (!editReturnId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/purchases/returns/${editReturnId}`);
      navigate("/purchases/returns", { replace: true });
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
          <button onClick={() => navigate("/purchases/returns")}
            className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white border border-slate-200/60 shadow-sm text-slate-500 hover:bg-primary-600 hover:text-white hover:border-slate-900 transition-all active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-12 px-4 relative z-10 pb-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-amber-100 text-amber-700 shadow-xl shadow-amber-600/10">
              <RotateCcw className="h-10 w-10" />
            </div>
            <h1 data-help="pr-form-header" className="text-[32px] font-black text-slate-900 tracking-tight">إنشاء مرتجع مشتريات</h1>
            <p className="text-[15px] font-bold text-slate-500 max-w-[40ch] leading-relaxed">
              قم بتحديد الطريقة المناسبة لإرجاع البضائع إلى المورد للحفاظ على دقة المخزون وحسابات الموردين.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
            <button onClick={() => selectMode("direct")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-white border border-slate-200/60 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-2xl hover:border-amber-300 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="bg-slate-50 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:bg-amber-100 group-hover:scale-110 transition-all duration-500 mb-8 border border-slate-100">
                <RotateCcw className="h-8 w-8 text-slate-400 group-hover:text-amber-700 transition-colors" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-slate-900 mb-2">مرتجع مباشر (حر)</span>
                <span className="text-sm font-bold text-slate-500 leading-relaxed">إضافة الأصناف يدوياً وتحديد الكميات والأسعار بدون الارتباط بأمر شراء مسبق.</span>
              </div>
            </button>

            <button data-help="pr-form-invoice" onClick={() => selectMode("purchase")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-amber-600 border-b-4 border-amber-800 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-xl shadow-amber-600/20 hover:bg-amber-500 hover:shadow-amber-600/40 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
              <div className="bg-white/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-all duration-500 mb-8 backdrop-blur-sm">
                <Search className="h-8 w-8 text-white" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-white mb-2">من أمر شراء سابق</span>
                <span className="text-sm font-bold text-amber-100 leading-relaxed">البحث برقم أمر الشراء وتحديد الكميات المرتجعة منه بدقة لضمان التسعير الصحيح.</span>
              </div>
            </button>
          </div>
          {message.text && (
            <div className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black ${message.type === "success" ? "bg-amber-50 text-amber-700 border border-amber-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {message.text}
            </div>
          )}
        </div>
        <PurchasePickerTodayModal open={purchasePickerOpen} onClose={() => { setPurchasePickerOpen(false); setMode(null); }} onSelectPurchase={handleDetailConfirm} suppliers={suppliers} />
        <AddSupplierModal open={supplierCreateOpen} onClose={() => setSupplierCreateOpen(false)} onCreated={s => { setSuppliers(prev => [s, ...prev]); setSupplier({ id: s.id, name: s.name }); }} />
      </div>
    );
  }

  // ══ ACTIVE SCREEN ══
  return (
    <div data-help="pr-form-header" dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden animate-fade-in relative">
      <DocumentHeaderBar
        accent="amber"
        className="shadow-sm"
        onBack={handleBack}
        title={isEditMode ? "تعديل مرتجع مشتريات" : mode === "purchase" && loadedPurchase ? `مرتجع أمر شراء #${loadedPurchase.doc_no}` : "مرتجع مشتريات جديد"}
        subtitle={isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : mode === "direct" ? "مرتجع مباشر" : "مرتجع من أمر شراء"}
        extras={
          <>
            {isLocked && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <Lock className="h-3 w-3" /> محفوظة
              </div>
            )}
            {mode && (
              <div className="flex gap-1.5">
                <input readOnly value={invoiceIsActive ? (docNo || "") : "—"} className="h-7 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
                <input readOnly value={invoiceIsActive && invoiceCreatedAt ? new Date(invoiceCreatedAt).toLocaleString("en-US") : "—"} className="h-7 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
              </div>
            )}
            {mode === "purchase" && loadedPurchase && (
              <Link to={`/purchases/returns?purchase_id=${loadedPurchase.id}`} className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline shrink-0">
                <ExternalLink className="h-3.5 w-3.5" /> عرض كل مرتجعات هذا الأمر
              </Link>
            )}
          </>
        }
        actions={
          <>
            {message.text && (
              <div className={`flex items-center gap-1.5 rounded-sm px-3 py-1 text-2sm font-bold ${message.type === "success" ? "bg-amber-50 text-amber-700 border border-amber-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {message.text}
              </div>
            )}
            <DocumentActionButton variant="today" icon={Calendar} onClick={() => setTodayReturnsOpen(true)}>
              سجل المرتجعات
            </DocumentActionButton>
            <PermissionGate page="purchase_returns" action="print">
              <DocumentActionButton variant="print" icon={Printer} onClick={() => setPrintPreview(true)} disabled={!total}>
                طباعة
              </DocumentActionButton>
            </PermissionGate>
            {isEditMode && isLocked && (
              <PermissionGate page="purchase_returns" action="edit">
                <DocumentActionButton variant="edit" icon={Pencil} onClick={() => setShowEditWarnModal(true)}>
                  تعديل
                </DocumentActionButton>
              </PermissionGate>
            )}
            {isEditMode && !isLocked && (
              <PermissionGate page="purchase_returns" action="delete">
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
              <PermissionGate page="purchase_returns" action={isEditMode ? "edit" : "add"}>
                <DocumentActionButton
                  variant="primary"
                  identity="amber"
                  onClick={() => setShowSaveConfirmModal(true)}
                  disabled={isSaving || !total}
                  loading={isSaving}
                >
                  {isSaving ? "جاري الحفظ..." : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                </DocumentActionButton>
              </PermissionGate>
            )}
          </>
        }
      />

      <div className="flex flex-1 min-h-0" style={{ paddingBottom: panelEffectiveCollapsed ? "var(--bottom-bar-h, 90px)" : undefined }}>
        {/* Left Panel */}
        <aside className={`shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto ${panelEffectiveCollapsed ? "hidden" : ""}`} style={{ width: panelWidth, minWidth: panelWidth }}>
          <div className="flex flex-col gap-5 p-5">
            <button data-help="pr-form-invoice" onClick={handlePurchasesClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white hover:bg-amber-800 transition-all shadow-sm active:scale-[0.98]">
              <Clock className="h-4 w-4" /> طلبات التوريد
            </button>

            {/* Supplier */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">المورد</label>
                {!isLocked && !supplierLockedFromPurchase && (
                  <button onClick={() => setSupplierCreateOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-800 transition-colors">
                    <UserPlus className="h-3 w-3" /> مورد جديد
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  ref={supplierInputRef}
                  type="text"
                  value={supplierQuery}
                  data-help="pr-form-supplier"
                  placeholder={supplier?.id ? supplier.name : "ابحث عن مورد..."}
                  onChange={e => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); if (!e.target.value) setSupplier(null); }}
                  onFocus={() => { if (!supplier?.id) setSupplierQuery(""); setSupplierLookupOpen(true); }}
                  onBlur={() => { setTimeout(() => { setSupplierLookupOpen(false); if (!supplier?.id) setSupplierQuery(""); }, 200); }}
                  disabled={isLocked || supplierLockedFromPurchase}
                  className={`w-full h-10 rounded-xl border px-3 text-sm font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400 ${hasSupplierBalance ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100" : "border-slate-200 bg-slate-50 text-slate-800 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"}`}
                  onKeyDown={e => handleKeyDown(e, { nextRef: reasonRef })}
                />
                {supplierLookupOpen && !isLocked && !supplierLockedFromPurchase && (
                  <SearchDropdown
                    items={supplierResults}
                    onPick={s => { setSupplier({ id: s.id, name: s.name }); setSupplierQuery(s.name); setSupplierLookupOpen(false); }}
                    query={supplierQuery}
                    emptyLabel="لم يتم العثور على مورد"
                  />
                )}
              </div>
              {supplierLockedFromPurchase && !isLocked && <p className="text-[11px] text-slate-400 font-medium">المورد محدد من أمر الشراء الأصلي</p>}
              {supplier?.id && (
                <button onClick={() => setSupplierInfoOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-700 transition-colors">
                  <ExternalLink className="h-3 w-3" /> بيانات المورد
                </button>
              )}
              {supplier?.id && supplierBalance !== null && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${supplierBalance > 0 ? "text-amber-700 bg-amber-100/50 border-amber-200" : "text-slate-600 bg-slate-100/50 border-slate-200"}`}>
                    الرصيد: {formatMoney(supplierBalance)}
                  </div>
                  {netCreditAdjustment !== 0 && total > 0 && (
                    <>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${netCreditAdjustment > 0 ? "text-emerald-700 bg-emerald-100/50 border-emerald-200" : "text-rose-700 bg-rose-100/50 border-rose-200"}`}>
                        {netCreditAdjustment > 0 ? `خصم: −${formatMoney(netCreditAdjustment)}` : `إضافة: +${formatMoney(Math.abs(netCreditAdjustment))}`}
                      </div>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${predictedBalance > 0 ? "text-rose-700 bg-rose-100/50 border-rose-200" : "text-amber-700 bg-amber-100/50 border-amber-200"}`}>
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

            {/* Supplier balance */}
            {supplier && supplierBalance !== null && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-slate-200" />
                <div className="flex justify-between items-center text-2sm">
                  <span className="font-bold text-slate-500">الرصيد الحالي</span>
                  <span className={`number-fmt-primary ${supplierBalance > 0 ? "text-rose-600" : "text-amber-600"}`}>{formatMoney(supplierBalance)} ج.م</span>
                </div>
                {total > 0 && netCreditAdjustment !== 0 && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600">
                        {netCreditAdjustment > 0 ? "الخصم من رصيد المورد" : "إضافة لرصيد المورد"}
                      </span>
                      <span className={`text-sm number-fmt-primary ${netCreditAdjustment > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {netCreditAdjustment > 0 ? "−" : "+"}{formatMoney(Math.abs(netCreditAdjustment))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200/60 pt-1.5">
                      <span className="text-[11px] font-bold text-slate-600">الرصيد بعد الحفظ</span>
                      <span className={`text-sm number-fmt-primary ${predictedBalance > 0 ? "text-rose-600" : "text-amber-700"}`}>
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
                <Link to={`/definitions/suppliers/${supplier.id}`} className="flex items-center justify-center gap-1 mt-2 py-1.5 rounded-lg bg-slate-50 text-[11px] font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                  <ExternalLink className="h-3 w-3" /> عرض سجل المورد الكامل
                </Link>
              </div>
            )}

            <div className="w-full h-px bg-slate-100" />

            {/* Original-purchase خصم/زيادة preview (read-only) + this return's pro-rated share */}
            {mode === "purchase" && loadedPurchase && (Number(loadedPurchase.discount) > 0 || Number(loadedPurchase.increase) > 0) && (() => {
              const invSub = Number(loadedPurchase.subtotal || 0)
                || (loadedPurchase.lines || []).reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unit_cost || l.unit_price || 0), 0);
              const pct = invSub > 0 ? Math.min(100, (subtotal / invSub) * 100) : 0;
              return (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> تعديلات أمر الشراء الأصلي #{loadedPurchase.doc_no}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] font-bold text-slate-500">خصم الأمر الكامل</label>
                      <input readOnly value={formatMoney(loadedPurchase.discount || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center text-2sm number-fmt-primary text-rose-600 cursor-not-allowed" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] font-bold text-slate-500">زيادة الأمر الكاملة</label>
                      <input readOnly value={formatMoney(loadedPurchase.increase || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center text-2sm number-fmt-primary text-emerald-600 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/70 border border-amber-200/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 leading-relaxed">
                    {subtotal > 0 ? (
                      <>هذا المرتجع = <span className="font-black text-amber-700">{pct.toFixed(1)}%</span> من الأمر، فيُطبَّق نصيبه:
                        {Number(headerDiscount) > 0 && <span className="text-rose-600 font-black"> خصم −{formatMoney(headerDiscount)}</span>}
                        {Number(headerIncrease) > 0 && <span className="text-emerald-600 font-black"> زيادة +{formatMoney(headerIncrease)}</span>}
                        {Number(headerDiscount) === 0 && Number(headerIncrease) === 0 && <span> لا شيء</span>}
                        {adjustmentTouched && <span className="text-slate-400"> (معدّل يدوياً)</span>}
                      </>
                    ) : (
                      <>اختر أصنافاً للإرجاع ليُحتسب نصيب هذا المرتجع من خصم/زيادة الأمر.</>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Return total breakdown — subtotal − خصم + زيادة = صافي */}
            {subtotal > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 shadow-sm">
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
                {mode === "purchase" && (headerDiscount > 0 || headerIncrease > 0) && (
                  <div className="text-[11px] font-bold text-slate-400 -mt-1">
                    {adjustmentTouched ? "معدّل يدوياً" : "محسوب تلقائياً من أمر الشراء الأصلي"}
                  </div>
                )}
                {discountExceedsCap && !isLocked && (
                  <label className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-2 py-1.5 text-[11px] font-bold text-amber-800 cursor-pointer">
                    <input type="checkbox" checked={supervisorOverride} onChange={e => setSupervisorOverride(e.target.checked)} className="accent-amber-600" />
                    الخصم يتجاوز {maxDiscountPercent}% — موافقة المشرف
                  </label>
                )}
                <div className="flex items-center justify-between border-t border-amber-200/60 pt-2 mt-0.5">
                  <span className="text-2sm font-black text-amber-700">صافي المرتجع</span>
                  <span className="text-[16px] font-black text-amber-800">{formatMoney(total)} ج.م</span>
                </div>
              </div>
            )}

            {/* Settlement method */}
            <div data-help="pr-form-refund" className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">طريقة التسوية</label>
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60 shadow-inner">
                {[
                  { value: "cash", label: "نقداً", desc: "المورد يرد نقداً للصندوق", requiresSupplier: false },
                  { value: "account", label: "حساب المورد", desc: "يُخصم من رصيد المورد", requiresSupplier: true },
                  { value: "split", label: "مختلط", desc: "جزء نقداً والباقي من الحساب", requiresSupplier: true },
                ].map(opt => {
                  const disabled = isLocked || (opt.requiresSupplier && !supplier);
                  const active = settlementType === opt.value;
                  return (
                    <button key={opt.value} onClick={() => !disabled && setSettlementType(opt.value)} disabled={disabled}
                      className={`flex-1 rounded-lg py-2 px-1 text-center transition-all disabled:cursor-not-allowed ${active ? "bg-white text-amber-700 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 disabled:opacity-40"}`}>
                      <div className="text-2sm font-bold">{opt.label}</div>
                      <div className="text-[9px] font-medium opacity-70 leading-tight mt-0.5 hidden sm:block">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              {settlementType === "split" && total > 0 && (
                <div className="flex flex-col gap-1 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <label className="text-[11px] font-bold text-indigo-600">المبلغ النقدي المستلم</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max={total} step="0.01"
                      value={splitCashAmount}
                      onChange={e => setSplitCashAmount(e.target.value)}
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="0.00"
                    />
                    <span className="text-[11px] text-slate-500 shrink-0">ج.م</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>يُخصم من حساب المورد</span>
                    <span className="font-bold text-indigo-600">{formatMoney(Math.max(0, total - (Number(splitCashAmount) || 0)))} ج.م</span>
                  </div>
                </div>
              )}
            </div>

            {/* Reason — collapsible */}
            <div data-help="pr-form-reason" className="flex flex-col">
              <button onClick={() => setReasonOpen(o => !o)}
                className="flex w-full items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest">
                <span>سبب الاسترداد {reason !== "other" ? <span className="text-amber-600 normal-case tracking-normal text-[11px] ml-1">({REASONS.find(r => r.value === reason)?.label})</span> : reasonOther ? <span className="text-amber-600 normal-case tracking-normal text-[11px] ml-1">({reasonOther})</span> : ""}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
              </button>
              {reasonOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="relative">
                    <select ref={reasonRef} value={reason} onChange={e => setReason(e.target.value)} disabled={isLocked}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm appearance-none" onKeyDown={e => handleKeyDown(e, { nextRef: reasonOtherRef, prevRef: supplierInputRef })}>
                      {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {reason === "other" && !isLocked && (
                    <input ref={reasonOtherRef} value={reasonOther} onChange={e => setReasonOther(e.target.value)} placeholder="اذكر السبب بتفصيل..."
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-2sm font-medium text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 shadow-sm transition-all" onKeyDown={e => handleKeyDown(e, { nextRef: notesRef, prevRef: reasonRef })} />
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
                  ref={notesRef}
                  data-help="pr-form-reason"
                  rows={2}
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="ملاحظة اختيارية على المرتجع…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-all"
                  onKeyDown={e => handleKeyDown(e, { prevRef: reasonOtherRef })}
                />
              )}
            </div>

            {/* Action buttons — mirrors header */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="w-full h-px bg-slate-100" />
              <div className="flex gap-2">
                <button onClick={() => setTodayReturnsOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-2sm font-black text-amber-700 hover:bg-amber-100 transition-all">
                  <Calendar className="h-4 w-4" /> سجل المرتجعات
                </button>
                <PermissionGate page="purchase_returns" action="print">
                  <button onClick={() => setPrintPreview(true)} disabled={!total}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <Printer className="h-4 w-4" /> طباعة
                  </button>
                </PermissionGate>
              </div>
              {mode && !isLocked && (
                <PermissionGate page="purchase_returns" action={isEditMode ? "edit" : "add"}>
                  <button data-help="pr-form-submit" onClick={() => setShowSaveConfirmModal(true)} disabled={isSaving || !total}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-black text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                    {!isSaving && <ShortcutKbd id="form.save" className="ms-1 rounded bg-white/20 px-1 text-[9px] font-mono text-white" />}
                  </button>
                </PermissionGate>
              )}
              <div className="flex gap-2">
                {isEditMode && isLocked && (
                  <PermissionGate page="purchase_returns" action="edit">
                    <button onClick={() => setShowEditWarnModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-2sm font-black text-white hover:bg-indigo-700 transition-all">
                      <Pencil className="h-4 w-4" /> تعديل
                    </button>
                  </PermissionGate>
                )}
                {isEditMode && !isLocked && (
                  <PermissionGate page="purchase_returns" action="delete">
                    <button onClick={() => setMessage({ text: "حذف المرتجع غير متاح حالياً", type: "error" })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-2sm font-black text-rose-600 hover:bg-rose-100 transition-all">
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                  </PermissionGate>
                )}
                {!isEditMode && (
                  <button onClick={() => setShowWarningModal(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-2sm font-black text-amber-700 hover:bg-amber-100 transition-all">
                    <RotateCcw className="h-4 w-4" /> مرتجع جديد
                  </button>
                )}
              </div>
            </div>

            {/* Purchase selected count */}
            {mode === "purchase" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-2sm font-bold text-slate-500 flex items-center gap-2 mt-2">
                <Package className="w-4 h-4 opacity-50" />
                {purchaseLines.filter(l => l.checked).length > 0 ? (
                  <span className="text-amber-700">تم اختيار <span className="font-black">{purchaseLines.filter(l => l.checked).length}</span> أصناف للاسترداد</span>
                ) : (
                  "لم يتم تحديد أي أصناف للإرجاع"
                )}
              </div>
            )}

            {/* Original purchase preview — collapsible */}
            {mode === "purchase" && loadedPurchase && (
              <div className="mt-2 flex flex-col">
                <button onClick={() => setPreviewOpen(o => !o)}
                  className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> أمر الشراء الأصلي · #{loadedPurchase.doc_no}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${previewOpen ? "rotate-180" : ""}`} />
                </button>
                {previewOpen && (
                  <div className="mt-3 animate-slide-up origin-top">
                    <OriginalPurchasePreview purchase={loadedPurchase} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-amber-200 bg-amber-700 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-amber-300">سيتم استرداد</span>
                <span className="text-[11px] text-amber-400">المبلغ المُعاد للمورد</span>
              </div>
              <span className="text-[20px] font-black text-white">{formatMoney(total)} ج.م</span>
            </div>
          </div>
        </aside>
        <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel} onResizeStart={(e) => startPanelResize(e, "right")} panelSide="right" />

        {/* Right Panel */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50 p-4 min-w-0">

          {mode === "direct" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              {!isLocked && (
                <div className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
                  <div className="entry-bar">
                    <EntryItemThumb item={stagingItem} />
                    {/* Item search */}
                    <div className="entry-field entry-field--item">
                      <label className="entry-label">الصنف</label>
                      <ProductSearchField
                        ref={itemInputRef}
                              onNavigateNext={() => { stagingQtyRef.current?.focus(); stagingQtyRef.current?.select?.(); }}
                        query={itemQuery}
                        onQueryChange={(val) => { setItemQuery(val); if (stagingItem) { setStagingItem(null); setStagingCost(""); } }}
                        results={itemResults.map(item => ({ ...item, name: item.name_ar || item.name, price_label: `${formatMoney(item.purchase_price || item.unit_cost || 0)} ج.م` }))}
                        onPick={selectItemForStaging}
                        onEnterNoResults={() => { if (itemSearchActiveRef.current) pendingPickRef.current = true; }}
                        onClear={() => { setStagingItem(null); setStagingCost(""); setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setTimeout(() => itemInputRef.current?.focus(), 30); }}
                        selectedItem={stagingItem}
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
                      <input ref={stagingQtyRef} type="number" data-help="pr-form-qty"
                        min={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "0.001"}
                        step={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "any"}
                        value={stagingQty}
                        onChange={e => {
                          const u = units.find(u => String(u.id) === String(stagingUnitId));
                          setStagingQty(u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value);
                        }}
                        onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, { nextRef: stagingCostRef, prevRef: stagingWHRef })}
                        className="entry-control text-center" />
                    </div>

                    {/* Cost input */}
                    <div className="entry-field entry-field--price">
                      <label className="entry-label">سعر الشراء (المرتجع)</label>
                      <input ref={stagingCostRef} type="number" step="any" value={stagingCost} onChange={e => setStagingCost(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, { nextRef: stagingWHRef, prevRef: stagingQtyRef })}
                        title={stagingItem ? `شراء ${Number(stagingItem.purchase_price || 0).toFixed(2)} · بيع ${Number(stagingItem.sale_price || 0).toFixed(2)}` : undefined}
                        className={`entry-control text-center ${stagingItem && Number(stagingItem.purchase_price) > 0 && Number(stagingCost) > 0 && Number(stagingCost) < Number(stagingItem.purchase_price) ? "entry-control--error" : ""}`} />
                      {stagingItem && (
                        <div className="flex items-center justify-center gap-2 overflow-hidden">
                          <span className="text-[9px] font-mono shrink-0 truncate" style={{ color: "var(--text-muted)" }}>شراء {Number(stagingItem.purchase_price || 0).toFixed(2)} · بيع {Number(stagingItem.sale_price || 0).toFixed(2)}</span>
                          <PriceDelta entered={stagingCost} baseline={stagingItem.purchase_price} className="shrink-0" />
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

                    {/* Warehouse — always-visible stock table (also the source picker) */}
                    <div className="entry-field entry-field--wh">
                      <label className="entry-label">المستودع / المخزون</label>
                      <WarehouseSelect
                        ref={stagingWHRef}
                        value={stagingWarehouseId}
                        onChange={(id) => setStagingWarehouseId(id)}
                        emptyLabel="لا يوجد مخازن"
                        onKeyDown={e => handleKeyDown(e, { nextRef: addBtnRef, prevRef: stagingCostRef })}
                        options={warehouses.map(w => {
                          const qty = stagingItem && stockLevels[stagingItem.id] ? (stockLevels[stagingItem.id][w.id] || 0) : 0;
                          const tone = qty <= 0 ? "out" : qty < 5 ? "low" : "normal";
                          return { id: w.id, name: w.name, qty, tone };
                        })}
                      />
                    </div>

                    {/* Add button */}
                    <button ref={addBtnRef} onClick={addStagingToCart} disabled={!stagingItem}
                      onKeyDown={e => handleKeyDown(e, { nextRef: itemInputRef, prevRef: stagingWHRef, onEnter: addStagingToCart })}
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
                                className="h-3.5 w-3.5 rounded border-slate-300 accent-amber-600" />
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
                <div data-help="pr-form-items" className="flex flex-1 flex-col gap-2 min-h-0">
                  <div className="flex items-center gap-1 px-1 py-1.5 shrink-0">
                    <span className="text-2sm font-bold text-slate-500">الأصناف ({cart.length})</span>
                    <ShortcutKbd id="grid.editLast" />
                  </div>
                  <div ref={gridNavRef} className="flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
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
                        {visibleColumns.includes("return_cost") && <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-2sm font-black text-amber-700">سعر المرتجع</span>
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
                                <select value={l.warehouse_id} data-grid-cell data-row={idx} data-col="warehouse_id" onChange={e => updateCartWarehouse(l.key, e.target.value)} className="h-7 w-full rounded border border-slate-200 bg-slate-50 px-1.5 text-2sm font-bold text-slate-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-1 focus:ring-amber-100 transition-colors cursor-pointer">
                                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {(() => {
                                  const wh = stockLevels[l.item_id] || {};
                                  const current = wh[Number(l.warehouse_id)] ?? wh[l.warehouse_id];
                                  if (current === undefined) return null;
                                  const after = current - l.quantity;
                                  return (
                                    <div className="flex items-center gap-1 text-[11px] number-fmt-primary">
                                      <span className="text-slate-400">{current}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className={after >= 0 ? "text-amber-600" : "text-rose-500"}>{after}</span>
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
                          {visibleColumns.includes("return_cost") && <td className="px-3 py-2.5 text-center">
                            {!isLocked ? (
                              <div className="flex flex-col items-center gap-0.5">
                              <input type="number" step="any" min="0" value={l.unit_cost}
                                data-grid-cell data-row={idx} data-col="unit_cost"
                                onChange={e => updateCartPrice(l.key, e.target.value)}
                                onFocus={e => e.target.select()}
                                className={`w-24 rounded border px-2 py-1 text-center text-sm number-fmt-primary outline-none focus:ring-1 transition-colors
                                  ${l.purchase_price > 0 && Number(l.unit_cost) > 0 && Number(l.unit_cost) < l.purchase_price
                                    ? "border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100"
                                    : "border-slate-200 bg-slate-50 text-slate-800 focus:border-amber-400 focus:bg-white focus:ring-amber-200"}`} />
                                <PriceDelta entered={l.unit_cost} baseline={l.purchase_price} />
                              </div>
                            ) : (
                              <span className="text-sm font-black text-slate-700 number-fmt">{formatMoney(l.unit_cost)}</span>
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
                          {visibleColumns.includes("total") && <td className="px-3 py-3 text-center text-sm font-black text-amber-700 number-fmt">{formatMoney(l.unit_cost * l.quantity)}</td>}
                          {!isLocked && visibleColumns.includes("actions") && <td className="px-3 py-3 text-center"><button onClick={() => removeCartLine(l.key)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

          {mode === "purchase" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-1 flex-col gap-4 overflow-hidden min-w-0">
                {!loadedPurchase ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
                    <Search className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-black">لم يتم اختيار أمر شراء بعد</p>
                    <button onClick={() => setPurchasePickerOpen(true)} className="flex items-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-800 transition-colors">
                      <Search className="h-4 w-4" /> اختيار أمر شراء
                    </button>
                  </div>
                ) : (
                  <div data-help="pr-form-items" className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shrink-0">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-black text-amber-800">أمر شراء #{loadedPurchase.doc_no}</span>
                        {loadedPurchase.supplier_name && <span className="text-slate-600">المورد: <strong>{loadedPurchase.supplier_name}</strong></span>}
                        <span className="text-slate-500">{formatDate(loadedPurchase.created_at)}</span>
                        <span className="font-bold text-amber-700">الإجمالي: {formatMoney(loadedPurchase.total)} ج.م</span>
                      </div>
                      {!isLocked && (
                        <button onClick={() => setPurchasePickerOpen(true)} className="flex items-center gap-1.5 text-2sm font-bold text-rose-600 hover:text-rose-800">
                          <X className="h-3.5 w-3.5" /> تغيير الأمر
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-right">
                        <thead className="border-b border-slate-200 bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-3 w-8"></th>
                            <th className="px-2 py-3 text-[11px] font-bold text-slate-400 text-center w-20">الكود</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500">الصنف</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">سعر الشراء</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية الأصلية</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">إجمالي الأمر</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">المُرتجع سابقاً</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">كمية الإرجاع</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-amber-600 text-center">إجمالي الإرجاع</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية المتبقية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseLines.map((l, idx) => {
                            const afterReturn = l.original_qty - l.already_returned - (l.checked ? l.qty_to_return : 0);
                            const originalTotal = l.original_qty * l.unit_cost;
                            const returnTotal = l.checked ? l.qty_to_return * l.unit_cost : 0;
                            return (
                              <tr key={l.purchase_line_id} className={`border-b border-slate-100 transition-colors animate-slide-up ${l.checked ? "bg-amber-50/50" : "hover:bg-slate-50"}`} style={{ animationDelay: `${idx * 50}ms` }}>
                                <td className="px-3 py-3 text-center">
                                  <input type="checkbox" checked={l.checked} onChange={() => !isLocked && togglePurchaseLine(l.purchase_line_id)} disabled={isLocked}
                                    className="h-4 w-4 rounded border-slate-300 accent-amber-600 cursor-pointer disabled:cursor-not-allowed" />
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
                                    <span className={`text-2sm number-fmt ${l.purchase_price > 0 && l.unit_cost < l.purchase_price ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                                      {formatMoney(l.unit_cost)}
                                    </span>
                                    {l.purchase_price > 0 && l.unit_cost < l.purchase_price && (
                                      <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" title={`أقل من سعر المخزون (${formatMoney(l.purchase_price)})`} />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center text-sm text-slate-600">{l.original_qty}</td>
                                <td className="px-3 py-3 text-center text-2sm font-bold text-slate-700">{formatMoney(originalTotal)}</td>
                                <td className="px-3 py-3 text-center text-sm text-slate-500">{l.already_returned || "—"}</td>
                                <td className="px-3 py-3 text-center">
                                  <input type="number" min="0" max={l.original_qty - l.already_returned} value={l.qty_to_return} data-help="pr-form-qty"
                                    onChange={e => setPurchaseLineQty(l.purchase_line_id, e.target.value)}
                                    disabled={!l.checked || isLocked}
                                    className="w-16 rounded-sm border border-slate-200 px-2 py-1 text-center text-sm font-black text-slate-800 outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                                </td>
                                <td className="px-3 py-3 text-center text-2sm font-black text-amber-700">
                                  {l.checked && returnTotal > 0 ? formatMoney(returnTotal) : "—"}
                                </td>
                                <td className={`px-3 py-3 text-center text-sm font-bold ${afterReturn < 0 ? "text-rose-600" : "text-slate-500"}`}>{afterReturn}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {purchaseLines.length === 0 && (() => {
                        const fullyReturned = (loadedPurchase?.lines || []).length > 0;
                        return fullyReturned ? (
                          <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                              <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <div className="text-sm font-black text-amber-700">تم إرجاع جميع أصناف هذا الأمر بالكامل</div>
                            <div className="text-2sm font-bold text-slate-400">لا توجد كميات متبقية قابلة للإرجاع</div>
                            <Link to={`/purchases/returns?purchase_id=${loadedPurchase?.id}`} className="flex items-center gap-1 text-2sm font-bold text-amber-600 hover:underline mt-1">
                              <ExternalLink className="h-3.5 w-3.5" /> عرض مرتجعات هذا الأمر
                            </Link>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                            <AlertCircle className="h-8 w-8 opacity-30" />
                            <div className="text-sm">لا توجد أصناف قابلة للإرجاع في هذا الأمر</div>
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

      <PurchaseReturnFormBottomBar
        forceShow={panelEffectiveCollapsed}
        cart={cart}
        subtotal={subtotal}
        headerDiscount={headerDiscount}
        headerIncrease={headerIncrease}
        onHeaderDiscountChange={(val) => { setAdjustmentTouched(true); setHeaderDiscount(val); }}
        onHeaderIncreaseChange={(val) => { setAdjustmentTouched(true); setHeaderIncrease(val); }}
        total={total}
        settlementType={settlementType}
        onSettlementTypeChange={setSettlementType}
        splitCashAmount={splitCashAmount}
        onSplitCashAmountChange={setSplitCashAmount}
        supplier={supplier}
        supplierBalance={supplierBalance}
        netCreditAdjustment={netCreditAdjustment}
        predictedBalance={predictedBalance}
        returnCreditEffect={returnCreditEffect}
        isLocked={isLocked}
        supplierLockedFromPurchase={supplierLockedFromPurchase}
        isSaving={isSaving}
        onPrint={() => setPrintPreview(true)}
        onSave={handleSave}
        onSupplierInfo={() => setSupplierInfoOpen(true)}
        supplierQuery={supplierQuery}
        onSupplierQueryChange={setSupplierQuery}
        supplierResults={supplierResults}
        onSupplierPick={(s) => { setSupplier({ id: s.id, name: s.name }); setSupplierQuery(s.name); setSupplierLookupOpen(false); }}
        supplierLookupOpen={supplierLookupOpen}
        onSupplierLookupOpenChange={setSupplierLookupOpen}
        onSupplierClear={() => { setSupplier(null); setSupplierQuery(""); }}
        onSupplierCreate={() => setSupplierCreateOpen(true)}
        mode={mode}
        isEditMode={isEditMode}
      />

      <Modal open={showSaveConfirmModal} onClose={() => setShowSaveConfirmModal(false)} title="تأكيد حفظ المرتجع" showDetach={false}>
        <div className="flex flex-col gap-5 animate-modal-enter">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-black text-slate-800">هل أنت متأكد من حفظ هذا المرتجع؟</p>
              <p className="text-2sm text-slate-600">سيتم {isEditMode ? "تعديل" : "تسجيل"} المرتجع بقيمة إجمالية <span className="font-black text-amber-700">{formatMoney(total)} ج.م</span> وتحديث المخزون وحساب المورد.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSaveConfirmModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button data-help="pr-form-submit" onClick={() => { setShowSaveConfirmModal(false); handleSave(); }} disabled={isSaving}
              className="flex items-center gap-2 rounded-md bg-amber-700 px-5 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><CheckCircle2 className="w-4 h-4" /> نعم، حفظ المرتجع</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showWarningModal} onClose={() => setShowWarningModal(false)} title="تأكيد الإلغاء" showDetach={false}>
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-sm text-slate-700">هل تريد إلغاء المرتجع الحالي؟ سيتم فقدان البيانات غير المحفوظة.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowWarningModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">لا، متابعة</button>
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

      <Modal open={showSwitchPurchaseWarning} onClose={() => setShowSwitchPurchaseWarning(false)} title="تغيير أمر الشراء" showDetach={false}>
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-sm text-slate-700">يوجد مرتجع قيد التحرير. هل تريد حفظه أولاً قبل اختيار أمر شراء آخر؟</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSwitchPurchaseWarning(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowSwitchPurchaseWarning(false); setLoadedPurchase(null); setPurchaseLines([]); setPurchasePickerOpen(true); }} className="rounded-md btn-danger px-5 py-2 text-sm font-bold transition-all active:scale-[0.98]">تجاهل وتغيير</button>
            <button onClick={async () => { setShowSwitchPurchaseWarning(false); await handleSave(); setLoadedPurchase(null); setPurchaseLines([]); setPurchasePickerOpen(true); }} className="rounded-md bg-amber-700 px-5 py-2 text-sm font-bold text-white hover:bg-amber-800 transition-all active:scale-[0.98]">حفظ ثم تغيير</button>
          </div>
        </div>
      </Modal>

      <PurchasePickerTodayModal open={purchasePickerOpen && !isEditMode} onClose={() => { setPurchasePickerOpen(false); if (!loadedPurchase) setMode(null); }} onSelectPurchase={handleDetailConfirm} suppliers={suppliers} />
      <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />
      <AddSupplierModal open={supplierCreateOpen} onClose={() => setSupplierCreateOpen(false)} onCreated={s => { setSuppliers(prev => [s, ...prev]); setSupplier({ id: s.id, name: s.name }); setSupplierCreateOpen(false); }} />
      <PurchaseReturnTodayModal open={todayReturnsOpen} onClose={() => setTodayReturnsOpen(false)} />
      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="purchase_return"
        invoice={{
          invoice_no: docNo,
          created_at: invoiceCreatedAt || new Date().toISOString(),
          supplier_name: supplier?.name,
          discount: Number(headerDiscount) || 0,
          increase: Number(headerIncrease) || 0,
          lines: (mode === "direct" ? cart : purchaseLines.filter(l => l.checked)).map(l => ({
            item_name: l.item_name,
            quantity: mode === "direct" ? l.quantity : l.qty_to_return,
            unit_price: l.unit_cost,
            discount_amount: 0,
          })),
        }}
        settings={{}}
        operationLabel="مرتجع مشتريات"
        onConfirmPrint={() => handleSave()}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={() => handleSave()}
        saveOnlyLabel="حفظ بدون طباعة"
        isSaving={isSaving}
      />
      <AddSupplierModal open={supplierCreateOpen} onClose={() => setSupplierCreateOpen(false)} onCreated={s => { setSuppliers(prev => [s, ...prev]); setSupplier({ id: s.id, name: s.name }); }} />
      <SupplierInfoModal open={supplierInfoOpen} supplierId={supplier?.id} onClose={() => setSupplierInfoOpen(false)} onUpdated={(u) => { setSuppliers(prev => prev.map(s => s.id === u.id ? u : s)); setSupplier(prev => prev?.id === u.id ? { ...prev, ...u } : prev); }} />
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
                    سيتم حذف هذا المرتجع نهائياً وعكس تأثيره على المخزون ورصيد المورد. هذا الإجراء لا يمكن التراجع عنه.
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
