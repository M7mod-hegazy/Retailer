import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, ShoppingCart, Trash2, User, Package, Calendar, FileText,
  Warehouse, ChevronDown, ArrowLeft, X, CreditCard, Wallet, Banknote,
  AlertTriangle, Clock, ExternalLink, TrendingUp, Building2, Phone,
  ImageIcon, Printer, CheckCircle2, Layers, Lock, Pencil,
  FilePlus, Sparkles, Receipt, RefreshCw, ArrowUpDown, Save,
  Loader2, Filter,
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import toast from "react-hot-toast";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { scoredFilterRows } from "../../utils/search";
import { useAuthStore } from "../../stores/authStore";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import { usePageTour } from "../../hooks/usePageTour";
import AddSupplierModal from "../../components/modals/AddSupplierModal";
import SupplierInfoModal from "../../components/modals/SupplierInfoModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import PurchaseProfitModal from "../../components/purchases/PurchaseProfitModal";

const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5000");
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  });
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
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
          <div className="rounded-sm bg-emerald-50 border border-emerald-200 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="font-black text-emerald-800">فاتورة #{detail?.doc_no || purchase.doc_no}</span>
            <span className="text-slate-600">المورد: <strong>{(detail || purchase).supplier_name || "—"}</strong></span>
            <span className="text-slate-500">{(detail || purchase).created_at ? formatArabicDateTime(new Date((detail || purchase).created_at)) : "—"}</span>
            {(detail || purchase).created_by_username && (
              <span className="text-slate-500">بواسطة: <strong>{(detail || purchase).created_by_username}</strong></span>
            )}
            <span className="font-bold text-emerald-700">الإجمالي: {formatMoney((detail || purchase).total)} ج.م</span>
          </div>
          <div className="max-h-[260px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">التكلفة</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">مُرتجع</th>
                </tr>
              </thead>
              <tbody>
                {((detail || purchase).lines || []).map((l, i) => {
                  const returned = Number(l.returned_quantity || 0);
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || l.code || l.barcode || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_cost)}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                      <td className="px-3 py-2.5 text-center">
                        {returned > 0 ? <span className="text-amber-600 font-black">{returned}</span> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Totals + Payments */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
              {Number((detail || purchase).discount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">خصم</span>
                  <span className="font-black font-mono text-rose-600">- {formatMoney((detail || purchase).discount)}</span>
                </div>
              )}
              {Number((detail || purchase).increase) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">إضافة</span>
                  <span className="font-black font-mono text-emerald-600">+ {formatMoney((detail || purchase).increase)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-black text-slate-800">الإجمالي</span>
                <span className="font-black font-mono text-slate-900">{formatMoney((detail || purchase).total)} ج.م</span>
              </div>
            </div>
            {detail?.payments?.length > 0 && (
              <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">تفاصيل الدفع</p>
                {detail.payments.map((p, i) => {
                  const PSTYLE = { cash: "text-emerald-700", bank_transfer: "text-sky-700", credit: "text-amber-700", future_due: "text-orange-700" };
                  return (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-slate-600">{p.method_name || p.method_type || "—"}</span>
                      <span className={`font-black font-mono ${PSTYLE[p.method_type] || "text-slate-800"}`}>{formatMoney(p.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose}
          className="rounded-sm border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
          رجوع
        </button>
        <button onClick={() => navigate(`/purchases/${purchase.purchase_id || purchase.id}`)}
          className="flex items-center gap-2 rounded-sm bg-emerald-700 px-6 py-2 text-sm font-black text-white hover:bg-emerald-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح الفاتورة
        </button>
      </div>
    </div>
  );
}

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
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
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
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", warehouseId: "", unitId: "" });
  // Lock toggles: true = update master price on save (🔒), false = this invoice only (🔓)
  const [stagingLocks, setStagingLocks] = useState({ purchase: true, sale: true, wholesale: true });
  const [profitModalOpen, setProfitModalOpen] = useState(false);
  const [profitDisplayMode, setProfitDisplayMode] = useState("pct");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);

  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankRef, setBankRef] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [multiAmounts, setMultiAmounts] = useState({});

  const [discount, setDiscount] = useState(0);
  const [increase, setIncrease] = useState(0);
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState("flat");
  const [invoiceIncreaseMode, setInvoiceIncreaseMode] = useState("flat");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const wasSaved = useRef(false);
  const originalSnap = useRef(null);
  const isDirty = (lines.length > 0 || !!supplier) && !locked && !wasSaved.current;
  const { blocker } = useUnsavedChangesGuard(isDirty);

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
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);

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
    const q = todayPurchItemSearch.trim();
    if (!q || !todayPurchAllItems.length) return [];
    return scoredFilterRows(todayPurchAllItems, q, ["name", "code", "barcode"]);
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
      setDiscount(Math.max(0, Number(p.discount || 0)));
      setIncrease(Math.max(0, Number(p.increase || 0)));
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
        code: l.code || l.barcode || "",
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

  useEffect(() => {
    if (!selectedItem) setStaging(s => ({ ...s, warehouseId: defaultWarehouseId }));
  }, [defaultWarehouseId]);

  const ITEM_PAGE = 20;

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
        const rows = (r.data.data || []).map(i => ({
          ...i,
          price_label: formatMoney(i.purchase_price || 0),
        }));
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [supplierQuery, suppliers]);

  function handlePickItem(item) {
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
      unitId: String(item.unit_id || prev.unitId),
    }));
    setLookupOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  }

  function handlePickSupplier(s) {
    activateInvoice();
    setSupplier(s);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
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
      }];
    });
    setSelectedItem(null);
    setItemQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", warehouseId: s.warehouseId, unitId: "" }));
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

  function getFilteredWarehouses(itemId, currentId) {
    if (!itemId) return warehouses;
    const whStock = stockLevels[itemId] || {};
    const filtered = warehouses.filter(w => (whStock[w.id] || 0) > 0);
    if (!filtered.length) return warehouses;
    if (currentId && !filtered.some(w => String(w.id) === String(currentId))) {
      const current = warehouses.find(w => String(w.id) === String(currentId));
      if (current) filtered.push(current);
    }
    return filtered;
  }

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
      payment_method: paymentMode,
      payments,
      lines: lines.map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        selling_price: l.selling_price,
        unit_price: l.selling_price,
        wholesale_price: l.wholesale_price,
        warehouse_id: l.warehouse_id || defaultWarehouseId,
        update_master_purchase_price:  l.update_master_purchase_price  !== false,
        update_master_sale_price:      l.update_master_sale_price      !== false,
        update_master_wholesale_price: l.update_master_wholesale_price !== false,
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
      toast.error(e.response?.data?.message || "فشل حفظ الفاتورة");
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
      {/* Header */}
      <DocumentHeaderBar
        accent="emerald-strong"
        onBack={() => navigate("/purchases")}
        title={isEditMode ? "فاتورة مشتريات" : "فاتورة مشتريات جديدة"}
        subtitle={isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : "إدخال مخزون جديد"}
        extras={
          <>
            {invoiceIsActive && (
              <div className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-bold border ${isLocked ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                {isLocked ? <Lock className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {isLocked ? "مقفلة" : "نشطة"}
              </div>
            )}
            {!isLocked && isEditMode && user?.name && (
              <div className="flex items-center gap-1.5 rounded-sm bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
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
              <div className="flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <TrendingUp className="h-3.5 w-3.5" />
                {priceChangedLines.length} أسعار ستتغير
              </div>
            )}
            {/* Profit analysis — special to purchases (blue) */}
            {lines.length > 0 && (
              <button onClick={() => setProfitModalOpen(true)}
                className="flex h-9 items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 hover:bg-blue-100 transition-all">
                <TrendingUp className="h-4 w-4" /> تحليل الربح
              </button>
            )}
            <DocumentActionButton variant="today" icon={Receipt} onClick={() => setTodayPurchOpen(true)}>
              مشتريات اليوم
            </DocumentActionButton>
            <PermissionGate page="purchases" action="delete">
              <DocumentActionButton variant="delete" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>
                {isEditMode ? "حذف" : "مسح"}
              </DocumentActionButton>
            </PermissionGate>
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
                <DocumentActionButton variant="ghost" icon={FilePlus} onClick={() => setNewInvoiceModalOpen(true)}>
                  جديدة
                </DocumentActionButton>
              </>
            )}
          </>
        }
      />

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: Main Content */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
          {/* Header Info Grid */}
          <section className={`rounded-md border border-slate-300 bg-white p-4 shadow-sm shrink-0 ${isLocked ? "opacity-70 pointer-events-none select-none" : ""}`}>
            {/* Supplier */}
            <div data-help="supplier-select" className="relative flex flex-col gap-1">
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
                    className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-9 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  {supplierLookupOpen && !isLocked && (
                    <SearchDropdown items={filteredSuppliers} onPick={handlePickSupplier} activeIndex={activeSupplierIndex} emptyLabel="لم يتم العثور على مورد" />
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
          </section>

          {/* Quick Entry Bar — hidden in locked mode */}
          {!isLocked && (
            <section data-help="items-section" className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
              <div className="grid grid-cols-[3fr_80px_100px_100px_100px_100px_160px_80px] gap-2 items-end">
                {/* Item search */}
                <div data-help="search-bar" className="relative flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                      <SearchInput
                        ref={itemInputRef}
                        value={itemQuery}
                        onChange={(val) => { setItemQuery(val); setLookupOpen(true); setSelectedItem(null); }}
                        onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
                        onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
                        placeholder="ابحث بالاسم، الباركود، أو الكود..."
                        inputClassName={selectedItem ? "!pr-[76px]" : ""}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); if (filteredItems.length > 0) { handlePickItem(filteredItems[activeIndex] || filteredItems[0]); } else if (itemSearchActiveRef.current) { pendingPickRef.current = true; } }
                          else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredItems.length - 1)); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); }
                        }}
                      />
                      {/* SKU code chip — sits inside the input, just before the product name */}
                      {selectedItem && (
                        <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 z-10 text-[9px] font-mono font-black text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-sm px-1.5 py-0.5 leading-none whitespace-nowrap">
                          {selectedItem.code || selectedItem.barcode || "—"}
                        </span>
                      )}
                      {lookupOpen && <SearchDropdown items={filteredItems} onPick={handlePickItem} activeIndex={activeIndex} query={itemQuery} onLoadMore={loadMoreItems} hasMoreFromServer={itemHasMore} isLoadingMore={isLoadingMoreItems} />}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdvancedSearchOpen(true)}
                      className="flex h-[37px] w-[37px] shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      title="بحث متقدم في المخزون"
                    >
                      <Filter className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Qty */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الكمية</label>
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
                    onKeyDown={(e) => handleFieldKeyDown(e, costInputRef, itemInputRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-2sm font-black text-slate-800 outline-none focus:border-slate-800 text-center" />
                </div>

                {/* Unit */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                  <div className="flex h-[37px] items-center justify-center border border-slate-200 rounded-sm bg-slate-50 px-2">
                    <span className="text-2sm font-bold text-slate-600 truncate">
                      {selectedItem && staging.unitId
                        ? (units.find(u => String(u.id) === String(staging.unitId))?.name || "أساسية")
                        : "أساسية"}
                    </span>
                  </div>
                </div>

                {/* Cost (with lock toggle) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600">التكلفة</label>
                    <button type="button"
                      onClick={() => setStagingLocks(l => ({ ...l, purchase: !l.purchase }))}
                      title={stagingLocks.purchase ? "يحدّث السعر الرئيسي عند الحفظ — اضغط لإلغاء" : "هذه الفاتورة فقط — اضغط للتحديث"}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                        stagingLocks.purchase
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-amber-100 text-amber-700 border border-amber-300"
                      }`}>
                      {stagingLocks.purchase ? <Lock size={9} /> : <Lock size={9} className="opacity-50" />}
                      {stagingLocks.purchase ? "يحدّث" : "للفاتورة"}
                    </button>
                  </div>
                  <input ref={costInputRef} type="number" step="any" value={staging.unitCost}
                    onChange={(e) => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, sellInputRef, qtyInputRef)}
                    className={`w-full h-[37px] border rounded-sm py-2 px-2 text-2sm font-black text-slate-800 outline-none focus:border-slate-800 text-center ${
                      !stagingLocks.purchase ? "border-amber-300 bg-amber-50/60"
                      : selectedItem && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && Number(staging.unitCost) > 0
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-300 bg-slate-50"
                    }`} />
                  {/* Cost before→after badge (parity with selling/wholesale) */}
                  {selectedItem && Number(staging.unitCost) > 0 && Number(selectedItem.purchase_price) > 0 && Number(staging.unitCost) !== Number(selectedItem.purchase_price) && (
                    <span className="text-[9px] text-center leading-tight">
                      <span className="text-slate-400 font-mono">{Number(selectedItem.purchase_price).toFixed(2)}</span>
                      <span className="text-slate-300 mx-1">→</span>
                      <span className={`font-mono font-black ${Number(staging.unitCost) > Number(selectedItem.purchase_price) ? "text-rose-500" : "text-emerald-600"}`}>
                        {Number(staging.unitCost).toFixed(2)}
                      </span>
                      <span className="text-slate-400 mr-1">
                        ({(((Number(staging.unitCost) - Number(selectedItem.purchase_price)) / Number(selectedItem.purchase_price)) * 100).toFixed(1)}%)
                      </span>
                    </span>
                  )}
                  {/* آخر شراء hint */}
                  {selectedItem && Number(selectedItem.last_purchase_cost || selectedItem.purchase_price || 0) > 0 && (
                    <span className="text-[9px] text-slate-400 text-center leading-tight">
                      آخر شراء: <span className="font-mono font-black text-slate-500">
                        {Number(selectedItem.last_purchase_cost || selectedItem.purchase_price || 0).toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>

                {/* Selling price (مستهلك — with lock toggle) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      مستهلك
                    </label>
                    <button type="button"
                      onClick={() => setStagingLocks(l => ({ ...l, sale: !l.sale }))}
                      title={stagingLocks.sale ? "يحدّث السعر الرئيسي — اضغط لإلغاء" : "للفاتورة فقط — اضغط للتحديث"}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                        stagingLocks.sale
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-amber-100 text-amber-700 border border-amber-300"
                      }`}>
                      {stagingLocks.sale ? <Lock size={9} /> : <Lock size={9} className="opacity-50" />}
                      {stagingLocks.sale ? "يحدّث" : "للفاتورة"}
                    </button>
                  </div>
                  <input ref={sellInputRef} type="number" step="any" value={staging.sellingPrice}
                    onChange={(e) => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, wholesaleInputRef, costInputRef)}
                    className={`w-full h-[37px] border rounded-sm py-2 px-2 text-2sm font-black text-slate-800 outline-none focus:border-slate-800 text-center ${
                      !stagingLocks.sale ? "border-amber-300 bg-amber-50/60"
                      : selectedItem && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && Number(staging.sellingPrice) > 0
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-300 bg-slate-50"
                    }`} />
                  {/* Before→after badge */}
                  {selectedItem && Number(staging.sellingPrice) > 0 && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && (
                    <span className="text-[9px] text-center leading-tight">
                      <span className="text-slate-400 font-mono">{Number(selectedItem.sale_price || 0).toFixed(2)}</span>
                      <span className="text-slate-300 mx-1">→</span>
                      <span className={`font-mono font-black ${Number(staging.sellingPrice) > Number(selectedItem.sale_price) ? "text-rose-500" : "text-emerald-600"}`}>
                        {Number(staging.sellingPrice).toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>

                {/* Wholesale price (جملة — with lock toggle) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      جملة
                    </label>
                    <button type="button"
                      onClick={() => setStagingLocks(l => ({ ...l, wholesale: !l.wholesale }))}
                      title={stagingLocks.wholesale ? "يحدّث السعر الرئيسي — اضغط لإلغاء" : "للفاتورة فقط — اضغط للتحديث"}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                        stagingLocks.wholesale
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-amber-100 text-amber-700 border border-amber-300"
                      }`}>
                      {stagingLocks.wholesale ? <Lock size={9} /> : <Lock size={9} className="opacity-50" />}
                      {stagingLocks.wholesale ? "يحدّث" : "للفاتورة"}
                    </button>
                  </div>
                  <input ref={wholesaleInputRef} type="number" step="any" value={staging.wholesalePrice}
                    onChange={(e) => setStaging(s => ({ ...s, wholesalePrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); warehouseTableRef.current?.focus(); } else if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); sellInputRef.current?.focus(); sellInputRef.current?.select(); } }}
                    className={`w-full h-[37px] border rounded-sm py-2 px-2 text-2sm font-black text-slate-800 outline-none focus:border-slate-800 text-center ${
                      !stagingLocks.wholesale ? "border-amber-300 bg-amber-50/60"
                      : selectedItem && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && Number(staging.wholesalePrice) > 0
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-300 bg-slate-50"
                    }`} />
                  {/* Before→after badge */}
                  {selectedItem && Number(staging.wholesalePrice) > 0 && Number(staging.wholesalePrice) !== Number(selectedItem.wholesale_price) && (
                    <span className="text-[9px] text-center leading-tight">
                      <span className="text-slate-400 font-mono">{Number(selectedItem.wholesale_price || 0).toFixed(2)}</span>
                      <span className="text-slate-300 mx-1">→</span>
                      <span className={`font-mono font-black ${Number(staging.wholesalePrice) > Number(selectedItem.wholesale_price) ? "text-rose-500" : "text-emerald-600"}`}>
                        {Number(staging.wholesalePrice).toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>

                {/* Warehouse table */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">المخزن</label>
                  <div ref={warehouseTableRef} tabIndex={0}
                    className="border border-slate-300 rounded-sm bg-slate-50 overflow-y-auto outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                    style={{height:"75px"}}
                    onKeyDown={(e) => {
                      const idx = warehouses.findIndex(w => String(w.id) === String(staging.warehouseId));
                      if (e.key === "ArrowDown") { e.preventDefault(); const next = warehouses[Math.min(idx + 1, warehouses.length - 1)]; if (next) setStaging(s => ({ ...s, warehouseId: String(next.id) })); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); const prev = warehouses[Math.max(idx - 1, 0)]; if (prev) setStaging(s => ({ ...s, warehouseId: String(prev.id) })); }
                      else if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); wholesaleInputRef.current?.focus(); wholesaleInputRef.current?.select(); }
                      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); addBtnRef.current?.focus(); }
                    }}>
                    <table className="w-full text-[11px] border-collapse">
                      <tbody>
                        {(selectedItem ? getFilteredWarehouses(selectedItem.id, staging.warehouseId) : warehouses).map(w => {
                          const dbQty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : 0;
                          const inLines = selectedItem ? lines.filter(l => l.item_id === selectedItem.id && String(l.warehouse_id) === String(w.id)).reduce((s, l) => s + Number(l.quantity), 0) : 0;
                          const qty = dbQty + inLines;
                          const isSelected = String(staging.warehouseId) === String(w.id);
                          const hasStock = qty > 0;
                          return (
                            <tr key={w.id} onClick={() => { setStaging(s => ({ ...s, warehouseId: String(w.id) })); warehouseTableRef.current?.focus(); }}
                              className={`cursor-pointer border-b border-slate-200 last:border-0 transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-100"} ${!hasStock && !isSelected ? "opacity-40" : ""}`}>
                              <td className={`px-2 py-1 font-bold truncate ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{w.name}</td>
                              <td className={`px-2 py-1 font-mono text-center tabular-nums ${hasStock ? "text-emerald-600 font-black" : "text-slate-400"}`}>{qty}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Add button */}
                <button ref={addBtnRef} onClick={addLine}
                  onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addLine(); } }}
                  disabled={!selectedItem}
                  className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-emerald-600 px-4 text-2sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 self-end transition-all shadow-sm">
                  <Plus className="h-4 w-4" /> إضافة
                </button>
              </div>
            </section>
          )}

          {/* Lines DataGrid */}
          <DataGrid
            data-help="main-table"
            data={lines}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف في الفاتورة بعد"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-300 min-h-0 animate-fade-in"
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
                    <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                    <span className="truncate">{l.name}</span>
                  </div>
                )
              },
              { id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const u = units.find(u => String(u.id) === String(l.unit_id));
                  const isInt = u?.allow_decimal === 0;
                  return (
                    <input
                      type="number" min="1" step={isInt ? "1" : "any"}
                      value={l.quantity} disabled={isLocked}
                      onChange={(e) => {
                        const v = isInt ? Math.max(1, Math.round(Number(e.target.value) || 1)) : Math.max(0.001, Number(e.target.value) || 0.001);
                        updateLineField(i, "quantity", v);
                      }}
                      className="w-full h-[40px] text-center text-sm font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 transition-colors disabled:cursor-not-allowed"
                    />
                  );
                } },
              { id: "unit_id", header: "الوحدة", width: 85, sortable: false, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l, i) => {
                  const unitName = l.unit_id ? (units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية") : "أساسية";
                  return <UnitCell unitName={unitName} />;
                } },
              { id: "unit_cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const costChanged = Number(l.unit_cost) !== Number(l.original_unit_cost) && Number(l.unit_cost) > 0 && Number(l.original_unit_cost) > 0;
                  return (
                    <div className="relative w-full h-full flex flex-col">
                      <input type="number" step="any" value={l.unit_cost} disabled={isLocked} onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))}
                        className={`w-full h-[32px] text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${costChanged ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`} />
                      {costChanged && (
                        <span className="text-[9px] text-center leading-none pb-0.5">
                          <span className="text-slate-400 font-mono">{Number(l.original_unit_cost).toFixed(2)}</span>
                          <span className="text-slate-300 mx-0.5">→</span>
                          <span className={`font-mono font-black ${Number(l.unit_cost) > Number(l.original_unit_cost) ? "text-rose-500" : "text-emerald-600"}`}>
                            {Number(l.unit_cost).toFixed(2)}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                } },
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
                        className={`w-full h-[32px] text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${belowMargin ? "bg-rose-50 text-rose-800" : changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50"}`} />
                      {changed && !belowMargin && <span title={`السعر الحالي: ${l.original_sale_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />}
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
                      <span className={`text-2sm font-mono font-black ${isProfit ? "text-emerald-700" : "text-rose-600"}`}>
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
                  const changed = Number(l.wholesale_price) !== Number(l.original_wholesale_price) && Number(l.wholesale_price) > 0;
                  return (
                    <div className="relative w-full h-full">
                      <input type="number" step="any" value={l.wholesale_price ?? 0} disabled={isLocked}
                        onChange={(e) => updateLineField(i, "wholesale_price", Number(e.target.value))}
                        className={`w-full h-[40px] text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${changed ? "bg-amber-50 text-amber-800" : "bg-transparent focus:bg-emerald-50/50 text-slate-700"}`} />
                      {changed && <span title={`السعر الحالي: ${l.original_wholesale_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />}
                    </div>
                  );
                }
              },
              {
                id: "locks", header: "قفل", width: 80, sortable: false, headerClass: "text-center px-1", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  if (isLocked) return null;
                  const mk = (field, label, lockKey) => {
                    const on = l[lockKey] !== false;
                    return (
                      <button
                        title={on ? `${label}: يحدّث السعر الرئيسي` : `${label}: للفاتورة فقط`}
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
                      {mk("cost", "ش", "update_master_purchase_price")}
                      {mk("sell", "ب", "update_master_sale_price")}
                      {mk("whole", "ج", "update_master_wholesale_price")}
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
                        {getFilteredWarehouses(l.item_id, l.warehouse_id).map(w => {
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
              { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-center px-2", cellClass: "text-center px-2 font-black font-mono text-sm text-slate-900 bg-slate-50/50 border-l border-slate-100",
                render: (l) => Number(l.total).toLocaleString("en-US", { minimumFractionDigits: 2 }) },
              { id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center",
                render: (_, i) => !isLocked && <button onClick={() => removeLine(i)} className="inline-flex h-[40px] w-full items-center justify-center text-slate-400 opacity-60 hover:bg-slate-100 hover:text-rose-500 hover:opacity-100 transition-colors focus:outline-none"><X className="h-4 w-4" /></button> },
            ]}
          />

          {priceChangedLines.length > 0 && !isLocked && (
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-700 font-bold shrink-0 mt-2 border border-amber-200 rounded-md">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              سيتم تحديث الأسعار لـ {priceChangedLines.map(l => l.name).join("، ")}
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
                <div className="flex items-center gap-2">
                  <button onClick={() => setSupplierInfoOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-700 transition-colors"><ExternalLink className="h-3 w-3" /> بيانات المورد</button>
                  <Link to={`/suppliers/${supplier.id}`} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700"><ExternalLink className="h-3 w-3" /> السجل</Link>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-sm font-black">{supplier.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{supplier.name}</p>
                  {supplier.phone && <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
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
                        <div className="mt-2 flex items-center justify-between rounded-sm bg-slate-50 border border-slate-200 px-3 py-1.5">
                          <span className="text-[11px] font-bold text-slate-500">{isEditMode ? "الرصيد قبل التعديل" : "الرصيد الحالي"}</span>
                          <span className={`text-sm font-black font-mono ${dispBal > 0 ? "text-rose-600" : "text-slate-800"}`}>{dispBal.toFixed(2)}</span>
                        </div>
                        {hasLines && balChange !== 0 && (
                          <div className="mt-1 flex items-center justify-between rounded-sm bg-indigo-50 border border-indigo-200 px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-bold text-indigo-600">التغير</span>
                              <span className={`text-[9px] font-black font-mono px-1 py-0.5 rounded-sm ${balChange > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {balChange > 0 ? `↑` : `↓`}
                              </span>
                            </div>
                            <span className={`text-2sm font-black font-mono ${balChange > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {balChange > 0 ? "+" : ""}{balChange.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {hasLines && (
                          <div className="mt-1.5 flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-3 py-1.5">
                            <span className="text-[11px] font-bold text-amber-600">الرصيد بعد الفاتورة</span>
                            <span className={`text-sm font-black font-mono ${newBal > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {newBal.toFixed(2)}
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
                <span className="text-sm font-black text-slate-800 font-mono">{totals.sub.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {/* Discount */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600">خصم الفاتورة</span>
                <span className="text-2sm font-black font-mono text-rose-600">{discount > 0 ? `-${discount.toFixed(2)}` : "0"}</span>
              </div>
              {/* Increase */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600">إضافة / رسوم</span>
                <span className="text-2sm font-black font-mono text-blue-600">{increase > 0 ? `+${increase.toFixed(2)}` : "0"}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="mt-3 rounded-sm bg-emerald-800 p-4 text-center text-white">
                <div className="text-[11px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                <div className="text-[26px] font-black tracking-tighter font-mono">
                  {totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                    <span className="text-[11px] font-mono text-rose-400 px-1">{((discount / totals.sub) * 100).toFixed(1)}% من الإجمالي</span>
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
          <div data-help="payment-section" className={`rounded-md border border-slate-300 bg-white p-4 shadow-sm ${isLocked ? "opacity-70 pointer-events-none select-none" : ""}`}>
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
              className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all mb-2 ${paymentMode === "multi" ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${paymentMode === "multi" ? "bg-emerald-600" : "bg-slate-200"}`}><Layers className="h-4 w-4" /></div>
              <div className="flex-1 flex flex-col text-right">
                <span className={`text-2sm font-black ${paymentMode === "multi" ? "text-emerald-700" : "text-slate-700"}`}>متعدد (100% مطلوب)</span>
                <span className="text-[11px] text-slate-400">توزيع على عدة وسائل دفع</span>
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
                  <p className="font-mono text-[16px] font-black text-white">{totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                </div>
                {paymentMethods.map(m => {
                  const amount = multiAmounts[m.id] || "";
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-slate-50 text-slate-500 shrink-0">
                        {m.type === "cash" ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                      </div>
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-700 leading-snug break-words">{m.name}</span>
                      <input type="number" value={amount} placeholder="0.00" min="0" step="0.01" disabled={isLocked}
                        onChange={(e) => setMultiAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        className="w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-2sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all" />
                    </div>
                  );
                })}
                {paymentMethods.length === 0 && (
                  <p className="text-[11px] font-bold text-slate-400 text-center py-2">
                    لا توجد وسائل دفع — <Link to="/operations/payment-methods" className="text-slate-600 underline">أضف وسائل دفع</Link>
                  </p>
                )}
                <div className={`flex items-center justify-between rounded-sm px-3 py-2 text-2sm font-black ${multiBalanced ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
                  <span>الموزع:</span>
                  <span className="font-mono">{multiTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
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
                  <span className="font-mono font-black text-amber-700">+{formatMoney(creditEffect)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] border-t border-amber-200/70 pt-1.5">
                  <span className="font-bold text-slate-600">الرصيد بعد الفاتورة</span>
                  <span className={`font-mono font-black ${supplierBalanceAfter > 0.005 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatMoney(supplierBalanceAfter)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Buttons */}
          {!isLocked && (
            <div className="rounded-md border border-slate-300 bg-white p-3 shadow-sm flex flex-col gap-2">
              <PermissionGate page="purchases" action={isEditMode || isAmendMode ? "edit" : "add"}>
                <button onClick={() => { if (validateBeforeSave()) { if (priceChangedLines.length > 0) setPriceReportOpen(true); else setSaveConfirmOpen(true); } }} disabled={isSaving || !lines.length || (isEditMode && !isAmendMode && !isEditDirty)}
                  className="w-full flex items-center justify-center gap-2 rounded-sm bg-emerald-600 px-3 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all disabled:opacity-40 shadow-sm active:scale-[0.98]">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isAmendMode ? <><Save className="h-4 w-4" /> إصدار تعديل</> : isEditMode ? <><Save className="h-4 w-4" /> حفظ التعديلات</> : <><Save className="h-4 w-4" /> حفظ الفاتورة</>}
                </button>
              </PermissionGate>
              <div className="grid grid-cols-3 gap-2">
                <PermissionGate page="purchases" action="print">
                  <button onClick={() => setPrintPreview(true)} disabled={!lines.length}
                    className="flex items-center justify-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-slate-50 transition-all disabled:opacity-40">
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
                  className="flex items-center justify-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all">
                  <FilePlus className="h-3.5 w-3.5" /> جديدة
                </button>
              </div>
            </div>
          )}
        </aside>
      </main>

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

      {/* Price Update Report Modal */}
      <Modal open={priceReportOpen} onClose={() => setPriceReportOpen(false)} title="تقرير تحديث الأسعار" maxWidth={priceReportWholesaleUsed ? "max-w-4xl" : "max-w-3xl"}>
        <div className="p-4 space-y-4 animate-modal-enter">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-2sm font-bold text-amber-700 leading-relaxed">
              سيتم تحديث الأسعار التالية عند حفظ الفاتورة. راجع التغييرات قبل المتابعة.
            </p>
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
                    <td className="px-3 py-2 text-center font-mono text-slate-400 whitespace-nowrap">{Number(l.original_unit_cost) > 0 ? Number(l.original_unit_cost).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center font-mono font-black whitespace-nowrap">
                      {Number(l.unit_cost) > 0 && Number(l.unit_cost) !== Number(l.original_unit_cost) ? (
                        <span className={Number(l.unit_cost) > Number(l.original_unit_cost) ? "text-rose-600" : "text-emerald-600"}>
                          {Number(l.unit_cost).toFixed(2)}
                        </span>
                      ) : <span className="text-slate-400">{Number(l.unit_cost) > 0 ? Number(l.unit_cost).toFixed(2) : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-slate-400 whitespace-nowrap">{Number(l.original_sale_price) > 0 ? Number(l.original_sale_price).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center font-mono font-black whitespace-nowrap">
                      {Number(l.selling_price) > 0 && Number(l.selling_price) !== Number(l.original_sale_price) ? (
                        <span className={Number(l.selling_price) > Number(l.original_sale_price) ? "text-rose-600" : "text-emerald-600"}>
                          {Number(l.selling_price).toFixed(2)}
                        </span>
                      ) : <span className="text-slate-400">{Number(l.selling_price) > 0 ? Number(l.selling_price).toFixed(2) : "—"}</span>}
                    </td>
                    {priceReportWholesaleUsed && (
                      <>
                        <td className="px-3 py-2 text-center font-mono text-slate-400 whitespace-nowrap">{Number(l.original_wholesale_price) > 0 ? Number(l.original_wholesale_price).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-center font-mono font-black whitespace-nowrap">
                          {Number(l.wholesale_price) > 0 && Number(l.wholesale_price) !== Number(l.original_wholesale_price) ? (
                            <span className={Number(l.wholesale_price) > Number(l.original_wholesale_price) ? "text-rose-600" : "text-emerald-600"}>
                              {Number(l.wholesale_price).toFixed(2)}
                            </span>
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
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title={isEditMode ? "تأكيد تعديل الفاتورة" : "تأكيد حفظ الفاتورة"}>
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
                  : `${lines.length} صنف — إجمالي ${totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م`}
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
      <Modal open={editWarnOpen} onClose={() => setEditWarnOpen(false)} title="تحذير: تعديل فاتورة محفوظة">
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
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={isEditMode ? "حذف الفاتورة" : "مسح الفاتورة"}>
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
            <button onClick={doDelete} className="rounded-sm bg-rose-600 px-5 py-2 text-sm font-black text-white hover:bg-rose-700">
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
              className="flex-1 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                className="w-full rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {todayPurchItemLookupOpen && (
                <SearchDropdown items={todayPurchFilteredItems} onPick={(item) => { setTodayPurchItemSearch(item.code || item.barcode || item.name); setTodayPurchItemLookupOpen(false); }}
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
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">إلى</label>
              <input type="date" value={todayPurchDateTo} onChange={(e) => setTodayPurchDateTo(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">ترتيب</label>
              <select value={todayPurchSort} onChange={(e) => setTodayPurchSort(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500">
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
                  className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500">
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
                className="w-[140px] rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {todayPurchSupplierQuery && (
                <button onClick={() => { setTodayPurchSupplierQuery(""); setTodayPurchSupplierId(""); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {todayPurchSupplierLookupOpen && (
                <SearchDropdown
                  items={todayPurchFilteredSuppliers}
                  onPick={(s) => { setTodayPurchSupplierQuery(s.name); setTodayPurchSupplierId(s.id); setTodayPurchSupplierLookupOpen(false); }}
                  activeIndex={todayPurchActiveSupplierIndex}
                  query={todayPurchSupplierQuery}
                  emptyLabel="لا توجد نتائج"
                />
              )}
            </div>
            <button onClick={loadTodayPurchases}
              className="flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${todayPurchLoading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>

          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-emerald-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">عدد الفواتير</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{todayPurchSummary.count}</span>
            </div>
            <div className="h-8 w-px bg-emerald-700" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">إجمالي المشتريات</span>
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
                { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-2sm font-bold text-slate-800", render: (r) => r.item_name || "—" },
                { id: "doc_no", header: "المستند", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
                { id: "supplier_name", header: "المورد", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.supplier_name || "—" },
                { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center font-mono text-2sm font-bold text-slate-600", render: (r) => Number(r.quantity) },
                { id: "unit_cost", header: "التكلفة", width: 100, cellClass: "px-3 font-mono text-2sm font-black text-slate-700", render: (r) => formatMoney(r.unit_cost) },
                { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 font-mono text-sm font-black text-emerald-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_cost) * Number(r.quantity))) },
                { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
                { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${r.purchase_id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح الفاتورة"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              ] : [
                { id: "doc_no", header: "رقم المستند", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-2sm font-black text-slate-700", render: (inv) => inv.doc_no },
                { id: "supplier_name", header: "المورد", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-2sm font-bold text-slate-800", render: (inv) => inv.supplier_name || "—" },
                { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-2sm font-bold text-slate-600", render: (inv) => inv.items_count },
                { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-sm font-black text-emerald-700", render: (inv) => formatMoney(inv.total) },
                { id: "payment_method", header: "الدفع", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (inv) => {
                  const PSTYLE = { cash: { label: "نقدي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }, bank_transfer: { label: "حوالة بنكية", cls: "bg-sky-50 text-sky-700 border-sky-200" }, credit: { label: "آجل", cls: "bg-amber-50 text-amber-700 border-amber-200" }, future_due: { label: "استحقاق لاحق", cls: "bg-orange-50 text-orange-700 border-orange-200" }, multi: { label: "متعدد", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" } };
                  if (inv.payment_splits) {
                    const splits = inv.payment_splits.split("|||").filter(Boolean).map(s => { const [m, a] = s.split(":"); return { method: (m || "").trim(), amount: Number(a || 0) }; }).filter(s => s.amount > 0);
                    if (splits.length) return (
                      <div className="flex flex-col gap-0.5">
                        {splits.map((s, i) => { const info = PSTYLE[s.method] || { label: s.method || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" }; return (
                          <div key={i} className="flex items-center gap-1">
                            <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
                            <span className="text-[11px] font-mono font-bold text-slate-500">{formatMoney(s.amount)}</span>
                          </div>
                        ); })}
                      </div>
                    );
                  }
                  const info = PSTYLE[inv.payment_method] || { label: inv.payment_method || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" };
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">{formatMoney(inv.total)}</span>
                    </div>
                  );
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

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
      />
    </div>
  );
}
