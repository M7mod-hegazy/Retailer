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
  Workflow,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { usePageTour } from "../../hooks/usePageTour";
import PermissionGate from "../../components/ui/PermissionGate";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { addBodyResizeFlags, removeBodyResizeFlags } from "../../utils/bodyFlags";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const PRICE_FIELDS = [
  { value: "retail_price",    label: "سعر المستهلك",  key: "sale_price" },
  { value: "wholesale_price", label: "سعر الجملة",   key: "wholesale_price" },
  { value: "cost_price",      label: "سعر الشراء",  key: "purchase_price" },
];

const FIELD_KEY_TO_API_VALUE = {
  sale_price: "retail_price",
  wholesale_price: "wholesale_price",
  purchase_price: "cost_price",
};

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

// ── Small themed presentational helpers (shared across tabs/modals) ──

function Tab({ active, onClick, children, ...rest }) {
  return (
    <button type="button" onClick={onClick} {...rest}
      className={`relative px-7 py-4 text-[15px] font-black uppercase tracking-widest transition-colors ${
        active
          ? "text-primary"
          : "text-text-muted hover:text-text-primary hover:bg-bg-overlay/60"
      }`}>
      {children}
      <span className={`absolute inset-x-3 -bottom-px h-[3px] rounded-full transition-colors ${active ? "bg-primary" : "bg-transparent"}`} />
    </button>
  );
}

function ResizableTh({ label, sortKey, sortConfig, onSort, colKey, colWidths, onResizeStart, className = "", children }) {
  const isSorted = sortConfig?.key === sortKey;
  return (
    <th
      className={`relative select-none px-4 py-3 text-right text-[11px] font-black uppercase text-text-muted hover:bg-bg-input transition-colors group border-l border-border/60 ${className}`}
      style={colWidths[colKey] ? { width: colWidths[colKey], minWidth: colWidths[colKey] } : {}}
    >
      <div className={`flex items-center gap-1 ${sortKey ? "cursor-pointer" : ""}`}
        onClick={() => sortKey && onSort && onSort(sortKey)}>
        <span>{label || children}</span>
        {sortKey && (
          <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className={`h-2.5 w-2.5 rotate-90 -mb-1 ${isSorted && sortConfig.direction === "asc" ? "text-primary !opacity-100" : ""}`} />
            <ChevronLeft className={`h-2.5 w-2.5 -rotate-90 ${isSorted && sortConfig.direction === "desc" ? "text-primary !opacity-100" : ""}`} />
          </div>
        )}
      </div>
      {colKey && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(e, colKey)}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/40 z-10 transition-colors opacity-0 hover:opacity-100"
        />
      )}
    </th>
  );
}

// Small tag distinguishing how a new price was produced — manual (info) vs formula (warning/pending)
function SourceTag({ kind }) {
  if (kind === "manual") return <span className="badge badge--info shrink-0">يدوي</span>;
  return <span className="badge badge--warning shrink-0">صيغة</span>;
}

// Consistent old→new diff pill: success on increase, danger on decrease, muted otherwise
function DiffPill({ diff }) {
  if (diff === null || diff === undefined) return <span className="text-text-muted">—</span>;
  const tone = diff > 0 ? "success" : diff < 0 ? "danger" : "neutral";
  const cls = tone === "success"
    ? "text-success-text bg-success-bg"
    : tone === "danger"
      ? "text-danger-text bg-danger-bg"
      : "text-text-muted bg-bg-overlay";
  return (
    <span className={`number-fmt-primary text-[11px] px-1.5 py-0.5 rounded ${cls}`}>
      {diff > 0 ? "+" : ""}{diff.toFixed(2)}
    </span>
  );
}

export default function BulkPriceUpdatePage() {
  usePageTour('bulk_price_update');

  const searchRef = useRef(null);
  const categoryFilterRef = useRef(null);
  const adjValueRef = useRef(null);
  const priceFieldRef = useRef(null);
  const reasonRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

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

  // ── Inline price overrides: { [itemId]: { [fieldKey]: rawValue } } ──
  const [inlineOverrides, setInlineOverrides] = useState({});
  const [activePriceEdit, setActivePriceEdit] = useState(null); // { itemId, field }

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
    const hasAnyOverride = [...selected].some(id => inlineOverrides[id] !== undefined);
    if (!hasFormula && !hasAnyOverride) {
      toast.error("أدخل قيمة تعديل أو استخدم التعديل اليدوي");
      return;
    }
    const newEntries = [];
    for (const id of [...selected]) {
      const item = items.find((it) => it.id === id);
      if (!item) continue;
      const itemOverrides = inlineOverrides[id];
      const hasOverrides = itemOverrides && Object.keys(itemOverrides).length > 0;
      if (hasOverrides) {
        for (const [overrideFieldKey, raw] of Object.entries(itemOverrides)) {
          const parsed = parsePriceInput(raw);
          if (!parsed) continue;
          const currentPrice = parseFloat(item[overrideFieldKey]) || 0;
          let newPrice;
          if (parsed.type === 'absolute') {
            newPrice = Math.max(0, Math.round(parsed.value * 100) / 100);
          } else {
            newPrice = applyAdjustment(currentPrice, parsed.direction, parsed.adjustment_type, parsed.adjustment_value);
          }
          if (newPrice === null || newPrice === currentPrice) continue;
          const apiField = FIELD_KEY_TO_API_VALUE[overrideFieldKey] || priceField;
          const existing = batchItems.find(bi => bi.itemId === id && bi.field === apiField);
          if (existing) {
            setBatchItems(prev => prev.map(bi => bi.id === existing.id
              ? { ...bi, oldPrice: currentPrice, newPrice, diff: newPrice - currentPrice, source: 'يدوي' }
              : bi));
          } else {
            newEntries.push({
              id: ++batchIdCounter.current, itemId: id, name: item.name, code: item.code || '',
              field: apiField, fieldLabel: fieldLabelOf(apiField),
              oldPrice: currentPrice, newPrice, diff: newPrice - currentPrice,
              source: 'يدوي', direction, adjType, adjValue: Math.abs(v),
            });
          }
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
    addBodyResizeFlags();
    const onMove = (ev) => {
      if (!resizingCol.current) return;
      const diff = startX.current - ev.clientX;
      setColWidths((p) => ({ ...p, [resizingCol.current]: Math.max(p[resizingCol.current] + diff, 60) }));
      startX.current = ev.clientX;
    };
    const onUp = () => {
      resizingCol.current = null;
      removeBodyResizeFlags();
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

  // ── Inline price cell click-to-edit ──

  function startPriceEdit(e, itemId, fieldKey) {
    e.stopPropagation();
    if (!selected.has(itemId)) toggleRow(itemId);
    setActivePriceEdit({ itemId, field: fieldKey });
  }

  function commitPriceEdit(itemId, fieldKey, rawValue) {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) { setActivePriceEdit(null); return; }
    const val = parseFloat(trimmed);
    if (isNaN(val) || val < 0) { toast.error('أدخل رقماً صحيحاً للسعر'); return; }
    const newVal = Math.round(val * 100) / 100;
    setSelected((prev) => { const s = new Set(prev); s.add(itemId); return s; });
    setInlineOverrides((o) => ({
      ...o,
      [itemId]: { ...(o[itemId] || {}), [fieldKey]: String(newVal) }
    }));
    setActivePriceEdit(null);
  }

  function cancelPriceEdit(e) {
    if (e) e.stopPropagation();
    setActivePriceEdit(null);
  }

  function clearOverride(e, itemId, fieldKey) {
    e.stopPropagation();
    setInlineOverrides((o) => {
      const itemOverrides = o[itemId];
      if (!itemOverrides) return o;
      const { [fieldKey]: _, ...rest } = itemOverrides;
      if (Object.keys(rest).length === 0) {
        const n = { ...o }; delete n[itemId]; return n;
      }
      return { ...o, [itemId]: rest };
    });
  }

  // Compute effective new price for an item (bulk formula only)
  function effectiveNewPrice(item) {
    const currentPrice = parseFloat(item[fieldKey]) || 0;
    return applyAdjustment(currentPrice, direction, adjType, adjValue);
  }

  function effectiveNewPriceForField(item, fk) {
    const override = inlineOverrides[item.id]?.[fk];
    if (override !== undefined) {
      const parsed = parsePriceInput(override);
      if (!parsed) return null;
      const currentPrice = parseFloat(item[fk]) || 0;
      if (parsed.type === 'absolute') {
        return Math.max(0, Math.round(parsed.value * 100) / 100);
      }
      return applyAdjustment(currentPrice, parsed.direction, parsed.adjustment_type, parsed.adjustment_value);
    }
    if (fk !== fieldKey) return null;
    const currentPrice = parseFloat(item[fk]) || 0;
    return applyAdjustment(currentPrice, direction, adjType, adjValue);
  }

  function handleApply() {
    const hasOverrides = [...selected].some((id) => inlineOverrides[id] !== undefined);
    const v = parseFloat(adjValue);
    const hasBulkFormula = v && !isNaN(v) && v !== 0;

    if (!hasOverrides && !hasBulkFormula) {
      toast.error("أدخل قيمة تعديل أو عدّل السعر يدوياً لأحد الأصناف");
      return;
    }
    if (selected.size === 0) { toast.error("اختر صنفاً واحداً على الأقل"); return; }

    // Build preview: compute old → new for every selected item (per-field for overrides)
    const preview = [...selected].flatMap((id) => {
      const item = items.find((it) => it.id === id);
      if (!item) return [];
      const itemOverrides = inlineOverrides[id];
      const hasOverrides = itemOverrides && Object.keys(itemOverrides).length > 0;
      if (hasOverrides) {
        return Object.entries(itemOverrides).map(([fk, raw]) => {
          const parsed = parsePriceInput(raw);
          if (!parsed) return null;
          const oldPrice = parseFloat(item[fk]) || 0;
          let newPrice;
          if (parsed.type === 'absolute') {
            newPrice = Math.max(0, Math.round(parsed.value * 100) / 100);
          } else {
            newPrice = applyAdjustment(oldPrice, parsed.direction, parsed.adjustment_type, parsed.adjustment_value);
          }
          if (newPrice === null) return null;
          return {
            id: item.id,
            name: item.name,
            code: item.code || "",
            category: item.category_name || "",
            oldPrice,
            newPrice,
            diff: newPrice - oldPrice,
            isOverride: true,
            field: fk,
            fieldLabel: fieldLabelByKey(fk),
          };
        }).filter(Boolean);
      }
      if (!hasBulkFormula) return [];
      const oldPrice = parseFloat(item[fieldKey]) || 0;
      const newPrice = effectiveNewPrice(item);
      if (newPrice === null) return [];
      return [{
        id: item.id,
        name: item.name,
        code: item.code || "",
        category: item.category_name || "",
        oldPrice,
        newPrice,
        diff: newPrice - oldPrice,
        isOverride: false,
        field: fieldKey,
        fieldLabel: fieldLabelByKey(fieldKey),
      }];
    });

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

      // Inline override items — send one API call per field per item
      for (const id of overrideIds) {
        const item = items.find((it) => it.id === id);
        if (!item) continue;
        const itemOverrides = inlineOverrides[id];
        if (!itemOverrides) continue;
        for (const [fk, raw] of Object.entries(itemOverrides)) {
          const parsed = parsePriceInput(raw);
          if (!parsed) continue;
          const currentPrice = parseFloat(item[fk]) || 0;
          let newPrice;
          if (parsed.type === 'absolute') {
            newPrice = Math.max(0, Math.round(parsed.value * 100) / 100);
          } else {
            newPrice = applyAdjustment(currentPrice, parsed.direction, parsed.adjustment_type, parsed.adjustment_value);
          }
          if (newPrice === null || newPrice === currentPrice) continue;
          const diff = newPrice - currentPrice;
          const overrideApiField = FIELD_KEY_TO_API_VALUE[fk] || priceField;
          const r = await api.post("/api/items/bulk-price-update", {
            item_ids: [id],
            adjustment_type: "fixed",
            adjustment_value: Math.abs(diff),
            direction: diff >= 0 ? "up" : "down",
            price_field: overrideApiField,
            reason: reason || "تعديل يدوي مباشر",
          });
          totalChanges += r.data.changes || 0;
          if (!lastOpIdResult) lastOpIdResult = r.data.operation_id;
        }
      }

      toast.success(`تم تحديث ${totalChanges} سعر بنجاح`);
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
      <div data-help="page-header" className="relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl border border-border bg-bg-surface px-7 py-6 shadow-elevated">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(1100px 220px at 8% -20%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%)" }}
        />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-glow">
            <Tag className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] font-black leading-none tracking-tight text-text-primary">تحديث الأسعار المجمّع</h1>
            <p className="text-sm font-bold text-text-muted">تعديل أسعار الشراء، البيع، أو الجملة دفعة واحدة — فورياً أو كعملية مجمّعة واحدة</p>
          </div>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="kpi-card !py-2.5 !px-4 min-w-[150px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-bg text-success-text">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[11px] font-black text-text-muted uppercase leading-none">الأصناف المتاحة</span>
                <span className="mt-1 text-xl font-black leading-none text-text-primary number-fmt-primary">{items.length}</span>
              </div>
            </div>
          </div>
          <div className="kpi-card !py-2.5 !px-4 min-w-[150px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info-text">
                <ListChecks className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[11px] font-black text-text-muted uppercase leading-none">مُختار للتعديل</span>
                <span className="mt-1 text-xl font-black leading-none text-text-primary number-fmt-primary">{selected.size}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="card-elevated flex flex-col !rounded-3xl overflow-hidden">

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-bg-overlay/50 px-8 py-5">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <div data-help="search-bar" className="relative flex-1 group">
              <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" />
              <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: categoryFilterRef, prevRef: reasonRef })}
                placeholder="بحث سريع بأسم أو كود الصنف..."
                className="input w-full !h-12 py-3 pl-4 pr-11 text-[15px] font-bold" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-bg-input rounded-full text-text-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="relative w-72 group">
              <Filter className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
              <select ref={categoryFilterRef} data-help="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: adjValueRef, prevRef: searchRef })}
                className="input w-full !h-12 appearance-none py-3 pl-10 pr-11 text-sm font-black text-text-secondary">
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
            className="btn btn-primary !h-12 !px-6">
            <RefreshCcw className={fetchLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> تحديث الأصناف
          </button>
        </div>

        {/* Formula builder — the pricing "control deck" */}
        <div
          className="relative border-b border-border px-8 py-7"
          style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, var(--bg-surface)) 0%, var(--bg-surface) 100%)" }}
        >
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <Workflow className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-black text-text-primary">صيغة التسعير</h2>
            <span className="text-2sm font-bold text-text-muted">اضبط التعديل، ثم أضِفه إلى دفعة أو نفّذه فوراً</span>
          </div>

          <div className="flex flex-wrap items-stretch gap-4">
            <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-bg-overlay/50 p-4 shadow-card">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">الاتجاه</label>
                <div data-help="direction-toggle" className="flex overflow-hidden rounded-xl border border-border shadow-card font-black text-sm">
                  <button type="button" onClick={() => setDirection("up")}
                    title="زيادة الأسعار — يطبق التعديل كإضافة على السعر الحالي"
                    className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 transition-all ${direction === "up" ? "bg-success text-white shadow-glow-green" : "bg-bg-surface text-text-secondary hover:bg-bg-input"}`}>
                    <ArrowUp className="h-4 w-4" /> زيادة
                  </button>
                  <div className="w-[1px] bg-border" />
                  <button type="button" onClick={() => setDirection("down")}
                    title="تخفيض الأسعار — يطبق التعديل كخصم من السعر الحالي"
                    className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 transition-all ${direction === "down" ? "bg-danger text-white shadow-glow-red" : "bg-bg-surface text-text-secondary hover:bg-bg-input"}`}>
                    <ArrowDown className="h-4 w-4" /> خصم
                  </button>
                </div>
              </div>

              <div data-help="update-method" className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">النوع</label>
                <div className="flex overflow-hidden rounded-xl border border-border shadow-card font-black text-sm">
                  <button type="button" onClick={() => setAdjType("percentage")}
                    className={`flex-1 py-3 px-4 transition-all ${adjType === "percentage" ? "bg-primary text-white shadow-glow" : "bg-bg-surface text-text-secondary hover:bg-bg-input"}`}>
                    نسبة %
                  </button>
                  <div className="w-[1px] bg-border" />
                  <button type="button" onClick={() => setAdjType("fixed")}
                    className={`flex-1 py-3 px-4 transition-all ${adjType === "fixed" ? "bg-primary text-white shadow-glow" : "bg-bg-surface text-text-secondary hover:bg-bg-input"}`}>
                    مبلغ مقطوع
                  </button>
                </div>
              </div>

              <div data-help="value-input" className="w-32 space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">القيمة</label>
                <input ref={adjValueRef} type="number" step="0.01" min="0" value={adjValue} onChange={(e) => setAdjValue(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: priceFieldRef, prevRef: categoryFilterRef })}
                  placeholder="0.00"
                  title="قيمة التعديل — الرقم الذي سيتم إضافته أو خصمه من السعر"
                  className="input w-full !h-[52px] px-3 text-lg font-black number-fmt text-center" />
              </div>

              <div data-help="price-field-select" className="w-48 space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">حقل السعر</label>
                <select ref={priceFieldRef} value={priceField} onChange={(e) => setPriceField(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: reasonRef, prevRef: adjValueRef })}
                  title="اختر حقل السعر المراد تعديله: سعر المستهلك، سعر الجملة، أو سعر التكلفة"
                  className="input w-full !h-[52px] px-3 text-sm font-black text-text-secondary">
                  {PRICE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div data-help="reason-input" className="flex-1 space-y-2 hidden lg:block min-w-[200px]">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">ملاحظات التغيير (اختياري)</label>
                <input ref={reasonRef} type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: searchRef, prevRef: priceFieldRef })}
                  placeholder="مثال: تحديثات أبريل"
                  title="سجل ملاحظة توضيحية لهذه العملية لتظهر في سجل العمليات السابقة"
                  className="input w-full !h-[52px] px-3 text-sm font-bold" />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-between gap-2 rounded-2xl border border-primary/20 bg-primary-50/30 p-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">
                {selected.size > 0
                  ? `${selected.size} صنف محدد — تجميع أم تطبيق فوري؟`
                  : "خيارات التطبيق"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <PermissionGate page="bulk_price_update" action="edit">
                    <button data-help="add-to-batch" onClick={addSelectionToBatch}
                      disabled={selected.size === 0}
                      title={selected.size === 0 ? "اختر صنفاً واحداً على الأقل أولاً" : `أضف ${selected.size} صنف إلى الدفعة المجمّعة — يمكنك إضافة المزيد لاحقاً`}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm shadow-card transition-all active:scale-95 whitespace-nowrap ${
                        selected.size === 0
                          ? "bg-bg-overlay text-text-muted cursor-not-allowed"
                          : "bg-primary text-white hover:opacity-90 shadow-glow"
                      }`}>
                      <Plus className="h-4 w-4" /> إضافة إلى الدفعة
                    </button>
                  </PermissionGate>
                  {selected.size > 0 && (
                    <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-primary whitespace-nowrap leading-none">تجميع ← حفظ كعملية</span>
                  )}
                </div>
                <div className="relative">
                  <PermissionGate page="bulk_price_update" action="edit">
                    <button data-help="apply-button" onClick={handleApply}
                      disabled={loading || selected.size === 0 || (!hasBulkFormula && !hasInlineOverrides)}
                      title={selected.size === 0 ? "اختر صنفاً واحداً على الأقل" : "تنفيذ التعديل فوراً — يُنشئ عملية منفصلة لكل صنف"}
                      className="flex items-center gap-2 bg-success text-white hover:opacity-90 px-6 py-3 rounded-xl font-black text-sm shadow-glow-green disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-95 whitespace-nowrap">
                      {loading ? (
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {loading ? "جاري التحديث..." : "تنفيذ التسعير"}
                    </button>
                  </PermissionGate>
                  {selected.size > 0 && (
                    <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-success-text whitespace-nowrap leading-none">تطبيق فوري مباشر</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rollback banner */}
        {lastOpId && (
          <div className="flex items-center gap-3 bg-warning-bg px-8 py-3.5 border-b border-warning-border">
            <ShieldAlert className="h-4 w-4 shrink-0 text-warning-text" />
            <p className="flex-1 text-2sm font-bold text-warning-text">
              يوجد سجل لتعديل أخير قيد الانتظار <span className="mx-1 font-mono">{lastOpId}</span>
            </p>
            <button onClick={() => handleRollback(lastOpId)} disabled={rollbackLoading}
              className="h-7 px-4 rounded border border-warning-border bg-bg-surface text-warning-text text-[11px] font-black hover:bg-warning-bg active:scale-95 transition-all">
              {rollbackLoading ? "جارٍ..." : "تراجع عن التغييرات"}
            </button>
            <button onClick={() => setLastOpId(null)} className="h-7 w-7 flex items-center justify-center rounded text-warning-text hover:bg-warning-bg transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center bg-bg-overlay/40 border-b border-border">
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
          <div data-help="batch-workflow-banner" className="flex items-start gap-3 px-8 py-3 bg-bg-overlay/60 border-b border-border text-2sm">
            <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-text-secondary font-bold leading-relaxed">
              <p>
                <span className="font-black text-primary">مسار التجميع (دفعة):</span>{' '}
                اختر أصنافاً ← اضبط التعديل ← <span className="font-black">أضف إلى الدفعة</span> ← كرر مع أصناف وتعديلات مختلفة ←
                <span className="font-black"> احفظ الكل</span> كعملية واحدة
              </p>
              <p className="mt-1">
                <span className="font-black text-success-text">مسار التطبيق الفوري:</span>{' '}
                اختر أصنافاً ← اضبط التعديل ← <span className="font-black">تنفيذ التسعير</span> ← الحفظ مباشرة (كل صنف بعملية منفصلة)
              </p>
            </div>
            <Info className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" title="يمكنك أيضاً تعديل السعر يدوياً لكل صنف عبر عمود التعديل — أدخل قيمة مطلقة (150) أو نسبة (+5%)" />
          </div>
        )}

        {/* ══════════ QUICK EDIT TAB ══════════ */}
        {tab === "quick" && (
          <div className="flex flex-col bg-bg-base/40">
            {/* Pricing pipeline — signature workflow tracker */}
            {(() => {
              const steps = [
                { key: 'select', label: 'اختر الأصناف', desc: 'حدد من الجدول', done: selected.size > 0 || batchItems.length > 0 },
                { key: 'adjust', label: 'اضبط التعديل', desc: 'اتجاه ونسبة', done: hasBulkFormula || hasInlineOverrides },
                { key: 'add', label: 'أضف للدفعة أو طبّق', desc: 'دفعة أو فوري', done: batchItems.length > 0 },
                { key: 'save', label: 'احفظ الكل', desc: 'عملية واحدة', done: false },
              ];
              const activeIdx = steps.findIndex(s => !s.done);
              const current = activeIdx === -1 ? steps.length - 1 : Math.max(0, activeIdx);
              const progressPct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;
              return (
                <div
                  className="hidden md:block relative overflow-hidden border-b border-border px-8 py-7"
                  style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--primary) 7%, var(--bg-surface)) 0%, var(--bg-surface) 100%)" }}
                >
                  {batchItems.length > 0 && (
                    <span className="absolute left-8 top-7 text-[11px] font-black text-primary bg-primary-50 px-3 py-1.5 rounded-full shadow-card">
                      {batchItems.length} في الدفعة
                    </span>
                  )}
                  <div className="relative flex items-start justify-between gap-2">
                    {/* Track: fill anchored to the RTL start (right) so it grows the same direction the steps read */}
                    <div className="absolute right-0 left-0 top-[22px] h-2 rounded-full bg-bg-overlay overflow-hidden">
                      <div
                        className="absolute top-0 right-0 h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progressPct}%`, backgroundImage: "var(--primary-gradient)" }}
                      />
                    </div>
                    {steps.map((step, idx) => (
                      <div key={step.key} className="relative flex flex-1 flex-col items-center gap-2.5 text-center">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-black ring-[6px] transition-all duration-300 ${
                          idx < current
                            ? "bg-success text-white ring-success-bg"
                            : idx === current
                              ? "bg-primary text-white ring-primary-50 shadow-glow scale-110"
                              : "bg-bg-overlay text-text-muted ring-bg-surface"
                        }`}>
                          {idx < current ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className={`text-[13px] font-black leading-tight ${idx === current ? "text-primary" : idx < current ? "text-success-text" : "text-text-muted"}`}>
                            {step.label}
                          </span>
                          <span className="text-[11px] font-bold text-text-muted">{step.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {(somePageSelected && !allFilteredSelected && filtered.length > pageSize) && (
              <div data-help="select-all-bar" className="flex items-center justify-between bg-info-bg px-8 py-2.5 border-b border-info-border">
                <span className="text-2sm font-bold text-info-text">تم تحديد {selected.size} صنف من هذه الصفحة.</span>
                <button data-help="select-all-filtered" onClick={selectAllFiltered} className="text-2sm font-black text-info-text underline underline-offset-4 hover:opacity-80">
                  تحديد جميع الـ {filtered.length} صنف في النتائج
                </button>
              </div>
            )}

            <div data-help="main-table" className="max-h-[60vh] overflow-auto scrollbar-thin bg-bg-surface">
              <div className="pb-4">
              <table className="w-max border-collapse table-fixed text-right min-w-full">
                <thead className="sticky top-0 z-40 bg-bg-overlay/95 backdrop-blur-sm">
                  <tr className="border-b border-border shadow-card">
                    <th className="w-10 px-1 py-3 text-center border-l border-border/60">
                      <input type="checkbox" checked={allPageSelected}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                        onChange={togglePageAll} className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-primary" />
                    </th>
                    <ResizableTh label="الكود" sortKey="code" sortConfig={sortConfig} onSort={handleSort} colKey="code" colWidths={colWidths} onResizeStart={onResizeStart} className="text-center" />
                    <ResizableTh label="الصنف" sortKey="name" sortConfig={sortConfig} onSort={handleSort} colKey="name" colWidths={colWidths} onResizeStart={onResizeStart} />
                    <ResizableTh label="القسم" sortKey="category_name" sortConfig={sortConfig} onSort={handleSort} colKey="category" colWidths={colWidths} onResizeStart={onResizeStart} />
                    <ResizableTh label="سعر الشراء" sortKey="purchase_price" sortConfig={sortConfig} onSort={handleSort} colKey="purchase" colWidths={colWidths} onResizeStart={onResizeStart} className="text-text-secondary" />
                    <ResizableTh label="سعر المستهلك" sortKey="sale_price" sortConfig={sortConfig} onSort={handleSort} colKey="retail" colWidths={colWidths} onResizeStart={onResizeStart} className="text-success-text" />
                    <ResizableTh label="سعر الجملة" sortKey="wholesale_price" sortConfig={sortConfig} onSort={handleSort} colKey="wholesale" colWidths={colWidths} onResizeStart={onResizeStart} className="text-info-text" />
                    <ResizableTh colKey="diff" colWidths={colWidths} onResizeStart={onResizeStart} className="text-text-muted text-left">
                      الفرق
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {fetchLoading ? (
                    <tr><td colSpan={8} className="py-24 text-center text-sm font-black text-text-muted uppercase tracking-widest animate-pulse">يتم استدعاء الأصناف...</td></tr>
                  ) : pageItems.length === 0 ? (
                    <tr><td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-sm font-black text-text-muted">لا توجد أصناف مطابقة</p>
                        <p className="text-xs text-text-muted/70">جرّب تغيير معايير البحث أو التصفية</p>
                      </div>
                    </td></tr>
                  ) : pageItems.map((item) => {
                    const isSelected = selected.has(item.id);
                    const itemOverrides = inlineOverrides[item.id];
                    const overrideFieldKeys = itemOverrides ? Object.keys(itemOverrides) : [];
                    const hasSingleOverride = overrideFieldKeys.length === 1;
                    const effectiveDiffField = hasSingleOverride ? overrideFieldKeys[0] : fieldKey;
                    const currentPrice = parseFloat(item[effectiveDiffField]) || 0;
                    const newPrice = hasSingleOverride ? effectiveNewPriceForField(item, overrideFieldKeys[0]) : effectiveNewPrice(item);
                    const diff = newPrice !== null ? newPrice - currentPrice : null;
                    const purchaseNewPrice = effectiveNewPriceForField(item, 'purchase_price');
                    const saleNewPrice = effectiveNewPriceForField(item, 'sale_price');
                    const wholesaleNewPrice = effectiveNewPriceForField(item, 'wholesale_price');
                    const isUp = diff !== null && diff > 0;
                    const isDown = diff !== null && diff < 0;
                    const overrideOnPurchase = inlineOverrides[item.id]?.purchase_price !== undefined;
                    const overrideOnSale = inlineOverrides[item.id]?.sale_price !== undefined;
                    const overrideOnWholesale = inlineOverrides[item.id]?.wholesale_price !== undefined;
                    const hasAnyOverride = overrideOnPurchase || overrideOnSale || overrideOnWholesale;

                    return (
                      <tr key={item.id}
                        onClick={() => toggleRow(item.id)}
                        className={`group cursor-pointer transition-colors border-r-4 ${
                          isSelected
                            ? isDown
                              ? "bg-danger-bg border-r-danger"
                              : "bg-success-bg border-r-success"
                            : "border-r-transparent hover:bg-bg-overlay/50"
                        }`}
                      >
                        {/* Checkbox — stop propagation so row click doesn't double-toggle */}
                        <td className="px-1 py-3.5 text-center border-l border-border/60"
                          onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(item.id)}
                            className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-primary" />
                        </td>
                        <td className="px-4 py-3.5 border-l border-border/60 text-center number-fmt-primary text-2sm text-text-muted">
                          {item.code || "—"}
                        </td>
                        <td className="px-4 py-3.5 border-l border-border/60">
                          <p className="font-black text-[15px] text-text-primary">{item.name}</p>
                          {item.barcode && <p className="number-fmt text-[11px] text-text-muted">{item.barcode}</p>}
                        </td>
                        <td className="px-4 py-3.5 border-l border-border/60 text-2sm font-bold text-text-secondary">
                          {item.category_name || "—"}
                        </td>
                        <td className="px-4 py-3.5 border-l border-border/60 text-right number-fmt-primary text-sm text-text-secondary">
                          {activePriceEdit?.itemId === item.id && activePriceEdit?.field === 'purchase_price' ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <input type="number" step="0.01" min="0" autoFocus
                                defaultValue={Number(item.purchase_price || 0).toFixed(2)}
                                onBlur={(e) => commitPriceEdit(item.id, 'purchase_price', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitPriceEdit(item.id, 'purchase_price', e.target.value);
                                  if (e.key === "Escape") cancelPriceEdit(e);
                                }}
                                className="w-full rounded border border-primary bg-bg-surface px-2 py-0.5 text-sm font-black number-fmt text-text-primary outline-none focus:ring-2 focus:ring-primary-glow text-center"
                              />
                            </div>
                          ) : overrideOnPurchase ? (
                            <span className="flex items-center gap-1.5 group/cell" title="سعر الشراء — تم التعديل يدوياً">
                              <span onClick={(e) => startPriceEdit(e, item.id, 'purchase_price')}
                                                                className="number-fmt-primary text-info-text cursor-pointer hover:text-primary transition-colors">
                                {purchaseNewPrice?.toFixed(2) || Number(item.purchase_price || 0).toFixed(2)}
                              </span>
                              <SourceTag kind="manual" />
                              <span className="text-[10px] text-text-muted line-through hidden sm:inline">{Number(item.purchase_price || 0).toFixed(2)}</span>
                              <button onClick={(e) => { e.stopPropagation(); clearOverride(e, item.id, 'purchase_price'); }}
                                title="إعادة ضبط"
                                className="opacity-0 group-hover/cell:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-danger transition-colors">
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </span>
                          ) : isSelected && fieldKey === 'purchase_price' && hasBulkFormula && newPrice !== null ? (
                            <span className="flex items-center gap-1.5 group/cell" title="سعر الشراء — معاينة الصيغة">
                              <span className="number-fmt-primary text-warning-text">{newPrice.toFixed(2)}</span>
                              <SourceTag kind="formula" />
                              <span className="text-[10px] text-text-muted line-through hidden sm:inline">{Number(item.purchase_price || 0).toFixed(2)}</span>
                            </span>
                          ) : (
                            <span onClick={(e) => startPriceEdit(e, item.id, 'purchase_price')}
                              className={`${activePriceEdit === null ? "cursor-pointer hover:text-primary hover:underline decoration-dotted" : ""} transition-colors group`}
                              title="انقر لتعديل سعر الشراء">
                              {Number(item.purchase_price || 0).toFixed(2)}
                              <Pencil className="h-2.5 w-2.5 inline-block mr-1 text-text-muted/40 group-hover:text-primary transition-colors" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 border-l border-border/60 text-right number-fmt-primary text-sm text-success-text">
                          {activePriceEdit?.itemId === item.id && activePriceEdit?.field === 'sale_price' ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <input type="number" step="0.01" min="0" autoFocus
                                defaultValue={Number(item.sale_price || 0).toFixed(2)}
                                onBlur={(e) => commitPriceEdit(item.id, 'sale_price', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitPriceEdit(item.id, 'sale_price', e.target.value);
                                  if (e.key === "Escape") cancelPriceEdit(e);
                                }}
                                className="w-full rounded border border-primary bg-bg-surface px-2 py-0.5 text-sm font-black number-fmt text-text-primary outline-none focus:ring-2 focus:ring-primary-glow text-center"
                              />
                            </div>
                          ) : overrideOnSale ? (
                            <span className="flex items-center gap-1.5 group/cell" title="سعر المستهلك — تم التعديل يدوياً">
                              <span onClick={(e) => startPriceEdit(e, item.id, 'sale_price')}
                                className="number-fmt-primary text-info-text cursor-pointer hover:text-primary transition-colors">
                                {saleNewPrice?.toFixed(2) || Number(item.sale_price || 0).toFixed(2)}
                              </span>
                              <SourceTag kind="manual" />
                              <span className="text-[10px] text-text-muted line-through hidden sm:inline">{Number(item.sale_price || 0).toFixed(2)}</span>
                              <button onClick={(e) => { e.stopPropagation(); clearOverride(e, item.id, 'sale_price'); }}
                                title="إعادة ضبط"
                                className="opacity-0 group-hover/cell:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-danger transition-colors">
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </span>
                          ) : isSelected && fieldKey === 'sale_price' && hasBulkFormula && newPrice !== null ? (
                            <span className="flex items-center gap-1.5 group/cell" title="سعر المستهلك — معاينة الصيغة">
                              <span className="number-fmt-primary text-warning-text">{newPrice.toFixed(2)}</span>
                              <SourceTag kind="formula" />
                              <span className="text-[10px] text-text-muted line-through hidden sm:inline">{Number(item.sale_price || 0).toFixed(2)}</span>
                            </span>
                          ) : (
                            <span onClick={(e) => startPriceEdit(e, item.id, 'sale_price')}
                              className={`${activePriceEdit === null ? "cursor-pointer hover:text-primary hover:underline decoration-dotted" : ""} transition-colors group`}
                              title="انقر لتعديل سعر المستهلك">
                              {Number(item.sale_price || 0).toFixed(2)}
                              <Pencil className="h-2.5 w-2.5 inline-block mr-1 text-text-muted/40 group-hover:text-primary transition-colors" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 border-l border-border/60 text-right number-fmt-primary text-sm text-info-text">
                          {activePriceEdit?.itemId === item.id && activePriceEdit?.field === 'wholesale_price' ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <input type="number" step="0.01" min="0" autoFocus
                                defaultValue={Number(item.wholesale_price || 0).toFixed(2)}
                                onBlur={(e) => commitPriceEdit(item.id, 'wholesale_price', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitPriceEdit(item.id, 'wholesale_price', e.target.value);
                                  if (e.key === "Escape") cancelPriceEdit(e);
                                }}
                                className="w-full rounded border border-primary bg-bg-surface px-2 py-0.5 text-sm font-black number-fmt text-text-primary outline-none focus:ring-2 focus:ring-primary-glow text-center"
                              />
                            </div>
                          ) : overrideOnWholesale ? (
                            <span className="flex items-center gap-1.5 group/cell" title="سعر الجملة — تم التعديل يدوياً">
                              <span onClick={(e) => startPriceEdit(e, item.id, 'wholesale_price')}
                                className="number-fmt-primary text-info-text cursor-pointer hover:text-primary transition-colors">
                                {wholesaleNewPrice?.toFixed(2) || Number(item.wholesale_price || 0).toFixed(2)}
                              </span>
                              <SourceTag kind="manual" />
                              <span className="text-[10px] text-text-muted line-through hidden sm:inline">{Number(item.wholesale_price || 0).toFixed(2)}</span>
                              <button onClick={(e) => { e.stopPropagation(); clearOverride(e, item.id, 'wholesale_price'); }}
                                title="إعادة ضبط"
                                className="opacity-0 group-hover/cell:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-danger transition-colors">
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </span>
                          ) : isSelected && fieldKey === 'wholesale_price' && hasBulkFormula && newPrice !== null ? (
                            <span className="flex items-center gap-1.5 group/cell" title="سعر الجملة — معاينة الصيغة">
                              <span className="number-fmt-primary text-warning-text">{newPrice.toFixed(2)}</span>
                              <SourceTag kind="formula" />
                              <span className="text-[10px] text-text-muted line-through hidden sm:inline">{Number(item.wholesale_price || 0).toFixed(2)}</span>
                            </span>
                          ) : (
                            <span onClick={(e) => startPriceEdit(e, item.id, 'wholesale_price')}
                              className={`${activePriceEdit === null ? "cursor-pointer hover:text-primary hover:underline decoration-dotted" : ""} transition-colors group`}
                              title="انقر لتعديل سعر الجملة">
                              {Number(item.wholesale_price || 0).toFixed(2)}
                              <Pencil className="h-2.5 w-2.5 inline-block mr-1 text-text-muted/40 group-hover:text-primary transition-colors" />
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-left number-fmt text-2sm">
                          {isSelected ? <DiffPill diff={diff} /> : <span className="text-text-muted/40">—</span>}
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
              <div className="flex items-center justify-between border-t border-border bg-bg-overlay/40 px-8 py-3.5">
                <div className="flex items-center gap-4">
                  <select className="h-8 rounded border border-border bg-bg-surface px-2 py-0 text-[11px] font-bold text-text-secondary outline-none shadow-card"
                    value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} بالصفحة</option>)}
                  </select>
                  <p className="text-2sm font-bold text-text-muted">عرض صفحة <span className="text-text-primary">{safePage}</span> من <span className="text-text-primary">{totalPages}</span></p>
                </div>
                <div className="flex items-center gap-1" dir="ltr">
                  <button disabled={safePage === 1} onClick={() => goPage(safePage - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 shadow-card">
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
                        className={`flex h-8 w-8 items-center justify-center rounded text-2sm font-black transition-all shadow-card ${
                          p === safePage ? "bg-primary border-primary text-white" : "bg-bg-surface border border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
                        }`}>
                        {p}
                      </button>
                    );
                  })}
                  <button disabled={safePage === totalPages} onClick={() => goPage(safePage + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 shadow-card">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Smart contextual hints + live preview */}
            {!fetchLoading && selected.size > 0 && hasBulkFormula && (
              <div className="flex items-center gap-3 px-8 py-2.5 bg-warning-bg border-t border-warning-border text-2sm">
                <Activity className="h-3.5 w-3.5 text-warning-text shrink-0" />
                <span className="font-bold text-text-secondary">
                  المعاينة الحية: {selected.size} صنف —{' '}
                  <span className="number-fmt-primary">
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
                  {' '}<span className="text-text-muted">(مثال من أول صنف محدد)</span>
                </span>
              </div>
            )}

            {/* Contextual help hint */}
            {!fetchLoading && (
              <div className="px-8 py-2.5 border-t border-border bg-bg-surface/80">
                <p className="text-2sm font-bold text-text-muted flex items-center gap-2">
                  {selected.size === 0 ? (
                    <>💡 <span>ابدأ بتحديد الأصناف من الجدول — يمكنك اختيار أكثر من صنف بالضغط باستمرار على <kbd className="px-1 py-0.5 rounded bg-bg-overlay font-mono text-[11px] font-black text-text-secondary border border-border shadow-card">Ctrl</kbd> والنقر</span></>
                  ) : !hasBulkFormula && !hasInlineOverrides ? (
                    <>💡 <span>اضبط قيمة التعديل (اتجاه، نوع، قيمة) ثم <span className="font-black text-text-secondary">أضف للدفعة</span> أو <span className="font-black text-success-text">طبّق فوراً</span></span></>
                  ) : selected.size > 0 && batchItems.length === 0 ? (
                    <>💡 <span>جهزت التعديل على {selected.size} صنف — اضغط <span className="font-black text-primary">إضافة إلى الدفعة</span> لتجميعه أو <span className="font-black text-success-text">تنفيذ التسعير</span> للحفظ الفوري</span></>
                  ) : batchItems.length > 0 ? (
                    <>💡 <span>لديك <span className="font-black text-primary">{batchItems.length}</span> تغيير في الدفعة — أضف المزيد من الأصناف أو <span className="font-black">احفظ الكل</span> كعملية واحدة</span></>
                  ) : (
                    <>💡 <span>كل تعديل بتعمه بيظهر في الجدول — تأكد من الأسعار الجديدة قبل الحفظ</span></>
                  )}
                </p>
              </div>
            )}

            {/* Batch bottom bar */}
            {batchItems.length > 0 && (
              <div data-help="batch-bottom-bar" className="sticky bottom-0 z-30 border-t-2 border-primary/50 bg-bg-surface shadow-elevated">
                <div className="flex items-center justify-between px-8 py-3.5">
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="font-black text-sm text-text-primary">الدفعة المجمّعة</span>
                    <span className="text-[11px] font-bold text-primary bg-primary-50 px-2 py-0.5 rounded-sm">{batchItems.length} تغيير</span>
                    <span className="text-2sm font-bold text-text-muted hidden sm:inline">
                      — أضف المزيد أو احفظ الكل كعملية واحدة
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button data-help="batch-clear-btn" onClick={async () => {
                      if (batchItems.length > 0) {
                        const ok = await confirm({ title: "تفريغ الدفعة", message: "تفريغ الدفعة — هل أنت متأكد؟" });
                        if (!ok) return;
                      }
                      clearBatch();
                    }}
                      title="إزالة جميع الأصناف من الدفعة"
                      className="flex items-center gap-1 text-2sm font-bold text-danger hover:text-danger-text hover:bg-danger-bg px-2.5 py-1.5 rounded-sm transition-colors">
                      <Trash2 className="h-3 w-3" /> تفريغ
                    </button>
                    <button data-help="batch-preview-btn" onClick={() => setShowBatchPreview(true)}
                      title="استعراض جميع تغييرات الدفعة مع إمكانية التعديل والإزالة قبل الحفظ"
                      className="flex items-center gap-1.5 bg-bg-surface border border-primary/40 text-primary hover:bg-primary-50 px-4 py-1.5 rounded-sm text-sm font-black transition-colors active:scale-95">
                      <ListChecks className="h-3.5 w-3.5" /> عرض التفاصيل
                    </button>
                    <button data-help="batch-save-btn" onClick={handleBatchSave}
                      disabled={batchLoading}
                      title={`حفظ ${batchItems.length} تغيير كعملية واحدة`}
                      className="flex items-center gap-2 bg-primary text-white hover:opacity-90 px-5 py-1.5 rounded-sm text-sm font-black shadow-card transition-colors disabled:opacity-40 active:scale-95">
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
          <div className="max-h-[70vh] overflow-auto scrollbar-thin bg-bg-surface p-0">
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-24 text-text-muted">
                <Clock className="h-10 w-10 animate-pulse" />
                <p className="text-sm font-black uppercase tracking-widest">لا توجد سجلات أرشفة</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-right min-w-full">
                <thead className="sticky top-0 z-40 bg-bg-overlay/95 backdrop-blur-sm border-b border-border shadow-card">
                  <tr>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-text-muted w-[160px] border-l border-border/60">التوقيت</th>
                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase text-text-muted border-l border-border/60 w-[90px]">المتأثر</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-text-muted border-l border-border/60 w-[120px]">الحقل</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-text-muted border-l border-border/60 w-[130px]">قيمة التطبيق</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-text-muted border-l border-border/60 w-[120px]">بواسطة</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-text-muted border-l border-border/60">ملاحظات</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase text-text-muted w-[130px]">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {history.map((op) => (
                    <React.Fragment key={op.operation_id}>
                      <tr
                        className={`hover:bg-bg-overlay/50 transition-colors cursor-pointer ${expandedOp === op.operation_id ? "bg-bg-overlay/60 border-r-4 border-primary" : ""}`}
                        onClick={() => loadOpItems(op.operation_id)}
                      >
                        <td className="px-4 py-3 number-fmt text-2sm text-text-secondary font-bold border-l border-border/60">
                          {op.changed_at?.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-4 py-3 text-center border-l border-border/60">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="badge badge--info">{op.items_count} صنف</span>
                            {op.change_count > op.items_count && (
                              <span className="text-[10px] font-bold text-text-muted leading-none">{op.change_count} تغييرات</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-2sm font-bold text-text-secondary border-l border-border/60">
                          {op.batch_metadata ? (
                            <span className="flex items-center gap-1 text-primary">
                              <Layers className="h-3 w-3" /> مجمّع
                            </span>
                          ) : op.field_count > 1 ? (
                            <span className="flex items-center gap-1 text-text-secondary">
                              <Layers className="h-3 w-3 text-text-muted" /> عدة حقول ({op.field_count})
                            </span>
                          ) : fieldLabelByKey(op.field)}
                        </td>
                        <td className="px-4 py-3 border-l border-border/60">
                          {op.batch_metadata ? (
                            <span className="badge badge--primary">
                              {(() => { const m = parseBatchMeta(op); if (m && m.rules) return `${m.rules.length} قواعد`; return 'Batch'; })()}
                            </span>
                          ) : (op.field_count > 1 || op.value_count > 1) ? (
                            <span className="badge badge--neutral">
                              قيم مختلفة
                            </span>
                          ) : (
                            <span className={`number-fmt-primary text-sm px-2 py-0.5 rounded ${op.adjustment_value > 0 ? "text-success-text bg-success-bg" : "text-danger-text bg-danger-bg"}`}>
                              {op.adjustment_value > 0 ? "+" : ""}{op.adjustment_value} {op.adjustment_type === "percentage" ? "%" : "ج"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-l border-border/60">
                          <span className="flex items-center gap-1.5 text-2sm font-bold text-text-secondary">
                            <User className="h-3 w-3 text-text-muted shrink-0" />
                            {op.changed_by || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-2sm font-bold text-text-muted border-l border-border/60">
                          {op.reason || "—"}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); loadOpItems(op.operation_id); }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-black transition-colors border ${
                                expandedOp === op.operation_id
                                  ? "bg-primary-50 text-primary border-primary/30"
                                  : "bg-bg-overlay text-text-secondary border-border hover:bg-bg-input"
                              }`}
                            >
                              {expandedOp === op.operation_id
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />}
                              تفاصيل
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleRollback(op.operation_id); }} disabled={rollbackLoading}
                              className="flex items-center gap-1 bg-bg-surface border border-danger/30 text-danger hover:bg-danger-bg px-2 py-1 rounded-sm text-[11px] font-black transition-colors">
                              <RefreshCcw className="h-3 w-3" /> استرجاع
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedOp === op.operation_id && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b border-primary/20">
                            <div className="bg-primary-50/40 px-6 py-3">
                              {opItemsLoading ? (
                                <div className="py-4 text-center text-2sm font-bold text-text-muted animate-pulse">جاري تحميل التفاصيل...</div>
                              ) : opItems.length === 0 ? (
                                <div className="py-4 text-center text-2sm font-bold text-text-muted">لا توجد تفاصيل</div>
                              ) : (
                                <>
                                  {/* Batch rule breakdown */}
                                  {(() => { const m = parseBatchMeta(op); if (!m || !m.rules || m.rules.length === 0) return null;
                                    return (
                                      <div className="mb-3 flex flex-wrap gap-2">
                                        {m.rules.map((rule, ri) => (
                                          <div key={ri} className="flex items-center gap-1.5 bg-bg-surface border border-primary/20 px-2.5 py-1 rounded-sm text-2sm">
                                            <span className="font-black text-primary">قاعدة {ri + 1}</span>
                                            <span className="font-bold text-text-secondary">{fieldLabelOf(rule.price_field)}</span>
                                            <span className={`number-fmt-primary ${rule.direction === 'up' ? 'text-success-text' : 'text-danger-text'}`}>
                                              {rule.direction === 'up' ? '+' : '-'}{rule.adjustment_value}{rule.adjustment_type === 'percentage' ? '%' : 'ج'}
                                            </span>
                                            <span className="font-bold text-text-muted">{rule.items_count} صنف</span>
                                          </div>
                                        ))}
                                        {m.inline_count > 0 && (
                                          <div className="flex items-center gap-1.5 bg-bg-surface border border-info/20 px-2.5 py-1 rounded-sm text-2sm">
                                            <span className="font-black text-info-text">يدوي</span>
                                            <span className="font-bold text-text-muted">{m.inline_count} صنف</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <table className="w-full border-collapse text-right text-2sm">
                                    <thead>
                                      <tr className="text-[11px] font-black uppercase text-text-muted border-b border-primary/20">
                                        <th className="pb-2 text-right">الصنف</th>
                                        <th className="pb-2 text-right">الفئة</th>
                                        <th className="pb-2 text-right">الحقل</th>
                                        <th className="pb-2 text-right w-[100px]">القيمة القديمة</th>
                                        <th className="pb-2 text-right w-[100px]">القيمة الجديدة</th>
                                        <th className="pb-2 text-right w-[80px]">التغيير</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-primary/10">
                                      {opItems.map((oi) => {
                                        const delta = oi.new_value - oi.old_value;
                                        return (
                                          <tr key={oi.item_id} className="hover:bg-primary-50/60 transition-colors">
                                            <td className="py-1.5">
                                              <div className="flex flex-col">
                                                {(oi.item_code || oi.code) && <span className="number-fmt text-[11px] text-text-muted">{oi.item_code || oi.code}</span>}
                                                <span className="font-bold text-text-primary">{oi.item_name}</span>
                                              </div>
                                            </td>
                                            <td className="py-1.5 text-text-secondary">{oi.category_name || "—"}</td>
                                            <td className="py-1.5 text-text-secondary">{fieldLabelByKey(oi.field)}</td>
                                            <td className="py-1.5 number-fmt-primary text-text-secondary">{Number(oi.old_value).toFixed(2)}</td>
                                            <td className="py-1.5 number-fmt-primary text-text-primary">{Number(oi.new_value).toFixed(2)}</td>
                                            <td className="py-1.5 number-fmt-primary">
                                              <DiffPill diff={delta} />
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
          <div className="w-full max-w-2xl card-elevated flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <div>
                <h2 className="text-[16px] font-black text-text-primary">معاينة التغييرات قبل التطبيق</h2>
                <p className="text-2sm font-bold text-text-muted mt-0.5">
                  {previewItems.length} تغيير · {new Set(previewItems.map(p => p.id)).size} صنف
                </p>
              </div>
              <button onClick={() => setPendingSubmit(false)} className="h-8 w-8 flex items-center justify-center rounded hover:bg-bg-overlay text-text-muted">
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
                <div className="flex items-center gap-4 px-7 py-3.5 bg-bg-overlay/40 border-b border-border text-2sm font-bold flex-wrap">
                  {ups.length > 0 && (
                    <span className="flex items-center gap-1 text-success-text bg-success-bg px-2 py-1 rounded">
                      <ArrowUp className="h-3 w-3" /> {ups.length} زيادة
                    </span>
                  )}
                  {downs.length > 0 && (
                    <span className="flex items-center gap-1 text-danger-text bg-danger-bg px-2 py-1 rounded">
                      <ArrowDown className="h-3 w-3" /> {downs.length} تخفيض
                    </span>
                  )}
                  {unchanged.length > 0 && (
                    <span className="text-text-muted bg-bg-overlay px-2 py-1 rounded">{unchanged.length} بدون تغيير</span>
                  )}
                    <span className="mr-auto number-fmt-primary text-text-secondary">
                    إجمالي الفارق:
                    <span className={`mr-1 ${totalImpact > 0 ? "text-success-text" : totalImpact < 0 ? "text-danger-text" : "text-text-muted"}`}>
                      {totalImpact > 0 ? "+" : ""}{totalImpact.toFixed(2)} ج
                    </span>
                  </span>
                </div>
              );
            })()}

            {/* Items table */}
            <div className="overflow-auto flex-1 scrollbar-thin">
              <table className="w-full border-collapse text-right text-2sm">
                <thead className="sticky top-0 bg-bg-overlay border-b border-border">
                  <tr>
                    <th className="px-4 py-2 font-black text-text-muted text-right">الصنف</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[70px]">الحقل</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[100px]">القيمة الحالية</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[100px]">القيمة الجديدة</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[90px] text-left">الفرق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewItems.map((it) => (
                    <tr key={`${it.id}-${it.field}`} className="hover:bg-bg-overlay/50">
                      <td className="px-4 py-2">
                        <p className="font-black text-text-primary">{it.name}</p>
                        {it.code && <p className="number-fmt text-[11px] text-text-muted">{it.code}</p>}
                        {it.isOverride && <span className="badge badge--info">مخصص</span>}
                      </td>
                      <td className="px-4 py-2 font-bold text-text-secondary">{it.fieldLabel}</td>
                      <td className="px-4 py-2 number-fmt-primary text-text-secondary text-right">{it.oldPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 number-fmt-primary text-text-primary text-right">{it.newPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-left">
                        <DiffPill diff={it.diff} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-5 border-t border-border bg-bg-overlay/30">
              <button onClick={() => setPendingSubmit(false)}
                className="btn btn-ghost">
                إلغاء
              </button>
              <button onClick={() => { setPendingSubmit(false); confirmApply(); }}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-success text-white hover:opacity-90 text-sm font-black shadow-card transition-colors disabled:opacity-40">
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
          <div className="w-full max-w-3xl card-elevated flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-7 py-5 border-b border-border">
              <div>
                <h2 className="text-[16px] font-black text-text-primary">تفاصيل الدفعة المجمّعة</h2>
                <p className="text-2sm font-bold text-text-muted mt-0.5 flex items-center gap-2">
                  <span>{batchItems.length} تغيير</span>
                  <span className="text-border-strong">·</span>
                  <Info className="h-3 w-3 text-text-muted" />
                  <span className="font-normal">انقر على سعر <span className="font-black underline decoration-dotted">الجديد</span> لتعديله يدوياً</span>
                </p>
              </div>
              <button onClick={() => setShowBatchPreview(false)}
                title="إغلاق"
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-bg-overlay text-text-muted transition-colors">
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
                <div className="flex items-center gap-4 px-7 py-3.5 bg-bg-overlay/40 border-b border-border text-2sm font-bold flex-wrap">
                  {ups.length > 0 && (
                    <span className="flex items-center gap-1 text-success-text bg-success-bg px-2 py-1 rounded">
                      <ArrowUp className="h-3 w-3" /> {ups.length} زيادة
                    </span>
                  )}
                  {downs.length > 0 && (
                    <span className="flex items-center gap-1 text-danger-text bg-danger-bg px-2 py-1 rounded">
                      <ArrowDown className="h-3 w-3" /> {downs.length} تخفيض
                    </span>
                  )}
                  {unchanged.length > 0 && (
                    <span className="text-text-muted bg-bg-overlay px-2 py-1 rounded">{unchanged.length} بدون تغيير</span>
                  )}
                  <span className="mr-auto number-fmt-primary text-text-secondary">
                    إجمالي الفارق:
                    <span className={`mr-1 ${totalImpact > 0 ? "text-success-text" : totalImpact < 0 ? "text-danger-text" : "text-text-muted"}`}>
                      {totalImpact > 0 ? "+" : ""}{totalImpact.toFixed(2)} ج
                    </span>
                  </span>
                </div>
              );
            })()}

            {/* Items table */}
            <div className="overflow-auto flex-1 scrollbar-thin">
              <table className="w-full border-collapse text-right text-2sm">
                <thead className="sticky top-0 bg-bg-overlay border-b border-border shadow-card">
                  <tr>
                    <th className="px-4 py-2 font-black text-text-muted text-right">الصنف</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[60px]">الحقل</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[70px] text-right">قديم</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[100px] text-right" title="انقر على السعر لتعديله يدوياً">جديد ↻</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[65px] text-left">الفرق</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[50px]">المصدر</th>
                    <th className="px-4 py-2 font-black text-text-muted w-[36px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {batchItems.map((bi, idx) => {
                    const isEditing = batchEditingId === bi.id;
                    return (
                      <tr key={bi.id}
                        className={`transition-all duration-200 ${
                          isEditing ? "bg-primary-50/40" : "hover:bg-bg-overlay/50"
                        } ${bi.diff === 0 ? "opacity-60" : ""}`}
                        style={{ animation: `fadeIn 0.2s ease-out ${idx * 0.02}s both` }}>
                        <td className="px-4 py-2">
                          <p className="font-black text-text-primary">{bi.name}</p>
                          {bi.code && <p className="number-fmt text-[11px] text-text-muted">{bi.code}</p>}
                        </td>
                        <td className="px-4 py-2 font-bold text-text-secondary">{bi.fieldLabel}</td>
                        <td className="px-4 py-2 number-fmt-primary text-text-secondary text-right">{bi.oldPrice.toFixed(2)}</td>
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
                              className="w-full rounded-sm border border-primary bg-bg-surface px-2 py-1 text-sm font-black number-fmt text-text-primary outline-none shadow-card text-right"
                            />
                          ) : (
                            <button onClick={() => setBatchEditingId(bi.id)}
                              title="انقر لتعديل السعر يدوياً"
                              className="group inline-flex items-center gap-1 number-fmt-primary text-text-primary cursor-pointer hover:text-primary transition-colors">
                              {bi.newPrice.toFixed(2)}
                              <Pencil className="h-2.5 w-2.5 text-text-muted/40 group-hover:text-primary transition-colors" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2 text-left">
                          <DiffPill diff={bi.diff} />
                        </td>
                        <td className="px-4 py-2">
                          <SourceTag kind={bi.source === 'يدوي' ? 'manual' : 'formula'} />
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={() => {
                            removeBatchItem(bi.id);
                            if (batchEditingId === bi.id) setBatchEditingId(null);
                          }}
                            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-danger hover:bg-danger-bg transition-colors active:scale-90"
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
                <div className="flex flex-col items-center gap-3 py-16 text-text-muted">
                  <Layers className="h-10 w-10" />
                  <p className="text-sm font-black uppercase tracking-widest">الدفعة فارغة</p>
                  <p className="text-2sm font-bold">أضف أصنافاً من شاشة التعديل السريع</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-7 py-5 border-t border-border bg-bg-overlay/30">
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  if (batchItems.length > 0) {
                    const ok = await confirm({ title: "تفريغ الدفعة", message: "هل أنت متأكد من تفريغ الدفعة بالكامل؟" });
                    if (ok) { clearBatch(); setShowBatchPreview(false); }
                  } else { clearBatch(); setShowBatchPreview(false); }
                }}
                  title="إزالة جميع الأصناف من الدفعة"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-bg-surface text-sm font-black text-danger hover:bg-danger-bg hover:border-danger/30 transition-colors active:scale-95">
                  <Trash2 className="h-3.5 w-3.5" /> تفريغ الكل
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowBatchPreview(false)}
                  title="العودة إلى شاشة التعديل لإضافة المزيد من الأصناف"
                  className="btn btn-ghost">
                  <Plus className="h-3.5 w-3.5" /> إضافة المزيد
                </button>
                <button onClick={() => { setShowBatchPreview(false); handleBatchSave(); }}
                  disabled={batchLoading || batchItems.length === 0}
                  title={`احفظ ${batchItems.length} تغيير كعملية واحدة في قاعدة البيانات`}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white hover:opacity-90 text-sm font-black shadow-card transition-colors disabled:opacity-40 active:scale-95">
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

      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
