import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, ShoppingCart, Trash2, User, Package, Calendar, FileText,
  Warehouse, ChevronDown, ArrowLeft, X, CreditCard, Wallet, Banknote,
  AlertTriangle, Clock, ExternalLink, TrendingUp, Building2, Phone,
  ImageIcon, ZoomIn, Printer, CheckCircle2, Layers, Lock, Pencil,
  FilePlus, Sparkles, Receipt, RefreshCw, ArrowUpDown, Save,
  Loader2,
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import toast from "react-hot-toast";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import { useAuthStore } from "../../stores/authStore";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import PermissionGate from "../../components/ui/PermissionGate";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center text-[12px] font-bold text-slate-400 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
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
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-emerald-50/80" : "hover:bg-zinc-50"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><Package className="w-4 h-4 text-slate-300"/></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[13px] font-black ${activeIndex === i ? "text-indigo-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[10px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              {item.price_label && <span className="font-mono text-[12px] font-black text-slate-600">{item.price_label}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  });
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
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

function PurchasePreviewModal({ purchase, onClose }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!purchase) return;
    setLoading(true);
    const id = purchase.purchase_id || purchase.id;
    api.get(`/api/purchases/${id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(purchase))
      .finally(() => setLoading(false));
  }, [purchase?.purchase_id, purchase?.id]);
  if (!purchase) return null;
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-sm bg-emerald-50 border border-emerald-200 px-4 py-3">
            <div className="flex items-center gap-4 text-[13px] flex-wrap">
              <span className="font-black text-emerald-800">فاتورة #{detail?.doc_no || purchase.doc_no}</span>
              <span className="text-slate-600">المورد: <strong>{(detail || purchase).supplier_name || "—"}</strong></span>
              <span className="text-slate-500">{(detail || purchase).created_at ? formatArabicDateTime(new Date((detail || purchase).created_at)) : "—"}</span>
              <span className="font-bold text-emerald-700">الإجمالي: {formatMoney((detail || purchase).total)} ج.م</span>
            </div>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">التكلفة</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {((detail || purchase).lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || l.code || l.barcode || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose}
          className="rounded-sm border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100">
          رجوع
        </button>
        <button onClick={() => navigate(`/purchases/${purchase.purchase_id || purchase.id}`)}
          className="flex items-center gap-2 rounded-sm bg-emerald-700 px-6 py-2 text-[13px] font-black text-white hover:bg-emerald-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح الفاتورة
        </button>
      </div>
    </div>
  );
}

const SUPPLIER_METHODS = [
  { id: "credit",       label: "آجل",              sub: "يُضاف لرصيد المورد",          icon: Wallet,   color: "amber",  requiresSupplier: true },
  { id: "future_due",   label: "استحقاق لاحق",     sub: "مع تحديد تاريخ الاستحقاق",    icon: Clock,    color: "rose",   requiresSupplier: true },
  { id: "bank_transfer",label: "حوالة بنكية",      sub: "خصم من حساب البنك",           icon: CreditCard, color: "blue", requiresSupplier: false },
];

const COLOR_MAP = {
  slate:  { border: "border-slate-800",  bg: "bg-slate-800",  text: "text-slate-800",  light: "bg-slate-50"  },
  blue:   { border: "border-blue-600",   bg: "bg-blue-600",   text: "text-blue-700",   light: "bg-blue-50"   },
  amber:  { border: "border-amber-500",  bg: "bg-amber-500",  text: "text-amber-700",  light: "bg-amber-50"  },
  rose:   { border: "border-rose-500",   bg: "bg-rose-500",   text: "text-rose-700",   light: "bg-rose-50"   },
  emerald:{ border: "border-emerald-600",bg: "bg-emerald-600",text: "text-emerald-700",light: "bg-emerald-50"},
};

export default function PurchaseFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditMode = !!id;
  const isAmendMode = isEditMode && !!location.state?.openAmend;

  const [locked, setLocked] = useState(isEditMode && !isAmendMode);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [editDebtRemaining, setEditDebtRemaining] = useState(0); // debt this purchase added to supplier balance (reversal on edit)

  // editActivation is populated after the existing purchase loads (edit mode only)
  const [editActivation, setEditActivation] = useState(null);
  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("purchase_receipt", editActivation);

  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [supplier, setSupplier] = useState(null);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState(() => `INV-${Date.now().toString().slice(-6)}`);

  const [itemQuery, setItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", warehouseId: "", unitId: "" });
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);

  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankRef, setBankRef] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [multiAmounts, setMultiAmounts] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [printSettings, setPrintSettings] = useState({});
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState({ name: "", phone: "", address: "" });
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [editWarnOpen, setEditWarnOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [newInvoiceModalOpen, setNewInvoiceModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const itemInputRef    = useRef(null);
  const qtyInputRef     = useRef(null);
  const costInputRef    = useRef(null);
  const sellInputRef    = useRef(null);
  const supplierInputRef= useRef(null);
  const whSelectRef     = useRef(null);
  const unitSelectRef   = useRef(null);
  const addBtnRef       = useRef(null);

  // Today's Purchases modal states
  const [todayPurchOpen, setTodayPurchOpen] = useState(false);
  const [todayPurchases, setTodayPurchases] = useState([]);
  const [todayPurchSummary, setTodayPurchSummary] = useState({ count: 0, total: 0 });
  const [todayPurchLoading, setTodayPurchLoading] = useState(false);
  const [todayPurchDateFrom, setTodayPurchDateFrom] = useState(toDateInput());
  const [todayPurchDateTo, setTodayPurchDateTo] = useState(toDateInput());
  const [todayPurchSort, setTodayPurchSort] = useState("created_at");
  const [todayPurchDir, setTodayPurchDir] = useState("desc");
  const [todayPurchUserId, setTodayPurchUserId] = useState("");
  const [todayPurchUsersList, setTodayPurchUsersList] = useState([]);
  const [todayPurchDocSearch, setTodayPurchDocSearch] = useState("");
  const [todayPurchItemSearch, setTodayPurchItemSearch] = useState("");
  const [todayPurchRawItems, setTodayPurchRawItems] = useState([]);
  const [todayPurchAllItems, setTodayPurchAllItems] = useState([]);
  const [todayPurchItemLookupOpen, setTodayPurchItemLookupOpen] = useState(false);
  const [todayPurchActiveItemIndex, setTodayPurchActiveItemIndex] = useState(0);
  const [todayPurchSupplierQuery, setTodayPurchSupplierQuery] = useState("");
  const [todayPurchSupplierLookupOpen, setTodayPurchSupplierLookupOpen] = useState(false);
  const [todayPurchActiveSupplierIndex, setTodayPurchActiveSupplierIndex] = useState(0);
  const [todayPurchSupplierId, setTodayPurchSupplierId] = useState("");
  const [todayPurchPreviewInvoice, setTodayPurchPreviewInvoice] = useState(null);
  const [todayPurchPreviewOpen, setTodayPurchPreviewOpen] = useState(false);
  const [todayPurchVoidOpen, setTodayPurchVoidOpen] = useState(false);
  const [todayPurchVoidTarget, setTodayPurchVoidTarget] = useState(null);

  const todayPurchFilteredItems = useMemo(() => {
    if (!todayPurchItemSearch.trim() || !todayPurchAllItems.length) return [];
    return fuzzyFilterRows(todayPurchAllItems, todayPurchItemSearch, ["name", "code", "barcode"]).slice(0, 8);
  }, [todayPurchItemSearch, todayPurchAllItems]);

  const todayPurchFilteredSuppliers = useMemo(() => {
    if (!todayPurchSupplierLookupOpen) return [];
    const q = todayPurchSupplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [todayPurchSupplierLookupOpen, todayPurchSupplierQuery, suppliers]);

  function aggregatePurchaseResults(data) {
    const map = {};
    (data || []).forEach(line => {
      const id = line.purchase_id;
      if (!map[id]) {
        map[id] = {
          id, doc_no: line.doc_no, supplier_name: line.supplier_name,
          supplier_id: line.supplier_id, created_at: line.created_at,
          total: 0, items_count: 0, status: line.status,
        };
      }
      map[id].total += Number(line.unit_cost || 0) * Number(line.quantity || 0);
      map[id].items_count += 1;
    });
    return Object.values(map);
  }

  async function loadTodayPurchases() {
    setTodayPurchLoading(true);
    try {
      if (todayPurchItemSearch.trim()) {
        const params = new URLSearchParams({ q: todayPurchItemSearch.trim() });
        if (todayPurchDocSearch.trim()) params.set("doc_search", todayPurchDocSearch.trim());
        if (todayPurchSupplierQuery.trim()) params.set("supplier_search", todayPurchSupplierQuery.trim());
        if (todayPurchSupplierId) params.set("supplier_id", todayPurchSupplierId);
        if (todayPurchUserId) params.set("user_id", todayPurchUserId);
        params.set("date_from", todayPurchDateFrom);
        params.set("date_to", todayPurchDateTo);
        const r = await api.get(`/api/purchases/items-search?${params}`);
        const raw = r.data.data || [];
        setTodayPurchRawItems(raw);
        setTodayPurchases([]);
        const aggregated = aggregatePurchaseResults(raw);
        setTodayPurchSummary({ count: aggregated.length, total: aggregated.reduce((s, x) => s + x.total, 0) });
      } else {
        const params = new URLSearchParams({ date_from: todayPurchDateFrom, date_to: todayPurchDateTo, sort: todayPurchSort, dir: todayPurchDir });
        if (todayPurchUserId) params.set("user_id", todayPurchUserId);
        if (todayPurchSupplierId) params.set("supplier_id", todayPurchSupplierId);
        if (todayPurchSupplierQuery.trim() && !todayPurchSupplierId) {
          params.set("supplier_search", todayPurchSupplierQuery.trim());
        }
        if (todayPurchDocSearch.trim()) params.set("search", todayPurchDocSearch.trim());
        const r = await api.get(`/api/purchases?${params}`);
        let data = r.data.data || [];
        if (todayPurchSupplierQuery.trim() && !todayPurchSupplierId) {
          const q = todayPurchSupplierQuery.trim().toLowerCase();
          data = data.filter((inv) => String(inv.supplier_name || "").toLowerCase().includes(q));
        }
        setTodayPurchases(data);
        setTodayPurchRawItems([]);
        setTodayPurchSummary(r.data.summary || { count: 0, total: 0 });
      }
    } catch (e) { console.error("loadTodayPurchases error:", e); }
    finally { setTodayPurchLoading(false); }
  }

  useEffect(() => {
    if (!todayPurchOpen) return;
    api.get("/api/items").then(r => setTodayPurchAllItems(r.data.data || [])).catch(() => {});
    if (!todayPurchUsersList.length) {
      api.get("/api/users").then(r => setTodayPurchUsersList(r.data.data || [])).catch(() => {});
    }
  }, [todayPurchOpen]);

  useEffect(() => {
    if (!todayPurchOpen) return;
    const timer = setTimeout(() => { loadTodayPurchases(); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayPurchOpen, todayPurchDateFrom, todayPurchDateTo, todayPurchSort, todayPurchDir, todayPurchUserId, todayPurchItemSearch, todayPurchDocSearch, todayPurchSupplierQuery, todayPurchSupplierId]);

  const handleFieldKeyDown = (e, nextRef, prevRef, isEnterSubmit = false) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) { if (prevRef?.current) { prevRef.current.focus(); if (prevRef.current.select) prevRef.current.select(); } }
      else if (isEnterSubmit) addLine();
      else if (nextRef?.current) { nextRef.current.focus(); if (nextRef.current.select) nextRef.current.select(); }
    }
  };

  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
    api.get("/api/suppliers").then(r => setSuppliers(r.data.data || [])).catch(() => {});
    api.get("/api/items").then(r => setItems(r.data.data || [])).catch(() => {});
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
      setPaymentMode(p.payment_method || "cash");
      setEditDebtRemaining(p.debt_remaining || 0);
      if (p.supplier_id) {
        api.get(`/api/suppliers/${p.supplier_id}`).then(sr => {
          const s = sr.data.data;
          setSupplier(s);
          setSupplierQuery(s.name);
        }).catch(() => {});
      }
      setLines((p.lines || []).map(l => ({
        item_id: l.item_id,
        name: l.item_name || l.name || "",
        code: l.code || l.barcode || "",
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        selling_price: l.selling_price || 0,
        original_sale_price: l.selling_price || 0,
        warehouse_id: String(l.warehouse_id || ""),
        unit_id: l.unit_id || null,
        total: l.line_total || (l.quantity * l.unit_cost),
      })));
    }).catch(() => toast.error("فشل تحميل الفاتورة"))
      .finally(() => setLoadingExisting(false));
  }, [id, isEditMode]);

  useEffect(() => {
    if (!selectedItem) setStaging(s => ({ ...s, warehouseId: defaultWarehouseId }));
  }, [defaultWarehouseId]);

  const filteredItems = useMemo(() =>
    fuzzyFilterRows(items, itemQuery, ["name", "code", "item_code", "barcode"]).slice(0, 8),
    [itemQuery, items]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [supplierQuery, suppliers]);

  function handlePickItem(item) {
    setSelectedItem(item);
    setItemQuery(item.name);
    setStaging(prev => ({
      ...prev,
      unitCost: String(item.purchase_price || 0),
      sellingPrice: String(item.sale_price || 0),
      unitId: String(item.unit_id || prev.unitId),
    }));
    setLookupOpen(false);
    setTimeout(() => whSelectRef.current?.focus(), 50);
  }

  function handlePickSupplier(s) {
    activateInvoice();
    setSupplier(s);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
  }

  function addLine() {
    if (!selectedItem) return;
    activateInvoice();
    const qty = Number(staging.quantity || 1);
    const cost = Number(staging.unitCost || 0);
    const sellingPrice = Number(staging.sellingPrice || 0);
    const wid = staging.warehouseId || defaultWarehouseId;
    setLines(prev => [...prev, {
      item_id: selectedItem.id,
      name: selectedItem.name,
      code: selectedItem.code || selectedItem.barcode,
      quantity: qty,
      unit_cost: cost,
      selling_price: sellingPrice,
      original_sale_price: Number(selectedItem.sale_price || 0),
      warehouse_id: wid,
      unit_id: staging.unitId || null,
      total: qty * cost,
    }]);
    setSelectedItem(null);
    setItemQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", warehouseId: s.warehouseId, unitId: "" }));
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
    return { sub, total: sub };
  }, [lines]);

  const priceChangedLines = useMemo(
    () => lines.filter(l => Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0),
    [lines]);

  const multiTotal = useMemo(() =>
    Object.values(multiAmounts).reduce((s, v) => s + Number(v || 0), 0),
    [multiAmounts]);

  const multiBalanced = Math.abs(multiTotal - totals.total) < 0.005;

  function handleSelectPayment(mode) {
    if ((mode === "credit" || mode === "future_due") && !supplier) return;
    setPaymentMode(mode);
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
      date: invoiceCreatedAt || docDate,
      payment_method: paymentMode,
      bank_ref: paymentMode === "bank_transfer" ? bankRef : undefined,
      due_date: paymentMode === "future_due" ? dueDate : undefined,
      payments,
      lines: lines.map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        selling_price: l.selling_price,
        warehouse_id: l.warehouse_id || defaultWarehouseId,
      })),
    };
  }

  function validateBeforeSave() {
    if (!lines.length) { toast.error("الفاتورة فارغة — أضف أصناف أولاً"); return false; }
    if ((paymentMode === "credit" || paymentMode === "future_due") && !supplier) {
      toast.error("طريقة الدفع الآجلة تتطلب تحديد المورد"); return false;
    }
    if (paymentMode === "future_due" && !dueDate) { toast.error("يرجى تحديد تاريخ الاستحقاق"); return false; }
    if (paymentMode === "multi" && !multiBalanced) {
      toast.error(`المبلغ الموزع ${multiTotal.toFixed(2)} لا يساوي الإجمالي ${totals.total.toFixed(2)}`); return false;
    }
    return true;
  }

  async function doSave() {
    if (!validateBeforeSave()) return;
    setIsSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/api/purchases/${id}`, buildPayload());
        toast.success("تم تحديث الفاتورة بنجاح");
        navigate(`/purchases/${id}`);
      } else {
        await api.post("/api/purchases", buildPayload());
        if (priceChangedLines.length > 0) toast.success(`تم تحديث أسعار بيع ${priceChangedLines.length} صنف`);
        toast.success("تم حفظ فاتورة المشتريات بنجاح");
        // Reset to idle state — doc number and date shown only after next interaction
        setLines([]);
        setSupplier(null);
        setSupplierQuery("");
        setPaymentMode("cash");
        setBankRef("");
        setDueDate("");
        setMultiAmounts({});
        resetActivation();
        navigate("/purchases/new", { replace: true });
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل حفظ الفاتورة");
    } finally {
      setIsSaving(false);
      setSaveConfirmOpen(false);
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
      toast.error(e.response?.data?.message || "فشل حذف الفاتورة");
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
    resetActivation();
  }

  async function createSupplier() {
    if (!supplierDraft.name) return;
    try {
      const r = await api.post("/api/suppliers", supplierDraft);
      const newSup = r.data.data;
      setSuppliers(prev => [newSup, ...prev]);
      handlePickSupplier(newSup);
      setSupplierModalOpen(false);
      setSupplierDraft({ name: "", phone: "", address: "" });
    } catch { toast.error("فشل إنشاء المورد"); }
  }

  const user = useAuthStore((s) => s.user);
  const isLocked = isEditMode && locked;

  if (loadingExisting) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-[14px] font-black text-slate-400 animate-pulse">جاري تحميل الفاتورة...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden pb-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-emerald-500 bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <h1 className="text-[14px] font-black text-emerald-800">
                {isEditMode ? `فاتورة مشتريات #${refNo}` : "فاتورة مشتريات جديدة"}
              </h1>
              <span className="text-[10px] font-bold text-slate-400">
                {isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : "إدخال مخزون جديد"}
              </span>
            </div>
            <div className="mx-2 h-8 w-px bg-slate-200" />
            {invoiceIsActive && (
              <div className="flex items-center gap-1.5 rounded-sm bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {isLocked ? "مقفلة" : "نشطة"}
              </div>
            )}
          </div>
          {isLocked && (
            <div className="flex items-center gap-1.5 rounded-sm bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500">
              <Lock className="h-3 w-3" /> مقفلة
            </div>
          )}
          {!isLocked && isEditMode && user?.name && (
            <div className="flex items-center gap-1.5 rounded-sm bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              المحرر: {user.name}
            </div>
          )}
          {!isLocked && (
            <div className="flex gap-1.5">
              <input disabled value={invoiceIsActive ? (docNo || refNo || "") : "—"} placeholder="رقم المستند"
                className="h-6 w-24 rounded-sm border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono font-black text-slate-500 cursor-not-allowed outline-none" />
              <input disabled value={invoiceIsActive && invoiceCreatedAt ? new Date(invoiceCreatedAt).toLocaleString("ar-EG") : "—"}
                className="h-6 w-40 rounded-sm border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono font-black text-slate-500 cursor-not-allowed outline-none" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {priceChangedLines.length > 0 && !isLocked && (
            <div className="flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              <TrendingUp className="h-3.5 w-3.5" />
              {priceChangedLines.length} أسعار بيع ستتغير
            </div>
          )}
          {/* Today's Purchases button */}
          <button onClick={() => setTodayPurchOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-all">
            <Receipt className="h-3.5 w-3.5" /> مشتريات اليوم
          </button>
          {/* Delete button — always visible */}
          <PermissionGate page="purchases" action="delete">
            <button onClick={() => setDeleteConfirmOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-sm border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all">
              <Trash2 className="h-3.5 w-3.5" />
              {isEditMode ? "حذف" : "مسح"}
            </button>
          </PermissionGate>
          {isEditMode && isLocked ? (
            <button onClick={() => setEditWarnOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all">
              <Pencil className="h-3 w-3" /> تعديل
            </button>
          ) : (
            <>
              <PermissionGate page="purchases" action="print">
                <button onClick={() => setPrintPreview(true)} disabled={!lines.length}
                  className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-slate-50 transition-all disabled:opacity-40">
                  <Printer className="h-3 w-3" /> معاينة وطباعة
                </button>
              </PermissionGate>
              <PermissionGate page="purchases" action={isEditMode || isAmendMode ? "edit" : "add"}>
                <button onClick={() => { if (validateBeforeSave()) setSaveConfirmOpen(true); }} disabled={isSaving || !lines.length}
                  className="flex h-7 items-center gap-1.5 rounded-sm bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 transition-all disabled:opacity-40 shadow-sm active:scale-[0.98]">
                  {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري...</> : isAmendMode ? "إصدار تعديل" : isEditMode ? "حفظ التعديلات" : "حفظ"}
                </button>
              </PermissionGate>
              <button onClick={() => setNewInvoiceModalOpen(true)}
                className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all">
                <FilePlus className="h-3 w-3" /> جديدة
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: Main Content */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
          {/* Header Info Grid */}
          <section className={`grid grid-cols-3 gap-3 rounded-md border border-slate-300 bg-white p-4 shadow-sm shrink-0 ${isLocked ? "opacity-70 pointer-events-none select-none" : ""}`}>
            {/* Supplier */}
            <div className="relative flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">
                المورد <span className="text-slate-400 font-medium">(اختياري للنقدي)</span>
              </label>
              <div className="flex items-center gap-1">
                <div className="relative flex-1">
                  <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierQuery}
                    onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); setSupplier(null); }}
                    onFocus={() => setSupplierLookupOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                    placeholder="ابحث عن مورد..."
                    disabled={isLocked}
                    className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  {supplierLookupOpen && !isLocked && (
                    <LookupList items={filteredSuppliers} onPick={handlePickSupplier} activeIndex={activeSupplierIndex} emptyLabel="لم يتم العثور على مورد" />
                  )}
                </div>
                {!isLocked && (
                  <button onClick={() => setSupplierModalOpen(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">تاريخ الفاتورة</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                  disabled={isLocked}
                  className="w-full border border-slate-300 rounded-sm bg-white py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800 disabled:bg-slate-50 disabled:cursor-not-allowed" />
              </div>
            </div>

            {/* Ref No */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">رقم مرجع المورد</label>
              <div className="relative">
                <FileText className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input type="text" readOnly value={refNo}
                  className="w-full border border-slate-300 rounded-sm bg-slate-50 py-2 pl-3 pr-9 text-[12px] font-bold text-slate-500 outline-none font-mono cursor-not-allowed" />
              </div>
            </div>
          </section>

          {/* Quick Entry Bar — hidden in locked mode */}
          {!isLocked && (
            <section className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
              <div className="grid grid-cols-[3fr_110px_80px_100px_100px_100px_80px] gap-2 items-end">
                {/* Item search */}
                <div className="relative flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                  <div className="relative">
                    <SearchInput
                      ref={itemInputRef}
                      value={itemQuery}
                      onChange={(val) => { setItemQuery(val); setLookupOpen(true); setSelectedItem(null); }}
                      onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
                      onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
                      placeholder="ابحث بالاسم، الباركود، أو الكود..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && filteredItems.length > 0) { e.preventDefault(); handlePickItem(filteredItems[activeIndex]); }
                        else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredItems.length - 1)); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); }
                      }}
                    />
                    {lookupOpen && <LookupList items={filteredItems} onPick={handlePickItem} activeIndex={activeIndex} query={itemQuery} />}
                  </div>
                </div>

                {/* Warehouse */}
                <div className="flex flex-col gap-1 relative z-10">
                  <label className="text-[11px] font-bold text-slate-600 truncate">المخزن</label>
                  <select ref={whSelectRef} size={4} value={staging.warehouseId}
                    onChange={(e) => setStaging(s => ({ ...s, warehouseId: e.target.value }))}
                    onKeyDown={(e) => handleFieldKeyDown(e, qtyInputRef, itemInputRef)}
                    className="w-full border border-slate-300 rounded-sm bg-slate-50 py-1 px-1 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-500 h-[37px] hover:h-[120px] focus:h-[120px] focus:z-20 transition-all shadow-sm focus:shadow-xl overflow-y-auto custom-scrollbar">
                    {warehouses.map(w => {
                      const qty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : 0;
                      return <option key={w.id} value={w.id}>{w.name} {selectedItem && `(${qty})`}</option>;
                    })}
                  </select>
                </div>

                {/* Qty */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                  <input ref={qtyInputRef} type="number" min="0.001" step="any" value={staging.quantity}
                    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, unitSelectRef, whSelectRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center" />
                </div>

                {/* Unit */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                  <div className="relative">
                    <select ref={unitSelectRef} value={staging.unitId}
                      onChange={(e) => setStaging(s => ({ ...s, unitId: e.target.value }))}
                      onKeyDown={(e) => handleFieldKeyDown(e, costInputRef, qtyInputRef)}
                      className="w-full h-[37px] appearance-none border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800">
                      <option value="">أساسية</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <ChevronDown className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>

                {/* Cost */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">التكلفة</label>
                  <input ref={costInputRef} type="number" step="any" value={staging.unitCost}
                    onChange={(e) => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, sellInputRef, unitSelectRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center" />
                </div>

                {/* Selling price */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    سعر البيع
                    {selectedItem && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && Number(staging.sellingPrice) > 0 && (
                      <span className="text-amber-600 text-[9px]">• متغير</span>
                    )}
                  </label>
                  <input ref={sellInputRef} type="number" step="any" value={staging.sellingPrice}
                    onChange={(e) => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, addBtnRef, costInputRef, true)}
                    className={`w-full h-[37px] border rounded-sm py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center ${
                      selectedItem && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && Number(staging.sellingPrice) > 0
                        ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-slate-50"
                    }`} />
                </div>

                {/* Add button */}
                <button ref={addBtnRef} onClick={addLine}
                  onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addLine(); } }}
                  disabled={!selectedItem}
                  className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-emerald-600 px-4 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40 self-end transition-all shadow-sm">
                  <Plus className="h-4 w-4" /> إضافة
                </button>
              </div>
            </section>
          )}

          {/* Lines DataGrid */}
          <DataGrid
            data={lines}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف في الفاتورة بعد"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-300 min-h-0 animate-fade-in"
            columns={[
              { id: "index", header: "#", width: 40, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100", sortable: false, render: (_, i) => i + 1 },
              { id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[11px] font-black tracking-wider text-slate-500 border-l border-slate-100", render: (l) => l.code || "-" },
              {
                id: "name", header: "البيان", width: 220, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                render: (l) => {
                  const item = items.find(i => i.id === l.item_id);
                  const imgUrl = item?.primary_image_url || item?.image_url || item?.image;
                  return (
                    <div className="flex items-center gap-2 py-1">
                      {imgUrl ? (
                        <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                          <img src={resolveImageUrl(imgUrl)} alt={l.name} className="w-8 h-8 object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn className="w-4 h-4 text-white" /></div>
                        </button>
                      ) : (
                        <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                      )}
                      <span className="truncate">{l.name}</span>
                    </div>
                  );
                }
              },
              { id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => <input type="number" min="0.001" step="any" value={l.quantity} disabled={isLocked} onChange={(e) => updateLineField(i, "quantity", Number(e.target.value))} className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 transition-colors disabled:cursor-not-allowed" /> },
              { id: "unit_cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => <input type="number" step="any" value={l.unit_cost} disabled={isLocked} onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))} className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 text-slate-700 transition-colors disabled:cursor-not-allowed" /> },
              {
                id: "selling_price", header: "سعر البيع", width: 110, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const changed = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0;
                  const minMargin = printSettings?.min_margin_percent ?? 15;
                  const cost = Number(l.unit_cost) || 0;
                  const price = Number(l.selling_price) || 0;
                  const marginPct = cost > 0 && price > 0 ? ((price - cost) / cost) * 100 : null;
                  const belowMargin = marginPct != null && marginPct < minMargin;
                  return (
                    <div className="relative w-full h-full flex flex-col">
                      <input type="number" step="any" value={l.selling_price} disabled={isLocked} onChange={(e) => updateLineField(i, "selling_price", Number(e.target.value))}
                        className={`w-full h-[32px] text-center text-[13px] font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${belowMargin ? "bg-rose-50 text-rose-800" : changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50"}`} />
                      {changed && !belowMargin && <span title={`السعر الحالي: ${l.original_sale_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />}
                      {belowMargin && <span className="text-[9px] font-black text-rose-500 text-center leading-none pb-0.5">هامش {marginPct.toFixed(0)}%</span>}
                    </div>
                  );
                }
              },
              { id: "warehouse_id", header: "المخزن", width: 120, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l, i) => <select value={l.warehouse_id} disabled={isLocked} onChange={(e) => updateLineField(i, "warehouse_id", e.target.value)} className="w-full h-[40px] text-[11px] font-bold bg-transparent outline-none border-0 ring-0 text-slate-600 appearance-none text-center focus:bg-slate-50 truncate disabled:cursor-not-allowed">{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select> },
              { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-slate-900 bg-slate-50/50 border-l border-slate-100",
                render: (l) => Number(l.total).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) },
              { id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center",
                render: (_, i) => !isLocked && <button onClick={() => removeLine(i)} className="inline-flex h-[40px] w-full items-center justify-center text-slate-400 opacity-60 hover:bg-slate-100 hover:text-rose-500 hover:opacity-100 transition-colors focus:outline-none"><X className="h-4 w-4" /></button> },
            ]}
          />

          {priceChangedLines.length > 0 && !isLocked && (
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-700 font-bold shrink-0 mt-2 border border-amber-200 rounded-md">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              سيتم تحديث أسعار البيع لـ {priceChangedLines.map(l => l.name).join("، ")}
              <Link to="/operations/bulk-price-update" className="mr-auto flex items-center gap-1 text-amber-600 hover:underline">
                <ExternalLink className="h-3 w-3" /> سجل الأسعار
              </Link>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="w-[290px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Supplier card */}
          {supplier ? (
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">المورد</h3>
                <Link to={`/suppliers/${supplier.id}`} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700"><ExternalLink className="h-3 w-3" /> السجل</Link>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-[14px] font-black">{supplier.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-slate-800 truncate">{supplier.name}</p>
                  {supplier.phone && <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
                  {(() => {
                    const dispBal = Number(supplier.opening_balance || 0) - editDebtRemaining;
                    return (
                      <>
                        <div className="mt-2 flex items-center justify-between rounded-sm bg-slate-50 border border-slate-200 px-3 py-1.5">
                          <span className="text-[10px] font-bold text-slate-500">{isEditMode ? "الرصيد قبل التعديل" : "الرصيد الحالي"}</span>
                          <span className={`text-[13px] font-black font-mono ${dispBal > 0 ? "text-rose-600" : "text-slate-800"}`}>{dispBal.toFixed(2)}</span>
                        </div>
                        {(paymentMode === "credit" || paymentMode === "future_due") && lines.length > 0 && (
                          <div className="mt-1.5 flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-3 py-1.5">
                            <span className="text-[10px] font-bold text-amber-600">الرصيد بعد الفاتورة</span>
                            <span className={`text-[13px] font-black font-mono ${dispBal + totals.total > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {(dispBal + totals.total).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center">
              <Building2 className="h-8 w-8 mx-auto text-slate-200 mb-2" />
              <p className="text-[11px] font-bold text-slate-400">المورد اختياري للدفع النقدي<br />مطلوب للدفع الآجل والبنكي</p>
            </div>
          )}

          {/* Invoice Summary */}
          <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100">ملخص الفاتورة</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-500">إجمالي الأصناف</span>
                <span className="text-[12px] font-black text-slate-800">{lines.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-500">مجموع الكميات</span>
                <span className="text-[12px] font-black text-slate-800">{lines.reduce((acc, l) => acc + Number(l.quantity), 0)}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="mt-3 rounded-sm bg-emerald-800 p-4 text-center text-white">
                <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                <div className="text-[26px] font-black tracking-tighter font-mono">
                  {totals.total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] opacity-40">ج.م</div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className={`rounded-md border border-slate-300 bg-white p-4 shadow-sm ${isLocked ? "opacity-70 pointer-events-none select-none" : ""}`}>
            <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>

            <button onClick={() => handleSelectPayment("cash")}
              className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all mb-2 ${paymentMode === "cash" ? "border-slate-800 bg-slate-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${paymentMode === "cash" ? "bg-slate-800" : "bg-slate-200"}`}><Banknote className="h-4 w-4" /></div>
              <div className="flex-1 flex flex-col text-right">
                <span className={`text-[12px] font-black ${paymentMode === "cash" ? "text-slate-800" : "text-slate-700"}`}>نقدي</span>
                <span className="text-[10px] text-slate-400">سداد فوري — خصم من الخزينة</span>
              </div>
              {paymentMode === "cash" && <div className="h-2 w-2 rounded-full bg-slate-800 shrink-0" />}
            </button>

            <button onClick={() => handleSelectPayment("multi")}
              className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all mb-2 ${paymentMode === "multi" ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${paymentMode === "multi" ? "bg-emerald-600" : "bg-slate-200"}`}><Layers className="h-4 w-4" /></div>
              <div className="flex-1 flex flex-col text-right">
                <span className={`text-[12px] font-black ${paymentMode === "multi" ? "text-emerald-700" : "text-slate-700"}`}>متعدد (100% مطلوب)</span>
                <span className="text-[10px] text-slate-400">توزيع على عدة وسائل دفع</span>
              </div>
              {paymentMode === "multi" && <div className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />}
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
                    <span className={`text-[12px] font-black ${isSelected ? colors.text : "text-slate-700"}`}>{m.label}</span>
                    <span className={`text-[10px] ${isSelected ? colors.text : "text-slate-400"} opacity-80`}>{m.sub}</span>
                  </div>
                  {isSelected && <div className={`h-2 w-2 rounded-full ${colors.bg} shrink-0`} />}
                </button>
              );
            })}

            {paymentMode === "bank_transfer" && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">رقم الحوالة / المرجع</label>
                <input type="text" value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="مثلاً: TXN-98765" disabled={isLocked}
                  className="w-full border border-blue-300 rounded-sm bg-blue-50 px-3 py-2 text-[12px] font-bold outline-none focus:border-blue-500 font-mono disabled:cursor-not-allowed" />
              </div>
            )}
            {paymentMode === "future_due" && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">تاريخ الاستحقاق *</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={docDate} disabled={isLocked}
                  className="w-full border border-rose-300 rounded-sm bg-rose-50 px-3 py-2 text-[12px] font-bold outline-none focus:border-rose-500 disabled:cursor-not-allowed" />
              </div>
            )}
            {paymentMode === "credit" && supplier && (
              <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 font-bold">
                سيتم إضافة {totals.total.toFixed(2)} ج.م لرصيد {supplier.name}
              </div>
            )}

            {paymentMode === "multi" && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="rounded-sm bg-slate-950 px-3 py-2 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">المطلوب توزيعه</p>
                  <p className="font-mono text-[16px] font-black text-white">{totals.total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</p>
                </div>
                {paymentMethods.map(m => {
                  const amount = multiAmounts[m.id] || "";
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white p-2 hover:border-slate-400 transition-colors">
                      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-slate-50 text-slate-500 shrink-0">
                        {m.type === "cash" ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                      </div>
                      <span className="flex-1 text-[11px] font-black text-slate-800 truncate">{m.name}</span>
                      <input type="number" value={amount} placeholder="0.00" min="0" step="0.01" disabled={isLocked}
                        onChange={(e) => setMultiAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        className="w-24 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-right font-mono text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 disabled:cursor-not-allowed" />
                    </div>
                  );
                })}
                {paymentMethods.length === 0 && (
                  <p className="text-[11px] font-bold text-slate-400 text-center py-2">
                    لا توجد وسائل دفع — <Link to="/operations/payment-methods" className="text-slate-600 underline">أضف وسائل دفع</Link>
                  </p>
                )}
                <div className={`flex items-center justify-between rounded-sm px-3 py-2 text-[12px] font-black ${multiBalanced ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
                  <span>الموزع:</span>
                  <span className="font-mono">{multiTotal.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</span>
                </div>
                {!multiBalanced && totals.total > 0 && (
                  <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    الفرق: {Math.abs(totals.total - multiTotal).toFixed(2)} ج.م
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* New Supplier Modal */}
      <Modal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="إضافة مورد جديد">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">اسم المورد / الشركة *</label>
            <input value={supplierDraft.name} onChange={(e) => setSupplierDraft(s => ({ ...s, name: e.target.value }))} placeholder="مثلاً: شركة التوريدات..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">رقم الهاتف</label>
            <input value={supplierDraft.phone} onChange={(e) => setSupplierDraft(s => ({ ...s, phone: e.target.value }))} placeholder="01..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">العنوان</label>
            <input value={supplierDraft.address} onChange={(e) => setSupplierDraft(s => ({ ...s, address: e.target.value }))} placeholder="المدينة، المنطقة..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button onClick={() => setSupplierModalOpen(false)} className="rounded-sm border border-slate-300 px-4 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50">إلغاء</button>
            <button onClick={createSupplier} className="rounded-sm bg-emerald-600 px-6 py-2 text-[13px] font-black text-white hover:bg-emerald-700">إنشاء وتحديد</button>
          </div>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="معاينة صورة الصنف">
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

      {/* Save Confirmation Modal */}
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title={isEditMode ? "تأكيد تعديل الفاتورة" : "تأكيد حفظ الفاتورة"}>
        <div className="p-4 space-y-4 animate-modal-enter">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">
                {isEditMode ? "هل تريد حفظ التعديلات؟" : "هل تريد حفظ هذه الفاتورة؟"}
              </h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                {isEditMode
                  ? "سيتم تحديث المخزون والأرصدة المالية بالفرق فقط."
                  : `${lines.length} صنف — إجمالي ${totals.total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م`}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setSaveConfirmOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
            <button onClick={doSave} disabled={isSaving} className="rounded-sm bg-emerald-600 px-5 py-2 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : "نعم، احفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Unlock Warning Modal */}
      <Modal open={editWarnOpen} onClose={() => setEditWarnOpen(false)} title="تحذير: تعديل فاتورة محفوظة">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">تعديل فاتورة محفوظة</h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                أي تغيير ستقوم بحفظه سيؤثر على المخزون والأرصدة المالية. هل تريد المتابعة؟
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setEditWarnOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50">تراجع</button>
            <button onClick={() => { setLocked(false); setEditWarnOpen(false); }} className="rounded-sm bg-indigo-600 px-5 py-2 text-[13px] font-black text-white hover:bg-indigo-700">
              نعم، فتح للتعديل
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={isEditMode ? "حذف الفاتورة" : "مسح الفاتورة"}>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">
                {isEditMode ? "هل تريد حذف هذه الفاتورة؟" : "هل تريد مسح الفاتورة الحالية؟"}
              </h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                {isEditMode
                  ? "سيتم عكس جميع تأثيرات المخزون والأرصدة. لا يمكن التراجع عن هذا."
                  : "سيتم مسح جميع الأصناف المدرجة والانتقال للقائمة."}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setDeleteConfirmOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50">تراجع</button>
            <button onClick={doDelete} className="rounded-sm bg-rose-600 px-5 py-2 text-[13px] font-black text-white hover:bg-rose-700">
              {isEditMode ? "نعم، احذف الفاتورة" : "نعم، امسح"}
            </button>
          </div>
        </div>
      </Modal>

      {/* New Invoice Warning Modal */}
      <Modal open={newInvoiceModalOpen} onClose={() => setNewInvoiceModalOpen(false)} title="فاتورة جديدة">
        <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
          {lines.length > 0 ? (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-black text-amber-800">يوجد أصناف في الفاتورة الحالية</p>
                  <p className="text-[12px] font-bold text-amber-700 mt-1">اختر كيف تريد المتابعة:</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    doSave();
                  }}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><Sparkles className="h-4 w-4" /> حفظ الحالية وإنشاء جديدة</>}
                </button>
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    clearForm();
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-black text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
                >
                  <Trash2 className="h-4 w-4" />
                  تجاهل وإنشاء جديدة
                </button>
                <button
                  onClick={() => setNewInvoiceModalOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
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
                  <p className="text-[13px] font-black text-emerald-800">إنشاء فاتورة جديدة</p>
                  <p className="text-[12px] font-bold text-emerald-700 mt-1">الفاتورة الحالية فارغة</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    clearForm();
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-[13px] font-black text-white hover:bg-emerald-700 transition-all active:scale-[0.98]"
                >
                  <FilePlus className="h-4 w-4" />
                  إنشاء فاتورة جديدة
                </button>
                <button
                  onClick={() => setNewInvoiceModalOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  إلغاء
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>



      {/* Today's Purchases Modal */}
      <Modal open={todayPurchOpen} onClose={() => setTodayPurchOpen(false)} title="مشتريات اليوم" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-4">
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-sm border border-emerald-200">
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث برقم المستند:</span>
            <input
              value={todayPurchDocSearch}
              onChange={e => setTodayPurchDocSearch(e.target.value)}
              placeholder="PUR-0001..."
              className="flex-1 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث صنف:</span>
            <div className="relative flex-1">
              <input
                value={todayPurchItemSearch}
                onChange={e => { setTodayPurchItemSearch(e.target.value); setTodayPurchItemLookupOpen(true); }}
                onFocus={() => setTodayPurchItemLookupOpen(true)}
                onBlur={() => setTimeout(() => setTodayPurchItemLookupOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setTodayPurchActiveItemIndex(i => Math.min(i + 1, todayPurchFilteredItems.length - 1)); setTodayPurchItemLookupOpen(true); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setTodayPurchActiveItemIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (todayPurchFilteredItems.length > 0 && todayPurchActiveItemIndex >= 0) { const picked = todayPurchFilteredItems[todayPurchActiveItemIndex]; setTodayPurchItemSearch(picked.code || picked.barcode || picked.name); setTodayPurchItemLookupOpen(false); } }
                  else if (e.key === "Escape") { setTodayPurchItemLookupOpen(false); }
                }}
                placeholder="اسم الصنف أو الكود..."
                className="w-full rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {todayPurchItemLookupOpen && (
                <LookupList items={todayPurchFilteredItems} onPick={(item) => { setTodayPurchItemSearch(item.code || item.barcode || item.name); setTodayPurchItemLookupOpen(false); }}
                  activeIndex={todayPurchActiveItemIndex} query={todayPurchItemSearch} />
              )}
            </div>
            <button onClick={() => { setTodayPurchDocSearch(""); setTodayPurchItemSearch(""); setTodayPurchItemLookupOpen(false); }} className="flex items-center gap-1.5 rounded-sm bg-emerald-200 px-3 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-300">
              مسح
            </button>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">من</label>
              <input type="date" value={todayPurchDateFrom} onChange={(e) => setTodayPurchDateFrom(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">إلى</label>
              <input type="date" value={todayPurchDateTo} onChange={(e) => setTodayPurchDateTo(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">ترتيب</label>
              <select value={todayPurchSort} onChange={(e) => setTodayPurchSort(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="doc_no">رقم المستند</option>
                <option value="payment_method">طريقة الدفع</option>
              </select>
              <button onClick={() => setTodayPurchDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-emerald-200 bg-white hover:bg-emerald-100 transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-emerald-600" />
              </button>
            </div>
            {todayPurchUsersList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">المستخدم</label>
                <select value={todayPurchUserId} onChange={(e) => setTodayPurchUserId(e.target.value)}
                  className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">الكل</option>
                  {todayPurchUsersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            {/* Supplier filter */}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">المورد</label>
              <input
                type="text"
                value={todayPurchSupplierQuery}
                onChange={(e) => { setTodayPurchSupplierQuery(e.target.value); setTodayPurchSupplierLookupOpen(true); setTodayPurchActiveSupplierIndex(0); if (!e.target.value) { setTodayPurchSupplierId(""); } }}
                onFocus={() => setTodayPurchSupplierLookupOpen(true)}
                onBlur={() => setTimeout(() => setTodayPurchSupplierLookupOpen(false), 200)}
                onKeyDown={(e) => {
                  if (!todayPurchSupplierLookupOpen && e.key === "ArrowDown") { setTodayPurchSupplierLookupOpen(true); return; }
                  if (todayPurchSupplierLookupOpen && todayPurchFilteredSuppliers.length && e.key === "ArrowDown") { e.preventDefault(); setTodayPurchActiveSupplierIndex((v) => Math.min(v + 1, todayPurchFilteredSuppliers.length - 1)); return; }
                  if (todayPurchSupplierLookupOpen && todayPurchFilteredSuppliers.length && e.key === "ArrowUp") { e.preventDefault(); setTodayPurchActiveSupplierIndex((v) => Math.max(v - 1, 0)); return; }
                  if (todayPurchSupplierLookupOpen && todayPurchFilteredSuppliers.length && e.key === "Enter") {
                    e.preventDefault();
                    const next = todayPurchFilteredSuppliers[todayPurchActiveSupplierIndex] || todayPurchFilteredSuppliers[0];
                    setTodayPurchSupplierQuery(next.name);
                    setTodayPurchSupplierId(next.id);
                    setTodayPurchSupplierLookupOpen(false);
                    return;
                  }
                  if (e.key === "Escape") { setTodayPurchSupplierLookupOpen(false); }
                }}
                placeholder="كل الموردين..."
                className="w-[140px] rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {todayPurchSupplierQuery && (
                <button onClick={() => { setTodayPurchSupplierQuery(""); setTodayPurchSupplierId(""); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {todayPurchSupplierLookupOpen && (
                <LookupList
                  items={todayPurchFilteredSuppliers}
                  onPick={(s) => { setTodayPurchSupplierQuery(s.name); setTodayPurchSupplierId(s.id); setTodayPurchSupplierLookupOpen(false); }}
                  activeIndex={todayPurchActiveSupplierIndex}
                  query={todayPurchSupplierQuery}
                  emptyLabel="لا توجد نتائج"
                />
              )}
            </div>
            <button onClick={loadTodayPurchases}
              className="flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${todayPurchLoading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>

          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-emerald-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">عدد الفواتير</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{todayPurchSummary.count}</span>
            </div>
            <div className="h-8 w-px bg-emerald-700" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">إجمالي المشتريات</span>
              <span className="font-mono text-[20px] font-black text-emerald-300 leading-none">{formatMoney(todayPurchSummary.total)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[420px] overflow-auto rounded-sm border border-emerald-200">
            <DataGrid
              data={todayPurchLoading ? [] : (todayPurchItemSearch.trim() ? todayPurchRawItems : todayPurchases)}
              rowKey={todayPurchItemSearch.trim() ? (r, i) => `${r.id || r.item_id}-${i}` : "id"}
              emptyMessage={todayPurchLoading ? "جاري التحميل..." : "لا توجد نتائج في هذه الفترة"}
              className="border-0"
              onRowClick={r => {
                if (todayPurchItemSearch.trim()) {
                  if (r.purchase_id) { setTodayPurchPreviewInvoice({ id: r.purchase_id, purchase_id: r.purchase_id, doc_no: r.doc_no, supplier_name: r.supplier_name, total: Number(r.unit_cost) * Number(r.quantity), created_at: r.created_at }); setTodayPurchPreviewOpen(true); }
                } else {
                  setTodayPurchPreviewInvoice(r); setTodayPurchPreviewOpen(true);
                }
              }}
              columns={todayPurchItemSearch.trim() ? [
                { id: "item_code", header: "كود الصنف", width: 110, cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.item_code || "—" },
                { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (r) => r.item_name || "—" },
                { id: "doc_no", header: "المستند", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
                { id: "supplier_name", header: "المورد", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.supplier_name || "—" },
                { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center font-mono text-[12px] font-bold text-slate-600", render: (r) => Number(r.quantity) },
                { id: "unit_cost", header: "التكلفة", width: 100, cellClass: "px-3 font-mono text-[12px] font-black text-slate-700", render: (r) => formatMoney(r.unit_cost) },
                { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 font-mono text-[13px] font-black text-emerald-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_cost) * Number(r.quantity))) },
                { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
                { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${r.purchase_id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح الفاتورة"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              ] : [
                { id: "doc_no", header: "رقم المستند", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[12px] font-black text-slate-700", render: (inv) => inv.doc_no },
                { id: "supplier_name", header: "المورد", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (inv) => inv.supplier_name || "—" },
                { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-[12px] font-bold text-slate-600", render: (inv) => inv.items_count },
                { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[13px] font-black text-emerald-700", render: (inv) => formatMoney(inv.total) },
                { id: "payment_method", header: "طريقة الدفع", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[12px] font-bold text-slate-600", render: (inv) => PAYMENT_METHOD_LABELS[inv.payment_method] || inv.payment_method || "—" },
                { id: "status", header: "الحالة", width: 100, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (inv) => {
                  const info = PURCHASE_STATUS_STYLES[inv.status] || PURCHASE_STATUS_STYLES.active;
                  return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span>;
                }},
                { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (inv) => inv.created_by_username || "—" },
                { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (inv) => formatArabicDateTime(new Date(inv.created_at)) },
                { id: "actions", header: "", width: 90, headerClass: "px-3", cellClass: "px-3", render: (inv) => (
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/purchases/${inv.id}`)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح الفاتورة"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setTodayPurchVoidTarget(inv); setTodayPurchVoidOpen(true); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* Purchase Preview Modal */}
      <Modal open={todayPurchPreviewOpen} onClose={() => setTodayPurchPreviewOpen(false)} title="معاينة الفاتورة">
        {todayPurchPreviewInvoice ? <PurchasePreviewModal purchase={todayPurchPreviewInvoice} onClose={() => setTodayPurchPreviewOpen(false)} /> : null}
      </Modal>

      {/* Void Confirmation */}
      <ConfirmDialog
        open={todayPurchVoidOpen}
        title={`إلغاء الفاتورة ${todayPurchVoidTarget?.doc_no || ""}`}
        message={`إلغاء الفاتورة ${todayPurchVoidTarget?.doc_no || ""}؟ سيتم عكس التأثير على المخزون والأرصدة.`}
        onConfirm={async () => {
          if (!todayPurchVoidTarget) return;
          try {
            await api.post(`/api/purchases/${todayPurchVoidTarget.id}/void`);
            toast.success("تم إلغاء الفاتورة");
            setTodayPurchVoidOpen(false);
            setTodayPurchVoidTarget(null);
            loadTodayPurchases();
          } catch (e) { toast.error(e.response?.data?.message || "خطأ"); setTodayPurchVoidOpen(false); }
        }}
        onCancel={() => { setTodayPurchVoidOpen(false); setTodayPurchVoidTarget(null); }}
      />

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="purchase_order"
        invoice={{
          invoice_no: refNo,
          created_at: docDate,
          supplier_name: supplier?.name,
          lines: lines.map(l => ({
            item_name: l.name,
            quantity: l.quantity,
            unit_price: l.unit_cost,
            discount_amount: 0,
          })),
        }}
        settings={printSettings}
        operationLabel="فاتورة مشتريات"
        onConfirmPrint={() => doSave()}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={() => doSave()}
        saveOnlyLabel="حفظ فقط"
        isSaving={isSaving}
      />
    </div>
  );
}
