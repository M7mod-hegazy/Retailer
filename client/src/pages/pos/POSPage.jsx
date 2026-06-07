import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpDown,
  Banknote,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Gift,
  Image as ImageIcon,
  Layers,
  ListTodo,
  Minus,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Pencil,
  User,
  Wallet,
  X,
  LogOut,
  TrendingUp,
  Clock,
  Filter,
  RefreshCw,
  Calendar,
  FilePlus,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import api from "../../services/api";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import BarcodeListener from "../../components/pos/BarcodeListener";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { scoredFilterRows } from "../../utils/search";
import { LayoutGrid, List, Package } from "lucide-react";
import WarehouseStockMatrix from "../../components/pos/WarehouseStockMatrix";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import POSTodayModal from "../../components/pos/POSTodayModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import InvoiceProfitModal from "../../components/pos/InvoiceProfitModal";
import DataGrid from "../../components/ui/DataGrid";
import { usePageTour } from "../../hooks/usePageTour";
import { usePosStore } from "../../stores/posStore";
import { useAuthStore } from "../../stores/authStore";
import { useSound } from "../../hooks/useSound";
import { useNavigate, useLocation } from "react-router-dom";
import PermissionGate from "../../components/ui/PermissionGate";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import CustomerInfoModal from "../../components/modals/CustomerInfoModal";
import QuickAddLeadPopover from "./QuickAddLeadPopover";
import toast from "react-hot-toast";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";

const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5000");
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function GalleryModal({ open, onClose, images, idx, setIdx, zoom, setZoom }) {
  if (!open || !images.length) return null;
  const current = images[idx];
  return (
    <Modal open={open} onClose={onClose} title="معاينة الصورة" size="lg">
      <div className="flex flex-col items-center gap-3 p-3 bg-slate-900 rounded-lg" style={{ minHeight: 320 }}>
        <div
          className="flex items-center justify-center w-full overflow-hidden rounded-md"
          style={{ minHeight: 260, maxHeight: "60vh" }}
        >
          <img
            src={current}
            alt="product"
            style={{
              transform: `scale(${zoom})`,
              transition: "transform 0.2s ease",
              maxWidth: "100%",
              maxHeight: "60vh",
              objectFit: "contain",
            }}
            className="rounded-md"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => { setIdx(i => Math.max(0, i - 1)); setZoom(1); }}
            disabled={idx === 0}
            className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => parseFloat(Math.max(0.5, z - 0.25).toFixed(2)))}
            className="px-3 py-1.5 rounded-sm bg-slate-700 text-white text-2sm font-bold hover:bg-slate-600 transition-colors"
          >
            -
          </button>
          <span className="text-white text-[11px] font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => parseFloat(Math.min(4, z + 0.25).toFixed(2)))}
            className="px-3 py-1.5 rounded-sm bg-slate-700 text-white text-2sm font-bold hover:bg-slate-600 transition-colors"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-3 py-1.5 rounded-sm bg-slate-600 text-slate-300 text-[11px] font-bold hover:bg-slate-500 transition-colors"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => { setIdx(i => Math.min(images.length - 1, i + 1)); setZoom(1); }}
            disabled={idx === images.length - 1}
            className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setIdx(i); setZoom(1); }}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === idx ? "bg-white" : "bg-slate-600 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        )}
        {images.length > 1 && (
          <span className="text-slate-400 text-[11px] font-mono">{idx + 1} / {images.length}</span>
        )}
      </div>
    </Modal>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatArabicDate(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function HeldDropdown({ heldInvoices, onResume, onDiscard, onClose }) {
  if (!heldInvoices.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 min-w-[320px] overflow-hidden rounded-xl border border-amber-200 bg-white shadow-[0_12px_48px_-8px_rgba(0,0,0,0.2)]">
      <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
        {heldInvoices.map((h) => (
          <div key={h.id} className="flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <PauseCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-800 truncate">{h.customer?.name || "زبون نقدي"}</span>
                <span className="font-mono text-sm font-black text-amber-700 shrink-0">{formatMoney(h.heldTotal)} ج.م</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">{h.linesCount} أصناف</span>
                <span className="text-[11px] text-slate-400 font-mono">{formatArabicDateTime(new Date(h.heldAt))}</span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <PermissionGate page="pos" action="hold">
                <button onClick={() => { onResume(h.id); onClose(); }} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all active:scale-[0.98]" title="استئناف">
                  <PlayCircle className="h-5 w-5" />
                </button>
              </PermissionGate>
              <PermissionGate page="pos" action="void">
                <button onClick={() => onDiscard(h.id)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-[0.98]" title="حذف">
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const WALK_IN_CUSTOMER = { id: null, name: "زبون نقدي", phone: "", opening_balance: 0 };
const DEFAULT_WAREHOUSE = { id: "default", name: "المخزن الرئيسي" };

const PAYMENT_TYPES = [
  { type: "cash",          label: "نقدي",      desc: "نقد فوري بالصندوق", Icon: Banknote   },
  { type: "bank_transfer", label: "بنك / فيزا", desc: "مدى / فيزا / تحويل", Icon: CreditCard },
  { type: "credit",        label: "آجل",        desc: "تسجيل دين على العميل", Icon: Wallet     },
  { type: "installments",  label: "أقساط",      desc: "دفعات أقساط مجدولة", Icon: Calendar   },
  { type: "multi",         label: "متعدد",      desc: "تجزئة على عدة طرق", Icon: Layers     },
];

const PAYMENT_STATUS_LABELS = {
  paid:    { label: "مدفوع",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "جزئي",    cls: "bg-amber-50 text-amber-700 border-amber-200"    },
  unpaid:  { label: "آجل",     cls: "bg-rose-50 text-rose-700 border-rose-200"       },
  voided:  { label: "ملغي",    cls: "bg-slate-100 text-slate-500 border-slate-200"   },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ step, children, isActive }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {step && (
        <span className={`inline-flex h-[18px] w-[18px] items-center justify-center border text-[9px] font-black leading-none shrink-0 transition-all duration-150 ${
          isActive ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 text-zinc-500"
        }`}>
          {step}
        </span>
      )}
      <span className={`text-[11px] font-black uppercase tracking-[0.12em] leading-none transition-colors ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>{children}</span>
    </div>
  );
}



function SortTh({ label, sortKey, sortConfig, onSort, width, onResizeStart, resizableKey, className = "" }) {
  const active = sortConfig.key === sortKey;
  return (
    <th
      className={`relative select-none px-2 py-2 text-right text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors ${className}`}
      style={{ width: width ? `${width}px` : undefined, minWidth: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
    >
      <div className="inline-flex items-center gap-1 cursor-pointer" onClick={() => onSort && onSort(sortKey)}>
        {label}
        {onSort && (active
          ? sortConfig.dir === "asc" ? <ChevronUp className="h-3 w-3 text-slate-900" /> : <ChevronDown className="h-3 w-3 text-slate-900" />
          : <ArrowUpDown className="h-3 w-3 opacity-20" />)}
      </div>
      {resizableKey && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(e, resizableKey)}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-slate-400 z-10 transition-colors"
        />
      )}
    </th>
  );
}

// Custom navigation guard — works with BrowserRouter (no data router needed)
function useNavGuard(shouldBlock) {
  const [showModal, setShowModal] = useState(false);
  const pendingNavRef = useRef(null);
  const proceedingRef = useRef(false);

  useEffect(() => {
    if (!shouldBlock) return;

    const origPush    = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = (state, unused, url) => {
      if (proceedingRef.current) { origPush(state, unused, url); return; }
      const target = typeof url === "string" ? url : (url?.toString() ?? "");
      const current = window.location.pathname + window.location.search;
      if (target === current || target === window.location.href) { origPush(state, unused, url); return; }
      pendingNavRef.current = () => { origPush(state, unused, url); window.dispatchEvent(new PopStateEvent("popstate", { state })); };
      setShowModal(true);
    };

    window.history.replaceState = (state, unused, url) => {
      if (proceedingRef.current) { origReplace(state, unused, url); return; }
      origReplace(state, unused, url);
    };

    const handlePop = () => {
      if (proceedingRef.current) return;
      origPush(null, "", window.location.href); // push back current to cancel pop
      pendingNavRef.current = () => { window.history.go(-1); };
      setShowModal(true);
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.history.pushState    = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener("popstate", handlePop);
    };
  }, [shouldBlock]);

  function proceed() {
    setShowModal(false);
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    if (nav) { proceedingRef.current = true; nav(); proceedingRef.current = false; }
  }

  function cancel() {
    setShowModal(false);
    pendingNavRef.current = null;
  }

  return { showModal, proceed, cancel };
}

function NavLockModal({ onProceed, onCancel }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] rounded-md border border-slate-200 bg-white shadow-2xl" dir="rtl">
        <div className="border-b border-slate-100 bg-slate-950 px-6 py-4 rounded-t-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">تحذير — فاتورة جارية</p>
              <p className="text-[11px] text-slate-400 font-bold">لديك أصناف في السلة لم تحفظ بعد</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm font-bold text-slate-600 leading-relaxed">
            إذا غادرت الصفحة الآن ستفقد الفاتورة الحالية. هل تريد المتابعة؟
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 rounded-sm border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 transition-colors">
              البقاء في الصفحة
            </button>
            <button onClick={onProceed}
              className="flex-1 rounded-sm border border-rose-600 bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 transition-colors">
              <span className="flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" /> المغادرة والتخلي
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSPage() {
  usePageTour("pos");
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { permissions } = useAuthStore();
  const canOverridePrice = user?.role === "dev" || user?.role === "admin" || (Array.isArray(permissions?.pos) && permissions.pos.includes("override_price"));
  const { playBeep } = useSound();

  // POS store
  const lines             = usePosStore((s) => s.lines);
  const addLine           = usePosStore((s) => s.addLine);
  const updateLine        = usePosStore((s) => s.updateLine);
  const removeLine        = usePosStore((s) => s.removeLine);
  const customer          = usePosStore((s) => s.customer);
  const setCustomer       = usePosStore((s) => s.setCustomer);
  const discount          = usePosStore((s) => s.discount);
  const setDiscount       = usePosStore((s) => s.setDiscount);
  const increase          = usePosStore((s) => s.increase);
  const setIncrease       = usePosStore((s) => s.setIncrease);
  const promotionDiscount = usePosStore((s) => s.promotionDiscount);
  const appliedPromotions = usePosStore((s) => s.appliedPromotions);
  const paymentType       = usePosStore((s) => s.paymentType);
  const setPaymentType    = usePosStore((s) => s.setPaymentType);
  const getTotals         = usePosStore((s) => s.getTotals);
  const clear             = usePosStore((s) => s.clear);
  const heldInvoices            = usePosStore((s) => s.heldInvoices);
  const holdCurrentInvoice      = usePosStore((s) => s.holdCurrentInvoice);
  const resumeHeldInvoice       = usePosStore((s) => s.resumeHeldInvoice);
  const discardHeldInvoice      = usePosStore((s) => s.discardHeldInvoice);
  const loadDraftsFromDB        = usePosStore((s) => s.loadDraftsFromDB);
  const syncActiveCartToDB      = usePosStore((s) => s.syncActiveCartToDB);
  const clearActiveDraftFromDB  = usePosStore((s) => s.clearActiveDraftFromDB);

  // Hold / تعليق
  const [heldDropdownOpen, setHeldDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setHeldDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleHold = () => {
    if (!lines.length) return;
    holdCurrentInvoice();
    toast.success("تم تعليق الفاتورة");
    setHeldDropdownOpen(false);
  };

  // Stale held invoice popup (shown once per session)
  const [staleHeldAlert, setStaleHeldAlert] = useState(false);
  const staleAlertShownRef = useRef(false);

  // UI state
  const [openShiftModal, setOpenShiftModal]   = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [customers, setCustomers]         = useState([]);
  const [items, setItems]                 = useState([]);
  const [itemCategories, setItemCategories] = useState([]);
  const [warehouses, setWarehouses]       = useState([]);
  const [banks, setBanks]                 = useState([]);
  const [treasuries, setTreasuries]       = useState([]);
  const [units, setUnits]                 = useState([]);
  const [employees, setEmployees]         = useState([]);
  const [stockLevels, setStockLevels]     = useState({});
  const [stockLoaded, setStockLoaded]     = useState(false);
  const [storeSettings, setStoreSettings] = useState({ company_name: "المتجر", address: "" });
  const [printPreview, setPrintPreview] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showSetDefaultModal, setShowSetDefaultModal] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState(null);
  const [newInvoiceModalOpen, setNewInvoiceModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const [invoiceTick, setInvoiceTick] = useState(() => Date.now());
  const [invoiceSeq, setInvoiceSeq]   = useState(1);

  // Search state
  const [itemNameQuery, setItemNameQuery]     = useState("");
  const [itemCodeQuery, setItemCodeQuery]     = useState("");
  const [customerQuery, setCustomerQuery]     = useState("");
  const [activeLookupIndex, setActiveLookupIndex]     = useState(0);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [itemLookupOpen, setItemLookupOpen]       = useState(false);
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);

  // Item search (paginated server-side)
  const [searchedItemResults, setSearchedItemResults] = useState([]);
  const [searchedItemOffset, setSearchedItemOffset]   = useState(0);
  const [searchedItemHasMore, setSearchedItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems]   = useState(false);
  const ITEM_PAGE = 20;

  // Detailed search
  const [detailedSearchOpen, setDetailedSearchOpen]   = useState(false);
  const [detailedSearchQuery, setDetailedSearchQuery] = useState("");
  const [detailedCategoryFilter, setDetailedCategoryFilter] = useState("all");
  const [detailedSortConfig, setDetailedSortConfig] = useState({ key: "name", dir: "asc" });
  const [detailedColWidths, setDetailedColWidths] = useState({
    image: 54, code: 100, name: 240, barcode: 130, category: 120, price: 100, stock: 80,
  });

  // Cart sorting & resizing
  const [cartSortConfig, setCartSortConfig] = useState({ key: null, dir: "asc" });
  const [cartColWidths, setCartColWidths] = useState({
    index: 36, code: 110, name: 220, unit: 70, qty: 72, price: 88, warehouse: 96, discount: 84, total: 96, actions: 44,
  });

  // Held invoices
  const [showHeldMenu, setShowHeldMenu] = useState(false);

  // Payment
  const [amountPaid, setAmountPaid]         = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [installmentDueDate, setInstallmentDueDate] = useState("");
  const [selectedBankId, setSelectedBankId]         = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [activeMultiPayments, setActiveMultiPayments] = useState([]);
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("detailed");
  const [multiCash, setMultiCash] = useState("");
  const [multiCredit, setMultiCredit] = useState("");
  const [customPayMethods, setCustomPayMethods] = useState([]);
  const [multiCustomAmounts, setMultiCustomAmounts] = useState({});

  // Modals
  const [profitModalOpen, setProfitModalOpen]           = useState(false);
  const [profitDisplayMode, setProfitDisplayMode]        = useState("pct");
  const [advancedSearchOpen, setAdvancedSearchOpen]     = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen]     = useState(false);
  // Optional WhatsApp number for anonymous sales → auto-captured as a lead on sale completion
  const [waLeadPhone, setWaLeadPhone]                   = useState("");
  const [waLeadName, setWaLeadName]                     = useState("");
  const [quickAddOpen, setQuickAddOpen]                 = useState(false);
  const [customerInfoOpen, setCustomerInfoOpen]         = useState(false);
  const [supervisorOverrideOpen, setSupervisorOverrideOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);

  // Today's receipts
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  // Staging area
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ warehouseId: "", quantity: "1", unitPrice: "", lineDiscount: "0" });
  const [activeEntryField, setActiveEntryField] = useState(null);
  const [sellerId, setSellerId] = useState("");
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState("flat");
  const [invoiceIncreaseMode, setInvoiceIncreaseMode] = useState("flat");
  const [lastSalePrice, setLastSalePrice] = useState(null);
  const [priceType, setPriceType] = useState("retail");
  const [discountModes, setDiscountModes] = useState({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [galleryZoom, setGalleryZoom] = useState(1);
  const [pendingBelowCostAdd, setPendingBelowCostAdd] = useState(false);

  // Save feedback
  const [saveMessage, setSaveMessage]   = useState("");
  const [isSaving, setIsSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(null);
  const [lastSavedInvoice, setLastSavedInvoice] = useState(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [successNavigateTo, setSuccessNavigateTo] = useState(null);

  // Offline — reflects reachability of the LOCAL backend, not OS connectivity.
  // The app is local-first (Express + SQLite on this machine), so navigator.onLine
  // is irrelevant; what actually breaks the POS is the local server being down.
  const [isOffline, setIsOffline] = useState(false);

  // Refs
  const codeInputRef     = useRef(null);
  const customerInputRef = useRef(null);
  const saveInvoiceRef   = useRef(null);
  const qtyInputRef      = useRef(null);
  const priceInputRef    = useRef(null);
  const discInputRef     = useRef(null);
  const detailedResizingCol = useRef(null);
  const detailedStartX      = useRef(0);
  const detailedStartWidth  = useRef(0);
  const cartResizingCol  = useRef(null);
  const cartStartX       = useRef(0);
  const cartStartWidth   = useRef(0);

  const entryFieldRefs = [codeInputRef, qtyInputRef, priceInputRef, discInputRef];

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Poll the local backend health endpoint instead of the OS network flag.
  // The banner only appears when the local server is genuinely unreachable.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        await api.get("/api/health", { timeout: 2000 });
        if (alive) setIsOffline(false);
      } catch {
        if (alive) setIsOffline(true);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Restore active cart and held invoices from DB on mount.
  // Skip cart restore when entering edit mode — the edit prefill owns the cart.
  useEffect(() => { if (!location.state?.edit_invoice_id) loadDraftsFromDB(); }, []);

  // Debounced sync of active cart to DB (1.5s after last change)
  const syncTimerRef = useRef(null);
  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => { syncActiveCartToDB(); }, 1500);
    return () => clearTimeout(syncTimerRef.current);
  }, [lines, customer, discount, increase, paymentType]);

  // One-time popup if any held invoice exceeds yellow threshold
  useEffect(() => {
    if (staleAlertShownRef.current || !heldInvoices.length) return;
    const yellowHours = Number(storeSettings?.held_yellow_hours || 2);
    const now = Date.now();
    const hasStale = heldInvoices.some((h) => {
      const ageHours = (now - new Date(h.heldAt).getTime()) / 3_600_000;
      return ageHours >= yellowHours;
    });
    if (hasStale) {
      staleAlertShownRef.current = true;
      setStaleHeldAlert(true);
    }
  }, [heldInvoices, storeSettings]);

  useEffect(() => {
    const t = window.setInterval(() => setInvoiceTick(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);


  useEffect(() => { setCustomerQuery(customer?.name || ""); }, [customer]);

  const mergeStockRows = useCallback((rows = []) => {
    setStockLevels((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (!row?.item_id) return;
        const itemKey = row.item_id;
        next[itemKey] = { ...(next[itemKey] || {}) };
        next[itemKey][row.warehouse_id] = Number(row.quantity || 0);
      });
      return next;
    });
  }, []);

  const fetchStockForItems = useCallback(async (itemIds = []) => {
    const ids = [...new Set(itemIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return;
    try {
      const res = await api.get("/api/stock/levels", {
        params: { item_ids: ids.join(","), limit: Math.max(ids.length * Math.max(warehouses.length, 1), 50) },
      });
      mergeStockRows(res.data?.data || []);
    } catch {
      // Stock is still checked again by the invoice save path.
    }
  }, [mergeStockRows, warehouses.length]);

  useEffect(() => {
    api.get("/api/pos/bootstrap").then((r) => {
      const data = r.data?.data || {};
      setCustomers(data.customers || []);
      setItems(data.items || []);
      setItemCategories(data.categories || []);
      setWarehouses(data.warehouses || []);
      setBanks(data.banks || []);
      setTreasuries(data.treasuries || []);
      setUnits(data.units || []);
      setEmployees(data.employees || []);
      mergeStockRows(data.stock_levels || []);
      setStockLoaded(true);
      const s = data.settings || {};
      setStoreSettings(s);
      if (s.default_pos_view) setViewMode(s.default_pos_view);
      const all = data.payment_methods || [];
      setPaymentMethods(all);
      setCustomPayMethods(all.filter(m => !m.is_system));
    }).catch(() => { setStockLoaded(true); });
  }, [mergeStockRows]);

  useEffect(() => {
    const ids = lines.map((line) => line.item_id);
    fetchStockForItems(ids);
  }, [lines, fetchStockForItems]);

  useEffect(() => {
    if (!warehouses.length) return;
    setStaging((s) => ({ ...s, warehouseId: s.warehouseId || String(warehouses[0].id) }));
  }, [warehouses]);

  // Edit context — persisted in state so it survives history.replaceState
  const [amendContext, setAmendContext] = useState(null); // { edit_invoice_id, prefill }

  const isDirty = lines.length > 0 || !!customer;
  const { blocker } = useUnsavedChangesGuard(isDirty);
  const [showAmendSummary, setShowAmendSummary] = useState(true);

  // Map of (item_id, warehouse_id) -> original quantity from the invoice being edited
  const amendOriginalQty = useMemo(() => {
    if (!amendContext?.prefill?.lines) return {};
    const map = {};
    for (const l of amendContext.prefill.lines) {
      const key = `${l.item_id}_${l.warehouse_id ?? "null"}`;
      map[key] = Number(l.quantity || 0);
    }
    return map;
  }, [amendContext]);

  // Pre-fill cart when navigated from invoice edit flow
  useEffect(() => {
    const amendState = location.state;
    if (!amendState?.edit_invoice_id || !amendState?.prefill) return;
    const { prefill } = amendState;
    clear();
    // Set amendContext FIRST so stock warnings are suppressed before lines are added
    setAmendContext(amendState);
    setShowAmendSummary(true);
    if (prefill.payment_type) setPaymentType(prefill.payment_type);
    if (prefill.discount) setDiscount(prefill.discount);
    if (prefill.increase) setIncrease(prefill.increase);
    (prefill.lines || []).forEach(l => addLine({
      id: l.item_id,
      name: l.item_name,
      code: l.code || "",
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_discount: l.discount || 0,
      warehouse_id: l.warehouse_id || null,
    }));
    window.history.replaceState({}, document.title);
  }, [location.state]);

  // Set customer AFTER amendContext is stored — runs in a separate effect cycle,
  // after clear() has fully settled, reliably overriding the customer sync effect.
  useEffect(() => {
    if (!amendContext?.prefill?.customer_id) return;
    const { prefill } = amendContext;
    // Prefer the full customer object (with opening_balance) from the loaded list;
    // fall back to bare id+name if the list hasn't arrived yet.
    const full = customers.find((c) => c.id === prefill.customer_id);
    setCustomer(full || { id: prefill.customer_id, name: prefill.customer_name });
    setCustomerQuery(prefill.customer_name || "");
  }, [amendContext, customers]);

  // Pre-fill payment fields when opening an edit — runs after customPayMethods are loaded
  const paymentPrefillApplied = React.useRef(false);
  useEffect(() => {
    if (!amendContext?.prefill || !customPayMethods.length) return;
    if (paymentPrefillApplied.current) return;
    paymentPrefillApplied.current = true;
    const { prefill } = amendContext;
    if (prefill.payment_type === "installments") {
      if (prefill.amount_received > 0) setAmountPaid(String(prefill.amount_received));
    } else if (prefill.payment_type === "multi" && prefill.allocations?.length) {
      let cash = 0, credit = 0;
      const customAmts = {};
      for (const alloc of prefill.allocations) {
        if (alloc.method === "cash") cash = Number(alloc.amount);
        else if (alloc.method === "credit") credit = Number(alloc.amount);
        else {
          const match = customPayMethods.find(m =>
            m.name === alloc.method || m.name === alloc.method_name
          );
          if (match) customAmts[match.id] = Number(alloc.amount);
        }
      }
      if (cash > 0) setMultiCash(String(cash));
      if (credit > 0) setMultiCredit(String(credit));
      if (Object.keys(customAmts).length) setMultiCustomAmounts(customAmts);
    }
    if (prefill.treasury_id) setSelectedTreasuryId(String(prefill.treasury_id));
    if (prefill.bank_id) setSelectedBankId(String(prefill.bank_id));
  }, [amendContext, customPayMethods]);

  // Reset the payment prefill guard when edit context clears
  useEffect(() => { if (!amendContext) paymentPrefillApplied.current = false; }, [amendContext]);

  // Store edit context for use during submit
  const amendInvoiceId = amendContext?.edit_invoice_id || null;

  // Read edit seed directly from location.state (available on first render, before the effect sets amendContext)
  const _amendSeed = location.state?.edit_invoice_id && location.state?.prefill?.invoice_no
    ? { docNo: location.state.prefill.invoice_no, createdAt: location.state.prefill.created_at }
    : null;

  // Idle/Active invoice state — doc number reserved on first interaction
  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } = useInvoiceActivation(
    "pos_sale",
    _amendSeed
  );

  useEffect(() => {
    if (!selectedItem) return;
    setPriceType("retail");
    setStaging((s) => ({
      ...s,
      unitPrice: String(Number(selectedItem.sale_price || selectedItem.price || 0)),
      warehouseId: (() => {
        if (stockLevels[selectedItem.id]) {
          const first = warehouses.find((w) => (stockLevels[selectedItem.id][w.id] || 0) > 0);
          if (first) return String(first.id);
        }
        return s.warehouseId || String(warehouses[0]?.id || "");
      })(),
      unitId: String(selectedItem.unit_id || units?.[0]?.id || ""),
      quantity: "1",
      lineDiscount: "0",
    }));
    setPendingBelowCostAdd(false);
  }, [selectedItem, warehouses, stockLevels, units]);

  useEffect(() => {
    if (!selectedItem?.id) { setLastSalePrice(null); return; }
    api.get(`/api/invoices/last-price/${selectedItem.id}`)
      .then((r) => setLastSalePrice(r.data.data ?? null))
      .catch(() => setLastSalePrice(null));
  }, [selectedItem?.id]);

  useEffect(() => {
    const handler = (e) => { if (e.detail) handleSelectItem(e.detail); };
    window.addEventListener("pos-barcode-scanned", handler);
    return () => window.removeEventListener("pos-barcode-scanned", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "F2") { e.preventDefault(); codeInputRef.current?.focus(); codeInputRef.current?.select(); }
      if (e.key === "F1") { e.preventDefault(); customerInputRef.current?.focus(); setCustomerLookupOpen(true); }
      if (e.key === "F9")  { e.preventDefault(); saveInvoiceRef.current?.(false); }
      if (e.key === "F12") { e.preventDefault(); saveInvoiceRef.current?.(true); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Column resize handlers
  const onDetailedResizeStart = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    detailedResizingCol.current = key;
    detailedStartX.current = e.clientX;
    detailedStartWidth.current = detailedColWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (mv) => {
      if (!detailedResizingCol.current) return;
      const diff = detailedStartX.current - mv.clientX;
      const w = Math.max(detailedStartWidth.current + diff, 50);
      setDetailedColWidths(prev => ({ ...prev, [detailedResizingCol.current]: w }));
    };
    const onMouseUp = () => {
      detailedResizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onCartResizeStart = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    cartResizingCol.current = key;
    cartStartX.current = e.clientX;
    cartStartWidth.current = cartColWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (mv) => {
      if (!cartResizingCol.current) return;
      const diff = cartStartX.current - mv.clientX;
      const w = Math.max(cartStartWidth.current + diff, 36);
      setCartColWidths(prev => ({ ...prev, [cartResizingCol.current]: w }));
    };
    const onMouseUp = () => {
      cartResizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const toggleDetailedSort = (key) => setDetailedSortConfig(p => p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const toggleCartSort     = (key) => setCartSortConfig(p => p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  function getFilteredWarehouses(itemId, currentId) {
    if (!itemId) return warehouses;
    const whStock = stockLevels[itemId] || stockLevels[Number(itemId)] || stockLevels[String(itemId)] || {};
    const filtered = warehouses.filter(w => (whStock[w.id] || 0) > 0);
    if (!filtered.length) return warehouses;
    if (currentId && !filtered.some(w => String(w.id) === String(currentId))) {
      const current = warehouses.find(w => String(w.id) === String(currentId));
      if (current) filtered.push(current);
    }
    return filtered;
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const totals             = getTotals();
  const paidAmountNumber   = Number(amountPaid || 0);
  const creditRemaining    = Math.max(0, totals.total - Math.max(0, paidAmountNumber));
  const changeAmount       = Math.max(0, Number(amountReceived || 0) - totals.total);

  const lineWarnings = useMemo(() => {
    const result = {};
    for (const l of lines) {
      const item = items.find((it) => it.id === l.item_id);
      const warnings = [];
      const unitPrice = Number(l.unit_price || 0);
      const quantity = Number(l.quantity || 0);
      const lineDiscount = Number(l.line_discount || 0);
      const stockQty = Number(stockLevels[l.item_id]?.[l.warehouse_id] ?? l.stock_quantity ?? 0);
      const costPrice = Number(item?.current_cost || item?.purchase_price || 0);
      const lineTotal = unitPrice * quantity;

      if (unitPrice <= 0) warnings.push({ type: "error", code: "zero_price", msg: "سعر صفر" });
      if (stockLoaded) {
        const effectiveMax = getLineMaxStock(l.item_id, l.warehouse_id);
        if (effectiveMax === 0 && quantity > 0) warnings.push({ type: "error", code: "no_stock", msg: "لا يوجد مخزون" });
        else if (effectiveMax !== Infinity && quantity > effectiveMax) warnings.push({ type: "error", code: "stock_exceeded", msg: `تجاوز المخزون (متاح: ${effectiveMax})` });
      }
      if (costPrice > 0 && unitPrice < costPrice && unitPrice > 0) warnings.push({ type: "warning", code: "below_cost", msg: `أقل من التكلفة (${Number(costPrice).toFixed(2)})` });
      if (lineDiscount > lineTotal && lineTotal > 0) warnings.push({ type: "warning", code: "discount_overflow", msg: "الخصم يتجاوز الإجمالي" });
      if (lineDiscount < 0) warnings.push({ type: "warning", code: "negative_discount", msg: "خصم سالب" });
      if (quantity <= 0) warnings.push({ type: "error", code: "zero_qty", msg: "كمية صفر" });
      result[l.item_id] = warnings;
    }
    return result;
  }, [lines, items, stockLevels, stockLoaded, amendContext, amendOriginalQty]);

  const hasBlockingErrors = useMemo(
    () => Object.values(lineWarnings).some((ws) => ws.some((w) => w.type === "error")),
    [lineWarnings],
  );

  // Stock errors in amend mode are now real (we factor in original qty), so stockOnlyErrors is always false.
  const stockOnlyErrors = false;

  const blockingErrorCount = useMemo(
    () => Object.values(lineWarnings).flat().filter((w) => w.type === "error").length,
    [lineWarnings],
  );

  const invoiceNumber = useMemo(() => {
    const stamp = new Date(invoiceTick);
    const yy = String(stamp.getFullYear()).slice(-2);
    const mm = String(stamp.getMonth() + 1).padStart(2, "0");
    const dd = String(stamp.getDate()).padStart(2, "0");
    return `INV-${yy}${mm}${dd}-${String(invoiceSeq).padStart(4, "0")}`;
  }, [invoiceSeq, invoiceTick]);

  const customerResults = useMemo(() => {
    if (!customerLookupOpen) return [];
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").includes(q))
      : customers.slice(0, 8);
    return list.slice(0, 8).map((c) => ({
      ...c,
      stock_label: c.phone || "بدون هاتف",
      price_label: c.opening_balance ? `رصيد ${formatMoney(c.opening_balance)}` : "",
    }));
  }, [customerLookupOpen, customerQuery, customers]);

  useEffect(() => {
    if (!customerLookupOpen) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      const q = customerQuery.trim();
      api.get("/api/customers", {
        params: { search: q || undefined, limit: 8 },
        signal: controller.signal,
      })
        .then((r) => setCustomers(r.data?.data || []))
        .catch((err) => {
          if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
            // Keep the bootstrap customers as a fallback.
          }
        });
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [customerLookupOpen, customerQuery]);

  useEffect(() => {
    const q = (itemNameQuery || itemCodeQuery).trim();
    if (!q) { setSearchedItemResults([]); setSearchedItemOffset(0); setSearchedItemHasMore(false); return; }
    const controller = new AbortController();
    const t = setTimeout(() => {
      api.get("/api/items", { params: { search: q, limit: ITEM_PAGE, offset: 0 }, signal: controller.signal })
        .then(r => {
          const rows = (r.data.data || []).map(item => ({
            ...item,
            sub_label: `\u0645\u062e\u0632\u0648\u0646: ${Number(item.stock_quantity || item.stock || 0)}`,
            price_label: formatMoney(item.sale_price || item.price || 0),
          }));
          setSearchedItemResults(rows);
          setSearchedItemOffset(rows.length);
          setSearchedItemHasMore(Boolean(r.data?.meta?.has_more ?? rows.length === ITEM_PAGE));
        }).catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [itemNameQuery, itemCodeQuery]);

  useEffect(() => {
    const q = detailedSearchQuery.trim();
    if (!q) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      api.get("/api/items", { params: { search: q, limit: 120, offset: 0 }, signal: controller.signal })
        .then((r) => {
          const rows = r.data?.data || [];
          setItems(rows);
          fetchStockForItems(rows.map((item) => item.id));
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [detailedSearchQuery, fetchStockForItems]);

  useEffect(() => {
    if (detailedCategoryFilter === "all" || detailedSearchQuery.trim()) return;
    const category = itemCategories.find((entry) => String(entry.name || "غير مصنف") === detailedCategoryFilter);
    if (!category?.id) return;
    const controller = new AbortController();
    api.get("/api/items", {
      params: { category_id: category.id, limit: 120, offset: 0 },
      signal: controller.signal,
    })
      .then((r) => {
        const rows = r.data?.data || [];
        setItems(rows);
        fetchStockForItems(rows.map((item) => item.id));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [detailedCategoryFilter, detailedSearchQuery, fetchStockForItems, itemCategories]);

  function loadMorePOSItems() {
    const q = (itemNameQuery || itemCodeQuery).trim();
    if (!searchedItemHasMore || !q || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get("/api/items", { params: { search: q, limit: ITEM_PAGE, offset: searchedItemOffset } })
      .then(r => {
        const rows = (r.data.data || []).map(item => ({
          ...item,
          sub_label: `\u0645\u062e\u0632\u0648\u0646: ${Number(item.stock_quantity || item.stock || 0)}`,
          price_label: formatMoney(item.sale_price || item.price || 0),
        }));
        setSearchedItemResults(prev => [...prev, ...rows]);
        setSearchedItemOffset(prev => prev + rows.length);
        setSearchedItemHasMore(Boolean(r.data?.meta?.has_more ?? rows.length === ITEM_PAGE));
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  const itemResults = searchedItemResults;

  const detailedItemResults = useMemo(() => {
    const q = (detailedSearchQuery || itemNameQuery || itemCodeQuery).trim();
    let source = q
      ? scoredFilterRows(items, q, ["name", "code", "barcode", "category_name"])
      : items;
    if (detailedCategoryFilter !== "all")
      source = source.filter((item) => String(item.category_name || "غير مصنف") === detailedCategoryFilter);
    if (detailedSortConfig.key) {

      source = [...source].sort((a, b) => {
        let valA, valB;
        if (detailedSortConfig.key === "price") { valA = Number(a.sale_price || 0); valB = Number(b.sale_price || 0); }
        else if (detailedSortConfig.key === "stock") { valA = Number(a.stock_quantity || 0); valB = Number(b.stock_quantity || 0); }
        else { valA = String(a[detailedSortConfig.key] || ""); valB = String(b[detailedSortConfig.key] || ""); }
        if (typeof valA === "number") return detailedSortConfig.dir === "asc" ? valA - valB : valB - valA;
        return detailedSortConfig.dir === "asc" ? valA.localeCompare(valB, "ar") : -valA.localeCompare(valB, "ar");
      });
    }
    return source.slice(0, 120);
  }, [detailedSearchQuery, itemNameQuery, itemCodeQuery, items, detailedCategoryFilter, detailedSortConfig]);

  const detailedCategories = useMemo(() => {
    const names = Array.from(new Set([
      ...itemCategories.map((category) => String(category.name || "غير مصنف")),
      ...items.map((item) => String(item.category_name || "غير مصنف")),
    ])).filter(Boolean);
    return ["all", ...names];
  }, [itemCategories, items]);

  const sortedLines = useMemo(() => {
    if (!cartSortConfig.key) return lines;
    return [...lines].sort((a, b) => {
      let valA, valB;
      if (cartSortConfig.key === "qty")      { valA = Number(a.quantity || 0);  valB = Number(b.quantity || 0); }
      else if (cartSortConfig.key === "price") { valA = Number(a.unit_price || 0); valB = Number(b.unit_price || 0); }
      else if (cartSortConfig.key === "discount") { valA = Number(a.line_discount || 0); valB = Number(b.line_discount || 0); }
      else if (cartSortConfig.key === "total") {
        valA = Number(a.quantity || 0) * Number(a.unit_price || 0) - Number(a.line_discount || 0);
        valB = Number(b.quantity || 0) * Number(b.unit_price || 0) - Number(b.line_discount || 0);
      }
      else if (cartSortConfig.key === "code") { valA = String(a.code || ""); valB = String(b.code || ""); }
      else if (cartSortConfig.key === "name") { valA = String(a.item_name || ""); valB = String(b.item_name || ""); }
      else { valA = String(a[cartSortConfig.key] || ""); valB = String(b[cartSortConfig.key] || ""); }
      if (typeof valA === "number") return cartSortConfig.dir === "asc" ? valA - valB : valB - valA;
      return cartSortConfig.dir === "asc" ? valA.localeCompare(valB, "ar") : -valA.localeCompare(valB, "ar");
    });
  }, [lines, cartSortConfig]);

  const selectedCustomer   = customer || WALK_IN_CUSTOMER;
  // When amending, the old invoice's debt will be reversed on cancel — subtract it so we show the "pre-invoice" balance.
  // Only apply when the current customer matches the original (new customer = no old invoice effect)
  const isSameAmendCustomer = amendContext && selectedCustomer?.id === amendContext.prefill?.customer_id;
  const amendBalanceAdjust  = isSameAmendCustomer ? (amendContext.prefill?.orig_balance_effect || 0) : 0;
  const displayBalance      = Number(selectedCustomer?.opening_balance || 0) - amendBalanceAdjust;
  const hasCustomerBalance = displayBalance > 0;
  const creditEffect       = paymentType === "credit" ? totals.total :
                             paymentType === "installments" ? Math.max(0, totals.total - Number(amountPaid || 0)) :
                             paymentType === "multi" ? Number(multiCredit || 0) : 0;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getItemImage(item) {
    const raw = item?.primary_image_url || (Array.isArray(item?.image_urls) && item.image_urls.length > 0 ? item.image_urls[0] : "");
    return resolveImageUrl(raw) || "";
  }

  function resetStaging() {
    setItemNameQuery("");
    setItemCodeQuery("");
    setSelectedItem(null);
    setItemLookupOpen(false);
    setStaging((s) => ({ ...s, quantity: "1", unitPrice: "", lineDiscount: "0" }));
    setPendingBelowCostAdd(false);
    setPriceType("retail");
    setLastSalePrice(null);
    window.requestAnimationFrame(() => listItemInputRef.current?.focus());
  }

  function resetPaymentFields() {
    setAmountPaid("");
    setAmountReceived("");
    setSelectedBankId("");
    setSelectedTreasuryId("");
    setActiveMultiPayments([]);
    setInstallmentDueDate("");
    setMultiCash("");
    setMultiCredit("");
    setMultiCustomAmounts({});
  }

  function resetCustomer() {
    setCustomer(null);
    setCustomerQuery("");
    setCustomerLookupOpen(false);
    setWaLeadPhone("");
    setWaLeadName("");
  }

  function handleSelectItem(item) {
    activateInvoice();
    setSelectedItem(item);
    if (item?.id && item.id !== -1) {
      setItems((prev) => prev.some((entry) => entry.id === item.id) ? prev : [item, ...prev]);
      fetchStockForItems([item.id]);
    }
    setItemNameQuery(item.name || "");
    setItemCodeQuery(item.code || item.item_code || item.barcode || "");
    setSearchedItemResults([]);
    setSearchedItemOffset(0);
    setSearchedItemHasMore(false);
    setItemLookupOpen(false);
    setDetailedSearchOpen(false);
    // Focus next field depending on view mode
    if (viewMode === "list") {
      window.requestAnimationFrame(() => { listWhRef.current?.focus(); });
    } else {
      window.requestAnimationFrame(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); });
    }
  }

  function openGallery(imageUrls, startIdx = 0) {
    const imgs = Array.isArray(imageUrls)
      ? imageUrls.filter(Boolean)
      : [imageUrls].filter(Boolean);
    if (!imgs.length) return;
    setGalleryImages(imgs.map((u) => resolveImageUrl(u)));
    setGalleryIdx(startIdx);
    setGalleryZoom(1);
    setGalleryOpen(true);
  }

  function handleCodeFieldKeyDown(e) {
    if (!itemLookupOpen && itemResults.length && e.key === "ArrowDown") { e.preventDefault(); setItemLookupOpen(true); return; }
    if (itemLookupOpen && itemResults.length && e.key === "ArrowDown")  { e.preventDefault(); setActiveLookupIndex((v) => Math.min(v + 1, itemResults.length)); return; }
    if (itemLookupOpen && itemResults.length && e.key === "ArrowUp")    { e.preventDefault(); setActiveLookupIndex((v) => Math.max(v - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const q = (itemNameQuery || itemCodeQuery).trim();
      if (itemResults.length > 0 && activeLookupIndex >= 0 && activeLookupIndex < itemResults.length) {
        handleSelectItem(itemResults[activeLookupIndex]);
      } else if (q) {
        handleSelectItem({ id: -1, name: q, code: q, item_code: q, barcode: q, sale_price: 0, price: 0, purchase_price: 0, stock_quantity: 0 });
      }
      return;
    }
    if (e.key === "Escape") setItemLookupOpen(false);
  }

  function handlePickCustomer(c) {
    activateInvoice();
    setCustomerLookupOpen(false);
    if (!customer?.id) setPaymentType("cash");
    // Fetch ajal debt total asynchronously and enrich customer object
    api.get(`/api/ajal-debts?party_type=customer&party_id=${c.id}&status=open`)
      .then(r => {
        const ajal = (r.data.data || []).reduce((s, d) => s + Number(d.original_amount) - Number(d.paid_amount), 0);
        setCustomer({ ...c, ajal_total: ajal > 0 ? ajal : undefined });
      })
      .catch(() => setCustomer(c));
    setCustomerQuery(c.name || "");
  }

  function handleCustomerKeyDown(e) {
    if (!customerLookupOpen && e.key === "ArrowDown") { setCustomerLookupOpen(true); return; }
    if (customerLookupOpen && customerResults.length && e.key === "ArrowDown") { e.preventDefault(); setActiveCustomerIndex((v) => Math.min(v + 1, customerResults.length - 1)); return; }
    if (customerLookupOpen && customerResults.length && e.key === "ArrowUp")   { e.preventDefault(); setActiveCustomerIndex((v) => Math.max(v - 1, 0)); return; }
    if (customerLookupOpen && customerResults.length && e.key === "Enter") {
      e.preventDefault();
      const next = customerResults[activeCustomerIndex] || customerResults[0];
      setCustomer(next); setCustomerQuery(next.name); setCustomerLookupOpen(false); customerInputRef.current?.blur();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setCustomer(null); setCustomerQuery(""); setCustomerLookupOpen(false); }
  }

  function handleEntryFieldKeyDown(e, fieldIndex) {
    if (itemLookupOpen && fieldIndex === 0) { handleCodeFieldKeyDown(e); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        const prev = fieldIndex - 1;
        if (prev >= 0) { entryFieldRefs[prev].current?.focus(); entryFieldRefs[prev].current?.select(); }
        return;
      }
      if (fieldIndex === 3) { if (selectedItem) addCurrentLine(); return; }
      if (fieldIndex === 0 && !selectedItem) return;
      const next = fieldIndex + 1;
      if (next < entryFieldRefs.length) { entryFieldRefs[next].current?.focus(); entryFieldRefs[next].current?.select(); }
      return;
    }
    if (e.shiftKey && e.key === "Tab") {
      e.preventDefault();
      const prev = fieldIndex - 1;
      if (prev >= 0) { entryFieldRefs[prev].current?.focus(); entryFieldRefs[prev].current?.select(); }
      return;
    }
    if (e.key === "Escape") resetStaging();
  }

  function addCurrentLine() {
    if (!selectedItem) return;
    const isRawEntry = selectedItem.id === -1;
    const warehouse   = warehouses.find((w) => String(w.id) === String(staging.warehouseId)) || DEFAULT_WAREHOUSE;
    const quantity    = Math.max(1, Number(staging.quantity || 1));
    const unitPrice   = Math.max(0, Number(staging.unitPrice || 0));
    const lineDiscount = Math.max(0, Number(staging.lineDiscount || 0));
    const _itemStock  = stockLevels[selectedItem.id] || stockLevels[String(selectedItem.id)];
    const stockValue  = isRawEntry ? 999999 : Number(_itemStock?.[warehouse.id] ?? _itemStock?.[String(warehouse.id)] ?? _itemStock?.[Number(warehouse.id)] ?? selectedItem.stock_quantity ?? selectedItem.stock ?? 0);
    const purchasePrice = Number(selectedItem.purchase_price || 0);
    const unit = units.find((u) => String(u.id) === String(staging.unitId));

    if (!isRawEntry && unitPrice <= 0) { setSaveMessage("لا يمكن إضافة صنف بسعر صفر."); setTimeout(() => setSaveMessage(""), 3000); return; }
    const alreadyInCart = !isRawEntry ? (lines.find(l => l.item_id === selectedItem.id && l.warehouse_id === warehouse.id)?.quantity || 0) : 0;
    const availableToAdd = Math.max(0, stockValue - alreadyInCart);
    if (!isRawEntry && quantity > availableToAdd) { setSaveMessage(`المخزون غير كافٍ (المتاح للإضافة: ${availableToAdd})`); setTimeout(() => setSaveMessage(""), 3000); return; }
    if (!isRawEntry && unitPrice < purchasePrice && unitPrice > 0) {
      if (!pendingBelowCostAdd) {
        setPendingBelowCostAdd(true);
        setSaveMessage(`تحذير: السعر (${formatMoney(unitPrice)}) أقل من سعر الشراء (${formatMoney(purchasePrice)}). اضغط إضافة مرة أخرى للتأكيد.`);
        setTimeout(() => { setSaveMessage(""); setPendingBelowCostAdd(false); }, 4000);
        return;
      }
      setPendingBelowCostAdd(false);
    }

    // The "expected" master price depends on which price-type the cashier chose.
    // wholesale = wholesale_price; retail = sale_price. Override is detected against
    // THIS expected price so legitimate wholesale sales don't light up amber.
    const expectedMaster = priceType === "wholesale" && Number(selectedItem.wholesale_price) > 0
      ? Number(selectedItem.wholesale_price)
      : Number(selectedItem.sale_price || selectedItem.price || 0);

    addLine({
      id: selectedItem.id,
      name: selectedItem.name,
      code: selectedItem.code || selectedItem.item_code || "",
      barcode: selectedItem.barcode || "",
      sale_price: unitPrice,
      master_sale_price: expectedMaster,
      price_type: priceType,
      category_name: selectedItem.category_name || "غير مصنف",
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      stock_quantity: stockValue,
      unit_name: unit?.name || unit?.symbol || selectedItem.unit_name || "قطعة",
      primary_image_url: getItemImage(selectedItem) || null,
      quantity,
      line_discount: lineDiscount,
    });
    playBeep();
    resetStaging();
  }

  // Today's receipts (handled by POSTodayModal component)

  // ── Save invoice ──────────────────────────────────────────────────────────────

  async function saveInvoice(printAfter, opts = {}) {
    if (!lines.length || isSaving) return;
    if (hasBlockingErrors && !stockOnlyErrors) {
      setSaveMessage("لا يمكن الحفظ قبل معالجة أخطاء السطور.");
      setTimeout(() => setSaveMessage(""), 5000);
      return;
    }
    if (lines.some((l) => l.item_id !== -1 && Number(l.unit_price || 0) <= 0)) {
      setSaveMessage("يوجد صنف بسعر غير صالح."); setTimeout(() => setSaveMessage(""), 5000); return;
    }
    if (!amendInvoiceId && stockLoaded && lines.some((l) => {
      if (l.item_id === -1) return false;
      const available = stockLevels[l.item_id]?.[l.warehouse_id];
      return available !== undefined && Number(l.quantity || 0) > available;
    })) {
      setSaveMessage("لا يمكن الحفظ: يوجد صنف يتجاوز المخزون."); setTimeout(() => setSaveMessage(""), 5000); return;
    }
    if ((paymentType === "credit" || paymentType === "installments") && !customer?.id) {
      setCustomerCreateOpen(true); setSaveMessage("البيع الآجل والأقساط تتطلب تحديد عميل."); return;
    }
    if (paymentType === "bank_transfer" && !selectedBankId && banks.length > 0) {
      setSaveMessage("يرجى اختيار البنك."); setTimeout(() => setSaveMessage(""), 4000); return;
    }
    if (paymentType === "multi") {
      const filteredCustomTotal = customPayMethods
        .filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦')
        .reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0);
      const multiTotal = (Number(multiCash)||0) + filteredCustomTotal + (Number(multiCredit)||0);
      if (Math.abs(totals.total - multiTotal) > 0.005) {
        setSaveMessage(`مجموع الدفع المتعدد لا يساوي الإجمالي (${formatMoney(totals.total)}).`);
        setTimeout(() => setSaveMessage(""), 5000); return;
      }
      if (Number(multiCredit) > 0 && (!customer || !customer.id)) {
        setSaveMessage("لا يمكن استخدام الآجل بدون اختيار عميل.");
        setTimeout(() => setSaveMessage(""), 5000); return;
      }
    }

    setIsSaving(true); setSaveMessage("");
    try {
      const hasBelowCost = lines.some((l) => {
        const item = items.find((e) => e.id === l.item_id);
        return Number(l.unit_price || 0) < Number(item?.purchase_price || 0);
      });
      const payload = {
        doc_no: docNo || undefined,
        created_at: invoiceCreatedAt || undefined,
        customer_id: customer?.id || null,
        seller_id: sellerId ? Number(sellerId) : null,
        // Auto-capture a walk-in WhatsApp number as a lead (only for anonymous sales)
        lead_capture: (!customer?.id && waLeadPhone.trim())
          ? { phone: waLeadPhone.trim(), name: waLeadName.trim() || null }
          : null,
        increase: Number(increase || 0),
        lines: lines.map((l) => ({
          item_id:      l.item_id,
          quantity:     Number(l.quantity || 0),
          unit_price:   Number(l.unit_price || 0),
          warehouse_id: l.warehouse_id || null,
          discount:     Number(l.line_discount || 0),
        })),
        discount,
        promotion_discount: promotionDiscount,
        payment_type: paymentType,
        amount_paid:  (paymentType === "credit" || paymentType === "installments") ? Math.max(0, paidAmountNumber) : totals.total,
        due_date:     paymentType === "installments" ? (installmentDueDate || null) : null,
        bank_id:      selectedBankId  ? Number(selectedBankId)  : null,
        treasury_id:  selectedTreasuryId ? Number(selectedTreasuryId) : null,
        payments:     paymentType === "multi" ? [
          ...(Number(multiCash) > 0 ? [{ method_id: null, method: "cash", amount: Number(multiCash) }] : []),
          ...customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦' && Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, amount: Number(multiCustomAmounts[m.id]) })),
          ...(Number(multiCredit) > 0 && customer?.id ? [{ method_id: null, method: "credit", amount: Number(multiCredit) }] : []),
        ] : [],
        allow_loss_sale:    hasBelowCost || Boolean(opts.allowLoss),
        supervisor_override: Boolean(opts.supervisorOverride),
      };
      let response;
      if (amendInvoiceId) {
        response = await api.put(`/api/invoices/${amendInvoiceId}`, payload);
        const savedData = response.data?.data;
        const savedNo = savedData?.invoice_no || amendContext?.prefill?.invoice_no || String(amendInvoiceId);
        const receiptSnap = {
          invoice_no: savedNo, date: new Date(), lines: [...lines],
          customer: customer ? { ...customer } : null, totals: { ...totals },
          discount, increase, promotionDiscount: 0, appliedPromotions: [],
          seller: employees.find((emp) => String(emp.id) === String(sellerId)) || null,
          paymentType, amountReceived: Number(amountReceived || 0),
          cashier: user?.name || "الكاشير",
          storeName: storeSettings.company_name || "المتجر",
          storeAddress: storeSettings.address || "",
          payments: [{ method: paymentType, method_name: { cash: "نقدي", credit: "آجل", bank_transfer: "بنك", multi: "متعدد" }[paymentType] || paymentType, amount: totals.total }],
        };
        setLastSavedInvoice(receiptSnap);
        setSaveSuccess({
          invoiceNumber: savedNo,
          total: formatMoney(totals.total),
          payments: receiptSnap.payments,
          customerName: customer?.name || null,
          customerNewBalance: customer?.id ? Number(customer.balance || 0) : null,
          discount: Number(discount || 0),
          increase: Number(increase || 0),
        });
        setSuccessNavigateTo("/pos");
        setAmendContext(null);
        resetActivation();
        clearActiveDraftFromDB();
        clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1);
        return;
      } else {
        response = await api.post("/api/invoices", payload);
      }
      const savedInvoiceNo = response.data?.data?.invoice_no || response.data?.data?.new_invoice?.invoice_no || invoiceNumber;
      const buildPaymentsSnap = () => {
        if (paymentType === "multi") {
          return [
            ...(Number(multiCash) > 0 ? [{ method: "cash", method_name: "نقدي", amount: Number(multiCash) }] : []),
            ...customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦' && Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, method_name: m.name, amount: Number(multiCustomAmounts[m.id]) })),
            ...(Number(multiCredit) > 0 && customer?.id ? [{ method: "credit", method_name: "آجل", amount: Number(multiCredit) }] : []),
          ];
        }
        const nameMap = { cash: "نقدي", credit: "آجل", bank: "بنك", installments: "أقساط" };
        return [{ method: paymentType, method_name: nameMap[paymentType] || paymentType, amount: totals.total }];
      };
      const receiptSnap = {
        invoice_no: savedInvoiceNo, date: new Date(), lines: [...lines],
        customer: customer ? { ...customer } : null, totals: { ...totals },
        discount, increase, promotionDiscount, appliedPromotions: [...(appliedPromotions || [])],
        seller: employees.find((emp) => String(emp.id) === String(sellerId)) || null,
        paymentType, amountReceived: Number(amountReceived || 0),
        cashier: user?.name || "الكاشير",
        storeName: storeSettings.company_name || "المتجر",
        storeAddress: storeSettings.address || "",
        payments: buildPaymentsSnap(),
      };
      setLastSavedInvoice(receiptSnap);
      const outstandingAdded =
        (paymentType === "credit" || paymentType === "installments")
          ? Math.max(0, totals.total - paidAmountNumber)
          : paymentType === "multi"
            ? Number(multiCredit) || 0
            : 0;
      const customerNewBalance = customer?.id ? Number(customer.balance || 0) + outstandingAdded : null;
      setSaveSuccess({
        invoiceNumber: savedInvoiceNo,
        total: formatMoney(totals.total),
        payments: receiptSnap.payments,
        customerName: customer?.name || null,
        customerNewBalance,
        discount: Number(discount || 0),
        increase: Number(increase || 0),
      });
      // Update local stock so next invoice sees current quantities without a reload
      const soldLines = lines;
      setStockLevels(prev => {
        const next = { ...prev };
        soldLines.forEach(l => {
          if (l.item_id === -1 || !next[l.item_id]) return;
          next[l.item_id] = { ...next[l.item_id] };
          const curr = Number(next[l.item_id][l.warehouse_id] ?? 0);
          next[l.item_id][l.warehouse_id] = Math.max(0, curr - Number(l.quantity || 0));
        });
        return next;
      });
      setItems(prev => prev.map(item => {
        const sold = soldLines.filter(l => l.item_id === item.id).reduce((s, l) => s + Number(l.quantity || 0), 0);
        return sold ? { ...item, stock_quantity: Math.max(0, Number(item.stock_quantity || 0) - sold) } : item;
      }));
      setAmendContext(null);
      resetActivation();
      clearActiveDraftFromDB();
      clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1);
      if (printAfter) setPrintPreview(true);
    } catch (error) {
      if (error.response?.status === 403 && error.response?.data?.code === "DISCOUNT_LIMIT_EXCEEDED") {
        setPendingSave({ printAfter, opts }); setSupervisorOverrideOpen(true);
      } else {
        setSaveMessage(error.response?.data?.message || "فشل حفظ الفاتورة.");
        setTimeout(() => setSaveMessage(""), 6000);
      }
    } finally { setIsSaving(false); }
  }

  saveInvoiceRef.current = saveInvoice;

  function onDismissSaveSuccess() {
    setSaveSuccess(null);
    if (successNavigateTo) {
      const target = successNavigateTo;
      setSuccessNavigateTo(null);
      navigate(target, { replace: true, state: null });
    }
  }

  async function confirmSupervisorOverride() {
    if (!pendingSave) return;
    setSupervisorOverrideOpen(false);
    const { printAfter, opts } = pendingSave;
    setPendingSave(null);
    await saveInvoice(printAfter, { ...opts, supervisorOverride: true });
  }

  // Invoice void and search are handled by POSTodayModal component

  function handleGridItemClick(item) {
    const warehouse = warehouses.find((w) => (stockLevels[item.id]?.[w.id] || 0) > 0) || (warehouses.length ? warehouses[0] : { id: "default", name: "المخزن الرئيسي" });
    const stockValue = Number(stockLevels[item.id]?.[warehouse.id] ?? item.stock_quantity ?? item.stock ?? 0);
    const salePrice = Number(item.sale_price || item.price || 0);

    if (salePrice <= 0) { setSaveMessage("لا يمكن إضافة صنف بسعر صفر."); setTimeout(() => setSaveMessage(""), 3000); return; }
    const alreadyInCart = lines.find(l => l.item_id === item.id && l.warehouse_id === warehouse.id)?.quantity || 0;
    const availableToAdd = Math.max(0, stockValue - alreadyInCart);
    if (!amendContext && stockLoaded && availableToAdd < 1) { setSaveMessage(`المخزون غير كافٍ (المتاح: ${availableToAdd})`); setTimeout(() => setSaveMessage(""), 3000); return; }

    addLine({
      id: item.id,
      name: item.name,
      code: item.code || item.item_code || "",
      barcode: item.barcode || "",
      sale_price: salePrice,
      category_name: item.category_name || "غير مصنف",
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      stock_quantity: stockValue,
      unit_name: item.unit_name || "قطعة",
      primary_image_url: getItemImage(item) || null,
      quantity: 1,
      line_discount: 0,
    });
    if (typeof playBeep === 'function') playBeep();
  }

  // Returns the hard stock ceiling for a cart line (warehouse-specific, falls back to item total)
  function getLineMaxStock(itemId, warehouseId) {
    if (!stockLoaded) return Infinity;
    const itemStock = stockLevels[itemId] || stockLevels[Number(itemId)] || stockLevels[String(itemId)];
    let currentStock;
    if (!itemStock) {
      return Infinity;
    } else if (warehouseId != null) {
      const val = itemStock[warehouseId] ?? itemStock[Number(warehouseId)] ?? itemStock[String(warehouseId)];
      currentStock = val !== undefined ? Number(val) : Object.entries(itemStock).filter(([k]) => k !== "null").reduce((a, [, b]) => a + Number(b), 0);
    } else {
      currentStock = Object.entries(itemStock).filter(([k]) => k !== "null").reduce((a, [, b]) => a + Number(b), 0);
    }
    if (amendContext) {
      // In amend mode the original invoice's stock is still consumed; add back the original qty so the user can go up to currentStock + originalQty
      const key = `${itemId}_${warehouseId ?? "null"}`;
      const origQty = amendOriginalQty[key] || 0;
      return currentStock + origQty;
    }
    return currentStock;
  }

  // ── Render ────────────────────────────────────────────────────────────────────


  const multiTotal = activeMultiPayments.reduce((acc, p) => acc + Number(p.amount), 0);

  // ── List-view helpers ────────────────────────────────────────────────────────
  const listItemInputRef = useRef(null);
  const listQtyRef       = useRef(null);
  const listPriceRef     = useRef(null);
  const listDiscRef      = useRef(null);
  const listWhRef        = useRef(null);
  const listAddBtnRef    = useRef(null);

  function handleListFieldKeyDown(e, nextRef, prevRef) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) { prevRef?.current?.focus(); prevRef?.current?.select?.(); }
      else { nextRef?.current?.focus(); nextRef?.current?.select?.(); }
    }
  }

  if (viewMode === "list") {
    return (
      <div className="flex h-screen flex-col bg-[#f8fafb] font-sans overflow-hidden animate-fade-in" dir="rtl">
        <BarcodeListener />
        {staleHeldAlert && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center" dir="rtl">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="text-[16px] font-black text-slate-800 mb-1">فواتير معلقة قديمة</h3>
              <p className="text-sm text-slate-500 mb-4">لديك فواتير معلقة منذ فترة طويلة. يرجى مراجعتها.</p>
              <button onClick={() => setStaleHeldAlert(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">
                حسناً
              </button>
            </div>
          </div>
        )}
        {isOffline && (
          <div className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-2sm font-black tracking-wide text-white shrink-0 z-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            تعذّر الاتصال بالخادم المحلي — بعض العمليات قد لا تعمل حتى يعود الاتصال
          </div>
        )}

        {/* Header like purchases/new */}
        <header className="flex h-14 shrink-0 items-center border-b border-slate-100 bg-white px-4 z-40 gap-4 shadow-[0_1px_8px_-4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-slate-800">فاتورة مبيعات جديدة</h1>
              <span className="text-[11px] font-bold text-slate-400">نقطة البيع - القائمة</span>
            </div>
            <div className="flex shrink-0 bg-slate-100 rounded-xl p-1 border border-slate-100">
              <button 
                onClick={() => { setViewMode("detailed"); setPendingViewMode("detailed"); setShowSetDefaultModal(true); }}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "detailed" ? "bg-white shadow text-indigo-600" : "text-slate-400 hover:text-slate-700"}`}
                title="عرض الشبكة"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setViewMode("list"); setPendingViewMode("list"); setShowSetDefaultModal(true); }}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow text-indigo-600" : "text-slate-400 hover:text-slate-700"}`}
                title="عرض القائمة"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-1 justify-center min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <Receipt className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                readOnly
                disabled
                value={invoiceIsActive ? (docNo || invoiceNumber) : "—"}
                className="w-[165px] rounded-sm border border-slate-200 bg-slate-100 px-2 py-1 text-2sm font-mono font-black text-slate-600 cursor-default text-center select-none disabled:opacity-70"
              />
              {invoiceIsActive && invoiceCreatedAt && (
                <input readOnly disabled
                  value={new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" }).format(new Date(invoiceCreatedAt))}
                  className="w-[130px] rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono font-bold text-slate-400 cursor-default text-center select-none disabled:opacity-70"
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1 shrink-0">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-2sm font-bold text-slate-600 max-w-[100px] truncate">{user?.name || "-"}</span>
            </div>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-2sm font-bold text-slate-700 outline-none focus:border-slate-800 min-w-[130px]"
            >
              <option value="">البائع (اختياري)</option>
              {employees.filter((emp) => emp.is_active !== 0).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setReceiptsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-all"
              title="فواتير اليوم"
            >
              <ListTodo className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAdvancedSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-all"
              title="بحث متقدم في المخزون"
            >
              <Filter className="h-4 w-4" />
            </button>
            <PermissionGate page="pos" action="profit">
              <button
                onClick={() => setProfitModalOpen(true)}
                disabled={!lines.length}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all disabled:opacity-40"
                title="تحليل ربح الفاتورة"
              >
                <TrendingUp className="h-4 w-4" />
              </button>
            </PermissionGate>
            <PermissionGate page="pos" action="print">
              <button
                onClick={() => setPrintPreview(true)}
                disabled={!lines.length || isSaving || (hasBlockingErrors && !stockOnlyErrors)}
                className={`flex h-9 items-center gap-2 rounded-sm px-6 text-sm font-black text-white transition-all disabled:opacity-50
                  ${hasBlockingErrors && !stockOnlyErrors && lines.length ? "bg-rose-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                <Printer className="h-4 w-4" /> طباعة ومراجعة المستند
                {hasBlockingErrors && <span className="ml-1.5 rounded-full bg-rose-400 text-white text-[9px] font-black px-1.5 py-0.5">{blockingErrorCount}</span>}
              </button>
            </PermissionGate>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
          
          {/* Right Sidebar (Customer, Summary, Payment) */}
          <aside className="w-[400px] shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar animate-fade-in">
            {/* Customer Card */}
            <div className="shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">العميل</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQuickAddOpen(true)} title="إضافة رقم واتساب سريع" className="flex h-6 items-center gap-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors px-2 text-[10px] font-black">
                    <span>📱</span> رقم سريع
                  </button>
                  <button onClick={() => setCustomerCreateOpen(true)} title="إنشاء عميل جديد" className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {customer && customer.id && (
                    <button
                      onClick={() => { setCustomer(null); setCustomerQuery(""); setPaymentType("cash"); }}
                      title="إلغاء تحديد العميل"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerQuery}
                  placeholder={customer?.id ? customer.name : "ابحث عن عميل..."}
                  onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); if (!e.target.value) { setCustomer(null); setPaymentType("cash"); } }}
                  onFocus={() => { if (!customer?.id) setCustomerQuery(""); setCustomerLookupOpen(true); }}
                  onBlur={() => { setTimeout(() => { setCustomerLookupOpen(false); if (!customer?.id) setCustomerQuery(""); }, 200); }}
                  onKeyDown={handleCustomerKeyDown}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
                {customerLookupOpen && (
                  <SearchDropdown
                    items={customerResults}
                    onPick={handlePickCustomer}
                    activeIndex={activeCustomerIndex}
                    query={customerQuery}
                    emptyLabel="لم يتم العثور على عميل"
                  />
                )}
              </div>
              {customer?.id && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-2sm font-black text-emerald-800 truncate">{customer.name}</span>
                  {customer.phone && <span className="text-[11px] text-emerald-600 mr-auto shrink-0 font-mono">{customer.phone}</span>}
                  <button onClick={() => setCustomerInfoOpen(true)} title="بيانات العميل" className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-200 hover:text-emerald-700 transition-colors mr-auto">
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              )}
              {!customer?.id && customers.length > 0 && (
                <div className="mt-2.5">
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5">اختيار سريع:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {customers.slice(0, 4).map(c => (
                      <button
                        key={c.id}
                        onClick={() => handlePickCustomer(c)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Optional WhatsApp number → auto-saved as a lead on sale completion (anonymous sale only) */}
              {!customer?.id && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50/50 px-2.5 py-1.5">
                  <span className="text-sm shrink-0">📱</span>
                  <input
                    type="tel"
                    dir="ltr"
                    value={waLeadPhone}
                    onChange={(e) => setWaLeadPhone(e.target.value)}
                    placeholder="واتساب (اختياري) — يُحفظ مع البيع"
                    className="flex-1 min-w-0 bg-transparent text-[12px] font-bold text-slate-700 outline-none placeholder:text-green-600/60 placeholder:font-normal text-right"
                  />
                </div>
              )}
            </div>

            {/* Invoice Summary */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                  <Receipt className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ملخص الفاتورة</h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-2sm font-bold text-slate-500">إجمالي الأصناف</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{lines.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-2sm font-bold text-slate-500">مجموع الكميات</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{lines.reduce((acc, l) => acc + Number(l.quantity), 0)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-2sm font-bold text-slate-500">الإجمالي الفرعي</span>
                  <span className="text-sm font-black font-mono text-slate-800">{formatMoney(totals.subtotal)}</span>
                </div>

                <div className="h-px bg-slate-100 my-1" />

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> خصم الفاتورة
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={invoiceDiscountMode === "pct"
                        ? (totals.subtotal > 0 ? parseFloat(((discount / totals.subtotal) * 100).toFixed(2)) : 0)
                        : discount}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        if (invoiceDiscountMode === "pct") {
                          setDiscount(Math.min(parseFloat(((v / 100) * totals.subtotal).toFixed(4)), totals.subtotal));
                        } else {
                          setDiscount(Math.min(v, totals.subtotal));
                        }
                      }}
                      className="flex-1 min-w-0 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2 text-sm font-black text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-center transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceDiscountMode((m) => m === "pct" ? "flat" : "pct")}
                      title={invoiceDiscountMode === "pct" ? "تغيير إلى قيمة ثابتة" : "تغيير إلى نسبة مئوية"}
                      className={`h-[40px] px-3 rounded-lg text-2sm font-black border transition-all shrink-0
                        ${invoiceDiscountMode === "pct"
                          ? "bg-rose-100 border-rose-300 text-rose-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                    >
                      {invoiceDiscountMode === "pct" ? "%" : "ج"}
                    </button>
                  </div>
                  {discount > 0 && invoiceDiscountMode === "flat" && totals.subtotal > 0 && (
                    <span className="text-[11px] font-mono text-rose-400 px-1">{((discount / totals.subtotal) * 100).toFixed(1)}% من الإجمالي</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> إضافة / رسوم
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={invoiceIncreaseMode === "pct"
                        ? (totals.subtotal > 0 ? parseFloat(((increase / totals.subtotal) * 100).toFixed(2)) : 0)
                        : increase}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        if (invoiceIncreaseMode === "pct") {
                          setIncrease(parseFloat(((v / 100) * totals.subtotal).toFixed(4)));
                        } else {
                          setIncrease(v);
                        }
                      }}
                      className="flex-1 min-w-0 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-black text-blue-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-center transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceIncreaseMode((m) => m === "pct" ? "flat" : "pct")}
                      title={invoiceIncreaseMode === "pct" ? "تغيير إلى قيمة ثابتة" : "تغيير إلى نسبة مئوية"}
                      className={`h-[40px] px-3 rounded-lg text-2sm font-black border transition-all shrink-0
                        ${invoiceIncreaseMode === "pct"
                          ? "bg-blue-100 border-blue-300 text-blue-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                    >
                      {invoiceIncreaseMode === "pct" ? "%" : "ج"}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-100 my-1" />

                <div className="rounded-2xl bg-slate-950 p-4 text-center text-white shadow-lg">
                  <div className="text-[11px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                  <div className="text-[32px] font-black tracking-tighter font-mono leading-none mt-1.5">
                    {totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] opacity-40 mt-1">ج.م</div>
                </div>

                {hasBlockingErrors && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-3">
                    <div className="text-[11px] font-black text-rose-700 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> تحذيرات تمنع الحفظ
                    </div>
                    {Object.entries(lineWarnings).flatMap(([itemId, ws]) =>
                      ws.filter((w) => w.type === "error").map((w, i) => {
                        const l = lines.find((ln) => String(ln.item_id) === String(itemId));
                        return (
                          <div key={`${itemId}-${i}`} className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" /> {l?.item_name || itemId}: {w.msg}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Amend: original invoice summary in payment panel */}
            {amendContext && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> الفاتورة الأصلية المُعدَّلة
                  </span>
                  <button onClick={() => setShowAmendSummary(false)} className="text-amber-400 hover:text-amber-700">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {showAmendSummary && (
                  <div className="space-y-1 text-[11px] font-bold text-amber-800">
                    {/* Locked fields — preserved by in-place edit */}
                    <div className="flex gap-1.5 mb-2">
                      <input disabled value={amendContext.prefill?.invoice_no || `#${amendContext.edit_invoice_id}`}
                        className="flex-1 h-7 rounded-sm border border-amber-200 bg-amber-100/60 px-2 text-[11px] font-mono font-black text-amber-700 cursor-not-allowed outline-none" />
                      <input disabled value={amendContext.prefill?.created_at ? new Date(amendContext.prefill.created_at).toLocaleString("en-US") : ""}
                        className="flex-1 h-7 rounded-sm border border-amber-200 bg-amber-100/60 px-2 text-[11px] font-mono font-black text-amber-700 cursor-not-allowed outline-none" />
                    </div>
                    {amendContext.prefill?.customer_name && (
                      <div className="flex justify-between"><span className="text-amber-600">العميل</span><span>{amendContext.prefill.customer_name}</span></div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-amber-600">الإجمالي</span>
                      <span className="font-mono">{(() => {
                        const lines = amendContext.prefill?.lines || [];
                        const sub = lines.reduce((s, l) => s + (Number(l.unit_price||0) * Number(l.quantity||1) * (1 - Number(l.discount||0)/100)), 0);
                        return (sub - (amendContext.prefill?.discount||0) + (amendContext.prefill?.increase||0)).toLocaleString("en-US", { minimumFractionDigits: 2 });
                      })()} ج.م</span>
                    </div>
                    <div className="flex justify-between"><span className="text-amber-600">الأصناف</span><span>{(amendContext.prefill?.lines||[]).length} صنف</span></div>
                    <div className="flex justify-between">
                      <span className="text-amber-600">الدفع</span>
                      <span>{{cash:"نقدي",credit:"آجل",bank_transfer:"بنك/فيزا",installments:"أقساط",multi:"متعدد"}[amendContext.prefill?.payment_type] || amendContext.prefill?.payment_type || "—"}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-amber-600">بواسطة</span><span>{amendContext.prefill?.created_by_username || "—"}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_TYPES.filter(({ type }) => !(type === "bank_transfer" && banks.length === 0)).map(({ type, label, desc, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && (type === "credit" || type === "installments" || type === "bank_transfer");
                  const isActive = paymentType === type;
                  const colorMap = {
                    cash: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", ring: "ring-emerald-200", activeBg: "bg-emerald-600" },
                    bank_transfer: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", ring: "ring-blue-200", activeBg: "bg-blue-600" },
                    credit: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", ring: "ring-amber-200", activeBg: "bg-amber-600" },
                    installments: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", ring: "ring-violet-200", activeBg: "bg-violet-600" },
                    multi: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", ring: "ring-slate-200", activeBg: "bg-slate-700" },
                  };
                  const c = colorMap[type];
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && setPaymentType(type)}
                      disabled={isDisabled}
                      title={isDisabled ? "يجب اختيار عميل مسجل أولاً" : undefined}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all duration-150 ${
                        isActive
                          ? `${c.activeBg} text-white border-transparent shadow-md ring-2 ${c.ring} ring-offset-1`
                          : isDisabled
                            ? "border-slate-100 opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"
                            : `border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-px text-slate-700 bg-white`
                      }`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isActive ? "bg-white/20" : c.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : c.text}`} />
                      </div>
                      <span className="text-[11px] font-black leading-tight whitespace-nowrap">{label}</span>
                      <span className={`text-[8.5px] font-medium leading-tight text-center mt-0.5 transition-colors duration-150 ${
                        isActive ? "text-white/80" : "text-slate-400"
                      }`}>{desc}</span>
                      {isActive && <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-white/80" />}
                    </button>
                  );
                })}
              </div>

              {/* Payment extra inputs */}
              {paymentType === "bank_transfer" && (
                <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-blue-50/50 border border-blue-100 p-3">
                  <label className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" /> اختر البنك / البطاقة
                  </label>
                  <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-2sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all">
                    <option value="">اختر البنك / البطاقة</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {paymentType === "credit" && customer && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[11px] text-amber-800 font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>سيتم إضافة {formatMoney(totals.total)} لرصيد {customer.name}</span>
                </div>
              )}
              {paymentType === "installments" && (
                <div className="mt-4 flex flex-col gap-2.5 rounded-xl bg-violet-50/50 border border-violet-100 p-4">
                  <div className="text-[11px] font-black text-violet-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> إعداد الأقساط
                  </div>
                  <div className="flex flex-col divide-y divide-violet-100/60">
                    <div className="flex items-center gap-3 py-2 first:pt-0">
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600">💰 دفعة مقدم</span>
                      <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" className="w-28 shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-2sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                    </div>
                    <div className="flex items-center gap-3 py-2 last:pb-0">
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600">📅 تاريخ استحقاق القسط</span>
                      <input type="date" dir="ltr" value={installmentDueDate} onChange={e => setInstallmentDueDate(e.target.value)} className="w-36 shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                    </div>
                  </div>
                  {customer && (
                    <div className="text-[11px] font-black text-violet-700 bg-violet-100/60 rounded-lg px-3 py-1.5 text-center border border-violet-200">
                      المتبقي كأقساط: {formatMoney(Math.max(0, totals.total - Number(amountPaid || 0)))} على {customer.name}
                    </div>
                  )}
                </div>
              )}
              {paymentType === "multi" && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50/60 border border-slate-200 p-4">
                  <div className="text-[11px] font-black text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> تفاصيل الدفع المتعدد
                  </div>
                  <div className="flex flex-col divide-y divide-slate-100">
                    {/* Cash */}
                    <div className="flex items-center gap-3 py-2 first:pt-0">
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 leading-snug">💵 نقدي</span>
                      <input type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00"
                        className="w-28 shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-black text-slate-800 text-left outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                    {/* Custom methods */}
                    {customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').map(m => (
                      <div key={m.id} className="flex items-center gap-3 py-2">
                        <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 leading-snug break-words">{m.icon} {m.name}</span>
                        <input type="number" min="0" value={multiCustomAmounts[m.id] || ""} onChange={(e) => setMultiCustomAmounts(prev => ({...prev, [m.id]: e.target.value}))} placeholder="0.00"
                          className="w-28 shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-2sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                      </div>
                    ))}
                    {/* Credit */}
                    <div className="flex items-center gap-3 py-2 last:pb-0">
                      <span className={`flex-1 min-w-0 text-2sm font-bold leading-snug ${customer?.id ? 'text-amber-700' : 'text-slate-400'}`}>📋 آجل</span>
                      <input type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)}
                        placeholder={customer?.id ? "0.00" : "اختر عميل..."}
                        disabled={!customer?.id}
                        className={`w-28 shrink-0 rounded-lg px-3 py-1.5 text-2sm font-black text-left outline-none transition-all ${customer?.id ? 'border border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`} />
                    </div>
                  </div>
                  {/* Total bar */}
                  {(() => {
                    const entered = (Number(multiCash)||0) + customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0) + (Number(multiCredit)||0);
                    const balanced = Math.abs(entered - totals.total) < 0.01;
                    return (
                      <div className={`flex items-center justify-between rounded-lg px-3 py-2 border text-[11px] font-black ${balanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        <span>المُدخل</span>
                        <span className="font-mono">{formatMoney(entered)} / {formatMoney(totals.total)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Customer detail when selected */}
            {customer && customer.id && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-sm font-black">{(customer.name || "?")[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-800 truncate">{customer.name}</p>
                      <button onClick={() => setCustomerInfoOpen(true)} title="بيانات العميل" className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {customer.phone && <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{customer.phone}</p>}
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="text-[11px] font-bold text-slate-500">{amendContext ? "الرصيد قبل التعديل" : "الرصيد الحالي"}</span>
                      <span className={`text-sm font-black font-mono ${displayBalance > 0 ? "text-rose-600" : "text-slate-800"}`}>{displayBalance.toFixed(3)}</span>
                    </div>
                    {creditEffect > 0 && lines.length > 0 && (
                      <div className="mt-1.5 space-y-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-600">
                            {paymentType === "installments" ? "الإضافة للأقساط" : paymentType === "multi" ? "الإضافة للآجل" : "الإضافة للرصيد"}
                          </span>
                          <span className="text-sm font-black font-mono text-amber-700">
                            +{creditEffect.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-amber-200/60 pt-1">
                          <span className="text-[11px] font-bold text-amber-600">
                            {paymentType === "installments" ? "الرصيد بعد الأقساط" : paymentType === "multi" ? "الرصيد بعد الآجل" : "الرصيد بعد الفاتورة"}
                          </span>
                          <span className={`text-sm font-black font-mono ${displayBalance + creditEffect > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {(displayBalance + creditEffect).toFixed(3)}
                          </span>
                        </div>
                      </div>
                    )}

                  

                    {selectedTreasuryId && (paymentType === "cash" || paymentType === "multi") && lines.length > 0 && (
                      <div className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1.5">
                        <span className="text-[11px] font-bold text-emerald-600">الخزينة بعد الفاتورة</span>
                        <span className="text-2sm font-black font-mono text-emerald-700">
                          {(Number(treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.balance || 0) + totals.total).toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2.5">
                <PermissionGate page="pos" action="print">
                  <button
                    data-help="confirm-button"
                    onClick={() => setPrintPreview(true)}
                    disabled={!lines.length || isSaving || hasBlockingErrors}
                    className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-white transition-all shadow-md active:scale-[0.98] ${!lines.length || isSaving || hasBlockingErrors ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100"}`}
                  >
                    <Printer className="h-5 w-5" /> طباعة ومراجعة المستند
                  </button>
                </PermissionGate>
                <div className="flex gap-2">
                  <PermissionGate page="pos" action="add">
                    <button
                      type="button"
                      onClick={() => setSaveConfirmOpen(true)}
                      disabled={!lines.length || isSaving || hasBlockingErrors}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-2sm font-black transition-all ${!lines.length || isSaving || hasBlockingErrors ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}
                    >
                      حفظ فقط
                    </button>
                  </PermissionGate>
                  <PermissionGate page="pos" action="void">
                    <button
                      type="button"
                      onClick={() => setCancelModalOpen(true)}
                      disabled={!lines.length}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-2sm font-black text-rose-700 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Trash2 className="h-4 w-4" /> إلغاء
                    </button>
                  </PermissionGate>
                  <button
                    type="button"
                    onClick={() => setNewInvoiceModalOpen(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                  >
                    <FilePlus className="h-4 w-4" /> جديدة
                  </button>
                </div>
                {heldInvoices.length > 0 && (
                  <div className="relative mt-2">
                    <button
                      data-help="hold-button"
                      type="button"
                      onClick={() => setHeldDropdownOpen((v) => !v)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-black transition-all ${(() => {
                        const yellowHours = Number(storeSettings?.held_yellow_hours || 2);
                        const redHours = Number(storeSettings?.held_red_hours || 8);
                        const now = Date.now();
                        const maxAge = Math.max(...heldInvoices.map((h) => (now - new Date(h.heldAt).getTime()) / 3_600_000));
                        if (maxAge >= redHours) return "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 animate-pulse";
                        if (maxAge >= yellowHours) return "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100";
                        return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-300";
                      })()}`}
                    >
                      <div className="flex items-center gap-2">
                        <PauseCircle className="h-5 w-5" />
                        <span>فواتير معلقة ({heldInvoices.length})</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${heldDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {heldDropdownOpen && (
                      <HeldDropdown heldInvoices={heldInvoices} onResume={(id) => { if (lines.length) holdCurrentInvoice(); resumeHeldInvoice(id); setHeldDropdownOpen(false); }} onDiscard={discardHeldInvoice} onClose={() => setHeldDropdownOpen(false)} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>


          {/* Main Content (Entry & Grid) */}
          <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
            {/* Quick Entry Bar */}
            <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shrink-0">
              <div className="grid grid-cols-[44px_3fr_80px_120px_80px_160px_100px_auto] gap-2 items-end">
                <div className="flex items-end pb-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedItem) return;
                      const imgs = Array.isArray(selectedItem.image_urls) && selectedItem.image_urls.length
                        ? selectedItem.image_urls
                        : selectedItem.primary_image_url
                          ? [selectedItem.primary_image_url]
                          : [];
                      openGallery(imgs);
                    }}
                    disabled={!selectedItem}
                    className={`w-[42px] h-[37px] rounded-sm border flex items-center justify-center overflow-hidden transition-all
                      ${selectedItem?.primary_image_url
                        ? "border-slate-300 bg-slate-100 hover:border-indigo-400 cursor-pointer"
                        : "border-dashed border-slate-300 bg-slate-50 cursor-default opacity-60"}`}
                    title={selectedItem?.primary_image_url ? "عرض صورة الصنف" : "لا توجد صورة"}
                  >
                    {selectedItem?.primary_image_url
                      ? <img src={resolveImageUrl(selectedItem.primary_image_url)} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-4 h-4 text-slate-300" />
                    }
                  </button>
                </div>
                {/* Item search */}
                <div data-help="search-bar" className="relative flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                  <div className="relative">
                    <SearchInput
                      ref={listItemInputRef}
                      value={itemNameQuery}
                      onChange={(val) => { setItemNameQuery(val); setItemLookupOpen(true); setSelectedItem(null); }}
                      onFocus={(e) => { setItemLookupOpen(true); e.target.select(); }}
                      onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                      placeholder="ابحث بالاسم، الباركود، أو الكود..."
                      onKeyDown={(e) => {
                          if (e.key === "Enter") {
                             e.preventDefault();
                             const q = itemNameQuery.trim();
                             if (itemResults.length > 0) {
                               const idx = activeLookupIndex >= 0 ? activeLookupIndex : 0;
                               handleSelectItem(itemResults[idx]);
                               setTimeout(() => listWhRef.current?.focus(), 50);
                             }
                             // no-op if empty or results not loaded yet — don't create phantom raw entries or move focus
                         } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setActiveLookupIndex(prev => (prev < itemResults.length ? prev + 1 : prev));
                         } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setActiveLookupIndex(prev => (prev > 0 ? prev - 1 : 0));
                         }
                      }}
                    />
                    {itemLookupOpen && (
                      <SearchDropdown
                        items={itemResults}
                        onPick={(item) => { handleSelectItem(item); }}
                        activeIndex={activeLookupIndex}
                        query={itemNameQuery}
                        onLoadMore={loadMorePOSItems}
                        hasMoreFromServer={searchedItemHasMore}
                        isLoadingMore={isLoadingMoreItems}
                      />
                    )}
                  </div>
                  {selectedItem && (
                    <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-sm px-2 py-0.5 mt-0.5">
                      <span className="font-mono text-[11px] font-black text-indigo-700 shrink-0">
                        {selectedItem.item_code || selectedItem.code || `#${selectedItem.id}`}
                      </span>
                      <div className="h-3 w-px bg-indigo-300 shrink-0" />
                      <span className="text-[11px] text-indigo-600 font-bold truncate">{selectedItem.name}</span>
                    </div>
                  )}
                </div>

                {/* Qty */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                  <input
                    ref={listQtyRef}
                    type="number"
                    min={selectedItem && units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "0.001"}
                    step={selectedItem && units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "any"}
                    value={staging.quantity}
                    onChange={(e) => {
                      const u = selectedItem ? units.find(u => String(u.id) === String(staging.unitId)) : null;
                      const v = u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value;
                      setStaging(s => ({ ...s, quantity: v }));
                    }}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listPriceRef, listWhRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-2sm font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Price */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-bold text-slate-600">السعر</label>
                  <select
                    value={priceType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setPriceType(t);
                      if (!selectedItem) return;
                      if (t === "wholesale" && Number(selectedItem.wholesale_price) > 0) {
                        setStaging((s) => ({ ...s, unitPrice: String(Number(selectedItem.wholesale_price)) }));
                      } else {
                        setStaging((s) => ({ ...s, unitPrice: String(Number(selectedItem.sale_price || selectedItem.price || 0)) }));
                      }
                    }}
                    className="w-full h-[22px] border border-slate-300 rounded-sm bg-slate-50 px-1 text-[11px] font-bold text-slate-700 outline-none focus:border-slate-800"
                  >
                    <option value="retail">سعر المستهلك</option>
                    {selectedItem && Number(selectedItem.wholesale_price) > 0 && (
                      <option value="wholesale">سعر الجملة</option>
                    )}
                  </select>
                  <input
                    ref={listPriceRef}
                    type="number"
                    step="any"
                    value={staging.unitPrice}
                    onChange={(e) => canOverridePrice && setStaging(s => ({ ...s, unitPrice: e.target.value }))}
                    onFocus={e => canOverridePrice && e.target.select()}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listDiscRef, listQtyRef)}
                    readOnly={!canOverridePrice}
                    title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : undefined}
                    className={`w-full h-[30px] border rounded-sm py-1 px-2 text-2sm font-black outline-none text-center transition-colors
                      ${!canOverridePrice
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                        : selectedItem && Number(staging.unitPrice) > 0 && Number(staging.unitPrice) < Number(selectedItem.purchase_price || 0)
                          ? "border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-600"
                          : "bg-slate-50 border-slate-300 text-slate-800 focus:border-slate-800"}`}
                  />
                  <div className="h-[20px] flex items-center justify-center rounded-sm bg-slate-100 border border-slate-200 px-1">
                    <span className="text-[11px] font-mono text-slate-400">
                      {lastSalePrice !== null
                        ? `آخر بيع: ${Number(lastSalePrice).toFixed(2)}`
                        : "لا يوجد سابق"}
                    </span>
                  </div>
                </div>

                {/* Discount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">خصم</label>
                  <input
                    ref={listDiscRef}
                    type="number"
                    min="0"
                    step="any"
                    value={staging.lineDiscount}
                    onChange={(e) => setStaging(s => ({ ...s, lineDiscount: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listAddBtnRef, listPriceRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-2sm font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Warehouse */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600 truncate">الرصيد / المخزن</label>
                  <div
                    ref={listWhRef}
                    tabIndex={0}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listQtyRef, listItemInputRef)}
                    className="max-h-[96px] overflow-y-auto border border-slate-300 rounded-sm bg-slate-50 flex flex-col divide-y divide-slate-100 custom-scrollbar outline-none focus:border-slate-600"
                  >
                    {!selectedItem ? (
                      <div className="px-2 py-3 text-[11px] text-slate-400 font-bold text-center">اختر صنفاً أولاً</div>
                    ) : (
                      (() => {
                        // In amend mode, show all warehouses (effective stock = current + original qty for this item/warehouse)
                        const stocked = amendContext
                          ? warehouses
                          : warehouses.filter((w) => (stockLevels[selectedItem.id]?.[w.id] || 0) > 0);
                        if (stocked.length === 0) {
                          return (
                            <div className="px-2 py-2.5 text-[11px] text-rose-600 font-bold text-center flex items-center justify-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />لا يوجد مخزون لهذا الصنف
                            </div>
                          );
                        }
                        return stocked.map((w) => {
                          const rawQty = stockLevels[selectedItem.id]?.[w.id] || 0;
                          const origQty = amendContext ? (amendOriginalQty[`${selectedItem.id}_${w.id}`] || 0) : 0;
                          const inCart = lines.find(l => String(l.item_id) === String(selectedItem.id) && String(l.warehouse_id) === String(w.id))?.quantity || 0;
                          const qty = Math.max(0, rawQty + origQty - inCart);
                          const isSelected = String(staging.warehouseId) === String(w.id);
                          const isLow = qty > 0 && qty < 5;
                          const isInsuff = Number(staging.quantity) > qty;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setStaging((s) => ({ ...s, warehouseId: String(w.id) }))}
                              className={`flex items-center gap-2 px-2 py-1.5 text-right transition-colors
                                ${isSelected
                                  ? "bg-emerald-50 text-emerald-800"
                                  : isInsuff
                                    ? "bg-rose-50/50 text-slate-700 hover:bg-rose-50"
                                    : "hover:bg-slate-100 text-slate-700"}`}
                            >
                              <div className={`h-2.5 w-2.5 rounded-full border-2 shrink-0 transition-colors
                                ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}
                              />
                              <span className="flex-1 truncate text-[11px] font-bold">{w.name}</span>
                              <span className={`font-mono text-[11px] font-black rounded-sm px-1 shrink-0
                                ${isInsuff
                                  ? "text-rose-700 bg-rose-100"
                                  : isLow
                                    ? "text-amber-700 bg-amber-100"
                                    : "text-slate-400"}`}
                              >
                                {qty}
                              </span>
                            </button>
                          );
                        });
                      })()
                    )}
                  </div>
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

                {/* Add */}
                <button
                  ref={listAddBtnRef}
                  onClick={addCurrentLine}
                  disabled={!selectedItem}
                  onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addCurrentLine(); } }}
                  className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-slate-800 px-4 text-2sm font-bold text-white hover:bg-slate-700 disabled:opacity-40 self-end transition-all"
                >
                  <Plus className="h-4 w-4" /> إضافة
                </button>
                {selectedItem && staging.warehouseId && (() => {
                  const itemStock = stockLevels[selectedItem?.id] || stockLevels[String(selectedItem?.id)];
                  const totalStock = Number(itemStock?.[staging.warehouseId] ?? itemStock?.[String(staging.warehouseId)] ?? itemStock?.[Number(staging.warehouseId)] ?? 0);
                  const inCart = lines.find(l => String(l.item_id) === String(selectedItem.id) && String(l.warehouse_id) === String(staging.warehouseId))?.quantity || 0;
                  const remaining = Math.max(0, totalStock - inCart);
                  return Number(staging.quantity) > remaining ? (
                    <div className="col-span-full flex items-center gap-1.5 rounded-sm bg-rose-50 border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      الكمية ({staging.quantity}) تتجاوز المتاح للإضافة ({remaining}) — الرصيد الكلي {totalStock}{inCart > 0 ? ` (${inCart} في السلة)` : ""}
                    </div>
                  ) : null;
                })()}
                {selectedItem && Number(staging.unitPrice) > 0 && Number(staging.unitPrice) < Number(selectedItem.purchase_price || 0) && (
                  <div className="col-span-full flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    السعر أقل من سعر الشراء ({Number(selectedItem.purchase_price).toFixed(2)}) - ستحتاج موافقة مشرف
                  </div>
                )}
              </div>
            </section>

            {/* Lines DataGrid */}
            <DataGrid
              data-help="cart"
              data={lines}
              rowKey={(row, i) => `${row.item_id}-${i}`}
              emptyMessage="لا يوجد أصناف في الفاتورة بعد"
              emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
              className="border-0"
              containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent rounded-2xl border border-slate-100 min-h-0"
              columns={[
                {
                  id: "index", header: "#", width: 40, sortable: false,
                  headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100",
                  render: (_, i) => i + 1
                },
                {
                  id: "sku",
                  header: "الكود",
                  width: 85,
                  sortable: false,
                  headerClass: "text-center px-1",
                  cellClass: "font-mono text-[11px] text-slate-500 text-center border-l border-slate-100 px-1",
                  render: (l) => {
                    const item = items.find((it) => it.id === l.item_id);
                    return <span>{item?.item_code || item?.code || l.code || "-"}</span>;
                  }
                },
                {
                  id: "name", header: "البيان", width: 240, sortable: true,
                  cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                  render: (l) => {
                    const item = items.find(it => it.id === l.item_id);
                    const imgUrl = item?.primary_image_url || item?.image_url || item?.image || l.primary_image_url;
                    const resolved = imgUrl ? resolveImageUrl(imgUrl) : null;
                    const warnings = lineWarnings[l.item_id] || [];
                    const hasError = warnings.some((w) => w.type === "error");
                    return (
                      <div className="flex items-start gap-2 py-1 w-full">
                        {resolved ? (
                          <button
                            type="button"
                            onClick={() => {
                              const imgs = item?.image_urls?.length ? item.image_urls : [resolved];
                              openGallery(imgs);
                            }}
                            className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200 hover:border-indigo-300"
                          >
                            <img src={resolved} alt={l.item_name} className="w-8 h-8 object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Search className="w-3 h-3 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className={`truncate text-2sm font-black ${hasError ? "text-rose-700" : "text-slate-800"}`}>
                            {l.item_name}
                          </span>
                          {warnings.map((w, i) => (
                            <span key={i} className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm w-fit
                              ${w.type === "error"
                                ? "text-rose-600 bg-rose-50 border border-rose-200"
                                : "text-amber-700 bg-amber-50 border border-amber-200"}`}>
                              {w.msg}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                },
                {
                  id: "quantity", header: "الكمية", width: 80, sortable: true,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l, i) => {
                    const maxStock = getLineMaxStock(l.item_id, l.warehouse_id);
                    const hasLimit = stockLoaded && maxStock !== Infinity;
                    const atLimit  = hasLimit && Number(l.quantity) >= maxStock;
                    const remaining = hasLimit ? maxStock - Number(l.quantity) : null;
                    return (
                    <div className={`w-full h-[40px] flex flex-col items-center justify-center transition-colors ${atLimit ? 'bg-rose-50' : ''}`}
                      title={hasLimit ? `المتاح: ${maxStock}` : undefined}>
                      <input
                        type="number" min="1" step="1"
                        value={l.quantity}
                        max={hasLimit ? maxStock : undefined}
                        onKeyDown={(e) => {
                          if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) { e.preventDefault(); return; }
                          if (hasLimit && e.key >= '0' && e.key <= '9') {
                            const next = Number(String(l.quantity) + e.key);
                            if (next > maxStock) e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const v = Math.max(1, Math.floor(Number(e.target.value) || 1));
                          updateLine(l.item_id, { quantity: hasLimit ? Math.min(v, maxStock) : v });
                        }}
                        className={`w-full text-center text-sm font-mono font-black bg-transparent outline-none border-0 ring-0 leading-none ${atLimit ? 'text-rose-600' : ''}`}
                      />
                      {hasLimit && (
                        <span className={`text-[9px] font-black leading-none ${atLimit ? 'text-rose-500' : 'text-slate-400'}`}>
                          {atLimit ? 'نفد المخزون' : `متاح ${remaining}`}
                        </span>
                      )}
                    </div>
                    );
                  }
                },
                {
                  id: "unitPrice", header: "السعر", width: 100, sortable: true,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l) => {
                    const isOverride = l.item_id !== -1 && l.master_sale_price > 0 && Math.abs(Number(l.unit_price) - Number(l.master_sale_price)) > 0.001;
                    return (
                      <div className="relative w-full h-full" title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : undefined}>
                        <input type="number" step="any" value={l.unit_price}
                          onChange={(e) => canOverridePrice && updateLine(l.item_id, { unit_price: Number(e.target.value) || 0 })}
                          readOnly={!canOverridePrice}
                          className={`w-full h-[40px] text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors ${
                            !canOverridePrice ? "bg-slate-50 text-slate-500 cursor-not-allowed" :
                            isOverride ? "bg-amber-50 text-amber-800 focus:bg-amber-100" : "bg-transparent focus:bg-indigo-50/50"
                          }`} />
                        {isOverride && (
                          <span title={`السعر الأصلي: ${Number(l.sale_price).toFixed(2)}`}
                            className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-amber-500 pointer-events-none" />
                        )}
                      </div>
                    );
                  }
                },
                {
                  id: "lineDiscount", header: "خصم", width: 110, sortable: false,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l) => {
                    const mode = discountModes[l.item_id] || "flat";
                    const lineMax = Number(l.unit_price) * Number(l.quantity);
                    const flatDisc = Number(l.line_discount || 0);
                    const pctVal = lineMax > 0 ? (flatDisc / lineMax) * 100 : 0;
                    const isOver = flatDisc > lineMax && lineMax > 0;
                    return (
                      <div className="flex items-center h-[40px] px-1 gap-0.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={mode === "pct" ? parseFloat(pctVal.toFixed(2)) : flatDisc}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            if (mode === "pct") {
                              const flat = parseFloat(((v / 100) * lineMax).toFixed(4));
                              updateLine(l.item_id, { line_discount: Math.min(flat, lineMax) });
                            } else {
                              updateLine(l.item_id, { line_discount: Math.min(v, lineMax) });
                            }
                          }}
                          className={`w-full h-[28px] text-center text-2sm font-mono font-black bg-transparent outline-none border rounded-sm transition-colors
                            ${isOver
                              ? "border-rose-400 bg-rose-50/50 text-rose-700 focus:border-rose-600"
                              : "border-slate-200 focus:border-amber-400 focus:bg-amber-50/50"}`}
                        />
                        <button
                          type="button"
                          onClick={() => setDiscountModes((m) => ({ ...m, [l.item_id]: mode === "pct" ? "flat" : "pct" }))}
                          className={`h-[28px] px-1.5 rounded-sm text-[11px] font-black border transition-colors shrink-0
                            ${mode === "pct"
                              ? "bg-amber-100 border-amber-300 text-amber-700"
                              : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200"}`}
                        >
                          {mode === "pct" ? "%" : "ج"}
                        </button>
                      </div>
                    );
                  }
                },
                {
                  id: "warehouseId", header: "المخزن", width: 130, sortable: false,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                  render: (l) => {
                    const whStock = stockLevels[l.item_id] || stockLevels[Number(l.item_id)] || stockLevels[String(l.item_id)] || {};
                    const hasStockInSelected = l.warehouse_id ? (whStock[l.warehouse_id] || 0) > 0 : false;
                    return (
                      <div className="relative w-full">
                        <select value={l.warehouse_id || staging.warehouseId}
                          onChange={(e) => updateLine(l.item_id, { warehouse_id: e.target.value })}
                          className={`w-full h-[40px] text-[11px] font-bold outline-none border-0 ring-0 text-center truncate transition-colors cursor-pointer ${
                            !hasStockInSelected && l.warehouse_id ? "bg-rose-50 text-rose-700" : "bg-transparent text-slate-700 focus:bg-indigo-50"
                          }`}>
                          {getFilteredWarehouses(l.item_id, l.warehouse_id).map(w => {
                            const sqty = whStock[w.id] || 0;
                            return <option key={w.id} value={w.id}>{w.name} ({sqty})</option>;
                          })}
                        </select>
                        <ChevronDown className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                        {!hasStockInSelected && l.warehouse_id && (
                          <div className="absolute bottom-0 left-0 right-0 text-[8px] font-black text-rose-500 text-center leading-none pb-0.5">
                            المخزن فارغ
                          </div>
                        )}
                      </div>
                    );
                  }
                },
                {
                  id: "unit",
                  header: "الوحدة",
                  width: 80,
                  sortable: false,
                  headerClass: "text-center",
                  cellClass: "text-center text-[11px] font-bold text-slate-600 border-l border-slate-100 px-1",
                  render: (l) => l.unit_name || "أساسية"
                },
                {
                  id: "profit_pct", header: "الربح", width: 90, sortable: false,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                  render: (l) => {
                    const item = items.find(i => String(i.id) === String(l.item_id));
                    const cost = Number(item?.purchase_price || item?.current_cost || 0);
                    const price = Number(l.unit_price || 0);
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
                  id: "total", header: "الإجمالي", width: 110, sortable: true,
                  headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-sm text-slate-900 bg-slate-50/50 border-l border-slate-100",
                  render: (l) => formatMoney(l.quantity * l.unit_price - (l.line_discount || 0))
                },
                {
                  id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center",
                  render: (row) => (
                    <button onClick={() => removeLine(row.item_id)} className="inline-flex h-[40px] w-full items-center justify-center text-slate-400 opacity-60 hover:bg-slate-100 hover:text-rose-500 hover:opacity-100 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )
                }
              ]}
            />
          </div>
        </main>

        <PrintPreviewModal
          open={printPreview}
          onClose={() => setPrintPreview(false)}
          docType="pos_receipt"
          invoice={{
            invoice_no: invoiceNumber,
            created_at: new Date().toISOString(),
            customer_name: customer?.name,
            lines: lines.map((l) => ({
              item_name: l.item_name,
              quantity: l.quantity,
              unit_price: l.unit_price,
              discount_amount: l.line_discount || 0,
              unit_name: l.unit_name || "",
              code: l.code || "",
            })),
            payments: paymentType === "multi" ? [
              ...(Number(multiCash) > 0 ? [{ method: "cash", method_name: "نقدي", amount: Number(multiCash) }] : []),
              ...customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦' && Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, method_name: m.name, amount: Number(multiCustomAmounts[m.id]) })),
              ...(Number(multiCredit) > 0 && customer?.id ? [{ method: "credit", method_name: "آجل", amount: Number(multiCredit) }] : []),
            ] : [{ method: paymentType, method_name: { cash: "نقدي", credit: "آجل", bank: "بنك", installments: "أقساط" }[paymentType] || paymentType, amount: totals.total }],
          }}
          settings={storeSettings}
          operationLabel="فاتورة مبيعات نقدية"
          onConfirmPrint={() => saveInvoice(false)}
          confirmLabel="حفظ وطباعة"
          onSaveOnly={() => saveInvoice(false)}
          saveOnlyLabel="حفظ فقط"
          isSaving={isSaving}
        />

        <GalleryModal
          open={galleryOpen}
          onClose={() => { setGalleryOpen(false); setGalleryZoom(1); }}
          images={galleryImages}
          idx={galleryIdx}
          setIdx={setGalleryIdx}
          zoom={galleryZoom}
          setZoom={setGalleryZoom}
        />

        <POSTodayModal open={receiptsOpen} onClose={() => setReceiptsOpen(false)} />

        {/* Supervisor override modal for list view */}
        <Modal open={supervisorOverrideOpen} onClose={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }} title="تجاوز حد الخصم">
          <div className="space-y-4 text-center animate-modal-enter">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mx-auto">
              <ShieldCheck className="h-7 w-7 text-amber-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">الخصم المطبق يتجاوز الحد المسموح ({Number(storeSettings?.max_discount_percent ?? 15)}% من الإجمالي).</p>
            <p className="text-2sm text-slate-500">هل تريد تجاوز هذا القيد بصلاحية المشرف؟</p>
            <div className="flex justify-center gap-3 pt-2">
              <button type="button" onClick={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }}
                className="rounded-sm border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء — تعديل الخصم</button>
              <PermissionGate page="pos" action="discount">
                <button type="button" onClick={confirmSupervisorOverride}
                  className="rounded-sm bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700">تجاوز بصلاحية المشرف</button>
              </PermissionGate>
            </div>
          </div>
        </Modal>
                      {/* Set Default View Modal */}
        <Modal open={showSetDefaultModal} onClose={() => setShowSetDefaultModal(false)} title="حفظ تفضيل العرض">
          <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
            <p className="text-sm font-bold text-slate-700">هل تريد حفظ <strong>{pendingViewMode === "list" ? "عرض القائمة" : "عرض الشبكة"}</strong> كعرض افتراضي لنقطة البيع؟</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSetDefaultModal(false)} className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100 transition-all active:scale-[0.98]">لا، لاحقاً</button>
              <button
                onClick={() => {
                  api.put("/api/settings", { ...storeSettings, default_pos_view: pendingViewMode })
                    .then(() => {
                      setStoreSettings(s => ({ ...s, default_pos_view: pendingViewMode }));
                      setSaveMessage("تم حفظ تفضيل العرض");
                      setTimeout(() => setSaveMessage(""), 3000);
                    })
                    .catch((e) => {
                      setSaveMessage(e.response?.data?.message || "فشل الحفظ");
                      setTimeout(() => setSaveMessage(""), 4000);
                    });
                  setShowSetDefaultModal(false);
                }}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700 transition-all active:scale-[0.98]"
              >
                نعم، احفظه كافتراضي
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
                      saveInvoice(false);
                    }}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><Sparkles className="h-4 w-4" /> حفظ الحالية وإنشاء جديدة</>}
                  </button>
                  <button
                    onClick={() => {
                      setNewInvoiceModalOpen(false);
                      holdCurrentInvoice();
                      clear();
                      resetPaymentFields();
                      resetStaging();
                      resetCustomer();
                      setPaymentType("cash");
                      setInvoiceSeq((s) => s + 1);
                      toast.success("تم تعليق الفاتورة");
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100 transition-all active:scale-[0.98]"
                  >
                    <PauseCircle className="h-4 w-4" />
                    تعليق الحالية وإنشاء جديدة
                  </button>
                  <button
                    onClick={() => {
                      setNewInvoiceModalOpen(false);
                      clear();
                      resetPaymentFields();
                      resetStaging();
                      resetCustomer();
                      setPaymentType("cash");
                      setInvoiceSeq((s) => s + 1);
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
                      clear();
                      resetPaymentFields();
                      resetStaging();
                      resetCustomer();
                      setPaymentType("cash");
                      setInvoiceSeq((s) => s + 1);
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



        {/* Cancel Invoice Modal */}
        <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title="تأكيد حفظ الفاتورة">
          <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <Receipt className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-emerald-800">هل أنت متأكد من حفظ الفاتورة؟</p>
                <p className="text-2sm font-bold text-emerald-700 mt-1">سيتم حفظ الفاتورة بقيمة {formatMoney(totals.total)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setSaveConfirmOpen(false); saveInvoice(false); }}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : "تأكيد الحفظ"}
              </button>
              <button
                onClick={() => setSaveConfirmOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                تراجع
              </button>
            </div>
          </div>
        </Modal>
        <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="إلغاء الفاتورة">
          <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
              <Trash2 className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-rose-800">هل تريد إلغاء الفاتورة الحالية؟</p>
                <p className="text-2sm font-bold text-rose-700 mt-1">سيتم حذف جميع الأصناف المضافة</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  clear();
                  resetPaymentFields();
                  resetStaging();
                  resetCustomer();
                  setPaymentType("cash");
                  setInvoiceSeq((s) => s + 1);
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 transition-all active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4" />
                نعم، إلغاء الفاتورة
              </button>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                تراجع
              </button>
            </div>
          </div>
        </Modal>

        {saveMessage && (
          <div className="absolute left-1/2 top-20 z-[150] -translate-x-1/2 rounded-sm border border-rose-200 bg-rose-50 px-5 py-2.5 font-bold text-sm text-rose-700 shadow-xl animate-fade-in">
            {saveMessage}
          </div>
        )}
        {saveSuccess && <InvoiceSaveSuccess invoiceNumber={saveSuccess.invoiceNumber} total={saveSuccess.total} payments={saveSuccess.payments} customerName={saveSuccess.customerName} customerNewBalance={saveSuccess.customerNewBalance} discount={saveSuccess.discount} increase={saveSuccess.increase} onDismiss={onDismissSaveSuccess} />}

        <InvoiceProfitModal
          open={profitModalOpen}
          onClose={() => setProfitModalOpen(false)}
          lines={lines}
          items={items}
        />
        <AdvancedSearchModal
          open={advancedSearchOpen}
          onClose={() => setAdvancedSearchOpen(false)}
        />
        <AddCustomerModal
          open={customerCreateOpen}
          onClose={() => setCustomerCreateOpen(false)}
          onCreated={(customer) => { setCustomers((prev) => [customer, ...prev]); setCustomer(customer); setCustomerQuery(customer.name); }}
        />
        <QuickAddLeadPopover open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
        <CustomerInfoModal
          open={customerInfoOpen}
          customerId={customer?.id}
          onClose={() => setCustomerInfoOpen(false)}
          onUpdated={(updated) => { setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c)); setCustomer(updated); setCustomerQuery(updated.name); }}
        />
        <UnsavedChangesModal
          open={blocker.state === "blocked"}
          onStay={() => blocker.reset?.()}
          onLeave={() => { clearActiveDraftFromDB(); blocker.proceed?.(); }}
        />
      </div>
    );
  }



  return (
    <div className="flex h-screen flex-col bg-[#f8fafb] font-sans overflow-hidden" dir="rtl">
      <BarcodeListener />
      {staleHeldAlert && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center" dir="rtl">
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="text-[16px] font-black text-slate-800 mb-1">فواتير معلقة قديمة</h3>
            <p className="text-sm text-slate-500 mb-4">لديك فواتير معلقة منذ فترة طويلة. يرجى مراجعتها.</p>
            <button onClick={() => setStaleHeldAlert(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">
              حسناً
            </button>
          </div>
        </div>
      )}
      {isOffline && (
        <div className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-2sm font-black tracking-wide text-white shrink-0 z-50">
          <AlertTriangle className="h-3.5 w-3.5" />
          تعذّر الاتصال بالخادم المحلي — بعض العمليات قد لا تعمل حتى يعود الاتصال
        </div>
      )}


      {/* Amend mode banner */}
      {amendContext && showAmendSummary && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 z-20" dir="rtl">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 mt-0.5">
              <Pencil className="h-4 w-4 text-amber-600" />
              <span className="text-2sm font-black text-amber-800">وضع التعديل — الفاتورة الأصلية:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 flex-1 text-[11px] font-bold text-amber-700">
              {amendContext.prefill?.customer_name && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {amendContext.prefill.customer_name}</span>
              )}
              <span>الإجمالي: {(() => {
                const lines = amendContext.prefill?.lines || [];
                const sub = lines.reduce((s, l) => s + (Number(l.unit_price || 0) * Number(l.quantity || 1) * (1 - Number(l.discount || 0) / 100)), 0);
                const disc = amendContext.prefill?.discount || 0;
                const inc = amendContext.prefill?.increase || 0;
                return (sub - disc + inc).toLocaleString("en-US", { minimumFractionDigits: 2 });
              })()} ج.م</span>
              <span>{(amendContext.prefill?.lines || []).length} صنف</span>
              {amendContext.prefill?.payment_type && (
                <span>{{cash:"نقدي",credit:"آجل",bank_transfer:"بنك/فيزا",installments:"أقساط",multi:"متعدد"}[amendContext.prefill.payment_type] || amendContext.prefill.payment_type}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAmendContext(null); clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); }}
                className="flex items-center gap-1.5 rounded-md bg-white border border-amber-300 px-3 py-1 text-[11px] font-black text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> فاتورة جديدة
              </button>
              <button onClick={() => setShowAmendSummary(false)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-amber-100 text-amber-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className="flex min-h-0 flex-1 transition-all flex-row relative"
      >
        {/* ── Left Column: Grid & Search (~65%) ── */}
        <div className="flex flex-col flex-[1.8] bg-[#f8fafb] border-l border-slate-100 overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-3 shrink-0 bg-white border-b border-slate-100 p-4 shadow-[0_1px_10px_-5px_rgba(0,0,0,0.07)] z-10">
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <input
                readOnly
                disabled
                value={invoiceIsActive ? (docNo || invoiceNumber) : "—"}
                className="w-[165px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-2sm font-mono font-black text-slate-600 cursor-default text-center select-none disabled:opacity-70"
              />
              {invoiceIsActive && invoiceCreatedAt && (
                <input readOnly disabled
                  value={new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" }).format(new Date(invoiceCreatedAt))}
                  className="w-[120px] rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono font-bold text-slate-400 cursor-default text-center select-none disabled:opacity-70"
                />
              )}
              <div className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1">
                <User className="h-3 w-3 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500 max-w-[90px] truncate">{user?.name || "-"}</span>
              </div>
              <select
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-slate-800"
              >
                <option value="">البائع (اختياري)</option>
                {employees.filter((emp) => emp.is_active !== 0).map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SearchInput
                  value={detailedSearchQuery}
                  onChange={(val) => setDetailedSearchQuery(val)}
                  placeholder="ابحث بالاسم، الكود، الباركود (عربي/إنجليزي)..."
                  className="w-full text-sm py-2"
                />
              </div>
              <div className="flex shrink-0 bg-slate-100 rounded-xl p-1 border border-slate-100">
                <button 
                  onClick={() => { setViewMode("detailed"); setPendingViewMode("detailed"); setShowSetDefaultModal(true); }}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "detailed" ? "bg-white shadow text-indigo-600" : "text-slate-400 hover:text-slate-700"}`}
                  title="عرض الشبكة"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setViewMode("list"); setPendingViewMode("list"); setShowSetDefaultModal(true); }}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow text-indigo-600" : "text-slate-400 hover:text-slate-700"}`}
                  title="عرض القائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setDetailedSearchQuery("")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAdvancedSearchOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                title="بحث متقدم في المخزون"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 custom-scrollbar">
              {detailedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setDetailedCategoryFilter(cat)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-2sm font-black transition-all border ${detailedCategoryFilter === cat ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  {cat === "all" ? "كل الفئات" : cat}
                </button>
              ))}
            </div>
          </div>


          {/* Main Body Toggle */}
          {viewMode === "detailed" ? (
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

            {detailedItemResults.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 opacity-60">
                <Search className="h-16 w-16 mb-4 text-slate-300" />
                <p className="text-sm font-black tracking-widest">لا توجد أصناف مطابقة</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {detailedItemResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleGridItemClick(item)}
                    className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm hover:border-indigo-200 hover:shadow-[0_8px_24px_-6px_rgba(99,102,241,0.14)] hover:-translate-y-1 transition-all text-right overflow-hidden"
                  >
                    <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
                      {getItemImage(item) ? (
                        <img src={getItemImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-2sm font-black text-slate-800 truncate block leading-tight">{item.name}</span>
                      <span className="text-[11px] font-bold text-slate-400 font-mono truncate">{item.barcode || item.code || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-auto pt-1.5 border-t border-slate-100">
                      <span className="text-sm font-black text-indigo-600 font-mono">{formatMoney(item.sale_price || item.price || 0)}</span>
                      <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${Number(item.stock_quantity || item.stock || 0) <= 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                        {Number(item.stock_quantity || item.stock || 0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : (
             <div className="flex-1 overflow-y-auto bg-white custom-scrollbar flex flex-col">
                <DataGrid
                  data={detailedItemResults}
                  sortConfig={detailedSortConfig}
                  onSort={(k) => setDetailedSortConfig({ key: k, dir: detailedSortConfig.key === k && detailedSortConfig.dir === "asc" ? "desc" : "asc" })}
                  colWidths={detailedColWidths}
                  onResizeColumn={(k, w) => setDetailedColWidths(p => ({...p, [k]: w}))}
                  columns={[
                    { id: "image", header: "صورة", width: detailedColWidths.image, render: (r) => (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-slate-50 overflow-hidden">
                         {getItemImage(r) ? <img src={getItemImage(r)} className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-slate-300"/>}
                      </div>
                    )},
                    { id: "code", header: "الكود", width: detailedColWidths.code, render: r => <span className="font-mono text-slate-500">{r.code}</span> },
                    { id: "name", header: "اسم الصنف", width: detailedColWidths.name, render: r => <span className="font-bold">{r.name}</span> },
                    { id: "price", header: "السعر", width: detailedColWidths.price, render: r => <span className="font-mono font-bold text-emerald-600">{formatMoney(r.sale_price || r.price)}</span> },
                    { id: "stock", header: "الرصيد", width: detailedColWidths.stock, render: r => <span className="font-mono">{r.stock_quantity || r.stock || 0}</span> },
                    { id: "actions", header: "", width: 60, render: r => (
                        <button onClick={() => handleGridItemClick(r)} className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Plus className="h-4 w-4"/></button>
                    )}
                  ]}
                />
             </div>
          )}
        </div>


        {/* ── Right Column: Fixed Invoice Panel (~35%) ── */}
        <div className="flex flex-col flex-1 max-w-[560px] min-w-[480px] bg-white shadow-[-2px_0_20px_-5px_rgba(0,0,0,0.07)] z-20 overflow-y-auto custom-scrollbar animate-fade-in">
          
          {/* Top Panel: Customer & Actions */}
          <div className="flex flex-col shrink-0 border-b border-slate-100 bg-[#f8fafb] px-3 pt-4 pb-3 gap-2.5">
            {/* Meta Row */}
            <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-[11px] font-black bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-600">{invoiceIsActive ? (docNo || invoiceNumber) : "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <PermissionGate page="pos" action="profit">
                  <button onClick={() => setProfitModalOpen(true)} className="hover:text-emerald-600 transition-colors" title="الربح المتوقع">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </button>
                </PermissionGate>
                <button onClick={() => setReceiptsOpen(true)} className="hover:text-slate-800 transition-colors" title="فواتير اليوم">
                  <ListTodo className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer Select */}
            <div data-help="customer-select" className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className={`pointer-events-none absolute inset-y-0 right-2.5 flex items-center ${hasCustomerBalance ? "text-amber-500" : "text-slate-400"}`}>
                  <User className="h-4 w-4" />
                </div>
                <input
                  ref={customerInputRef}
                  type="text"
                  value={(!customer && !customerQuery) ? "زبون نقدي" : customerQuery}
                  placeholder="ابحث عن عميل..."
                  onChange={(e) => {
                    const v = e.target.value.replace("زبون نقدي", "");
                    setCustomerQuery(v); setCustomerLookupOpen(true); setActiveCustomerIndex(0);
                    if (!v) setCustomer(null);
                  }}
                  onFocus={() => setCustomerLookupOpen(true)}
                  onBlur={() => setTimeout(() => { setCustomerLookupOpen(false); if (!customer) setCustomerQuery(""); }, 200)}
                  onKeyDown={handleCustomerKeyDown}
                  className={`w-full border rounded-xl py-2.5 pl-2 pr-9 text-sm font-black outline-none transition-all ${
                    hasCustomerBalance
                      ? "border-amber-300 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-200"
                      : "border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  }`}
                />
                {customerLookupOpen && (
                  <SearchDropdown items={customerResults} activeIndex={activeCustomerIndex} emptyLabel="ابحث عن عميل..." onPick={(c) => { setCustomer(c); setCustomerQuery(c.name); setCustomerLookupOpen(false); }} />
                )}
              </div>
              <button onClick={() => setQuickAddOpen(true)} title="إضافة رقم واتساب سريع" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-green-300 bg-green-50 text-green-600 hover:border-green-500 hover:bg-green-100 transition-colors shadow-sm text-base">
                📱
              </button>
              <button onClick={() => setCustomerCreateOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-800 hover:text-slate-800 transition-colors shadow-sm">
                <Plus className="h-4 w-4" />
              </button>
              {customer?.id && (
                <button onClick={() => setCustomerInfoOpen(true)} title="بيانات العميل" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-blue-200 bg-blue-50 text-blue-500 hover:border-blue-400 hover:text-blue-700 transition-colors shadow-sm">
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
            {customer?.id && (
              <div className="flex items-center gap-2 mt-1">
                <div className="text-[11px] font-black text-amber-700 bg-amber-100/50 border border-amber-200 px-2 py-1 rounded-sm">
                  {amendContext ? "قبل التعديل: " : "الرصيد: "}{formatMoney(displayBalance)}
                </div>
                {creditEffect > 0 && lines.length > 0 && (
                  <>
                    <div className="text-[11px] font-black text-amber-700 bg-amber-100/50 border border-amber-200 px-2 py-1 rounded-sm">
                      {paymentType === "installments" ? "الإضافة للأقساط: " : paymentType === "multi" ? "الإضافة للآجل: " : "الإضافة للرصيد: "}+{formatMoney(creditEffect)}
                    </div>
                    <div className="text-[11px] font-black text-rose-700 bg-rose-100/50 border border-rose-200 px-2 py-1 rounded-sm">
                      {paymentType === "installments" ? "بعد الأقساط: " : paymentType === "multi" ? "بعد الآجل: " : "بعد الفاتورة: "}{formatMoney(displayBalance + creditEffect)}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Default customer quick-select */}
            {!customer?.id && customers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {customers.slice(0, 3).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCustomer(c); setCustomerQuery(c.name); }}
                    className="px-2 py-0.5 rounded-sm bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {/* Optional WhatsApp number → auto-saved as a lead on sale completion (anonymous sale only) */}
            {!customer?.id && (
              <div className="flex items-center gap-2 mt-1 rounded-lg border border-green-100 bg-green-50/50 px-2.5 py-1.5">
                <span className="text-sm shrink-0">📱</span>
                <input
                  type="tel"
                  dir="ltr"
                  value={waLeadPhone}
                  onChange={(e) => setWaLeadPhone(e.target.value)}
                  placeholder="واتساب (اختياري) — يُحفظ مع البيع"
                  className="flex-1 min-w-0 bg-transparent text-[12px] font-bold text-slate-700 outline-none placeholder:text-green-600/60 placeholder:font-normal text-right"
                />
              </div>
            )}
          </div>

          {/* Cart List */}
          <div className="shrink-0 p-3 bg-[#f8fafb] relative">
            {saveSuccess && <InvoiceSaveSuccess invoiceNumber={saveSuccess.invoiceNumber} total={saveSuccess.total} payments={saveSuccess.payments} customerName={saveSuccess.customerName} customerNewBalance={saveSuccess.customerNewBalance} discount={saveSuccess.discount} increase={saveSuccess.increase} onDismiss={onDismissSaveSuccess} />}
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center opacity-40">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm mb-5">
                  <ShoppingCart className="h-10 w-10 text-slate-300" />
                </div>
                <span className="text-[15px] font-black tracking-widest text-slate-500">الفاتورة فارغة</span>
                <span className="mt-1.5 text-2sm font-bold text-slate-400">اضغط على الأصناف لإضافتها</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {lines.map((line, idx) => {
                  const isExceedingStock = Number(line.quantity || 0) > Number(line.stock_quantity || 0);
                  const lineTotal = Math.max(0, Number(line.quantity || 0) * Number(line.unit_price || 0) - Number(line.line_discount || 0));
                  const unitPrice = Number(line.unit_price || 0);
                  const qty = Number(line.quantity || 0);
                  const item = items.find((it) => it.id === line.item_id);
                  const cost = Number(item?.purchase_price || 0);
                  const isBelowCost = cost > 0 && unitPrice > 0 && unitPrice < cost;
                  const isDiscountOverflow = Number(line.line_discount || 0) > unitPrice * qty && unitPrice > 0;
                  const isPriceOverride = line.item_id !== -1 && line.master_sale_price > 0 && Math.abs(unitPrice - Number(line.master_sale_price)) > 0.001;
                  const hasWarning = isExceedingStock || isBelowCost || isDiscountOverflow;
                  return (
                    <div key={`${line.item_id}-${idx}`} className={`animate-slide-up group relative flex flex-col gap-2.5 p-3 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-px ${
                      isExceedingStock ? "border-rose-300 ring-1 ring-rose-100" : hasWarning ? "border-amber-200 ring-1 ring-amber-50" : "border-slate-100 hover:border-indigo-200"
                    }`} style={{ animationDelay: `${idx * 50}ms` }}>
                      {/* Left accent bar */}
                      <div className={`absolute right-0 top-3 bottom-3 w-1 rounded-l-full ${
                        isExceedingStock ? "bg-rose-400" : isBelowCost ? "bg-amber-400" : "bg-emerald-400"
                      }`} />

                      {/* Row 1: name + delete */}
                      <div className="flex items-center justify-between gap-2 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-500">{idx + 1}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-black text-slate-800 truncate block leading-tight whitespace-nowrap" title={line.item_name || line.name}>{line.item_name || line.name}</span>
                            <span className="text-[11px] font-mono text-slate-400 truncate whitespace-nowrap">{line.code || "—"}</span>
                          </div>
                        </div>
                        <button onClick={() => removeLine(line.item_id)} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Row 2: stepper + discount + price — all on one line */}
                      <div className="flex items-center justify-between gap-2 pr-2">
                        {/* Left group: stepper + discount */}
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Stepper */}
                          {(() => {
                            const maxStock = getLineMaxStock(line.item_id, line.warehouse_id);
                            return (
                            <>
                            <div className="flex items-center shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                              <button onClick={() => updateLine(line.item_id, { quantity: Math.max(1, Number(line.quantity) - 1) })} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors active:bg-slate-200"><Minus className="w-3.5 h-3.5" /></button>
                              <div className="w-px h-5 bg-slate-100" />
                              <input type="number" min="1" max={maxStock === Infinity ? undefined : maxStock} value={line.quantity}
                                onChange={(e) => { const v = Number(e.target.value || 1); updateLine(line.item_id, { quantity: maxStock === Infinity ? v : Math.min(v, maxStock) }); }}
                                className="w-11 h-8 text-center text-2sm font-black bg-transparent outline-none ring-0 border-0 text-slate-800" />
                              <div className="w-px h-5 bg-slate-100" />
                              <button
                                onClick={() => { const next = Number(line.quantity) + 1; if (next <= maxStock) updateLine(line.item_id, { quantity: next }); }}
                                disabled={stockLoaded && Number(line.quantity) >= maxStock}
                                title={stockLoaded && Number(line.quantity) >= maxStock ? `الحد الأقصى للمخزون: ${maxStock}` : undefined}
                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                              ><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                            {stockLoaded && maxStock !== Infinity && (
                              <span className={`text-[11px] font-bold whitespace-nowrap ${Number(line.quantity) >= maxStock ? 'text-rose-500' : 'text-slate-400'}`}>
                                {Number(line.quantity) >= maxStock ? 'نفد المخزون' : `متاح: ${maxStock - Number(line.quantity)}`}
                              </span>
                            )}
                            </>
                            );
                          })()}

                          {/* Discount */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">خصم</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={
                                discountModes[line.item_id] === "pct"
                                  ? parseFloat(((Number(line.line_discount || 0) / (Number(line.unit_price || 1) * Number(line.quantity || 1))) * 100).toFixed(2))
                                  : Number(line.line_discount || 0)
                              }
                              onChange={(e) => {
                                const v = Math.max(0, Number(e.target.value || 0));
                                const lineMax = Number(line.unit_price || 0) * Number(line.quantity || 0);
                                if (discountModes[line.item_id] === "pct") {
                                  updateLine(line.item_id, { line_discount: Math.min(parseFloat(((v / 100) * lineMax).toFixed(4)), lineMax) });
                                } else {
                                  updateLine(line.item_id, { line_discount: Math.min(v, lineMax) });
                                }
                              }}
                              className="w-14 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-black text-center outline-none focus:border-amber-400 focus:bg-amber-50/50 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setDiscountModes((m) => ({
                                ...m,
                                [line.item_id]: m[line.item_id] === "pct" ? "flat" : "pct"
                              }))}
                              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-black border transition-all
                                ${discountModes[line.item_id] === "pct"
                                  ? "bg-amber-100 border-amber-300 text-amber-700 shadow-sm"
                                  : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200"}`}
                            >
                              {discountModes[line.item_id] === "pct" ? "%" : "ج"}
                            </button>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <div className={`rounded-xl px-2.5 py-1 border whitespace-nowrap ${isPriceOverride ? "bg-amber-50 border-amber-200" : "bg-indigo-50 border-indigo-100"}`}>
                            <span className={`font-mono text-sm font-black ${isPriceOverride ? "text-amber-700" : "text-indigo-700"}`}>{formatMoney(lineTotal)}</span>
                          </div>
                          {isPriceOverride ? (
                            <span className="text-[11px] font-bold text-amber-600 whitespace-nowrap">
                              {formatMoney(unitPrice)} <span className="text-slate-400 mx-0.5">←</span> {formatMoney(line.master_sale_price)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{formatMoney(unitPrice)} للقطعة</span>
                          )}
                        </div>
                      </div>

                      {/* Warnings */}
                      {isExceedingStock && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg self-start">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          تجاوز المخزون (متاح: {line.stock_quantity})
                        </div>
                      )}
                      {isBelowCost && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg self-start">
                          <TrendingUp className="w-3 h-3 shrink-0 rotate-180" />
                          سعر أقل من التكلفة ({cost.toFixed(2)})
                        </div>
                      )}
                      {isDiscountOverflow && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg self-start">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          الخصم يتجاوز إجمالي السطر
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Totals & Payments */}
          <div data-help="payment-section" className="shrink-0 flex flex-col border-t border-slate-200 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-30 animate-fade-in">
            {/* Totals Summary */}
            <div className="flex flex-col px-4 py-3 bg-slate-900 gap-1.5 border-b border-slate-800">
              <div className="flex items-center justify-between text-2sm">
                <span className="font-bold text-slate-400">الفرعي</span>
                <span className="font-mono font-black text-slate-200">{formatMoney(totals.subtotal)}</span>
              </div>
              <div data-help="discount-field" className="flex items-center justify-between text-2sm gap-2">
                <span className="font-bold text-slate-400 shrink-0">خصم إضافي</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={invoiceDiscountMode === "pct"
                      ? (totals.subtotal > 0 ? parseFloat(((discount / totals.subtotal) * 100).toFixed(2)) : 0)
                      : discount}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value || 0));
                      if (invoiceDiscountMode === "pct") {
                        setDiscount(Math.min(parseFloat(((v / 100) * totals.subtotal).toFixed(4)), totals.subtotal));
                      } else {
                        setDiscount(Math.min(v, totals.subtotal));
                      }
                    }}
                    className="w-20 rounded-sm border border-slate-700 bg-slate-800 px-2 py-0.5 text-right font-mono text-2sm font-black text-white outline-none focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setInvoiceDiscountMode((m) => m === "pct" ? "flat" : "pct")}
                    className={`px-1.5 py-0.5 rounded-sm text-[11px] font-black border transition-colors shrink-0
                      ${invoiceDiscountMode === "pct"
                        ? "bg-rose-800 border-rose-600 text-rose-200"
                        : "border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                  >
                    {invoiceDiscountMode === "pct" ? "%" : "ج"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-2sm gap-2">
                <span className="font-bold text-slate-400 shrink-0">إضافة / رسوم</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={invoiceIncreaseMode === "pct"
                      ? (totals.subtotal > 0 ? parseFloat(((increase / totals.subtotal) * 100).toFixed(2)) : 0)
                      : increase}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value || 0));
                      if (invoiceIncreaseMode === "pct") {
                        setIncrease(parseFloat(((v / 100) * totals.subtotal).toFixed(4)));
                      } else {
                        setIncrease(v);
                      }
                    }}
                    className="w-20 rounded-sm border border-blue-700 bg-blue-900/40 px-2 py-0.5 text-right font-mono text-2sm font-black text-blue-200 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setInvoiceIncreaseMode((m) => m === "pct" ? "flat" : "pct")}
                    className={`px-1.5 py-0.5 rounded-sm text-[11px] font-black border transition-colors shrink-0
                      ${invoiceIncreaseMode === "pct"
                        ? "bg-blue-800 border-blue-600 text-blue-200"
                        : "border-blue-700 bg-blue-800/40 text-blue-300 hover:bg-blue-700/60"}`}
                  >
                    {invoiceIncreaseMode === "pct" ? "%" : "ج"}
                  </button>
                </div>
              </div>
              <div className="border-t border-slate-700 mt-1 pt-1.5 flex items-center justify-between">
                <span className="text-2sm font-black text-slate-300 uppercase tracking-widest">الإجمالي المطلوب</span>
                <span className="font-mono text-[34px] font-black text-emerald-400 leading-none drop-shadow-md">{formatMoney(totals.total)}</span>
              </div>
            </div>
            {/* Payment Methods */}
            <div className="flex flex-col p-3 gap-3 bg-white">
              <div className="grid grid-cols-5 gap-1.5">
                {PAYMENT_TYPES.filter(({ type }) => !(type === "bank_transfer" && banks.length === 0)).map(({ type, label, desc, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && (type === "credit" || type === "installments" || type === "bank_transfer");
                  const isActive = paymentType === type;
                  const colorMap = {
                    cash: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", activeBg: "bg-emerald-600" },
                    bank_transfer: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", activeBg: "bg-blue-600" },
                    credit: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", activeBg: "bg-amber-600" },
                    installments: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", activeBg: "bg-violet-600" },
                    multi: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", activeBg: "bg-slate-700" },
                  };
                  const c = colorMap[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => !isDisabled && setPaymentType(type)}
                      disabled={isDisabled}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2 text-[11px] font-black transition-all
                        ${isActive
                          ? `${c.activeBg} text-white border-transparent shadow-sm`
                          : isDisabled
                            ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400"
                            : `${c.bg} ${c.text} ${c.border} hover:shadow-sm hover:-translate-y-px bg-white`}`}
                      title={isDisabled ? "متاح للعملاء المسجلين فقط" : label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{label}</span>
                      <span className={`text-[8.5px] font-medium leading-tight text-center mt-0.5 transition-colors duration-150 px-1 ${
                        isActive ? "text-white/80" : "text-slate-400"
                      }`}>{desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Payment Input */}
              {paymentType === "cash" && (
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="المبلغ المستلم..." className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                  {Number(amountReceived) > 0 && (
                    <div className={`rounded-lg px-3 py-2.5 text-2sm font-black shrink-0 ${Number(amountReceived) - totals.total >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                      الباقي: {formatMoney(Math.abs(Number(amountReceived) - totals.total))}
                    </div>
                  )}
                </div>
              )}
              {paymentType === "bank_transfer" && (
                <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3">
                  <label className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5 mb-1.5">
                    <CreditCard className="w-3 h-3" /> اختر البنك / البطاقة
                  </label>
                  <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all">
                    <option value="">اختر البنك / البطاقة</option>
                    {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {paymentType === "credit" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[11px] text-amber-800 font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>سيتم إضافة {formatMoney(totals.total)} لرصيد {customer?.name || "العميل"}</span>
                </div>
              )}
              {paymentType === "installments" && (
                <div className="flex flex-col gap-2.5 rounded-xl bg-violet-50/50 border border-violet-100 p-4">
                  <div className="text-[11px] font-black text-violet-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> إعداد الأقساط
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 w-20 shrink-0 whitespace-nowrap">دفعة مقدم:</span>
                    <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" className="flex-1 min-w-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm font-black text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 w-20 shrink-0 whitespace-nowrap">تاريخ القسط:</span>
                    <input type="date" dir="ltr" value={installmentDueDate} onChange={e => setInstallmentDueDate(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                  </div>
                  <div className="text-[11px] font-black text-violet-700 bg-violet-100/60 rounded-lg px-3 py-1.5 text-center border border-violet-200">المتبقي كأقساط: {formatMoney(Math.max(0, totals.total - Number(amountPaid || 0)))}</div>
                </div>
              )}
              {paymentType === "multi" && (
                <div className="flex flex-col gap-3 rounded-xl bg-slate-50/60 border border-slate-200 p-4">
                  <div className="text-[11px] font-black text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> تفاصيل الدفع المتعدد
                  </div>
                  <div className="flex flex-col divide-y divide-slate-100">
                    <div className="flex items-center gap-3 py-2 first:pt-0">
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 leading-snug">💵 نقدي</span>
                      <input type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00"
                        className="w-28 shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-black text-slate-800 text-left outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                    {customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').map(m => (
                      <div key={m.id} className="flex items-center gap-3 py-2">
                        <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 leading-snug break-words">{m.icon} {m.name}</span>
                        <input type="number" min="0" value={multiCustomAmounts[m.id] || ""} onChange={(e) => setMultiCustomAmounts(prev => ({...prev, [m.id]: e.target.value}))} placeholder="0.00"
                          className="w-28 shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                      </div>
                    ))}
                    <div className="flex items-center gap-3 py-2 last:pb-0">
                      <span className={`flex-1 min-w-0 text-2sm font-bold leading-snug ${customer?.id ? 'text-amber-700' : 'text-slate-400'}`}>📋 آجل</span>
                      <input type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)}
                        placeholder={customer?.id ? "0.00" : "اختر عميل..."}
                        disabled={!customer?.id}
                        className={`w-28 shrink-0 rounded-lg px-3 py-1.5 text-sm font-black text-left outline-none transition-all ${customer?.id ? 'border border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`} />
                    </div>
                  </div>
                  {(() => {
                    const entered = (Number(multiCash)||0) + customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0) + (Number(multiCredit)||0);
                    const balanced = Math.abs(entered - totals.total) < 0.01;
                    return (
                      <div className={`flex items-center justify-between rounded-lg px-3 py-2 border text-[11px] font-black ${balanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        <span>المُدخل</span>
                        <span className="font-mono">{formatMoney(entered)} / {formatMoney(totals.total)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Main Actions */}
              <div className="flex flex-col gap-2 mt-1">
                <PermissionGate page="pos" action="print">
                  <button type="button" onClick={() => setPrintPreview(true)} disabled={!lines.length || isSaving || hasBlockingErrors} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-black text-white transition-all shadow-md active:scale-[0.98] ${!lines.length || isSaving || hasBlockingErrors ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100"}`}>
                    <Printer className="h-5 w-5" /> طباعة ومراجعة المستند
                  </button>
                </PermissionGate>
                <div className="flex gap-2">
                  <PermissionGate page="pos" action="add">
                    <button type="button" onClick={() => setSaveConfirmOpen(true)} disabled={!lines.length || isSaving || hasBlockingErrors} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-2sm font-black transition-all ${!lines.length || isSaving || hasBlockingErrors ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600"}`}>
                      حفظ فقط
                    </button>
                  </PermissionGate>
                  <PermissionGate page="pos" action="void">
                    <button type="button" onClick={() => setCancelModalOpen(true)} disabled={!lines.length} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-2sm font-black text-rose-700 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <Trash2 className="h-4 w-4" /> إلغاء
                    </button>
                  </PermissionGate>
                  <button
                    type="button"
                    onClick={() => setNewInvoiceModalOpen(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                  >
                    <FilePlus className="h-4 w-4" /> جديدة
                  </button>
                </div>
                {heldInvoices.length > 0 && (
                  <div className="relative mt-2">
                    <button
                      data-help="hold-button"
                      type="button"
                      onClick={() => setHeldDropdownOpen((v) => !v)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-black transition-all ${(() => {
                        const yellowHours = Number(storeSettings?.held_yellow_hours || 2);
                        const redHours = Number(storeSettings?.held_red_hours || 8);
                        const now = Date.now();
                        const maxAge = Math.max(...heldInvoices.map((h) => (now - new Date(h.heldAt).getTime()) / 3_600_000));
                        if (maxAge >= redHours) return "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 animate-pulse";
                        if (maxAge >= yellowHours) return "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100";
                        return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-300";
                      })()}`}
                    >
                      <div className="flex items-center gap-2">
                        <PauseCircle className="h-5 w-5" />
                        <span>فواتير معلقة ({heldInvoices.length})</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${heldDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {heldDropdownOpen && (
                      <HeldDropdown heldInvoices={heldInvoices} onResume={(id) => { if (lines.length) holdCurrentInvoice(); resumeHeldInvoice(id); setHeldDropdownOpen(false); }} onDiscard={discardHeldInvoice} onClose={() => setHeldDropdownOpen(false)} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {saveMessage && (
        <div className="absolute left-1/2 top-4 z-[150] -translate-x-1/2 rounded-sm border border-rose-200 bg-rose-50 px-5 py-2.5 font-bold text-sm text-rose-700 shadow-xl">
          {saveMessage}
        </div>
      )}

      <GalleryModal
        open={galleryOpen}
        onClose={() => { setGalleryOpen(false); setGalleryZoom(1); }}
        images={galleryImages}
        idx={galleryIdx}
        setIdx={setGalleryIdx}
        zoom={galleryZoom}
        setZoom={setGalleryZoom}
      />

      <POSTodayModal open={receiptsOpen} onClose={() => setReceiptsOpen(false)} />

      {/* ── Detailed item search ── */}
      <Modal open={detailedSearchOpen} onClose={() => setDetailedSearchOpen(false)} title="بحث تفصيلي عن الأصناف">
        <div className="flex flex-col gap-3 animate-modal-enter">
          <input type="text" value={detailedSearchQuery} onChange={(e) => setDetailedSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الكود أو الباركود أو الفئة..."
            className="w-full rounded-sm border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-800" />
          <div className="flex items-center gap-2">
            <select value={detailedCategoryFilter} onChange={(e) => setDetailedCategoryFilter(e.target.value)}
              className="rounded-sm border border-slate-200 px-2 py-2 text-sm outline-none focus:border-slate-800">
              {detailedCategories.map((cat) => <option key={cat} value={cat}>{cat === "all" ? "كل الفئات" : cat}</option>)}
            </select>
          </div>
          <div className="max-h-[420px] overflow-x-auto overflow-y-auto rounded-sm border border-slate-200" dir="rtl">
            <table className="w-full text-sm border-collapse min-w-max">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <SortTh label="صورة"    width={detailedColWidths.image}    onResizeStart={onDetailedResizeStart} resizableKey="image"    sortConfig={detailedSortConfig} />
                  <SortTh label="الكود"   sortKey="code"     onSort={toggleDetailedSort} width={detailedColWidths.code}    onResizeStart={onDetailedResizeStart} resizableKey="code"    sortConfig={detailedSortConfig} />
                  <SortTh label="الصنف"   sortKey="name"     onSort={toggleDetailedSort} width={detailedColWidths.name}    onResizeStart={onDetailedResizeStart} resizableKey="name"    sortConfig={detailedSortConfig} />
                  <SortTh label="الباركود" sortKey="barcode" onSort={toggleDetailedSort} width={detailedColWidths.barcode} onResizeStart={onDetailedResizeStart} resizableKey="barcode" sortConfig={detailedSortConfig} />
                  <SortTh label="الفئة"   sortKey="category" onSort={toggleDetailedSort} width={detailedColWidths.category} onResizeStart={onDetailedResizeStart} resizableKey="category" sortConfig={detailedSortConfig} />
                  <SortTh label="السعر"   sortKey="price"    onSort={toggleDetailedSort} width={detailedColWidths.price}   onResizeStart={onDetailedResizeStart} resizableKey="price"   sortConfig={detailedSortConfig} />
                  <SortTh label="المخزون" sortKey="stock"    onSort={toggleDetailedSort} width={detailedColWidths.stock}   onResizeStart={onDetailedResizeStart} resizableKey="stock"   sortConfig={detailedSortConfig} />
                </tr>
              </thead>
              <tbody>
                {detailedItemResults.map((item) => (
                  <tr key={item.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-900 hover:text-white transition-colors group" onClick={() => handleSelectItem(item)}>
                    <td className="p-2 border-l border-slate-50">
                      <div className="h-8 w-8 overflow-hidden rounded-sm border border-slate-200 bg-white">
                        {getItemImage(item) ? <img src={getItemImage(item)} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageIcon className="h-3.5 w-3.5" /></div>}
                      </div>
                    </td>
                    <td className="p-2 font-mono font-bold text-slate-600 group-hover:text-slate-200 border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.code}px` }}>{item.code || item.item_code || "—"}</td>
                    <td className="p-2 font-black text-slate-800 group-hover:text-white border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.name}px` }}>{item.name}</td>
                    <td className="p-2 font-mono font-bold text-slate-500 group-hover:text-slate-300 border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.barcode}px` }}>{item.barcode || "—"}</td>
                    <td className="p-2 font-bold text-slate-500 group-hover:text-slate-300 border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.category}px` }}>{item.category_name || "—"}</td>
                    <td className="p-2 font-mono font-black text-emerald-700 group-hover:text-emerald-300 border-l border-slate-50" style={{ maxWidth: `${detailedColWidths.price}px` }}>{formatMoney(item.sale_price || item.price || 0)}</td>
                    <td className="p-2 font-black text-slate-700 group-hover:text-slate-200" style={{ maxWidth: `${detailedColWidths.stock}px` }}>{Number(item.stock_quantity || item.stock || 0)}</td>
                  </tr>
                ))}
                {detailedItemResults.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center font-black text-slate-400">لا توجد نتائج مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-slate-400 font-bold">اضغط على أي صف لاختيار الصنف وإضافته</div>
        </div>
      </Modal>

      {/* ── Profit analysis ── */}
      <InvoiceProfitModal
        open={profitModalOpen}
        onClose={() => setProfitModalOpen(false)}
        lines={lines}
        items={items}
      />

      {/* ── Advanced stock search ── */}
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
      />

      <AddCustomerModal
        open={customerCreateOpen}
        onClose={() => setCustomerCreateOpen(false)}
        onCreated={(customer) => { setCustomers((prev) => [customer, ...prev]); setCustomer(customer); setCustomerQuery(customer.name); }}
      />

      <QuickAddLeadPopover open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      <CustomerInfoModal
        open={customerInfoOpen}
        customerId={customer?.id}
        onClose={() => setCustomerInfoOpen(false)}
        onUpdated={(updated) => { setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c)); setCustomer(updated); setCustomerQuery(updated.name); }}
      />

      {/* ── Supervisor override ── */}
      <Modal open={supervisorOverrideOpen} onClose={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }} title="تجاوز حد الخصم">
        <div className="space-y-4 text-center animate-modal-enter">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mx-auto">
            <ShieldCheck className="h-7 w-7 text-amber-600" />
          </div>
          <p className="text-sm font-bold text-slate-700">الخصم المطبق يتجاوز الحد المسموح (15% من الإجمالي).</p>
          <p className="text-2sm text-slate-500">هل تريد تجاوز هذا القيد بصلاحية المشرف؟</p>
          <div className="flex justify-center gap-3 pt-2">
            <button type="button" onClick={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }}
              className="rounded-sm border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء — تعديل الخصم</button>
            <PermissionGate page="pos" action="discount">
              <button type="button" onClick={confirmSupervisorOverride}
                className="rounded-sm bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700">تجاوز بصلاحية المشرف</button>
            </PermissionGate>
          </div>
        </div>
      </Modal>

      {/* ── Multi-payment modal ── */}
      <Modal open={multiModalOpen} onClose={() => setMultiModalOpen(false)} title="توزيع مبالغ الدفع المتعدد">
        <div className="space-y-4 animate-modal-enter">
          <div className="rounded-sm bg-slate-950 p-5 text-center">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">المبلغ المطلوب توزيعه</p>
            <p className="font-mono text-[28px] font-black text-white">{formatMoney(totals.total)}</p>
          </div>
          <div className="space-y-2">
            {paymentMethods.map(m => {
              const current = activeMultiPayments.find(p => p.method_id === m.id);
              const amount  = current?.amount || "";
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-sm border border-slate-200 bg-white p-3 hover:border-slate-800 transition-colors">
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-slate-50 text-slate-500">
                      {m.type === "cash" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <span className="text-sm font-black text-slate-800">{m.name}</span>
                  </div>
                  <input type="number" value={amount} placeholder="0.000"
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveMultiPayments(prev => [...prev.filter(p => p.method_id !== m.id), { method_id: m.id, amount: val }]);
                    }}
                    className="w-28 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-right font-mono text-sm font-black text-slate-800 outline-none focus:border-slate-800" />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-400 uppercase">الموزع</span>
              <span className={`font-mono text-[16px] font-black ${Math.abs(totals.total - multiTotal) < 0.005 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatMoney(multiTotal)}
              </span>
            </div>
            <button onClick={() => setMultiModalOpen(false)}
              className="rounded-sm bg-slate-900 px-8 py-2.5 text-sm font-black text-white hover:bg-slate-800 shadow-sm active:scale-[0.98] transition-all">
              تأكيد وإغلاق
            </button>
          </div>
        </div>
      </Modal>

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="pos_receipt"
        invoice={lastSavedInvoice ? {
          invoice_no: lastSavedInvoice.invoice_no,
          created_at: lastSavedInvoice.date instanceof Date ? lastSavedInvoice.date.toISOString() : new Date().toISOString(),
          customer_name: lastSavedInvoice.customer?.name,
          lines: lastSavedInvoice.lines.map((l) => ({
            item_name: l.item_name || l.name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_amount: Number(l.line_discount || l.lineDiscount || 0),
            unit_name: l.unit_name || "",
            code: l.code || "",
          })),
          payments: lastSavedInvoice.payments || [{ method: lastSavedInvoice.paymentType, method_name: { cash: "نقدي", credit: "آجل", bank: "بنك", installments: "أقساط" }[lastSavedInvoice.paymentType] || lastSavedInvoice.paymentType, amount: lastSavedInvoice.totals?.total }],
        } : {
          invoice_no: invoiceNumber,
          created_at: new Date().toISOString(),
          customer_name: customer?.name,
          lines: lines.map((l) => ({
            item_name: l.item_name || l.name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_amount: Number(l.line_discount || l.lineDiscount || 0),
            unit_name: l.unit_name || "",
            code: l.code || "",
          })),
          payments: paymentType === "multi" ? [
            ...(Number(multiCash) > 0 ? [{ method: "cash", method_name: "نقدي", amount: Number(multiCash) }] : []),
            ...customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦' && Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, method_name: m.name, amount: Number(multiCustomAmounts[m.id]) })),
            ...(Number(multiCredit) > 0 && customer?.id ? [{ method: "credit", method_name: "آجل", amount: Number(multiCredit) }] : []),
          ] : [{ method: paymentType, method_name: { cash: "نقدي", credit: "آجل", bank: "بنك", installments: "أقساط" }[paymentType] || paymentType, amount: totals.total }],
        }}
        settings={storeSettings}
        operationLabel="فاتورة مبيعات نقدية"
        onConfirmPrint={lastSavedInvoice ? undefined : () => saveInvoice(false)}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={lastSavedInvoice ? undefined : () => saveInvoice(false)}
        saveOnlyLabel="حفظ فقط"
        isSaving={isSaving}
      />

      {/* Set Default View Modal */}
      <Modal open={showSetDefaultModal} onClose={() => setShowSetDefaultModal(false)} title="حفظ تفضيل العرض">
        <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
          <p className="text-sm font-bold text-slate-700">هل تريد حفظ <strong>{pendingViewMode === "list" ? "عرض القائمة" : "عرض الشبكة"}</strong> كعرض افتراضي لنقطة البيع؟</p>
          <div className="flex gap-2">
            <button onClick={() => setShowSetDefaultModal(false)} className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100 transition-all active:scale-[0.98]">لا، لاحقاً</button>
            <button
              onClick={() => {
                api.put("/api/settings", { ...storeSettings, default_pos_view: pendingViewMode })
                  .then(() => {
                    setStoreSettings(s => ({ ...s, default_pos_view: pendingViewMode }));
                    setSaveMessage("تم حفظ تفضيل العرض");
                    setTimeout(() => setSaveMessage(""), 3000);
                  })
                  .catch((e) => {
                    setSaveMessage(e.response?.data?.message || "فشل الحفظ");
                    setTimeout(() => setSaveMessage(""), 4000);
                  });
                setShowSetDefaultModal(false);
              }}
              className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700 transition-all active:scale-[0.98]"
            >
              نعم، احفظه كافتراضي
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
                    saveInvoice(false);
                  }}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><Sparkles className="h-4 w-4" /> حفظ الحالية وإنشاء جديدة</>}
                </button>
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    holdCurrentInvoice();
                    clear();
                    resetPaymentFields();
                    resetStaging();
                    resetCustomer();
                    setPaymentType("cash");
                    setInvoiceSeq((s) => s + 1);
                    toast.success("تم تعليق الفاتورة");
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100 transition-all active:scale-[0.98]"
                >
                  <PauseCircle className="h-4 w-4" />
                  تعليق الحالية وإنشاء جديدة
                </button>
                <button
                  onClick={() => {
                    setNewInvoiceModalOpen(false);
                    clear();
                    resetPaymentFields();
                    resetStaging();
                    resetCustomer();
                    setPaymentType("cash");
                    setInvoiceSeq((s) => s + 1);
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
                    clear();
                    resetPaymentFields();
                    resetStaging();
                    resetCustomer();
                    setPaymentType("cash");
                    setInvoiceSeq((s) => s + 1);
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



      {/* Save Confirm Modal */}
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title="تأكيد حفظ الفاتورة">
        <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <Receipt className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-emerald-800">هل أنت متأكد من حفظ الفاتورة؟</p>
              <p className="text-2sm font-bold text-emerald-700 mt-1">سيتم حفظ الفاتورة بقيمة {formatMoney(totals.total)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setSaveConfirmOpen(false); saveInvoice(false); }}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : "تأكيد الحفظ"}
            </button>
            <button
              onClick={() => setSaveConfirmOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
            >
              تراجع
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Invoice Modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="إلغاء الفاتورة">
        <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
            <Trash2 className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-rose-800">هل تريد إلغاء الفاتورة الحالية؟</p>
              <p className="text-2sm font-bold text-rose-700 mt-1">سيتم حذف جميع الأصناف المضافة</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setCancelModalOpen(false);
                clear();
                resetPaymentFields();
                resetStaging();
                resetCustomer();
                setPaymentType("cash");
                setInvoiceSeq((s) => s + 1);
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 transition-all active:scale-[0.98]"
            >
              <Trash2 className="h-4 w-4" />
              نعم، إلغاء الفاتورة
            </button>
            <button
              onClick={() => setCancelModalOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
            >
              تراجع
            </button>
          </div>
        </div>
      </Modal>

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => { clearActiveDraftFromDB(); blocker.proceed?.(); }}
      />
    </div>
  );
}
