import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeft, Package, ImageIcon,
  Trash2, Warehouse, FileText, Settings, Printer, CheckCircle, ShoppingCart, Plus, CalendarClock,
  ZoomIn, ZoomOut, Maximize, ChevronDown, Hash, Clock, Search, Layers,
  AlertTriangle, TrendingUp, Lock, Loader2, ExternalLink, CheckCircle2,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import DataGrid from "../../components/ui/DataGrid";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import PermissionGate from "../../components/ui/PermissionGate";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import BranchTransferTodayModal from "../../components/operations/BranchTransferTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";

const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5000");
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function fmtDateTime(d) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
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

  const [storeSettings, setStoreSettings] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [units, setUnits] = useState([]);
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
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", unitId: "", warehouseId: "" });
  const [stagingLocks, setStagingLocks] = useState({ purchase: true, sale: true, wholesale: true });
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
  const unitSelectRef     = useRef(null);
  const qtyInputRef       = useRef(null);
  const costInputRef      = useRef(null);
  const sellInputRef      = useRef(null);
  const wholesaleInputRef = useRef(null);
  const addBtnRef         = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);

  const handleFieldKeyDown = (e, nextRef, prevRef, isEnterSubmit = false) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (prevRef?.current) { prevRef.current.focus(); if (prevRef.current.select) prevRef.current.select(); }
      } else {
        if (isEnterSubmit) addLine();
        else if (nextRef?.current) { nextRef.current.focus(); if (nextRef.current.select) nextRef.current.select(); }
      }
    }
  };

  // Load master data
  useEffect(() => {
    api.get("/api/settings").then(r => setStoreSettings(r.data.data || {})).catch(() => {});
    api.get("/api/branches").then(r => setBranches(r.data.data || [])).catch(() => {});
    api.get("/api/warehouses").then(r => {
      const data = r.data.data || [];
      setWarehouses(data);
      if (data.length > 0) setStaging(s => ({ ...s, warehouseId: String(data[0].id) }));
    }).catch(() => {});
    api.get("/api/units").then(r => setUnits(r.data.data || [])).catch(() => {});
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
    if (!q) { setFilteredItems([]); setItemOffset(0); setItemHasMore(false); itemSearchActiveRef.current = false; return; }
    itemSearchActiveRef.current = true;
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
          const rows = r.data.data || [];
          setFilteredItems(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
          if (pendingPickRef.current && rows.length > 0) {
            pendingPickRef.current = false;
            handlePickItem(rows[0]);
          } else {
            pendingPickRef.current = false;
          }
        }).catch(() => { pendingPickRef.current = false; })
        .finally(() => { itemSearchActiveRef.current = false; });
    }, 250);
    return () => { clearTimeout(t); itemSearchActiveRef.current = false; };
  }, [itemQuery]);

  function loadMoreItems() {
    const q = itemQuery.trim();
    if (!itemHasMore || !q || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = r.data.data || [];
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function handlePickItem(item) {
    setSelectedItem(item);
    setItemQuery(item.name);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setLookupOpen(false);
    const iStock = stockLevels[item.id] || {};
    let bestWhId = "";
    let max = -Infinity;
    for (const [wId, qty] of Object.entries(iStock)) {
      if (qty > max) { max = qty; bestWhId = wId; }
    }
    setStaging(s => ({
      ...s,
      unitCost: String(item.purchase_price || 0),
      sellingPrice: String(item.sale_price || 0),
      wholesalePrice: String(item.wholesale_price || 0),
      unitId: String(item.unit_id || ""),
      warehouseId: bestWhId || s.warehouseId,
    }));
    setTimeout(() => {
      if (warehouseTableRef.current) warehouseTableRef.current.focus();
    }, 50);
  }

  function handleItemKeyDown(e) {
    if (!lookupOpen) {
      handleFieldKeyDown(e, warehouseTableRef, null);
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
    const selectedUnit = units.find(u => String(u.id) === String(uId));
    const selectedWarehouse = warehouses.find(w => String(w.id) === String(whId));

    const wholesale = Math.max(0, Number(staging.wholesalePrice) || 0);

    setLines(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      code: selectedItem.item_code || selectedItem.code || "-",
      unit_id: uId,
      unit_name: selectedUnit ? selectedUnit.name : (selectedItem.unit_name || ""),
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
    }]);

    setSelectedItem(null);
    setItemQuery("");
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

  const priceChangedLines = useMemo(() => {
    if (!isReceive) return [];
    return lines.filter(l =>
      (Number(l.selling_price)    !== Number(l.original_sale_price)      && Number(l.selling_price)    > 0) ||
      (Number(l.wholesale_price)  !== Number(l.original_wholesale_price) && Number(l.wholesale_price)  > 0) ||
      (Number(l.unit_cost)        !== Number(l.original_purchase_price)  && Number(l.unit_cost)        > 0)
    );
  }, [lines, isReceive]);

  const availableStock = useMemo(() => {
    if (!selectedItem || !staging.warehouseId) return null;
    return stockLevels[selectedItem.id]?.[staging.warehouseId] ?? 0;
  }, [selectedItem, staging.warehouseId, stockLevels]);

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
        total: `${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`,
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
      id: "image", header: "صورة", width: 55, sortable: false, headerClass: "text-center", cellClass: "p-1.5 border-l border-slate-100 flex items-center justify-center",
      render: (l) => l.primary_image_url ? (
        <img
          src={resolveImageUrl(l.primary_image_url)}
          alt="product"
          className="w-9 h-9 object-cover rounded-[8px] cursor-pointer hover:scale-110 transition-transform shadow-sm border border-slate-200"
          onClick={() => { setImagePreviewUrl(l.primary_image_url); setImageModalOpen(true); }}
        />
      ) : (
        <div className="w-9 h-9 rounded-[8px] bg-slate-100 flex items-center justify-center border border-slate-200 shadow-inner">
          <Package className="w-4 h-4 text-slate-300"/>
        </div>
      ),
    },
    {
      id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[11px] font-black tracking-wider text-slate-500 border-l border-slate-100 text-center",
      render: (l) => l.code,
    },
    {
      id: "name", header: "البيان", width: 160, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
      render: (l) => l.item_name,
    },
    {
      id: "unit", header: "الوحدة", width: 80, sortable: false, headerClass: "text-center", cellClass: "text-center text-[12px] font-bold text-slate-500 border-l border-slate-100",
      render: (l) => l.unit_name || "—",
    },
    {
      id: "warehouse", header: "المخزن", width: 110, sortable: true, headerClass: "text-center", cellClass: "text-center text-[12px] font-bold text-slate-600 border-l border-slate-100",
      render: (l) => l.warehouse_name || "—",
    },
    {
      id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
      render: (l, i) => (
        <input
          type="number" min="0.001" step="any"
          value={l.quantity}
          onChange={(e) => updateLineField(i, "quantity", Number(e.target.value))}
          className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-indigo-50/50 transition-colors"
        />
      ),
    },
  ];

  const extraColumns = [
    {
      id: "unit_cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
      render: (l, i) => {
        const changed = isReceive && Number(l.unit_cost) !== Number(l.original_purchase_price) && Number(l.unit_cost) > 0;
        return (
          <div className="relative w-full h-full">
            <input
              type="number" step="any"
              value={l.unit_cost}
              onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))}
              className={`w-full h-[40px] text-center text-[13px] font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`}
            />
            {changed && <span title={`التكلفة الحالية: ${l.original_purchase_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />}
          </div>
        );
      },
    },
    ...(isReceive ? [
      {
        id: "selling_price", header: "سعر البيع", width: 110, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const changed = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0;
          return (
            <div className="relative w-full h-full">
              <input
                type="number" step="any"
                value={l.selling_price}
                onChange={(e) => updateLineField(i, "selling_price", Number(e.target.value))}
                className={`w-full h-[40px] text-center text-[13px] font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-amber-50/50 text-amber-700"}`}
              />
              {changed && <span title={`السعر الحالي: ${l.original_sale_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />}
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
              className="w-full h-[40px] text-center text-[12px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-blue-50/50 text-blue-700 transition-colors"
            />
          );
        },
      },
      {
        id: "wholesale_price", header: "جملة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const changed = Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0;
          return (
            <div className="relative w-full h-full">
              <input
                type="number" step="any"
                value={l.wholesale_price ?? 0}
                onChange={(e) => updateLineField(i, "wholesale_price", Number(e.target.value))}
                className={`w-full h-[40px] text-center text-[13px] font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`}
              />
              {changed && <span title={`السعر الحالي: ${l.original_wholesale_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />}
            </div>
          );
        },
      },
      {
        id: "locks", header: "قفل", width: 80, sortable: false, headerClass: "text-center px-1", cellClass: "p-0 border-l border-slate-100",
        render: (l, i) => {
          const mk = (label, lockKey) => {
            const on = l[lockKey] !== false && l[lockKey] !== 0;
            return (
              <button
                title={on ? `${label}: يحدّث السعر الرئيسي` : `${label}: للمستند فقط`}
                onClick={() => updateLineField(i, lockKey, !on)}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold transition-all leading-none ${
                  on ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-amber-100 text-amber-700 border border-amber-300"
                }`}>
                <Lock size={7} className={on ? "" : "opacity-50"} />
                {label}
              </button>
            );
          };
          return (
            <div className="flex flex-col items-center gap-0.5 py-1 px-1">
              {mk("ش", "update_master_purchase_price")}
              {mk("ب", "update_master_sale_price")}
              {mk("ج", "update_master_wholesale_price")}
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
            className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-amber-50/50 text-amber-700 transition-colors"
          />
        ),
      },
    ]),
    {
      id: "total_cost", header: "الإجمالي", width: 110, sortable: false, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black text-slate-700 border-l border-slate-100",
      render: (l) => Number(l.quantity * l.unit_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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

  const columns = [...baseColumns, ...extraColumns, actionsColumn];

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
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="صورة المنتج" maxWidth="max-w-2xl">
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
      <header className={`print:hidden relative mb-6 overflow-hidden rounded-[24px] bg-gradient-to-l ${theme.gradient} px-8 py-6 shadow-xl ${theme.shadow}`}>
        <div className="absolute top-0 right-0 h-full w-full opacity-10 pointer-events-none">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,100 L100,0 Z" fill="white" />
          </svg>
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.2)] backdrop-blur-md border border-white/30">
              {isReceive ? <ArrowDownToLine className="h-7 w-7 text-white" /> : <ArrowUpFromLine className="h-7 w-7 text-white" />}
            </div>
            <div>
              <h1 className="text-[24px] font-black tracking-tight text-white drop-shadow-md">
                {isEditMode ? "تعديل مستند" : (isReceive ? "أمر استلام بضاعة" : "أمر صرف وتحويل")}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-[12px] font-bold text-white shadow-inner backdrop-blur-sm border border-white/20">
                  <CalendarClock className="h-3 w-3" />
                  {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                {isEditMode && (
                  <span className="text-white/80 text-[12px] font-bold bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                    وضع التعديل
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Doc number + datetime + action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Price-change count badge — receive only */}
            {priceChangedLines.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-400/90 px-3 py-1 text-[12px] font-black text-amber-900 shadow-inner">
                <TrendingUp className="h-3.5 w-3.5" />
                {priceChangedLines.length} أسعار ستتغير
              </div>
            )}
            {/* Draft / locked ref & time */}
            {(displayRef || displayDate) && (
              <div className="flex items-center gap-2">
                {displayRef && (
                  <div className="flex items-center gap-1.5 rounded-[10px] bg-white/15 border border-white/25 px-3 py-2 backdrop-blur-sm">
                    <Hash className="h-3.5 w-3.5 text-white/70" />
                    <span className="font-mono text-[13px] font-black text-white tracking-wider">{displayRef}</span>
                    {isEditMode && <span className="text-white/50 text-[10px] mr-1">• مقفل</span>}
                  </div>
                )}
                {displayDate && (
                  <div className="flex items-center gap-1.5 rounded-[10px] bg-white/15 border border-white/25 px-3 py-2 backdrop-blur-sm">
                    <Clock className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-[12px] font-bold text-white/90">{fmtDateTime(displayDate)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Today's transfers button */}
            <button
              onClick={() => setTodayModalOpen(true)}
              className="flex items-center gap-2 rounded-[12px] bg-white/15 border border-white/25 px-4 py-2.5 text-[13px] font-bold text-white backdrop-blur-sm hover:bg-white/25 transition-all"
              title="مستندات النقل"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">المستندات</span>
            </button>

            {/* Advanced stock search button */}
            <button
              onClick={() => setAdvancedSearchOpen(true)}
              className="flex items-center gap-2 rounded-[12px] bg-white/15 border border-white/25 px-4 py-2.5 text-[13px] font-bold text-white backdrop-blur-sm hover:bg-white/25 transition-all"
              title="بحث متقدم في المخزون"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">المخزون</span>
            </button>

            <button onClick={() => navigate("/operations/branch-transfer")} className="group flex items-center gap-2 rounded-[12px] bg-white/10 px-5 py-2.5 text-[13px] font-bold text-white border border-white/20 shadow-sm backdrop-blur-md hover:bg-white/20 hover:scale-[1.02] transition-all active:scale-95">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              رجوع
            </button>
          </div>
        </div>
      </header>

      <div className="print:hidden grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] items-start">

        {/* Sidebar */}
        <div className="flex flex-col gap-5 sticky top-4">

          {/* Partner branch */}
          <div className="rounded-[20px] border border-white bg-white/60 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className={`p-2 rounded-[10px] bg-${theme.primary}-100 text-${theme.primary}-600`}>
                <Warehouse className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-black text-slate-800 tracking-tight">معلومات الحركة</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-slate-500 mr-1">
                {isReceive ? "الفرع المُرسل" : "الفرع المُستلم"}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={partnerBranch}
                    onChange={e => setPartnerBranch(e.target.value)}
                    className={`w-full appearance-none rounded-[10px] border border-slate-200/80 px-4 py-3 text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-2 bg-white shadow-inner transition-all hover:border-slate-300 focus:border-${theme.primary}-500 focus:ring-${theme.primary}-500/20`}
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
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="اكتب الملاحظات واسم المندوب..."
              rows={3}
              className={`w-full resize-none rounded-[10px] border border-slate-200/80 px-4 py-3 text-[13px] font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 bg-white shadow-inner transition-all hover:border-slate-300 focus:border-${theme.primary}-500 focus:ring-${theme.primary}-500/20 custom-scrollbar`}
            />
          </div>

          {/* Totals & actions */}
          <div className="rounded-[20px] bg-white p-6 shadow-[0_15px_40px_rgb(0,0,0,0.08)] border border-slate-100 flex flex-col gap-5">
            <div className="flex flex-col gap-3 bg-slate-50/50 rounded-[14px] py-5 px-4 border border-slate-100 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">إجمالي الكميات</span>
                <span className={`text-3xl font-black font-mono text-${theme.primary}-600`}>{totalQty.toLocaleString("en-US")}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">إجمالي التكلفة</span>
                <span className="text-2xl font-black font-mono text-slate-700">
                  {totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <PermissionGate page="branch_transfer" action="print">
                <button
                  onClick={() => setPreviewOpen(true)}
                  disabled={isSaving || !lines.length || !partnerBranch}
                  className={`w-full h-[52px] flex items-center justify-center gap-2.5 rounded-[12px] text-[15px] font-black text-white transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.12)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-gradient-to-l ${theme.gradient}`}
                >
                  <Printer className="h-5 w-5" />
                  طباعة ومراجعة المستند
                </button>
              </PermissionGate>

              <PermissionGate page="branch_transfer" action={isEditMode ? "edit" : "add"}>
                <button
                  onClick={() => handleSaveClick()}
                  disabled={isSaving || !lines.length || !partnerBranch}
                  className="w-full h-[46px] flex items-center justify-center gap-2 rounded-[12px] bg-slate-100 border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري...</> : <><CheckCircle className="h-4 w-4" /> {isEditMode ? "حفظ التعديلات" : "حفظ بدون طباعة"}</>}
                </button>
              </PermissionGate>

              {isEditMode && (
                <PermissionGate page="branch_transfer" action="delete">
                  <button
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={isSaving || isCancelling}
                    className="w-full h-[46px] flex items-center justify-center gap-2 rounded-[12px] bg-rose-50 border border-rose-200 text-[14px] font-bold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                    إلغاء المستند
                  </button>
                </PermissionGate>
              )}
            </div>
          </div>
        </div>

        {/* Right: item entry + lines */}
        <div className="flex flex-col gap-5">

          {/* Item entry bar */}
          <section className="bg-white border gap-3 text-center border-slate-200 rounded-[16px] p-4 shadow-[0_5px_20px_rgba(0,0,0,0.03)] relative z-40">
            <div className="flex flex-row items-center justify-center gap-3 flex-wrap xl:flex-nowrap">

              {selectedItem && (
                <div
                  className="w-14 h-14 mt-[22px] shrink-0 rounded-[12px] border-2 border-indigo-100 overflow-hidden shadow-md group relative bg-white flex items-center justify-center cursor-pointer"
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
              <div className="relative flex-[2.5] min-w-[240px] flex flex-col">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block text-center">المادة / الصنف (بحث)</label>
                <SearchInput
                  ref={itemInputRef}
                  value={itemQuery}
                  onChange={(val) => { setItemQuery(val); setLookupOpen(true); setSelectedItem(null); }}
                  onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
                  onBlur={() => setTimeout(() => setLookupOpen(false), 150)}
                  onKeyDown={handleItemKeyDown}
                  placeholder="ابحث بالاسم أو كود SKU..."
                  autoFocus
                  className="w-full"
                  inputClassName="h-11 bg-slate-50/50"
                />
                {selectedItem && (
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[10px] font-black font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 tracking-wide">
                      {selectedItem.item_code || selectedItem.code || `#${selectedItem.id}`}
                    </span>
                  </div>
                )}
                {lookupOpen && itemQuery && (
                  <SearchDropdown
                    items={filteredItems}
                    onPick={handlePickItem}
                    activeIndex={activeIndex}
                    query={itemQuery}
                    onLoadMore={loadMoreItems}
                    hasMoreFromServer={itemHasMore}
                    isLoadingMore={isLoadingMoreItems}
                  />
                )}
              </div>

              {/* Warehouse table */}
              <div className="flex flex-col gap-1.5 w-[150px] shrink-0">
                <label className="text-[11px] font-bold text-slate-500 text-center">المخزن</label>
                <div
                  ref={warehouseTableRef}
                  tabIndex={0}
                  className="border border-slate-200 rounded-[10px] bg-slate-50/50 overflow-y-auto outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
                  style={{ height: "80px" }}
                  onKeyDown={(e) => {
                    const idx = warehouses.findIndex(w => String(w.id) === String(staging.warehouseId));
                    if (e.key === "ArrowDown") { e.preventDefault(); const next = warehouses[Math.min(idx + 1, warehouses.length - 1)]; if (next) setStaging(s => ({ ...s, warehouseId: String(next.id) })); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); const prev = warehouses[Math.max(idx - 1, 0)]; if (prev) setStaging(s => ({ ...s, warehouseId: String(prev.id) })); }
                    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); unitSelectRef.current?.focus(); unitSelectRef.current?.select?.(); }
                  }}
                >
                  <table className="w-full text-[10px] border-collapse">
                    <tbody>
                      {warehouses.map(w => {
                        const qty = selectedItem ? (stockLevels[selectedItem.id]?.[w.id] || 0) : 0;
                        const isSelected = String(staging.warehouseId) === String(w.id);
                        return (
                          <tr key={w.id}
                            onClick={() => { setStaging(s => ({ ...s, warehouseId: String(w.id) })); warehouseTableRef.current?.focus(); }}
                            className={`cursor-pointer border-b border-slate-200 last:border-0 transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-100"}`}
                          >
                            <td className={`px-2 py-1 font-bold truncate ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{w.name}</td>
                            <td className={`px-2 py-1 font-mono text-center tabular-nums ${qty > 0 ? "text-emerald-600 font-black" : "text-slate-400"}`}>{qty}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unit */}
              <div className="flex flex-col gap-1.5 w-[90px] shrink-0">
                <label className="text-[11px] font-bold text-slate-500 text-center">الوحدة</label>
                <div className="relative">
                  <select
                    ref={unitSelectRef}
                    value={staging.unitId}
                    onChange={e => setStaging(s => ({ ...s, unitId: e.target.value }))}
                    onKeyDown={(e) => handleFieldKeyDown(e, costInputRef, warehouseTableRef)}
                    className={`w-full h-11 appearance-none border border-slate-200 rounded-[10px] bg-slate-50/50 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-${theme.primary}-500 focus:bg-white focus:ring-4 focus:ring-${theme.primary}-500/10 transition-all shadow-inner`}
                  >
                    <option value="">أساسية</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <ChevronDown className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
              </div>

              {/* Cost / Price */}
              <div className="flex flex-col gap-1 w-[100px] shrink-0">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500">{isReceive ? "التكلفة" : "السعر"}</label>
                  {isReceive && (
                    <button type="button"
                      onClick={() => setStagingLocks(l => ({ ...l, purchase: !l.purchase }))}
                      title={stagingLocks.purchase ? "يحدّث السعر الرئيسي — اضغط لإلغاء" : "للمستند فقط — اضغط للتحديث"}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold transition-all ${
                        stagingLocks.purchase ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-amber-100 text-amber-700 border border-amber-300"
                      }`}>
                      <Lock size={8} className={stagingLocks.purchase ? "" : "opacity-50"} />
                      {stagingLocks.purchase ? "يحدّث" : "للمستند"}
                    </button>
                  )}
                </div>
                <input
                  ref={costInputRef}
                  type="number" step="any"
                  value={staging.unitCost}
                  onChange={e => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, sellInputRef, unitSelectRef)}
                  className={`w-full h-11 border rounded-[10px] px-1 text-[13px] font-mono font-black text-slate-800 outline-none transition-all shadow-inner text-center ${
                    isReceive && !stagingLocks.purchase
                      ? "border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                      : isReceive && selectedItem && Number(staging.unitCost) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price)
                        ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-400/10"
                        : `border-slate-200 bg-slate-50/50 focus:border-${theme.primary}-500 focus:bg-white focus:ring-4 focus:ring-${theme.primary}-500/10`
                  }`}
                />
                {isReceive && selectedItem && Number(staging.unitCost) > 0 && Number(selectedItem.purchase_price) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && (
                  <span className="text-[9px] text-center leading-tight">
                    <span className="text-slate-400 font-mono">{Number(selectedItem.purchase_price).toFixed(2)}</span>
                    <span className="text-slate-300 mx-0.5">→</span>
                    <span className={`font-mono font-black ${Number(staging.unitCost) > Number(selectedItem.purchase_price) ? "text-rose-500" : "text-emerald-600"}`}>
                      {Number(staging.unitCost).toFixed(2)}
                    </span>
                  </span>
                )}
              </div>

              {/* Selling price */}
              <div className="flex flex-col gap-1 w-[100px] shrink-0">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500">{isReceive ? "سعر البيع" : "مستهلك"}</label>
                  {isReceive && (
                    <button type="button"
                      onClick={() => setStagingLocks(l => ({ ...l, sale: !l.sale }))}
                      title={stagingLocks.sale ? "يحدّث السعر الرئيسي — اضغط لإلغاء" : "للمستند فقط — اضغط للتحديث"}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold transition-all ${
                        stagingLocks.sale ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-amber-100 text-amber-700 border border-amber-300"
                      }`}>
                      <Lock size={8} className={stagingLocks.sale ? "" : "opacity-50"} />
                      {stagingLocks.sale ? "يحدّث" : "للمستند"}
                    </button>
                  )}
                </div>
                <input
                  ref={sellInputRef}
                  type="number" step="any"
                  value={staging.sellingPrice}
                  onChange={e => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, isReceive ? wholesaleInputRef : qtyInputRef, costInputRef)}
                  className={`w-full h-11 border rounded-[10px] px-1 text-[13px] font-mono font-black text-slate-800 outline-none transition-all shadow-inner text-center ${
                    isReceive && !stagingLocks.sale
                      ? "border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                      : isReceive && selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price)
                        ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-400/10"
                        : "border-slate-200 bg-slate-50/50 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10"
                  }`}
                />
                {isReceive && selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && (
                  <span className="text-[9px] text-center leading-tight">
                    <span className="text-slate-400 font-mono">{Number(selectedItem.sale_price || 0).toFixed(2)}</span>
                    <span className="text-slate-300 mx-0.5">→</span>
                    <span className={`font-mono font-black ${Number(staging.sellingPrice) > Number(selectedItem.sale_price) ? "text-rose-500" : "text-emerald-600"}`}>
                      {Number(staging.sellingPrice).toFixed(2)}
                    </span>
                  </span>
                )}
              </div>

              {/* Wholesale price — receive only */}
              {isReceive && (
                <div className="flex flex-col gap-1 w-[100px] shrink-0">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500">جملة</label>
                    <button type="button"
                      onClick={() => setStagingLocks(l => ({ ...l, wholesale: !l.wholesale }))}
                      title={stagingLocks.wholesale ? "يحدّث السعر الرئيسي — اضغط لإلغاء" : "للمستند فقط — اضغط للتحديث"}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold transition-all ${
                        stagingLocks.wholesale ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-amber-100 text-amber-700 border border-amber-300"
                      }`}>
                      <Lock size={8} className={stagingLocks.wholesale ? "" : "opacity-50"} />
                      {stagingLocks.wholesale ? "يحدّث" : "للمستند"}
                    </button>
                  </div>
                  <input
                    ref={wholesaleInputRef}
                    type="number" step="any"
                    value={staging.wholesalePrice}
                    onChange={e => setStaging(s => ({ ...s, wholesalePrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, qtyInputRef, sellInputRef)}
                    className={`w-full h-11 border rounded-[10px] px-1 text-[13px] font-mono font-black text-slate-800 outline-none transition-all shadow-inner text-center ${
                      !stagingLocks.wholesale
                        ? "border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                        : selectedItem && Number(staging.wholesalePrice) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price)
                          ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-400/10"
                          : "border-slate-200 bg-slate-50/50 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-400/10"
                    }`}
                  />
                  {selectedItem && Number(staging.wholesalePrice) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && (
                    <span className="text-[9px] text-center leading-tight">
                      <span className="text-slate-400 font-mono">{Number(selectedItem.wholesale_price || 0).toFixed(2)}</span>
                      <span className="text-slate-300 mx-0.5">→</span>
                      <span className={`font-mono font-black ${Number(staging.wholesalePrice) > Number(selectedItem.wholesale_price) ? "text-rose-500" : "text-emerald-600"}`}>
                        {Number(staging.wholesalePrice).toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div className="flex flex-col gap-1.5 w-[75px] shrink-0">
                <label className="text-[11px] font-bold text-slate-500 text-center">الكمية</label>
                {availableStock !== null && (
                  <span className="text-[10px] font-bold text-slate-400 text-center -mb-1">متاح: {availableStock}</span>
                )}
                <input
                  ref={qtyInputRef}
                  type="number" min="0.001" step="any"
                  value={staging.quantity}
                  onChange={e => setStaging(s => ({ ...s, quantity: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, addBtnRef, sellInputRef, false)}
                  className="w-full h-11 border border-slate-200 rounded-[10px] bg-slate-50/50 px-1 text-[14px] font-mono font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner text-center"
                />
              </div>

              {/* Add button */}
              <button
                ref={addBtnRef}
                onClick={addLine}
                onKeyDown={(e) => handleFieldKeyDown(e, itemInputRef, qtyInputRef, true)}
                disabled={!selectedItem}
                className="flex mt-[22px] h-11 w-[90px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-slate-800 text-[13px] font-black text-white shadow-md hover:bg-slate-700 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-all focus:ring-4 focus:ring-slate-800/20"
              >
                <Plus className="h-4 w-4" /> إضافة
              </button>
            </div>
          </section>

          {/* Lines table */}
          {priceChangedLines.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-700 font-bold shrink-0 border border-amber-200 rounded-md">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              سيتم تحديث أسعار البيع لـ {priceChangedLines.map(l => l.item_name).join("، ")}
              <Link to="/operations/bulk-price-update" className="mr-auto flex items-center gap-1 text-amber-600 hover:underline">
                <ExternalLink className="h-3 w-3" /> سجل الأسعار
              </Link>
            </div>
          )}

          <DataGrid
            data={lines}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف في مسودة المستند"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2 text-slate-300" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-[16px] border border-slate-200 shadow-[0_5px_20px_rgba(0,0,0,0.03)] min-h-[350px]"
            rowClass={isReceive ? (l) => {
              const anyUnlocked = l.update_master_purchase_price === false || l.update_master_purchase_price === 0 ||
                                  l.update_master_sale_price === false || l.update_master_sale_price === 0 ||
                                  l.update_master_wholesale_price === false || l.update_master_wholesale_price === 0;
              return anyUnlocked ? "!bg-amber-50" : "";
            } : undefined}
            columns={columns}
          />
        </div>
      </div>

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
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
                <p className="text-[12px] text-slate-500">سيتم عكس حركة المخزون بالكامل</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-black text-slate-600">سبب الإلغاء *</label>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="أدخل سبب الإلغاء..."
                className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setCancelConfirmOpen(false); setCancelReason(""); }}
                className="flex-1 h-[44px] rounded-[10px] border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                تراجع
              </button>
              <button
                onClick={handleCancelTransfer}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 h-[44px] rounded-[10px] bg-rose-600 text-[13px] font-black text-white hover:bg-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Update Report Modal */}
      <Modal open={priceReportOpen} onClose={() => setPriceReportOpen(false)} title="تقرير تحديث الأسعار">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[12px] font-bold text-amber-700 leading-relaxed">
              سيتم تحديث أسعار البيع التالية عند حفظ المستند. راجع التغييرات قبل المتابعة.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
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
                    <td className="px-3 py-2 font-bold text-slate-800 max-w-[140px] truncate">{l.item_name}</td>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">{Number(l.original_purchase_price) > 0 ? Number(l.original_purchase_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center font-mono font-black">
                      {Number(l.unit_cost) > 0 && Number(l.unit_cost) !== Number(l.original_purchase_price) ? (
                        <span className={Number(l.unit_cost) > Number(l.original_purchase_price) ? "text-rose-600" : "text-emerald-600"}>
                          {Number(l.unit_cost).toFixed(2)}
                        </span>
                      ) : <span className="text-slate-400">{Number(l.unit_cost) > 0 ? Number(l.unit_cost).toFixed(2) : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">{Number(l.original_sale_price) > 0 ? Number(l.original_sale_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center font-mono font-black">
                      {Number(l.selling_price) > 0 && Number(l.selling_price) !== Number(l.original_sale_price) ? (
                        <span className={Number(l.selling_price) > Number(l.original_sale_price) ? "text-rose-600" : "text-emerald-600"}>
                          {Number(l.selling_price).toFixed(2)}
                        </span>
                      ) : <span className="text-slate-400">{Number(l.selling_price) > 0 ? Number(l.selling_price).toFixed(2) : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">{Number(l.original_wholesale_price) > 0 ? Number(l.original_wholesale_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center font-mono font-black">
                      {Number(l.wholesale_price) > 0 && Number(l.wholesale_price) !== Number(l.original_wholesale_price) ? (
                        <span className={Number(l.wholesale_price) > Number(l.original_wholesale_price) ? "text-rose-600" : "text-emerald-600"}>
                          {Number(l.wholesale_price).toFixed(2)}
                        </span>
                      ) : <span className="text-slate-400">{Number(l.wholesale_price) > 0 ? Number(l.wholesale_price).toFixed(2) : "—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setPriceReportOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin inline ml-1" /> جاري الحفظ...</> : "تأكيد وحفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Save Confirmation Modal */}
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title={isEditMode ? "تأكيد تعديل المستند" : "تأكيد حفظ المستند"}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">
                {isEditMode ? "هل تريد حفظ التعديلات؟" : "هل تريد حفظ هذا المستند؟"}
              </h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                {lines.length} صنف — إجمالي الكميات: {totalQty.toLocaleString("en-US")}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setSaveConfirmOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin inline ml-1" /> جاري الحفظ...</> : "نعم، احفظ"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
