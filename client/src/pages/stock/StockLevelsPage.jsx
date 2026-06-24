import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Package,
  Search,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import DataGrid from "../../components/ui/DataGrid";
import { Card } from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import PageWrapper from "../../components/ui/PageWrapper";
import SearchInput from "../../components/ui/SearchInput";
import { scoredFilterRows } from "../../utils/search";
import Highlight from "../../components/ui/Highlight";
import { Select } from "../../components/ui/Select";
import PermissionGate from "../../components/ui/PermissionGate";

// ─── constants ────────────────────────────────────────────────────────────────
const MOVEMENT_LABELS = {
  transfer_in:              { label: "وارد تحويل",        color: "text-green-700",  badge: "bg-green-50 border-green-200", Icon: TrendingUp   },
  transfer_out:             { label: "صادر تحويل",        color: "text-rose-700",   badge: "bg-rose-50 border-rose-200", Icon: TrendingDown },
  manual_adjustment:        { label: "تسوية يدوية",       color: "text-slate-700",  badge: "bg-slate-100 border-slate-200", Icon: BarChart3    },
  physical_count:           { label: "جرد فعلي",          color: "text-violet-700", badge: "bg-violet-50 border-violet-200", Icon: Package      },
  sale:                     { label: "بيع",               color: "text-orange-700", badge: "bg-orange-50 border-orange-200", Icon: TrendingDown },
  purchase:                 { label: "شراء",              color: "text-emerald-700", badge: "bg-emerald-50 border-emerald-200", Icon: TrendingUp   },
  purchase_return:          { label: "مرتجع مشتريات",     color: "text-rose-700",   badge: "bg-rose-50 border-rose-200", Icon: TrendingDown },
  sale_return:              { label: "مرتجع مبيعات",      color: "text-emerald-700", badge: "bg-emerald-50 border-emerald-200", Icon: TrendingUp   },
  branch_receive:           { label: "استلام من فرع",     color: "text-teal-700",   badge: "bg-teal-50 border-teal-200", Icon: TrendingUp   },
  branch_receive_reversal:  { label: "إلغاء استلام فرع",  color: "text-rose-700",   badge: "bg-rose-50 border-rose-200", Icon: TrendingDown },
  purchase_void:            { label: "إلغاء مشتريات",     color: "text-rose-700",   badge: "bg-rose-50 border-rose-200", Icon: TrendingDown },
};
const MOV_META = (t) => MOVEMENT_LABELS[t] || { label: t, color: "text-slate-600", badge: "bg-slate-50 border-slate-200", Icon: BarChart3 };
const PAGE = 50;
// Keys searched for both the levels and transfer product search (ranked relevance).
const PRODUCT_SEARCH_KEYS = ["code", "barcode", "item_code", "item_name", "category_name"];

// ─── Tab ─────────────────────────────────────────────────────────────────────
function Tab({ active, onClick, children, ...rest }) {
  return (
    <button type="button" onClick={onClick} {...rest}
      className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
        active
          ? "border-slate-800 text-slate-900 bg-slate-50/50"
          : "border-transparent text-slate-400 hover:text-slate-800 hover:bg-slate-50/30"
      }`}>
      {children}
    </button>
  );
}

// ─── SortTh Component ─────────────────────────────────────────
function SortTh({ label, sortKey, sortConfig, onSort, width, className = "" }) {
  const isSorted = sortConfig.key === sortKey;
  return (
    <th className={`relative px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors select-none group border-l border-slate-100 ${className}`}
      style={width ? { width, minWidth: width } : {}}
    >
      <div className="flex items-center gap-1 cursor-pointer" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
          <ChevronLeft className={`h-2.5 w-2.5 rotate-90 -mb-1 ${isSorted && sortConfig.direction === "asc" ? "text-slate-900 !opacity-100" : ""}`} />
          <ChevronLeft className={`h-2.5 w-2.5 -rotate-90 ${isSorted && sortConfig.direction === "desc" ? "text-slate-900 !opacity-100" : ""}`} />
        </div>
      </div>
    </th>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ qty, min }) {
  if (qty === 0) return <span className="rounded-sm bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-700">نفد</span>;
  if (qty <= (min ?? 0)) return <span className="rounded-sm bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">منخفض</span>;
  return <span className="rounded-sm bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700">طبيعي</span>;
}

export default function StockLevelsPage() {
  usePageTour('stock');
  const handleKeyDown = useFieldNavigation();
  const adjWhRef = useRef(null);
  const adjQtyRef = useRef(null);
  const adjReasonRef = useRef(null);
  const adjSubmitRef = useRef(null);
  const txFromRef = useRef(null);
  const txToRef = useRef(null);
  const txNotesRef = useRef(null);
  const txSubmitRef = useRef(null);
  const movSearchRef = useRef(null);
  const movWhRef = useRef(null);
  const movTypeRef = useRef(null);
  const movDateFromRef = useRef(null);
  const movDateToRef = useRef(null);
  const location = useLocation();
  const [tab, setTab] = useState(() =>
    location.pathname.endsWith("/transfer") ? "transfer" : "levels"
  );

  // ── shared ──
  const [warehouses, setWarehouses] = useState([]);

  // ══════════ LEVELS ══════════
  const [levels, setLevels]         = useState([]);
  const [levelsLoading, setLL]      = useState(true);
  const [levelsSearch, setLS]       = useState("");
  const [levelsWH, setLWH]          = useState("");
  const [levelsPage, setLP]         = useState(1);
  const [showLowOnly, setSLO]       = useState(false);
  const [sortCol, setSortCol]       = useState("item_name");
  const [sortDir, setSortDir]       = useState("asc");

  // inline adjust
  const [adjustRow, setAdjustRow]   = useState(null);
  const [adjQty, setAdjQty]         = useState("");
  const [adjMode, setAdjMode]       = useState("delta");
  const [adjReason, setAdjReason]   = useState("");
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjWarehouseId, setAdjWH]  = useState("");

  // transfer column resize
  const [txColWidths, setTxColWidths] = useState({ name: 280, stock: 140, qty: 160, after: 140 });
  const txResizeRef = useRef(null);

  // ══════════ TRANSFER ══════════
  const [fromWH, setFromWH]         = useState("");
  const [toWH, setToWH]             = useState("");
  const [txNotes, setTxNotes]       = useState("");
  const [txSearch, setTxSearch]     = useState("");
  const [txItems, setTxItems]       = useState([]); // items in fromWH
  const [destStock, setDestStock]   = useState({}); // item_id → qty in destination
  const [txLoading, setTxLoading]   = useState(false);
  const [selected, setSelected]     = useState(new Set()); // item_ids selected
  const [qtys, setQtys]             = useState({});        // item_id → qty string
  const [txPage, setTxPage]         = useState(1);
  const [txConfirm, setTxConfirm]   = useState(false);
  const [txSubmitting, setTxSub]    = useState(false);

  // ══════════ HISTORY ══════════
  const [movements, setMovements]   = useState([]);
  const [movTotal, setMovTotal]     = useState(0);
  const [movLoading, setMovLoad]    = useState(false);
  const [movPage, setMovPage]       = useState(1);
  const [movSearch, setMovSearch]   = useState("");
  const [movWH, setMovWH]           = useState("");
  const [movType, setMovType]       = useState("");
  const [movDateFrom, setMovDateFrom] = useState("");
  const [movDateTo, setMovDateTo] = useState("");
  const [movSort, setMovSort] = useState({ key: "created_at", dir: "desc" });
  const [movementDetails, setMovementDetails] = useState(null);
  const [movementLoading, setMovementLoading] = useState(false);
  const [editMovement, setEditMovement] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteMovement, setDeleteMovement] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [movColWidths, setMovColWidths] = useState({
    created_at: 170,
    item_name: 260,
    warehouse_name: 140,
    movement_type: 150,
    quantity: 120,
    before_qty: 170,
    notes: 220,
    actions: 220,
  });

  // ── bootstrap ──
  useEffect(() => {
    api.get("/api/warehouses").then((r) => setWarehouses(r.data.data || [])).catch(() => {});
  }, []);

  // ══════════ LEVELS logic ══════════
  // NOTE: search is applied client-side (ranked, keyboard/typo-tolerant) so we
  // only refetch when the warehouse filter changes — not on every keystroke.
  const loadLevels = useCallback(() => {
    setLL(true);
    const params = {};
    if (levelsWH) params.warehouse_id = levelsWH;
    api.get("/api/stock/levels", { params })
      .then((r) => setLevels(r.data.data || []))
      .catch(() => toast.error("تعذر تحميل أرصدة المخزون"))
      .finally(() => setLL(false));
  }, [levelsWH]);

  useEffect(() => { loadLevels(); }, [loadLevels]);
  useEffect(() => { setLP(1); }, [levelsSearch, levelsWH, showLowOnly, sortCol, sortDir]);

  const filteredLevels = useMemo(() => {
    let list = showLowOnly ? levels.filter((r) => r.quantity <= (r.min_stock_qty ?? 0)) : levels;
    // While searching, order by relevance (exact code/SKU first) — overrides the
    // column sort so the best match always sits at the top.
    if (levelsSearch.trim()) {
      return scoredFilterRows(list, levelsSearch, PRODUCT_SEARCH_KEYS);
    }
    return [...list].sort((a, b) => {
      let va = a[sortCol] ?? ""; let vb = b[sortCol] ?? "";
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [levels, levelsSearch, showLowOnly, sortCol, sortDir]);

  const totalLvlPages = Math.max(1, Math.ceil(filteredLevels.length / PAGE));
  const pageLevels    = filteredLevels.slice((levelsPage - 1) * PAGE, levelsPage * PAGE);
  const lowCount  = levels.filter((r) => r.quantity > 0 && r.quantity <= (r.min_stock_qty ?? 0)).length;
  const zeroCount = levels.filter((r) => r.quantity === 0).length;

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortMark({ col }) {
    if (sortCol !== col) return <span className="opacity-30 ms-1">↕</span>;
    return <span className="text-primary ms-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function onTxResizeStart(e, key) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = txColWidths[key];
    function onMove(ev) {
      const delta = startX - ev.clientX;
      setTxColWidths((prev) => ({ ...prev, [key]: Math.max(80, startW + delta) }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      txResizeRef.current = null;
    }
    txResizeRef.current = onMove;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function submitAdjust() {
    if (adjQty === "" || adjQty === null || adjQty === undefined) { toast.error("يرجى إدخال الكمية"); return; }
    const qty = Number(adjQty);
    if (isNaN(qty)) { toast.error("كمية غير صحيحة"); return; }
    if (adjMode === "delta" && qty === 0) { toast.error("يرجى إدخال قيمة غير صفرية للفرق"); return; }
    const warehouseId = adjustRow.warehouse_id ?? (adjWarehouseId ? Number(adjWarehouseId) : null);
    if (!warehouseId) { toast.error("يرجى تحديد المخزن"); return; }
    setAdjLoading(true);
    try {
      const payload = { item_id: adjustRow.item_id, warehouse_id: warehouseId };
      if (adjMode === "absolute") payload.new_quantity = qty; else payload.adjustment = qty;
      if (adjReason) payload.notes = adjReason;
      await api.post("/api/stock/adjust", payload);
      toast.success("تم تعديل الكمية");
      setAdjustRow(null); setAdjQty(""); setAdjReason("");
      loadLevels();
    } catch (err) { toast.error(err.response?.data?.message || "فشل التعديل"); }
    finally { setAdjLoading(false); }
  }

  // ══════════ TRANSFER logic ══════════
  const loadTxItems = useCallback(() => {
    if (!fromWH) { setTxItems([]); return; }
    setTxLoading(true);
    api.get("/api/stock/levels", { params: { warehouse_id: fromWH } })
      .then((r) => setTxItems(r.data.data || []))
      .catch(() => toast.error("تعذر تحميل أصناف المخزن"))
      .finally(() => setTxLoading(false));
  }, [fromWH]);

  // Load destination warehouse stock
  const loadDestStock = useCallback(() => {
    if (!toWH) { setDestStock({}); return; }
    api.get("/api/stock/levels", { params: { warehouse_id: toWH } })
      .then((r) => {
        const map = {};
        (r.data.data || []).forEach((item) => {
          map[item.item_id] = item.quantity || 0;
        });
        setDestStock(map);
      })
      .catch(() => setDestStock({}));
  }, [toWH]);

  useEffect(() => { loadDestStock(); }, [loadDestStock]);

  useEffect(() => { loadTxItems(); setSelected(new Set()); setQtys({}); setTxPage(1); }, [loadTxItems]);
  useEffect(() => { setTxPage(1); }, [txSearch]);

  const filteredTxItems = useMemo(() => {
    return scoredFilterRows(txItems, txSearch, PRODUCT_SEARCH_KEYS);
  }, [txItems, txSearch]);

  const txTotalPages = Math.max(1, Math.ceil(filteredTxItems.length / PAGE));
  const pageTxItems  = filteredTxItems.slice((txPage - 1) * PAGE, txPage * PAGE);

  const allPageTxIds = pageTxItems.map((it) => it.item_id);
  const allPageSel   = allPageTxIds.length > 0 && allPageTxIds.every((id) => selected.has(id));
  const somePageSel  = allPageTxIds.some((id) => selected.has(id));

  function toggleTxAll() {
    if (allPageSel) setSelected((s) => { const n = new Set(s); allPageTxIds.forEach((id) => n.delete(id)); return n; });
    else setSelected((s) => { const n = new Set(s); allPageTxIds.forEach((id) => n.add(id)); return n; });
  }
  function toggleTxRow(id) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function setItemQty(id, val) {
    setQtys((prev) => ({ ...prev, [id]: val }));
  }

  const selectedItems = txItems.filter((it) => selected.has(it.item_id));

  // Per-item validation state — computed once, used in table + bar
  const itemValidation = useMemo(() => {
    const map = {};
    for (const it of selectedItems) {
      const q = Number(qtys[it.item_id] || 0);
      if (q <= 0)           map[it.item_id] = "no_qty";       // selected but no qty entered
      else if (q > it.quantity) map[it.item_id] = "over_qty"; // qty exceeds available stock
      else                  map[it.item_id] = "ok";
    }
    return map;
  }, [selectedItems, qtys]);

  const errorItems  = selectedItems.filter((it) => itemValidation[it.item_id] !== "ok");
  const validItems  = selectedItems.filter((it) => itemValidation[it.item_id] === "ok");
  const canTransfer = validItems.length > 0 && errorItems.length === 0 && !!toWH;

  // "select all" only selects items that have available stock
  function toggleTxAllAvailable() {
    const availableIds = pageTxItems.filter((it) => it.quantity > 0).map((it) => it.item_id);
    const allSel = availableIds.every((id) => selected.has(id));
    if (allSel) setSelected((s) => { const n = new Set(s); availableIds.forEach((id) => n.delete(id)); return n; });
    else setSelected((s) => { const n = new Set(s); availableIds.forEach((id) => n.add(id)); return n; });
  }

  function handleTransferSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!fromWH) { toast.error("اختر المخزن المصدر"); return; }
    if (!toWH)   { toast.error("اختر المخزن الوجهة"); return; }
    if (String(fromWH) === String(toWH)) { toast.error("المخزن المصدر والوجهة متماثلان"); return; }
    if (selected.size === 0) { toast.error("اختر صنفاً واحداً على الأقل"); return; }
    if (errorItems.length > 0) { toast.error(`صحّح أخطاء ${errorItems.length} صنف قبل المتابعة`); return; }
    if (validItems.length === 0) { toast.error("أدخل كمية صحيحة لصنف واحد على الأقل"); return; }
    setTxConfirm(true);
  }

  async function confirmTransfer() {
    setTxConfirm(false);
    setTxSub(true);
    try {
      const items = selectedItems
        .filter((it) => Number(qtys[it.item_id] || 0) > 0)
        .map((it) => ({ item_id: it.item_id, quantity: Number(qtys[it.item_id]) }));
      const r = await api.post("/api/stock/transfer/bulk", {
        from_warehouse_id: Number(fromWH),
        to_warehouse_id: Number(toWH),
        items,
        notes: txNotes || undefined,
      });
      if (r.data.errors?.length) {
        toast.error(`تم تحويل ${r.data.transferred} صنف. ${r.data.errors.length} فشلت.`);
      } else {
        toast.success(`تم تحويل ${r.data.transferred} صنف بنجاح`);
      }
      setSelected(new Set()); setQtys({}); setTxNotes("");
      loadTxItems(); loadDestStock(); loadLevels();
    } catch (err) { toast.error(err.response?.data?.message || "فشل التحويل"); }
    finally { setTxSub(false); }
  }

  const fromWarehouse = warehouses.find((w) => String(w.id) === String(fromWH));
  const toWarehouse   = warehouses.find((w) => String(w.id) === String(toWH));

  // ══════════ MOVEMENTS logic ══════════
  const loadMovements = useCallback(() => {
    setMovLoad(true);
    const params = { limit: PAGE, offset: (movPage - 1) * PAGE };
    if (movSearch) params.search = movSearch;
    if (movWH) params.warehouse_id = movWH;
    if (movType) params.movement_type = movType;
    if (movDateFrom) params.date_from = movDateFrom;
    if (movDateTo) params.date_to = movDateTo;
    params.sort_by = movSort.key;
    params.sort_dir = movSort.dir;
    api.get("/api/stock/movements", { params })
      .then((r) => { setMovements(r.data.data || []); setMovTotal(r.data.total || 0); })
      .catch(() => toast.error("تعذر تحميل سجل الحركات"))
      .finally(() => setMovLoad(false));
  }, [movPage, movSearch, movWH, movType, movDateFrom, movDateTo, movSort]);

  useEffect(() => { if (tab === "history") loadMovements(); }, [loadMovements, tab]);
  useEffect(() => { setMovPage(1); }, [movSearch, movWH, movType, movDateFrom, movDateTo, movSort]);

  const movTotalPages = Math.max(1, Math.ceil(movTotal / PAGE));

  function toggleMovSort(key) {
    setMovSort((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    ));
  }

  function onMovResizeStart(e, key) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = movColWidths[key] || 120;
    function onMove(ev) {
      const delta = startX - ev.clientX;
      setMovColWidths((prev) => ({ ...prev, [key]: Math.max(90, startW + delta) }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function openMovementDetails(id) {
    setMovementLoading(true);
    setMovementDetails(null);
    try {
      const r = await api.get(`/api/stock/movements/${id}`);
      setMovementDetails(r.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر تحميل تفاصيل الحركة");
    } finally {
      setMovementLoading(false);
    }
  }

  function startEditMovement(mv) {
    setEditMovement(mv);
    setEditNotes(mv?.notes || "");
  }

  async function saveMovementNotes() {
    if (!editMovement) return;
    setEditSaving(true);
    try {
      await api.put(`/api/stock/movements/${editMovement.id}`, { notes: editNotes });
      toast.success("تم تحديث ملاحظات الحركة");
      setEditMovement(null);
      loadMovements();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حفظ التعديل");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDeleteMovement() {
    if (!deleteMovement) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/stock/movements/${deleteMovement.id}`);
      toast.success("تم حذف الحركة");
      setDeleteMovement(null);
      loadMovements();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حذف الحركة");
    } finally {
      setDeleteLoading(false);
    }
  }

  const whOptions = [{ value: "", label: "كل المخازن" }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))];

  // ─── confirm message ───
  const txMsg = validItems.length
    ? `تحويل ${validItems.length} صنف من "${fromWarehouse?.name}" إلى "${toWarehouse?.name}". المتابعة؟`
    : "";

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6 pb-32" dir="rtl">
      
      {/* Header & Stats Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
         <div className="flex flex-col gap-1">
             <h1 data-help="st-form-header"
               className="text-[24px] font-black text-slate-900 flex items-center gap-2">
               <Warehouse className="h-6 w-6 text-slate-800" />
               أرصدة وحركات المخزون
            </h1>
            <p className="text-sm font-bold text-slate-400">تابع الكميات، حوّل بين الفروع، وراجع الحركات المباشرة</p>
         </div>
         <div className="flex items-center gap-2">
            <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
               <Warehouse className="h-4 w-4 text-sky-500" />
               <div className="flex flex-col text-right">
                  <span className="text-[11px] font-black text-slate-400 uppercase leading-none">فروع المخازن</span>
                  <span className="text-sm font-black text-slate-800 leading-none">{warehouses.length}</span>
               </div>
            </div>
            <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-3 shadow-sm">
               <AlertTriangle className="h-4 w-4 text-amber-500" />
               <div className="flex flex-col text-right">
                  <span className="text-[11px] font-black text-amber-600 uppercase leading-none">أصناف منخفضة</span>
                  <span className="text-sm font-black text-amber-800 leading-none">{lowCount}</span>
               </div>
            </div>
            <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-rose-200 bg-rose-50 px-3 shadow-sm">
               <X className="h-4 w-4 text-rose-500" />
               <div className="flex flex-col text-right">
                  <span className="text-[11px] font-black text-rose-600 uppercase leading-none">نفدت تماماً</span>
                  <span className="text-sm font-black text-rose-800 leading-none">{zeroCount}</span>
               </div>
            </div>
         </div>
      </div>

      {/* Main Workspace Wrapper */}
      <div className="flex flex-col rounded-sm border border-slate-200 bg-white shadow-sm min-h-[60vh]">
        
        {/* Tabs */}
        <div data-help="stock-tabs" className="flex items-center bg-slate-50 border-b border-slate-200">
          <Tab active={tab === "levels"}   onClick={() => setTab("levels")}>
            <Package className="h-4 w-4" /> أرصدة المخزون
          </Tab>
          <Tab data-help="add-button" active={tab === "transfer"} onClick={() => setTab("transfer")}>
            <ArrowLeftRight className="h-4 w-4" /> تحويل مخزون
          </Tab>
          <Tab active={tab === "history"}  onClick={() => setTab("history")}>
            <Clock className="h-4 w-4" /> سجل الحركات {movTotal > 0 && `(${movTotal})`}
          </Tab>
        </div>

        {/* ══════════ LEVELS TAB ══════════ */}
        {tab === "levels" && (
          <div className="flex flex-col bg-slate-50/50">
            {(lowCount > 0 || zeroCount > 0) && (
               <div className="flex items-center gap-3 bg-amber-50 px-6 py-3 border-b border-amber-100">
                 <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                 <p className="flex-1 text-2sm font-bold text-amber-800">
                   {lowCount > 0 && <><span className="font-black">{lowCount} صنف</span> وصلت للحد الأدنى. </>}
                   {zeroCount > 0 && <span className="font-black text-rose-600">{zeroCount} نفدت تماماً.</span>}
                 </p>
                 <button onClick={() => setSLO((v) => !v)}
                   className="text-[11px] font-black uppercase tracking-widest text-amber-700 underline underline-offset-4 hover:text-amber-900 transition-colors">
                   {showLowOnly ? "إظهار الكل" : "عرض النواقص فقط"}
                 </button>
               </div>
            )}

            {/* Top Actions & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
               <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                  <div data-help="search-bar" className="relative flex-1 group">
                     <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                     <input value={levelsSearch} onChange={(e) => setLS(e.target.value)}
                       placeholder="بحث بالاسم أو الكود أو الباركود..."
                       className="w-full rounded-md border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm font-bold outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm" />
                  </div>
                  <div className="relative w-64 group">
                     <select value={levelsWH} onChange={(e) => setLWH(e.target.value)}
                       className="w-full appearance-none rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm">
                       {whOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                     </select>
                     <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
               </div>
               <p className="text-2sm font-black text-slate-500 uppercase tracking-widest">{filteredLevels.length} رصيد</p>
            </div>

            {/* Table */}
            <div data-help="main-table" className="flex flex-col flex-1 h-[60vh] min-h-[400px]">
              <DataGrid
                data={pageLevels}
                rowKey={(r) => `${r.item_id}-${r.warehouse_id ?? "none"}`}
                sortConfig={{ key: sortCol, dir: sortDir }}
                onSort={handleSort}
                emptyMessage="لا توجد أرصدة مطابقة"
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                rowClass={(row) => {
                  const isZero = row.quantity === 0;
                  const isLow = !isZero && row.quantity <= (row.min_stock_qty ?? 0);
                  const isAdj = adjustRow?.item_id === row.item_id && adjustRow?.warehouse_id === row.warehouse_id;
                  if (isZero) return "!bg-rose-50/30 hover:!bg-rose-50/50";
                  if (isLow) return "!bg-amber-50/30 hover:!bg-amber-50/50";
                  if (isAdj) return "!bg-sky-50/70 font-bold relative z-10";
                  return "";
                }}
                columns={[
                  {
                    id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-2sm font-black text-slate-500 border-l border-slate-100",
                    render: (r) => r.code ? <Highlight text={r.code} query={levelsSearch} /> : "—"
                  },
                  {
                    id: "item_name", header: "الصنف", width: 220, sortable: true, cellClass: "font-black text-sm text-slate-800 border-l border-slate-100 px-3", headerClass: "text-right px-3",
                    render: (r) => (
                      <div className="flex flex-col">
                        <span><Highlight text={r.item_name} query={levelsSearch} /></span>
                        {(r.item_code || r.code || r.barcode) && <span className="font-mono text-[11px] text-slate-400 font-bold"><Highlight text={r.item_code || r.code || r.barcode} query={levelsSearch} /></span>}
                      </div>
                    )
                  },
                  {
                    id: "category_name", header: "القسم", width: 140, sortable: true, cellClass: "text-2sm font-bold text-slate-500 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                    render: (r) => r.category_name || "—"
                  },
                  {
                    id: "warehouse_name", header: "المخزن", width: 140, sortable: true, cellClass: "text-2sm font-bold text-slate-600 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                    render: (r) => r.warehouse_name || "—"
                  },
                  {
                    id: "quantity", header: "الرصيد المتاح", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center bg-slate-50/40 font-mono font-black text-sm text-slate-700 border-x border-slate-100",
                    render: (r) => r.quantity
                  },
                  {
                    id: "min_stock_qty", header: "الحد الأدنى", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-bold text-2sm text-slate-400 border-l border-slate-100",
                    render: (r) => r.min_stock_qty ?? 0
                  },
                  {
                    id: "status", header: "الحالة", width: 80, sortable: false, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
                    render: (r) => <StatusBadge qty={r.quantity} min={r.min_stock_qty} />
                  },
                  {
                    id: "margin_pct", header: "هامش الربح", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
                    render: (r) => {
                      if (r.margin_pct == null) return <span className="text-slate-300 text-[11px]">—</span>;
                      const bad = r.below_margin;
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${bad ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                          {bad && <AlertTriangle className="h-3 w-3" />}{r.margin_pct}%
                        </span>
                      );
                    }
                  },
                  {
                    id: "actions", header: "", width: 80, sortable: false, headerClass: "text-center", cellClass: "text-center px-2 py-0 border-l-0",
                    render: (r) => (
                      <button onClick={() => { setAdjustRow({ item_id: r.item_id, warehouse_id: r.warehouse_id, name: r.item_name, current: r.quantity }); setAdjQty(""); setAdjMode("delta"); setAdjReason(""); setAdjWH(""); }}
                        className="opacity-0 group-hover:opacity-100 mx-auto flex items-center justify-center h-7 px-3 rounded-md border border-slate-300 bg-white text-[11px] font-black text-slate-600 hover:border-slate-800 hover:text-slate-900 transition-all shadow-sm">
                        تسوية
                      </button>
                    )
                  }
                ]}
                renderExpandedRow={(row) => {
                  const isAdj = adjustRow?.item_id === row.item_id && adjustRow?.warehouse_id === row.warehouse_id;
                  if (!isAdj) return null;
                  return (
                    <tr className="bg-sky-50 shadow-inner">
                      <td colSpan={9} className="px-6 py-5 border-b-2 border-sky-100">
                        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                          <div className="flex flex-col gap-1 w-48">
                            <span className="text-[11px] font-black uppercase text-sky-600/70">الصنف المستهدف</span>
                            <span className="text-sm font-black text-sky-900 leading-tight">{adjustRow.name}</span>
                            <span className="text-[11px] font-bold text-sky-700">رصيد حالي: <span className="font-mono font-black">{adjustRow.current}</span></span>
                          </div>
                          {adjustRow.warehouse_id == null && (
                            <div className="space-y-1.5 w-48">
                              <span className="text-[11px] font-black uppercase tracking-widest text-sky-600/70">المخزن</span>
                              <div className="relative">
                                <select ref={adjWhRef} value={adjWarehouseId} onChange={(e) => setAdjWH(e.target.value)}
                                  className="w-full appearance-none rounded-sm border border-sky-200 bg-white py-1.5 pl-7 pr-3 text-sm font-black text-sky-900 outline-none focus:border-sky-500 shadow-sm" onKeyDown={e => handleKeyDown(e, { nextRef: adjQtyRef })}>
                                  <option value="">اختر مخزناً...</option>
                                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400 pointer-events-none" />
                              </div>
                            </div>
                          )}
                          <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <span className="text-[11px] font-black uppercase tracking-widest text-sky-600/70">نوع التسوية</span>
                            <div className="flex overflow-hidden rounded-sm border border-sky-200/50 shadow-sm font-bold text-sm bg-white">
                              {[["delta","فروق وتسويات (+/-)"],["absolute","اعتماد الرصيد المطلق"]].map(([m,l], idx) => (
                                <React.Fragment key={m}>
                                   {idx > 0 && <div className="w-[1px] bg-sky-100" />}
                                   <button onClick={() => setAdjMode(m)}
                                     className={`flex-1 py-1.5 transition-colors ${adjMode === m ? "bg-sky-600 text-white" : "text-sky-700 hover:bg-sky-50"}`}>{l}</button>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          <div className="w-32 space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-widest text-sky-600/70">{adjMode === "delta" ? "الفرق (+/-)" : "الكمية الحقيقية"}</span>
                            <div className="relative">
                               <input ref={adjQtyRef} type="number" step="1" value={adjQty} onChange={(e) => setAdjQty(e.target.value)}
                                 placeholder={adjMode === "delta" ? "+10, -5" : "0"}
                                 className="w-full rounded-sm border border-sky-200 bg-white py-1.5 px-3 text-sm font-black text-sky-900 outline-none focus:border-sky-500 shadow-sm font-mono text-center" onKeyDown={e => handleKeyDown(e, { nextRef: adjReasonRef, prevRef: adjWhRef })} />
                            </div>
                            {adjMode === "delta" && adjQty !== "" && !isNaN(Number(adjQty)) && (
                               <div className="absolute mt-1 text-[11px] font-bold text-sky-800">
                                   سيكون: <span className="font-mono font-black text-emerald-600">{adjustRow.current + Number(adjQty)}</span>
                               </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-1.5 min-w-[200px]">
                            <span className="text-[11px] font-black uppercase tracking-widest text-sky-600/70">ملاحظات العمليات (سبب التسوية)</span>
                            <input ref={adjReasonRef} type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="مثلاً: بضاعة تالفة, خطأ جرد..."
                               className="w-full rounded-sm border border-sky-200 bg-white py-1.5 px-3 text-sm font-bold text-sky-900 outline-none focus:border-sky-500 shadow-sm" onKeyDown={e => handleKeyDown(e, { nextRef: adjSubmitRef, prevRef: adjQtyRef })} />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setAdjustRow(null)}
                              className="h-[34px] px-4 rounded-sm border border-sky-200 text-2sm font-black text-sky-700 hover:bg-sky-100 transition-colors">إلغاء</button>
                            <PermissionGate page="stock" action="adjust">
                              <button ref={adjSubmitRef} onClick={submitAdjust} disabled={adjLoading}
                                className="h-[34px] px-6 rounded-sm bg-sky-600 text-2sm font-black text-white hover:bg-sky-700 shadow-sm disabled:opacity-50 transition-colors flex items-center gap-1.5">
                                {adjLoading ? "جارٍ الحفظ..." : <><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد التسوية</>}
                              </button>
                            </PermissionGate>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              />
            </div>

            {/* Pagination Toolbar */}
            {!levelsLoading && filteredLevels.length > PAGE && (
               <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3">
                 <p className="text-2sm font-bold text-slate-400">عرض صفحة <span className="text-slate-800">{levelsPage}</span> من <span className="text-slate-800">{totalLvlPages}</span></p>
                 <div className="flex items-center gap-1" dir="ltr">
                   <button disabled={levelsPage === 1} onClick={() => setLP((p) => p - 1)}
                     className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 shadow-sm transition-all">
                     <ChevronLeft className="h-4 w-4" />
                   </button>
                   <span className="px-3 text-sm font-black">{levelsPage}</span>
                   <button disabled={levelsPage === totalLvlPages} onClick={() => setLP((p) => p + 1)}
                     className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 shadow-sm transition-all">
                     <ChevronRight className="h-4 w-4" />
                   </button>
                 </div>
               </div>
            )}
          </div>
        )}

        {/* ══════════ TRANSFER TAB ══════════ */}
        {tab === "transfer" && (
          <div className="flex flex-col bg-slate-50/50">
            {/* Top Config Strip */}
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-6 py-4 border-b border-slate-200 bg-white">
              <div className="w-52 space-y-1.5 relative group">
                <span className="text-[11px] font-black tracking-widest uppercase text-slate-500">من مخزن (المصدر)</span>
                 <select ref={txFromRef} data-help="st-form-source"
                   value={fromWH} onChange={(e) => { setFromWH(e.target.value); setToWH(""); }}
                   className="w-full appearance-none rounded-sm border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-3 text-sm font-black text-slate-800 outline-none focus:border-slate-800 focus:bg-white shadow-sm transition-colors" onKeyDown={e => handleKeyDown(e, { nextRef: txToRef })}>
                  <option value="">اختر المخزن المصدر...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <ChevronDown className="absolute left-3 bottom-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="w-52 space-y-1.5 relative group">
                <span className="text-[11px] font-black tracking-widest uppercase text-slate-500">إلى مخزن (الوجهة)</span>
                 <select ref={txToRef} data-help="st-form-destination"
                   value={toWH} onChange={(e) => setToWH(e.target.value)}
                   className={`w-full appearance-none rounded-sm border py-2 pl-8 pr-3 text-sm font-black outline-none transition-colors shadow-sm
                    ${fromWH && !toWH ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-600 focus:bg-white" : "border-slate-200 bg-slate-50/50 text-slate-800 focus:border-slate-800 focus:bg-white"}`} onKeyDown={e => handleKeyDown(e, { nextRef: txNotesRef, prevRef: txFromRef })}>
                  <option value="">اختر المخزن الوجهة...</option>
                  {warehouses.filter(w => String(w.id) !== String(fromWH)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <ChevronDown className="absolute left-3 bottom-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                {fromWH && !toWH && <span className="absolute -top-1 left-0 flex items-center gap-1 text-[11px] font-black text-amber-600 animate-pulse"><AlertTriangle className="h-3 w-3" />مطلوب</span>}
              </div>
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <span className="text-[11px] font-black tracking-widest uppercase text-slate-500">ملاحظات (اختياري)</span>
                 <input ref={txNotesRef} data-help="st-form-notes"
                   type="text" value={txNotes} onChange={(e) => setTxNotes(e.target.value)} placeholder="سبب التحويل أو رقم الإذن..."
                   className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-sm font-bold outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm" onKeyDown={e => handleKeyDown(e, { nextRef: txSubmitRef, prevRef: txToRef })} />
              </div>
            </div>

            {/* Error & Route Strip */}
            {(fromWH && toWH) && (
              <div className={`flex items-center justify-between px-6 py-2.5 border-b shadow-sm ${errorItems.length > 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-100"}`}>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-2 text-sm font-black ${errorItems.length > 0 ? "text-rose-800" : "text-emerald-800"}`}>
                    <span>{fromWarehouse?.name}</span>
                    <ArrowLeftRight className="h-4 w-4 opacity-50" />
                    <span>{toWarehouse?.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {validItems.length > 0 && <span className="bg-emerald-200/50 text-emerald-800 px-2 py-0.5 rounded-sm text-[11px] font-black">{validItems.length} صنف جاهز</span>}
                  {errorItems.length > 0 && <span className="bg-rose-200/50 text-rose-800 px-2 py-0.5 rounded-sm text-[11px] font-black flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {errorItems.length} بها أخطاء</span>}
                </div>
              </div>
            )}
            
            {/* Validation Banner Expansion */}
            {errorItems.length > 0 && (
              <div className="bg-rose-50/50 px-6 py-3 border-b border-rose-100">
                 <ul className="space-y-1.5 column-count-1 lg:columns-2">
                    {errorItems.slice(0, 6).map(it => {
                       const v = itemValidation[it.item_id];
                       return (
                         <li key={it.item_id} className="text-[11px] font-bold text-rose-700 flex items-center gap-1.5 bg-rose-100/50 px-2 py-1 rounded-sm w-max break-inside-avoid">
                           {(it.item_code || it.code) && <span className="font-mono text-[11px] font-black text-rose-500 bg-rose-200/60 px-1 rounded">{it.item_code || it.code}</span>}
                           <span className="font-black text-rose-900">{it.item_name}</span>
                           {v === "no_qty" && <span>لم تحدد كمية للتحويل.</span>}
                           {v === "over_qty" && <span>لا يكفي! المطلوب {qtys[it.item_id]} والمتاح {it.quantity}</span>}
                         </li>
                       );
                    })}
                    {errorItems.length > 6 && <li className="text-[11px] font-bold text-rose-600 px-2 py-1">... و {errorItems.length - 6} عناصر أخرى.</li>}
                 </ul>
              </div>
            )}

            {!fromWH ? (
              <div className="flex flex-col items-center justify-center py-32 opacity-40">
                 <Warehouse className="h-16 w-16 text-slate-400 mb-4" />
                 <span className="text-sm font-black uppercase text-slate-500 tracking-widest">يرجى تحديد المخزن المصدر لتحميل البضاعة</span>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Search & Actions */}
                <div className="flex items-center justify-between px-6 py-3 bg-slate-50/70 border-b border-slate-200">
                  <div className="relative w-72 group">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                     <input data-help="st-form-search"
                       type="text" value={txSearch} onChange={(e) => setTxSearch(e.target.value)}
                       placeholder="ابحث بالاسم أو الكود أو الباركود..."
                       className="w-full rounded-sm border border-slate-200 bg-white py-1.5 pl-3 pr-9 text-2sm font-bold outline-none focus:border-slate-800 transition-colors shadow-sm" />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-2sm font-black text-slate-500 uppercase tracking-widest">{filteredTxItems.length} صنف متاح</span>
                    {selected.size > 0 && (
                      <button onClick={() => { setSelected(new Set()); setQtys({}); }}
                        className="flex items-center gap-1 text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 hover:bg-rose-100 transition-colors">
                        <X className="h-3.5 w-3.5" /> مسح التحديد ({selected.size})
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                 <div data-help="st-form-items"
                   className="border border-slate-200 rounded-sm scrollbar-thin" style={{ maxHeight: '55vh', overflow: 'auto' }}>
                  <div className="pb-4">
                  <table className="w-full text-sm border-collapse min-w-max">
                    {/* Grouped Header Row */}
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th colSpan="1" className="w-[40px] bg-slate-50" />
                        <th colSpan="1" className="w-[100px] border-l border-slate-200 bg-slate-50" />
                        <th colSpan="1" className="w-[220px] border-l border-slate-200 bg-slate-50" />
                        <th colSpan="2" className="border-l border-slate-200 bg-blue-100 px-2 py-2">
                          <div className="text-[11px] font-black text-blue-700 uppercase tracking-wider text-center">
                            📦 {fromWarehouse?.name || "المصدر"}
                          </div>
                        </th>
                        <th colSpan="1" className="w-[130px] border-l border-slate-200 bg-amber-100 px-2 py-2">
                          <div className="text-[11px] font-black text-amber-700 uppercase tracking-wider text-center">
                            ↔️ النقل
                          </div>
                        </th>
                        <th colSpan="2" className="border-l border-slate-200 bg-emerald-100 px-2 py-2">
                          <div className="text-[11px] font-black text-emerald-700 uppercase tracking-wider text-center">
                            📥 {toWarehouse?.name || "الوجهة"}
                          </div>
                        </th>
                      </tr>
                      {/* Column Headers Row */}
                      <tr className="bg-slate-50/90 text-slate-500 border-b border-slate-200">
                        <th className="w-[40px] py-2 text-center">
                          <input type="checkbox"
                            checked={pageTxItems.filter((i) => i.quantity > 0).every((i) => selected.has(i.item_id)) && pageTxItems.some((i) => i.quantity > 0)}
                            ref={(el) => { if (el) el.indeterminate = somePageSel && !allPageSel; }}
                            onChange={toggleTxAllAvailable} 
                            className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-slate-800" 
                          />
                        </th>
                        <th className="w-[100px] py-2 text-center text-[11px] font-black border-l border-slate-100">الكود</th>
                        <th className="w-[220px] py-2 text-right px-3 text-[11px] font-black border-l border-slate-100">الصنف</th>
                        <th className="py-2 text-center text-[11px] font-black text-blue-600 border-l border-slate-100 bg-blue-50/30 w-[90px]">قبل</th>
                        <th className="py-2 text-center text-[11px] font-black text-blue-600 border-l border-slate-100 bg-blue-50/30 w-[80px]">بعد</th>
                         <th data-help="st-form-qty"
                           className="py-2 text-center text-[11px] font-black text-amber-700 border-l border-slate-100 bg-amber-50/30 w-[130px]">الكمية</th>
                        <th className="py-2 text-center text-[11px] font-black text-emerald-600 border-l border-slate-100 bg-emerald-50/30 w-[80px]">قبل</th>
                        <th className="py-2 text-center text-[11px] font-black text-emerald-600 bg-emerald-50/30 w-[80px]">بعد</th>
                      </tr>
                    </thead>
                    <tbody>
                        {pageTxItems.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="py-16 text-center">
                              <div className="flex flex-col items-center opacity-40">
                                <Package className="h-12 w-12 text-slate-400 mb-2" />
                                <span className="text-sm font-black text-slate-500">لا توجد أصناف في المصدر</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          pageTxItems.map((item) => {
                            const unavailable = item.quantity === 0;
                            const isSel = selected.has(item.item_id);
                            const validation = itemValidation[item.item_id];
                            const txQty = Number(qtys[item.item_id] || 0);
                            const destBefore = destStock[item.item_id] || 0;
                            const destAfter = isSel && txQty > 0 ? destBefore + txQty : null;
                            
                            let rowBg = "hover:bg-slate-50/50";
                            if (unavailable) rowBg = "bg-slate-50/80 opacity-60 grayscale";
                            else if (validation === "over_qty") rowBg = "bg-rose-50/60";
                            else if (validation === "no_qty") rowBg = "bg-amber-50/60";
                            else if (isSel) rowBg = "bg-sky-50/40";
                            
                            return (
                              <tr 
                                key={item.item_id}
                                onClick={() => !unavailable && toggleTxRow(item.item_id)}
                                className={`group border-b border-slate-100 transition-colors cursor-pointer ${rowBg}`}
                              >
                                <td className="py-2 text-center w-[40px]">
                                  <input type="checkbox" 
                                    checked={isSel} 
                                    disabled={unavailable} 
                                    onChange={() => !unavailable && toggleTxRow(item.item_id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-slate-800 disabled:opacity-30" 
                                  />
                                </td>
                                <td className="py-2 text-center font-mono text-[11px] font-black text-slate-500 border-l border-slate-100 w-[100px]">
                                  {(item.code || item.item_code)
                                    ? <Highlight text={item.code || item.item_code} query={txSearch} />
                                    : "—"}
                                </td>
                                <td className="py-2 px-3 border-l border-slate-100 w-[220px]">
                                  <div className="flex flex-col">
                                    <p className="font-black text-2sm text-slate-800 leading-tight"><Highlight text={item.item_name} query={txSearch} /></p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {item.barcode && <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-1 rounded-sm"><Highlight text={item.barcode} query={txSearch} /></span>}
                                      <span className="text-[9px] font-bold text-slate-400">{item.category_name || "—"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-center border-l border-slate-100 bg-blue-50/10 w-[90px]">
                                  <span className={`font-mono font-black text-sm ${item.quantity === 0 ? "text-rose-500" : item.quantity <= (item.min_stock_qty ?? 0) ? "text-amber-600" : "text-blue-700"}`}>
                                    {item.quantity}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center border-l border-slate-100 bg-blue-50/10 w-[80px]">
                                  {isSel && txQty > 0 ? (
                                    <div className="flex flex-col items-center">
                                      <span className={`font-mono font-black text-sm ${item.quantity - txQty < 0 ? "text-rose-600" : "text-blue-800"}`}>
                                        {item.quantity - txQty}
                                      </span>
                                      <span className="text-[8px] font-bold text-blue-500">−{txQty}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-mono text-2sm">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-1 text-center border-l border-slate-100 bg-amber-50/20 w-[130px]">
                                  {isSel && !unavailable ? (
                                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        onClick={() => setItemQty(item.item_id, String(Math.max(1, txQty - 1)))}
                                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-sm transition-colors"
                                      >
                                        −
                                      </button>
                                      <input type="number" min="1" max={item.quantity} step="1" 
                                        value={qtys[item.item_id] || ""} 
                                        onChange={(e) => setItemQty(item.item_id, e.target.value)}
                                        className={`w-14 rounded border py-1 text-center font-mono text-2sm font-black outline-none
                                          ${validation === "over_qty" ? "border-rose-400 bg-rose-50 text-rose-800"
                                          : validation === "no_qty" ? "border-amber-400 bg-amber-50 text-amber-900"
                                          : "border-amber-300 bg-white text-amber-900"}`}
                                      />
                                      <button 
                                        onClick={() => setItemQty(item.item_id, String(item.quantity))}
                                        className="w-6 h-6 flex items-center justify-center rounded bg-amber-200 hover:bg-amber-300 text-amber-800 font-black text-sm transition-colors"
                                        title="تحديد الكمية المتاحة كاملة"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-bold text-slate-300">انقر لتحديد</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center border-l border-slate-100 bg-emerald-50/10 w-[80px]">
                                  <span className="font-mono font-black text-2sm text-slate-600">{destBefore}</span>
                                </td>
                                <td className="py-2 px-2 text-center bg-emerald-50/10 w-[80px]">
                                  {destAfter !== null ? (
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono font-black text-sm text-emerald-700">
                                        {destAfter}
                                      </span>
                                      <span className="text-[8px] font-bold text-emerald-600">+{txQty}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-mono text-2sm">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {!txLoading && filteredTxItems.length > PAGE && (
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3">
                    <p className="text-2sm font-bold text-slate-400">عرض صفحة <span className="text-slate-800">{txPage}</span> من <span className="text-slate-800">{txTotalPages}</span></p>
                    <div className="flex items-center gap-1" dir="ltr">
                      <button disabled={txPage === 1} onClick={() => setTxPage((p) => p - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 shadow-sm transition-all">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-3 text-sm font-black">{txPage}</span>
                      <button disabled={txPage === txTotalPages} onClick={() => setTxPage((p) => p + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 shadow-sm transition-all">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Section */}
            {fromWH && toWH && selected.size > 0 && (
              <div className="border-t border-slate-200 bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 rounded-sm text-2sm font-black ${errorItems.length > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {errorItems.length > 0 ? `${errorItems.length} أخطاء` : `${validItems.length} صنف جاهز`}
                    </span>
                    <span className="text-2sm font-bold text-slate-500">
                      {fromWarehouse?.name} ← {toWarehouse?.name}
                    </span>
                    <button onClick={() => { setSelected(new Set()); setQtys({}); }} className="text-[11px] font-bold text-slate-400 hover:text-rose-600 underline">
                      مسح التحديد
                    </button>
                  </div>
                  <PermissionGate page="stock" action="transfer">
                     <button ref={txSubmitRef} data-help="st-form-submit"
                       onClick={handleTransferSubmit} disabled={txSubmitting || !canTransfer}
                       className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-sm font-black text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                      <CheckCircle2 className="h-4 w-4" />
                      {txSubmitting ? "جاري التحويل..." : "تنفيذ التحويل"}
                    </button>
                  </PermissionGate>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ HISTORY TAB ══════════ */}
        {tab === "history" && (
          <div className="flex flex-col bg-slate-50/50 min-h-[500px]">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
              <SearchInput
                value={movSearch}
                onChange={setMovSearch}
                placeholder="بحث سريع برقم الصنف أو الباركود..."
                className="flex-1 min-w-[220px]"
                size="md"
              />
              <div className="relative w-44 group">
                <select ref={movWhRef} value={movWH} onChange={(e) => setMovWH(e.target.value)} className="w-full appearance-none rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm" onKeyDown={e => handleKeyDown(e, { nextRef: movTypeRef })}>
                  {whOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative w-48 group">
                <select ref={movTypeRef} value={movType} onChange={(e) => setMovType(e.target.value)} className="w-full appearance-none rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm" onKeyDown={e => handleKeyDown(e, { nextRef: movDateFromRef, prevRef: movWhRef })}>
                  <option value="">كل أنواع الحركات</option>
                  {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <input ref={movDateFromRef} type="date" value={movDateFrom} onChange={(e) => setMovDateFrom(e.target.value)} className="rounded-md border border-slate-200 bg-white py-2 px-3 text-2sm font-black text-slate-700" onKeyDown={e => handleKeyDown(e, { nextRef: movDateToRef, prevRef: movTypeRef })} />
              <input ref={movDateToRef} type="date" value={movDateTo} onChange={(e) => setMovDateTo(e.target.value)} className="rounded-md border border-slate-200 bg-white py-2 px-3 text-2sm font-black text-slate-700" onKeyDown={e => handleKeyDown(e, { prevRef: movDateFromRef })} />
              <p className="text-2sm font-black text-slate-500">{movTotal} حركة</p>
            </div>

            <div className="flex flex-col flex-1 h-[62vh] min-h-[400px]">
              <DataGrid
                data={movements}
                rowKey="id"
                emptyMessage={movLoading ? "جاري تحميل الحركات..." : "لا توجد حركات"}
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                sortConfig={movSort} 
                onSort={toggleMovSort}
                columns={[
                  {
                    id: "created_at", header: "التاريخ والوقت", width: 140, sortable: true,
                    headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-500 border-l border-slate-100",
                    render: (mv) => mv.created_at?.slice(0, 16).replace("T", " ")
                  },
                  {
                    id: "code", header: "الكود", width: 100, sortable: false, headerClass: "text-center", cellClass: "text-center font-mono text-2sm font-black text-slate-500 border-l border-slate-100",
                    render: (mv) => mv.item_code || mv.code || "—"
                  },
                  {
                    id: "item_name", header: "الصنف", width: 220, sortable: true,
                    headerClass: "text-right px-3", cellClass: "px-3 border-l border-slate-100",
                    render: (mv) => (
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800">{mv.item_name}</span>
                          {(mv.item_code || mv.code || mv.barcode) && <span className="font-mono text-[11px] text-slate-400">{mv.item_code || mv.code || mv.barcode}</span>}
                       </div>
                    )
                  },
                  {
                    id: "warehouse_name", header: "المخزن", width: 140, sortable: true,
                    headerClass: "text-right px-3", cellClass: "px-3 text-2sm font-bold text-slate-600 border-l border-slate-100",
                    render: (mv) => mv.warehouse_name || "—"
                  },
                  {
                    id: "movement_type", header: "نوع الحركة", width: 150, sortable: true,
                    headerClass: "text-center", cellClass: "text-center px-2 py-2 border-l border-slate-100",
                    render: (mv) => {
                      const { label, color, badge, Icon } = MOV_META(mv.movement_type);
                      return (
                         <span className={`inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-sm text-[11px] font-black border ${badge} ${color}`}>
                           <Icon className="h-3 w-3" />{label}
                         </span>
                      );
                    }
                  },
                  {
                    id: "quantity", header: "الكمية", width: 100, sortable: true,
                    headerClass: "text-center bg-slate-50/40", cellClass: "text-center border-l text-sm font-mono font-black border-slate-100 bg-slate-50/40",
                    render: (mv) => {
                      const pos = mv.quantity > 0;
                      return <span className={`${pos ? "text-emerald-700" : "text-rose-700"}`}>{pos ? "+" : ""}{mv.quantity}</span>;
                    }
                  },
                  {
                    id: "before_qty", header: "قبل ← بعد", width: 140, sortable: true,
                    headerClass: "text-center", cellClass: "text-center text-2sm font-mono font-black text-slate-700 border-l border-slate-100",
                    render: (mv) => (
                      <>{(mv.before_qty ?? "—")} <span className="text-slate-400">←</span> {(mv.after_qty ?? "—")}</>
                    )
                  },
                  {
                    id: "notes", header: "الملاحظات", width: 180, sortable: true,
                    headerClass: "text-right px-3", cellClass: "text-right px-3 text-[11px] font-bold text-slate-500 truncate border-l border-slate-100",
                    render: (mv) => <span title={mv.notes}>{mv.notes || "—"}</span>
                  },
                  {
                    id: "created_by", header: "المستخدم", width: 100, sortable: false,
                    headerClass: "text-center", cellClass: "text-center text-[11px] font-bold text-slate-600 border-l border-slate-100",
                    render: (mv) => mv.created_by_name || "—"
                  },
                  {
                    id: "actions", header: "الإجراءات", width: 220, sortable: false,
                    headerClass: "text-center", cellClass: "text-center py-2 px-2",
                    render: (mv) => {
                      const canDelete = mv.movement_type === "manual_adjustment";
                      return (
                         <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => openMovementDetails(mv.id)} className="rounded border border-slate-200 px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50"><Eye className="h-3 w-3 inline mr-1" /> عرض</button>
                             <PermissionGate page="stock" action="edit">
                               <button onClick={() => startEditMovement(mv)} className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-100"><Pencil className="h-3 w-3 inline mr-1" /> تعديل</button>
                             </PermissionGate>
                             <PermissionGate page="stock" action="delete">
                               <button onClick={() => setDeleteMovement(mv)} disabled={!canDelete} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-40"><Trash2 className="h-3 w-3 inline mr-1" /> حذف</button>
                             </PermissionGate>
                         </div>
                      );
                    }
                  }
                ]}
              />
            </div>

            {!movLoading && movTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3">
                <p className="text-2sm font-bold text-slate-500">صفحة <span className="text-slate-800">{movPage}</span> من <span className="text-slate-800">{movTotalPages}</span></p>
                <div className="flex items-center gap-1" dir="ltr">
                  <button disabled={movPage === 1} onClick={() => setMovPage((p) => p - 1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="px-3 text-sm font-black">{movPage}</span>
                  <button disabled={movPage === movTotalPages} onClick={() => setMovPage((p) => p + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      <Modal open={Boolean(movementDetails) || movementLoading} onClose={() => setMovementDetails(null)} title="تفاصيل الحركة" showDetach={false}>
        {movementLoading ? (
          <p className="text-sm font-bold text-slate-500">جاري التحميل...</p>
        ) : movementDetails ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="font-black">رقم الحركة:</span> {movementDetails.id}</div>
            <div><span className="font-black">التاريخ:</span> {movementDetails.created_at}</div>
            <div><span className="font-black">الصنف:</span> {movementDetails.item_name}{(movementDetails.item_code || movementDetails.code) && <span className="font-mono text-[11px] text-slate-400 mr-2">{movementDetails.item_code || movementDetails.code}</span>}</div>
            <div><span className="font-black">الباركود:</span> {movementDetails.barcode || "—"}</div>
            <div><span className="font-black">المخزن:</span> {movementDetails.warehouse_name || "—"}</div>
            <div><span className="font-black">نوع الحركة:</span> {MOV_META(movementDetails.movement_type).label}</div>
            <div><span className="font-black">الرصيد قبل:</span> {movementDetails.before_qty ?? "—"}</div>
            <div><span className="font-black">الرصيد بعد:</span> {movementDetails.after_qty ?? "—"}</div>
            <div className="md:col-span-2"><span className="font-black">الملاحظات:</span> {movementDetails.notes || "—"}</div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(editMovement)} onClose={() => setEditMovement(null)} title="تعديل الحركة" showDetach={false}>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">تعديل ملاحظات الحركة #{editMovement?.id}</p>
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full min-h-[120px] rounded border border-slate-300 p-3 text-sm outline-none focus:border-slate-800" placeholder="اكتب الملاحظات..." />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditMovement(null)} className="rounded border border-slate-200 px-3 py-2 text-sm font-black">إلغاء</button>
            <button onClick={saveMovementNotes} disabled={editSaving} className="rounded bg-blue-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50">{editSaving ? "جارٍ الحفظ..." : "حفظ"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteMovement)}
        title="حذف الحركة"
        message="سيتم حذف الحركة وإرجاع أثرها على الرصيد. هل تريد المتابعة؟"
        onCancel={() => setDeleteMovement(null)}
        onConfirm={confirmDeleteMovement}
        confirmLabel={deleteLoading ? "جارٍ الحذف..." : "تأكيد الحذف"}
      />

      <ConfirmDialog
        open={txConfirm}
        title="تأكيد النقل"
        message={txMsg}
        onCancel={() => setTxConfirm(false)}
        onConfirm={confirmTransfer}
      />
    </div>
  );
}


