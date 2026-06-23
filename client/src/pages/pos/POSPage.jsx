import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Banknote, CreditCard, Wallet, Calendar, Layers } from "lucide-react";
import api from "../../services/api";
import { scoredFilterRows, scoreItem } from "../../utils/search";
import { sortByProximity } from "../../utils/itemSort";
import { usePageTour } from "../../hooks/usePageTour";
import { usePosStore, computeTax, cartLineKey } from "../../stores/posStore";
import { useAuthStore } from "../../stores/authStore";
import { useSound } from "../../hooks/useSound";
import { usePerformanceStore } from "../../stores/performanceStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission";
import { useIsNarrowViewport } from "../../hooks/useIsNarrowViewport";
import toast from "react-hot-toast";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import POSListView from "./POSListView";
import POSDetailedView from "./POSDetailedView";
import PosCashCheckoutModal from "../../components/pos/PosCashCheckoutModal";
import { generateInstallments } from "../../components/pos/InstallmentPlanner";
import {
  resolveImageUrl,
  formatMoney,
  WALK_IN_CUSTOMER,
  DEFAULT_WAREHOUSE,
} from "./posPageUtils";
import { todayCairo } from "../../utils/dateHelpers";

const PAYMENT_TYPES = [
  { type: "cash",          label: "نقدي",      desc: "نقد فوري بالصندوق", Icon: Banknote   },
  { type: "bank_transfer", label: "بنك / فيزا", desc: "مدى / فيزا / تحويل", Icon: CreditCard },
  { type: "credit",        label: "آجل",        desc: "تسجيل دين على العميل", Icon: Wallet     },
  { type: "installments",  label: "أقساط",      desc: "دفعات أقساط مجدولة", Icon: Calendar   },
  { type: "multi",         label: "متعدد",      desc: "تجزئة على عدة طرق", Icon: Layers     },
];

// ─── Sub-components ───────────────────────────────────────────────────────────


// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSPage() {
  usePageTour("pos");
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { permissions } = useAuthStore();
  const canOverridePrice = user?.role === "dev" || user?.role === "admin" || (Array.isArray(permissions?.pos) && permissions.pos.includes("override_price"));
  const posVoiceEnabled = useAppSettingsStore((s) => s.settings.pos_voice_enabled);
  const { playBeep } = useSound(posVoiceEnabled);
  const goldEnabled = useFeatureEnabled("feature_gold");
  const multiUnitEnabled = useFeatureEnabled("feature_multi_unit");

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
  const invoiceNotes    = usePosStore((s) => s.invoiceNotes);
  const taxEnabled      = usePosStore((s) => s.taxEnabled);
  const taxRate         = usePosStore((s) => s.taxRate);
  const setInvoiceNotes = usePosStore((s) => s.setInvoiceNotes);
  const setTaxEnabled   = usePosStore((s) => s.setTaxEnabled);
  const setTaxRate      = usePosStore((s) => s.setTaxRate);
  const canEditTaxRate  = usePermission("pos", "edit_tax_rate");

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
    const fallback = customer?.name || new Intl.DateTimeFormat("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const label = window.prompt("اسم الفاتورة المعلقة", fallback);
    holdCurrentInvoice(label || fallback);
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
  const [isSearchingItems, setIsSearchingItems]       = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);
  const [allItemsTargetCategory, setAllItemsTargetCategory] = useState(null);
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
  // Fast cash checkout (F7): records the tendered cash then opens the normal print preview
  // (which is where the actual save + print/no-print choice happens).
  const [cashCheckoutOpen, setCashCheckoutOpen] = useState(false);
  // Installment plan (POS multi-installment): generator inputs + the editable rows.
  const [installmentStartDate, setInstallmentStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return todayCairo(d);
  });
  const [installmentCount, setInstallmentCount] = useState("3");
  const [installmentFrequency, setInstallmentFrequency] = useState("monthly");
  const [installmentCustomDays, setInstallmentCustomDays] = useState("30");
  const [installmentRows, setInstallmentRows] = useState([]);
  const [selectedBankId, setSelectedBankId]         = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [activeMultiPayments, setActiveMultiPayments] = useState([]);
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem("retailer.pos.viewMode") || "list"; } catch { return "list"; }
  });
  useEffect(() => { try { localStorage.setItem("retailer.pos.viewMode", viewMode); } catch {} }, [viewMode]);

  // Profit column: permission + toggle (synced with Topbar via localStorage + custom event)
  const canViewProfit = usePermission("pos", "profit");
  const [showProfitColumn, setShowProfitColumn] = useState(() => {
    try { return localStorage.getItem("retailer.pos.showProfit") === "true"; } catch { return false; }
  });
  useEffect(() => {
    const handler = (e) => setShowProfitColumn(e.detail.show);
    window.addEventListener("pos:toggleProfit", handler);
    return () => window.removeEventListener("pos:toggleProfit", handler);
  }, []);

  // ── Invoice panel (customer + summary + payment) width / collapse control ──────
  // Per-machine prefs, like the rest of the layout. The panel auto-collapses on
  // narrow/square screens; the user can still expand it for the session, and when
  // collapsed the sticky total bar keeps the due total + primary action visible.
  const POS_PANEL_WIDTH_KEY = "retailer.pos.panelWidth";
  const POS_PANEL_COLLAPSED_KEY = "retailer.pos.panelCollapsed";
  const [panelWidth, setPanelWidth] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem(POS_PANEL_WIDTH_KEY)); return (typeof v === "number" && v >= 320 && v <= 620) ? v : 400; } catch { return 400; }
  });
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(POS_PANEL_COLLAPSED_KEY)) === true; } catch { return false; }
  });
  const [panelManualOpen, setPanelManualOpen] = useState(false);
  const panelNarrow = useIsNarrowViewport(1100);
  const panelEffectiveCollapsed = panelManualOpen ? false : (panelCollapsed || panelNarrow);
  useEffect(() => { try { localStorage.setItem(POS_PANEL_WIDTH_KEY, JSON.stringify(panelWidth)); } catch {} }, [panelWidth]);
  useEffect(() => { try { localStorage.setItem(POS_PANEL_COLLAPSED_KEY, JSON.stringify(panelCollapsed)); } catch {} }, [panelCollapsed]);
  const collapsePanel = useCallback(() => { setPanelManualOpen(false); setPanelCollapsed(true); }, []);
  const expandPanel = useCallback(() => { setPanelManualOpen(true); setPanelCollapsed(false); }, []);
  const togglePanel = useCallback(() => { (panelEffectiveCollapsed ? expandPanel : collapsePanel)(); }, [panelEffectiveCollapsed, expandPanel, collapsePanel]);
  const panelResizingRef = useRef(false);
  const startPanelResize = useCallback((e, edge /* 'left' | 'right' */) => {
    e.preventDefault();
    panelResizingRef.current = true;
    const startX = e.clientX;
    const startW = panelWidth;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMove = (mv) => {
      if (!panelResizingRef.current) return;
      const raw = mv.clientX - startX;
      const delta = edge === "left" ? -raw : raw;
      setPanelWidth(Math.min(620, Math.max(320, startW + delta)));
    };
    const onUp = () => {
      panelResizingRef.current = false;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);
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
  const setConfigLine = useCallback(() => {}, []);
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
  const healthCheckInterval = usePerformanceStore((s) => s.settings.healthCheckInterval);
  useEffect(() => {
    if (!healthCheckInterval) return;
    let alive = true;
    let id = null;
    const check = async () => {
      try {
        // Generous timeout: better-sqlite3 is synchronous, so a busy-but-alive server
        // can take several seconds to answer. A short timeout here used to surface a
        // false disconnect overlay during heavy operations.
        await api.get("/api/health", { timeout: 8000 });
        if (alive) setIsOffline(false);
      } catch {
        if (alive) setIsOffline(true);
      }
    };
    const start = () => { if (id == null) { check(); id = setInterval(check, healthCheckInterval); } };
    const stop = () => { if (id != null) { clearInterval(id); id = null; } };
    const onVisibility = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { alive = false; stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [healthCheckInterval]);

  useEffect(() => () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current); }, []);

  // Restore active cart and held invoices from DB on mount.
  // Skip cart restore when entering edit mode — the edit prefill owns the cart.
  useEffect(() => { if (!location.state?.edit_invoice_id && !location.state?.from_quotation_id) loadDraftsFromDB(); }, []);

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
      // Bank/visa is its own isolated channel (the top-level "بنك / فيزا" payment type),
      // never a configurable method — keep bank-category methods out of the multi-pay list.
      setCustomPayMethods(all.filter(m => !m.is_system && m.category !== 'bank' && m.type !== 'bank'));
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
  const [quotationContext, setQuotationContext] = useState(null); // { from_quotation_id, prefill }

  const isDirty = lines.length > 0 || !!customer;
  const { blocker } = useUnsavedChangesGuard(isDirty);
  const [showAmendSummary, setShowAmendSummary] = useState(true);
  const [showQuotationSummary, setShowQuotationSummary] = useState(true);

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
    setInvoiceNotes(prefill.notes || "");
    if (prefill.tax_enabled !== undefined) setTaxEnabled(prefill.tax_enabled ? 1 : 0);
    if (prefill.tax_rate !== undefined && prefill.tax_rate !== null) setTaxRate(Number(prefill.tax_rate));
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

  // Pre-fill cart when navigated from quotation convert flow
  useEffect(() => {
    const qState = location.state;
    if (!qState?.from_quotation_id || !qState?.prefill) return;
    const { prefill } = qState;
    clear();
    setQuotationContext(qState);
    setShowQuotationSummary(true);
    if (prefill.payment_type) setPaymentType(prefill.payment_type);
    if (prefill.discount) setDiscount(prefill.discount);
    if (prefill.increase) setIncrease(prefill.increase);
    setInvoiceNotes(prefill.notes || "");
    if (prefill.tax_enabled !== undefined) setTaxEnabled(prefill.tax_enabled ? 1 : 0);
    if (prefill.tax_rate !== undefined && prefill.tax_rate !== null) setTaxRate(Number(prefill.tax_rate));
    (prefill.lines || []).forEach((l) => addLine({
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

  useEffect(() => {
    if (!quotationContext?.prefill?.customer_id) return;
    const { prefill } = quotationContext;
    const full = customers.find((c) => c.id === prefill.customer_id);
    setCustomer(full || { id: prefill.customer_id, name: prefill.customer_name });
    setCustomerQuery(prefill.customer_name || "");
  }, [quotationContext, customers]);

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
    const handler = async (e) => {
      if (!e.detail) return;
      let item = e.detail;
      // Enrich gold items with live pricing
      if (item.is_gold_item && goldEnabled) {
        try {
          const gRes = await api.get(`/api/gold/price?item_id=${item.id}&quantity=1`);
          item = { ...item, sale_price: gRes.data.data.unit_price, _gold_priced: true };
        } catch {}
      }
      handleSelectItem(item);
    };
    window.addEventListener("pos-barcode-scanned", handler);
    return () => window.removeEventListener("pos-barcode-scanned", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldEnabled]);


  useShortcut("pos.focusItem", () => { codeInputRef.current?.focus(); codeInputRef.current?.select(); });
  useShortcut("pos.focusCustomer", () => { customerInputRef.current?.focus(); setCustomerLookupOpen(true); });
  useShortcut("pos.save", () => saveInvoiceRef.current?.(false));
  useShortcut("pos.savePrint", () => saveInvoiceRef.current?.(true));
  useShortcut("pos.cashCheckout", () => {
    if (paymentType !== "cash") { toast("متاح فقط عند الدفع النقدي الكامل"); return; }
    if (!lines.length) { toast("لا توجد أصناف في الفاتورة"); return; }
    setCashCheckoutOpen(true);
  });

  // Confirm from the cash modal: record the tendered amount, then open the print preview so
  // the user still makes the save / print choice there (nothing is persisted yet).
  function handleCashCheckoutConfirm(tenderedAmount) {
    setAmountReceived(String(tenderedAmount));
    setCashCheckoutOpen(false);
    setPrintPreview(true);
  }

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

  const baseTotals         = getTotals();
  const taxCalc            = computeTax(baseTotals.base, taxEnabled, taxRate, storeSettings);
  // totals.total is tax-inclusive from here on — amount_paid, change, credit remaining,
  // multi-payment validation, and every display all key off this one object.
  const totals             = { ...baseTotals, taxAmount: taxCalc.taxAmount, total: taxCalc.total };
  const taxFeatureOn       = Number(storeSettings?.tax_enabled ?? 0) === 1
    && (storeSettings?.tax_type === 'inclusive' || storeSettings?.tax_type === 'exclusive');
  const paidAmountNumber   = Number(amountPaid || 0);
  const creditRemaining    = Math.max(0, totals.total - Math.max(0, paidAmountNumber));

  // ── Installment plan: regenerate rows when the generator inputs change; row-level
  // edits write to installmentRows directly so they persist until an input changes.
  const installmentRemaining = Math.max(0, totals.total - paidAmountNumber);
  useEffect(() => {
    if (paymentType !== "installments") return;
    setInstallmentRows(generateInstallments(installmentRemaining, installmentCount, installmentFrequency, installmentCustomDays, installmentStartDate));
  }, [paymentType, installmentRemaining, installmentCount, installmentFrequency, installmentCustomDays, installmentStartDate]);
  const installmentAllocated = installmentRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const installmentBalanced  = installmentRows.length > 0 && Math.abs(installmentRemaining - installmentAllocated) <= 0.01;
  const handleInstallmentRowChange = (index, field, value) =>
    setInstallmentRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  const changeAmount       = Math.max(0, Number(amountReceived || 0) - totals.total);
  const promotionSummary = useMemo(() => {
    if (!promotionDiscount || !(appliedPromotions || []).length) return "";
    return (appliedPromotions || [])
      .map((p) => p.name || p.title || p.promotion_name || p.label)
      .filter(Boolean)
      .join("، ");
  }, [promotionDiscount, appliedPromotions]);

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
      result[cartLineKey(l)] = warnings;
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
    const yyyy = String(stamp.getFullYear());
    const mm = String(stamp.getMonth() + 1).padStart(2, "0");
    const dd = String(stamp.getDate()).padStart(2, "0");
    return `INV-${yyyy}${mm}${dd}-${String(invoiceSeq).padStart(4, "0")}`;
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
    if (allItemsMode) return;
    if (!q) {
      setSearchedItemResults([]);
      setSearchedItemOffset(0);
      setSearchedItemHasMore(false);
      setIsSearchingItems(false);
      return;
    }
    setIsSearchingItems(true);
    const controller = new AbortController();
    const t = setTimeout(() => {
      api.get("/api/items", { params: { search: q, limit: ITEM_PAGE, offset: 0 }, signal: controller.signal })
        .then(r => {
          const rows = (r.data.data || []).map(item => ({
            ...item,
            sub_label: `\u0645\u062e\u0632\u0648\u0646: ${Number(item.stock_quantity || item.stock || 0)}`,
            price_label: formatMoney(item.sale_price || item.price || 0),
          }));
          rows.sort((a, b) =>
            scoreItem(b, q, ["name", "item_code", "code", "barcode"]) -
            scoreItem(a, q, ["name", "item_code", "code", "barcode"])
          );
          setSearchedItemResults(rows);
          setSearchedItemOffset(rows.length);
          setSearchedItemHasMore(Boolean(r.data?.meta?.has_more ?? rows.length === ITEM_PAGE));
        }).catch(() => {})
        .finally(() => setIsSearchingItems(false));
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [itemNameQuery, itemCodeQuery, allItemsMode]);

  // When user types a new query, exit "show all" mode so loadMore uses the typed query
  useEffect(() => {
    if (itemNameQuery) {
      setAllItemsMode(false);
    }
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

  const SHOW_ALL_LIMIT = 200;

  function loadMorePOSItems() {
    if (!searchedItemHasMore || isLoadingMoreItems) return;
    const q = (itemNameQuery || itemCodeQuery).trim();
    if (!q && !allItemsMode) return;
    setIsLoadingMoreItems(true);
    const limit = allItemsMode ? SHOW_ALL_LIMIT : ITEM_PAGE;
    const params = { limit, offset: searchedItemOffset };
    if (!allItemsMode && q) params.search = q;
    api.get("/api/items", { params })
      .then(r => {
        let rows = (r.data.data || []).map(item => ({
          ...item,
          sub_label: `\u0645\u062e\u0632\u0648\u0646: ${Number(item.stock_quantity || item.stock || 0)}`,
          price_label: formatMoney(item.sale_price || item.price || 0),
        }));
        if (allItemsMode) {
          rows = sortByProximity(rows, selectedItem);
        } else if (q) {
          rows.sort((a, b) =>
            scoreItem(b, q, ["name", "item_code", "code", "barcode"]) -
            scoreItem(a, q, ["name", "item_code", "code", "barcode"])
          );
        }
        setSearchedItemResults(prev => [...prev, ...rows]);
        setSearchedItemOffset(prev => prev + rows.length);
        const more = Boolean(r.data?.meta?.has_more ?? rows.length === limit);
        setSearchedItemHasMore(more);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function showAllPOSItems() {
    setAllItemsMode(true);
    setSearchedItemOffset(0);
    setSearchedItemHasMore(true);
    setIsLoadingMoreItems(true);
    setAllItemsTargetCategory(selectedItem?.category_name ?? null);

    const fmt = (item) => ({
      ...item,
      sub_label: `مخزون: ${Number(item.stock_quantity || item.stock || 0)}`,
      price_label: formatMoney(item.sale_price || item.price || 0),
    });

    const catId = selectedItem?.category_id ?? null;
    const allCall = api.get("/api/items", { params: { limit: SHOW_ALL_LIMIT, offset: 0 } });
    const catCall = catId
      ? api.get("/api/items", { params: { category_id: catId, limit: 200 } })
      : Promise.resolve({ data: { data: [] } });

    Promise.all([catCall, allCall])
      .then(([catRes, allRes]) => {
        const catRows  = (catRes.data.data  || []).map(fmt);
        const allRows  = (allRes.data.data  || []).map(fmt);
        const pinnedId = selectedItem?.id ?? null;

        // Same-category items sorted by code-sequence distance from anchor
        const sortedCat = sortByProximity(catRows, selectedItem).filter(r => r.id !== pinnedId);

        // Remaining items (other categories) alphabetical, deduped
        const catIds = new Set(catRows.map(r => r.id));
        if (pinnedId) catIds.add(pinnedId);
        const others = [...allRows.filter(r => !catIds.has(r.id))]
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));

        const merged = [
          ...(pinnedId ? [fmt({ ...selectedItem })] : []),
          ...sortedCat,
          ...others,
        ];
        setSearchedItemResults(merged);
        setSearchedItemOffset(allRows.length);
        setSearchedItemHasMore(Boolean(allRes.data?.meta?.has_more ?? allRows.length === SHOW_ALL_LIMIT));
      })
      .catch(() => { toast.error("تعذر تحميل قائمة الأصناف"); })
      .finally(() => setIsLoadingMoreItems(false));
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
    rafRef.current = window.requestAnimationFrame(() => listItemInputRef.current?.focus());
  }

  function resetPaymentFields() {
    setAmountPaid("");
    setAmountReceived("");
    setSelectedBankId("");
    setSelectedTreasuryId("");
    setActiveMultiPayments([]);
    setInstallmentRows([]);
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
      rafRef.current = window.requestAnimationFrame(() => { listWhRef.current?.focus(); });
    } else {
      rafRef.current = window.requestAnimationFrame(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); });
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
      unit_id: unit?.id || null,
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
    if (paymentType === "installments") {
      if (installmentRemaining > 0 && !installmentRows.length) {
        setSaveMessage("يرجى إعداد جدول الأقساط."); setTimeout(() => setSaveMessage(""), 4000); return;
      }
      if (installmentRemaining > 0 && !installmentBalanced) {
        setSaveMessage(`مجموع الأقساط لا يساوي المتبقي (${formatMoney(installmentRemaining)}).`);
        setTimeout(() => setSaveMessage(""), 5000); return;
      }
    }
    if (paymentType === "bank_transfer" && !selectedBankId && banks.length > 0) {
      setSaveMessage("يرجى اختيار البنك."); setTimeout(() => setSaveMessage(""), 4000); return;
    }
    if (paymentType === "multi") {
      const filteredCustomTotal = customPayMethods
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
          item_id:       l.item_id,
          quantity:      Number(l.quantity || 0),
          unit_price:    Number(l.unit_price || 0),
          warehouse_id:  l.warehouse_id || null,
          discount:      Number(l.line_discount || 0),
          // Multi-unit (feature_multi_unit) — only sent when a sold_unit is selected
          ...(l.sold_unit_id ? {
            unit_id:       l.sold_unit_id,
            sold_unit_qty: Number(l.quantity || 0),
          } : {}),
        })),
        discount,
        promotion_discount: promotionDiscount,
        payment_type: paymentType,
        amount_paid:  (paymentType === "credit" || paymentType === "installments") ? Math.max(0, paidAmountNumber) : totals.total,
        due_date:     null,
        installment_plan: paymentType === "installments"
          ? installmentRows.map((r, i) => ({ installment_no: i + 1, due_date: r.due_date, amount: Number(r.amount || 0) }))
          : undefined,
        bank_id:      selectedBankId  ? Number(selectedBankId)  : null,
        treasury_id:  selectedTreasuryId ? Number(selectedTreasuryId) : null,
        payments:     paymentType === "multi" ? [
          ...(Number(multiCash) > 0 ? [{ method_id: null, method: "cash", amount: Number(multiCash) }] : []),
          ...customPayMethods.filter(m => Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, amount: Number(multiCustomAmounts[m.id]) })),
          ...(Number(multiCredit) > 0 && customer?.id ? [{ method_id: null, method: "credit", amount: Number(multiCredit) }] : []),
        ] : [],
        allow_loss_sale:    hasBelowCost || Boolean(opts.allowLoss),
        supervisor_override: Boolean(opts.supervisorOverride),
        notes: invoiceNotes ?? "",
        // Only send tax fields when the feature is on; normalize so the server never
        // sees raw null/boolean state. tax_rate only when the user actually overrode it.
        ...(taxFeatureOn ? {
          tax_enabled: taxEnabled == null ? 1 : (Number(taxEnabled) ? 1 : 0),
          ...(taxRate != null ? { tax_rate: Number(taxRate) } : {}),
        } : {}),
        ...(quotationContext?.from_quotation_id ? { quotation_id: quotationContext.from_quotation_id } : {}),
      };
      let response;
      if (amendInvoiceId) {
        response = await api.put(`/api/invoices/${amendInvoiceId}`, payload);
        const savedData = response.data?.data;
        const savedNo = savedData?.invoice_no || amendContext?.prefill?.invoice_no || String(amendInvoiceId);
        const receiptSnap = {
          invoice_no: savedNo, date: new Date(), lines: [...lines],
          customer: customer ? { ...customer } : null, totals: { ...totals, taxAmount: taxCalc.taxAmount, total: taxCalc.total },
          discount, increase, promotionDiscount: 0, appliedPromotions: [],
          seller: employees.find((emp) => String(emp.id) === String(sellerId)) || null,
          paymentType, amountReceived: Number(amountReceived || 0),
          cashier: user?.name || "الكاشير",
          storeName: storeSettings.company_name || "المتجر",
          storeAddress: storeSettings.address || "",
          payments: [{ method: paymentType, method_name: { cash: "نقدي", credit: "آجل", bank_transfer: "بنك", multi: "متعدد" }[paymentType] || paymentType, amount: taxCalc.total }],
          notes: invoiceNotes || null,
          tax_amount: savedData?.tax_amount ?? taxCalc.taxAmount,
          tax_rate: savedData?.tax_rate ?? taxCalc.taxRate ?? 0,
          tax_type: savedData?.tax_type ?? storeSettings?.tax_type ?? null,
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
            ...customPayMethods.filter(m => Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, method_name: m.name, amount: Number(multiCustomAmounts[m.id]) })),
            ...(Number(multiCredit) > 0 && customer?.id ? [{ method: "credit", method_name: "آجل", amount: Number(multiCredit) }] : []),
          ];
        }
        // Installments: the amount actually collected now is the down payment. The
        // remaining is shown as the schedule (installment_plan), not a lump "أقساط" line.
        if (paymentType === "installments") {
          const dp = Math.max(0, paidAmountNumber);
          return dp > 0 ? [{ method: "cash", method_name: "دفعة مقدمة", amount: dp }] : [];
        }
        const nameMap = { cash: "نقدي", credit: "آجل", bank: "بنك" };
        // For cash, print the amount the customer actually handed over so the receipt shows
        // the change to give back; the recorded sale amount stays totals.total.
        const cashPaid = (paymentType === "cash" && Number(amountReceived) > totals.total)
          ? Number(amountReceived) : totals.total;
        return [{ method: paymentType, method_name: nameMap[paymentType] || paymentType, amount: cashPaid }];
      };
      const _savedInvoiceData = response.data?.data;
      const convertedQuotationNo = quotationContext?.prefill?.quotation_no;
      const receiptSnap = {
        invoice_no: savedInvoiceNo, date: new Date(), lines: [...lines],
        customer: customer ? { ...customer } : null, totals: { ...totals, taxAmount: taxCalc.taxAmount, total: taxCalc.total },
        discount, increase, promotionDiscount, appliedPromotions: [...(appliedPromotions || [])],
        seller: employees.find((emp) => String(emp.id) === String(sellerId)) || null,
        paymentType, amountReceived: Number(amountReceived || 0),
        cashier: user?.name || "الكاشير",
        storeName: storeSettings.company_name || "المتجر",
        storeAddress: storeSettings.address || "",
        payments: buildPaymentsSnap(),
        installment_plan: paymentType === "installments" ? installmentRows.map((r, i) => ({ installment_no: i + 1, due_date: r.due_date, amount: Number(r.amount || 0), status: "pending" })) : [],
        notes: invoiceNotes || null,
        tax_amount: _savedInvoiceData?.tax_amount ?? taxCalc.taxAmount,
        tax_rate: _savedInvoiceData?.tax_rate ?? taxCalc.taxRate ?? 0,
        tax_type: _savedInvoiceData?.tax_type ?? storeSettings?.tax_type ?? null,
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
      setQuotationContext(null);
      resetActivation();
      clearActiveDraftFromDB();
      clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1);
      if (convertedQuotationNo) {
        toast.success(`تم تأكيد البيع وتحويل ${convertedQuotationNo} إلى فاتورة ${savedInvoiceNo}`, { duration: 5000 });
      }
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
      unit_id: item.unit_id || item.unit?.id || null,
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
  const rafRef           = useRef(null);
  const listAddBtnRef    = useRef(null);

  function handleListFieldKeyDown(e, nextRef, prevRef) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) { prevRef?.current?.focus(); prevRef?.current?.select?.(); }
      else { nextRef?.current?.focus(); nextRef?.current?.select?.(); }
    } else if (e.key === "ArrowLeft") {
      // RTL: left = forward (toward إضافة)
      e.preventDefault();
      nextRef?.current?.focus(); nextRef?.current?.select?.();
    } else if (e.key === "ArrowRight") {
      // RTL: right = backward (toward product name)
      e.preventDefault();
      prevRef?.current?.focus(); prevRef?.current?.select?.();
    }
  }

  const vm = {
    lines, addLine, updateLine, removeLine,
    customer, setCustomer,
    discount, setDiscount,
    increase, setIncrease,
    promotionDiscount, appliedPromotions,
    paymentType, setPaymentType,
    getTotals, clear,
    heldInvoices, holdCurrentInvoice, resumeHeldInvoice, discardHeldInvoice,
    clearActiveDraftFromDB,
    invoiceNotes, setInvoiceNotes,
    taxEnabled, setTaxEnabled, taxRate, setTaxRate, canEditTaxRate,
    heldDropdownOpen, setHeldDropdownOpen,
    staleHeldAlert, setStaleHeldAlert,
    isOffline, user,
    viewMode, setViewMode,
    pendingViewMode, setPendingViewMode,
    showSetDefaultModal, setShowSetDefaultModal,
    sellerId, setSellerId, employees,
    receiptsOpen, setReceiptsOpen,
    advancedSearchOpen, setAdvancedSearchOpen,
    profitModalOpen, setProfitModalOpen,
    profitDisplayMode, setProfitDisplayMode,
    printPreview, setPrintPreview,
    galleryOpen, setGalleryOpen, galleryZoom, setGalleryZoom,
    galleryImages, galleryIdx, setGalleryIdx,
    supervisorOverrideOpen, setSupervisorOverrideOpen,
    pendingSave, setPendingSave,
    confirmSupervisorOverride,
    storeSettings, setStoreSettings,
    newInvoiceModalOpen, setNewInvoiceModalOpen,
    saveConfirmOpen, setSaveConfirmOpen,
    cancelModalOpen, setCancelModalOpen,
    saveMessage, setSaveMessage,
    saveSuccess, onDismissSaveSuccess,
    customerCreateOpen, setCustomerCreateOpen,
    customerInfoOpen, setCustomerInfoOpen,
    quickAddOpen, setQuickAddOpen,
    blocker,
    invoiceIsActive, docNo, invoiceNumber, invoiceCreatedAt,
    showAmendSummary, setShowAmendSummary,
    amendContext, setAmendContext, amendOriginalQty,
    quotationContext, setQuotationContext,
    showQuotationSummary, setShowQuotationSummary,
    selectedTreasuryId, treasuries,
    creditEffect, displayBalance, hasCustomerBalance,
    hasBlockingErrors, stockOnlyErrors, blockingErrorCount,
    invoiceDiscountMode, setInvoiceDiscountMode,
    invoiceIncreaseMode, setInvoiceIncreaseMode,
    taxFeatureOn, taxCalc,
    lineWarnings,
    amountPaid, setAmountPaid,
    amountReceived, setAmountReceived,
    installmentStartDate, setInstallmentStartDate,
    installmentCount, setInstallmentCount,
    installmentFrequency, setInstallmentFrequency,
    installmentCustomDays, setInstallmentCustomDays,
    installmentRows, handleInstallmentRowChange,
    installmentRemaining, installmentAllocated, installmentBalanced,
    selectedBankId, setSelectedBankId,
    multiCash, setMultiCash,
    multiCredit, setMultiCredit,
    customPayMethods, multiCustomAmounts, setMultiCustomAmounts,
    customerQuery, setCustomerQuery,
    customerLookupOpen, setCustomerLookupOpen,
    activeCustomerIndex, setActiveCustomerIndex,
    customerResults, handlePickCustomer, handleCustomerKeyDown,
    customers, setCustomers,
    items, units,
    panelEffectiveCollapsed, panelWidth,
    expandPanel, togglePanel, startPanelResize,
    handleHold,
    selectedItem, setSelectedItem, staging, setStaging,
    itemNameQuery, setItemNameQuery, setItemCodeQuery,
    itemLookupOpen, setItemLookupOpen,
    activeLookupIndex, setActiveLookupIndex,
    itemResults,
    searchedItemHasMore, isLoadingMoreItems, isSearchingItems, loadMorePOSItems, showAllPOSItems,
    listItemInputRef, listQtyRef, listPriceRef, listDiscRef, listWhRef, listAddBtnRef,
    customerInputRef,
    handleListFieldKeyDown, handleSelectItem, addCurrentLine, openGallery,
    canOverridePrice,
    priceType, setPriceType,
    lastSalePrice,
    discountModes, setDiscountModes,
    stockLevels, stockLoaded,
    warehouses, getFilteredWarehouses,
    canViewProfit, showProfitColumn,
    isSaving,
    saveInvoice,
    invoiceSeq, setInvoiceSeq,
    resetPaymentFields, resetStaging, resetCustomer,
    totals,
    getLineMaxStock,
    PAYMENT_TYPES,
    banks,
    detailedSearchOpen, setDetailedSearchOpen,
    detailedSearchQuery, setDetailedSearchQuery,
    detailedCategoryFilter, setDetailedCategoryFilter,
    detailedSortConfig, setDetailedSortConfig,
    detailedColWidths, setDetailedColWidths,
    activeMultiPayments, setActiveMultiPayments,
    multiModalOpen, setMultiModalOpen,
    waLeadPhone, setWaLeadPhone,
    lastSavedInvoice, setLastSavedInvoice,
    detailedItemResults, detailedCategories,
    getItemImage, handleGridItemClick,
    multiTotal, paymentMethods,
    multiUnitEnabled, setConfigLine,
    onDetailedResizeStart, toggleDetailedSort,
  };

  return (
    <>
      {viewMode === "list" ? <POSListView vm={vm} /> : <POSDetailedView vm={vm} />}
      <PosCashCheckoutModal
        open={cashCheckoutOpen}
        total={totals.total}
        onConfirm={handleCashCheckoutConfirm}
        onClose={() => setCashCheckoutOpen(false)}
      />
    </>
  );
}
