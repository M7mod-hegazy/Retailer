import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Trash2, Plus, Minus, RotateCcw, Clock,
  CheckCircle2, AlertCircle, Lock, Pencil, Printer, X, ExternalLink,
  Package, UserPlus, Calendar, Loader2, ChevronDown, Filter,
} from "lucide-react";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../services/api";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import PermissionGate from "../../components/ui/PermissionGate";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import AddSupplierModal from "../../components/modals/AddSupplierModal";
import SupplierInfoModal from "../../components/modals/SupplierInfoModal";
import PurchaseReturnTodayModal from "../../components/purchases/PurchaseReturnTodayModal";
import PurchasePickerTodayModal from "../../components/purchases/PurchasePickerTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
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
  return (
    <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white overflow-hidden text-[12px] shadow-[0_2px_10px_rgba(251,191,36,0.1)] relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-[0.03] pointer-events-none mix-blend-multiply" />
      {/* Header */}
      <div className="px-3 py-2.5 bg-amber-100/50 border-b border-amber-200/60 flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-white border border-amber-200 shadow-sm shrink-0">
            <Clock className="h-3 w-3 text-amber-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-amber-700/80 leading-tight">أمر الشراء الأصلي</span>
            <span className="text-[11px] font-black text-amber-900 font-mono tracking-tight leading-tight">#{purchase.doc_no}</span>
          </div>
        </div>
        {purchase.payment_method && (
          <span className="text-[10px] text-amber-700 font-bold bg-white px-1.5 py-0.5 rounded-md border border-amber-200 shrink-0">{paymentMethodLabel(purchase.payment_method)}</span>
        )}
      </div>
      {/* Financials */}
      <div className="px-4 py-3 flex flex-col gap-2 relative z-10">
        <div className="flex justify-between items-center border-t border-amber-200/50 pt-2 text-slate-900 font-black text-[13px]">
          <span>الإجمالي</span>
          <span>{formatMoney(total)} <span className="text-slate-500 font-sans text-[10px]">ج.م</span></span>
        </div>
      </div>
      {/* Payments */}
      {purchase.payments && purchase.payments.length > 0 && (
        <div className="border-t border-amber-200/50 px-4 py-3 flex flex-col gap-2 bg-amber-50/50 relative z-10">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">وسائل الدفع</span>
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

  const [settlementType, setSettlementType] = useState("account");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [reason, setReason] = useState("other");
  const [reasonOther, setReasonOther] = useState("");

  const [editActivation, setEditActivation] = useState(null);
  const [rawEditData, setRawEditData] = useState(null);

  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
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
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showEditWarnModal, setShowEditWarnModal] = useState(false);
  const [showSwitchPurchaseWarning, setShowSwitchPurchaseWarning] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [todayReturnsOpen, setTodayReturnsOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  const itemInputRef = useRef(null);
  const stagingWHRef = useRef(null);
  const stagingUnitRef = useRef(null);
  const stagingQtyRef = useRef(null);
  const stagingCostRef = useRef(null);
  const addBtnRef = useRef(null);

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

  const total = useMemo(() => {
    if (mode === "direct") return cart.reduce((acc, l) => acc + l.unit_cost * l.quantity, 0);
    if (mode === "purchase") return purchaseLines.filter(l => l.checked).reduce((acc, l) => acc + l.unit_cost * l.qty_to_return, 0);
    return 0;
  }, [mode, cart, purchaseLines]);

  const returnCreditEffect = useMemo(() => {
    if (!total) return 0;
    if (settlementType === "account") return total;
    if (settlementType === "split") return Math.max(0, total - (Number(splitCashAmount) || 0));
    return 0;
  }, [settlementType, total, splitCashAmount]);

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
      if (pr.supplier_id) { const name = pr.supplier_name || String(pr.supplier_id); setSupplier({ id: pr.supplier_id, name }); setSupplierQuery(name); }
      setMode(pr.purchase_id ? "purchase" : "direct");
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

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
            item_code: l.item_code || l.barcode || "",
            item_name: l.item_name_ar || l.item_name || l.name,
            unit_cost: Number(l.unit_cost || l.unit_price || 0),
            purchase_price: Number(l.purchase_price || 0),
            original_qty: Number(l.quantity),
            already_returned: alreadyReturned,
            qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
            checked: !!returnLine,
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
        quantity: Number(l.quantity),
        warehouse_id: l.warehouse_id || "",
        warehouse_name: warehouses.find(w => String(w.id) === String(l.warehouse_id))?.name || "—",
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
    if (!itemQuery.trim() || stagingItem) { setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(itemQuery)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
          const rows = r.data.data || [];
          setItemResults(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
          setLookupOpen(true);
          setActiveIndex(-1);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [itemQuery, stagingItem]);

  function loadMoreItems() {
    if (!itemHasMore || !itemQuery.trim() || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get(`/api/items?search=${encodeURIComponent(itemQuery)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = r.data.data || [];
        setItemResults(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMoreItems(false));
  }

  function handleFieldKeyDown(e, nextRef, prevRef, isEnterSubmit = false) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isEnterSubmit) addStagingToCart();
      else nextRef?.current?.focus();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      prevRef?.current?.focus();
    }
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
    setCart(prev => [...prev, {
      key: `direct-${stagingItem.id}-${Date.now()}`,
      item_id: stagingItem.id,
      item_name: stagingItem.name_ar || stagingItem.name,
      item_code: stagingItem.code || stagingItem.item_code || "",
      unit_cost: cost,
      purchase_price: purchasePrice,
      quantity: qty,
      warehouse_id: stagingWarehouseId,
      warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
      unit_id: stagingUnitId,
      unit_name: units.find(u => String(u.id) === String(stagingUnitId))?.name || "أساسية",
    }]);
    setStagingItem(null); setStagingQty("1"); setStagingCost("");
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); setActiveIndex(-1);
    setTimeout(() => itemInputRef.current?.focus(), 30);
  }

  function removeCartLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }
  function updateCartQty(key, delta) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, l.quantity + delta) }).filter(l => l.quantity > 0));
  }
  function updateCartPrice(key, val) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, unit_cost: Math.max(0, Number(val) || 0) }));
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
  }

  function handleBack() {
    if (mode === null || isEditMode) { navigate("/purchases/returns"); return; }
    setShowWarningModal(true);
  }

  function loadPurchase(pur) {
    setLoadedPurchase(pur);
    setPurchaseLines((pur.lines || []).map(l => ({
      purchase_line_id: l.id,
      item_id: l.item_id,
      item_code: l.item_code || l.barcode || "",
      item_name: l.item_name_ar || l.item_name || l.name,
      unit_cost: Number(l.unit_cost || l.unit_price || 0),
      purchase_price: Number(l.purchase_price || 0),
      original_qty: Number(l.quantity),
      already_returned: Number(l.returned_quantity || 0),
      qty_to_return: 0,
      checked: false,
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
      const max = l.original_qty - l.already_returned;
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
    const payload = {
      doc_no: docNo || undefined, supplier_id: supplier?.id || null,
      settlement_type: settlementType, treasury_id: null,
      cash_amount: settlementType === "split" ? Math.max(0, Number(splitCashAmount) || 0) : undefined,
      reason: reason === "other" ? (reasonOther || "other") : reason, lines,
    };
    setIsSaving(true); setMessage({ text: "", type: "" });
    try {
      const savedDocNo = docNo;
      if (isEditMode) {
        await api.put(`/api/purchases/returns/${editReturnId}`, payload);
        setIsLocked(true);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      } else if (mode === "purchase" && loadedPurchase) {
        await api.post(`/api/purchases/${loadedPurchase.id}/return`, payload);
        resetToIdle();
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      } else {
        await api.post("/api/invoices/general-purchase-return", payload);
        resetToIdle();
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      }
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  // ══ IDLE SCREEN ══
  if (mode === null && !isEditMode) {
    return (
      <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden relative">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

        <div className="flex items-center px-6 pt-5 pb-2 relative z-10">
          <button onClick={() => navigate("/purchases/returns")}
            className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white border border-slate-200/60 shadow-sm text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-12 px-4 relative z-10 pb-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-amber-100 text-amber-700 shadow-xl shadow-amber-600/10">
              <RotateCcw className="h-10 w-10" />
            </div>
            <h1 className="text-[32px] font-black text-slate-900 tracking-tight">إنشاء مرتجع مشتريات</h1>
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
                <span className="text-[14px] font-bold text-slate-500 leading-relaxed">إضافة الأصناف يدوياً وتحديد الكميات والأسعار بدون الارتباط بأمر شراء مسبق.</span>
              </div>
            </button>

            <button onClick={() => selectMode("purchase")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-amber-600 border-b-4 border-amber-800 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-xl shadow-amber-600/20 hover:bg-amber-500 hover:shadow-amber-600/40 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
              <div className="bg-white/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-all duration-500 mb-8 backdrop-blur-sm">
                <Search className="h-8 w-8 text-white" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-white mb-2">من أمر شراء سابق</span>
                <span className="text-[14px] font-bold text-amber-100 leading-relaxed">البحث برقم أمر الشراء وتحديد الكميات المرتجعة منه بدقة لضمان التسعير الصحيح.</span>
              </div>
            </button>
          </div>
          {message.text && (
            <div className={`flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-black ${message.type === "success" ? "bg-amber-50 text-amber-700 border border-amber-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
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
    <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden animate-fade-in">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-amber-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col shrink-0">
            <h1 className="text-[14px] font-black text-slate-800">
              {isEditMode ? "تعديل مرتجع مشتريات" : mode === "purchase" && loadedPurchase ? `مرتجع أمر شراء #${loadedPurchase.doc_no}` : "مرتجع مشتريات جديد"}
            </h1>
            <span className="text-[10px] font-bold text-slate-400">
              {isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : mode === "direct" ? "مرتجع مباشر" : "مرتجع من أمر شراء"}
            </span>
          </div>
          {isLocked && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              <Lock className="h-3 w-3" /> محفوظة
            </div>
          )}
          {mode && (
            <div className="flex gap-1.5">
              <input readOnly value={invoiceIsActive ? (docNo || "") : "—"} className="h-7 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
              <input readOnly value={invoiceIsActive && invoiceCreatedAt ? new Date(invoiceCreatedAt).toLocaleString("ar-EG") : "—"} className="h-7 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
            </div>
          )}
          {mode === "purchase" && loadedPurchase && (
            <Link to={`/purchases/returns?purchase_id=${loadedPurchase.id}`} className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline shrink-0">
              <ExternalLink className="h-3.5 w-3.5" /> عرض كل مرتجعات هذا الأمر
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {message.text && (
            <div className={`flex items-center gap-1.5 rounded-sm px-3 py-1 text-[12px] font-bold ${message.type === "success" ? "bg-amber-50 text-amber-700 border border-amber-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {message.text}
            </div>
          )}
          <button onClick={() => setTodayReturnsOpen(true)}
            className="flex h-9 items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 text-[13px] font-black text-amber-700 hover:bg-amber-100 transition-all">
            <Calendar className="h-4 w-4" /> مرتجعات اليوم
          </button>
          <PermissionGate page="purchase_returns" action="print">
            <button
              onClick={() => setPrintPreview(true)}
              disabled={!total}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </PermissionGate>
          {isEditMode && isLocked && (
            <PermissionGate page="purchase_returns" action="edit">
              <button onClick={() => setShowEditWarnModal(true)} className="flex h-9 items-center gap-2 rounded-sm bg-indigo-600 px-5 text-[13px] font-black text-white hover:bg-indigo-700 transition-all">
                <Pencil className="h-4 w-4" /> تعديل
              </button>
            </PermissionGate>
          )}
          {isEditMode && !isLocked && (
            <PermissionGate page="purchase_returns" action="delete">
              <button onClick={() => setMessage({ text: "حذف المرتجع غير متاح حالياً", type: "error" })} className="flex h-9 items-center gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 text-[13px] font-black text-rose-600 hover:bg-rose-100 transition-all">
                <Trash2 className="h-4 w-4" /> حذف
              </button>
            </PermissionGate>
          )}
          {!isEditMode && (
            <button onClick={() => setShowWarningModal(true)}
              className="flex h-9 items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 text-[13px] font-black text-amber-700 hover:bg-amber-100 transition-all">
              <RotateCcw className="h-4 w-4" /> مرتجع جديد
            </button>
          )}
          {mode && !isLocked && (
            <PermissionGate page="purchase_returns" action={isEditMode ? "edit" : "add"}>
              <button
                onClick={() => setShowSaveConfirmModal(true)}
                disabled={isSaving || !total}
                className="flex h-9 items-center gap-2 rounded-sm bg-amber-700 px-6 text-[13px] font-black text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
              </button>
            </PermissionGate>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="flex w-[340px] lg:w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto">
          <div className="flex flex-col gap-5 p-5">
            <button onClick={handlePurchasesClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-[13px] font-bold text-white hover:bg-amber-800 transition-all shadow-sm active:scale-[0.98]">
              <Clock className="h-4 w-4" /> أوامر الشراء
            </button>

            {/* Supplier */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">المورد</label>
                {!isLocked && !supplierLockedFromPurchase && (
                  <button onClick={() => setSupplierCreateOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 transition-colors">
                    <UserPlus className="h-3 w-3" /> مورد جديد
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={supplierQuery}
                  placeholder={supplier?.id ? supplier.name : "ابحث عن مورد..."}
                  onChange={e => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); if (!e.target.value) setSupplier(null); }}
                  onFocus={() => { if (!supplier?.id) setSupplierQuery(""); setSupplierLookupOpen(true); }}
                  onBlur={() => { setTimeout(() => { setSupplierLookupOpen(false); if (!supplier?.id) setSupplierQuery(""); }, 200); }}
                  disabled={isLocked || supplierLockedFromPurchase}
                  className={`w-full h-10 rounded-xl border px-3 text-[13px] font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400 ${hasSupplierBalance ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100" : "border-slate-200 bg-slate-50 text-slate-800 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"}`}
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
              {supplierLockedFromPurchase && !isLocked && <p className="text-[10px] text-slate-400 font-medium">المورد محدد من أمر الشراء الأصلي</p>}
              {supplier?.id && (
                <button onClick={() => setSupplierInfoOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:text-amber-700 transition-colors">
                  <ExternalLink className="h-3 w-3" /> بيانات المورد
                </button>
              )}
              {supplier?.id && supplierBalance !== null && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${supplierBalance > 0 ? "text-amber-700 bg-amber-100/50 border-amber-200" : "text-slate-600 bg-slate-100/50 border-slate-200"}`}>
                    الرصيد: {formatMoney(supplierBalance)}
                  </div>
                  {returnCreditEffect > 0 && total > 0 && (
                    <>
                      <div className="text-[11px] font-black text-emerald-700 bg-emerald-100/50 border border-emerald-200 px-2 py-1 rounded-sm">
                        خصم: −{formatMoney(returnCreditEffect)}
                      </div>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${(supplierBalance - returnCreditEffect) > 0 ? "text-rose-700 bg-rose-100/50 border-rose-200" : "text-amber-700 bg-amber-100/50 border-amber-200"}`}>
                        بعد المرتجع: {formatMoney(supplierBalance - returnCreditEffect)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Supplier balance */}
            {supplier && supplierBalance !== null && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-slate-200" />
                <div className="flex justify-between items-center text-[12px]">
                  <span className="font-bold text-slate-500">الرصيد الحالي</span>
                  <span className={`font-black font-mono ${supplierBalance > 0 ? "text-rose-600" : "text-amber-600"}`}>{formatMoney(supplierBalance)} ج.م</span>
                </div>
                {returnCreditEffect > 0 && total > 0 && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600">الخصم من رصيد المورد</span>
                      <span className="text-[13px] font-black font-mono text-emerald-700">−{formatMoney(returnCreditEffect)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200/60 pt-1.5">
                      <span className="text-[11px] font-bold text-emerald-600">الرصيد بعد المرتجع</span>
                      <span className={`text-[13px] font-black font-mono ${(supplierBalance - returnCreditEffect) > 0 ? "text-rose-600" : "text-amber-700"}`}>
                        {formatMoney(supplierBalance - returnCreditEffect)}
                      </span>
                    </div>
                  </div>
                )}
                <Link to={`/definitions/suppliers/${supplier.id}`} className="flex items-center justify-center gap-1 mt-2 py-1.5 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                  <ExternalLink className="h-3 w-3" /> عرض سجل المورد الكامل
                </Link>
              </div>
            )}

            <div className="w-full h-px bg-slate-100" />

            {/* Return total — before settlement method */}
            {total > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 shadow-sm">
                <span className="text-[12px] font-bold text-amber-700">إجمالي المرتجع</span>
                <span className="text-[16px] font-black text-amber-800">{formatMoney(total)} ج.م</span>
              </div>
            )}

            {/* Settlement method */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">طريقة التسوية</label>
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60 shadow-inner">
                {[
                  { value: "account", label: "حساب المورد", desc: "يُخصم من رصيد المورد" },
                  { value: "cash", label: "نقداً", desc: "المورد يرد نقداً للصندوق" },
                  { value: "split", label: "مختلط", desc: "جزء نقداً والباقي من الحساب" },
                ].map(opt => {
                  const active = settlementType === opt.value;
                  return (
                    <button key={opt.value} onClick={() => !isLocked && setSettlementType(opt.value)} disabled={isLocked}
                      className={`flex-1 rounded-lg py-2 px-1 text-center transition-all disabled:cursor-not-allowed ${active ? "bg-white text-amber-700 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 disabled:opacity-40"}`}>
                      <div className="text-[12px] font-bold">{opt.label}</div>
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
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[13px] font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
            <div className="flex flex-col">
              <button onClick={() => setReasonOpen(o => !o)}
                className="flex w-full items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest">
                <span>سبب الاسترداد {reason !== "other" ? <span className="text-amber-600 normal-case tracking-normal text-[10px] ml-1">({REASONS.find(r => r.value === reason)?.label})</span> : reasonOther ? <span className="text-amber-600 normal-case tracking-normal text-[10px] ml-1">({reasonOther})</span> : ""}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
              </button>
              {reasonOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="relative">
                    <select value={reason} onChange={e => setReason(e.target.value)} disabled={isLocked}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm appearance-none">
                      {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {reason === "other" && !isLocked && (
                    <input value={reasonOther} onChange={e => setReasonOther(e.target.value)} placeholder="اذكر السبب بتفصيل..."
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 shadow-sm transition-all" />
                  )}
                </div>
              )}
            </div>

            {/* Action buttons — mirrors header */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="w-full h-px bg-slate-100" />
              <div className="flex gap-2">
                <button onClick={() => setTodayReturnsOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-black text-amber-700 hover:bg-amber-100 transition-all">
                  <Calendar className="h-4 w-4" /> مرتجعات اليوم
                </button>
                <PermissionGate page="purchase_returns" action="print">
                  <button onClick={() => setPrintPreview(true)} disabled={!total}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <Printer className="h-4 w-4" /> طباعة
                  </button>
                </PermissionGate>
              </div>
              {mode && !isLocked && (
                <PermissionGate page="purchase_returns" action={isEditMode ? "edit" : "add"}>
                  <button onClick={() => setShowSaveConfirmModal(true)} disabled={isSaving || !total}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-[13px] font-black text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                  </button>
                </PermissionGate>
              )}
              <div className="flex gap-2">
                {isEditMode && isLocked && (
                  <PermissionGate page="purchase_returns" action="edit">
                    <button onClick={() => setShowEditWarnModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-[12px] font-black text-white hover:bg-indigo-700 transition-all">
                      <Pencil className="h-4 w-4" /> تعديل
                    </button>
                  </PermissionGate>
                )}
                {isEditMode && !isLocked && (
                  <PermissionGate page="purchase_returns" action="delete">
                    <button onClick={() => setMessage({ text: "حذف المرتجع غير متاح حالياً", type: "error" })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-black text-rose-600 hover:bg-rose-100 transition-all">
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                  </PermissionGate>
                )}
                {!isEditMode && (
                  <button onClick={() => setShowWarningModal(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-black text-amber-700 hover:bg-amber-100 transition-all">
                    <RotateCcw className="h-4 w-4" /> مرتجع جديد
                  </button>
                )}
              </div>
            </div>

            {/* Purchase selected count */}
            {mode === "purchase" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-bold text-slate-500 flex items-center gap-2 mt-2">
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
                <span className="text-[10px] text-amber-400">المبلغ المُعاد للمورد</span>
              </div>
              <span className="text-[20px] font-black text-white">{formatMoney(total)} ج.م</span>
            </div>
          </div>
        </aside>

        {/* Right Panel */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50 p-4">

          {mode === "direct" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              {!isLocked && (
                <div className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
                  <div className="grid grid-cols-[3fr_110px_100px_80px_100px_160px_80px] gap-2 items-end">
                    {/* Item search */}
                    <div className="relative flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                      <div className="flex items-center gap-1">
                        <div className={`relative flex flex-1 items-center gap-2 rounded-sm border px-2.5 h-[37px] ${lookupOpen ? "border-slate-800 bg-white" : "border-slate-300 bg-slate-50"}`}>
                          <Search className="h-4 w-4 shrink-0 text-slate-400" />
                          <input ref={itemInputRef} value={itemQuery}
                            onChange={e => { setItemQuery(e.target.value); setLookupOpen(true); if (stagingItem) { setStagingItem(null); setStagingCost(""); } }}
                            onFocus={e => { setLookupOpen(true); e.target.select(); }}
                            placeholder="ابحث عن صنف بالاسم أو الكود..."
                            className="flex-1 bg-transparent text-[12px] font-bold text-slate-800 outline-none placeholder:text-slate-400"
                            onKeyDown={e => {
                              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, itemResults.length - 1)); }
                              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
                              else if (e.key === "Enter") {
                                if (!lookupOpen || !itemResults.length) return;
                                e.preventDefault();
                                const idx = activeIndex >= 0 ? activeIndex : 0;
                                if (itemResults[idx]) selectItemForStaging(itemResults[idx]);
                              }
                              else if (e.key === "Escape") { setLookupOpen(false); setActiveIndex(-1); }
                            }} />
                          {stagingItem && (
                            <button onClick={() => { setStagingItem(null); setStagingCost(""); setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); setTimeout(() => itemInputRef.current?.focus(), 30); }}
                              className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                          )}
                          {lookupOpen && itemResults.length > 0 && (
                            <SearchDropdown
                              items={itemResults.map(item => ({ ...item, name: item.name_ar || item.name, price_label: `${formatMoney(item.purchase_price || item.unit_cost || 0)} ج.م` }))}
                              onPick={selectItemForStaging}
                              activeIndex={activeIndex}
                              query={itemQuery}
                              onLoadMore={loadMoreItems}
                              hasMoreFromServer={itemHasMore}
                              isLoadingMore={isLoadingMoreItems}
                            />
                          )}
                        </div>
                        <button onClick={() => setAdvancedSearchOpen(true)}
                          className="flex h-[37px] w-[37px] shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                          title="بحث متقدم">
                          <Filter className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Warehouse dropdown */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">المستودع</label>
                      <select ref={stagingWHRef} value={stagingWarehouseId} onChange={e => setStagingWarehouseId(e.target.value)} onKeyDown={e => handleFieldKeyDown(e, stagingQtyRef, itemInputRef)}
                        className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800">
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    {/* Unit — read-only preview */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                      <div className="w-full h-[37px] border border-slate-200 rounded-sm bg-slate-100 py-2 px-2 text-[12px] font-bold text-slate-500 flex items-center">
                        {stagingItem
                          ? (units.find(u => String(u.id) === String(stagingUnitId))?.name || "أساسية")
                          : "—"}
                      </div>
                    </div>

                    {/* Qty input */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                      <input ref={stagingQtyRef} type="number" min="0.001" step="any" value={stagingQty} onChange={e => setStagingQty(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, stagingCostRef, stagingWHRef)}
                        className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center" />
                    </div>

                    {/* Cost input */}
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] font-bold text-slate-600">سعر الشراء (المرتجع)</label>
                      <input ref={stagingCostRef} type="number" step="any" value={stagingCost} onChange={e => setStagingCost(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, addBtnRef, stagingQtyRef, true)}
                        className={`w-full h-[37px] border rounded-sm py-2 px-2 text-[12px] font-black outline-none text-center transition-colors
                          ${stagingItem && Number(stagingItem.purchase_price) > 0 && Number(stagingCost) > 0 && Number(stagingCost) < Number(stagingItem.purchase_price)
                            ? "border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-600"
                            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-slate-800"}`} />
                      <div className="h-[18px] flex items-center justify-center rounded-sm bg-slate-100 border border-slate-200 px-1">
                        <span className="text-[10px] font-mono text-slate-400">
                          {stagingItem && Number(stagingItem.purchase_price) > 0
                            ? `آخر شراء: ${Number(stagingItem.purchase_price).toFixed(2)}`
                            : stagingItem ? "لا يوجد سعر مرجعي" : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Warehouse stock table */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">المخزون الحالي</label>
                      <div className="border border-slate-300 rounded-sm bg-slate-50 overflow-y-auto outline-none" style={{height:"37px"}}>
                        <table className="w-full text-[10px] border-collapse">
                          <tbody>
                            {warehouses.map(w => {
                              const qty = stagingItem && stockLevels[stagingItem.id] ? (stockLevels[stagingItem.id][w.id] || 0) : 0;
                              return (
                                <tr key={w.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-100">
                                  <td className="px-1.5 py-0.5 font-bold text-slate-600 truncate">{w.name}</td>
                                  <td className={`px-1.5 py-0.5 font-mono text-center ${qty > 0 ? "text-amber-600 font-black" : "text-slate-400"}`}>{qty}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Add button */}
                    <button ref={addBtnRef} onClick={addStagingToCart} disabled={!stagingItem}
                      className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-amber-600 px-4 text-[12px] font-bold text-white hover:bg-amber-700 disabled:opacity-40 transition-all shadow-sm">
                      <Plus className="h-4 w-4" /> إضافة
                    </button>
                  </div>
                </div>
              )}
              {cart.length > 0 ? (
                <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-right">
                    <thead className="border-b border-slate-200 bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-400 text-center">الكود</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500">الصنف</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">المستودع</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الوحدة</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">سعر المرتجع</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الإجمالي</th>
                        {!isLocked && <th className="px-3 py-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l, idx) => (
                        <tr key={l.key} className="border-b border-slate-100 hover:bg-slate-50 animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                          <td className="px-3 py-3 text-center text-[11px] font-mono text-slate-400">{l.item_code || "—"}</td>
                          <td className="px-4 py-3 text-[13px] font-bold text-slate-800">{l.item_name}</td>
                          <td className="px-3 py-3 text-center text-[12px] text-slate-500 font-bold">{l.warehouse_name}</td>
                          <td className="px-3 py-3 text-center text-[12px] text-slate-500 font-bold">{l.unit_name}</td>
                          <td className="px-3 py-3 text-center">
                            {!isLocked ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <input type="number" step="any" min="0" value={l.unit_cost}
                                  onChange={e => updateCartPrice(l.key, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  className={`w-24 rounded-sm border px-2 py-1 text-center text-[13px] font-mono outline-none focus:ring-1 transition-colors
                                    ${l.purchase_price > 0 && Number(l.unit_cost) > 0 && Number(l.unit_cost) < l.purchase_price
                                      ? "border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100"
                                      : "border-slate-200 text-slate-800 focus:border-amber-400 focus:ring-amber-200"}`} />
                                {l.purchase_price > 0 && (
                                  <span className="text-[9px] font-mono text-slate-400">{Number(l.purchase_price).toFixed(2)}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[13px] text-slate-600 font-mono">{formatMoney(l.unit_cost)}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {!isLocked ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => updateCartQty(l.key, -1)} className="flex h-6 w-6 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                <span className="w-8 text-center text-[13px] font-black text-slate-700">{l.quantity}</span>
                                <button onClick={() => updateCartQty(l.key, 1)} className="flex h-6 w-6 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                              </div>
                            ) : <span className="text-[13px] font-black text-slate-700">{l.quantity}</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-[13px] font-bold text-amber-700 font-mono">{formatMoney(l.unit_cost * l.quantity)}</td>
                          {!isLocked && <td className="px-3 py-3 text-center"><button onClick={() => removeCartLine(l.key)} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white text-slate-400">
                  <RotateCcw className="h-10 w-10 opacity-30" />
                  <div className="text-[13px] font-bold">ابحث عن صنف وأضفه للمرتجع</div>
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
                    <p className="text-[14px] font-black">لم يتم اختيار أمر شراء بعد</p>
                    <button onClick={() => setPurchasePickerOpen(true)} className="flex items-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 text-[13px] font-black text-white hover:bg-amber-800 transition-colors">
                      <Search className="h-4 w-4" /> اختيار أمر شراء
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shrink-0">
                      <div className="flex items-center gap-4 text-[13px]">
                        <span className="font-black text-amber-800">أمر شراء #{loadedPurchase.doc_no}</span>
                        {loadedPurchase.supplier_name && <span className="text-slate-600">المورد: <strong>{loadedPurchase.supplier_name}</strong></span>}
                        <span className="text-slate-500">{formatDate(loadedPurchase.created_at)}</span>
                        <span className="font-bold text-amber-700">الإجمالي: {formatMoney(loadedPurchase.total)} ج.م</span>
                      </div>
                      {!isLocked && (
                        <button onClick={() => setPurchasePickerOpen(true)} className="flex items-center gap-1.5 text-[12px] font-bold text-rose-600 hover:text-rose-800">
                          <X className="h-3.5 w-3.5" /> تغيير الأمر
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
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
                                <td className="px-3 py-3 text-[13px] font-bold text-slate-800">{l.item_name}</td>
                                <td className="px-3 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`text-[12px] font-mono ${l.purchase_price > 0 && l.unit_cost < l.purchase_price ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                                      {formatMoney(l.unit_cost)}
                                    </span>
                                    {l.purchase_price > 0 && l.unit_cost < l.purchase_price && (
                                      <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" title={`أقل من سعر المخزون (${formatMoney(l.purchase_price)})`} />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center text-[13px] text-slate-600">{l.original_qty}</td>
                                <td className="px-3 py-3 text-center text-[12px] font-bold text-slate-700">{formatMoney(originalTotal)}</td>
                                <td className="px-3 py-3 text-center text-[13px] text-slate-500">{l.already_returned || "—"}</td>
                                <td className="px-3 py-3 text-center">
                                  <input type="number" min="0" max={l.original_qty - l.already_returned} value={l.qty_to_return}
                                    onChange={e => setPurchaseLineQty(l.purchase_line_id, e.target.value)}
                                    disabled={!l.checked || isLocked}
                                    className="w-16 rounded-sm border border-slate-200 px-2 py-1 text-center text-[13px] font-black text-slate-800 outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                                </td>
                                <td className="px-3 py-3 text-center text-[12px] font-black text-amber-700">
                                  {l.checked && returnTotal > 0 ? formatMoney(returnTotal) : "—"}
                                </td>
                                <td className={`px-3 py-3 text-center text-[13px] font-bold ${afterReturn < 0 ? "text-rose-600" : "text-slate-500"}`}>{afterReturn}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {purchaseLines.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                          <AlertCircle className="h-8 w-8 opacity-30" />
                          <div className="text-[13px]">لا توجد أصناف قابلة للإرجاع في هذا الأمر</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal open={showSaveConfirmModal} onClose={() => setShowSaveConfirmModal(false)} title="تأكيد حفظ المرتجع">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-black text-slate-800">هل أنت متأكد من حفظ هذا المرتجع؟</p>
              <p className="text-[12px] text-slate-600">سيتم {isEditMode ? "تعديل" : "تسجيل"} المرتجع بقيمة إجمالية <span className="font-black text-amber-700">{formatMoney(total)} ج.م</span> وتحديث المخزون وحساب المورد.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSaveConfirmModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowSaveConfirmModal(false); handleSave(); }} disabled={isSaving}
              className="flex items-center gap-2 rounded-md bg-amber-700 px-5 py-2 text-[13px] font-bold text-white hover:bg-amber-800 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><CheckCircle2 className="w-4 h-4" /> نعم، حفظ المرتجع</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showWarningModal} onClose={() => setShowWarningModal(false)} title="تأكيد الإلغاء">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-[14px] text-slate-700">هل تريد إلغاء المرتجع الحالي؟ سيتم فقدان البيانات غير المحفوظة.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowWarningModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">لا، متابعة</button>
            <button onClick={() => { setShowWarningModal(false); resetToIdle(); }} className="rounded-md bg-rose-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-rose-700 transition-all active:scale-[0.98]">نعم، إلغاء</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditWarnModal} onClose={() => setShowEditWarnModal(false)} title="تعديل المرتجع">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-[14px] text-slate-700">هل تريد تعديل هذا المرتجع؟ سيتم فتح المرتجع للتعديل.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowEditWarnModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowEditWarnModal(false); setIsLocked(false); }} className="rounded-md bg-indigo-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-indigo-700 transition-all active:scale-[0.98]">نعم، تعديل</button>
          </div>
        </div>
      </Modal>

      <Modal open={showSwitchPurchaseWarning} onClose={() => setShowSwitchPurchaseWarning(false)} title="تغيير أمر الشراء">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-[14px] text-slate-700">يوجد مرتجع قيد التحرير. هل تريد حفظه أولاً قبل اختيار أمر شراء آخر؟</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSwitchPurchaseWarning(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowSwitchPurchaseWarning(false); setLoadedPurchase(null); setPurchaseLines([]); setPurchasePickerOpen(true); }} className="rounded-md bg-rose-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-rose-700 transition-all active:scale-[0.98]">تجاهل وتغيير</button>
            <button onClick={async () => { setShowSwitchPurchaseWarning(false); await handleSave(); setLoadedPurchase(null); setPurchaseLines([]); setPurchasePickerOpen(true); }} className="rounded-md bg-amber-700 px-5 py-2 text-[13px] font-bold text-white hover:bg-amber-800 transition-all active:scale-[0.98]">حفظ ثم تغيير</button>
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
    </div>
  );
}
