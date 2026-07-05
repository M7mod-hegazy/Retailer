import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeft, Package, ImageIcon,
  Trash2, Warehouse, FileText, Settings, Printer, CheckCircle, ShoppingCart, Plus, CalendarClock,
  ZoomIn, ZoomOut, Maximize, ChevronDown, Hash, Clock, Search, Layers,
  AlertTriangle, TrendingUp, Lock, Loader2, ExternalLink, CheckCircle2,
  Settings2, Info, X,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import DataGrid from "../../components/ui/DataGrid";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import SearchInput from "../../components/ui/SearchInput";
import ProductSearchField from "../../components/ui/ProductSearchField";
import CategorySearchField from "../../components/ui/CategorySearchField";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { sortByProximity } from "../../utils/itemSort";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import BranchTransferTodayModal from "../../components/operations/BranchTransferTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import useCollapsibleSidebar from "../../hooks/useCollapsibleSidebar";
import PanelEdgeRail from "../pos/parts/PanelEdgeRail";
import BranchTransferFormBottomBar from "./BranchTransferFormBottomBar";
import { formatNumber } from "../../utils/currency";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

function fmtDateTime(d) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(d);
}


export default function BranchTransferFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams();
  const isEditMode = Boolean(editId);

  // For new mode, type comes from query param; for edit mode, loaded from server
  const [type, setType] = useState(() =>
    searchParams.get("type") === "send" ? "send" : "receive"
  );

  const isReceive = type === "receive";
  const theme = isReceive
    ? { primary: "emerald", gradient: "from-emerald-500 to-teal-700", shadow: "shadow-emerald-500/20" }
    : { primary: "indigo", gradient: "from-indigo-600 to-blue-700", shadow: "shadow-indigo-500/20" };

  // Collapsible sidebar
  const sidebar = useCollapsibleSidebar({
    storageKeyPrefix: "retailer.branch-transfer",
    defaultWidth: 340,
    minWidth: 280,
  });
  const { panelWidth, panelEffectiveCollapsed, togglePanel, startPanelResize } = sidebar;

  const [storeSettings, setStoreSettings] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [branches, setBranches] = useState([]);
  // unit auto-detected from item — no dropdown
  const [stockLevels, setStockLevels] = useState({});
  const [partnerBranch, setPartnerBranch] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Draft ref number & datetime (shown once first item added)
  const [draftRef, setDraftRef] = useState("");
  const [draftTime, setDraftTime] = useState(null);
  const [refFetched, setRefFetched] = useState(false);

  // Edit mode: locked ref + original created_at
  const [lockedRef, setLockedRef] = useState("");
  const [lockedDate, setLockedDate] = useState(null);

  const ITEM_PAGE = 20;
  const [itemQuery, setItemQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);
  const [listCategoryFilter, setListCategoryFilter] = useState(null);
  const [listCategoryQuery, setListCategoryQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", unitId: "", warehouseId: "" });
  const [stagingLocks, setStagingLocks] = useState({ purchase: true, sale: true, wholesale: true });
  const [priceHelpOpen, setPriceHelpOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedDoc, setSavedDoc] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const wasSaved = useRef(false);
  const isDirty = lines.length > 0 && !wasSaved.current;
  const { blocker } = useUnsavedChangesGuard(isDirty);

  // Header modals
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  // Column visibility
  const ALL_COLUMNS = ["index","code","name","unit","warehouse","quantity","unit_cost","selling_price","profit_pct","wholesale_price","locks","total_cost","actions"];
  const DEFAULT_VISIBLE = ["index","code","name","unit","warehouse","quantity","unit_cost","selling_price","total_cost","actions"];
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer.branchTransfer.visibleColumns") || "null") || DEFAULT_VISIBLE; } catch { return DEFAULT_VISIBLE; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.branchTransfer.visibleColumns", JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns]);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleManageBranches = () => navigate("/definitions/branches");

  // Image preview modal
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const imgIsDragging = useRef(false);
  const imgLastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (imageModalOpen) { setImageZoom(1); setImagePan({ x: 0, y: 0 }); }
  }, [imageModalOpen]);

  // Keyboard navigation refs
  const itemInputRef      = useRef(null);
  const warehouseTableRef = useRef(null);
  // unitSelectRef removed — unit auto-detected
  const qtyInputRef       = useRef(null);
  const costInputRef      = useRef(null);
  const sellInputRef      = useRef(null);
  const wholesaleInputRef = useRef(null);
  const addBtnRef         = useRef(null);
  const partnerBranchRef  = useRef(null);
  const notesRef          = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);
  const searchAbortRef    = useRef(null); // AbortController for in-flight item searches
  const currentQueryRef   = useRef("");   // tracks the query that owns pendingPickRef

  const handleFieldKeyDown = useFieldNavigation();

  // Load master data
  useEffect(() => {
    api.get("/api/settings").then(r => setStoreSettings(r.data.data || {})).catch(() => {});
    api.get("/api/branches").then(r => setBranches(r.data.data || [])).catch(() => {});
    api.get("/api/warehouses").then(r => {
      const data = r.data.data || [];
      setWarehouses(data);
      if (data.length > 0) setStaging(s => ({ ...s, warehouseId: String(data[0].id) }));
    }).catch(() => {});
    // unit list removed — unit is auto-detected from item
    api.get("/api/stock/levels").then(r => {
      const data = r.data?.data || [];
      const map = {};
      data.forEach(s => {
        if (!map[s.item_id]) map[s.item_id] = {};
        map[s.item_id][s.warehouse_id] = s.quantity;
      });
      setStockLevels(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  // Edit mode: load existing document
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/api/branch-transfers/${editId}`).then(r => {
      const doc = r.data.data;
      setType(doc.type);
      setPartnerBranch(doc.partner_branch || "");
      setNotes(doc.notes || "");
      setLockedRef(doc.reference_no);
      setLockedDate(new Date(doc.created_at));
      setLines((doc.lines || []).map(l => ({
        id: Math.random().toString(36).substr(2, 9),
        item_id: l.item_id,
        item_name: l.item_name,
        code: l.item_code || l.barcode || "-",
        unit_id: l.unit_id || "",
        unit_name: l.unit_name || "",
        warehouse_id: String(l.warehouse_id),
        warehouse_name: l.warehouse_name || "",
        quantity: l.quantity,
        unit_cost: l.unit_cost || 0,
        selling_price: l.selling_price || 0,
        wholesale_price: l.wholesale_price || 0,
        original_purchase_price: Number(l.original_purchase_price || l.unit_cost || 0),
        original_sale_price: Number(l.original_sale_price || l.selling_price || 0),
        original_wholesale_price: Number(l.original_wholesale_price || l.wholesale_price || 0),
        update_master_purchase_price:  l.update_master_purchase_price !== 0,
        update_master_sale_price:      l.update_master_sale_price     !== 0,
        update_master_wholesale_price: l.update_master_wholesale_price !== 0,
        primary_image_url: null,
      })));
    }).catch(() => toast.error("فشل تحميل المستند"));
  }, [editId]);

  // Fetch draft ref number once first line is added (new mode only)
  useEffect(() => {
    if (isEditMode || refFetched || lines.length === 0) return;
    setRefFetched(true);
    setDraftTime(new Date());
    api.get(`/api/branch-transfers/next-ref?type=${type}`)
      .then(r => setDraftRef(r.data.data?.reference_no || ""))
      .catch(() => {});
  }, [lines.length, isEditMode, refFetched, type]);

  useEffect(() => {
    const q = itemQuery.trim();
    pendingPickRef.current = false;
    if (!q) {
      setFilteredItems([]);
      setItemOffset(0);
      setItemHasMore(false);
      itemSearchActiveRef.current = false;
      searchAbortRef.current?.abort();
      return;
    }

    // Cancel any in-flight request for a previous query immediately
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    currentQueryRef.current = q;

    itemSearchActiveRef.current = true;
    const t = setTimeout(() => {
      const capturedQ = q; // close over the query that triggered this timeout
      const params = { search: q, limit: ITEM_PAGE, offset: 0, ...(!isReceive && { in_stock_only: 1 }) };
      if (listCategoryFilter?.id) params.category_id = listCategoryFilter.id;
      api.get("/api/items", { params, signal: controller.signal })
        .then(r => {
          // Guard: discard response if the user has typed something newer
          if (currentQueryRef.current !== capturedQ) return;
          const rows = (r.data.data || []).map(item => ({
            ...item,
            sub_label: `مخزون: ${Object.values(stockLevels[item.id] || {}).reduce((s, v) => s + v, 0)}`,
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
          // Ignore cancellation errors; clear pending for all others
          if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
            pendingPickRef.current = false;
          }
        })
        .finally(() => { itemSearchActiveRef.current = false; });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
      itemSearchActiveRef.current = false;
    };
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
    const params = { search: searchParam, limit: ITEM_PAGE, offset: itemOffset, ...(!isReceive && { in_stock_only: 1 }) };
    if (listCategoryFilter?.id) params.category_id = listCategoryFilter.id;
    api.get("/api/items", { params })
      .then(r => {
        const rows = (r.data.data || []).map(item => ({
          ...item,
          sub_label: `مخزون: ${Object.values(stockLevels[item.id] || {}).reduce((s, v) => s + v, 0)}`,
        }));
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function showAllItems(categoryIdOverride) {
    const SHOW_ALL_LIMIT = 200;
    const fmt = (i) => ({
      ...i,
      sub_label: `مخزون: ${Object.values(stockLevels[i.id] || {}).reduce((s, v) => s + v, 0)}`,
    });
    const anchor = selectedItem;
    setAllItemsMode(true);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(true);
    setIsLoadingMoreItems(true);

    // categoryIdOverride bypasses stale closure when called right after setListCategoryFilter
    const activeCategoryId = categoryIdOverride ?? listCategoryFilter?.id ?? null;

    if (activeCategoryId) {
      api.get("/api/items", { params: { category_id: activeCategoryId, limit: SHOW_ALL_LIMIT, offset: 0, ...(!isReceive && { in_stock_only: 1 }) } })
        .then(r => {
          const rows = (r.data.data || []).map(fmt);
          setFilteredItems(sortByProximity(rows, anchor));
          setItemOffset(rows.length);
          setItemHasMore(Boolean(r.data?.meta?.has_more ?? rows.length === SHOW_ALL_LIMIT));
        }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
      return;
    }

    const allCall = api.get("/api/items", { params: { limit: SHOW_ALL_LIMIT, offset: 0, ...(!isReceive && { in_stock_only: 1 }) } });
    const catCall = anchor?.category_id
      ? api.get("/api/items", { params: { category_id: anchor.category_id, limit: 200, ...(!isReceive && { in_stock_only: 1 }) } })
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

  function handlePickItem(item) {
    setSelectedItem(item);
    const _sku = item.code || item.item_code || item.barcode || "";
    setItemQuery(_sku ? `[${_sku}] ${item.name}` : item.name);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setLookupOpen(false);
    let bestWhId = "";
    let bestAvail = -Infinity;
    for (const w of warehouses) {
      const raw = getStockQty(item.id, w.id);
      const inCart = lines.filter(l => Number(l.item_id) === Number(item.id) && String(l.warehouse_id) === String(w.id)).reduce((s, l) => s + Number(l.quantity), 0);
      const avail = raw - inCart;
      if (avail > bestAvail) { bestAvail = avail; bestWhId = String(w.id); }
    }
    setStaging(s => ({
      ...s,
      unitCost: String(item.purchase_price || 0),
      sellingPrice: String(item.sale_price || 0),
      wholesalePrice: String(item.wholesale_price || 0),
      unitId: String(item.unit_id || ""),
      warehouseId: bestWhId || s.warehouseId,
    }));
    const cat = categories.find(c => c.id === item.category_id) || categories.find(c => c.name === item.category_name) || null;
    setListCategoryFilter(cat ? { id: cat.id, name: cat.name } : null);
    setListCategoryQuery("");
    setTimeout(() => {
      if (warehouseTableRef.current) warehouseTableRef.current.focus();
    }, 50);
  }

  function handleItemKeyDown(e) {
    if (!lookupOpen) {
      handleFieldKeyDown(e, { nextRef: warehouseTableRef, prevRef: notesRef });
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filteredItems.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter") { if (filteredItems[activeIndex]) { handlePickItem(filteredItems[activeIndex]); } else if (filteredItems.length > 0) { handlePickItem(filteredItems[0]); } else if (itemSearchActiveRef.current) { pendingPickRef.current = true; } }
    if (e.key === "Escape") setLookupOpen(false);
  }

  function addLine() {
    if (!selectedItem) return;
    const qty = Math.max(0.001, Number(staging.quantity) || 1);
    const cost = Math.max(0, Number(staging.unitCost) || 0);
    const sell = Math.max(0, Number(staging.sellingPrice) || 0);
    const uId = staging.unitId || String(selectedItem.unit_id || "");
    const whId = staging.warehouseId || (warehouses[0] ? String(warehouses[0].id) : "");
    const selectedWarehouse = warehouses.find(w => String(w.id) === String(whId));

    const wholesale = Math.max(0, Number(staging.wholesalePrice) || 0);

    const existingQty = lines
      .filter(l => Number(l.item_id) === Number(selectedItem.id) && String(l.warehouse_id) === String(whId))
      .reduce((s, l) => s + Number(l.quantity), 0);
    const totalRequested = existingQty + qty;
    const stockAtWh = getStockQty(selectedItem.id, whId);
    if (!isReceive && stockAtWh < totalRequested) {
      return toast.error(`المخزون غير كافٍ في ${selectedWarehouse?.name || "المخزن"} (متاح: ${stockAtWh})`);
    }

    setLines(prev => {
      const existingIdx = prev.findIndex(l => Number(l.item_id) === Number(selectedItem.id) && String(l.warehouse_id) === String(whId));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: l.quantity + qty,
          unit_cost: cost,
          selling_price: sell,
          wholesale_price: wholesale,
          update_master_purchase_price:  isReceive ? stagingLocks.purchase : false,
          update_master_sale_price:      isReceive ? stagingLocks.sale     : false,
          update_master_wholesale_price: isReceive ? stagingLocks.wholesale: false,
        });
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        code: selectedItem.item_code || selectedItem.code || "-",
        unit_id: uId,
        unit_name: selectedItem.unit_name || "",
        warehouse_id: whId,
        warehouse_name: selectedWarehouse ? selectedWarehouse.name : "",
        quantity: qty,
        unit_cost: cost,
        selling_price: sell,
        wholesale_price: wholesale,
        original_purchase_price: Number(selectedItem.purchase_price || 0),
        original_sale_price: Number(selectedItem.sale_price || 0),
        original_wholesale_price: Number(selectedItem.wholesale_price || 0),
        update_master_purchase_price:  isReceive ? stagingLocks.purchase : false,
        update_master_sale_price:      isReceive ? stagingLocks.sale     : false,
        update_master_wholesale_price: isReceive ? stagingLocks.wholesale: false,
        primary_image_url: selectedItem.primary_image_url || selectedItem.image_url || selectedItem.image || null,
      }];
    });

    setSelectedItem(null);
    setItemQuery("");
    setListCategoryFilter(null);
    setListCategoryQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", unitId: "", warehouseId: s.warehouseId }));
    setLookupOpen(false);
    setTimeout(() => itemInputRef.current?.focus(), 50);
  }

  function updateLineField(index, field, val) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: val } : l));
  }

  function removeLine(index) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  const totalQty = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const totalCost = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0), [lines]);
  const totalSell = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.selling_price, 0), [lines]);

  const priceChangedLines = useMemo(() => {
    if (!isReceive) return [];
    return lines.filter(l =>
      (Number(l.selling_price)    !== Number(l.original_sale_price)      && Number(l.selling_price)    > 0) ||
      (Number(l.wholesale_price)  !== Number(l.original_wholesale_price) && Number(l.wholesale_price)  > 0) ||
      (Number(l.unit_cost)        !== Number(l.original_purchase_price)  && Number(l.unit_cost)        > 0)
    );
  }, [lines, isReceive]);

  function getStockQty(itemId, warehouseId) {
    if (!itemId || !warehouseId) return 0;
    return stockLevels[itemId]?.[warehouseId] ?? 0;
  }

  function getEffectiveMaxQty(itemId, warehouseId) {
    if (!isReceive) return getStockQty(itemId, warehouseId);
    return Infinity;
  }

  const lineStockWarnings = useMemo(() => {
    const w = {};
    for (const l of lines) {
      const maxQ = getEffectiveMaxQty(l.item_id, l.warehouse_id);
      if (maxQ !== Infinity && Number(l.quantity) > maxQ) {
        w[l.id] = { type: "error", msg: `المخزون غير كافٍ (متاح: ${maxQ})` };
      }
    }
    return w;
  }, [lines, stockLevels]);

  const hasStockErrors = useMemo(() =>
    Object.values(lineStockWarnings).some(v => v.type === "error"),
  [lineStockWarnings]);

  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [priceReportOpen, setPriceReportOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  async function handleCancelTransfer() {
    if (!cancelReason.trim()) return toast.error("سبب الإلغاء مطلوب");
    setIsCancelling(true);
    try {
      await api.delete(`/api/branch-transfers/${editId}`, { data: { reason: cancelReason } });
      toast.success("تم إلغاء المستند بنجاح");
      navigate("/operations/branch-transfer");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإلغاء");
    }
    setIsCancelling(false);
    setCancelConfirmOpen(false);
  }

  function handleSaveClick() {
    if (!lines.length) return toast.error("يجب إضافة صنف واحد على الأقل");
    if (isReceive && priceChangedLines.length > 0) {
      setPriceReportOpen(true);
    } else {
      setSaveConfirmOpen(true);
    }
  }

  async function doSave() {
    setSaveConfirmOpen(false);
    setPriceReportOpen(false);
    if (!lines.length) return toast.error("يجب إضافة صنف واحد على الأقل");

    setIsSaving(true);
    try {
      const payload = {
        type,
        partner_branch: partnerBranch || undefined,
        notes: notes || undefined,
        items: lines.map(l => ({
          item_id: l.item_id,
          quantity: l.quantity,
          warehouse_id: Number(l.warehouse_id),
          unit_cost: l.unit_cost,
          selling_price: l.selling_price,
          wholesale_price: l.wholesale_price || 0,
          unit_id: l.unit_id || undefined,
          update_master_purchase_price:  !!l.update_master_purchase_price,
          update_master_sale_price:      !!l.update_master_sale_price,
          update_master_wholesale_price: !!l.update_master_wholesale_price,
        })),
      };

      let doc;
      if (isEditMode) {
        const res = await api.put(`/api/branch-transfers/${editId}`, payload);
        doc = res.data?.data || null;
      } else {
        const res = await api.post("/api/branch-transfers", payload);
        doc = res.data?.data || null;
      }

      setSavedDoc(doc);
      wasSaved.current = true;
      setSaveSuccess({
        invoiceNumber: doc?.reference_no || "",
        total: `${formatNumber(totalCost)} ج.م`,
        payments: [],
        customerName: partnerBranch || null,
        customerNewBalance: null,
      });
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الحفظ");
    }
    setIsSaving(false);
  }

  const baseColumns = [
    {
      id: "index", header: "#", width: 40, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100", sortable: false,
      render: (_, i) => i + 1,
    },
    {
      id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[11px] font-black tracking-wider text-slate-500 border-l border-slate-100 text-center",
      render: (l) => l.code,
    },
    {
      id: "name", header: "البيان", width: 200, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
      render: (l) => (
        <div className="flex items-center gap-2">
          {l.primary_image_url && (
            <img
              src={resolveImageUrl(l.primary_image_url)}
              alt="product"
              className="w-7 h-7 shrink-0 object-cover rounded-[6px] cursor-pointer hover:scale-110 transition-transform shadow-sm border border-slate-200"
              onClick={() => { setImagePreviewUrl(l.primary_image_url); setImageModalOpen(true); }}
            />
          )}
          <span className="whitespace-normal break-words leading-tight">{l.item_name}</span>
        </div>
      ),
      sortValue: (l) => l.item_name,
    },
    {
      id: "unit", header: "الوحدة", width: 80, sortable: false, headerClass: "text-center", cellClass: "text-center text-2sm font-bold text-slate-500 border-l border-slate-100",
      render: (l) => l.unit_name || "—",
    },
    {
      id: "warehouse", header: "المخزن", width: 130, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
      render: (l, i) => {
        const whStock = stockLevels[l.item_id] || {};
        const hasStock = l.warehouse_id ? (whStock[l.warehouse_id] || 0) > 0 : false;
        const isOut = !isReceive && l.warehouse_id && !hasStock && Number(l.quantity) > 0;
        return (
          <select value={l.warehouse_id}
            onChange={(e) => updateLineField(i, "warehouse_id", e.target.value)}
            className={`w-full h-[40px] text-center text-2sm font-bold outline-none border-0 ring-0 focus:ring-0 transition-colors cursor-pointer ${
              isOut ? "bg-rose-50 text-rose-700" : "bg-transparent text-slate-600 focus:bg-indigo-50/50"
            }`}
          >
            {warehouses.map(w => {
              const sqty = whStock[w.id] || 0;
              return <option key={w.id} value={w.id}>{w.name} ({sqty})</option>;
            })}
          </select>
        );
      },
    },
    {
      id: "quantity", header: "الكمية", width: 110, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
      render: (l, i) => {
        const maxQ = getEffectiveMaxQty(l.item_id, l.warehouse_id);
        const hasLimit = maxQ !== Infinity;
        const atLimit = hasLimit && Number(l.quantity) >= maxQ;
        const remaining = hasLimit ? Math.max(0, maxQ - Number(l.quantity)) : null;
        return (
          <div className={`w-full h-[40px] flex items-center justify-center gap-0.5 transition-colors ${atLimit ? "bg-rose-50" : ""}`}
            title={hasLimit ? `المتاح: ${maxQ}` : undefined}
          >
            <input
              type="number" min="0.001" step="any"
              value={l.quantity}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateLineField(i, "quantity", hasLimit ? Math.min(v, maxQ) : v);
              }}
              className={`w-[52px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 focus:bg-indigo-50/50 transition-colors ${atLimit ? "text-rose-600" : "bg-transparent"}`}
            />
            {hasLimit && (
              <span className={`text-[9px] font-black leading-none shrink-0 ${atLimit ? "text-rose-500" : "text-slate-400"}`}>
                {atLimit ? "نفد" : `+${remaining}`}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const extraColumns = [
    {
      id: "unit_cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const changed = isReceive && Number(l.unit_cost) !== Number(l.original_purchase_price) && Number(l.unit_cost) > 0;
          const willUpdate = l.update_master_purchase_price !== false && l.update_master_purchase_price !== 0;
          return (
            <div className="relative w-full h-full flex flex-col">
              <input
                type="number" step="any"
                value={l.unit_cost}
                onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))}
                className={`w-full h-[32px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`}
              />
              {changed && (
                <div className="flex flex-col items-center gap-0.5 pb-0.5">
                  <span className="text-[8px] text-center leading-none flex items-center gap-0.5">
                    <span className="text-slate-400 number-fmt">{Number(l.original_purchase_price).toFixed(2)}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`number-fmt ${Number(l.unit_cost) > Number(l.original_purchase_price) ? "text-rose-500" : "text-emerald-600"}`}>{Number(l.unit_cost).toFixed(2)}</span>
                  </span>
                  <button type="button"
                    title={willUpdate ? "تكلفة: هيحدّث سعر بطاقة الصنف — اضغط عشان متغيرش" : "تكلفة: للمستند ده بس — اضغط عشان تحدّث بطاقة الصنف"}
                    onClick={() => updateLineField(i, "update_master_purchase_price", !willUpdate)}
                    className={`inline-flex items-center gap-1 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all ${
                      willUpdate ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    <Lock size={7} className={willUpdate ? "" : "opacity-50"} />
                    {willUpdate ? "يحدّث" : "مستند بس"}
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
    ...(isReceive ? [
      {
        id: "selling_price", header: "سعر البيع", width: 110, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const changed = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0;
          const willUpdate = l.update_master_sale_price !== false && l.update_master_sale_price !== 0;
          return (
            <div className="relative w-full h-full flex flex-col">
              <input
                type="number" step="any"
                value={l.selling_price}
                onChange={(e) => updateLineField(i, "selling_price", Number(e.target.value))}
                className={`w-full h-[32px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-amber-50/50 text-amber-700"}`}
              />
              {changed && (
                <div className="flex flex-col items-center gap-0.5 pb-0.5">
                  <span className="text-[8px] text-center leading-none flex items-center gap-0.5">
                    <span className="text-slate-400 number-fmt">{Number(l.original_sale_price).toFixed(2)}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`number-fmt ${Number(l.selling_price) > Number(l.original_sale_price) ? "text-rose-500" : "text-emerald-600"}`}>{Number(l.selling_price).toFixed(2)}</span>
                  </span>
                  <button type="button"
                    title={willUpdate ? "بيع: هيحدّث سعر بطاقة الصنف — اضغط عشان متغيرش" : "بيع: للمستند ده بس — اضغط عشان تحدّث بطاقة الصنف"}
                    onClick={() => updateLineField(i, "update_master_sale_price", !willUpdate)}
                    className={`inline-flex items-center gap-1 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all ${
                      willUpdate ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    <Lock size={7} className={willUpdate ? "" : "opacity-50"} />
                    {willUpdate ? "يحدّث" : "مستند بس"}
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "profit_pct", header: "نسبة الربح", width: 90, sortable: false, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const cost = Number(l.unit_cost) || 0;
          const price = Number(l.selling_price) || 0;
          const pct = cost > 0 ? ((price - cost) / cost) * 100 : 0;
          return (
            <input
              type="number" step="0.1"
              value={Number(pct.toFixed(2))}
              onChange={(e) => {
                const newPct = Number(e.target.value);
                const newPrice = cost * (1 + newPct / 100);
                updateLineField(i, "selling_price", Math.round(newPrice * 1000) / 1000);
              }}
              className="w-full h-[40px] text-center text-2sm number-fmt-primary bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-blue-50/50 text-blue-700 transition-colors"
            />
          );
        },
      },
      {
        id: "wholesale_price", header: "جملة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const changed = Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0;
          const willUpdate = l.update_master_wholesale_price !== false && l.update_master_wholesale_price !== 0;
          return (
            <div className="relative w-full h-full flex flex-col">
              <input
                type="number" step="any"
                value={l.wholesale_price ?? 0}
                onChange={(e) => updateLineField(i, "wholesale_price", Number(e.target.value))}
                className={`w-full h-[32px] text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`}
              />
              {changed && (
                <div className="flex flex-col items-center gap-0.5 pb-0.5">
                  <span className="text-[8px] text-center leading-none flex items-center gap-0.5">
                    <span className="text-slate-400 number-fmt">{Number(l.original_wholesale_price).toFixed(2)}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`number-fmt ${Number(l.wholesale_price) > Number(l.original_wholesale_price) ? "text-rose-500" : "text-emerald-600"}`}>{Number(l.wholesale_price).toFixed(2)}</span>
                  </span>
                  <button type="button"
                    title={willUpdate ? "جملة: هيحدّث سعر بطاقة الصنف — اضغط عشان متغيرش" : "جملة: للمستند ده بس — اضغط عشان تحدّث بطاقة الصنف"}
                    onClick={() => updateLineField(i, "update_master_wholesale_price", !willUpdate)}
                    className={`inline-flex items-center gap-1 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all ${
                      willUpdate ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    <Lock size={7} className={willUpdate ? "" : "opacity-50"} />
                    {willUpdate ? "يحدّث" : "مستند بس"}
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "locks", header: "تحديث السعر", width: 100, sortable: false, headerClass: "text-center px-1 text-[10px]", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const costChanged = Number(l.unit_cost) !== Number(l.original_purchase_price) && Number(l.unit_cost) > 0;
          const saleChanged = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0;
          const whslChanged = Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0;
          if (!costChanged && !saleChanged && !whslChanged) return <div className="h-[40px]" />;
          return (
            <div className="flex flex-col gap-0.5 py-0.5 px-1">
              {[
                costChanged && { key: "update_master_purchase_price", label: "تكلفة", active: l.update_master_purchase_price !== false && l.update_master_purchase_price !== 0 },
                saleChanged && { key: "update_master_sale_price",     label: "بيع",   active: l.update_master_sale_price !== false && l.update_master_sale_price !== 0 },
                whslChanged && { key: "update_master_wholesale_price", label: "جملة",  active: l.update_master_wholesale_price !== false && l.update_master_wholesale_price !== 0 },
              ].filter(Boolean).map(({ key, label, active }) => (
                <button key={key} type="button"
                  title={active ? `${label}: هيتحدّث سعر بطاقة الصنف — اضغط عشان متغيرش` : `${label}: للمستند ده بس — اضغط عشان تحدّث بطاقة الصنف`}
                  onClick={() => updateLineField(i, key, !active)}
                  className={`flex items-center justify-between gap-1 w-full px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                    active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                           : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  <span>{label}</span>
                  <span className="shrink-0">{active ? "يحدّث" : "مستند"}</span>
                </button>
              ))}
            </div>
          );
        },
      },
    ] : [
      {
        id: "selling_price", header: "مستهلك", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => (
          <input
            type="number" step="any"
            value={l.selling_price}
            onChange={(e) => updateLineField(i, "selling_price", Number(e.target.value))}
            className="w-full h-[40px] text-center text-sm number-fmt-primary bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-amber-50/50 text-amber-700 transition-colors"
          />
        ),
      },
    ]),
    {
      id: "total_cost", header: "الإجمالي", width: 110, sortable: false, headerClass: "text-center", cellClass: "text-center number-fmt text-sm font-black text-slate-700 border-l border-slate-100",
      render: (l) => formatNumber(l.quantity * l.unit_cost),
    },
  ];

  const actionsColumn = {
    id: "actions", header: "", width: 45, sortable: false, headerClass: "text-center", cellClass: "p-0 text-center",
    render: (_, i) => (
      <button onClick={() => removeLine(i)} className="flex h-[40px] w-full items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    ),
  };

  const columns = [...baseColumns, ...extraColumns, actionsColumn]
    .filter(c => c.id === "index" || c.id === "actions" || visibleColumns.includes(c.id));

  const displayRef = isEditMode ? lockedRef : draftRef;
  const displayDate = isEditMode ? lockedDate : draftTime;

  const invoiceDummy = {
    invoice_number: savedDoc ? savedDoc.reference_no : (displayRef || (isReceive ? "BT-R-??????" : "BT-S-??????")),
    created_at: savedDoc ? savedDoc.created_at : new Date().toISOString(),
    lines: lines.map(l => ({
      item_code: l.code,
      item_name: l.item_name,
      quantity: l.quantity,
      unit_price: l.unit_cost || 0,
      discount_amount: 0,
    })),
  };

  const onDismissSaveSuccess = useCallback(() => {
    setSaveSuccess(null);
    navigate("/operations/branch-transfer");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 font-sans relative" dir="rtl">
      {saveSuccess && (
        <InvoiceSaveSuccess
          invoiceNumber={saveSuccess.invoiceNumber}
          total={saveSuccess.total}
          payments={saveSuccess.payments}
          customerName={saveSuccess.customerName}
          customerNewBalance={saveSuccess.customerNewBalance}
          onDismiss={onDismissSaveSuccess}
        />
      )}
      {/* Image zoom modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="صورة المنتج" maxWidth="max-w-2xl" showDetach={false}>
        <div
          className="flex items-center justify-center p-4 bg-slate-100/50 rounded-xl overflow-hidden min-h-[400px] relative"
          onWheel={(e) => setImageZoom(z => Math.max(0.5, Math.min(5, z + (e.deltaY > 0 ? -0.1 : 0.1))))}
          onMouseDown={e => { imgIsDragging.current = true; imgLastPos.current = { x: e.clientX, y: e.clientY }; }}
          onMouseMove={e => {
            if (!imgIsDragging.current) return;
            const dx = e.clientX - imgLastPos.current.x;
            const dy = e.clientY - imgLastPos.current.y;
            imgLastPos.current = { x: e.clientX, y: e.clientY };
            setImagePan(p => ({ x: p.x + dx, y: p.y + dy }));
          }}
          onMouseUp={() => imgIsDragging.current = false}
          onMouseLeave={() => imgIsDragging.current = false}
          style={{ cursor: "grab" }}
        >
          {imagePreviewUrl && (
            <img
              src={resolveImageUrl(imagePreviewUrl)}
              alt="Preview"
              draggable={false}
              style={{
                transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
                transition: imgIsDragging.current ? "none" : "transform 0.1s ease-out",
                pointerEvents: "none",
              }}
              className="max-w-full max-h-[60vh] object-contain rounded drop-shadow-sm"
            />
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 p-2 rounded-full shadow-md border border-slate-200">
            <button onClick={() => setImageZoom(z => Math.min(5, z + 0.25))} className="p-1.5 hover:bg-slate-100 rounded-full"><ZoomIn className="w-4 h-4 text-slate-600"/></button>
            <span className="text-[11px] font-bold font-mono text-slate-600 min-w-[36px] text-center">{Math.round(imageZoom * 100)}%</span>
            <button onClick={() => setImageZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-slate-100 rounded-full"><ZoomOut className="w-4 h-4 text-slate-600"/></button>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <button onClick={() => { setImageZoom(1); setImagePan({ x: 0, y: 0 }); }} className="p-1.5 hover:bg-slate-100 rounded-full"><Maximize className="w-4 h-4 text-slate-600"/></button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div data-help="bt-form-header">
      <DocumentHeaderBar
        className="print:hidden mb-6"
        accent={isReceive ? "emerald" : "indigo"}
        onBack={() => navigate("/operations/branch-transfer")}
        title={isEditMode ? "تعديل مستند" : (isReceive ? "أمر استلام بضاعة" : "أمر صرف وتحويل")}
        subtitle={isEditMode ? "وضع التعديل" : (isReceive ? "استلام بضاعة من فرع" : "تسليم بضاعة لفرع")}
        extras={
          <>
            {priceChangedLines.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <TrendingUp className="h-3.5 w-3.5" />
                {priceChangedLines.length} أسعار ستتغير
              </div>
            )}
            {(displayRef || displayDate) && (
              <div className="flex gap-1.5 items-center">
                {displayRef && (
                  <div className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-500">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    {displayRef}
                    {isEditMode && <span className="text-slate-400 text-[11px]">• مقفل</span>}
                  </div>
                )}
                {displayDate && (
                  <div className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-bold text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {fmtDateTime(displayDate)}
                  </div>
                )}
              </div>
            )}
          </>
        }
        actions={
          <>
            <DocumentActionButton variant="ghost" icon={Search} onClick={() => setAdvancedSearchOpen(true)}>
              المخزون
            </DocumentActionButton>
            <DocumentActionButton variant="today" icon={FileText} onClick={() => setTodayModalOpen(true)}>
              المستندات
            </DocumentActionButton>
            <PermissionGate page="branch_transfer" action={isEditMode ? "edit" : "add"}>
                <DocumentActionButton
                  data-help="bt-form-submit"
                  variant="ghost"
                  icon={CheckCircle}
                  onClick={() => handleSaveClick()}
                  disabled={isSaving || !lines.length || !partnerBranch || hasStockErrors}
                >
                  {isEditMode ? "حفظ التعديلات" : "حفظ بدون طباعة"}
                </DocumentActionButton>
            </PermissionGate>
            {isEditMode && (
              <PermissionGate page="branch_transfer" action="delete">
                <DocumentActionButton
                  variant="delete"
                  icon={Trash2}
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={isSaving || isCancelling}
                >
                  إلغاء المستند
                </DocumentActionButton>
              </PermissionGate>
            )}
            <PermissionGate page="branch_transfer" action="print">
              <DocumentActionButton
                variant="primary"
                identity={isReceive ? "emerald" : "indigo"}
                icon={Printer}
                onClick={() => setPreviewOpen(true)}
                disabled={isSaving || !lines.length || !partnerBranch || hasStockErrors}
              >
                طباعة  
              </DocumentActionButton>
            </PermissionGate>
          </>
        }
      /></div>

      <div className="print:hidden flex gap-6 items-stretch" style={{ paddingBottom: panelEffectiveCollapsed ? "var(--bottom-bar-h, 90px)" : undefined }}>

        {/* Sidebar */}
        <div className={`flex flex-col gap-5 ${panelEffectiveCollapsed ? "hidden" : ""}`} style={{ width: panelWidth, minWidth: panelWidth }}>

          {/* Partner branch */}
          <div className="rounded-[20px] border border-white bg-white/60 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className={`p-2 rounded-[10px] bg-${theme.primary}-100 text-${theme.primary}-600`}>
                <Warehouse className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-black text-slate-800 tracking-tight">معلومات الحركة</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-2sm font-bold text-slate-500 mr-1">
                {isReceive ? "الفرع المُرسل" : "الفرع المُستلم"}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    data-help="bt-form-source"
                    ref={partnerBranchRef}
                    value={partnerBranch}
                    onChange={e => setPartnerBranch(e.target.value)}
                    onKeyDown={e => handleFieldKeyDown(e, { nextRef: notesRef, prevRef: addBtnRef })}
                    className={`w-full appearance-none rounded-[10px] border border-slate-200/80 px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 bg-white shadow-inner transition-all hover:border-slate-300 focus:border-${theme.primary}-500 focus:ring-${theme.primary}-500/20`}
                  >
                    <option value="">اختر الفرع...</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={handleManageBranches}
                  title="إدارة الفروع"
                  className="flex shrink-0 items-center justify-center w-[46px] rounded-[10px] border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors shadow-inner"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-[20px] border border-white bg-white/60 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-[10px] bg-${theme.primary}-100 text-${theme.primary}-600`}>
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-black text-slate-800 tracking-tight">ملاحظات وسبب الحركة</h3>
            </div>
              <textarea
                data-help="bt-form-notes"
                ref={notesRef}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => handleFieldKeyDown(e, { nextRef: itemInputRef, prevRef: partnerBranchRef })}
              placeholder="اكتب الملاحظات واسم المندوب..."
              rows={3}
              className={`w-full resize-none rounded-[10px] border border-slate-200/80 px-4 py-3 text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 bg-white shadow-inner transition-all hover:border-slate-300 focus:border-${theme.primary}-500 focus:ring-${theme.primary}-500/20 custom-scrollbar`}
            />
          </div>

          {/* Totals & actions */}
          <div className="rounded-[20px] bg-white p-6 shadow-[0_15px_40px_rgb(0,0,0,0.08)] border border-slate-100 flex flex-col gap-5">
            <div className="flex flex-col gap-3 bg-slate-50/50 rounded-[14px] py-5 px-4 border border-slate-100 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-2sm font-black uppercase tracking-widest text-slate-400">إجمالي الكميات</span>
                <span className={`text-3xl number-fmt-primary text-${theme.primary}-600`}>{formatNumber(totalQty, { decimals: 0 })}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-2sm font-black uppercase tracking-widest text-slate-400">إجمالي التكلفة</span>
                <span className="text-2xl number-fmt-primary text-slate-700">
                  {formatNumber(totalCost)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-2sm font-black uppercase tracking-widest text-slate-400">إجمالي سعر البيع</span>
                <span className="text-2xl number-fmt-primary text-amber-600">
                  {formatNumber(totalSell)}
                </span>
              </div>
            </div>
               <div className="flex-1" />
          </div>
        </div>

        {/* PanelEdgeRail */}
        <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel} onResizeStart={(e) => startPanelResize(e, "left")} panelSide="left" />

        {/* Right: item entry + lines */}
        <div className="flex flex-col gap-5 min-w-0 flex-1">

          {/* Item entry bar */}
          <section className="rounded-2xl border p-3 shadow-sm relative z-40" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
            <div className="flex flex-col gap-5">
              
              {/* Row 1: Product Selection & Warehouse */}
              <div className="flex flex-col md:flex-row items-start gap-4">
                
                {selectedItem && (
                  <div
                    className="w-14 h-14 mt-6 shrink-0 rounded-[12px] border-2 border-indigo-100 overflow-hidden shadow-md group relative bg-white flex items-center justify-center cursor-pointer"
                    onClick={() => {
                      const img = selectedItem.primary_image_url || selectedItem.image_url || selectedItem.image;
                      if (img) { setImagePreviewUrl(img); setImageModalOpen(true); }
                    }}
                  >
                    {selectedItem.primary_image_url || selectedItem.image_url || selectedItem.image ? (
                      <>
                        <img src={resolveImageUrl(selectedItem.primary_image_url || selectedItem.image_url || selectedItem.image)} alt="product" className="w-full h-full object-cover hover:scale-[1.05] transition-all" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <ImageIcon className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                      </>
                    ) : (
                      <Package className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                )}

                  {/* Item search */}
                <div className="relative flex-1 min-w-[240px] flex flex-col text-right">
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">المادة / الصنف (بحث)</label>
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
                        showAllItems(catId);
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
                    selectedItem={selectedItem}
                    onLoadMore={loadMoreItems}
                    hasMore={itemHasMore}
                    isLoadingMore={isLoadingMoreItems}
                    onShowAll={showAllItems}
                    showChip={false}
                    hideZeroStock={!isReceive}
                    placeholder="ابحث بالاسم أو كود SKU..."
                  />
                </div>

                {/* Warehouse table */}
                <div data-help="bt-form-destination" className="flex flex-col gap-1.5 w-full md:w-[220px] shrink-0 text-right">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-bold text-slate-500">المخزن</label>
                    {selectedItem && !isReceive && (
                      <span className="text-[9px] font-black text-slate-400">
                        للإضافة: {(() => {
                          const inCart = lines.filter(l => Number(l.item_id) === Number(selectedItem.id) && String(l.warehouse_id) === String(staging.warehouseId)).reduce((s, l) => s + Number(l.quantity), 0);
                          const avail = Math.max(0, getStockQty(selectedItem.id, staging.warehouseId) - inCart);
                          return avail;
                        })()}
                      </span>
                    )}
                  </div>
                  <div
                    ref={warehouseTableRef}
                    tabIndex={0}
                    className="border border-slate-200 rounded-[10px] bg-slate-50/50 overflow-y-auto outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
                    style={{ height: "80px" }}
                    onKeyDown={(e) => {
                      const idx = warehouses.findIndex(w => String(w.id) === String(staging.warehouseId));
                      if (e.key === "ArrowDown") { e.preventDefault(); const next = warehouses[Math.min(idx + 1, warehouses.length - 1)]; if (next) setStaging(s => ({ ...s, warehouseId: String(next.id) })); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); const prev = warehouses[Math.max(idx - 1, 0)]; if (prev) setStaging(s => ({ ...s, warehouseId: String(prev.id) })); }
                      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); costInputRef.current?.focus(); costInputRef.current?.select?.(); }
                    }}
                  >
                    <table className="w-full text-[11px] border-collapse">
                      <tbody>
                        {warehouses.map(w => {
                          const rawQty = selectedItem ? getStockQty(selectedItem.id, w.id) : 0;
                          const inCart = selectedItem ? lines.filter(l => Number(l.item_id) === Number(selectedItem.id) && String(l.warehouse_id) === String(w.id)).reduce((s, l) => s + Number(l.quantity), 0) : 0;
                          const avail = Math.max(0, rawQty - inCart);
                          const isSelected = String(staging.warehouseId) === String(w.id);
                          const insufficient = !isReceive && selectedItem && Number(staging.quantity) > avail;
                          const isLow = avail > 0 && avail < 5;
                          const isEmpty = avail === 0;
                          let stockColor = "text-slate-400";
                          if (insufficient) stockColor = "text-rose-600 font-black";
                          else if (isEmpty) stockColor = "text-slate-300";
                          else if (isLow) stockColor = "text-amber-600 font-black";
                          else stockColor = "text-emerald-600 font-black";
                          let bgColor = "";
                          if (isSelected && insufficient) bgColor = "bg-rose-50";
                          else if (isSelected) bgColor = "bg-indigo-50";
                          return (
                            <tr key={w.id}
                              onClick={() => { setStaging(s => ({ ...s, warehouseId: String(w.id) })); warehouseTableRef.current?.focus(); }}
                              className={`cursor-pointer border-b border-slate-200 last:border-0 transition-colors ${bgColor || (isSelected ? "bg-indigo-50" : "hover:bg-slate-100")}`}
                            >
                              <td className={`px-2 py-1 font-bold truncate ${isSelected ? "text-indigo-700" : "text-slate-700"} ${insufficient ? "line-through opacity-60" : ""}`}>{w.name}</td>
                              <td className={`px-2 py-1 number-fmt text-center tabular-nums ${stockColor}`}>{avail}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {selectedItem && !isReceive && (() => {
                    const inCart = lines.filter(l => Number(l.item_id) === Number(selectedItem.id) && String(l.warehouse_id) === String(staging.warehouseId)).reduce((s, l) => s + Number(l.quantity), 0);
                    const avail = Math.max(0, getStockQty(selectedItem.id, staging.warehouseId) - inCart);
                    if (Number(staging.quantity) > avail) {
                      return (
                        <div className="flex items-center gap-1 rounded-sm bg-rose-50 border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 leading-tight">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          المتاح {avail}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

              </div>

              {/* Row 2: Pricing, Quantity & Add Button */}
              <div className="flex flex-wrap items-end gap-3.5 border-t border-slate-100 pt-4 text-right">
                
                {/* Unit — auto-detected from item */}
                <div className="flex flex-col gap-1.5 w-[90px] shrink-0">
                  <label className="text-[11px] font-bold text-slate-500">الوحدة</label>
                  <div className="w-full h-11 flex items-center justify-center border border-slate-200 rounded-[10px] bg-slate-100/50 px-2 text-2sm font-bold text-slate-600 shadow-inner">
                    {selectedItem ? (selectedItem.unit_name || "أساسية") : "—"}
                  </div>
                </div>

                {/* Cost / Price */}
                <div className="flex flex-col gap-1 w-[110px] shrink-0">
                  <div className="flex items-center gap-1">
                    <label className="text-[11px] font-bold text-slate-500 flex-1 min-w-0 truncate">{isReceive ? "التكلفة" : "السعر"}</label>
                    {isReceive && selectedItem && Number(staging.unitCost) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && (
                      <button type="button"
                        onClick={() => setStagingLocks(l => ({ ...l, purchase: !l.purchase }))}
                        title={stagingLocks.purchase ? "هيتحدّث سعر التكلفة — اضغط عشان متغيرش" : "للمستند ده بس — اضغط عشان تحدّث السعر"}
                        className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded border transition-all ${
                          stagingLocks.purchase ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"
                        }`}>
                        {stagingLocks.purchase ? "يحدّث" : "ثابت"}
                      </button>
                    )}
                    <button type="button" onClick={() => setPriceHelpOpen(true)}
                      title="اعرف أكثر عن خيارات تحديث السعر"
                      className="shrink-0 text-slate-400 hover:text-indigo-500 transition-colors">
                      <Info size={11} />
                    </button>
                  </div>
                  <input
                    ref={costInputRef}
                    type="number" step="any"
                    value={staging.unitCost}
                    onChange={e => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, { nextRef: sellInputRef, prevRef: warehouseTableRef })}
                    className={`w-full h-11 border rounded-[10px] px-1 text-sm number-fmt-primary text-slate-800 outline-none transition-all shadow-inner text-center ${
                      isReceive && !stagingLocks.purchase
                        ? "border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                        : isReceive && selectedItem && Number(staging.unitCost) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price)
                          ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-400/10"
                          : `border-slate-200 bg-slate-50/50 focus:border-${theme.primary}-500 focus:bg-white focus:ring-4 focus:ring-${theme.primary}-500/10`
                    }`}
                    />
                    {isReceive && selectedItem && Number(staging.unitCost) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && (
                      <div className="flex flex-col items-center gap-0.5 -mt-1">
                        <span className="text-[8px] text-center leading-none flex items-center gap-0.5">
                          <span className="text-slate-400 number-fmt">{Number(selectedItem.purchase_price).toFixed(2)}</span>
                          <span className="text-slate-300">→</span>
                          <span className={`number-fmt ${Number(staging.unitCost) > Number(selectedItem.purchase_price) ? "text-rose-500" : "text-emerald-600"}`}>{Number(staging.unitCost).toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                </div>

                {/* Selling price */}
                <div className="flex flex-col gap-1.5 w-[110px] shrink-0">
                  <div className="flex items-center gap-1">
                    <label className="text-[11px] font-bold text-slate-500 flex-1 min-w-0 truncate">{isReceive ? "سعر البيع" : "مستهلك"}</label>
                    {isReceive && selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && (
                      <button type="button"
                        onClick={() => setStagingLocks(l => ({ ...l, sale: !l.sale }))}
                        title={stagingLocks.sale ? "هيتحدّث سعر البيع — اضغط عشان متغيرش" : "للمستند ده بس — اضغط عشان تحدّث السعر"}
                        className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded border transition-all ${
                          stagingLocks.sale ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"
                        }`}>
                        {stagingLocks.sale ? "يحدّث" : "ثابت"}
                      </button>
                    )}
                  </div>
                  <input
                    ref={sellInputRef}
                    type="number" step="any"
                    value={staging.sellingPrice}
                    onChange={e => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, { nextRef: isReceive ? wholesaleInputRef : qtyInputRef, prevRef: costInputRef })}
                    className={`w-full h-11 border rounded-[10px] px-1 text-sm number-fmt-primary text-slate-800 outline-none transition-all shadow-inner text-center ${
                      isReceive && !stagingLocks.sale
                        ? "border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                        : isReceive && selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price)
                          ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-400/10"
                          : "border-slate-200 bg-slate-50/50 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10"
                    }`}
                    />
                    {isReceive && selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && (
                      <div className="flex flex-col items-center gap-0.5 -mt-1">
                        <span className="text-[8px] text-center leading-none flex items-center gap-0.5">
                          <span className="text-slate-400 number-fmt">{Number(selectedItem.sale_price).toFixed(2)}</span>
                          <span className="text-slate-300">→</span>
                          <span className={`number-fmt ${Number(staging.sellingPrice) > Number(selectedItem.sale_price) ? "text-rose-500" : "text-emerald-600"}`}>{Number(staging.sellingPrice).toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                </div>

                {/* Wholesale price — receive only */}
                {isReceive && (
                  <div className="flex flex-col gap-1 w-[110px] shrink-0">
                    <div className="flex items-center gap-1">
                      <label className="text-[11px] font-bold text-slate-500 flex-1 min-w-0 truncate">جملة</label>
                      {selectedItem && Number(staging.wholesalePrice) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && (
                        <button type="button"
                          onClick={() => setStagingLocks(l => ({ ...l, wholesale: !l.wholesale }))}
                          title={stagingLocks.wholesale ? "هيتحدّث سعر الجملة — اضغط عشان متغيرش" : "للمستند ده بس — اضغط عشان تحدّث السعر"}
                          className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded border transition-all ${
                            stagingLocks.wholesale ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"
                          }`}>
                          {stagingLocks.wholesale ? "يحدّث" : "ثابت"}
                        </button>
                      )}
                    </div>
                    <input
                      ref={wholesaleInputRef}
                      type="number" step="any"
                      value={staging.wholesalePrice}
                      onChange={e => setStaging(s => ({ ...s, wholesalePrice: e.target.value }))}
                      onFocus={e => e.target.select()}
                      onKeyDown={(e) => handleFieldKeyDown(e, { nextRef: qtyInputRef, prevRef: sellInputRef })}
                      className={`w-full h-11 border rounded-[10px] px-1 text-sm number-fmt-primary text-slate-800 outline-none transition-all shadow-inner text-center ${
                        !stagingLocks.wholesale
                          ? "border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                          : selectedItem && Number(staging.wholesalePrice) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price)
                            ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-400/10"
                            : "border-slate-200 bg-slate-50/50 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10"
                      }`}
                    />
                    {selectedItem && Number(staging.wholesalePrice) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && (
                      <div className="flex flex-col items-center gap-0.5 -mt-1">
                        <span className="text-[8px] text-center leading-none flex items-center gap-0.5">
                          <span className="text-slate-400 number-fmt">{Number(selectedItem.wholesale_price).toFixed(2)}</span>
                          <span className="text-slate-300">→</span>
                          <span className={`number-fmt ${Number(staging.wholesalePrice) > Number(selectedItem.wholesale_price) ? "text-rose-500" : "text-emerald-600"}`}>{Number(staging.wholesalePrice).toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div className="flex flex-col gap-1.5 w-[90px] shrink-0">
                  <label className="text-[11px] font-bold text-slate-500">الكمية</label>
                  {selectedItem && staging.warehouseId && (
                    <span className="text-[9px] font-bold text-slate-400 text-center -mb-1">
                      متاح: {Math.max(0, getStockQty(selectedItem.id, staging.warehouseId) - lines.filter(l => Number(l.item_id) === Number(selectedItem.id) && String(l.warehouse_id) === String(staging.warehouseId)).reduce((s, l) => s + Number(l.quantity), 0))}
                    </span>
                  )}
                  <input
                    ref={qtyInputRef}
                    type="number" min="0.001" step="any"
                    value={staging.quantity}
                    onChange={e => setStaging(s => ({ ...s, quantity: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, { nextRef: addBtnRef, prevRef: sellInputRef })}
                    className="w-full h-11 border border-slate-200 rounded-[10px] bg-slate-50/50 px-1 text-sm number-fmt-primary text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner text-center"
                  />
                </div>

                {/* Add button */}
                <button
                  ref={addBtnRef}
                  data-help="bt-form-add-item"
                  onClick={addLine}
                  onKeyDown={(e) => handleFieldKeyDown(e, { nextRef: itemInputRef, prevRef: qtyInputRef, onEnter: addLine })}
                  disabled={!selectedItem}
                  className="flex h-11 w-[100px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-black text-white shadow-md hover:bg-primary-600 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-all focus:ring-4 focus:ring-slate-800/20"
                >
                  <Plus className="h-4 w-4" /> إضافة
                </button>
              </div>

            </div>
          </section>

          {/* Lines table */}
          {hasStockErrors && !isReceive && (
            <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 text-[11px] text-rose-700 font-bold shrink-0 border border-rose-200 rounded-md">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              يوجد {Object.keys(lineStockWarnings).length} صنف يتجاوز المخزون المتاح — راجع الكميات
            </div>
          )}

          <div data-help="bt-form-items" className="rounded-2xl border p-3 shadow-sm" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
          <div className="flex items-center justify-between px-1 py-1.5 shrink-0">
            <div className="text-2sm font-bold text-slate-500">الأصناف ({lines.length})</div>
            <div ref={colSettingsRef} className="relative">
              <button onClick={() => setColSettingsOpen(p => !p)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                title="تخصيص الأعمدة"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              {colSettingsOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                  <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">الأعمدة الظاهرة</div>
                  {ALL_COLUMNS.filter(c => c !== "index" && c !== "actions").map(cid => {
                    const labels = { code: "الكود", name: "البيان", unit: "الوحدة", warehouse: "المخزن", quantity: "الكمية", unit_cost: "التكلفة", selling_price: "سعر البيع", profit_pct: "نسبة الربح", wholesale_price: "جملة", locks: "قفل", total_cost: "الإجمالي" };
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

          <DataGrid
            data={lines}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف في مسودة المستند"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2 text-slate-300" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-xl border border-slate-200 shadow-sm max-h-[440px]"
            rowClass={isReceive ? (l) => {
              const anyUnlocked = l.update_master_purchase_price === false || l.update_master_purchase_price === 0 ||
                                  l.update_master_sale_price === false || l.update_master_sale_price === 0 ||
                                  l.update_master_wholesale_price === false || l.update_master_wholesale_price === 0;
              return anyUnlocked ? "!bg-amber-50" : "";
            } : undefined}
            columns={columns}
          />
          </div>

          {priceChangedLines.length > 0 && (
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
      </div>

      {/* Sticky Bottom Bar (shown when sidebar collapsed) */}
      <BranchTransferFormBottomBar
        forceShow={panelEffectiveCollapsed}
        totalQty={totalQty}
        totalCost={totalCost}
        totalSell={totalSell}
        isReceive={isReceive}
        onSave={handleSaveClick}
        onPrint={() => setPreviewOpen(true)}
        isSaving={isSaving}
        linesLength={lines.length}
        hasErrors={hasStockErrors}
        partnerBranch={partnerBranch}
        branches={branches}
        onPartnerBranchChange={setPartnerBranch}
        onManageBranches={handleManageBranches}
      />

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        docType="branch_transfer"
        invoice={invoiceDummy}
        settings={storeSettings}
        operationLabel={isReceive ? "وثيقة استلام فروع" : "وثيقة تحويل فروع"}
        onConfirmPrint={doSave}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={() => { setPreviewOpen(false); handleSaveClick(); }}
        saveOnlyLabel="حفظ بدون طباعة"
        isSaving={isSaving}
      />

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
      />

      {/* Today's transfers modal */}
      <BranchTransferTodayModal open={todayModalOpen} onClose={() => setTodayModalOpen(false)} />

      {/* Advanced stock search modal */}
      <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />

      {/* Cancel transfer confirmation modal */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-[15px] font-black text-slate-800">إلغاء المستند</p>
                <p className="text-2sm text-slate-500">سيتم عكس حركة المخزون بالكامل</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-2sm font-black text-slate-600">سبب الإلغاء *</label>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="أدخل سبب الإلغاء..."
                className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setCancelConfirmOpen(false); setCancelReason(""); }}
                className="flex-1 h-[44px] rounded-[10px] border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                تراجع
              </button>
              <button
                onClick={handleCancelTransfer}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 h-[44px] rounded-[10px] bg-rose-600 text-sm font-black text-white hover:bg-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Help Modal */}
      {priceHelpOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPriceHelpOpen(false)}>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Info size={14} className="text-indigo-600" />
                </div>
                <span className="text-[13px] font-black text-slate-800">خيارات تحديث السعر</span>
              </div>
              <button onClick={() => setPriceHelpOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-emerald-800 mb-1">يحدّث السعر الأساسي للصنف</p>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">السعر هيتغير، وأي فاتورة جديدة هتشوف السعر ده تلقائي.</p>
                    <p className="text-[10px] text-emerald-600 mt-1.5 bg-emerald-100 rounded px-2 py-1">★ مثال: المورد رفع سعره — اختار دة عشان السعر الجديد يظهر في كل الفواتير الجاية.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-amber-800 mb-1">للمستند ده بس</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">السعر ده للمستند ده بس. مش هيتغير في أي تعامل تاني.</p>
                    <p className="text-[10px] text-amber-600 mt-1.5 bg-amber-100 rounded px-2 py-1">★ مثال: اتفقت مع المورد على سعر خاص للطلبية دي — اختار دة عشان السعر الأساسي ما يتغيرش.</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center">تقدر تغيّر الخيار دة لكل سعر لوحده من خلال الزر الصغيّر جنب كل سعر</p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setPriceHelpOpen(false)} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px] font-bold hover:bg-indigo-700 transition-colors">فهمت</button>
            </div>
          </div>
        </div>
      )}

      {/* Price Update Report Modal */}
      <Modal open={priceReportOpen} onClose={() => setPriceReportOpen(false)} title="تقرير تحديث الأسعار" showDetach={false}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-2sm font-bold text-amber-700 leading-relaxed">
              سيتم تحديث أسعار البيع التالية عند حفظ المستند. راجع التغييرات قبل المتابعة.
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
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">مستند بس</span>
              <span className="text-[10px] text-slate-500">للمستند ده بس، السعر الأساسي ما يتغيرش</span>
            </span>
          </div>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500">التكلفة (قبل)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500">التكلفة (بعد)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500">سعر البيع (قبل)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500">سعر البيع (بعد)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500">جملة (قبل)</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500">جملة (بعد)</th>
                </tr>
              </thead>
              <tbody>
                {priceChangedLines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                     <td className="px-3 py-2 font-bold text-slate-800 max-w-[140px] whitespace-normal break-words leading-tight">{l.item_name}</td>
                    <td className="px-3 py-2 text-center number-fmt text-slate-400">{Number(l.original_purchase_price) > 0 ? Number(l.original_purchase_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center number-fmt-primary">
                      {Number(l.unit_cost) > 0 && Number(l.unit_cost) !== Number(l.original_purchase_price) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={Number(l.unit_cost) > Number(l.original_purchase_price) ? "text-rose-600" : "text-emerald-600"}>{Number(l.unit_cost).toFixed(2)}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${l.update_master_purchase_price !== false ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {l.update_master_purchase_price !== false ? "يحدّث" : "مستند بس"}
                          </span>
                        </div>
                      ) : <span className="text-slate-400">{Number(l.unit_cost) > 0 ? Number(l.unit_cost).toFixed(2) : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 text-center number-fmt text-slate-400">{Number(l.original_sale_price) > 0 ? Number(l.original_sale_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center number-fmt-primary">
                      {Number(l.selling_price) > 0 && Number(l.selling_price) !== Number(l.original_sale_price) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={Number(l.selling_price) > Number(l.original_sale_price) ? "text-rose-600" : "text-emerald-600"}>{Number(l.selling_price).toFixed(2)}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${l.update_master_sale_price !== false ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {l.update_master_sale_price !== false ? "يحدّث" : "مستند بس"}
                          </span>
                        </div>
                      ) : <span className="text-slate-400">{Number(l.selling_price) > 0 ? Number(l.selling_price).toFixed(2) : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 text-center number-fmt text-slate-400">{Number(l.original_wholesale_price) > 0 ? Number(l.original_wholesale_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center number-fmt-primary">
                      {Number(l.wholesale_price) > 0 && Number(l.wholesale_price) !== Number(l.original_wholesale_price) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={Number(l.wholesale_price) > Number(l.original_wholesale_price) ? "text-rose-600" : "text-emerald-600"}>{Number(l.wholesale_price).toFixed(2)}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${l.update_master_wholesale_price !== false ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {l.update_master_wholesale_price !== false ? "يحدّث" : "مستند بس"}
                          </span>
                        </div>
                      ) : <span className="text-slate-400">{Number(l.wholesale_price) > 0 ? Number(l.wholesale_price).toFixed(2) : "—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setPriceReportOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin inline ml-1" /> جاري الحفظ...</> : "تأكيد وحفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Save Confirmation Modal */}
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title={isEditMode ? "تأكيد تعديل المستند" : "تأكيد حفظ المستند"} showDetach={false}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">
                {isEditMode ? "هل تريد حفظ التعديلات؟" : "هل تريد حفظ هذا المستند؟"}
              </h3>
              <p className="text-2sm font-bold text-slate-500 leading-relaxed">
                {lines.length} صنف — إجمالي الكميات: {formatNumber(totalQty, { decimals: 0 })}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setSaveConfirmOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin inline ml-1" /> جاري الحفظ...</> : "نعم، احفظ"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
