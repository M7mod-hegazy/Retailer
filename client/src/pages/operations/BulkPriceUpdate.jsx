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
  Plus,
  Layers,
  ListChecks,
  Info,
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

function parsePriceInput(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/^[+-]/.test(s)) {
    const isPercent = s.endsWith('%');
    const numStr = isPercent ? s.slice(0, -1) : s;
    const val = parseFloat(numStr);
    if (isNaN(val) || val === 0) return null;
    return {
      type: 'relative',
      direction: val >= 0 ? 'up' : 'down',
      adjustment_type: isPercent ? 'percentage' : 'fixed',
      adjustment_value: Math.abs(val),
      raw: s,
    };
  }
  const val = parseFloat(s);
  if (isNaN(val) || val < 0) return null;
  return { type: 'absolute', value: val, raw: s };
}

function BatchInlineEditCell({ item, inlineOverrides, setInlineOverrides, editingCell, setEditingCell, commitEdit }) {
  const [localValue, setLocalValue] = useState(() => {
    const existing = inlineOverrides[item.id];
    return existing || '';
  });

  useEffect(() => {
    const existing = inlineOverrides[item.id];
    setLocalValue(existing || '');
  }, [inlineOverrides[item.id], item.id]);

  const hasOverride = inlineOverrides[item.id] !== undefined;
  const isEditing = editingCell === item.id;
  const parsed = hasOverride ? parsePriceInput(inlineOverrides[item.id]) : null;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input type="text" inputMode="decimal" autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => commitEdit(item.id, localValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(item.id, localValue);
            if (e.key === "Escape") { setEditingCell(null); setLocalValue(inlineOverrides[item.id] || ''); }
          }}
          placeholder="سعر / ±قيمة"
          className="w-24 rounded border border-amber-400 bg-white px-2 py-0.5 text-sm font-black font-mono text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 text-center"
          title="أدخل سعراً مطلقاً (150) أو تعديل (+5, -10%, +15%)" />
        {hasOverride && (
          <button onClick={(e) => { e.stopPropagation(); setInlineOverrides((o) => { const n = { ...o }; delete n[item.id]; return n; }); setEditingCell(null); }}
            title="إعادة ضبط"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
    </div>
  );
}

  return (
    <div className="flex items-center justify-end gap-1.5 group/cell"
      onClick={(e) => e.stopPropagation()}>
      {hasOverride && parsed ? (
        <div className="flex items-center gap-1">
          {parsed.type === 'absolute' ? (
            <span className="font-mono font-black text-sm px-2 py-0.5 rounded bg-violet-100 text-violet-700 ring-1 ring-violet-300">
              {parsed.value.toFixed(2)}
            </span>
          ) : (
            <span className={`font-mono font-black text-sm px-2 py-0.5 rounded ${
              parsed.direction === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {parsed.direction === 'up' ? '+' : ''}{parsed.adjustment_type === 'percentage' ? `${parsed.adjustment_value}%` : `${parsed.adjustment_value}ج`}
            </span>
          )}
          <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-1 rounded">يدوي</span>
        </div>
      ) : (
        <span className="text-slate-300 text-sm font-mono">—</span>
      )}
      <button onClick={(e) => { e.stopPropagation(); setEditingCell(item.id); if (!inlineOverrides[item.id]) { setLocalValue(''); } }}
        title="تعديل يدوي — أدخل سعراً مطلقاً (150) أو تعديل نسبي (+5, -10%)"
        className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover/cell:opacity-100 group-hover:opacity-100 transition-all">
        <Pencil className="h-3 w-3" />
      </button>
      {hasOverride && (
        <button onClick={(e) => { e.stopPropagation(); setInlineOverrides((o) => { const n = { ...o }; delete n[item.id]; return n; }); }}
          title="إعادة ضبط"
          className="flex h-6 w-6 items-center justify-center rounded text-violet-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
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
      className={`relative select-none px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors group border-l border-slate-100 ${className}`}
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
  const [adjType, setAdjType] = useState("fixed");
  const [adjValue, setAdjValue] = useState("");
  const [direction, setDirection] = useState("up");
  const [reason, setReason] = useState("");

  // ── Submit ──
  const [loading, setLoading] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);

  // ── Batch Builder (accumulate changes then save as one) ──
  const [batchItems, setBatchItems] = useState([]);
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchPreview, setShowBatchPreview] = useState(false);
  const [batchEditingId, setBatchEditingId] = useState(null);
  let batchIdCounter = useRef(0);

  function updateBatchItemPrice(id, rawValue) {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) return;
    const val = parseFloat(trimmed);
    if (isNaN(val) || val < 0) { toast.error('أدخل رقماً صحيحاً للسعر'); return; }
    setBatchItems(prev => prev.map(bi => {
      if (bi.id !== id) return bi;
      const newPrice = Math.round(val * 100) / 100;
      if (newPrice === bi.oldPrice) return bi;
      return { ...bi, newPrice, diff: newPrice - bi.oldPrice, source: 'يدوي' };
    }));
  }

  function addSelectionToBatch() {
    if (selected.size === 0) { toast.error("اختر صنفاً واحداً على الأقل"); return; }
    const v = parseFloat(adjValue);
    const hasFormula = v && !isNaN(v) && v !== 0;
    if (!hasFormula && ![...selected].some(id => inlineOverrides[id] !== undefined)) {
      toast.error("أدخل قيمة تعديل أو استخدم التعديل اليدوي");
      return;
    }
    const newEntries = [];
    for (const id of [...selected]) {
      const item = items.find((it) => it.id === id);
      if (!item) continue;
      const raw = inlineOverrides[id];
      if (raw !== undefined) {
        const parsed = parsePriceInput(raw);
        if (!parsed) continue;
        const currentPrice = parseFloat(item[fieldKey]) || 0;
        let newPrice;
        if (parsed.type === 'absolute') {
          newPrice = Math.max(0, Math.round(parsed.value * 100) / 100);
        } else {
          newPrice = applyAdjustment(currentPrice, parsed.direction, parsed.adjustment_type, parsed.adjustment_value);
        }
        if (newPrice === null || newPrice === currentPrice) continue;
        const existing = batchItems.find(bi => bi.itemId === id && bi.field === priceField);
        if (existing) {
          setBatchItems(prev => prev.map(bi => bi.id === existing.id
            ? { ...bi, oldPrice: currentPrice, newPrice, diff: newPrice - currentPrice, source: 'يدوي' }
            : bi));
        } else {
          newEntries.push({
            id: ++batchIdCounter.current, itemId: id, name: item.name, code: item.code || '',
            field: priceField, fieldLabel: fieldLabelOf(priceField),
            oldPrice: currentPrice, newPrice, diff: newPrice - currentPrice,
            source: 'يدوي', direction, adjType, adjValue: Math.abs(v),
          });
        }
        continue;
      }
      if (!hasFormula) continue;
      const currentPrice = parseFloat(item[fieldKey]) || 0;
      const newPrice = applyAdjustment(currentPrice, direction, adjType, Math.abs(v));
      if (newPrice === null || newPrice === currentPrice) continue;
      const existing = batchItems.find(bi => bi.itemId === id && bi.field === priceField);
      if (existing) {
        setBatchItems(prev => prev.map(bi => bi.id === existing.id
          ? { ...bi, oldPrice: currentPrice, newPrice, diff: newPrice - currentPrice, source: 'صيغة' }
          : bi));
      } else {
        newEntries.push({
          id: ++batchIdCounter.current, itemId: id, name: item.name, code: item.code || '',
          field: priceField, fieldLabel: fieldLabelOf(priceField),
          oldPrice: currentPrice, newPrice, diff: newPrice - currentPrice,
          source: 'صيغة', direction, adjType, adjValue: Math.abs(v),
        });
      }
    }
    if (newEntries.length > 0) {
      setBatchItems(prev => [...prev, ...newEntries]);
      toast.success(`تمت إضافة ${newEntries.length} صنف إلى الدفعة`);
    } else {
      toast("لم تضف أي أصناف جديدة — قد تكون موجودة بالفعل أو الأسعار لم تتغير", { icon: 'ℹ️' });
    }
    setSelected(new Set());
    setInlineOverrides({});
    setAdjValue("");
  }

  function removeBatchItem(id) {
    setBatchItems(prev => prev.filter(bi => bi.id !== id));
  }

  function clearBatch() {
    setBatchItems([]);
  }

  async function handleBatchSave() {
    if (batchItems.length === 0) { toast.error("الدفعة فارغة — أضف أصنافاً أولاً"); return; }
    setBatchLoading(true);
    try {
      const rulesPayload = [];
      const overridesPayload = [];
      for (const bi of batchItems) {
        if (bi.source === 'يدوي') {
          overridesPayload.push({ item_id: bi.itemId, price_field: bi.field, new_price: bi.newPrice });
        } else {
          rulesPayload.push({
            item_ids: [bi.itemId],
            price_field: bi.field,
            direction: bi.direction,
            adjustment_type: bi.adjType,
            adjustment_value: bi.adjValue,
          });
        }
      }
      const r = await api.post("/api/items/bulk-price-batch-update", {
        rules: rulesPayload,
        inline_overrides: overridesPayload,
        reason: batchReason || "تحديث مجمّع",
      });
      toast.success(`تم حفظ ${r.data.changes} تغيير كعملية واحدة`);
      const opId = r.data.operation_id;
      if (opId) setLastOpId(opId);
      setSelected(new Set());
      setInlineOverrides({});
      setBatchItems([]);
      setBatchReason("");
      fetchItems();
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل حفظ الدفعة");
    } finally {
      setBatchLoading(false);
    }
  }

  // ── History ──
  const [history, setHistory] = useState([]);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [lastOpId, setLastOpId] = useState(null);
  const [expandedOp, setExpandedOp] = useState(null);
  const [opItems, setOpItems] = useState([]);
  const [opItemsLoading, setOpItemsLoading] = useState(false);

  // ── Tab ──
  const [tab, setTab] = useState("quick");

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

  async   function loadOpItems(operationId) {
    if (expandedOp === operationId) { setExpandedOp(null); return; }
    setExpandedOp(operationId);
    setOpItemsLoading(true);
    try {
      const r = await api.get(`/api/items/bulk-price-history/${operationId}/items`);
      setOpItems(r.data.data || []);
    } catch { setOpItems([]); }
    finally { setOpItemsLoading(false); }
  }

  function parseBatchMeta(op) {
    if (!op.batch_metadata) return null;
    try { return JSON.parse(op.batch_metadata); } catch { return null; }
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
  function commitEdit(itemId, rawValue) {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) {
      setInlineOverrides((o) => { const n = { ...o }; delete n[itemId]; return n; });
    } else {
      const parsed = parsePriceInput(trimmed);
      if (parsed) {
        setInlineOverrides((o) => ({ ...o, [itemId]: trimmed }));
      }
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
      const parsed = parsePriceInput(inlineOverrides[item.id]);
      if (!parsed) return null;
      const currentPrice = parseFloat(item[fieldKey]) || 0;
      if (parsed.type === 'absolute') {
        return Math.max(0, Math.round(parsed.value * 100) / 100);
      }
      return applyAdjustment(currentPrice, parsed.direction, parsed.adjustment_type, parsed.adjustment_value);
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

      // Inline override items — compute effective new price from smart parsing
      for (const id of overrideIds) {
        const item = items.find((it) => it.id === id);
        if (!item) continue;
        const currentPrice = parseFloat(item[fieldKey]) || 0;
        const newPrice = effectiveNewPrice(item);
        if (newPrice === null || newPrice === currentPrice) continue;
        const diff = newPrice - currentPrice;
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
      <style dangerouslySetInnerHTML={{__html:`
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}} />

        {/* Header */}
      <div data-help="page-header" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-900">تحديث الأسعار المجمّع</h1>
          <p className="text-sm font-bold text-slate-400">تعديل أسعار الشراء، البيع، أو الجملة دفعة واحدة</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
            <Activity className="h-4 w-4 text-emerald-500" />
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-black text-slate-400 uppercase leading-none">الأصناف المتاحة</span>
              <span className="text-sm font-black text-slate-800 leading-none">{items.length}</span>
            </div>
          </div>
          <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
            <Tag className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-black text-slate-400 uppercase leading-none">مُختار للتعديل</span>
              <span className="text-sm font-black text-slate-800 leading-none">{selected.size}</span>
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
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm font-bold outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="relative w-72 group">
              <Filter className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select data-help="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm">
                <option value="">كل الأقسام ({items.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sku_prefix ? `${c.sku_prefix} — ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button data-help="refresh-items" onClick={fetchItems}
            className="flex items-center gap-2 rounded-sm bg-slate-900 px-6 py-2.5 text-sm font-black text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95">
            <RefreshCcw className={fetchLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> تحديث الأصناف
          </button>
        </div>

        {/* Settings Strip */}
        <div className="flex flex-wrap items-end gap-6 px-6 py-5 border-b border-slate-100 bg-white">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">الاتجاه</label>
            <div data-help="direction-toggle" className="flex overflow-hidden rounded-sm border border-slate-200 shadow-sm font-bold text-sm">
              <button type="button" onClick={() => setDirection("up")}
                title="زيادة الأسعار — يطبق التعديل كإضافة على السعر الحالي"
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 transition-colors ${direction === "up" ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                <ArrowUp className="h-3.5 w-3.5" /> زيادة
              </button>
              <div className="w-[1px] bg-slate-200" />
              <button type="button" onClick={() => setDirection("down")}
                title="تخفيض الأسعار — يطبق التعديل كخصم من السعر الحالي"
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 transition-colors ${direction === "down" ? "bg-rose-500 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                <ArrowDown className="h-3.5 w-3.5" /> خصم
              </button>
            </div>
          </div>

          <div data-help="update-method" className="space-y-1.5 flex-1 max-w-[200px]">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">النوع</label>
            <div className="flex overflow-hidden rounded-sm border border-slate-200 shadow-sm font-bold text-sm">
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

          <div data-help="value-input" className="w-32 space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">القيمة</label>
            <input type="number" step="0.01" min="0" value={adjValue} onChange={(e) => setAdjValue(e.target.value)}
              placeholder="0.00"
              title="قيمة التعديل — الرقم الذي سيتم إضافته أو خصمه من السعر"
              className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-sm font-black outline-none focus:border-slate-800 shadow-sm font-mono text-center" />
          </div>

          <div data-help="price-field-select" className="w-48 space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">حقل السعر</label>
            <select value={priceField} onChange={(e) => setPriceField(e.target.value)}
              title="اختر حقل السعر المراد تعديله: سعر المستهلك، سعر الجملة، أو سعر التكلفة"
              className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-black text-slate-700 outline-none focus:border-slate-800 shadow-sm">
              {PRICE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div data-help="reason-input" className="flex-1 space-y-1.5 hidden md:block">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">ملاحظات التغيير (اختياري)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تحديثات أبريل"
              title="سجل ملاحظة توضيحية لهذه العملية لتظهر في سجل العمليات السابقة"
              className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-sm font-bold outline-none focus:border-slate-800 shadow-sm" />
          </div>

          <div className="space-y-1.5 shrink-0">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block">
              {selected.size > 0
                ? `${selected.size} صنف محدد — تجميع أم تطبيق فوري؟`
                : "خيارات التطبيق"}
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <button data-help="add-to-batch" onClick={addSelectionToBatch}
                  disabled={selected.size === 0}
                  title={selected.size === 0 ? "اختر صنفاً واحداً على الأقل أولاً" : `أضف ${selected.size} صنف إلى الدفعة المجمّعة — يمكنك إضافة المزيد لاحقاً`}
                  className={`flex items-center gap-2 px-5 py-2 rounded-sm font-black text-sm shadow-sm transition-all active:scale-95 whitespace-nowrap ${
                    selected.size === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}>
                  <Plus className="h-4 w-4" /> إضافة إلى الدفعة
                </button>
                {selected.size > 0 && (
                  <span className="absolute -bottom-3.5 right-0 text-[9px] font-bold text-indigo-400 whitespace-nowrap leading-none">تجميع ← حفظ كعملية</span>
                )}
              </div>
              <div className="relative">
                <button data-help="apply-button" onClick={handleApply}
                  disabled={loading || selected.size === 0 || (!hasBulkFormula && !hasInlineOverrides)}
                  title={selected.size === 0 ? "اختر صنفاً واحداً على الأقل" : "تنفيذ التعديل فوراً — يُنشئ عملية منفصلة لكل صنف"}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-sm font-black text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95 whitespace-nowrap">
                  <CheckCircle2 className="h-4 w-4" />
                  {loading ? "جاري التحديث..." : "تنفيذ التسعير"}
                </button>
                {selected.size > 0 && (
                  <span className="absolute -bottom-3.5 right-0 text-[9px] font-bold text-emerald-400 whitespace-nowrap leading-none">تطبيق فوري مباشر</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rollback banner */}
        {lastOpId && (
          <div className="flex items-center gap-3 bg-amber-50 px-6 py-3 border-b border-amber-100">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-2sm font-bold text-amber-800">
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
          <Tab active={tab === "quick"} onClick={() => setTab("quick")}
            data-help="tab-quick"
            title="اختر الأصناف، حدد التعديل، ثم طبّق فوراً أو أضف إلى الدفعة المجمّعة">
            تعديل سريع ({filtered.length})
          </Tab>
          <Tab active={tab === "history"} onClick={() => setTab("history")}
            data-help="tab-history"
            title="سجل جميع عمليات تعديل الأسعار السابقة — يمكن التراجع عنها">
            سجل العمليات السابقة ({history.length})
          </Tab>
          <Tab active={tab === "price_history"} onClick={() => setTab("price_history")}
            data-help="tab-price-history"
            title="سجل تغييرات الأسعار لكل صنف على حدة">
            سجل تغييرات الأسعار
          </Tab>
        </div>

        {/* Batch explanation banner (only in quick tab) */}
        {tab === "quick" && (
          <div data-help="batch-workflow-banner" className="flex items-start gap-3 px-6 py-2.5 bg-indigo-50/60 border-b border-indigo-100 text-2sm">
            <Layers className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-indigo-700 font-bold leading-relaxed">
              <p>
                <span className="font-black">مسار التجميع (دفعة):</span>{' '}
                اختر أصنافاً ← اضبط التعديل ← <span className="font-black">أضف إلى الدفعة</span> ← كرر مع أصناف وتعديلات مختلفة ←
                <span className="font-black"> احفظ الكل</span> كعملية واحدة
              </p>
              <p className="text-indigo-500 mt-1">
                <span className="font-black">مسار التطبيق الفوري:</span>{' '}
                اختر أصنافاً ← اضبط التعديل ← <span className="font-black">تنفيذ التسعير</span> ← الحفظ مباشرة (كل صنف بعملية منفصلة)
              </p>
            </div>
            <Info className="h-3.5 w-3.5 text-indigo-300 shrink-0 mt-0.5" title="يمكنك أيضاً تعديل السعر يدوياً لكل صنف عبر عمود التعديل — أدخل قيمة مطلقة (150) أو نسبة (+5%)" />
          </div>
        )}

        {/* ══════════ QUICK EDIT TAB ══════════ */}
        {tab === "quick" && (
          <div className="flex flex-col bg-slate-50/50">
            {/* Workflow progress tracker */}
            {(() => {
              const steps = [
                { key: 'select', label: 'اختر الأصناف', desc: 'حدد من الجدول', done: selected.size > 0 || batchItems.length > 0 },
                { key: 'adjust', label: 'اضبط التعديل', desc: 'اتجاه ونسبة', done: hasBulkFormula || hasInlineOverrides },
                { key: 'add', label: 'أضف للدفعة', desc: 'أو طبّق فوراً', done: batchItems.length > 0 },
                { key: 'save', label: 'احفظ الكل', desc: 'عملية واحدة', done: false },
              ];
              const activeIdx = steps.findIndex(s => !s.done);
              const current = activeIdx === -1 ? steps.length - 1 : Math.max(0, activeIdx);
              return (
                <div className="hidden md:flex items-center justify-between px-6 py-1.5 bg-white border-b border-slate-100">
                  <div className="flex items-center gap-0">
                    {steps.map((step, idx) => (
                      <div key={step.key} className={`flex items-center ${idx < steps.length - 1 ? 'ml-6' : ''}`}>
                        <div className={`flex items-center gap-1.5 transition-all duration-300 ${
                          idx < current ? 'text-emerald-600' : idx === current ? 'text-indigo-600' : 'text-slate-400'
                        }`}>
                          <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black transition-all duration-300 ${
                            idx < current
                              ? 'bg-emerald-100 text-emerald-700'
                              : idx === current
                                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                                : 'bg-slate-100 text-slate-400'
                          }`}>
                            {idx < current ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span className={`text-[11px] font-black leading-none ${idx === current ? 'text-indigo-700' : ''}`}>
                            {step.label}
                          </span>
                          {idx === current && (
                            <span className="text-[10px] font-bold text-indigo-400 animate-pulse">— {step.desc}</span>
                          )}
                        </div>
                        {idx < steps.length - 1 && (
                          <div className={`mx-2 h-px w-6 transition-all duration-300 ${
                            idx < current ? 'bg-emerald-300' : 'bg-slate-200'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                  {batchItems.length > 0 && (
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                      🔄 {batchItems.length} في الدفعة
                    </span>
                  )}
                </div>
              );
            })()}

            {(somePageSelected && !allFilteredSelected && filtered.length > pageSize) && (
              <div data-help="select-all-bar" className="flex items-center justify-between bg-sky-50 px-6 py-2 border-b border-sky-100">
                <span className="text-2sm font-bold text-sky-800">تم تحديد {selected.size} صنف من هذه الصفحة.</span>
                <button data-help="select-all-filtered" onClick={selectAllFiltered} className="text-2sm font-black text-sky-600 underline underline-offset-4 hover:text-sky-800">
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
                    <ResizableTh colKey="suggested" colWidths={colWidths} onResizeStart={onResizeStart} className="text-amber-600"
                      title="تعديل يدوي — أدخل سعراً مطلقاً (150)، زيادة (+5)، خصم (-10)، أو نسبة (+15%, -20%)">
                      <div className="flex flex-col gap-0.5">
                        <span>التعديل</span>
                        <span className="text-[9px] font-black text-slate-400">يدوي</span>
                      </div>
                    </ResizableTh>
                    <ResizableTh colKey="diff" colWidths={colWidths} onResizeStart={onResizeStart} className="text-slate-400 text-left">
                      الفرق
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fetchLoading ? (
                    <tr><td colSpan={9} className="py-24 text-center text-sm font-black text-slate-300 uppercase tracking-widest animate-pulse">يتم استدعاء الأصناف...</td></tr>
                  ) : pageItems.length === 0 ? (
                    <tr><td colSpan={9} className="py-24 text-center text-sm font-black text-slate-300 uppercase tracking-widest animate-pulse">لا توجد أصناف مطابقة</td></tr>
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
                        <td className="px-4 py-2 border-l border-slate-100 text-center font-mono text-2sm font-black text-slate-500">
                          {item.code || "—"}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100">
                          <p className="font-black text-sm text-slate-800">{item.name}</p>
                          {item.barcode && <p className="font-mono text-[11px] text-slate-400">{item.barcode}</p>}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-2sm font-bold text-slate-500">
                          {item.category_name || "—"}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-right font-mono font-bold text-sm text-slate-600">
                          {Number(item.purchase_price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-right font-mono font-bold text-sm text-emerald-700">
                          {Number(item.sale_price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 border-l border-slate-100 text-right font-mono font-bold text-sm text-blue-700">
                          {Number(item.wholesale_price || 0).toFixed(2)}
                        </td>

                        {/* Suggested / inline-edit cell */}
                        <td className="px-2 py-1 border-l border-slate-100 text-right"
                          onClick={(e) => isSelected && e.stopPropagation()}>
                          {isSelected ? (
                            isEditing ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input type="text" inputMode="decimal" autoFocus
                                  defaultValue={inlineOverrides[item.id] ?? (newPrice !== null ? newPrice.toFixed(2) : currentPrice.toFixed(2))}
                                  onBlur={(e) => commitEdit(item.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitEdit(item.id, e.target.value);
                                    if (e.key === "Escape") { setEditingCell(null); }
                                  }}
                                  placeholder="سعر / +5 / -10%"
                                  className="w-24 rounded border border-amber-400 bg-white px-2 py-0.5 text-sm font-black font-mono text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 text-center"
                                  title="أدخل سعراً مطلقاً (150) أو تعديل (+5, -10%, +15%)" />
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
                                  <>
                                    {hasOverride && inlineOverrides[item.id] ? (
                                      (() => {
                                        const p = parsePriceInput(inlineOverrides[item.id]);
                                        if (p && p.type === 'relative') {
                                          return (
                                            <span className={`font-mono font-black text-sm px-2 py-0.5 rounded ${
                                              p.direction === 'up' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                                            }`}>
                                              {p.direction === 'up' ? '+' : ''}{p.adjustment_type === 'percentage' ? `${p.adjustment_value}%` : `${p.adjustment_value}ج`}
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="font-mono font-black text-sm px-2 py-0.5 rounded text-violet-700 bg-violet-100 ring-1 ring-violet-300">
                                            {newPrice.toFixed(2)}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <span className={`font-mono font-black text-sm px-2 py-0.5 rounded transition-colors ${
                                        newPrice > currentPrice ? "text-emerald-700 bg-emerald-100" : newPrice < currentPrice ? "text-rose-700 bg-rose-100" : "text-slate-500 bg-slate-100"
                                      }`}>
                                        {newPrice.toFixed(2)}
                                      </span>
                                    )}
                                    {hasOverride && (
                                      <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-1 rounded">يدوي</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-300 text-sm font-mono">—</span>
                                )}
                                <button onClick={(e) => startEditing(e, item.id, newPrice)}
                                  title="تعديل يدوي — أدخل سعراً مطلقاً (150) أو تعديل نسبي (+5, -10%)"
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
                            <span className="text-slate-200 text-sm">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2 text-left font-mono font-bold text-2sm">
                          {isSelected && diff !== null ? (
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
                  <p className="text-2sm font-bold text-slate-400">عرض صفحة <span className="text-slate-800">{safePage}</span> من <span className="text-slate-800">{totalPages}</span></p>
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
                        className={`flex h-8 w-8 items-center justify-center rounded text-2sm font-black transition-all shadow-sm ${
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

            {/* Smart contextual hints + live preview */}
            {!fetchLoading && selected.size > 0 && hasBulkFormula && (
              <div className="flex items-center gap-3 px-6 py-2 bg-amber-50/60 border-t border-amber-100 text-2sm">
                <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="font-bold text-slate-700">
                  المعاينة الحية: {selected.size} صنف —{' '}
                  <span className="font-mono font-black">
                    {(() => {
                      const sample = items.find(it => selected.has(it.id));
                      if (!sample) return '';
                      const cp = parseFloat(sample[fieldKey]) || 0;
                      const np = effectiveNewPrice(sample);
                      if (np === null) return '';
                      const d = np - cp;
                      return `${cp.toFixed(2)} ← ${np.toFixed(2)} (${d > 0 ? '+' : ''}${d.toFixed(2)})`;
                    })()}
                  </span>
                  {' '}<span className="text-slate-400">(مثال من أول صنف محدد)</span>
                </span>
              </div>
            )}

            {/* Contextual help hint */}
            {!fetchLoading && (
              <div className="px-6 py-2 border-t border-slate-100 bg-white/80">
                <p className="text-2sm font-bold text-slate-400 flex items-center gap-2">
                  {selected.size === 0 ? (
                    <>💡 <span>ابدأ بتحديد الأصناف من الجدول — يمكنك اختيار أكثر من صنف بالضغط باستمرار على <kbd className="px-1 py-0.5 rounded bg-slate-200 font-mono text-[11px] font-black text-slate-600 border border-slate-300 shadow-sm">Ctrl</kbd> والنقر</span></>
                  ) : !hasBulkFormula && !hasInlineOverrides ? (
                    <>💡 <span>اضبط قيمة التعديل (اتجاه، نوع، قيمة) ثم <span className="font-black text-slate-600">أضف للدفعة</span> أو <span className="font-black text-emerald-600">طبّق فوراً</span></span></>
                  ) : selected.size > 0 && batchItems.length === 0 ? (
                    <>💡 <span>جهزت التعديل على {selected.size} صنف — اضغط <span className="font-black text-indigo-600">إضافة إلى الدفعة</span> لتجميعه أو <span className="font-black text-emerald-600">تنفيذ التسعير</span> للحفظ الفوري</span></>
                  ) : batchItems.length > 0 ? (
                    <>💡 <span>لديك <span className="font-black text-indigo-600">{batchItems.length}</span> تغيير في الدفعة — أضف المزيد من الأصناف أو <span className="font-black">احفظ الكل</span> كعملية واحدة</span></>
                  ) : (
                    <>💡 <span>كل تعديل بتعمه بيظهر في الجدول — تأكد من الأسعار الجديدة قبل الحفظ</span></>
                  )}
                </p>
              </div>
            )}

            {/* Batch bottom bar */}
            {batchItems.length > 0 && (
              <div data-help="batch-bottom-bar" className="sticky bottom-0 z-30 border-t-2 border-indigo-300 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between px-6 py-2.5">
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    <span className="font-black text-sm text-slate-800">الدفعة المجمّعة</span>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-sm">{batchItems.length} تغيير</span>
                    <span className="text-2sm font-bold text-slate-400 hidden sm:inline">
                      — أضف المزيد أو احفظ الكل كعملية واحدة
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button data-help="batch-clear-btn" onClick={() => {
                      if (batchItems.length > 0 && !window.confirm('تفريغ الدفعة — هل أنت متأكد؟')) return;
                      clearBatch();
                    }}
                      title="إزالة جميع الأصناف من الدفعة"
                      className="flex items-center gap-1 text-2sm font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-sm transition-colors">
                      <Trash2 className="h-3 w-3" /> تفريغ
                    </button>
                    <button data-help="batch-preview-btn" onClick={() => setShowBatchPreview(true)}
                      title="استعراض جميع تغييرات الدفعة مع إمكانية التعديل والإزالة قبل الحفظ"
                      className="flex items-center gap-1.5 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 px-4 py-1.5 rounded-sm text-sm font-black transition-colors active:scale-95">
                      <ListChecks className="h-3.5 w-3.5" /> عرض التفاصيل
                    </button>
                    <button data-help="batch-save-btn" onClick={handleBatchSave}
                      disabled={batchLoading}
                      title={`حفظ ${batchItems.length} تغيير كعملية واحدة`}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-1.5 rounded-sm text-sm font-black shadow-sm transition-colors disabled:opacity-40 active:scale-95">
                      {batchLoading ? (
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {batchLoading ? 'جاري الحفظ...' : 'حفظ الكل'}
                    </button>
                  </div>
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
                <p className="text-sm font-black uppercase tracking-widest">لا توجد سجلات أرشفة</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-right min-w-full">
                <thead className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 w-[160px] border-l border-slate-100">التوقيت</th>
                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase text-slate-500 border-l border-slate-100 w-[90px]">المتأثر</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 border-l border-slate-100 w-[120px]">الحقل</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 border-l border-slate-100 w-[130px]">قيمة التطبيق</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 border-l border-slate-100 w-[120px]">بواسطة</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 border-l border-slate-100">ملاحظات</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase text-slate-500 w-[130px]">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((op) => (
                    <React.Fragment key={op.operation_id}>
                      <tr
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedOp === op.operation_id ? "bg-slate-50 border-r-4 border-indigo-400" : ""}`}
                        onClick={() => loadOpItems(op.operation_id)}
                      >
                        <td className="px-4 py-3 font-mono text-2sm text-slate-500 font-bold border-l border-slate-100">
                          {op.changed_at?.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-4 py-3 text-center border-l border-slate-100">
                          <span className="inline-block bg-sky-50 text-sky-700 px-2 py-0.5 rounded text-[11px] font-black">{op.items_count} صنف</span>
                        </td>
                        <td className="px-4 py-3 text-2sm font-bold text-slate-600 border-l border-slate-100">
                          {op.batch_metadata ? (
                            <span className="flex items-center gap-1 text-indigo-700">
                              <Layers className="h-3 w-3" /> مجمّع
                            </span>
                          ) : fieldLabelByKey(op.field)}
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100">
                          {op.batch_metadata ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-black">
                              {(() => { const m = parseBatchMeta(op); if (m && m.rules) return `${m.rules.length} قواعد`; return 'Batch'; })()}
                            </span>
                          ) : (
                            <span className={`font-mono font-black text-sm px-2 py-0.5 rounded ${op.adjustment_value > 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                              {op.adjustment_value > 0 ? "+" : ""}{op.adjustment_value} {op.adjustment_type === "percentage" ? "%" : "ج"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100">
                          <span className="flex items-center gap-1.5 text-2sm font-bold text-slate-600">
                            <User className="h-3 w-3 text-slate-400 shrink-0" />
                            {op.changed_by || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-2sm font-bold text-slate-400 border-l border-slate-100">
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
                                <div className="py-4 text-center text-2sm font-bold text-slate-400 animate-pulse">جاري تحميل التفاصيل...</div>
                              ) : opItems.length === 0 ? (
                                <div className="py-4 text-center text-2sm font-bold text-slate-400">لا توجد تفاصيل</div>
                              ) : (
                                <>
                                  {/* Batch rule breakdown */}
                                  {(() => { const m = parseBatchMeta(op); if (!m || !m.rules || m.rules.length === 0) return null;
                                    return (
                                      <div className="mb-3 flex flex-wrap gap-2">
                                        {m.rules.map((rule, ri) => (
                                          <div key={ri} className="flex items-center gap-1.5 bg-white border border-indigo-200 px-2.5 py-1 rounded-sm text-2sm">
                                            <span className="font-black text-indigo-500">قاعدة {ri + 1}</span>
                                            <span className="font-bold text-slate-600">{fieldLabelOf(rule.price_field)}</span>
                                            <span className={`font-mono font-black ${rule.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {rule.direction === 'up' ? '+' : '-'}{rule.adjustment_value}{rule.adjustment_type === 'percentage' ? '%' : 'ج'}
                                            </span>
                                            <span className="font-bold text-slate-400">{rule.items_count} صنف</span>
                                          </div>
                                        ))}
                                        {m.inline_count > 0 && (
                                          <div className="flex items-center gap-1.5 bg-white border border-violet-200 px-2.5 py-1 rounded-sm text-2sm">
                                            <span className="font-black text-violet-500">يدوي</span>
                                            <span className="font-bold text-slate-400">{m.inline_count} صنف</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <table className="w-full border-collapse text-right text-2sm">
                                    <thead>
                                      <tr className="text-[11px] font-black uppercase text-slate-500 border-b border-indigo-100">
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
                                            <td className="py-1.5">
                                              <div className="flex flex-col">
                                                {(oi.item_code || oi.code) && <span className="font-mono text-[11px] text-slate-400">{oi.item_code || oi.code}</span>}
                                                <span className="font-bold text-slate-800">{oi.item_name}</span>
                                              </div>
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
                                </>
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
                <p className="text-2sm font-bold text-slate-400 mt-0.5">
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
                <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-2sm font-bold flex-wrap">
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
              <table className="w-full border-collapse text-right text-2sm">
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
                        {it.code && <p className="font-mono text-[11px] text-slate-400">{it.code}</p>}
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
                className="px-5 py-2 rounded-sm border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button onClick={() => { setPendingSubmit(false); confirmApply(); }}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shadow-sm transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
                {loading ? "جاري التطبيق..." : `تأكيد تطبيق التسعير (${previewItems.length} صنف)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ BATCH PREVIEW MODAL ══════════ */}
      {showBatchPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowBatchPreview(false)}>
          <div className="w-full max-w-3xl bg-white rounded-sm shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-[16px] font-black text-slate-900">تفاصيل الدفعة المجمّعة</h2>
                <p className="text-2sm font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>{batchItems.length} تغيير</span>
                  <span className="text-slate-300">·</span>
                  <Info className="h-3 w-3 text-slate-300" />
                  <span className="font-normal">انقر على سعر <span className="font-black underline decoration-dotted">الجديد</span> لتعديله يدوياً</span>
                </p>
              </div>
              <button onClick={() => setShowBatchPreview(false)}
                title="إغلاق"
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary bar */}
            {(() => {
              const ups   = batchItems.filter((it) => it.diff > 0);
              const downs = batchItems.filter((it) => it.diff < 0);
              const unchanged = batchItems.filter((it) => it.diff === 0);
              const totalImpact = batchItems.reduce((s, it) => s + it.diff, 0);
              return (
                <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-2sm font-bold flex-wrap">
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
              <table className="w-full border-collapse text-right text-2sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-2 font-black text-slate-500 text-right">الصنف</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[60px]">الحقل</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[70px] text-right">قديم</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[100px] text-right" title="انقر على السعر لتعديله يدوياً">جديد ↻</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[65px] text-left">الفرق</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[50px]">المصدر</th>
                    <th className="px-4 py-2 font-black text-slate-500 w-[36px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchItems.map((bi, idx) => {
                    const isEditing = batchEditingId === bi.id;
                    return (
                      <tr key={bi.id}
                        className={`transition-all duration-200 ${
                          isEditing ? "bg-indigo-50/40" : "hover:bg-slate-50/50"
                        } ${bi.diff === 0 ? "opacity-60" : ""}`}
                        style={{ animation: `fadeIn 0.2s ease-out ${idx * 0.02}s both` }}>
                        <td className="px-4 py-2">
                          <p className="font-black text-slate-800">{bi.name}</p>
                          {bi.code && <p className="font-mono text-[11px] text-slate-400">{bi.code}</p>}
                        </td>
                        <td className="px-4 py-2 font-bold text-slate-600">{bi.fieldLabel}</td>
                        <td className="px-4 py-2 font-mono font-bold text-slate-500 text-right">{bi.oldPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">
                          {isEditing ? (
                            <input type="number" step="0.01" min="0" autoFocus
                              defaultValue={bi.newPrice}
                              onBlur={(e) => { updateBatchItemPrice(bi.id, e.target.value); setBatchEditingId(null); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { updateBatchItemPrice(bi.id, e.target.value); setBatchEditingId(null); }
                                if (e.key === 'Escape') setBatchEditingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-sm border border-indigo-400 bg-white px-2 py-1 text-sm font-black font-mono text-slate-900 outline-none shadow-sm text-right"
                            />
                          ) : (
                            <button onClick={() => setBatchEditingId(bi.id)}
                              title="انقر لتعديل السعر يدوياً"
                              className="group inline-flex items-center gap-1 font-mono font-black text-slate-900 cursor-pointer hover:text-indigo-700 transition-colors">
                              {bi.newPrice.toFixed(2)}
                              <Pencil className="h-2.5 w-2.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2 text-left">
                          <span className={`font-mono font-black text-[11px] px-1.5 py-0.5 rounded ${
                            bi.diff > 0 ? "text-emerald-700 bg-emerald-50" : bi.diff < 0 ? "text-rose-700 bg-rose-50" : "text-slate-400 bg-slate-100"
                          }`}>
                            {bi.diff > 0 ? "+" : ""}{bi.diff.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            bi.source === 'يدوي' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
                          }`}
                            title={bi.source === 'يدوي' ? 'تم تعديل السعر يدوياً' : 'تم تطبيق صيغة تسعير'}>
                            {bi.source}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={() => {
                            removeBatchItem(bi.id);
                            if (batchEditingId === bi.id) setBatchEditingId(null);
                          }}
                            className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors active:scale-90"
                            title="إزالة من الدفعة">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {batchItems.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-slate-300">
                  <Layers className="h-10 w-10" />
                  <p className="text-sm font-black uppercase tracking-widest">الدفعة فارغة</p>
                  <p className="text-2sm font-bold">أضف أصنافاً من شاشة التعديل السريع</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  if (batchItems.length > 0) {
                    if (window.confirm('هل أنت متأكد من تفريغ الدفعة بالكامل؟')) { clearBatch(); setShowBatchPreview(false); }
                  } else { clearBatch(); setShowBatchPreview(false); }
                }}
                  title="إزالة جميع الأصناف من الدفعة"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm border border-slate-200 bg-white text-sm font-black text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors active:scale-95">
                  <Trash2 className="h-3.5 w-3.5" /> تفريغ الكل
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowBatchPreview(false)}
                  title="العودة إلى شاشة التعديل لإضافة المزيد من الأصناف"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-sm border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors active:scale-95">
                  <Plus className="h-3.5 w-3.5" /> إضافة المزيد
                </button>
                <button onClick={() => { setShowBatchPreview(false); handleBatchSave(); }}
                  disabled={batchLoading || batchItems.length === 0}
                  title={`احفظ ${batchItems.length} تغيير كعملية واحدة في قاعدة البيانات`}
                  className="flex items-center gap-2 px-5 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black shadow-sm transition-colors disabled:opacity-40 active:scale-95">
                  {batchLoading ? (
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {batchLoading ? 'جاري الحفظ...' : 'حفظ الكل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
