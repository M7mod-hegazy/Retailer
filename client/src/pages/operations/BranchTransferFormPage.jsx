import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeft, Package, ImageIcon,
  Trash2, Warehouse, FileText, Settings, Printer, CheckCircle, ShoppingCart, Plus, CalendarClock,
  ZoomIn, ZoomOut, Maximize, ChevronDown, Hash, Clock, Search, Layers,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import DataGrid from "../../components/ui/DataGrid";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import PermissionGate from "../../components/ui/PermissionGate";
import BranchTransferTodayModal from "../../components/operations/BranchTransferTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function fmtDateTime(d) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function LookupList({ items, onPick, activeIndex, query }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center text-[12px] font-bold text-slate-400 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        لا توجد نتائج
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-indigo-50/80" : "hover:bg-slate-50"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><Package className="w-4 h-4 text-slate-300"/></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[13px] font-black ${activeIndex === i ? "text-indigo-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[10px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || `#${item.id}`} query={query} /></span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.unit_name || ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
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
  const [items, setItems] = useState([]);
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

  const [itemQuery, setItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", unitId: "", warehouseId: "" });
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedDoc, setSavedDoc] = useState(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  // Header modals
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  const handleManageBranches = () => {
    if (lines.length > 0) setConfirmLeaveOpen(true);
    else navigate("/definitions/branches");
  };

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
  const itemInputRef = useRef(null);
  const warehouseTableRef = useRef(null);
  const unitSelectRef = useRef(null);
  const qtyInputRef = useRef(null);
  const costInputRef = useRef(null);
  const sellInputRef = useRef(null);
  const addBtnRef = useRef(null);

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
    api.get("/api/items").then(r => setItems(r.data.data || [])).catch(() => {});
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

  const filteredItems = useMemo(() => {
    const results = fuzzyFilterRows(items, itemQuery, ["name", "code", "item_code", "barcode"]).slice(0, 12);
    const q = (itemQuery || "").toLowerCase().trim();
    if (!q) return results;
    return [...results].sort((a, b) => {
      const aCode = (a.item_code || a.code || "").toLowerCase();
      const bCode = (b.item_code || b.code || "").toLowerCase();
      const aMatch = aCode.startsWith(q) || aCode === q;
      const bMatch = bCode.startsWith(q) || bCode === q;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }, [itemQuery, items]);

  function handlePickItem(item) {
    setSelectedItem(item);
    setItemQuery(item.name);
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
    if (e.key === "Enter" && filteredItems[activeIndex]) { handlePickItem(filteredItems[activeIndex]); }
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
      primary_image_url: selectedItem.primary_image_url || selectedItem.image_url || selectedItem.image || null,
    }]);

    setSelectedItem(null);
    setItemQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", unitId: "", warehouseId: s.warehouseId }));
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

  const availableStock = useMemo(() => {
    if (!selectedItem || !staging.warehouseId) return null;
    return stockLevels[selectedItem.id]?.[staging.warehouseId] ?? 0;
  }, [selectedItem, staging.warehouseId, stockLevels]);

  async function handleSave(triggerPrint = false) {
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
          unit_id: l.unit_id || undefined,
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
      toast.success(isEditMode ? "تم تحديث المستند بنجاح" : "تم تسجيل المستند بنجاح");

      if (triggerPrint) {
        setPreviewOpen(false);
        setTimeout(() => window.print(), 300);
        setTimeout(() => navigate("/operations/branch-transfer"), 1800);
      } else {
        navigate("/operations/branch-transfer");
      }
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
      render: (l, i) => (
        <input
          type="number" step="any"
          value={l.unit_cost}
          onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))}
          className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 text-slate-700 transition-colors"
        />
      ),
    },
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
    {
      id: "total_cost", header: "الإجمالي", width: 110, sortable: false, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black text-slate-700 border-l border-slate-100",
      render: (l) => Number(l.quantity * l.unit_cost).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 font-sans" dir="rtl">
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
                <span className={`text-3xl font-black font-mono text-${theme.primary}-600`}>{totalQty.toLocaleString("ar-EG")}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">إجمالي التكلفة</span>
                <span className="text-2xl font-black font-mono text-slate-700">
                  {totalCost.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <PermissionGate page="branch_transfer" action="print">
                <button
                  onClick={() => setPreviewOpen(true)}
                  disabled={isSaving || !lines.length}
                  className={`w-full h-[52px] flex items-center justify-center gap-2.5 rounded-[12px] text-[15px] font-black text-white transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.12)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-gradient-to-l ${theme.gradient}`}
                >
                  <Printer className="h-5 w-5" />
                  طباعة ومراجعة المستند
                </button>
              </PermissionGate>

              <PermissionGate page="branch_transfer" action={isEditMode ? "edit" : "add"}>
                <button
                  onClick={() => handleSave(false)}
                  disabled={isSaving || !lines.length}
                  className="w-full h-[46px] flex items-center justify-center gap-2 rounded-[12px] bg-slate-100 border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" />
                  {isEditMode ? "حفظ التعديلات" : "حفظ بدون طباعة"}
                </button>
              </PermissionGate>
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
                  <LookupList items={filteredItems} onPick={handlePickItem} activeIndex={activeIndex} query={itemQuery} />
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
              <div className="flex flex-col gap-1.5 w-[90px] shrink-0">
                <label className="text-[11px] font-bold text-slate-500 text-center">{isReceive ? "التكلفة" : "السعر"}</label>
                <input
                  ref={costInputRef}
                  type="number" step="any"
                  value={staging.unitCost}
                  onChange={e => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, sellInputRef, unitSelectRef)}
                  className={`w-full h-11 border border-slate-200 rounded-[10px] bg-slate-50/50 px-1 text-[13px] font-mono font-black text-slate-800 outline-none focus:border-${theme.primary}-500 focus:bg-white focus:ring-4 focus:ring-${theme.primary}-500/10 transition-all shadow-inner text-center`}
                />
              </div>

              {/* Selling price */}
              <div className="flex flex-col gap-1.5 w-[90px] shrink-0">
                <label className="text-[11px] font-bold text-slate-500 text-center flex items-center justify-center gap-1">
                  مستهلك
                  {selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && (
                    <span className="text-amber-600 text-[9px]">• متغير</span>
                  )}
                </label>
                <input
                  ref={sellInputRef}
                  type="number" step="any"
                  value={staging.sellingPrice}
                  onChange={e => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, qtyInputRef, costInputRef)}
                  className={`w-full h-11 border rounded-[10px] px-1 text-[13px] font-mono font-black text-slate-800 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 transition-all shadow-inner text-center ${
                    selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price)
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                />
              </div>

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
          <DataGrid
            data={lines}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف في مسودة المستند"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2 text-slate-300" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-[16px] border border-slate-200 shadow-[0_5px_20px_rgba(0,0,0,0.03)] min-h-[350px]"
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
        onConfirmPrint={() => handleSave(true)}
        confirmLabel="تأكيد حفظ المستند وطباعته"
      />

      {/* Confirm leave modal */}
      <Modal open={confirmLeaveOpen} title="تأكيد مغادرة الصفحة" onClose={() => setConfirmLeaveOpen(false)} maxWidth="max-w-sm">
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <Trash2 className="h-8 w-8 text-rose-500" />
          </div>
          <h3 className="text-[18px] font-black text-slate-800 mb-2">لديك أصناف لم يتم حفظها</h3>
          <p className="text-[14px] font-medium text-slate-500 mb-6">
            مغادرة هذه الصفحة الآن ستؤدي إلى فقدان جميع الأصناف التي قمت بإضافتها، هل أنت متأكد؟
          </p>
          <div className="flex gap-3 w-full">
            <button onClick={() => setConfirmLeaveOpen(false)} className="flex-1 rounded-[12px] bg-slate-100 py-3 text-[14px] font-bold text-slate-700 hover:bg-slate-200 transition-all active:scale-95">
              إلغاء والبقاء
            </button>
            <button onClick={() => navigate("/definitions/branches")} className="flex-1 rounded-[12px] bg-rose-500 py-3 text-[14px] font-bold text-white hover:bg-rose-600 transition-all shadow-[0_4px_12px_rgba(244,63,94,0.25)] active:scale-95">
              تأكيد المغادرة
            </button>
          </div>
        </div>
      </Modal>

      {/* Today's transfers modal */}
      <BranchTransferTodayModal open={todayModalOpen} onClose={() => setTodayModalOpen(false)} />

      {/* Advanced stock search modal */}
      <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />
    </div>
  );
}
