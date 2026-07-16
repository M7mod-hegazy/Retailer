import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, ShoppingCart, Trash2, User, Package, Calendar, FileText,
  Warehouse, ChevronDown, ArrowLeft, X, CreditCard, Wallet, Banknote,
  AlertTriangle, Clock, ExternalLink, TrendingUp, Building2, Phone,
  MapPin, ImageIcon, Printer, CheckCircle2, Layers, Lock, Pencil,
  FilePlus, Sparkles, Receipt, Save, Info,
  Loader2, Filter, ClipboardList, Settings2,
} from "lucide-react";
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";
import api from "../../services/api";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import toast from "react-hot-toast";
import { showApiError } from "../../services/showApiError";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import CategorySearchField from "../../components/ui/CategorySearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
import { sortByProximity } from "../../utils/itemSort";
import { useAuthStore } from "../../stores/authStore";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useGridNavigation } from "../../hooks/useGridNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import AddSupplierModal from "../../components/modals/AddSupplierModal";
import SupplierInfoModal from "../../components/modals/SupplierInfoModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import PurchaseProfitModal from "../../components/purchases/PurchaseProfitModal";
import TodayPurchasesModal from "../../components/purchases/TodayPurchasesModal";
import { formatNumber } from "../../utils/currency";

import { resolveImageUrl } from "../../utils/resolveImageUrl";
import useCollapsibleSidebar from "../../hooks/useCollapsibleSidebar";
import PanelEdgeRail from "../pos/parts/PanelEdgeRail";
import PurchaseFormBottomBar from "./PurchaseFormBottomBar";

function formatMoney(value) {
  return formatNumber(value, { decimals: 3 });
}

function parseJsonArr(val) {
  try { const v = JSON.parse(val || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

function toDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function UnitCell({ unitName }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-[11px] font-bold text-slate-600 truncate">{unitName}</span>
    </div>
  );
}

const PAYMENT_METHOD_LABELS = {
  cash: "نقدي", bank_transfer: "حوالة بنكية", credit: "آجل",
  future_due: "استحقاق لاحق", multi: "متعدد",
};

const PURCHASE_STATUS_STYLES = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  voided: { label: "ملغي", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "ملغي", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const SUPPLIER_METHODS = [
  { id: "credit",       label: "آجل",              sub: "يُضاف لرصيد المورد",          icon: Wallet,   color: "amber",  requiresSupplier: true },
];

const COLOR_MAP = {
  slate:  { border: "border-slate-800",  bg: "bg-slate-800",  text: "text-slate-800",  light: "bg-slate-50"  },
  blue:   { border: "border-blue-600",   bg: "bg-blue-600",   text: "text-blue-700",   light: "bg-blue-50"   },
  amber:  { border: "border-amber-500",  bg: "bg-amber-500",  text: "text-amber-700",  light: "bg-amber-50"  },
  rose:   { border: "border-rose-500",   bg: "bg-rose-500",   text: "text-rose-700",   light: "bg-rose-50"   },
  emerald:{ border: "border-emerald-600",bg: "bg-emerald-600",text: "text-emerald-700",light: "bg-emerald-50"},
};

export default function PurchaseFormPage() {
  usePageTour('purchases');
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditMode = !!id;
  const isAmendMode = isEditMode && !!location.state?.openAmend;

  const [locked, setLocked] = useState(isEditMode && !isAmendMode);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [editDebtRemaining, setEditDebtRemaining] = useState(0); // debt this purchase added to supplier balance (reversal on edit)
  const [editOriginalSupplierId, setEditOriginalSupplierId] = useState(null); // tracks the original supplier in edit mode

  // editActivation is populated after the existing purchase loads (edit mode only)
  const [editActivation, setEditActivation] = useState(null);
  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("purchase_receipt", editActivation);

  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [supplier, setSupplier] = useState(null);
  const [sourcePO, setSourcePO] = useState(null); // { id, doc_no } when this invoice is converted from a purchase order
  const poPrefillApplied = useRef(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [docDate, setDocDate] = useState(toDateInput());
  const [refNo, setRefNo] = useState(() => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `INV-${yy}${mm}${dd}-${String(Date.now()).slice(-4)}`;
  });

  const [itemQuery, setItemQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", warehouseId: "", unitId: "", expiryDate: "", batchNo: "" });
  // Lock toggles: true = update master price on save (🔒), false = this invoice only (🔓)
  const [stagingLocks, setStagingLocks] = useState({ purchase: true, sale: true, wholesale: true });
  const [priceHelpOpen, setPriceHelpOpen] = useState(false);
  const [profitModalOpen, setProfitModalOpen] = useState(false);
  const [todayPurchOpen, setTodayPurchOpen] = useState(false);
  const [profitDisplayMode, setProfitDisplayMode] = useState("pct");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Category filter for product search
  const [listCategoryFilter, setListCategoryFilter] = useState(null);
  const [listCategoryQuery, setListCategoryQuery] = useState("");
  const [categories, setCategories] = useState([]);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);

  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankRef, setBankRef] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [multiAmounts, setMultiAmounts] = useState({});

  const [discount, setDiscount] = useState(0);
  const [increase, setIncrease] = useState(0);
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState("flat");
  const [invoiceIncreaseMode, setInvoiceIncreaseMode] = useState("flat");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const wasSaved = useRef(false);
  const originalSnap = useRef(null);
  const isDirty = (lines.length > 0 || !!supplier) && !locked && !wasSaved.current;
  const { blocker } = useUnsavedChangesGuard(isDirty);
  const [pendingNav, setPendingNav] = useState(null);
  const showUnsavedModal = blocker.state === "blocked" || pendingNav !== null;

  const [printPreview, setPrintPreview] = useState(false);
  const [printSettings, setPrintSettings] = useState({});
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierInfoOpen, setSupplierInfoOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [priceReportOpen, setPriceReportOpen] = useState(false);
  const [editWarnOpen, setEditWarnOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [newInvoiceModalOpen, setNewInvoiceModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [waSendOpen, setWaSendOpen] = useState(false);

  const itemInputRef      = useRef(null);
  const qtyInputRef       = useRef(null);
  const costInputRef      = useRef(null);
  const sellInputRef      = useRef(null);
  const wholesaleInputRef = useRef(null);
  const warehouseTableRef = useRef(null);
  const supplierInputRef  = useRef(null);
  const whSelectRef       = useRef(null);
  const unitSelectRef     = useRef(null);
  const addBtnRef         = useRef(null);
  const docDateRef = useRef(null);
  const notesRef = useRef(null);
  const bankRefInput = useRef(null);
  const dueDateRef = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);
  const searchAbortRef    = useRef(null);
  const currentQueryRef   = useRef("");

  const handleKeyDown = useFieldNavigation();
  const gridNavRef = useRef(null);
  const { focusLastRowQty } = useGridNavigation(gridNavRef, { qtyCol: "quantity", entryRef: itemInputRef });
  useShortcut("grid.editLast", () => focusLastRowQty());
  useShortcut("form.save", () => { if (validateBeforeSave()) { if (priceChangedLines.length > 0) setPriceReportOpen(true); else setSaveConfirmOpen(true); } });

  // Collapsible sidebar
  const sidebar = useCollapsibleSidebar({
    storageKeyPrefix: "retailer.purchase_form",
    defaultWidth: 290,
    minWidth: 260,
  });
  const { panelWidth, panelEffectiveCollapsed, togglePanel, startPanelResize } = sidebar;

  // Column visibility
  const ALL_COLUMNS = ["index","code","name","quantity","unit_id","unit_cost","selling_price","profit_pct","wholesale_price","locks","warehouse_id","expiry_date","total","actions"];
  const DEFAULT_VISIBLE = ["index","code","name","quantity","unit_id","unit_cost","selling_price","wholesale_price","warehouse_id","total","actions"];
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer.purchase.visibleColumns") || "null") || DEFAULT_VISIBLE; } catch { return DEFAULT_VISIBLE; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.purchase.visibleColumns", JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns]);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!priceHelpOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPriceHelpOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [priceHelpOpen]);

  useEffect(() => {
    if (!advancedSearchOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setAdvancedSearchOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [advancedSearchOpen]);

  useEffect(() => {
    if (!colSettingsOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setColSettingsOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [colSettingsOpen]);

  useEffect(() => {
    if (!supplierModalOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setSupplierModalOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [supplierModalOpen]);

  useEffect(() => {
    if (!supplierInfoOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setSupplierInfoOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [supplierInfoOpen]);

  useEffect(() => {
    if (!todayPurchOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setTodayPurchOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [todayPurchOpen]);

  useEffect(() => {
    if (!imageModalOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setImageModalOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [imageModalOpen]);

  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
    api.get("/api/suppliers").then(r => setSuppliers(r.data.data || [])).catch(() => {});

    api.get("/api/units").then(r => setUnits(r.data.data || [])).catch(() => {});
    api.get("/api/payment-methods").then(r => setPaymentMethods((r.data.data || []).filter(m => m.is_active !== 0))).catch(() => {});
    api.get("/api/stock/levels").then(r => {
      const grouped = {};
      (r.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = {};
        grouped[row.item_id][row.warehouse_id] = row.quantity;
      });
      setStockLevels(grouped);
    }).catch(() => {});
    api.get("/api/warehouses").then(r => {
      const w = r.data.data || [];
      setWarehouses(w);
      if (w.length) {
        const firstId = String(w[0].id);
        setDefaultWarehouseId(firstId);
        setStaging(s => ({ ...s, warehouseId: firstId }));
      }
    }).catch(() => {});
  }, []);

  // Load existing purchase in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    setLoadingExisting(true);
    api.get(`/api/purchases/${id}`).then(r => {
      const p = r.data.data;
      setRefNo(p.doc_no || p.ref_no || "");
      setDocDate((p.created_at || "").slice(0, 10));
      setEditActivation({ docNo: p.doc_no || p.ref_no || "", createdAt: p.created_at || new Date().toISOString() });
      const mode = p.payment_method || "cash";
      setPaymentMode(mode);
      if (mode === "multi" && Array.isArray(p.payments) && p.payments.length) {
        const amounts = {};
        for (const pmt of p.payments) {
          if (pmt.method_id != null) amounts[pmt.method_id] = pmt.amount;
        }
        setMultiAmounts(amounts);
      }
      setEditDebtRemaining(p.debt_remaining || 0);
      setEditOriginalSupplierId(p.supplier_id || null);
      if (p.source_purchase_order_id) {
        setSourcePO({ id: p.source_purchase_order_id, doc_no: `PO-${String(p.source_purchase_order_id).padStart(5, "0")}` });
      }
      setDiscount(Math.max(0, Number(p.discount || 0)));
      setIncrease(Math.max(0, Number(p.increase || 0)));
      setPurchaseNotes(p.notes || "");
      if (p.supplier_id) {
        api.get(`/api/suppliers/${p.supplier_id}`).then(sr => {
          const s = sr.data.data;
          setSupplier(s);
          setSupplierQuery(s.name);
        }).catch(() => {});
      }
      const loadedLines = (p.lines || []).map(l => ({
        item_id: l.item_id,
        name: l.item_name || l.name || "",
        code: l.item_code || l.code || l.barcode || "",
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        original_unit_cost: l.unit_cost,
        selling_price: l.selling_price || 0,
        original_sale_price: l.selling_price || 0,
        wholesale_price: l.wholesale_price || 0,
        original_wholesale_price: l.wholesale_price || 0,
        warehouse_id: String(l.warehouse_id || ""),
        unit_id: l.unit_id || null,
        total: l.line_total || (l.quantity * l.unit_cost),
      }));
      setLines(loadedLines);
      originalSnap.current = {
        supplier_id: p.supplier_id || null,
        payment_method: p.payment_method || "cash",
        discount: Number(p.discount || 0),
        increase: Number(p.increase || 0),
        lines: loadedLines.map(l => ({
          item_id: l.item_id, quantity: l.quantity, unit_cost: l.unit_cost,
          selling_price: l.selling_price, wholesale_price: l.wholesale_price,
          warehouse_id: l.warehouse_id,
        })),
      };
    }).catch(() => toast.error("فشل تحميل الفاتورة"))
      .finally(() => setLoadingExisting(false));
  }, [id, isEditMode]);

  // Prefill from a Purchase Order conversion (state passed from طلبات التوريد).
  useEffect(() => {
    const fromPO = location.state?.fromPurchaseOrder;
    if (!fromPO || poPrefillApplied.current) return;
    if (!suppliers.length) return; // wait for suppliers to load
    poPrefillApplied.current = true;
    setSourcePO({ id: fromPO.source_purchase_order_id, doc_no: fromPO.po_doc_no });
    if (fromPO.supplier_id) {
      const s = suppliers.find(x => String(x.id) === String(fromPO.supplier_id));
      if (s) { setSupplier(s); setSupplierQuery(s.name); }
    }
    setDiscount(Math.max(0, Number(fromPO.discount || 0)));
    setIncrease(Math.max(0, Number(fromPO.increase || 0)));
    const headerWh = fromPO.warehouse_id ? String(fromPO.warehouse_id) : defaultWarehouseId;
    setLines((fromPO.lines || []).map(l => ({
      item_id: l.item_id,
      name: l.name,
      code: l.code || "",
      quantity: Number(l.quantity),
      unit_cost: Number(l.unit_cost),
      original_unit_cost: Number(l.unit_cost),
      selling_price: Number(l.selling_price || 0),
      original_sale_price: Number(l.selling_price || 0),
      wholesale_price: Number(l.wholesale_price || 0),
      original_wholesale_price: Number(l.wholesale_price || 0),
      warehouse_id: l.warehouse_id ? String(l.warehouse_id) : headerWh,
      unit_id: l.unit_id || null,
      purchase_order_line_id: l.purchase_order_line_id,
      total: Number(l.quantity) * Number(l.unit_cost),
    })));
  }, [suppliers, defaultWarehouseId, location.state]);

  useEffect(() => {
    if (!selectedItem) setStaging(s => ({ ...s, warehouseId: defaultWarehouseId }));
  }, [defaultWarehouseId]);

  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  const ITEM_PAGE = 20;

  useEffect(() => {
    const q = itemQuery.trim();
    pendingPickRef.current = false;
    if (!q) {
      setFilteredItems([]); setItemOffset(0); setItemHasMore(false);
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
          const rows = (r.data.data || []).map(i => ({
            ...i,
            price_label: formatMoney(i.purchase_price || 0),
          }));
          setFilteredItems(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
          if (pendingPickRef.current && rows.length > 0) {
            pendingPickRef.current = false;
            handlePickItem(rows[0]);
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
  }, [itemQuery, listCategoryFilter]);

  useEffect(() => {
    if (itemQuery) setAllItemsMode(false);
  }, [itemQuery]);

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
        const rows = (r.data.data || []).map(i => ({
          ...i,
          price_label: formatMoney(i.purchase_price || 0),
        }));
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function showAllItems() {
    const SHOW_ALL_LIMIT = 200;
    const fmt = (i) => ({ ...i, price_label: formatMoney(i.purchase_price || 0) });
    const anchor = selectedItem;
    setAllItemsMode(true);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(true);
    setIsLoadingMoreItems(true);

    if (listCategoryFilter?.id) {
      api.get("/api/items", { params: { category_id: listCategoryFilter.id, limit: SHOW_ALL_LIMIT, offset: 0 } })
        .then(r => {
          const rows = (r.data.data || []).map(fmt);
          setFilteredItems(listCategoryFilter?.id ? sortByProximity(rows, anchor) : rows);
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
        setFilteredItems(merged);
        setItemOffset(allRows.length);
        setItemHasMore(Boolean(allRes.data?.meta?.has_more ?? allRows.length === SHOW_ALL_LIMIT));
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [supplierQuery, suppliers]);

  function handlePickItem(item) {
    setSelectedItem(item);
    const _sku = item.code || item.item_code || item.barcode || "";
    setItemQuery(_sku ? `[${_sku}] ${item.name}` : item.name);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setStaging(prev => ({
      ...prev,
      unitCost: String(item.purchase_price || 0),
      sellingPrice: String(item.sale_price || 0),
      wholesalePrice: String(item.wholesale_price || 0),
      unitId: String(item.unit_id || prev.unitId),
    }));
    setLookupOpen(false);
    const cat = categories.find(c => c.id === item.category_id) || categories.find(c => c.name === item.category_name) || null;
    const skuPrefix = cat?.sku_prefix ?? item?.sku_prefix ?? null;
    setListCategoryFilter(cat ? { id: cat.id, name: cat.name, sku_prefix: skuPrefix } : null);
    setListCategoryQuery("");
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  }

  function handlePickSupplier(s) {
    activateInvoice();
    setSupplier(s);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
    // Pull full supplier record (phones, addresses, code) for the inline info card
    api.get(`/api/suppliers/${s.id}`)
      .then(r => { const full = r.data?.data; if (full) setSupplier(prev => (prev && prev.id === full.id ? { ...prev, ...full } : prev)); })
      .catch(() => {});
  }

  function addLine() {
    if (!selectedItem) return;
    if (!selectedItem.name?.trim()) { toast.error("اختر صنفاً من القائمة أولاً"); return; }
    if (Number(staging.unitCost || 0) === 0) { toast.error("يجب إدخال تكلفة الصنف"); return; }
    activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(staging.unitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const rawQty = Number(staging.quantity || 1);
    const qty = allowDecimal ? Math.max(0.001, rawQty) : Math.max(1, Math.round(rawQty));
    const cost = Number(staging.unitCost || 0);
    const sellingPrice = Number(staging.sellingPrice || 0);
    const wholesalePrice = Number(staging.wholesalePrice || 0);
    const wid = staging.warehouseId || defaultWarehouseId;
    setLines(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === selectedItem.id && String(l.warehouse_id) === String(wid));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty,
          unit_cost: cost,
          selling_price: sellingPrice || l.selling_price,
          wholesale_price: wholesalePrice || l.wholesale_price,
          total: (allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty) * cost,
          update_master_purchase_price: stagingLocks.purchase,
          update_master_sale_price:     stagingLocks.sale,
          update_master_wholesale_price: stagingLocks.wholesale,
        });
      }
      const tracksExpiry = expiryEnabled && (selectedItem.track_expiry === 1 || selectedItem.track_expiry === true);
      return [...prev, {
        item_id: selectedItem.id,
        name: selectedItem.name,
        code: selectedItem.code || selectedItem.barcode,
        quantity: qty,
        unit_cost: cost,
        original_unit_cost: Number(selectedItem.purchase_price || 0),
        selling_price: sellingPrice,
        original_sale_price: Number(selectedItem.sale_price || 0),
        wholesale_price: wholesalePrice,
        original_wholesale_price: Number(selectedItem.wholesale_price || 0),
        last_purchase_cost: Number(selectedItem.last_purchase_cost || selectedItem.purchase_price || 0),
        warehouse_id: wid,
        unit_id: staging.unitId || null,
        total: qty * cost,
        update_master_purchase_price: stagingLocks.purchase,
        update_master_sale_price:     stagingLocks.sale,
        update_master_wholesale_price: stagingLocks.wholesale,
        track_expiry: tracksExpiry,
        expiry_date: tracksExpiry ? (staging.expiryDate || null) : null,
        batch_no: tracksExpiry ? (staging.batchNo || null) : null,
        primary_image_url: selectedItem.primary_image_url || selectedItem.image_url || selectedItem.image || null,
      }];
    });
    setSelectedItem(null);
    setItemQuery("");
    setListCategoryFilter(null);
    setListCategoryQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", warehouseId: s.warehouseId, unitId: "", expiryDate: "", batchNo: "" }));
    setTimeout(() => { itemInputRef.current?.focus(); itemInputRef.current?.select(); }, 50);
  }

  function removeLine(index) { setLines(prev => prev.filter((_, i) => i !== index)); }

  function updateLineField(index, field, value) {
    setLines(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const updated = { ...l, [field]: value };
      if (field === "quantity" || field === "unit_cost") updated.total = Number(updated.quantity) * Number(updated.unit_cost);
      return updated;
    }));
  }

  const totals = useMemo(() => {
    const sub = lines.reduce((acc, l) => acc + l.total, 0);
    return { sub, total: Math.max(0, sub - discount + increase) };
  }, [lines, discount, increase]);

  const priceChangedLines = useMemo(
    () => lines.filter(l =>
      (Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0) ||
      (Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0) ||
      (Number(l.unit_cost) !== Number(l.original_unit_cost) && Number(l.unit_cost) > 0)
    ),
    [lines]);

  const priceReportWholesaleUsed = useMemo(
    () => priceChangedLines.some(l =>
      Number(l.wholesale_price) > 0 || Number(l.original_wholesale_price) > 0
    ),
    [priceChangedLines]);

  const multiTotal = useMemo(() =>
    Object.values(multiAmounts).reduce((s, v) => s + Number(v || 0), 0),
    [multiAmounts]);

  const multiCreditAmount = useMemo(() =>
    Object.entries(multiAmounts).reduce((sum, [method_id, v]) => {
      const m = paymentMethods.find(pm => Number(pm.id) === Number(method_id));
      // credit/آجل method may be stored as type='cash' with category='credit'
      const isCredit = m && (m.type === "credit" || m.category === "credit");
      return isCredit ? sum + Number(v || 0) : sum;
    }, 0),
    [multiAmounts, paymentMethods]);

  const isEditDirty = useMemo(() => {
    if (!isEditMode || !originalSnap.current) return false;
    const snap = originalSnap.current;
    if ((supplier?.id ?? null) !== snap.supplier_id) return true;
    if (paymentMode !== snap.payment_method) return true;
    if (Number(discount) !== Number(snap.discount || 0)) return true;
    if (Number(increase) !== Number(snap.increase || 0)) return true;
    if (lines.length !== snap.lines.length) return true;
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i]; const orig = snap.lines[i];
      if (!orig || cur.item_id !== orig.item_id) return true;
      if (Number(cur.quantity) !== Number(orig.quantity)) return true;
      if (Number(cur.unit_cost) !== Number(orig.unit_cost)) return true;
      if (Number(cur.selling_price) !== Number(orig.selling_price)) return true;
      if (Number(cur.wholesale_price) !== Number(orig.wholesale_price)) return true;
      if (String(cur.warehouse_id) !== String(orig.warehouse_id)) return true;
    }
    return false;
  }, [isEditMode, supplier, paymentMode, lines, discount, increase]);

  const multiBalanced = Math.abs(multiTotal - totals.total) < 0.005;

  // ── Live supplier-balance preview (POS parity) ───────────────────────────
  // Amount this invoice adds to the supplier's debt under the chosen method.
  const creditEffect = (paymentMode === "credit" || paymentMode === "future_due")
    ? totals.total
    : paymentMode === "multi" ? multiCreditAmount : 0;
  // On edit, the supplier balance already contains THIS invoice's existing debt,
  // so strip it to show the true "before" balance, then re-add the new effect.
  const baseSupplierBalance = Number(supplier?.opening_balance || 0) - (isEditMode ? Number(editDebtRemaining || 0) : 0);
  const supplierBalanceAfter = baseSupplierBalance + creditEffect;

  function handleSelectPayment(mode) {
    if ((mode === "credit" || mode === "future_due") && !supplier) return;
    setPaymentMode(mode);
    if (mode === "multi") setMultiAmounts({});
  }

  function buildPayload() {
    const payments = paymentMode === "multi"
      ? Object.entries(multiAmounts)
          .filter(([, v]) => Number(v) > 0)
          .map(([method_id, amount]) => ({ method_id: Number(method_id), amount: Number(amount) }))
      : [];
    return {
      supplier_id: supplier?.id || null,
      warehouse_id: defaultWarehouseId,
      doc_no: docNo || refNo,
      ref_no: docNo || refNo,
      date: docDate,
      discount,
      increase,
      notes: purchaseNotes || null,
      payment_method: paymentMode,
      payments,
      source_purchase_order_id: sourcePO?.id || null,
      lines: lines.map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        selling_price: l.selling_price,
        unit_price: l.selling_price,
        wholesale_price: l.wholesale_price,
        warehouse_id: l.warehouse_id || defaultWarehouseId,
        unit_id: l.unit_id || null,
        purchase_order_line_id: l.purchase_order_line_id || null,
        update_master_purchase_price:  l.update_master_purchase_price  !== false,
        update_master_sale_price:      l.update_master_sale_price      !== false,
        update_master_wholesale_price: l.update_master_wholesale_price !== false,
        expiry_date: l.expiry_date || null,
        batch_no: l.batch_no || null,
      })),
    };
  }

  function validateBeforeSave() {
    if (!lines.length) { toast.error("الفاتورة فارغة — أضف أصناف أولاً"); return false; }
    if ((paymentMode === "credit" || paymentMode === "future_due") && !supplier) {
      toast.error("طريقة الدفع الآجلة تتطلب تحديد المورد"); return false;
    }
    if (paymentMode === "multi" && !multiBalanced) {
      toast.error(`المبلغ الموزع ${multiTotal.toFixed(2)} لا يساوي الإجمالي ${totals.total.toFixed(2)}`); return false;
    }
    return true;
  }

  function onDismissSaveSuccess() {
    setSaveSuccess(null);
    if (isEditMode) {
      navigate("/purchases");
      return;
    }
    setLines([]);
    setSupplier(null);
    setSupplierQuery("");
    setPaymentMode("cash");
    setBankRef("");
    setDueDate("");
    setMultiAmounts({});
    setDiscount(0);
    setIncrease(0);
    setInvoiceDiscountMode("flat");
    setInvoiceIncreaseMode("flat");
    resetActivation();
    setTimeout(() => itemInputRef.current?.focus(), 50);
  }

  async function doSave() {
    if (!validateBeforeSave()) return;
    setIsSaving(true);
    try {
      const paymentMethodLabel = {
        cash: "نقدي — الخزينة اليومية", bank_transfer: "حوالة بنكية",
        credit: "آجل", future_due: "استحقاق لاحق", multi: "متعدد",
      }[paymentMode] || paymentMode;
      const paymentsForDisplay = paymentMode === "multi"
        ? Object.entries(multiAmounts)
            .filter(([, v]) => Number(v) > 0)
            .map(([method_id, amount]) => {
              const m = paymentMethods.find(pm => String(pm.id) === String(method_id));
              return { method: m?.type || "cash", method_name: m?.name || "دفعة", amount: Number(amount) };
            })
        : [{ method: paymentMode, method_name: paymentMethodLabel, amount: totals.total }];

      // Correct on new AND edit: baseSupplierBalance already strips this invoice's
      // existing debt in edit mode, so adding creditEffect yields the true new balance.
      const newBalance = (creditEffect > 0 && supplier?.id) ? supplierBalanceAfter : null;

      if (isEditMode) {
        await api.put(`/api/purchases/${id}`, buildPayload());
        if (priceChangedLines.length > 0) toast.success(`تم تحديث أسعار ${priceChangedLines.length} صنف`);
        wasSaved.current = true;
        setSaveSuccess({
          invoiceNumber: docNo || refNo,
          total: `${formatMoney(totals.total)} ج.م`,
          payments: paymentsForDisplay,
          customerName: paymentMode === "cash" ? null : (supplier?.name || null),
          customerNewBalance: newBalance,
          discount: Number(discount || 0),
          increase: Number(increase || 0),
        });
      } else {
        const res = await api.post("/api/purchases", buildPayload());
        const savedDocNo = res.data?.data?.doc_no || docNo || refNo;
        if (priceChangedLines.length > 0) toast.success(`تم تحديث أسعار ${priceChangedLines.length} صنف`);
        wasSaved.current = true;
        setSaveSuccess({
          invoiceNumber: savedDocNo,
          total: `${formatMoney(totals.total)} ج.م`,
          payments: paymentsForDisplay,
          customerName: paymentMode === "cash" ? null : (supplier?.name || null),
          customerNewBalance: newBalance,
          discount: Number(discount || 0),
          increase: Number(increase || 0),
        });
      }
    } catch (e) {
      showApiError(e, "فشل حفظ الفاتورة");
    } finally {
      setIsSaving(false);
      setSaveConfirmOpen(false);
      setPriceReportOpen(false);
    }
  }

  async function doDelete() {
    setDeleteConfirmOpen(false);
    if (!isEditMode) {
      // Just clear form for unsaved new invoice
      setLines([]);
      setSupplier(null);
      setSupplierQuery("");
      setPaymentMode("cash");
      setBankRef("");
      setDueDate("");
      setMultiAmounts({});
      navigate("/purchases");
      return;
    }
    try {
      await api.post(`/api/purchases/${id}/void`);
      toast.success("تم حذف الفاتورة بنجاح");
      navigate("/purchases");
    } catch (e) {
      showApiError(e, "فشل حذف الفاتورة");
    }
  }

  function clearForm() {
    setLines([]);
    setSupplier(null);
    setEditDebtRemaining(0);
    setSupplierQuery("");
    setPaymentMode("cash");
    setBankRef("");
    setDueDate("");
    setMultiAmounts({});
    setDiscount(0);
    setIncrease(0);
    setInvoiceDiscountMode("flat");
    setInvoiceIncreaseMode("flat");
    resetActivation();
  }

  const user = useAuthStore((s) => s.user);
  const isLocked = isEditMode && locked;

  if (loadingExisting) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-sm font-black text-slate-400 animate-pulse">جاري تحميل الفاتورة...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden pb-6 animate-fade-in" dir="rtl">
      {saveSuccess && (
        <InvoiceSaveSuccess
          invoiceNumber={saveSuccess.invoiceNumber}
          total={saveSuccess.total}
          payments={saveSuccess.payments}
          customerName={saveSuccess.customerName}
          customerNewBalance={saveSuccess.customerNewBalance}
          discount={saveSuccess.discount}
          increase={saveSuccess.increase}
          onDismiss={onDismissSaveSuccess}
        />
      )}
      {profitModalOpen && (
        <PurchaseProfitModal lines={lines} onClose={() => setProfitModalOpen(false)} />
      )}
      {priceHelpOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPriceHelpOpen(false)}>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Info size={14} className="text-indigo-600" />
                </div>
                <span className="text-[13px] font-black text-slate-800">خيارات تحديث السعر</span>
              </div>
              <button onClick={() => setPriceHelpOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            {/* Two cards */}
            <div className="p-5 flex flex-col gap-3">
              {/* Card 1: Update master */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-emerald-800 mb-1">يحدّث السعر الأساسي للصنف</p>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      السعر هيتغير، وأي فاتورة جديدة هتشوف السعر ده تلقائي.
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-1.5 bg-emerald-100 rounded px-2 py-1">
                      ★ مثال: المورد رفع سعره — اختار دة عشان السعر الجديد يظهر في كل الفواتير الجاية.
                    </p>
                  </div>
                </div>
              </div>
              {/* Card 2: Invoice only */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-amber-800 mb-1">للفاتورة دي بس</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      السعر ده للفاتورة دي بس. مش هيتغير في أي تعامل تاني.
                    </p>
                    <p className="text-[10px] text-amber-600 mt-1.5 bg-amber-100 rounded px-2 py-1">
                      ★ مثال: اتفقت مع المورد على سعر خاص للطلبية دي — اختار دة عشان السعر الأساسي ما يتغيرش.
                    </p>
                  </div>
                </div>
              </div>
              {/* Tip */}
              <p className="text-[10px] text-slate-500 text-center">
                تقدر تغيّر الخيار دة لكل سعر لوحده من خلال الزر الصغيّر جنب كل سعر
              </p>
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setPriceHelpOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px] font-bold hover:bg-indigo-700 transition-colors">
                فهمت
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <DocumentHeaderBar
        accent="emerald-strong"
        onBack={() => {
          if (isDirty) setPendingNav("/purchases");
          else navigate("/purchases");
        }}
        title={isEditMode ? "فاتورة مشتريات" : "فاتورة مشتريات جديدة"}
        subtitle={isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : "إدخال مخزون جديد"}
        extras={
          <>
            {/* Shown only while converting (unsaved). Once the invoice is saved it opens in edit/locked mode and the banner is hidden. */}
            {sourcePO && !isEditMode && (
              <Link to="/purchases/orders" title="فتح طلبات التوريد"
                className="flex items-center gap-1.5 rounded-sm border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-800 hover:bg-indigo-100 transition-colors">
                <ClipboardList className="h-3.5 w-3.5" /> ناتج عن أمر توريد {sourcePO.doc_no}
              </Link>
            )}
            {invoiceIsActive && (
              <div className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-bold border ${isLocked ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-[var(--primary-50)] text-[var(--primary-600)] border-[var(--primary-100)]"}`}>
                {isLocked ? <Lock className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
                {isLocked ? "مقفلة" : "نشطة"}
              </div>
            )}
            {!isLocked && isEditMode && user?.name && (
              <div className="flex items-center gap-1.5 rounded-sm bg-[var(--primary-50)] border border-[var(--primary-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--primary-600)]">
                المحرر: {user.name}
              </div>
            )}
            <div className="flex gap-1.5 items-center">
              <input disabled value={invoiceIsActive ? (docNo || refNo || "") : "—"}
                className="h-6 w-32 rounded-sm border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono font-black text-slate-500 cursor-not-allowed outline-none text-center" />
              <input disabled
                value={invoiceIsActive && invoiceCreatedAt ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" }).format(new Date(invoiceCreatedAt)) : "—"}
                className="h-6 w-40 rounded-sm border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono font-bold text-slate-400 cursor-not-allowed outline-none text-center select-none" />
            </div>
          </>
        }
        actions={
          <>
            {priceChangedLines.length > 0 && !isLocked && (
              <button
                onClick={() => setPriceReportOpen(true)}
                className="flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {priceChangedLines.length} أسعار ستتغير
              </button>
            )}
            {/* Profit analysis — special to purchases (blue), icon-only */}
            {lines.length > 0 && (
              <button onClick={() => setProfitModalOpen(true)} title="تحليل الربح"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all">
                <TrendingUp className="h-4 w-4" />
              </button>
            )}
            <DocumentActionButton variant="ghost" icon={Filter} onClick={() => setAdvancedSearchOpen(true)} title="بحث متقدم في الأصناف" className="!px-0 w-9 justify-center"
              data-help="purchases-advanced-search-btn" />
            <DocumentActionButton variant="today" icon={Receipt} onClick={() => setTodayPurchOpen(true)} title="مشتريات اليوم" className="!px-0 w-9 justify-center"
              data-help="purchases-today-btn" />
            <PermissionGate page="purchases" action="delete">
              <DocumentActionButton variant="delete" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>
                {isEditMode ? "حذف" : "مسح"}
              </DocumentActionButton>
            </PermissionGate>
            {isEditMode && (
              <DocumentActionButton
                onClick={() => setWaSendOpen(true)}
                className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20"
                icon={WhatsAppIcon}
              >
                واتساب
              </DocumentActionButton>
            )}
            {isEditMode && isLocked ? (
              <DocumentActionButton variant="edit" icon={Pencil} onClick={() => setEditWarnOpen(true)}>
                تعديل
              </DocumentActionButton>
            ) : (
              <>
                <PermissionGate page="purchases" action="print">
                  <DocumentActionButton variant="print" icon={Printer} onClick={() => setPrintPreview(true)} disabled={!lines.length}>
                    معاينة وطباعة
                  </DocumentActionButton>
                </PermissionGate>
                <PermissionGate page="purchases" action={isEditMode || isAmendMode ? "edit" : "add"}>
                  <DocumentActionButton
                    variant="primary"
                    identity="emerald"
                    onClick={() => { if (validateBeforeSave()) { if (priceChangedLines.length > 0) setPriceReportOpen(true); else setSaveConfirmOpen(true); } }}
                    disabled={isSaving || !lines.length || (isEditMode && !isAmendMode && !isEditDirty)}
                    loading={isSaving}
                  >
                    {isSaving ? "جاري..." : isAmendMode ? "إصدار تعديل" : isEditMode ? "حفظ التعديلات" : "حفظ"}
                  </DocumentActionButton>
                </PermissionGate>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-1 min-h-0" style={{ paddingBottom: panelEffectiveCollapsed ? "var(--bottom-bar-h, 90px)" : undefined }}>
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-y-auto p-4">
          {/* Quick Entry Bar — hidden in locked mode */}
          {!isLocked && (
            <section data-help="items-section" className="rounded-2xl border p-3 shadow-sm shrink-0" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
              <div className="entry-bar">
                <EntryItemThumb item={selectedItem} onView={(imgs) => { const u = resolveImageUrl(imgs[0]); if (u) { setImagePreviewUrl(u); setImageModalOpen(true); } }} />
                {/* Item search */}
                <div data-help="search-bar" className="entry-field entry-field--item">
                  <label className="entry-label">الصنف <span className="text-[9px] font-mono text-slate-400">(F1)</span></label>
                  <CategorySearchField
                    categories={categories}
                    value={listCategoryFilter}
                    query={listCategoryQuery}
                    onQueryChange={setListCategoryQuery}
                    onChange={(cat) => {
                      setListCategoryFilter(cat);
                      setListCategoryQuery("");
                      setSelectedItem(null);
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
                    onNavigateNext={() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select?.(); }}
                    query={itemQuery}
                    onQueryChange={(val) => { setItemQuery(val); setSelectedItem(null); }}
                    results={filteredItems}
                    onPick={handlePickItem}
                    onEnterNoResults={() => { if (itemSearchActiveRef.current) pendingPickRef.current = true; }}
                    selectedItem={selectedItem}
                    chipCode={(it) => it.code || it.barcode || `#${it.id}`}
                    showChip={false}
                    onLoadMore={loadMoreItems}
                    hasMore={itemHasMore}
                    isLoadingMore={isLoadingMoreItems}
                    onShowAll={showAllItems}
                    hideZeroStock={false}
                    trailing={(
                      <button
                        type="button"
                        onClick={() => setAdvancedSearchOpen(true)}
                        className="entry-control flex w-[38px] shrink-0 items-center justify-center !p-0"
                        style={{ color: "var(--text-secondary)" }}
                        title="بحث متقدم في المخزون"
                      >
                        <Filter className="h-4 w-4" />
                      </button>
                    )}
                  />
                </div>

                {/* Qty */}
                <div className="entry-field entry-field--qty">
                  <label className="entry-label">الكمية</label>
                  <input ref={qtyInputRef} type="number"
                    min={units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "0.001"}
                    step={units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "any"}
                    value={staging.quantity}
                    onChange={(e) => {
                      const u = units.find(u => String(u.id) === String(staging.unitId));
                      const v = u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value;
                      setStaging(s => ({ ...s, quantity: v }));
                    }}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: costInputRef, prevRef: itemInputRef })}
                    className="entry-control text-center" />
                </div>

                {/* Unit */}
                <div className="entry-field entry-field--unit">
                  <label className="entry-label">الوحدة</label>
                  <div className="entry-control entry-control--readonly">
                    <span className="truncate">
                      {selectedItem && staging.unitId
                        ? (units.find(u => String(u.id) === String(staging.unitId))?.name || "أساسية")
                        : "أساسية"}
                    </span>
                  </div>
                </div>

                {/* Cost */}
                <div className="entry-field entry-field--money">
                  <div className="flex items-center gap-1">
                    <label className="entry-label flex-1 min-w-0 truncate">التكلفة</label>
                    {selectedItem && Number(staging.unitCost) > 0 && Number(selectedItem.purchase_price) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && (
                      <button type="button"
                        onClick={() => setStagingLocks(l => ({ ...l, purchase: !l.purchase }))}
                        title={stagingLocks.purchase ? "هيتحدّث سعر التكلفة ف بطاقة الصنف — اضغط عشان متغيرش" : "للفاتورة دي بس — اضغط عشان تحدّث بطاقة الصنف"}
                        className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded border transition-all ${stagingLocks.purchase ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
                        {stagingLocks.purchase ? "يحدّث" : "ثابت"}
                      </button>
                    )}
                    <button type="button" onClick={() => setPriceHelpOpen(true)}
                      title="اعرف أكثر عن خيارات تحديث السعر"
                      className="shrink-0 text-slate-400 hover:text-indigo-500 transition-colors">
                      <Info size={11} />
                    </button>
                  </div>
                  <input ref={costInputRef} type="number" step="any" value={staging.unitCost}
                    onChange={(e) => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: sellInputRef, prevRef: qtyInputRef })}
                    className={`entry-control text-center ${
                      selectedItem && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && Number(staging.unitCost) > 0 && Number(selectedItem.purchase_price) > 0
                        ? "!border-amber-400 !bg-amber-50" : ""
                    }`} />
                </div>

                {/* Selling price */}
                <div className="entry-field entry-field--money">
                  <div className="flex items-center gap-1">
                    <label className="entry-label flex-1 min-w-0 truncate">مستهلك</label>
                    {selectedItem && Number(staging.sellingPrice) > 0 && Number(selectedItem.sale_price) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && (
                      <button type="button"
                        onClick={() => setStagingLocks(l => ({ ...l, sale: !l.sale }))}
                        title={stagingLocks.sale ? "هيتحدّث سعر البيع ف بطاقة الصنف — اضغط عشان متغيرش" : "للفاتورة دي بس — اضغط عشان تحدّث بطاقة الصنف"}
                        className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded border transition-all ${stagingLocks.sale ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
                        {stagingLocks.sale ? "يحدّث" : "ثابت"}
                      </button>
                    )}
                  </div>
                  <input ref={sellInputRef} type="number" step="any" value={staging.sellingPrice}
                    onChange={(e) => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: wholesaleInputRef, prevRef: costInputRef })}
                    className={`entry-control text-center ${
                      selectedItem && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && Number(staging.sellingPrice) > 0 && Number(selectedItem.sale_price) > 0
                        ? "!border-amber-400 !bg-amber-50" : ""
                    }`} />
                </div>

                {/* Wholesale price */}
                <div className="entry-field entry-field--money">
                  <div className="flex items-center gap-1">
                    <label className="entry-label flex-1 min-w-0 truncate">جملة</label>
                    {selectedItem && Number(staging.wholesalePrice) > 0 && Number(selectedItem.wholesale_price) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && (
                      <button type="button"
                        onClick={() => setStagingLocks(l => ({ ...l, wholesale: !l.wholesale }))}
                        title={stagingLocks.wholesale ? "هيتحدّث سعر الجملة ف بطاقة الصنف — اضغط عشان متغيرش" : "للفاتورة دي بس — اضغط عشان تحدّث بطاقة الصنف"}
                        className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded border transition-all ${stagingLocks.wholesale ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
                        {stagingLocks.wholesale ? "يحدّث" : "ثابت"}
                      </button>
                    )}
                  </div>
                  <input ref={wholesaleInputRef} type="number" step="any" value={staging.wholesalePrice}
                    onChange={(e) => setStaging(s => ({ ...s, wholesalePrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: warehouseTableRef, prevRef: sellInputRef })}
                    className={`entry-control text-center ${
                      selectedItem && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && Number(staging.wholesalePrice) > 0 && Number(selectedItem.wholesale_price) > 0
                        ? "!border-amber-400 !bg-amber-50" : ""
                    }`} />
                </div>

                {/* Warehouse */}
                <div className="entry-field entry-field--wh">
                  <label className="entry-label">المخزن</label>
                  <WarehouseSelect
                    ref={warehouseTableRef}
                    value={staging.warehouseId}
                    onChange={(id) => setStaging(s => ({ ...s, warehouseId: String(id) }))}
                    placeholder="اختر المخزن"
                    emptyLabel="لا يوجد مخازن"
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); wholesaleInputRef.current?.focus(); wholesaleInputRef.current?.select(); }
                      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); addBtnRef.current?.focus(); }
                      else if (e.key === "ArrowLeft") { e.preventDefault(); addBtnRef.current?.focus(); }
                      else if (e.key === "ArrowRight") { e.preventDefault(); wholesaleInputRef.current?.focus(); wholesaleInputRef.current?.select(); }
                    }}
                    options={warehouses.map(w => {
                      const dbQty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : 0;
                      const inLines = selectedItem ? lines.filter(l => l.item_id === selectedItem.id && String(l.warehouse_id) === String(w.id)).reduce((s, l) => s + Number(l.quantity), 0) : 0;
                      const qty = dbQty + inLines;
                      const tone = qty <= 0 ? "out" : qty < 5 ? "low" : "normal";
                      return { id: w.id, name: w.name, qty, tone };
                    })}
                  />
                </div>

                {/* Expiry / batch inputs — only shown for tracked items when FEFO feature is enabled */}
                {expiryEnabled && selectedItem && (selectedItem.track_expiry === 1 || selectedItem.track_expiry === true) && (
                  <div className="flex flex-col gap-1 basis-full mt-1 p-2 rounded-sm border border-blue-200 bg-blue-50/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">تتبع الانتهاء (FEFO)</p>
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-0.5 flex-1">
                        <label className="text-[11px] font-bold text-slate-600">تاريخ الانتهاء</label>
                        <input type="date" value={staging.expiryDate}
                          onChange={e => setStaging(s => ({ ...s, expiryDate: e.target.value }))}
                          className="w-full h-[33px] border border-slate-300 rounded-sm px-2 text-[12px] font-mono bg-white outline-none focus:border-blue-500" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <label className="text-[11px] font-bold text-slate-600">رقم الدفعة (اختياري)</label>
                        <input type="text" value={staging.batchNo} placeholder="BATCH-001"
                          onChange={e => setStaging(s => ({ ...s, batchNo: e.target.value }))}
                          className="w-full h-[33px] border border-slate-300 rounded-sm px-2 text-[12px] font-mono bg-white outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Add button */}
                <button ref={addBtnRef} onClick={addLine}
                  onKeyDown={(e) => handleKeyDown(e, { nextRef: itemInputRef, prevRef: warehouseTableRef, onEnter: addLine })}
                  disabled={!selectedItem}
                  className="entry-add-btn">
                  <Plus className="h-4 w-4" /> إضافة
                </button>

                {/* Column visibility settings — kept inline with the entry bar to save vertical space */}
                <div ref={colSettingsRef} className="relative shrink-0">
                  <button onClick={() => setColSettingsOpen(p => !p)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all active:scale-90"
                    title="تخصيص الأعمدة"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  {colSettingsOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                      <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">الأعمدة الظاهرة</div>
                      {ALL_COLUMNS.filter(c => c !== "index" && c !== "actions").map(cid => {
                        const labels = { code: "الكود", name: "البيان", quantity: "الكمية", unit_id: "الوحدة", unit_cost: "التكلفة", selling_price: "سعر البيع", profit_pct: "الربح", wholesale_price: "جملة", locks: "قفل", warehouse_id: "المخزن", expiry_date: "انتهاء", total: "الإجمالي" };
                        return (
                          <label key={cid} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-2sm font-bold text-slate-700">
                            <input type="checkbox" checked={visibleColumns.includes(cid)}
                              onChange={() => setVisibleColumns(p => p.includes(cid) ? p.filter(c => c !== cid) : [...p, cid])}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                            />
                            {labels[cid] || cid}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}


          {/* Lines DataGrid */}
          <div ref={gridNavRef} className="rounded-2xl border p-2" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
          <DataGrid
            data-help="main-table"
            data={lines}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف في الفاتورة بعد"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-300 max-h-[440px] animate-fade-in"
            rowClass={(l) => {
              const anyUnlocked = l.update_master_purchase_price === false || l.update_master_sale_price === false || l.update_master_wholesale_price === false;
              return anyUnlocked ? "!bg-amber-50" : "";
            }}
            columns={[
              { id: "index", header: "#", width: 40, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100", sortable: false, render: (_, i) => i + 1 },
              { id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[11px] font-black tracking-wider text-slate-500 border-l border-slate-100", render: (l) => l.code || "-" },
              {
                id: "name", header: "البيان", width: 220, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                render: (l) => (
                  <div className="flex items-center gap-2 py-1">
                    {l.primary_image_url && (
                      <img
                        src={resolveImageUrl(l.primary_image_url)}
                        alt="product"
                        className="w-7 h-7 shrink-0 object-cover rounded-[6px] cursor-pointer hover:scale-110 transition-transform shadow-sm border border-slate-200"
                        onClick={() => { const u = resolveImageUrl(l.primary_image_url); if (u) { setImagePreviewUrl(u); setImageModalOpen(true); } }}
                      />
                    )}
                    <span className="whitespace-normal break-words leading-tight">{l.name}</span>
                  </div>
                ),
                sortValue: (l) => l.name,
              },
              { id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const u = units.find(u => String(u.id) === String(l.unit_id));
                  const isInt = u?.allow_decimal === 0;
                  return (
                    <input
                      type="number" min="1" step={isInt ? "1" : "any"}
                      value={l.quantity} disabled={isLocked}
                      data-grid-cell data-row={i} data-col="quantity"
                      onChange={(e) => {
                        const v = isInt ? Math.max(1, Math.round(Number(e.target.value) || 1)) : Math.max(0.001, Number(e.target.value) || 0.001);
                        updateLineField(i, "quantity", v);
                      }}
                      className="w-full h-[40px] text-center text-sm number-fmt-primary bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 transition-colors disabled:cursor-not-allowed"
                    />
                  );
                } },
              { id: "unit_id", header: "الوحدة", width: 85, sortable: false, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l, i) => {
                  const unitName = l.unit_id ? (units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية") : "أساسية";
                  return <UnitCell unitName={unitName} />;
                } },
              {
                id: "unit_cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const costChanged = Number(l.unit_cost) !== Number(l.original_unit_cost) && Number(l.unit_cost) > 0 && Number(l.original_unit_cost) > 0;
                  const willUpdate = l.update_master_purchase_price !== false;
                  return (
                    <div className="relative w-full h-full flex flex-col">
                      <input type="number" step="any" value={l.unit_cost} disabled={isLocked} data-grid-cell data-row={i} data-col="unit_cost" onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))}
                        className={`w-full h-[32px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${costChanged ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`} />
                      {costChanged && (
                        <span className="text-[9px] text-center leading-none pb-0.5 flex items-center justify-center gap-0.5">
                          <span className="text-slate-400 number-fmt">{Number(l.original_unit_cost).toFixed(2)}</span>
                          <span className="text-slate-300">→</span>
                          <span className={`number-fmt ${Number(l.unit_cost) > Number(l.original_unit_cost) ? "text-rose-500" : "text-emerald-600"}`}>
                            {Number(l.unit_cost).toFixed(2)}
                          </span>
                          {!isLocked && (
                            <button
                              type="button"
                              title={willUpdate ? "يحدّث السعر الرئيسي — اضغط للإلغاء" : "للفاتورة فقط — اضغط للتحديث"}
                              onClick={() => updateLineField(i, "update_master_purchase_price", !willUpdate)}
                              className={`shrink-0 flex items-center justify-center w-3.5 h-3.5 rounded transition-colors ${
                                willUpdate ? "text-emerald-600 hover:text-emerald-800" : "text-amber-500 hover:text-amber-700"
                              }`}
                            >
                              <Lock size={8} className={willUpdate ? "" : "opacity-60"} />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  );
                } },
              {
                id: "selling_price", header: "سعر البيع", width: 110, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const changed = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0 && Number(l.original_sale_price) > 0;
                  const minMargin = printSettings?.min_margin_percent ?? 15;
                  const cost = Number(l.unit_cost) || 0;
                  const price = Number(l.selling_price) || 0;
                  const marginPct = cost > 0 && price > 0 ? ((price - cost) / cost) * 100 : null;
                  const belowMargin = marginPct != null && marginPct < minMargin;
                  const willUpdate = l.update_master_sale_price !== false;
                  return (
                    <div className="relative w-full h-full flex flex-col">
                      <input type="number" step="any" value={l.selling_price} disabled={isLocked} data-grid-cell data-row={i} data-col="selling_price" onChange={(e) => updateLineField(i, "selling_price", Number(e.target.value))}
                        className={`w-full h-[32px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${belowMargin ? "bg-rose-50 text-rose-800" : changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50"}`} />
                      {changed && !belowMargin && (
                        <span className="text-[9px] text-center leading-none pb-0.5 flex items-center justify-center gap-0.5">
                          <span className="text-slate-400 number-fmt">{Number(l.original_sale_price).toFixed(2)}</span>
                          <span className="text-slate-300">→</span>
                          <span className={`number-fmt ${Number(l.selling_price) > Number(l.original_sale_price) ? "text-rose-500" : "text-emerald-600"}`}>
                            {Number(l.selling_price).toFixed(2)}
                          </span>
                          {!isLocked && (
                            <button
                              type="button"
                              title={willUpdate ? "يحدّث سعر البيع الرئيسي — اضغط للإلغاء" : "للفاتورة فقط — اضغط للتحديث"}
                              onClick={() => updateLineField(i, "update_master_sale_price", !willUpdate)}
                              className={`shrink-0 flex items-center justify-center w-3.5 h-3.5 rounded transition-colors ${
                                willUpdate ? "text-emerald-600 hover:text-emerald-800" : "text-amber-500 hover:text-amber-700"
                              }`}
                            >
                              <Lock size={8} className={willUpdate ? "" : "opacity-60"} />
                            </button>
                          )}
                        </span>
                      )}
                      {belowMargin && <span className="text-[9px] font-black text-rose-500 text-center leading-none pb-0.5">هامش {marginPct.toFixed(0)}%</span>}
                    </div>
                  );
                }
              },
              {
                id: "profit_pct", header: "الربح", width: 90, sortable: false, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l, i) => {
                  const cost = Number(l.unit_cost) || 0;
                  const price = Number(l.selling_price) || 0;
                  const profitFlat = price - cost;
                  const pct = cost > 0 ? (profitFlat / cost) * 100 : 0;
                  const isProfit = profitFlat >= 0;
                  return (
                    <div className="relative w-full h-full flex items-center justify-center gap-1">
                      <span className={`text-2sm number-fmt ${isProfit ? "text-emerald-700" : "text-rose-600"}`}>
                        {profitDisplayMode === "pct"
                          ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
                          : `${profitFlat >= 0 ? "+" : ""}${profitFlat.toFixed(2)}`}
                      </span>
                      <button
                        onClick={() => setProfitDisplayMode(m => m === "pct" ? "flat" : "pct")}
                        title={profitDisplayMode === "pct" ? "نسبة مئوية — اضغط للتبديل إلى القيمة الثابتة" : "قيمة ثابتة — اضغط للتبديل إلى النسبة المئوية"}
                        className={`shrink-0 h-5 px-1.5 flex items-center justify-center rounded-sm text-[9px] font-black border transition-all ${
                          profitDisplayMode === "pct"
                            ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                        }`}>
                        {profitDisplayMode === "pct" ? "%" : "قيمة"}
                      </button>
                    </div>
                  );
                }
              },
              {
                id: "wholesale_price", header: "جملة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const changed = Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0 && Number(l.original_wholesale_price) > 0;
                  const willUpdate = l.update_master_wholesale_price !== false;
                  return (
                    <div className="relative w-full h-full flex flex-col">
                      <input type="number" step="any" value={l.wholesale_price ?? 0} disabled={isLocked}
                        onChange={(e) => updateLineField(i, "wholesale_price", Number(e.target.value))}
                        className={`w-full h-[32px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`} />
                      {changed && (
                        <span className="text-[9px] text-center leading-none pb-0.5 flex items-center justify-center gap-0.5">
                          <span className="text-slate-400 number-fmt">{Number(l.original_wholesale_price).toFixed(2)}</span>
                          <span className="text-slate-300">→</span>
                          <span className={`number-fmt ${Number(l.wholesale_price) > Number(l.original_wholesale_price) ? "text-rose-500" : "text-emerald-600"}`}>
                            {Number(l.wholesale_price).toFixed(2)}
                          </span>
                          {!isLocked && (
                            <button
                              type="button"
                              title={willUpdate ? "يحدّث سعر الجملة الرئيسي — اضغط للإلغاء" : "للفاتورة فقط — اضغط للتحديث"}
                              onClick={() => updateLineField(i, "update_master_wholesale_price", !willUpdate)}
                              className={`shrink-0 flex items-center justify-center w-3.5 h-3.5 rounded transition-colors ${
                                willUpdate ? "text-emerald-600 hover:text-emerald-800" : "text-amber-500 hover:text-amber-700"
                              }`}
                            >
                              <Lock size={8} className={willUpdate ? "" : "opacity-60"} />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  );
                }
              },
              {
                id: "locks", header: "تحديث السعر", width: 110, sortable: false, headerClass: "text-center px-1 text-[10px]", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  if (isLocked) return null;
                  const costChanged = Number(l.unit_cost) !== Number(l.original_unit_cost) && Number(l.unit_cost) > 0 && Number(l.original_unit_cost) > 0;
                  const saleChanged = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0 && Number(l.original_sale_price) > 0;
                  const whslChanged = Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0 && Number(l.original_wholesale_price) > 0;
                  if (!costChanged && !saleChanged && !whslChanged) return <div className="h-[40px]" />;
                  return (
                    <div className="flex flex-col gap-0.5 py-0.5 px-1">
                      {[
                        costChanged && { key: "update_master_purchase_price", label: "تكلفة", active: l.update_master_purchase_price !== false },
                        saleChanged && { key: "update_master_sale_price",     label: "بيع",   active: l.update_master_sale_price !== false },
                        whslChanged && { key: "update_master_wholesale_price", label: "جملة",  active: l.update_master_wholesale_price !== false },
                      ].filter(Boolean).map(({ key, label, active }) => (
                        <button key={key} type="button"
                          title={active ? `${label}: هيتحدّث سعر بطاقة الصنف — اضغط عشان متغيرش` : `${label}: للفاتورة دي بس — اضغط عشان تحدّث بطاقة الصنف`}
                          onClick={() => updateLineField(i, key, !active)}
                          className={`flex items-center justify-between gap-1 w-full px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                            active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                   : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          }`}
                        >
                          <span>{label}</span>
                          <span className="shrink-0">{active ? "يحدّث" : "فاتورة"}</span>
                        </button>
                      ))}
                    </div>
                  );
                }
              },
              { id: "warehouse_id", header: "المخزن", width: 130, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l, i) => {
                  const whStock = stockLevels[l.item_id] || {};
                  const hasStockInSelected = l.warehouse_id ? (whStock[l.warehouse_id] || 0) > 0 : false;
                  return (
                    <div className="relative w-full">
                      <select value={l.warehouse_id} disabled={isLocked} onChange={(e) => updateLineField(i, "warehouse_id", e.target.value)}
                        className={`w-full h-[40px] text-[11px] font-bold outline-none border-0 ring-0 text-center truncate transition-colors cursor-pointer ${
                          isLocked ? "bg-transparent text-slate-500 cursor-not-allowed" :
                          !hasStockInSelected && l.warehouse_id ? "bg-rose-50 text-rose-700" : "bg-transparent text-slate-700 focus:bg-indigo-50"
                        }`}>
                        {warehouses.map(w => {
                          const sqty = whStock[w.id] || 0;
                          return <option key={w.id} value={w.id}>{w.name} ({sqty})</option>;
                        })}
                      </select>
                      {!isLocked && (
                        <ChevronDown className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                      )}
                      {!hasStockInSelected && l.warehouse_id && !isLocked && (
                        <div className="absolute bottom-0 left-0 right-0 text-[8px] font-black text-rose-500 text-center leading-none pb-0.5">
                          المخزن فارغ
                        </div>
                      )}
                    </div>
                  );
                } },
              { id: "expiry_date", header: "انتهاء", width: 125, sortable: false, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  if (!l.track_expiry) return <div className="h-[40px] flex items-center justify-center text-slate-200 text-[10px] select-none">—</div>;
                  return (
                    <input type="date" value={l.expiry_date || ""} disabled={isLocked}
                      onChange={(e) => updateLineField(i, "expiry_date", e.target.value)}
                      className="w-full h-[40px] text-[11px] font-mono font-bold text-center bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-blue-50 text-slate-700 disabled:cursor-not-allowed"
                    />
                  );
                }
              },
              { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-center px-2", cellClass: "text-center px-2 number-fmt-primary text-sm text-slate-900 bg-slate-50/50 border-l border-slate-100",
                render: (l) => formatNumber(l.total) },
              { id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center",
                render: (_, i) => !isLocked && <button onClick={() => removeLine(i)} className="inline-flex h-[40px] w-full items-center justify-center text-slate-400 opacity-60 hover:bg-slate-100 hover:text-rose-500 hover:opacity-100 transition-colors focus:outline-none"><X className="h-4 w-4" /></button> },
            ].filter(c => c.id === "index" || c.id === "actions" || visibleColumns.includes(c.id))}
          />
          </div>

          {priceChangedLines.length > 0 && !isLocked && (
            <div className="flex items-center gap-2.5 bg-amber-50 px-4 py-2 text-[11px] font-bold text-amber-700 shrink-0 mt-2 border border-amber-200 rounded-md">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>سيتم تحديث أسعار <strong>{priceChangedLines.length}</strong> صنف عند الحفظ</span>
              <button
                onClick={() => setPriceReportOpen(true)}
                className="mr-auto flex items-center gap-1 text-amber-600 hover:text-amber-800 underline underline-offset-2 transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> تفاصيل التغييرات
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel} onResizeStart={(e) => startPanelResize(e, "right")} panelSide="right" />
        <aside className={`shrink-0 flex flex-col gap-3 overflow-y-auto p-3 ${panelEffectiveCollapsed ? "hidden" : ""}`} style={{ width: panelWidth, minWidth: panelWidth, background: "var(--bg-sidebar)" }}>
          {/* Supplier section — search + details + balance all in one card */}
          <div className="relative z-20 rounded-md border border-slate-300 bg-white shadow-sm shrink-0">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100 rounded-t-md">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> المورد
              </h3>
              {supplier && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSupplierInfoOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-700 transition-colors">
                    <ExternalLink className="h-3 w-3" /> بيانات
                  </button>
                  <Link to={`/suppliers/${supplier.id}`} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700">
                    <ExternalLink className="h-3 w-3" /> السجل
                  </Link>
                </div>
              )}
            </div>

            {/* Search input — always visible */}
            <div className="p-3 border-b border-slate-100" data-help="supplier-select">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierQuery}
                    onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); setSupplier(null); }}
                    onFocus={() => !isLocked && setSupplierLookupOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                    placeholder={supplier ? supplier.name : "ابحث عن مورد..."}
                    disabled={isLocked}
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                    className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-9 text-2sm font-bold outline-none focus:border-[var(--primary)] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {supplierLookupOpen && !isLocked && (
                    <SearchDropdown items={filteredSuppliers} onPick={handlePickSupplier} activeIndex={activeSupplierIndex} emptyLabel="لم يتم العثور على مورد" />
                  )}
                </div>
                <button onClick={() => setSupplierModalOpen(true)}
                  disabled={isLocked}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {(paymentMode === "credit" || paymentMode === "future_due") && !supplier && !isLocked && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> مطلوب لطريقة الدفع المختارة
                </p>
              )}
            </div>

            {/* Supplier info + balance (when supplier selected) */}
            {supplier ? (
              <div className="p-3 space-y-2.5">
                {/* Identity: avatar + name + code */}
                <div className="flex items-start gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white text-base font-black">{supplier.name?.[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{supplier.name}</p>
                    {supplier.code && (
                      <span className="inline-block mt-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{supplier.code}</span>
                    )}
                  </div>
                </div>

                {/* Contact info: phones + addresses */}
                {(() => {
                  const phones = [supplier.phone, ...parseJsonArr(supplier.additional_phones)].filter(Boolean);
                  const addresses = parseJsonArr(supplier.addresses);
                  if (phones.length === 0 && addresses.length === 0) return null;
                  return (
                    <div className="space-y-1 rounded-md bg-slate-50/70 border border-slate-100 px-3 py-2">
                      {phones.map((p, i) => (
                        <div key={`ph${i}`} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                          <Phone className={`h-3 w-3 shrink-0 ${i === 0 ? "text-orange-400" : "text-slate-300"}`} />
                          <span dir="ltr" className="font-mono">{p}</span>
                        </div>
                      ))}
                      {addresses.map((a, i) => (
                        <div key={`ad${i}`} className="flex items-start gap-1.5 text-[11px] font-medium text-slate-600">
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" />
                          <span className="leading-snug">{a}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Balance: standing status + invoice impact */}
                {(() => {
                  const isSameEditSupplier = isEditMode && supplier?.id === editOriginalSupplierId;
                  const dispBal = Number(supplier.opening_balance || 0) - (isSameEditSupplier ? editDebtRemaining : 0);
                  const isCreditMode = paymentMode === "credit" || paymentMode === "future_due";
                  const isMultiMode = paymentMode === "multi";
                  const balanceDelta = isCreditMode ? totals.total : (isMultiMode ? multiCreditAmount : 0);
                  const newBal = dispBal + balanceDelta;
                  const hasLines = lines.length > 0;
                  const balChange = balanceDelta;
                  return (
                    <>
                      <div className={`flex items-center justify-between rounded-md px-3 py-2 border ${dispBal > 0 ? "bg-rose-50 border-rose-200" : dispBal < 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                        <span className={`text-[10px] font-black uppercase tracking-wide ${dispBal > 0 ? "text-rose-500" : dispBal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {isEditMode ? "الرصيد قبل التعديل" : dispBal > 0 ? "عليه رصيد" : dispBal < 0 ? "له رصيد" : "مسوّى"}
                        </span>
                        <span className={`text-sm number-fmt-primary ${dispBal > 0 ? "text-rose-600" : dispBal < 0 ? "text-emerald-600" : "text-slate-400"}`}>{Math.abs(dispBal).toFixed(2)}</span>
                      </div>
                      {hasLines && balChange !== 0 && (
                        <div className="flex items-center justify-between rounded-sm bg-indigo-50 border border-indigo-200 px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-indigo-600">التغير</span>
                            <span className={`text-[9px] number-fmt px-1 py-0.5 rounded-sm ${balChange > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {balChange > 0 ? "↑" : "↓"}
                            </span>
                          </div>
                          <span className={`text-2sm number-fmt ${balChange > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {balChange > 0 ? "+" : ""}{balChange.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {hasLines && (
                        <div className="flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-3 py-1.5">
                          <span className="text-[11px] font-bold text-amber-600">الرصيد بعد الفاتورة</span>
                          <span className={`text-sm number-fmt-primary ${newBal > 0 ? "text-rose-600" : "text-emerald-600"}`}>{newBal.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="px-4 py-5 text-center">
                <Building2 className="h-7 w-7 mx-auto text-slate-200 mb-1.5" />
                <p className="text-[11px] font-medium text-slate-400">
                  {(paymentMode === "credit" || paymentMode === "future_due")
                    ? "الرجاء اختيار مورد"
                    : "اختياري للدفع النقدي"}
                </p>
              </div>
            )}
          </div>

          {/* Notes section */}
          <div className="rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden shrink-0">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> ملاحظات
              </h3>
              {Boolean(purchaseNotes && purchaseNotes.trim()) && <span className="h-2 w-2 rounded-full bg-amber-400" title="توجد ملاحظة" />}
            </div>
            <div className="p-3">
              <textarea
                ref={notesRef}
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                placeholder="ملاحظة اختيارية تُحفظ مع الفاتورة…"
                rows={3}
                disabled={isLocked}
                style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                className="w-full resize-none border border-slate-300 rounded-sm py-2 px-3 text-2sm font-medium outline-none focus:border-[var(--primary)] leading-relaxed placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); itemInputRef.current?.focus(); } }}
              />
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100">ملخص الفاتورة</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-2sm font-bold text-slate-500">إجمالي الأصناف</span>
                <span className="text-2sm font-black text-slate-800">{lines.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2sm font-bold text-slate-500">مجموع الكميات</span>
                <span className="text-2sm font-black text-slate-800">{lines.reduce((acc, l) => acc + Number(l.quantity), 0)}</span>
              </div>
              <div className="h-px bg-slate-100" />
              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-2sm font-bold text-slate-500">الإجمالي الفرعي</span>
                <span className="text-sm number-fmt-primary text-slate-800">{formatNumber(totals.sub)}</span>
              </div>
              {/* Discount */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600">خصم الفاتورة</span>
                <span className="text-2sm number-fmt text-rose-600">{discount > 0 ? `-${discount.toFixed(2)}` : "0"}</span>
              </div>
              {/* Increase */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600">إضافة / رسوم</span>
                <span className="text-2sm number-fmt text-blue-600">{increase > 0 ? `+${increase.toFixed(2)}` : "0"}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="mt-3 rounded-sm bg-[var(--primary-700)] p-4 text-center text-white">
                <div className="text-[11px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                <div className="text-[26px] number-fmt-primary tracking-tighter">
                  {formatNumber(totals.total)}
                </div>
                <div className="text-[11px] opacity-40">ج.م</div>
              </div>
            </div>
          </div>

          {/* Discounts & Additions Section */}
          {!isLocked && (
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100">خصومات و إضافات</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> خصم الفاتورة
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0"
                      value={invoiceDiscountMode === "pct"
                        ? (totals.sub > 0 ? parseFloat(((discount / totals.sub) * 100).toFixed(2)) : 0)
                        : discount}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        if (invoiceDiscountMode === "pct") {
                          setDiscount(Math.min(parseFloat(((v / 100) * totals.sub).toFixed(4)), totals.sub));
                        } else {
                          setDiscount(Math.min(v, totals.sub));
                        }
                      }}
                      className="flex-1 min-w-0 rounded-sm border border-rose-200 bg-rose-50/50 px-3 py-2 text-sm font-black text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-center transition-all"
                    />
                    <button type="button"
                      onClick={() => setInvoiceDiscountMode((m) => m === "pct" ? "flat" : "pct")}
                      title={invoiceDiscountMode === "pct" ? "تغيير إلى قيمة ثابتة" : "تغيير إلى نسبة مئوية"}
                      className={`h-[38px] px-3 rounded-sm text-2sm font-black border transition-all shrink-0 ${invoiceDiscountMode === "pct" ? "bg-rose-100 border-rose-300 text-rose-700 shadow-sm" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                      {invoiceDiscountMode === "pct" ? "%" : "ج"}
                    </button>
                  </div>
                  {discount > 0 && invoiceDiscountMode === "flat" && totals.sub > 0 && (
                    <span className="text-[11px] number-fmt text-rose-400 px-1">{((discount / totals.sub) * 100).toFixed(1)}% من الإجمالي</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> إضافة / رسوم
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0"
                      value={invoiceIncreaseMode === "pct"
                        ? (totals.sub > 0 ? parseFloat(((increase / totals.sub) * 100).toFixed(2)) : 0)
                        : increase}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        if (invoiceIncreaseMode === "pct") {
                          setIncrease(parseFloat(((v / 100) * totals.sub).toFixed(4)));
                        } else {
                          setIncrease(v);
                        }
                      }}
                      className="flex-1 min-w-0 rounded-sm border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-black text-blue-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-center transition-all"
                    />
                    <button type="button"
                      onClick={() => setInvoiceIncreaseMode((m) => m === "pct" ? "flat" : "pct")}
                      title={invoiceIncreaseMode === "pct" ? "تغيير إلى قيمة ثابتة" : "تغيير إلى نسبة مئوية"}
                      className={`h-[38px] px-3 rounded-sm text-2sm font-black border transition-all shrink-0 ${invoiceIncreaseMode === "pct" ? "bg-blue-100 border-blue-300 text-blue-700 shadow-sm" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                      {invoiceIncreaseMode === "pct" ? "%" : "ج"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          {isLocked ? (
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>
              {paymentMode === "cash" && (
                <div className="flex items-center gap-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-white"><Banknote className="h-4 w-4" /></div>
                  <span className="text-2sm font-black text-slate-700">نقدي</span>
                </div>
              )}
              {paymentMode === "multi" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-sm border border-[var(--primary-100)] bg-[var(--primary-50)] p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--primary)] text-white"><Layers className="h-4 w-4" /></div>
                    <span className="text-2sm font-black text-[var(--primary-600)]">متعدد</span>
                  </div>
                  {paymentMethods.filter(m => Number(multiAmounts[m.id] || 0) > 0).map(m => (
                    <div key={m.id} className="flex items-center justify-between rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-2sm font-bold text-slate-600">{m.name}</span>
                      <span className="number-fmt-primary text-2sm text-slate-800">{formatMoney(Number(multiAmounts[m.id] || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
              {["credit", "future_due"].includes(paymentMode) && (
                <div className="flex items-center gap-3 rounded-sm border border-amber-200 bg-amber-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-amber-500 text-white"><Wallet className="h-4 w-4" /></div>
                  <div className="flex items-center gap-2">
                    <span className="text-2sm font-black text-amber-700">{SUPPLIER_METHODS.find(m => m.id === paymentMode)?.label || paymentMode}</span>
                    {paymentMode === "credit" && <span className="text-2sm font-black text-amber-600">+{formatMoney(creditEffect)}</span>}
                  </div>
                </div>
              )}
              {supplier && creditEffect > 0 && lines.length > 0 && (
                <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-700">الإضافة لرصيد {supplier.name}</span>
                    <span className="number-fmt-primary text-amber-700">+{formatMoney(creditEffect)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] border-t border-amber-200/70 pt-1.5">
                    <span className="font-bold text-slate-600">الرصيد بعد الفاتورة</span>
                    <span className="number-fmt-primary text-amber-600">{formatMoney(supplierBalanceAfter)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div data-help="payment-section" className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>

            <button onClick={() => handleSelectPayment("cash")}
              className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all mb-2 ${paymentMode === "cash" ? "border-slate-800 bg-slate-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${paymentMode === "cash" ? "bg-slate-800" : "bg-slate-200"}`}><Banknote className="h-4 w-4" /></div>
              <div className="flex-1 flex flex-col text-right">
                <span className={`text-2sm font-black ${paymentMode === "cash" ? "text-slate-800" : "text-slate-700"}`}>نقدي</span>
                <span className="text-[11px] text-slate-400">سداد فوري — خصم من الخزينة</span>
              </div>
              {paymentMode === "cash" && <div className="h-2 w-2 rounded-full bg-slate-800 shrink-0" />}
            </button>

            <button onClick={() => handleSelectPayment("multi")}
              className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all mb-2 ${paymentMode === "multi" ? "border-[var(--primary)] bg-[var(--primary-50)] shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${paymentMode === "multi" ? "bg-[var(--primary)]" : "bg-slate-200"}`}><Layers className="h-4 w-4" /></div>
              <div className="flex-1 flex flex-col text-right">
                <span className={`text-2sm font-black ${paymentMode === "multi" ? "text-[var(--primary-600)]" : "text-slate-700"}`}>متعدد (100% مطلوب)</span>
                <span className="text-[11px] text-slate-400">توزيع على عدة وسائل دفع</span>
              </div>
              {paymentMode === "multi" && <div className="h-2 w-2 rounded-full bg-[var(--primary)] shrink-0" />}
            </button>

            {SUPPLIER_METHODS.map(m => {
              const isSelected = paymentMode === m.id;
              const isDisabled = m.requiresSupplier && !supplier;
              const colors = COLOR_MAP[m.color];
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={() => handleSelectPayment(m.id)} disabled={isDisabled}
                  title={isDisabled ? "يجب اختيار مورد أولاً" : undefined}
                  className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all mb-2 last:mb-0 ${
                    isSelected ? `${colors.border} ${colors.light} shadow-sm` : isDisabled ? "border-slate-200 opacity-40 cursor-not-allowed" : "border-slate-200 hover:bg-slate-50"
                  }`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${isSelected ? colors.bg : "bg-slate-200"}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 flex flex-col text-right">
                    <span className={`text-2sm font-black ${isSelected ? colors.text : "text-slate-700"}`}>{m.label}</span>
                    <span className={`text-[11px] ${isSelected ? colors.text : "text-slate-400"} opacity-80`}>{m.sub}</span>
                  </div>
                  {isSelected && <div className={`h-2 w-2 rounded-full ${colors.bg} shrink-0`} />}
                </button>
              );
            })}

            {paymentMode === "multi" && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="rounded-sm bg-slate-950 px-3 py-2 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">المطلوب توزيعه</p>
                  <p className="number-fmt-primary text-[16px] text-white">{formatNumber(totals.total)}</p>
                </div>
                {paymentMethods.map(m => {
                  const amount = multiAmounts[m.id] || "";
                  const isCreditMethod = m.type === "credit" || m.category === "credit";
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-slate-50 text-slate-500 shrink-0">
                        {m.type === "cash" ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                      </div>
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-700 leading-snug break-words">{m.name}</span>
                      <input type="number" value={amount} placeholder="0.00" min="0" step="0.01" disabled={isLocked || (isCreditMethod && !supplier)}
                        onChange={(e) => setMultiAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        className="w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left number-fmt-primary text-2sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all" />
                    </div>
                  );
                })}
                {paymentMethods.length === 0 && (
                  <p className="text-[11px] font-bold text-slate-400 text-center py-2">
                    لا توجد وسائل دفع — <Link to="/operations/payment-methods" className="text-slate-600 underline">أضف وسائل دفع</Link>
                  </p>
                )}
                <div className={`flex items-center justify-between rounded-sm px-3 py-2 text-2sm font-black ${multiBalanced ? "bg-[var(--primary-50)] text-[var(--primary-600)] border border-[var(--primary-100)]" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
                  <span>الموزع:</span>
                  <span className="number-fmt">{formatNumber(multiTotal)}</span>
                </div>
                {!multiBalanced && totals.total > 0 && (
                  <div className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    الفرق: {Math.abs(totals.total - multiTotal).toFixed(2)} ج.م
                  </div>
                )}
              </div>
            )}

            {/* Live supplier-balance preview (credit + multi credit portion) — POS parity */}
            {supplier && creditEffect > 0 && lines.length > 0 && (
              <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-700">
                    {paymentMode === "multi" ? "الإضافة للآجل" : `الإضافة لرصيد ${supplier.name}`}
                  </span>
                  <span className="number-fmt-primary text-amber-700">+{formatMoney(creditEffect)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] border-t border-amber-200/70 pt-1.5">
                  <span className="font-bold text-slate-600">الرصيد بعد الفاتورة</span>
                  <span className={`number-fmt-primary ${supplierBalanceAfter > 0.005 ? "text-rose-600" : "text-[var(--primary)]"}`}>
                    {formatMoney(supplierBalanceAfter)}
                  </span>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Bottom Action Buttons */}
          {!isLocked && (
            <div data-help="purchases-save-area" className="rounded-md border border-slate-300 bg-white p-3 shadow-sm flex flex-col gap-2">
              <PermissionGate page="purchases" action={isEditMode || isAmendMode ? "edit" : "add"}>
                <button onClick={() => { if (validateBeforeSave()) { if (priceChangedLines.length > 0) setPriceReportOpen(true); else setSaveConfirmOpen(true); } }} disabled={isSaving || !lines.length || (isEditMode && !isAmendMode && !isEditDirty)}
                  className="w-full flex items-center justify-center gap-2 rounded-sm bg-[var(--primary)] px-3 py-3 text-sm font-black text-white hover:bg-[var(--primary-600)] transition-all disabled:opacity-40 shadow-sm active:scale-[0.98]">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isAmendMode ? <><Save className="h-4 w-4" /> إصدار تعديل</> : isEditMode ? <><Save className="h-4 w-4" /> حفظ التعديلات</> : <><Save className="h-4 w-4" /> حفظ الفاتورة</>}
                  {!isSaving && <ShortcutKbd id="form.save" className="ms-1 rounded bg-white/20 px-1 text-[9px] font-mono text-white" />}
                </button>
              </PermissionGate>
              <div className="grid grid-cols-3 gap-2">
                <PermissionGate page="purchases" action="print">
                  <button onClick={() => setPrintPreview(true)} disabled={!lines.length}
                    className="flex items-center justify-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600 hover:border-[var(--primary-100)] hover:bg-slate-50 transition-all disabled:opacity-40">
                    <Printer className="h-3.5 w-3.5" /> طباعة
                  </button>
                </PermissionGate>
                <PermissionGate page="purchases" action="delete">
                  <button onClick={() => setDeleteConfirmOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-sm border border-rose-200 bg-white px-2 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-all">
                    <Trash2 className="h-3.5 w-3.5" /> {isEditMode ? "حذف" : "مسح"}
                  </button>
                </PermissionGate>
                <button onClick={() => setNewInvoiceModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600 hover:border-[var(--primary-100)] hover:bg-[var(--primary-50)] transition-all">
                  <FilePlus className="h-3.5 w-3.5" /> جديدة
                </button>
              </div>
            </div>
           )}
               <div className="flex-1" />
         </aside>
       </div>

      <PurchaseFormBottomBar
        forceShow={panelEffectiveCollapsed}
        lines={lines}
        totals={totals}
        discount={discount}
        increase={increase}
        onDiscountChange={setDiscount}
        onIncreaseChange={setIncrease}
        paymentMode={paymentMode}
        onPaymentModeChange={handleSelectPayment}
        bankRef={bankRef}
        onBankRefChange={setBankRef}
        paymentMethods={paymentMethods}
        multiAmounts={multiAmounts}
        onMultiAmountsChange={setMultiAmounts}
        isLocked={locked}
        isSaving={isSaving}
        onPrint={() => setPrintPreview(true)}
        onSave={() => { if (validateBeforeSave()) { if (priceChangedLines.length > 0) setPriceReportOpen(true); else setSaveConfirmOpen(true); } }}
        isEditMode={isEditMode}
        isAmendMode={isAmendMode}
        isEditDirty={isEditDirty}
        canSave={lines.length > 0 && !(isEditMode && !isAmendMode && !isEditDirty)}
        supplier={supplier}
        supplierQuery={supplierQuery}
        onSupplierQueryChange={(val) => { setSupplierQuery(val); setSupplierLookupOpen(true); setSupplier(null); }}
        filteredSuppliers={filteredSuppliers}
        supplierLookupOpen={supplierLookupOpen}
        onSupplierLookupToggle={setSupplierLookupOpen}
        activeSupplierIndex={activeSupplierIndex}
        onPickSupplier={handlePickSupplier}
        onAddSupplier={() => setSupplierModalOpen(true)}
        multiTotal={multiTotal}
        multiBalanced={multiBalanced}
        creditEffect={creditEffect}
        supplierBalanceAfter={supplierBalanceAfter}
      />

      <AddSupplierModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onCreated={(supplier) => { setSuppliers(prev => [supplier, ...prev]); handlePickSupplier(supplier); }}
      />

      <SupplierInfoModal
        open={supplierInfoOpen}
        supplierId={supplier?.id}
        onClose={() => setSupplierInfoOpen(false)}
        onUpdated={(updated) => { setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s)); setSupplier(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev); }}
      />

      <AdvancedSearchModal
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
      />

      {/* Image Preview Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="معاينة صورة الصنف" showDetach={false}>
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-lg border border-slate-100">
          {imagePreviewUrl ? (
            <img src={imagePreviewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain rounded-md shadow-sm border border-slate-200 bg-white" />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="font-bold">الصورة غير متوفرة</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Price Update Report Modal */}
      <Modal open={priceReportOpen} onClose={() => setPriceReportOpen(false)} title="تقرير تحديث الأسعار" maxWidth={priceReportWholesaleUsed ? "max-w-4xl" : "max-w-3xl"} showDetach={false}>
        <div className="p-4 space-y-4 animate-modal-enter">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-2sm font-bold text-amber-700 leading-relaxed">
              سيتم تحديث الأسعار التالية عند حفظ الفاتورة. راجع التغييرات قبل المتابعة.
            </p>
          </div>
          {/* Badge legend */}
          <div className="flex items-center gap-4 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">دلالة الألوان:</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">يحدّث</span>
              <span className="text-[10px] text-slate-500">السعر الجديد هيتغير لكل الفواتير الجاية</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">فاتورة بس</span>
              <span className="text-[10px] text-slate-500">للفاتورة دي بس، السعر الأساسي ما يتغيرش</span>
            </span>
          </div>
          <div className="rounded-md border border-slate-200 overflow-x-auto">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-right font-black text-slate-500 min-w-[180px]">الصنف</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500 whitespace-nowrap">التكلفة (قبل)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500 whitespace-nowrap">التكلفة (بعد)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500 whitespace-nowrap">سعر البيع (قبل)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500 whitespace-nowrap">سعر البيع (بعد)</th>
                  {priceReportWholesaleUsed && (
                    <>
                      <th className="px-3 py-2 text-center font-black text-slate-500 whitespace-nowrap">جملة (قبل)</th>
                      <th className="px-3 py-2 text-center font-black text-slate-500 whitespace-nowrap">جملة (بعد)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {priceChangedLines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-3 py-2 font-bold text-slate-800 whitespace-normal break-words">{l.name}</td>
                    <td className="px-3 py-2 text-center number-fmt text-slate-400 whitespace-nowrap">{Number(l.original_unit_cost) > 0 ? Number(l.original_unit_cost).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center number-fmt whitespace-nowrap">
                      {Number(l.unit_cost) > 0 && Number(l.unit_cost) !== Number(l.original_unit_cost) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={Number(l.unit_cost) > Number(l.original_unit_cost) ? "text-rose-600" : "text-emerald-600"}>
                            {Number(l.unit_cost).toFixed(2)}
                          </span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                            l.update_master_purchase_price !== false
                              ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {l.update_master_purchase_price !== false ? "يحدّث" : "فاتورة بس"}
                          </span>
                        </div>
                      ) : <span className="text-slate-400">{Number(l.unit_cost) > 0 ? Number(l.unit_cost).toFixed(2) : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 text-center number-fmt text-slate-400 whitespace-nowrap">{Number(l.original_sale_price) > 0 ? Number(l.original_sale_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center number-fmt whitespace-nowrap">
                      {Number(l.selling_price) > 0 && Number(l.selling_price) !== Number(l.original_sale_price) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={Number(l.selling_price) > Number(l.original_sale_price) ? "text-rose-600" : "text-emerald-600"}>
                            {Number(l.selling_price).toFixed(2)}
                          </span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                            l.update_master_sale_price !== false
                              ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {l.update_master_sale_price !== false ? "يحدّث" : "فاتورة بس"}
                          </span>
                        </div>
                      ) : <span className="text-slate-400">{Number(l.selling_price) > 0 ? Number(l.selling_price).toFixed(2) : "—"}</span>}
                    </td>
                    {priceReportWholesaleUsed && (
                      <>
                        <td className="px-3 py-2 text-center number-fmt text-slate-400 whitespace-nowrap">{Number(l.original_wholesale_price) > 0 ? Number(l.original_wholesale_price).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-center number-fmt whitespace-nowrap">
                          {Number(l.wholesale_price) > 0 && Number(l.wholesale_price) !== Number(l.original_wholesale_price) ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={Number(l.wholesale_price) > Number(l.original_wholesale_price) ? "text-rose-600" : "text-emerald-600"}>
                                {Number(l.wholesale_price).toFixed(2)}
                              </span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                                l.update_master_wholesale_price !== false
                                  ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                {l.update_master_wholesale_price !== false ? "يحدّث" : "فاتورة بس"}
                              </span>
                            </div>
                          ) : <span className="text-slate-400">{Number(l.wholesale_price) > 0 ? Number(l.wholesale_price).toFixed(2) : "—"}</span>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setPriceReportOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : "تأكيد وحفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Save Confirmation Modal */}
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title={isEditMode ? "تأكيد تعديل الفاتورة" : "تأكيد حفظ الفاتورة"} showDetach={false}>
        <div className="p-4 space-y-4 animate-modal-enter">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">
                {isEditMode ? "هل تريد حفظ التعديلات؟" : "هل تريد حفظ هذه الفاتورة؟"}
              </h3>
              <p className="text-2sm font-bold text-slate-500 leading-relaxed">
                {isEditMode
                  ? "سيتم تحديث المخزون والأرصدة المالية بالفرق فقط."
                  : `${lines.length} صنف — إجمالي ${formatNumber(totals.total)} ج.م`}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setSaveConfirmOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : "نعم، احفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Unlock Warning Modal */}
      <Modal open={editWarnOpen} onClose={() => setEditWarnOpen(false)} title="تحذير: تعديل فاتورة محفوظة" showDetach={false}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">تعديل فاتورة محفوظة</h3>
              <p className="text-2sm font-bold text-slate-500 leading-relaxed">
                أي تغيير ستقوم بحفظه سيؤثر على المخزون والأرصدة المالية. هل تريد المتابعة؟
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setEditWarnOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">تراجع</button>
            <button onClick={() => { setLocked(false); setEditWarnOpen(false); }} className="rounded-sm bg-indigo-600 px-5 py-2 text-sm font-black text-white hover:bg-indigo-700">
              نعم، فتح للتعديل
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={isEditMode ? "حذف الفاتورة" : "مسح الفاتورة"} showDetach={false}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">
                {isEditMode ? "هل تريد حذف هذه الفاتورة؟" : "هل تريد مسح الفاتورة الحالية؟"}
              </h3>
              <p className="text-2sm font-bold text-slate-500 leading-relaxed">
                {isEditMode
                  ? "سيتم عكس جميع تأثيرات المخزون والأرصدة. لا يمكن التراجع عن هذا."
                  : "سيتم مسح جميع الأصناف المدرجة والانتقال للقائمة."}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setDeleteConfirmOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">تراجع</button>
            <button onClick={doDelete} className="rounded-sm btn-danger px-5 py-2 text-sm font-black">
              {isEditMode ? "نعم، احذف الفاتورة" : "نعم، امسح"}
            </button>
          </div>
        </div>
      </Modal>

      {/* New Invoice Warning Modal */}
      <Modal open={newInvoiceModalOpen} onClose={() => setNewInvoiceModalOpen(false)} title="فاتورة جديدة" showDetach={false}>
        <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
          {lines.length > 0 ? (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-800">يوجد أصناف في الفاتورة الحالية</p>
                  <p className="text-2sm font-bold text-amber-700 mt-1">اختر كيف تريد المتابعة:</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    doSave();
                  }}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><Sparkles className="h-4 w-4" /> حفظ الحالية وإنشاء جديدة</>}
                </button>
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    clearForm();
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
                >
                  <Trash2 className="h-4 w-4" />
                  تجاهل وإنشاء جديدة
                </button>
                <button
                  onClick={() => setNewInvoiceModalOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  إلغاء
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <FilePlus className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-emerald-800">إنشاء فاتورة جديدة</p>
                  <p className="text-2sm font-bold text-emerald-700 mt-1">الفاتورة الحالية فارغة</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    clearForm();
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all active:scale-[0.98]"
                >
                  <FilePlus className="h-4 w-4" />
                  إنشاء فاتورة جديدة
                </button>
                <button
                  onClick={() => setNewInvoiceModalOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  إلغاء
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>



      <TodayPurchasesModal open={todayPurchOpen} onClose={() => setTodayPurchOpen(false)} />

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="purchase_order"
        invoice={{
          invoice_no: refNo,
          created_at: docDate,
          supplier_name: supplier?.name,
          customer_name: supplier?.name,
          cashier_name: user?.name || "",
          subtotal: totals.sub,
          total: totals.total,
          discount: discount,
          increase: increase,
          notes: purchaseNotes || "",
          lines: lines.map(l => ({
            ...l,
            item_name: l.name,
            quantity: l.quantity,
            unit_price: l.unit_cost,
            discount_amount: 0,
            code: l.code || "",
          })),
        }}
        settings={printSettings}
        operationLabel="فاتورة مشتريات"
        onConfirmPrint={() => doSave()}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={() => doSave()}
        saveOnlyLabel="حفظ فقط"
        onSendWhatsApp={() => setWaSendOpen(true)}
        isSaving={isSaving}
      />

      <UnsavedChangesModal
        open={showUnsavedModal}
        onStay={() => { setPendingNav(null); blocker.reset?.(); }}
        onLeave={() => {
          const path = pendingNav;
          setPendingNav(null);
          if (path) navigate(path);
          else blocker.proceed?.();
        }}
      />

      {waSendOpen && (
        <WhatsAppSendModal
          open={waSendOpen}
          onClose={() => setWaSendOpen(false)}
          kind="purchase_receipt"
          invoice={{
            invoice_no: refNo,
            supplier_name: supplier?.name,
            customer_name: supplier?.name,
            customer_phone: supplier?.phone,
            total: totals.total,
            discount: discount,
            increase: increase,
            lines: lines.map(l => ({
              ...l,
              item_name: l.name,
              quantity: l.quantity,
              unit_price: l.unit_cost,
              discount_amount: 0,
              code: l.code || "",
            })),
            created_by_username: user?.name || "",
            created_at: docDate,
            payment_type: paymentMode,
          }}
        />
      )}
    </div>
  );
}
