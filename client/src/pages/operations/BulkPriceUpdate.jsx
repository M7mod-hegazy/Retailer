import React, { useEffect, useMemo, useRef, useState } from "react";
import PriceHistoryTab from "../../components/operations/PriceHistoryTab";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  RefreshCcw,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  User,
  X,
  Filter,
  Activity,
  Pencil,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { usePageTour } from "../../hooks/usePageTour";

const PRICE_FIELDS = [
  { value: "retail_price",    label: "سعر القطاعي",  key: "sale_price" },
  { value: "wholesale_price", label: "سعر الجملة",   key: "wholesale_price" },
  { value: "cost_price",      label: "سعر التكلفة",  key: "purchase_price" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function applyAdjustment(price, direction, adjType, adjValue) {
  const raw = parseFloat(adjValue);
  if (!raw || isNaN(raw) || raw === 0) return null;
  const v = Math.abs(raw);
  const factor = direction === "down" ? -1 : 1;
  const result = adjType === "percentage"
    ? price * (1 + (factor * v) / 100)
    : price + factor * v;
  return Math.max(0, Math.round(result * 100) / 100);
}

function fieldLabelOf(priceField) {
  return PRICE_FIELDS.find((f) => f.value === priceField)?.label ?? priceField;
}

function fieldLabelByKey(key) {
  return PRICE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

function Tab({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-6 py-3 text-[13px] font-black uppercase tracking-widest border-b-2 transition-all ${
        active
          ? "border-slate-800 text-slate-900 bg-slate-50/50"
          : "border-transparent text-slate-400 hover:text-slate-800 hover:bg-slate-50/30"
      }`}>
      {children}
    </button>
  );
}

function ResizableTh({ label, sortKey, sortConfig, onSort, colKey, colWidths, onResizeStart, className = "", children }) {
  const isSorted = sortConfig?.key === sortKey;
  return (
    <th
      className={`relative select-none px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors group border-l border-slate-100 ${className}`}
      style={colWidths[colKey] ? { width: colWidths[colKey], minWidth: colWidths[colKey] } : {}}
    >
      <div className={`flex items-center gap-1 ${sortKey ? "cursor-pointer" : ""}`}
        onClick={() => sortKey && onSort && onSort(sortKey)}>
        <span>{label || children}</span>
        {sortKey && (
          <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className={`h-2.5 w-2.5 rotate-90 -mb-1 ${isSorted && sortConfig.direction === "asc" ? "text-slate-900 !opacity-100" : ""}`} />
            <ChevronLeft className={`h-2.5 w-2.5 -rotate-90 ${isSorted && sortConfig.direction === "desc" ? "text-slate-900 !opacity-100" : ""}`} />
          </div>
        )}
      </div>
      {colKey && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(e, colKey)}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors opacity-0 hover:opacity-100"
        />
      )}
    </th>
  );
}

export default function BulkPriceUpdatePage() {
  usePageTour('bulk_price_update');
  // ── Data ──
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // ── Selection ──
  const [selected, setSelected] = useState(new Set());

  // ── Inline price overrides: { [itemId]: string } ──
  const [inlineOverrides, setInlineOverrides] = useState({});
  const [editingCell, setEditingCell] = useState(null); // itemId being edited

  // ── Adjustment controls ──
  const [priceField, setPriceField] = useState("retail_price");
  const [adjType, setAdjType] = useState("percentage");
  const [adjValue, setAdjValue] = useState("");
  const [direction, setDirection] = useState("up");
  const [reason, setReason] = useState("");

  // ── Submit ──
  const [loading, setLoading] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);

  // ── History ──
  const [history, setHistory] = useState([]);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [lastOpId, setLastOpId] = useState(null);
  const [expandedOp, setExpandedOp] = useState(null);
  const [opItems, setOpItems] = useState([]);
  const [opItemsLoading, setOpItemsLoading] = useState(false);

  // ── Tab ──
  const [tab, setTab] = useState("items");

  // ── Column resizing ──
  const [colWidths, setColWidths] = useState({
    code: 100, name: 260, category: 140, purchase: 100, retail: 110, wholesale: 110, suggested: 140, diff: 90,
  });
  const resizingCol = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  function onResizeStart(e, key) {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = key;
    startX.current = e.clientX;
    startWidth.current = colWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMove = (ev) => {
      if (!resizingCol.current) return;
      const diff = startX.current - ev.clientX;
      setColWidths((p) => ({ ...p, [resizingCol.current]: Math.max(p[resizingCol.current] + diff, 60) }));
      startX.current = ev.clientX;
    };
    const onUp = () => {
      resizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    fetchItems();
    api.get("/api/categories").then((r) => setCategories(r.data.data || [])).catch(() => {});
    loadHistory();
  }, []);

  function fetchItems() {
    setFetchLoading(true);
    api.get("/api/items")
      .then((r) => setItems(r.data.data || []))
      .catch(() => toast.error("تعذر تحميل الأصناف"))
      .finally(() => setFetchLoading(false));
  }

  function loadHistory() {
    api.get("/api/items/bulk-price-history")
      .then((r) => setHistory(r.data.data || []))
      .catch(() => {});
  }

  async function loadOpItems(operationId) {
    if (expandedOp === operationId) { setExpandedOp(null); return; }
    setExpandedOp(operationId);
    setOpItemsLoading(true);
    try {
      const r = await api.get(`/api/items/bulk-price-history/${operationId}/items`);
      setOpItems(r.data.data || []);
    } catch { setOpItems([]); }
    finally { setOpItemsLoading(false); }
  }

  const fieldKey = PRICE_FIELDS.find((f) => f.value === priceField)?.key ?? "sale_price";

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    items.forEach((it) => {
      if (it.category_id) counts[it.category_id] = (counts[it.category_id] || 0) + 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      const matchSearch = !q || it.name?.toLowerCase().includes(q) || it.barcode?.includes(q) || it.code?.toLowerCase().includes(q);
      const matchCat = !categoryFilter || String(it.category_id) === String(categoryFilter);
      return matchSearch && matchCat;
    });
    return [...list].sort((a, b) => {
      let va = a[sortCol] ?? ""; let vb = b[sortCol] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, search, categoryFilter, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allFilteredIds = filtered.map((it) => it.id);
  const allPageIds = pageItems.map((it) => it.id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id));
  const somePageSelected = allPageIds.some((id) => selected.has(id));
  const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }
  function togglePageAll() {
    if (allPageSelected) setSelected((prev) => { const s = new Set(prev); allPageIds.forEach((id) => s.delete(id)); return s; });
    else setSelected((prev) => { const s = new Set(prev); allPageIds.forEach((id) => s.add(id)); return s; });
  }
  function selectAllFiltered() { setSelected(new Set(allFilteredIds)); }
  function clearSelection() { setSelected(new Set()); setInlineOverrides({}); }
  function toggleRow(id) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
        setInlineOverrides((o) => { const n = { ...o }; delete n[id]; return n; });
      } else {
        s.add(id);
      }
      return s;
    });
  }
  function goPage(p) { setPage(Math.max(1, Math.min(totalPages, p))); }
  useEffect(() => { setPage(1); }, [search, categoryFilter, pageSize]);

  // Inline override helpers
  function startEditing(e, itemId, currentSuggested) {
    e.stopPropagation();
    setEditingCell(itemId);
    if (!inlineOverrides[itemId] && currentSuggested !== null) {
      setInlineOverrides((o) => ({ ...o, [itemId]: String(currentSuggested) }));
    }
  }
  function commitEdit(itemId, value) {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      setInlineOverrides((o) => ({ ...o, [itemId]: String(Math.round(parsed * 100) / 100) }));
    } else {
      setInlineOverrides((o) => { const n = { ...o }; delete n[itemId]; return n; });
    }
    setEditingCell(null);
  }
  function clearOverride(e, itemId) {
    e.stopPropagation();
    setInlineOverrides((o) => { const n = { ...o }; delete n[itemId]; return n; });
    setEditingCell(null);
  }

  // Compute effective new price for an item
  function effectiveNewPrice(item) {
    if (inlineOverrides[item.id] !== undefined) {
      const v = parseFloat(inlineOverrides[item.id]);
      return isNaN(v) ? null : Math.max(0, Math.round(v * 100) / 100);
    }
    const currentPrice = parseFloat(item[fieldKey]) || 0;
    return applyAdjustment(currentPrice, direction, adjType, adjValue);
  }

  function handleApply() {
    const hasOverrides = Object.keys(inlineOverrides).some((id) => selected.has(Number(id)));
    const v = parseFloat(adjValue);
    const hasBulkFormula = v && !isNaN(v) && v !== 0;

    if (!hasOverrides && !hasBulkFormula) {
      toast.error("أدخل قيمة تعديل أو عدّل السعر يدوياً لأحد الأصناف");
      return;
    }
    if (selected.size === 0) { toast.error("اختر صنفاً واحداً على الأقل"); return; }

    // Build preview: compute old → new for every selected item
    const preview = [...selected].map((id) => {
      const item = items.find((it) => it.id === id);
      if (!item) return null;
      const oldPrice = parseFloat(item[fieldKey]) || 0;
      const newPrice = effectiveNewPrice(item);
      if (newPrice === null) return null;
      return {
        id: item.id,
        name: item.name,
        code: item.code || "",
        category: item.category_name || "",
        oldPrice,
        newPrice,
        diff: newPrice - oldPrice,
        isOverride: inlineOverrides[id] !== undefined,
      };
    }).filter(Boolean);

    setPreviewItems(preview);
    setPendingSubmit(true);
  }

  async function confirmApply() {
    setPendingSubmit(false);
    setLoading(true);

    const overrideIds = [...selected].filter((id) => inlineOverrides[id] !== undefined);
    const bulkIds = [...selected].filter((id) => inlineOverrides[id] === undefined);
    const v = parseFloat(adjValue);
    const hasBulkFormula = v && !isNaN(v) && v !== 0;

    try {
      let totalChanges = 0;
      let lastOpIdResult = null;

      // Bulk formula items
      if (bulkIds.length > 0 && hasBulkFormula) {
        const r = await api.post("/api/items/bulk-price-update", {
          item_ids: bulkIds,
          adjustment_type: adjType,
          adjustment_value: Math.abs(v),
          direction,
          price_field: priceField,
          reason,
        });
        totalChanges += r.data.changes || 0;
        lastOpIdResult = r.data.operation_id;
      }

      // Inline override items — submit each as exact fixed amount from current price
      for (const id of overrideIds) {
        const item = items.find((it) => it.id === id);
        if (!item) continue;
        const currentPrice = parseFloat(item[fieldKey]) || 0;
        const targetPrice = parseFloat(inlineOverrides[id]);
        if (isNaN(targetPrice)) continue;
        const diff = targetPrice - currentPrice;
        if (diff === 0) continue;
        const r = await api.post("/api/items/bulk-price-update", {
          item_ids: [id],
          adjustment_type: "fixed",
          adjustment_value: Math.abs(diff),
          direction: diff >= 0 ? "up" : "down",
          price_field: priceField,
          reason: reason || "تعديل يدوي مباشر",
        });
        totalChanges += r.data.changes || 0;
        if (!lastOpIdResult) lastOpIdResult = r.data.operation_id;
      }

      toast.success(`تم تحديث ${totalChanges} صنف بنجاح`);
      if (lastOpIdResult) setLastOpId(lastOpIdResult);
      setSelected(new Set());
      setInlineOverrides({});
      setAdjValue("");
      setReason("");
      fetchItems();
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل التحديث");
    } finally {
      setLoading(false);
    }
  }

  async function handleRollback(opId) {
    setRollbackLoading(true);
    try {
      const r = await api.post("/api/items/bulk-price-rollback", { operation_id: opId });
      toast.success(`تم استرجاع ${r.data.restored} صنف`);
      if (opId === lastOpId) setLastOpId(null);
      if (opId === expandedOp) setExpandedOp(null);
      fetchItems();
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل الاسترجاع");
    } finally {
      setRollbackLoading(false);
    }
  }

  const hasInlineOverrides = [...selected].some((id) => inlineOverrides[id] !== undefined);
  const v = parseFloat(adjValue);
  const hasBulkFormula = v && !isNaN(v) && v !== 0;
  const sortConfig = { key: sortCol, direction: sortDir };

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6 pb-10" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-900">تحديث الأسعار المجمّع</h1>
          <p className="text-[13px] font-bold text-slate-400">تعديل أسعار الشراء، البيع، أو الجملة دفعة واحدة</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
            <Activity className="h-4 w-4 text-emerald-500" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase leading-none">الأصناف المتاحة</span>
              <span className="text-[13px] font-black text-slate-800 leading-none">{items.length}</span>
            </div>
          </div>
          <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
            <Tag className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase leading-none">مُختار للتعديل</span>
              <span className="text-[13px] font-black text-slate-800 leading-none">{selected.size}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col rounded-sm border border-slate-200 bg-white shadow-sm">

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <div data-help="search-bar" className="relative flex-1 group">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث سريع بأسم أو كود الصنف..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-[13px] font-bold outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="relative w-72 group">
              <Filter className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select data-help="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-[13px] font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm">
                <option value="">كل الأقسام ({items.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sku_prefix ? `${c.sku_prefix} — ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={fetchItems}
            className="flex items-center gap-2 rounded-sm bg-slate-900 px-6 py-2.5 text-[13px] font-black text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95">
            <RefreshCcw className={fetchLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> تحديث الأصناف
          </button>
        </div>

        {/* Settings Strip */}
        <div className="flex flex-wrap items-end gap-6 px-6 py-5 border-b border-slate-100 bg-white">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">الاتجاه</label>
            <div className="flex overflow-hidden rounded-sm border border-slate-200 shadow-sm font-bold text-[13px]">
              <button type="button" onClick={() => setDirection("up")}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 transition-colors ${direction === "up" ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                <ArrowUp className="h-3.5 w-3.5" /> زيادة
              </button>
              <div className="w-[1px] bg-slate-200" />
              <button type="button" onClick={() => setDirection("down")}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 transition-colors ${direction === "down" ? "bg-rose-500 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                <ArrowDown className="h-3.5 w-3.5" /> خصم
              </button>
            </div>
          </div>

          <div data-help="update-method" className="space-y-1.5 flex-1 max-w-[200px]">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">النوع</label>
            <div className="flex overflow-hidden rounded-sm border border-slate-200 shadow-sm font-bold text-[13px]">
              <button type="button" onClick={() => setAdjType("percentage")}
                className={`flex-1 py-2 transition-colors ${adjType === "percentage" ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                نسبة %
              </button>
              <div className="w-[1px] bg-slate-200" />
              <button type="button" onClick={() => setAdjType("fixed")}
                className={`flex-1 py-2 transition-colors ${adjType === "fixed" ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                مبلغ مقطوع
              </button>
            </div>
          </div>

          <div className="w-32 space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">القيمة</label>
            <input type="number" step="0.01" min="0" value={adjValue} onChange={(e) => setAdjValue(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-[13px] font-black outline-none focus:border-slate-800 shadow-sm font-mono text-center" />
          </div>

          <div className="w-48 space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">حقل السعر</label>
            <select value={priceField} onChange={(e) => setPriceField(e.target.value)}
              className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2 px-3 text-[13px] font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm">
              {PRICE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div className="flex-1 space-y-1.5 hidden md:block">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">ملاحظات التغيير (اختياري)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تحديثات أبريل"
              className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-[13px] font-bold outline-none focus:border-slate-800 shadow-sm" />
          </div>

          <div className="space-y-1.5 shrink-0">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block">
              {selected.size > 0 ? `${selected.size} صنف محدد` : "تنفيذ"}
            </label>
            <button data-help="apply-button" onClick={handleApply}
              disabled={loading || selected.size === 0 || (!hasBulkFormula && !hasInlineOverrides)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-sm font-black text-[13px] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95 whitespace-nowrap">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "جاري التحديث..." : "تنفيذ التسعير"}
            </button>
          </div>
        </div>

        {/* Rollback banner */}
        {lastOpId && (
          <div className="flex items-center gap-3 bg-amber-50 px-6 py-3 border-b border-amber-100">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-[12px] font-bold text-amber-800">
              يوجد سجل لتعديل أخير قيد الانتظار <span className="mx-1 font-mono">{lastOpId}</span>
            </p>
            <button onClick={() => handleRollback(lastOpId)} disabled={rollbackLoading}
              className="h-7 px-4 rounded border border-amber-300 bg-amber-100 text-amber-900 text-[11px] font-black hover:bg-amber-200 active:scale-95 transition-all">
              {rollbackLoading ? "جارٍ..." : "تراجع عن التغييرات"}
            </button>
            <button onClick={() => setLastOpId(null)} className="h-7 w-7 flex items-center justify-center rounded text-amber-500 hover:bg-amber-100 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center bg-slate-50 border-b border-slate-200">
          <Tab active={tab === "items"} onClick={() => setTab("items")}>قائمة الأصناف ({filtered.length})</Tab>
          <Tab active={tab === "history"} onClick={() => setTab("history")}>سجل العمليات السابقة ({history.length})</Tab>
          <Tab active={tab === "price_history"} onClick={() => setTab("price_history")}>سجل تغييرات الأسعار</Tab>
        </div>

        {/* ══════════ ITEMS TAB ══════════ */}
        {tab === "items" && (
          <div className="flex flex-col bg-slate-50/50">
            {(somePageSelected && !allFilteredSelected && filtered.length > pageSize) && (
              <div className="flex items-center justify-between bg-sky-50 px-6 py-2 border-b border-sky-100">
                <span className="text-[12px] font-bold text-sky-800">تم تحديد {selected.size} صنف من هذه الصفحة.</span>
                <button onClick={selectAllFiltered} className="text-[12px] font-black text-sky-600 underline underline-offset-4 hover:text-sky-800">
                  تحديد جميع الـ {filtered.length} صنف في النتائج
                </button>
              </div>
            )}

            <div data-help="main-table" className="max-h-[60vh] overflow-auto scrollbar-thin bg-white">
              <div className="pb-4">
              <table className="w-max border-collapse table-fixed text-right min-w-full">
                <thead className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm">
                  <tr className="border-b border-slate-200 shadow-sm">
                    <th className="w-10 px-1 py-3 text-center border-l border-slate-100">
                      <input type="checkbox" checked={allPageSelected}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                        onChange={togglePageAll} className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-slate-800" />
                    </th>
                    <ResizableTh label="الكود" sortKey="code" sortConfig={sortConfig} onSort={handleSort} colKey="code" colWidths={colWidths} onResizeStart={onResizeStart} className="text-center" />
                    <ResizableTh label="الصنف" sortKey="name" sortConfig={sortConfig} onSort={handleSort} colKey="name" colWidths={colWidths} onResizeStart={onResizeStart} />
                    <ResizableTh label="القسم" sortKey="category_name" sortConfig={sortConfig} onSort={handleSort} colKey="category" colWidths={colWidths} onResizeStart={onResizeStart} />
                    <ResizableTh label="سعر الشراء" sortKey="purchase_price" sortConfig={sortConfig} onSort={handleSort} colKey="purchase" colWidths={colWidths} onResizeStart={onResizeStart} className="text-slate-500" />
                    <ResizableTh label="سعر المستهلك" sortKey="sale_price" sortConfig={sortConfig} onSort={handleSort} colKey="retail" colWidths={colWidths} onResizeStart={onResizeStart} className="text-emerald-600" />
                    <ResizableTh label="سعر الجملة" sortKey="wholesale_price" sortConfig={sortConfig} onSort={handleSort} colKey="wholesale" colWidths={colWidths} onResizeStart={onResizeStart} className="text-blue-600" />
                    <ResizableTh colKey="suggested" colWidths={colWidths} onResizeStart={onResizeStart} className="text-amber-600">
                      <div className="flex flex-col gap-0.5">
                        <span>السعر الجديد</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded w-fit ${
                          priceField === "retail_price" ? "bg-emerald-100 text-emerald-700" :
                          priceField === "wholesale_price" ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>{fieldLabelOf(priceField)}</span>
                      </div>
                    </ResizableTh>
                    <ResizableTh colKey="diff" colWidths={colWidths} onResizeStart={onResizeStart} className="text-slate-400 text-left">
                      الفرق
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fetchLoading ? (
                    <tr><td colSpan={9} className="py-24 text-center text-[13px] font-black text-slate-300 uppercase tracking-widest animate-pulse">يتم استدعاء الأصناف...</td></tr>
                  ) : pageItems.length === 0 ? (
                    <tr><td colSpan={9} className="py-24 text-center text-[13px] font-black text-slate-300 uppercase tracking-widest animate-pulse">لا توجد أصناف مطابقة</td></tr>
                  ) : pageItems.map((item) => {
                    const isSelected = selected.has(item.id);
                    const hasOverride = inlineOverrides[item.id] !== undefined;
                    const isEditing = editingCell === item.id;
                    const currentPrice = parseFloat(item[fieldKey]) || 0;
                    const newPrice = effectiveNewPrice(item);
                    const diff = newPrice !== null ? newPrice - currentPrice : null;
                    const isUp = diff !== null && diff > 0;
                    const isDown = diff !== null && diff < 0;

                    return (
                      <tr key={item.id}
                        onClick={() => !isEditing && toggleRow(item.id)}
                        className={`group cursor-pointer transition-colors border-r-4 ${
                          isSelected
                            ? isDown
                              ? "bg-rose-50 border-r-rose-400"
                              : "bg-emerald-50 border-r-emerald-400"
                            : "border-r-transparent hover:bg-slate-50/50"
                        }`}
                      >
                        {/* Checkbox — stop propagation so row click doesn't double-toggle */}
                        <td className="px-1 py-1 text-center border-l border-slate-100"
                          onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(item.id)}
                            className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-slate-800" />
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-center font-mono text-[12px] font-black text-slate-500">
                          {item.code || "—"}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100">
                          <p className="font-black text-[13px] text-slate-800">{item.name}</p>
                          {item.barcode && <p className="font-mono text-[11px] text-slate-400">{item.barcode}</p>}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-[12px] font-bold text-slate-500">
                          {item.category_name || "—"}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-right font-mono font-bold text-[13px] text-slate-600">
                          {Number(item.purchase_price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-right font-mono font-bold text-[13px] text-emerald-700">
                          {Number(item.sale_price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-right font-mono font-bold text-[13px] text-blue-700">
                          {Number(item.wholesale_price || 0).toFixed(2)}
                        </td>

                        {/* Suggested / inline-edit cell */}
                        <td className="px-2 py-1 border-l border-slate-100 text-right"
                          onClick={(e) => isSelected && e.stopPropagation()}>
                          {isSelected ? (
                            isEditing ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  autoFocus
                                  defaultValue={inlineOverrides[item.id] ?? (newPrice !== null ? newPrice : currentPrice)}
                                  onBlur={(e) => commitEdit(item.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitEdit(item.id, e.target.value);
                                    if (e.key === "Escape") { setEditingCell(null); }
                                  }}
                                  className="w-20 rounded border border-amber-400 bg-white px-2 py-0.5 text-[13px] font-black font-mono text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 text-center"
                                />
                                {hasOverride && (
                                  <button onClick={(e) => clearOverride(e, item.id)} title="إعادة ضبط"
                                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 group/cell">
                                {newPrice !== null ? (
                                  <span className={`font-mono font-black text-[13px] px-2 py-0.5 rounded transition-colors ${
                                    hasOverride
                                      ? "text-violet-700 bg-violet-100 ring-1 ring-violet-300"
                                      : isDown
                                        ? "text-rose-700 bg-rose-100"
                                        : "text-emerald-700 bg-emerald-100"
                                  }`}>
                                    {newPrice.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[13px] font-mono">—</span>
                                )}
                                <button
                                  onClick={(e) => startEditing(e, item.id, newPrice)}
                                  title="تعديل يدوي"
                                  className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover/cell:opacity-100 group-hover:opacity-100 transition-all">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                {hasOverride && (
                                  <button onClick={(e) => clearOverride(e, item.id)} title="إعادة ضبط"
                                    className="flex h-6 w-6 items-center justify-center rounded text-violet-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )
                          ) : (
                            newPrice !== null ? (
                              <span className="px-2 py-0.5 rounded font-mono text-[13px] font-black text-slate-300 bg-slate-50">
                                {newPrice.toFixed(2)}
                              </span>
                            ) : <span className="text-slate-200 text-[13px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2 text-left font-mono font-bold text-[12px]">
                          {diff !== null ? (
                            <span className={`px-2 py-0.5 rounded transition-colors ${
                              diff > 0 ? "text-emerald-500 bg-emerald-50" : diff < 0 ? "text-rose-500 bg-rose-50" : "text-slate-400 bg-slate-50"
                            }`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                            </span>
                          ) : <span className="text-slate-200">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            {/* Pagination */}
            {!fetchLoading && filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3">
                <div className="flex items-center gap-4">
                  <select className="h-8 rounded border border-slate-200 bg-white px-2 py-0 text-[11px] font-bold text-slate-600 outline-none shadow-sm"
                    value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} بالصفحة</option>)}
                  </select>
                  <p className="text-[12px] font-bold text-slate-400">عرض صفحة <span className="text-slate-800">{safePage}</span> من <span className="text-slate-800">{totalPages}</span></p>
                </div>
                <div className="flex items-center gap-1" dir="ltr">
                  <button disabled={safePage === 1} onClick={() => goPage(safePage - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 shadow-sm">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let p;
                    if (totalPages <= 5) p = i + 1;
                    else if (safePage <= 3) p = i + 1;
                    else if (safePage >= totalPages - 2) p = totalPages - 4 + i;
                    else p = safePage - 2 + i;
                    return (
                      <button key={p} onClick={() => goPage(p)}
                        className={`flex h-8 w-8 items-center justify-center rounded text-[12px] font-black transition-all shadow-sm ${
                          p === safePage ? "bg-slate-900 border-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800"
                        }`}>
                        {p}
                      </button>
                    );
                  })}
                  <button disabled={safePage === totalPages} onClick={() => goPage(safePage + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 shadow-sm">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ HISTORY TAB ══════════ */}
        {tab === "history" && (
          <div className="max-h-[70vh] overflow-auto scrollbar-thin bg-white p-0">
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-24 text-slate-300">
                <Clock className="h-10 w-10 animate-pulse" />
                <p className="text-[13px] font-black uppercase tracking-widest">لا توجد سجلات أرشفة</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-right min-w-full">
                <thead className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500 w-[160px] border-l border-slate-100">التوقيت</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase text-slate-500 border-l border-slate-100 w-[90px]">المتأثر</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500 border-l border-slate-100 w-[120px]">الحقل</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500 border-l border-slate-100 w-[130px]">قيمة التطبيق</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500 border-l border-slate-100 w-[120px]">بواسطة</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500 border-l border-slate-100">ملاحظات</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500 w-[130px]">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((op) => (
                    <React.Fragment key={op.operation_id}>
                      <tr
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedOp === op.operation_id ? "bg-slate-50 border-r-4 border-indigo-400" : ""}`}
                        onClick={() => loadOpItems(op.operation_id)}
                      >
                        <td className="px-4 py-3 font-mono text-[12px] text-slate-500 font-bold border-l border-slate-100">
                          {op.changed_at?.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-4 py-3 text-center border-l border-slate-100">
                          <span className="inline-block bg-sky-50 text-sky-700 px-2 py-0.5 rounded text-[11px] font-black">{op.items_count} صنف</span>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-bold text-slate-600 border-l border-slate-100">
                          {fieldLabelByKey(op.field)}
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100">
                          <span className={`font-mono font-black text-[13px] px-2 py-0.5 rounded ${op.adjustment_value > 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                            {op.adjustment_value > 0 ? "+" : ""}{op.adjustment_value} {op.adjustment_type === "percentage" ? "%" : "ج"}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100">
                          <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                            <User className="h-3 w-3 text-slate-400 shrink-0" />
                            {op.changed_by || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-bold text-slate-400 border-l border-slate-100">
                          {op.reason || "—"}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); loadOpItems(op.operation_id); }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-black transition-colors border ${
                                expandedOp === op.operation_id
                                  ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {expandedOp === op.operation_id
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />}
                              تفاصيل
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleRollback(op.operation_id); }} disabled={rollbackLoading}
                              className="flex items-center gap-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-sm text-[11px] font-black transition-colors">
                              <RefreshCcw className="h-3 w-3" /> استرجاع
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedOp === op.operation_id && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b border-indigo-100">
                            <div className="bg-indigo-50/50 px-6 py-3">
                              {opItemsLoading ? (
                                <div className="py-4 text-center text-[12px] font-bold text-slate-400 animate-pulse">جاري تحميل التفاصيل...</div>
                              ) : opItems.length === 0 ? (
                                <div className="py-4 text-center text-[12px] font-bold text-slate-400">لا توجد تفاصيل</div>
                              ) : (
                                <table className="w-full border-collapse text-right text-[12px]">
                                  <thead>
                                    <tr className="text-[10px] font-black uppercase text-slate-500 border-b border-indigo-100">
                                      <th className="pb-2 text-right">الصنف</th>
                                      <th className="pb-2 text-right">الفئة</th>
                                      <th className="pb-2 text-right">الحقل</th>
                                      <th className="pb-2 text-right w-[100px]">القيمة القديمة</th>
                                      <th className="pb-2 text-right w-[100px]">القيمة الجديدة</th>
                                      <th className="pb-2 text-right w-[80px]">التغيير</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-indigo-50">
                                    {opItems.map((oi) => {
                                      const delta = oi.new_value - oi.old_value;
                                      return (
                                        <tr key={oi.item_id} className="hover:bg-indigo-50 transition-colors">
                                          <td className="py-1.5 font-bold text-slate-800">
                                            {oi.item_name}
                                            {oi.barcode && <span className="font-mono text-[10px] text-slate-400 mr-2">{oi.barcode}</span>}
                                          </td>
                                          <td className="py-1.5 text-slate-500">{oi.category_name || "—"}</td>
                                          <td className="py-1.5 text-slate-500">{fieldLabelByKey(oi.field)}</td>
                                          <td className="py-1.5 font-mono text-slate-500">{Number(oi.old_value).toFixed(2)}</td>
                                          <td className="py-1.5 font-mono font-black text-slate-800">{Number(oi.new_value).toFixed(2)}</td>
                                          <td className="py-1.5 font-mono font-black">
                                            <span className={`px-1.5 py-0.5 rounded text-[11px] ${delta > 0 ? "text-emerald-700 bg-emerald-100" : delta < 0 ? "text-rose-700 bg-rose-100" : "text-slate-400 bg-slate-100"}`}>
                                              {delta > 0 ? "+" : ""}{delta.toFixed(2)}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════ PRICE HISTORY TAB ══════════ */}
        {tab === "price_history" && (
          <div className="flex-1 min-h-0" style={{ height: "70vh" }}>
            <PriceHistoryTab />
          </div>
        )}
      </div>

      {/* ══════════ PREVIEW MODAL ══════════ */}
      {pendingSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPendingSubmit(false)}>
          <div className="w-full max-w-2xl bg-white rounded-sm shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-[16px] font-black text-slate-900">معاينة التغييرات قبل التطبيق</h2>
                <p className="text-[12px] font-bold text-slate-400 mt-0.5">
                  {previewItems.length} صنف · حقل: {fieldLabelOf(priceField)}
                </p>
              </div>
              <button onClick={() => setPendingSubmit(false)} className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary bar */}
            {(() => {
              const ups   = previewItems.filter((it) => it.diff > 0);
              const downs = previewItems.filter((it) => it.diff < 0);
              const unchanged = previewItems.filter((it) => it.diff === 0);
              const totalImpact = previewItems.reduce((s, it) => s + it.diff, 0);
              return (
                <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-[12px] font-bold flex-wrap">
                  {ups.length > 0 && (
                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      <ArrowUp className="h-3 w-3" /> {ups.length} زيادة
                    </span>
                  )}
                  {downs.length > 0 && (
                    <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-1 rounded">
                      <ArrowDown className="h-3 w-3" /> {downs.length} تخفيض
                    </span>
                  )}
                  {unchanged.length > 0 && (
                    <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded">{unchanged.length} بدون تغيير</span>
                  )}
                  <span className="mr-auto font-mono font-black text-slate-700">
                    إجمالي الفارق:
                    <span className={`mr-1 ${totalImpact > 0 ? "text-emerald-600" : totalImpact < 0 ? "text-rose-600" : "text-slate-400"}`}>
                      {totalImpact > 0 ? "+" : ""}{totalImpact.toFixed(2)} ج
                    </span>
                  </span>
                </div>
              );
            })()}

            {/* Items table */}
            <div className="overflow-auto flex-1 scrollbar-thin">
              <table className="w-full border-collapse text-right text-[12px]">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-black text-slate-500 text-right">الصنف</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[100px]">القيمة الحالية</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[100px]">القيمة الجديدة</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[90px] text-left">الفرق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewItems.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <p className="font-black text-slate-800">{it.name}</p>
                        {it.code && <p className="font-mono text-[10px] text-slate-400">{it.code}</p>}
                        {it.isOverride && <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-1 rounded">مخصص</span>}
                      </td>
                      <td className="px-4 py-2 font-mono font-bold text-slate-500 text-right">{it.oldPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 font-mono font-black text-slate-900 text-right">{it.newPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-left">
                        <span className={`font-mono font-black text-[11px] px-1.5 py-0.5 rounded ${it.diff > 0 ? "text-emerald-700 bg-emerald-50" : it.diff < 0 ? "text-rose-700 bg-rose-50" : "text-slate-400 bg-slate-100"}`}>
                          {it.diff > 0 ? "+" : ""}{it.diff.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setPendingSubmit(false)}
                className="px-5 py-2 rounded-sm border border-slate-200 bg-white text-[13px] font-black text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button onClick={() => { setPendingSubmit(false); confirmApply(); }}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-black shadow-sm transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
                {loading ? "جاري التطبيق..." : `تأكيد تطبيق التسعير (${previewItems.length} صنف)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
