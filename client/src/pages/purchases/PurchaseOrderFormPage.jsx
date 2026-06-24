import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Settings2,
  Trash2,
  User,
  Package,
  Calendar,
  FileText,
  ChevronDown,
  ArrowLeft,
  X,
  Clock,
  CheckCircle2,
  FileSearch,
  ImageIcon,
  ZoomIn,
  AlertTriangle,
  ClipboardList,
  Tag,
  Printer,
  Loader2,
  Save
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import DataGrid from "../../components/ui/DataGrid";
import Modal from "../../components/ui/Modal";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { sortByProximity } from "../../utils/itemSort";
import { useGridNavigation } from "../../hooks/useGridNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useAuthStore } from "../../stores/authStore";
import useCollapsibleSidebar from "../../hooks/useCollapsibleSidebar";
import PanelEdgeRail from "../pos/parts/PanelEdgeRail";
import PurchaseOrderFormBottomBar from "./PurchaseOrderFormBottomBar";
import { formatNumber } from "../../utils/currency";


import { resolveImageUrl } from "../../utils/resolveImageUrl";

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function toDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams();
  const isEditMode = !!editId;
  const [loadedDocNo, setLoadedDocNo] = useState("");
  const [loadedCreatedAt, setLoadedCreatedAt] = useState(null);
  const [editActivation, setEditActivation] = useState(null);
  const [docDate, setDocDate] = useState(toDateInput());
  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("purchase_order", editActivation);
  const currentUser = useAuthStore(s => s.user);

  const ITEM_PAGE = 20;

  // --- Data States ---
  const [lines, setLines] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [perWhStockMap, setPerWhStockMap] = useState({}); // { item_id: { wh_id: qty } }
  const [discount, setDiscount] = useState(0);
  const [increase, setIncrease] = useState(0);
  
  // Form States
  const [supplier, setSupplier] = useState(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [printPreview, setPrintPreview] = useState(false);
  
  // Entry States
  const [itemQuery, setItemQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", unitId: "", warehouseId: "" });
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);

  // Refs
  const itemInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const unitSelectRef = useRef(null);
  const costInputRef = useRef(null);
  const sellInputRef = useRef(null);
  const wholesaleInputRef = useRef(null);
  const warehouseTableRef = useRef(null);
  const addBtnRef = useRef(null);
  const supplierInputRef = useRef(null);
  const notesRef = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);

  // Column visibility
  const ALL_COLUMNS = ["index","code","name","quantity","unit_id","unit_cost","selling_price","wholesale_price","profit","warehouse_id","total_cost","actions"];
  const DEFAULT_VISIBLE = ["index","code","name","quantity","unit_id","unit_cost","selling_price","wholesale_price","warehouse_id","total_cost","actions"];
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer.purchaseOrder.visibleColumns") || "null") || DEFAULT_VISIBLE; } catch { return DEFAULT_VISIBLE; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.purchaseOrder.visibleColumns", JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns]);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // --- Keyboard Navigation Hook ---
  const handleKeyDown = useFieldNavigation();
  const gridNavRef = useRef(null);
  const { focusLastRowQty } = useGridNavigation(gridNavRef, { qtyCol: "warehouse_id", entryRef: itemInputRef });
  useShortcut("grid.editLast", () => focusLastRowQty());
  useShortcut("form.save", () => handleSave());

  // --- Collapsible sidebar ---
  const sidebar = useCollapsibleSidebar({
    storageKeyPrefix: "retailer.purchase-order",
    defaultWidth: 320,
    minWidth: 280,
  });
  const { panelWidth, panelEffectiveCollapsed, togglePanel, startPanelResize } = sidebar;

  // --- Init ---
  useEffect(() => {
    const prefill = location.state?.prefill;
    Promise.all([
      api.get("/api/suppliers"),
      api.get("/api/units"),
      api.get("/api/stock/levels"),
      api.get("/api/items?limit=5000"),
      api.get("/api/warehouses"),
    ]).then(([suppRes, unitRes, stockRes, itemsRes, whRes]) => {
      setItems(itemsRes.data?.data || []);
      const suppList = suppRes.data.data || [];
      setSuppliers(suppList);
      setUnits(unitRes.data.data || []);
      const whList = whRes.data?.data || [];
      setWarehouses(whList);
      const defWh = whList.find(w => w.is_default) || whList[0];
      if (defWh) {
        setDefaultWarehouseId(String(defWh.id));
        setStaging(s => ({ ...s, warehouseId: String(defWh.id) }));
      }
      const grouped = {};
      const byWh = {};
      (stockRes.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = 0;
        grouped[row.item_id] += row.quantity;
        if (!byWh[row.item_id]) byWh[row.item_id] = {};
        byWh[row.item_id][row.warehouse_id] = row.quantity;
      });
      setStockLevels(grouped);
      setPerWhStockMap(byWh);

      // Apply navigation-state prefill (e.g. from suggested PO)
      if (prefill) {
        if (prefill.supplier_id) {
          const s = suppList.find(x => String(x.id) === String(prefill.supplier_id));
          if (s) { setSupplier(s); setSupplierQuery(s.name); }
        }
        if (prefill.notes) setNotes(prefill.notes);
        if (Array.isArray(prefill.lines) && prefill.lines.length) {
          setLines(prefill.lines.map(l => ({
            item_id: l.item_id,
            name: l.name,
            code: l.code || "",
            quantity: l.quantity,
            unit_cost: l.unit_cost || 0,
            unit_id: l.unit_id || null,
            total: (l.quantity) * (l.unit_cost || 0),
          })));
        }
      }
    }).catch(() => {});
  }, []);

  // --- Edit mode: load the existing purchase order ---
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/api/purchase-orders/${editId}`).then(res => {
      const o = res.data.data;
      setLoadedDocNo(o.doc_no || "");
      setLoadedCreatedAt(o.created_at || null);
      setEditActivation({ docNo: o.doc_no || "", createdAt: o.created_at || null });
      if (o.created_at) setDocDate(toDateInput(new Date(o.created_at)));
      if (o.supplier_id) {
        api.get(`/api/suppliers/${o.supplier_id}`)
          .then(sr => { const s = sr.data.data; setSupplier(s); setSupplierQuery(s.name); })
          .catch(() => {});
      }
      setNotes(o.notes || "");
      setDiscount(Math.max(0, Number(o.discount || 0)));
      setIncrease(Math.max(0, Number(o.increase || 0)));
      if (o.warehouse_id) {
        setDefaultWarehouseId(String(o.warehouse_id));
        setStaging(st => ({ ...st, warehouseId: String(o.warehouse_id) }));
      }
      setLines((o.lines || []).map(l => ({
        item_id: l.item_id,
        name: l.item_name,
        code: l.item_code || "",
        quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost),
        selling_price: Number(l.selling_price || 0),
        wholesale_price: Number(l.wholesale_price || 0),
        unit_id: l.unit_id || null,
        warehouse_id: l.warehouse_id ? String(l.warehouse_id) : "",
        total: Number(l.quantity) * Number(l.unit_cost),
      })));
    }).catch(() => setMessage({ text: "فشل تحميل أمر التوريد", type: "error" }));
  }, [isEditMode, editId]);

  // --- Item search ---
  useEffect(() => {
    const q = itemQuery.trim();
    pendingPickRef.current = false;
    if (!q) { setFilteredItems([]); setItemOffset(0); setItemHasMore(false); itemSearchActiveRef.current = false; return; }
    itemSearchActiveRef.current = true;
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
          const rows = (r.data.data || []).map(i => ({
            ...i,
            sub_label: `مخزون: ${stockLevels[i.id] || 0}`,
            price_label: `${i.purchase_price || 0}`,
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
        }).catch(() => { pendingPickRef.current = false; })
        .finally(() => { itemSearchActiveRef.current = false; });
    }, 250);
    return () => { clearTimeout(t); itemSearchActiveRef.current = false; };
  }, [itemQuery, stockLevels]);

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
        const rows = (r.data.data || []).map(i => ({
          ...i,
          sub_label: `مخزون: ${stockLevels[i.id] || 0}`,
          price_label: `${i.purchase_price || 0}`,
        }));
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function showAllItems() {
    const SHOW_ALL_LIMIT = 200;
    const fmt = (i) => ({ ...i, sub_label: `مخزون: ${stockLevels[i.id] || 0}`, price_label: `${i.purchase_price || 0}` });
    const anchor = selectedItem;
    setAllItemsMode(true);
    setFilteredItems([]);
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
        setFilteredItems(merged);
        setItemOffset(allRows.length);
        setItemHasMore(Boolean(allRes.data?.meta?.has_more ?? allRows.length === SHOW_ALL_LIMIT));
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    return suppliers
      .filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone).includes(q))
      .slice(0, 8);
  }, [supplierQuery, suppliers]);

  // --- Logic ---
  function handlePickItem(item) {
    activateInvoice();
    setSelectedItem(item);
    setItemQuery(item.name);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setStaging(prev => ({
      ...prev,
      unitCost: String(item.purchase_price || 0),
      sellingPrice: String(item.sale_price || 0),
      wholesalePrice: String(item.wholesale_price || 0),
      unitId: String(item.unit_id || prev.unitId)
    }));
    setLookupOpen(false);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  }

  function handlePickSupplier(s) {
    activateInvoice();
    setSupplier(s);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
  }

  function updateLineField(index, field, value) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLine() {
    if (!selectedItem) return;
    activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(staging.unitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const rawQty = Number(staging.quantity || 1);
    const qty = allowDecimal ? Math.max(0.001, rawQty) : Math.max(1, Math.round(rawQty));
    const cost = Number(staging.unitCost || 0);
    const sell = Number(staging.sellingPrice || 0);
    const wholesale = Number(staging.wholesalePrice || 0);
    const wid = staging.warehouseId || defaultWarehouseId;

    setLines(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === selectedItem.id && String(l.warehouse_id) === String(wid));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty,
          unit_cost: cost || l.unit_cost,
          selling_price: sell || l.selling_price,
          wholesale_price: wholesale || l.wholesale_price,
          total: (allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty) * (cost || l.unit_cost),
        });
      }
      return [...prev, {
        item_id: selectedItem.id,
        name: selectedItem.name,
        code: selectedItem.code || selectedItem.barcode,
        quantity: qty,
        unit_cost: cost,
        selling_price: sell,
        wholesale_price: wholesale,
        unit_id: staging.unitId || null,
        warehouse_id: wid,
        total: qty * cost,
      }];
    });

    setSelectedItem(null);
    setItemQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", unitId: "", warehouseId: s.warehouseId }));
    setTimeout(() => {
      itemInputRef.current?.focus();
      itemInputRef.current?.select();
    }, 50);
  }

  const totals = useMemo(() => {
    const sub = lines.reduce((acc, l) => acc + l.total, 0);
    return { sub, total: Math.max(0, sub - discount + increase), items: lines.length };
  }, [lines, discount, increase]);

  async function handleSave() {
    if (!lines.length) { setMessage({ text: "لا يوجد اصناف", type: "error" }); return; }

    setIsSaving(true);
    const body = {
      doc_no: docNo || null,
      supplier_id: supplier?.id || null,
      warehouse_id: defaultWarehouseId ? Number(defaultWarehouseId) : null,
      notes: notes,
      discount: Number(discount),
      increase: Number(increase),
      lines: lines.map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        selling_price: Number(l.selling_price || 0),
        wholesale_price: Number(l.wholesale_price || 0),
        unit_id: l.unit_id || null,
        warehouse_id: l.warehouse_id ? Number(l.warehouse_id) : null,
      }))
    };
    try {
      if (isEditMode) {
        await api.put(`/api/purchase-orders/${editId}`, body);
        setMessage({ text: "تم حفظ التعديلات بنجاح", type: "success" });
      } else {
        await api.post("/api/purchase-orders", body);
        setMessage({ text: "تم إنشاء أمر الشراء بنجاح", type: "success" });
      }
      setTimeout(() => navigate("/purchases/orders"), 1200);
    } catch (e) {
      setMessage({ text: e?.response?.data?.message || "فشل حفظ أمر الشراء", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-y-scroll px-4 lg:px-8 pb-6">
      {/* Header */}
      <div data-help="po-form-header">
      <DocumentHeaderBar
        onBack={() => { if (lines.length > 0) setWarnModalOpen(true); else navigate("/purchases/orders"); }}
        title={isEditMode ? "تعديل أمر التوريد" : `طلب توريد ${docNo || "جديد"}`}
        subtitle={isEditMode ? "تعديل بنود الطلب قبل الاستلام" : "تخطيط المشتريات المستلمة لاحقاً"}
        extras={
          <div className="flex gap-1.5 items-center">
            {currentUser?.name && (
              <div className="flex items-center gap-1.5 rounded-sm bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                المحرر: {currentUser.name}
              </div>
            )}
            <input disabled value={invoiceIsActive ? (docNo || "") : "—"}
              className="h-6 w-32 rounded-sm border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono font-black text-slate-500 cursor-not-allowed outline-none text-center" />
            <input disabled
              value={invoiceIsActive && invoiceCreatedAt ? formatArabicDateTime(new Date(invoiceCreatedAt)) : "—"}
              className="h-6 w-40 rounded-sm border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono font-bold text-slate-400 cursor-not-allowed outline-none text-center select-none" />
          </div>
        }
        actions={
          <>
            {message.text && (
              <div className={`rounded-sm px-3 py-1.5 text-[11px] font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
                {message.text}
              </div>
            )}
            <PermissionGate page="purchase_orders" action="print">
              <DocumentActionButton variant="print" icon={Printer} onClick={() => setPrintPreview(true)} disabled={!lines.length}>
                معاينة وطباعة
              </DocumentActionButton>
            </PermissionGate>
            <div data-help="po-form-submit"><PermissionGate page="purchase_orders" action="add">
              <DocumentActionButton
                variant="primary"
                identity="slate"
                onClick={handleSave}
                loading={isSaving}
              >
                {isSaving ? "جاري الحفظ..." : (isEditMode ? "حفظ التعديلات" : "إرسال طلب التوريد")}
              </DocumentActionButton>
            </PermissionGate></div>
          </>
        }
      />
      </div>

      <main className="flex min-h-0 flex-1 flex-col p-4" style={{ paddingBottom: panelEffectiveCollapsed ? "calc(1rem + var(--bottom-bar-h, 90px))" : "1rem" }}>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <ClipboardList className="h-4 w-4 text-indigo-600 shrink-0" />
          <p className="text-2sm font-black text-indigo-800">طلب توريد — ليس فاتورة. المخزون لن يتأثر حتى الاستلام في صفحة المشتريات.</p>
        </div>
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Main Content Area */}
          <div className="flex flex-1 flex-col gap-3 min-w-0">
            {/* Supplier & Info Section */}
            <section className="grid grid-cols-3 gap-4 rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                <div className="relative flex flex-col gap-1" data-help="po-form-supplier">
                  <label className="text-[11px] font-bold text-slate-600">المورد المقترح</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={supplierInputRef}
                      type="text"
                      value={supplierQuery}
                      onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); }}
                      onFocus={() => setSupplierLookupOpen(true)}
                      onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                      placeholder="ابحث عن مورد..."
                      className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-9 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800"
                      onKeyDown={e => handleKeyDown(e, { nextRef: notesRef })}
                    />
                    {supplierLookupOpen && (
                      <SearchDropdown 
                        items={filteredSuppliers} 
                        onPick={handlePickSupplier} 
                        activeIndex={activeSupplierIndex}
                        emptyLabel="لا يوجد مورد"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 col-span-2" data-help="po-form-notes">
                  <label className="text-[11px] font-bold text-slate-600">ملاحظات الطلب</label>
                  <div className="relative">
                    <FileText className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input 
                      ref={notesRef}
                      type="text" 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أية تعليمات خاصة للتوريد..."
                      className="w-full border border-slate-300 rounded-sm bg-white py-2 pl-3 pr-9 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800"
                      onKeyDown={e => handleKeyDown(e, { nextRef: itemInputRef, prevRef: supplierInputRef })}
                    />
                  </div>
                </div>
            </section>

            {/* Quick Entry Bar */}
            <section className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
              <div className="entry-bar">
                <EntryItemThumb item={selectedItem} onView={(imgs) => { const u = resolveImageUrl(imgs[0]); if (u) { setImagePreviewUrl(u); setImageModalOpen(true); } }} />
                <div className="entry-field entry-field--item">
                  <label className="entry-label">البحث عن صنف</label>
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
                    emptyLabel="الصنف غير موجود"
                    onLoadMore={loadMoreItems}
                    hasMore={itemHasMore}
                    isLoadingMore={isLoadingMoreItems}
                    onShowAll={showAllItems}
                    hideZeroStock={false}
                  />
                </div>
                <div className="entry-field entry-field--qty">
                  <label className="entry-label">الكمية المطلوبة</label>
                  <input
                    ref={qtyInputRef}
                    type="number"
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
                    className="entry-control text-center"
                  />
                </div>
                <div className="entry-field entry-field--unit">
                  <label className="entry-label">الوحدة</label>
                  {/* Locked to the item's own base unit (mirrors the Purchases page — no free dropdown). */}
                  <div ref={unitSelectRef} tabIndex={-1} className="entry-control entry-control--readonly">
                    <span className="truncate">
                      {selectedItem
                        ? (units.find(u => String(u.id) === String(staging.unitId))?.name || "أساسية")
                        : "أساسية"}
                    </span>
                  </div>
                </div>
                <div className="entry-field entry-field--money">
                  <label className="entry-label">التكلفة المتوقعة</label>
                  <input
                    ref={costInputRef}
                    type="number"
                    step="any"
                    value={staging.unitCost}
                    onChange={(e) => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: sellInputRef, prevRef: qtyInputRef, onEnter: addLine })}
                    className="entry-control text-center"
                  />
                </div>
                <div className="entry-field entry-field--money">
                  <label className="entry-label">سعر البيع</label>
                  <input
                    ref={sellInputRef}
                    type="number"
                    step="any"
                    value={staging.sellingPrice}
                    onChange={(e) => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: wholesaleInputRef, prevRef: costInputRef, onEnter: addLine })}
                    className="entry-control text-center"
                  />
                </div>
                <div className="entry-field entry-field--money">
                  <label className="entry-label">سعر الجملة</label>
                  <input
                    ref={wholesaleInputRef}
                    type="number"
                    step="any"
                    value={staging.wholesalePrice}
                    onChange={(e) => setStaging(s => ({ ...s, wholesalePrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: warehouseTableRef, prevRef: sellInputRef, onEnter: addLine })}
                    className="entry-control text-center"
                  />
                </div>
                {/* Warehouse — always-visible stock table (destination) */}
                <div className="entry-field entry-field--wh">
                  <label className="entry-label">المخزن (الوجهة)</label>
                  <WarehouseSelect
                    ref={warehouseTableRef}
                    value={staging.warehouseId}
                    onChange={(id) => setStaging(s => ({ ...s, warehouseId: String(id) }))}
                    emptyLabel="لا يوجد مخازن"
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); wholesaleInputRef.current?.focus(); wholesaleInputRef.current?.select(); }
                      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); addBtnRef.current?.focus(); }
                      else if (e.key === "ArrowLeft") { e.preventDefault(); addBtnRef.current?.focus(); }
                      else if (e.key === "ArrowRight") { e.preventDefault(); wholesaleInputRef.current?.focus(); wholesaleInputRef.current?.select(); }
                    }}
                    options={warehouses.map(w => {
                      const qty = selectedItem ? (perWhStockMap[selectedItem.id]?.[w.id] || 0) : 0;
                      const tone = qty <= 0 ? "out" : qty < 5 ? "low" : "normal";
                      return { id: w.id, name: w.name, qty, tone };
                    })}
                  />
                </div>
                <button data-help="po-form-add-item"
                  ref={addBtnRef}
                  onClick={addLine}
                  onKeyDown={(e) => handleKeyDown(e, { nextRef: itemInputRef, prevRef: warehouseTableRef, onEnter: addLine })}
                  disabled={!selectedItem}
                  className="entry-add-btn"
                >
                  <Plus className="h-4 w-4" /> إدراج
                </button>
              </div>
            </section>

            {/* Grid */}
            <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-300 bg-white min-h-[500px]" data-help="po-form-items-table">
              <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-slate-100">
                <div className="flex items-center gap-1"><div className="text-2sm font-bold text-slate-500">الأصناف ({lines.length})</div><ShortcutKbd id="grid.editLast" /></div>
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
                        const labels = { code: "الكود", name: "البيان", quantity: "الكمية", unit_id: "الوحدة", unit_cost: "التكلفة", selling_price: "سعر البيع", wholesale_price: "سعر الجملة", profit: "الربح", warehouse_id: "المخزن", total_cost: "الإجمالي" };
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
              <div ref={gridNavRef} className="contents">
              <DataGrid
                data={lines}
                rowKey={(row, i) => i}
                emptyMessage="أمر الشراء فارغ حالياً"
                emptyIcon={<FileSearch className="h-14 w-14 mb-4" />}
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                columns={[
                  {
                    id: "index", header: "#", width: 40, sortable: false, headerClass: "text-center", cellClass: "text-center font-mono text-2sm text-slate-400 border-l border-slate-100",
                    render: (_, i) => i + 1
                  },
                  {
                    id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-2sm font-black tracking-wider text-slate-500 border-l border-slate-100 text-center",
                    render: (l) => l.barcode || l.code || l.item_code || '-'
                  },
                  {
                    id: "name", header: "عنوان الصنف والباركود", width: 220, sortable: true, cellClass: "font-bold text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                    render: (l) => {
                      const item = items.find(i => i.id === l.item_id);
                      const imgUrl = item?.primary_image_url || item?.image_url || item?.image;
                      return (
                        <div className="flex items-center gap-2 py-1">
                          {imgUrl && (
                            <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                              <img src={resolveImageUrl(imgUrl)} alt={l.name} className="w-8 h-8 object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          )}
                          <span className="whitespace-normal break-words leading-tight">{l.name}</span>
                        </div>
                      );
                    }
                  },
                  {
                    id: "quantity", header: "الكمية", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt-primary text-sm text-slate-800 border-l border-slate-100",
                    render: (l) => Number(l.quantity)
                  },
                  {
                    id: "unit_id", header: "الوحدة", width: 80, sortable: false, headerClass: "text-center", cellClass: "text-center text-2sm font-bold text-slate-600 border-l border-slate-100",
                    render: (l) => (units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية")
                  },
                  {
                    id: "unit_cost", header: "التكلفة", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt-primary text-sm text-slate-500 border-l border-slate-100",
                    render: (l) => formatNumber(l.unit_cost)
                  },
                  {
                    id: "selling_price", header: "سعر البيع", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt-primary text-sm text-emerald-700 border-l border-slate-100",
                    render: (l) => formatNumber(l.selling_price || 0)
                  },
                  {
                    id: "wholesale_price", header: "سعر الجملة", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt-primary text-sm text-slate-600 border-l border-slate-100",
                    render: (l) => formatNumber(l.wholesale_price || 0)
                  },
                  {
                    id: "profit", header: "الربح", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
                    sortValue: (l) => Number(l.selling_price || 0) - Number(l.unit_cost || 0),
                    render: (l) => {
                      const profit = Number(l.selling_price || 0) - Number(l.unit_cost || 0);
                      const pct = Number(l.unit_cost) > 0 ? (profit / Number(l.unit_cost)) * 100 : 0;
                      const color = profit > 0 ? "text-emerald-600" : profit < 0 ? "text-rose-600" : "text-slate-400";
                      return (
                        <div className={`flex flex-col leading-tight number-fmt-primary text-sm ${color}`}>
                          <span>{formatNumber(profit)}</span>
                          {Number(l.selling_price) > 0 && Number(l.unit_cost) > 0 && (
                            <span className="text-[10px] opacity-70">{pct.toFixed(1)}%</span>
                          )}
                        </div>
                      );
                    }
                  },
                  {
                    id: "warehouse_id", header: "المخزن", width: 130, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                    render: (l, i) => (
                      <select value={l.warehouse_id || ""} data-grid-cell data-row={i} data-col="warehouse_id" onChange={(e) => updateLineField(i, "warehouse_id", e.target.value)}
                        className="w-full h-[40px] text-[11px] font-bold outline-none border-0 ring-0 text-center truncate cursor-pointer bg-transparent text-slate-700 focus:bg-indigo-50">
                        {warehouses.map(w => {
                          const sqty = perWhStockMap[l.item_id]?.[w.id] || 0;
                          return <option key={w.id} value={w.id}>{w.name} ({sqty})</option>;
                        })}
                      </select>
                    )
                  },
                  {
                    id: "total_cost", header: "إجمالي المتوقع", width: 140, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 number-fmt-primary text-sm text-slate-900 bg-slate-50/50 border-l-0",
                    sortValue: (l) => l.total,
                    render: (l) => formatNumber(l.total)
                  },
                  {
                    id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center border-l-0",
                    render: (_, i) => (
                      <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} className="inline-flex h-[40px] w-full items-center justify-center text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition-colors focus:outline-none">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  }
                ].filter(c => c.id === "index" || c.id === "actions" || visibleColumns.includes(c.id))}
              />
              </div>
               <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
                  <div className="flex items-center gap-6">
                     <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">إجمالي الأصناف:</span>
                        <span className="text-sm font-black text-slate-700">{totals.items}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">إجمالي الكميات:</span>
                        <span className="text-sm font-black text-slate-700 number-fmt">{lines.reduce((acc, l) => acc + l.quantity, 0)}</span>
                     </div>
                     {(discount > 0 || increase > 0) && (
                       <div className="flex items-center gap-2">
                         <span className="text-[11px] font-bold text-slate-400">الإجمالي الفرعي:</span>
                         <span className="text-sm font-black text-slate-600 number-fmt">{formatNumber(totals.sub)}</span>
                       </div>
                     )}
                  </div>
                  <div className="flex items-center gap-2">
                     {discount > 0 && (
                       <span className="text-2sm font-black text-rose-500 number-fmt">-{formatNumber(discount)}</span>
                     )}
                     {increase > 0 && (
                       <span className="text-2sm font-black text-blue-500 number-fmt">+{formatNumber(increase)}</span>
                     )}
                     <span className="text-2sm font-bold text-slate-500 uppercase tracking-wider">القيمة الإجمالية المتوقعة</span>
                     <span className="text-[20px] font-black text-slate-900 number-fmt">{formatNumber(totals.total)}</span>
                     <span className="text-[11px] font-bold text-slate-400">ج.م</span>
                  </div>
               </div>
            </section>
          </div>

           {/* PanelEdgeRail */}
           <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel} onResizeStart={(e) => startPanelResize(e, "right")} panelSide="right" />

           {/* Right Sidebar */}
           <aside className={`shrink-0 flex flex-col gap-4 ${panelEffectiveCollapsed ? "hidden" : ""}`} style={{ width: panelWidth, minWidth: panelWidth }}>
              {/* Pricing + Discount/Increase */}
              <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm shrink-0">
                  <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-400" /> ملخص الإجماليات
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-50">
                      <span className="text-2sm font-bold text-slate-500">المجموع الفرعي</span>
                      <span className="text-sm font-black text-slate-800 number-fmt">{formatNumber(totals.sub)}</span>
                    </div>
                   <div className="flex flex-col gap-1.5 pr-2">
                     <label className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                       <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> خصم
                     </label>
                     <input type="number" min="0"
                       value={discount}
                       onChange={(e) => setDiscount(Math.max(0, Number(e.target.value || 0)))}
                       className="w-full rounded-sm border border-rose-200 bg-rose-50/50 px-3 py-2 text-sm font-black text-rose-900 outline-none focus:border-rose-400 text-center"
                     />
                   </div>
                   <div className="flex flex-col gap-1.5 pr-2">
                     <label className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                       <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> رسوم / إضافة
                     </label>
                     <input type="number" min="0"
                       value={increase}
                       onChange={(e) => setIncrease(Math.max(0, Number(e.target.value || 0)))}
                       className="w-full rounded-sm border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-black text-blue-900 outline-none focus:border-blue-400 text-center"
                     />
                   </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm font-black text-slate-700">الإجمالي النهائي</span>
                      <span className="number-fmt-primary text-sm font-black text-emerald-700">{formatNumber(totals.total)}</span>
                    </div>
                 </div>
              </div>
              {/* Order Status */}
              <div className="rounded-md border border-slate-300 bg-white p-5 shadow-md shrink-0">
                 <h3 className="mb-4 text-2sm font-black text-slate-800 border-b pb-2 border-slate-100 uppercase tracking-widest flex items-center gap-2">
                   <Clock className="h-4 w-4 text-slate-400" /> حالة الطلب
                 </h3>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                       <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-amber-700">
                          <Plus className="h-4 w-4" />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-2sm font-black text-amber-900">مسودة (Pending)</span>
                          <span className="text-[11px] text-amber-600 font-bold">في انتظار المراجعة</span>
                       </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400 text-center font-bold">
                      تنبيه: تحويل أمر الشراء إلى "فاتورة مشتريات" سيتم فور استلام البضاعة في المخازن من خلال لوحة الاستلام.
                    </p>
                 </div>
              </div>

              {/* Save / Print */}
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shrink-0 flex flex-col gap-2">
                 <PermissionGate page="purchase_orders" action="add">
                  <button data-help="po-form-submit"
                    onClick={handleSave}
                    className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary py-3.5 text-sm font-black text-white hover:bg-primary-600 transition-all shadow-lg active:scale-95 disabled:opacity-40"
                    disabled={isSaving || !lines.length}
                   >
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</> : <><Save className="h-4 w-4" /> {isEditMode ? "حفظ التعديلات" : "اعتماد وإرسال الطلب"}</>}
                    {!isSaving && <ShortcutKbd id="form.save" className="ms-1 rounded bg-white/20 px-1 text-[9px] font-mono text-white" />}
                 </button>
                 </PermissionGate>
                 <PermissionGate page="purchase_orders" action="print">
                   <button onClick={() => setPrintPreview(true)} disabled={!lines.length}
                     className="w-full flex items-center justify-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-slate-50 transition-all disabled:opacity-40">
                     <Printer className="h-3.5 w-3.5" /> معاينة وطباعة
                   </button>
                 </PermissionGate>
             </div>
           </aside>
         </div>

         {/* Sticky Bottom Bar (shown when sidebar collapsed) */}
         <PurchaseOrderFormBottomBar
           forceShow={panelEffectiveCollapsed}
           totals={totals}
           discount={discount}
           increase={increase}
           onDiscountChange={setDiscount}
           onIncreaseChange={setIncrease}
           itemCount={lines.length}
           quantityCount={lines.reduce((acc, l) => acc + l.quantity, 0)}
           onSave={handleSave}
           onPrint={() => setPrintPreview(true)}
           isSaving={isSaving}
           isEditMode={isEditMode}
           linesLength={lines.length}
         />
       </main>
       {/* Print Preview Modal */}
      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="purchase_order"
        invoice={{
          invoice_no: docNo || loadedDocNo || "",
          customer_name: supplier?.name || "",
          cashier_name: currentUser?.name || "",
          notes: notes || "",
          created_at: invoiceCreatedAt || loadedCreatedAt || new Date().toISOString(),
          lines: lines.map(l => ({
            item_name: l.name,
            code: l.code || "",
            quantity: l.quantity,
            unit_price: l.unit_cost,
            discount_amount: 0,
          })),
          discount,
          increase,
        }}
        operationLabel="أمر توريد"
        confirmLabel="حفظ وطباعة"
        onConfirmPrint={handleSave}
        onSaveOnly={handleSave}
        saveOnlyLabel="حفظ فقط"
        isSaving={isSaving}
      />

      {/* Image Preview Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="معاينة صورة الصنف" size="md" showDetach={false}>
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

      {/* Confirm Leave Warning Modal */}
      <Modal open={warnModalOpen} onClose={() => setWarnModalOpen(false)} title="تحذير: مغادرة الصفحة" size="md" showDetach={false}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">تجاهل التغييرات؟</h3>
              <p className="text-2sm font-bold text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في المغادرة؟ سيتم <span className="text-rose-600">فقدان جميع بيانات أمر الشراء</span> التي أدخلتها.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setWarnModalOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
              تراجع وإكمال الطلب
            </button>
            <button onClick={() => navigate("/purchases/orders")} className="rounded-sm btn-danger px-5 py-2 text-sm font-black shadow-sm">
              نعم، تجاهل ومغادرة
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
