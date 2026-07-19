import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageTour } from "../../hooks/usePageTour";
import {
  Plus, Trash2, User, Package, Search,
  ShoppingCart, Printer, Save, ChevronLeft, Info,
  Calendar, X, ImageIcon, ZoomIn, AlertTriangle,
  Grid, Clock, Banknote, CreditCard, Wallet, Layers, Minus, Plus as PlusIcon, Settings2,
  Loader2, Wand2
} from "lucide-react";
import api from "../../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import CategorySearchField from "../../components/ui/CategorySearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import toast from "react-hot-toast";
import { buildQuotationPrintDoc, formatQuotationNo } from "./quotationUtils";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { sortByProximity } from "../../utils/itemSort";
import { useGridNavigation } from "../../hooks/useGridNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd, { shortcutLabel } from "../../shortcuts/ShortcutKbd";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useAuthStore } from "../../stores/authStore";
import useCollapsibleSidebar from "../../hooks/useCollapsibleSidebar";
import PanelEdgeRail from "../pos/parts/PanelEdgeRail";
import QuotationFormBottomBar from "./QuotationFormBottomBar";
import { formatNumber } from "../../utils/currency";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
}

const DRAFT_KEY = "qtn_draft";

const COL_WIDTHS = {
  index: "36px",
  code: "70px",
  name: "minmax(150px,2fr)",
  unit: "70px",
  unit_price: "80px",
  quantity: "80px",
  discount: "80px",
  warehouse: "90px",
  total: "90px",
  actions: "36px",
};

const ALL_COLUMNS = ["index","code","name","unit","unit_price","quantity","discount","warehouse","total","actions"];
const DEFAULT_VISIBLE = ["index","code","name","unit","quantity","unit_price","total","actions"];

function formatMoney(v) {
  return formatNumber(v);
}

const PAYMENT_TYPES = [
  { value: 'cash', label: 'نقدي', icon: Banknote, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200', activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-md' },
  { value: 'bank_transfer', label: 'بنك/فيزا', icon: CreditCard, cls: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 active:bg-blue-200', activeCls: 'bg-blue-600 text-white border-blue-600 shadow-md' },
  { value: 'credit', label: 'آجل', icon: Wallet, cls: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 active:bg-amber-200', activeCls: 'bg-amber-600 text-white border-amber-600 shadow-md' },
  { value: 'installments', label: 'أقساط', icon: Layers, cls: 'text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100 active:bg-violet-200', activeCls: 'bg-violet-600 text-white border-violet-600 shadow-md' },
  { value: 'multi', label: 'متعدد', icon: Layers, cls: 'text-text-secondary bg-bg-overlay border-border-normal hover:bg-bg-overlay active:bg-border-normal', activeCls: 'bg-slate-700 text-white border-slate-700 shadow-md' },
];

export default function QuotationFormPage() {
  usePageTour('quotation_form');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("id");

  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchItem, setSearchItem] = useState("");
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);
  const ITEM_PAGE = 20;

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);

  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [appSettings, setAppSettings] = useState(null);
  const [taxEnabled, setTaxEnabled] = useState(null);
  const [taxRate, setTaxRate] = useState(null);
  const [increase, setIncrease] = useState(0);
  const [decrease, setDecrease] = useState(0);
  const [paymentType, setPaymentType] = useState('cash');

  const [selectedBankId, setSelectedBankId] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [installmentDueDate, setInstallmentDueDate] = useState("");
  const [multiCash, setMultiCash] = useState(0);
  const [multiCredit, setMultiCredit] = useState(0);
  const [banks, setBanks] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [customPayMethods, setCustomPayMethods] = useState([]);
  const [multiCustomAmounts, setMultiCustomAmounts] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const currentUser = useAuthStore((s) => s.user);
  const [listCategoryFilter, setListCategoryFilter] = useState(null);
  const [listCategoryQuery, setListCategoryQuery] = useState("");
  const [categories, setCategories] = useState([]);

  const [editActivation, setEditActivation] = useState(null);
  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("quotation", editActivation);
  const wasSaved = useRef(false);
  const isDirty = (cart.length > 0 || !!notes || !!expiresAt || !!selectedCustomer) && !wasSaved.current;
  const { blocker } = useUnsavedChangesGuard(isDirty);
  const [pendingNav, setPendingNav] = useState(null);
  const showUnsavedModal = blocker.state === "blocked" || pendingNav !== null;
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [browseItemsOpen, setBrowseItemsOpen] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer.quotation.visibleColumns") || "null") || DEFAULT_VISIBLE; } catch { return DEFAULT_VISIBLE; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.quotation.visibleColumns", JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns]);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Escape-to-close for modals/dropdowns
  useEffect(() => {
    if (!imageModalOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setImageModalOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [imageModalOpen]);
  useEffect(() => {
    if (!browseItemsOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setBrowseItemsOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [browseItemsOpen]);
  useEffect(() => {
    if (!customerCreateOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setCustomerCreateOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [customerCreateOpen]);
  useEffect(() => {
    if (!previewOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPreviewOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [previewOpen]);
  useEffect(() => {
    if (!colSettingsOpen) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setColSettingsOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [colSettingsOpen]);
  useEffect(() => {
    if (!showCustomerList) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowCustomerList(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [showCustomerList]);
  useEffect(() => {
    if (!saveSuccess) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onDismissSaveSuccess(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [saveSuccess, onDismissSaveSuccess]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ qty: 1, price: 0, discount: 0 });
  const [increaseMode, setIncreaseMode] = useState('flat');
  const [decreaseMode, setDecreaseMode] = useState('flat');
  const [warehouses, setWarehouses] = useState([]);
  const [priceType, setPriceType] = useState('retail');

  // Collapsible sidebar
  const sidebar = useCollapsibleSidebar({
    storageKeyPrefix: "retailer.quotation",
    defaultWidth: 360,
    minWidth: 300,
  });
  const { panelWidth, panelEffectiveCollapsed, togglePanel, startPanelResize } = sidebar;

   const searchRef = useRef(null);
   const qtyRef = useRef(null);
   const priceRef = useRef(null);
   const discountRef = useRef(null);
   const whRef = useRef(null);
   const addBtnRef = useRef(null);

  const handleKeyDown = useFieldNavigation();
  const gridNavRef = useRef(null);
  const { focusLastRowQty } = useGridNavigation(gridNavRef, { qtyCol: "quantity" });
  useShortcut("grid.editLast", () => focusLastRowQty());

  const customerRef = useRef(null);
  const priceTypeRef = useRef(null);
  const expiresAtRef = useRef(null);
  const notesRef = useRef(null);
  const increaseRef = useRef(null);
  const decreaseRef = useRef(null);
  const saveBtnRef = useRef(null);
  const bankSelectRef = useRef(null);
  const amountPaidRef = useRef(null);
  const installmentDateRef = useRef(null);
  const multiCashRef = useRef(null);
  const multiCreditRef = useRef(null);

  const [recentPrices, setRecentPrices] = useState({});
  const initialLoadDone = useRef(false);

  // Load recent prices from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("qtn_recent_prices");
      if (stored) setRecentPrices(JSON.parse(stored));
    } catch {}
  }, []);

  function saveRecentPrice(customerId, itemId, price) {
    if (!customerId || !itemId) return;
    const key = `${customerId}_${itemId}`;
    const updated = { ...recentPrices, [key]: price };
    setRecentPrices(updated);
    try { localStorage.setItem("qtn_recent_prices", JSON.stringify(updated)); } catch {}
  }

  // Autosave draft
  useEffect(() => {
    if (loading || editId) return;
    const timer = setTimeout(() => {
      if (cart.length > 0 || notes || expiresAt) {
        const draft = {
          customer: selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phone } : null,
          cart: cart.map(i => ({ ...i })),
          notes, expiresAt, increase, decrease, paymentType,
          savedAt: Date.now(),
        };
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [cart, notes, expiresAt, selectedCustomer, loading, editId, increase, decrease, paymentType]);

  // Restore draft
  useEffect(() => {
    if (loading || editId) return;
    if (initialLoadDone.current) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.cart?.length > 0 && !editId) {
          const age = Date.now() - (draft.savedAt || 0);
          if (age < 86400000) {
            if (draft.customer) {
              const found = customers.find(c => c.id === draft.customer.id);
              if (found) setSelectedCustomer(found);
            }
            if (draft.cart?.length > 0) setCart(draft.cart);
            if (draft.notes) setNotes(draft.notes);
            if (draft.expiresAt) setExpiresAt(draft.expiresAt);
            if (draft.increase) setIncrease(draft.increase);
            if (draft.decrease) setDecrease(draft.decrease);
            if (draft.paymentType) setPaymentType(draft.paymentType);
            toast.success("تم استعادة مسودة غير مكتملة", { duration: 3000 });
          }
        }
      }
    } catch {}
    initialLoadDone.current = true;
  }, [customers, loading, editId]);

  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  // Keyboard shortcuts
  const handleSaveRef = useRef(null);
  handleSaveRef.current = handleSave;
  useShortcut("quotation.save", () => handleSaveRef.current?.());
  const handlePrintRef = useRef(null);
  handlePrintRef.current = handlePrint;
  useShortcut("quotation.print", () => handlePrintRef.current?.());

  // Barcode scanner listener
  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef(null);
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3) {
        const code = barcodeBuffer.current;
        barcodeBuffer.current = "";
        e.preventDefault();
        api.get(`/api/items/barcode/${encodeURIComponent(code)}`).then(res => {
          const item = res.data.data;
          if (item) { addToCart(item); toast.success(`تم إضافة ${item.name}`, { duration: 1500 }); }
          else toast.error("لم يتم العثور على صنف بهذا الباركود");
        }).catch(() => toast.error("خطأ في البحث بالباركود"));
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          barcodeBuffer.current += e.key;
          clearTimeout(barcodeTimer.current);
          barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ""; }, 300);
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(barcodeTimer.current); };
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/api/customers"),
      api.get("/api/items"),
      editId ? api.get(`/api/quotations/${editId}`) : null,
      api.get("/api/settings"),
      api.get("/api/warehouses"),
      api.get("/api/banks"),
      api.get("/api/payment-methods"),
    ]).then(([cust, itm, edit, settingsRes, whRes, banksRes, methodsRes]) => {
      setCustomers(cust.data.data || []);
      setItems(itm.data.data || []);
      setAppSettings(settingsRes.data.data || null);
      setWarehouses(whRes.data?.data || []);
      setBanks(banksRes.data?.data || []);
      const allMethods = methodsRes.data?.data || [];
      setPaymentMethods(allMethods);
      setCustomPayMethods(allMethods.filter(m => !m.is_system && m.category !== 'bank' && m.type !== 'bank'));
      if (edit) {
        const q = edit.data.data;
        setEditActivation({ docNo: q.doc_no || null, createdAt: q.created_at || null });
        setSelectedCustomer(cust.data.data.find(c => c.id === q.customer_id));
        setCart(q.lines.map(l => ({
           id: l.item_id,
           name: l.item_name,
           code: l.item_code || "",
           price: l.unit_price,
           qty: l.quantity,
           discount: l.discount_amount || 0,
           unit_name: l.unit_name || "",
           warehouse_id: l.warehouse_id || null,
        })));
        setNotes(q.notes || "");
        setExpiresAt(q.expires_at || "");
        setIncrease(Number(q.increase || 0));
        setDecrease(Number(q.decrease || 0));
        setPaymentType(q.payment_type || 'cash');
        if (q.tax_enabled !== undefined) setTaxEnabled(q.tax_enabled ? 1 : 0);
        if (q.tax_rate !== undefined && q.tax_rate !== null) setTaxRate(Number(q.tax_rate));
        initialLoadDone.current = true;
      }
    }).finally(() => { setLoading(false); });
  }, [editId]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || String(c.phone).includes(q)).slice(0, 5);
  }, [customerQuery, customers]);

  useEffect(() => {
    const q = searchItem.trim();
    if (!q) { setFilteredItems([]); setItemOffset(0); setItemHasMore(false); return; }
    const t = setTimeout(() => {
      const params = { search: q, limit: ITEM_PAGE, offset: 0 };
      if (listCategoryFilter?.id) params.category_id = listCategoryFilter.id;
      api.get("/api/items", { params })
        .then(r => {
          const rows = r.data.data || [];
          setFilteredItems(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
        }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [searchItem, listCategoryFilter]);

  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  function loadMoreItems() {
    if (!itemHasMore || isLoadingMoreItems) return;
    const q = searchItem.trim();
    if (!q && !allItemsMode) return;
    setIsLoadingMoreItems(true);
    const searchParam = allItemsMode ? "" : q;
    const params = { search: searchParam, limit: ITEM_PAGE, offset: itemOffset };
    if (listCategoryFilter?.id) params.category_id = listCategoryFilter.id;
    api.get("/api/items", { params })
      .then(r => {
        const rows = r.data.data || [];
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function showAllItems() {
    const SHOW_ALL_LIMIT = 200;
    const fmt = (i) => ({ ...i, price_label: formatMoney(i.sale_price || 0) });
    const anchor = selectedItem;
    setAllItemsMode(true);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(true);
    setIsLoadingMoreItems(true);

    if (listCategoryFilter?.id) {
      api.get("/api/items", { params: { category_id: listCategoryFilter.id, limit: SHOW_ALL_LIMIT, offset: 0 } })
        .then(r => {
          const rows = (r.data.data || []).map(fmt);
          setFilteredItems(listCategoryFilter?.id ? sortByProximity(rows, anchor) : rows);
          setItemOffset(rows.length);
          setItemHasMore(Boolean(r.data?.meta?.has_more ?? rows.length === SHOW_ALL_LIMIT));
        }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
      return;
    }

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

  function addStagedToCart() {
    if (!selectedItem) return;
    activateInvoice();
    const qty = Math.max(1, staging.qty || 1);
    const price = Math.max(0, staging.price || 0);
    const discount = Math.max(0, staging.discount || 0);
    const defaultWhId = warehouses.length > 0 ? warehouses[0].id : null;
    setCart(prev => {
      const existing = prev.find(i => i.id === selectedItem.id);
      if (existing) {
        return prev.map(i => i.id === selectedItem.id ? { ...i, qty: i.qty + qty } : i);
      }
      return [...prev, {
        id: selectedItem.id, name: selectedItem.name, code: selectedItem.code,
        barcode: selectedItem.barcode,
        price, qty, discount,
        unit_name: selectedItem.unit_name || "",
        stock: Number(selectedItem.stock_quantity || 0),
        warehouse_id: defaultWhId,
      }];
    });
    if (selectedCustomer) saveRecentPrice(selectedCustomer.id, selectedItem.id, price);
    setSearchItem("");
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setListCategoryFilter(null);
    setListCategoryQuery("");
    setSelectedItem(null);
    setStaging({ qty: 1, price: 0, discount: 0 });
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function addToCart(item) {
    activateInvoice();
    const defaultWhId = warehouses.length > 0 ? warehouses[0].id : null;
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      let suggestedPrice = item.sale_price;
      if (selectedCustomer) {
        const key = `${selectedCustomer.id}_${item.id}`;
        if (recentPrices[key]) suggestedPrice = recentPrices[key];
      }
      return [...prev, {
        id: item.id, name: item.name, code: item.code, barcode: item.barcode,
        price: suggestedPrice, qty: 1, discount: 0,
        unit_name: item.unit_name || "",
        stock: Number(item.stock_quantity || 0),
        warehouse_id: defaultWhId,
      }];
    });
    setSearchItem("");
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setListCategoryFilter(null);
    setListCategoryQuery("");
  }

  async function loadBrowseItems(p = 1) {
    setBrowseLoading(true);
    try {
      const res = await api.get(`/api/items?limit=20&offset=${(p - 1) * 20}`);
      setBrowseItems(res.data.data || []);
      const total = Number(res.data.total || res.data.data?.length || 0);
      setBrowseTotalPages(Math.ceil(total / 20) || 1);
      setBrowsePage(p);
    } catch {} finally { setBrowseLoading(false); }
  }

  function openBrowse() {
    setBrowseItemsOpen(true);
    loadBrowseItems(1);
  }

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const discount = cart.reduce((acc, i) => acc + Number(i.discount || 0), 0);
    const base = Math.max(0, subtotal - discount + increase - decrease);
    const taxFeatureOn = Number(appSettings?.tax_enabled ?? 0) === 1
      && (appSettings?.tax_type === 'inclusive' || appSettings?.tax_type === 'exclusive');
    let taxAmount = 0, total = base;
    if (taxFeatureOn) {
      const enabled = taxEnabled === null ? true : Boolean(taxEnabled);
      if (enabled) {
        const rate = taxRate !== null ? Number(taxRate) : Number(appSettings?.tax_rate || 0);
        if (appSettings?.tax_type === 'exclusive') {
          taxAmount = Math.round((base * rate / 100 + Number.EPSILON) * 100) / 100;
          total = Math.round((base + taxAmount + Number.EPSILON) * 100) / 100;
        } else {
          taxAmount = Math.round((base * rate / (100 + rate) + Number.EPSILON) * 100) / 100;
        }
      }
    }
    return { subtotal, discount, increase, decrease, base, taxAmount, total, taxFeatureOn };
  }, [cart, appSettings, taxEnabled, taxRate, increase, decrease]);

  async function handleSave() {
    if (!cart.length) return toast.error("السلة فارغة، أضف صنفاً واحداً على الأقل");

    for (const item of cart) {
      if (!item.qty || item.qty < 1) return toast.error(`الكمية غير صالحة للصنف: ${item.name}`);
      if (item.price < 0) return toast.error(`السعر غير صالح للصنف: ${item.name}`);
      if (item.discount < 0) return toast.error(`الخصم غير صالح للصنف: ${item.name}`);
      if (item.discount > item.price * item.qty) return toast.error(`الخصم يتجاوز إجمالي الصنف: ${item.name}`);
    }

    setIsSaving(true);
    try {
      const payload = {
        doc_no: docNo || null,
        customer_id: selectedCustomer?.id || null,
        notes,
        expires_at: expiresAt || null,
        tax_enabled: taxEnabled,
        tax_rate: taxRate,
        increase,
        decrease,
        payment_type: paymentType,
        lines: cart.map(i => ({
          item_id: i.id,
          quantity: i.qty,
          unit_price: i.price,
          discount_amount: i.discount,
          description: i.name,
          warehouse_id: i.warehouse_id || null,
        }))
      };
      if (editId) await api.put(`/api/quotations/${editId}`, payload);
      else await api.post("/api/quotations", payload);

      if (selectedCustomer) {
        cart.forEach(i => saveRecentPrice(selectedCustomer.id, i.id, i.price));
      }
      wasSaved.current = true;
      discardDraft();
      setSaveSuccess({
        invoiceNumber: docNo || formatQuotationNo(editId),
        total: formatMoney(totals.total),
        customerName: selectedCustomer?.name,
      });
    } catch (e) {
      const msg = e?.response?.data?.message || "فشل حفظ عرض السعر";
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  }

  function getOriginalPrice(itemId) {
    const item = items.find(i => i.id === itemId);
    return item ? Number(item.sale_price || 0) : null;
  }

  function handleDiscountChange(itemId, rawValue) {
    const value = Number(rawValue) || 0;
    setCart(prev => prev.map(i => i.id === itemId ? { ...i, discount: value } : i));
  }

  function getDiscountPercent(item) {
    const total = item.price * item.qty;
    if (total <= 0) return 0;
    return Math.round((Number(item.discount || 0) / total) * 100);
  }

  const onDismissSaveSuccess = useCallback(() => {
    setSaveSuccess(null);
    navigate("/operations/quotations");
  }, [navigate]);

  function handlePrint() {
    if (!cart.length) {
      toast.error("أضف صنفاً واحداً على الأقل قبل المعاينة");
      return;
    }
    setPreviewOpen(true);
  }

  const previewDoc = useMemo(() => buildQuotationPrintDoc({
    cart,
    customer: selectedCustomer,
    totals,
    expiresAt,
    notes,
    paymentType,
    editId,
    cashierName: currentUser?.name || "",
    docNo: docNo || null,
  }), [cart, selectedCustomer, totals, expiresAt, notes, paymentType, editId, currentUser, docNo]);

  const effectiveVisible = useMemo(() => {
    const set = new Set(visibleColumns);
    set.add("index");
    set.add("actions");
    return ALL_COLUMNS.filter(c => set.has(c));
  }, [visibleColumns]);
  const gridTemplate = effectiveVisible.map(c => COL_WIDTHS[c]).join(" ");

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-[var(--bg-base)] font-sans overflow-hidden px-4 lg:px-8 pb-6">
      <div data-help="quote-form-header">
        <DocumentHeaderBar
          onBack={() => {
            if (isDirty) setPendingNav("/operations/quotations");
            else navigate("/operations/quotations");
          }}
          title={editId ? `تعديل عرض سعر ${docNo || formatQuotationNo(editId)}` : "عرض سعر جديد"}
          subtitle="إعداد عرض سعر احترافي للعميل قبل اعتماد الفاتورة"
          extras={
            <div className="flex gap-1.5 items-center">
              {currentUser?.name && (
                <div className="flex items-center gap-1.5 rounded-sm bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  المحرر: {currentUser.name}
                </div>
              )}
              <input disabled
                value={invoiceIsActive ? (docNo || "") : "—"}
                className="h-6 w-32 rounded-sm border border-border-normal bg-bg-overlay px-2 text-[11px] font-mono font-black text-text-secondary cursor-not-allowed outline-none text-center" />
              <input disabled
                value={invoiceIsActive && invoiceCreatedAt ? formatArabicDateTime(new Date(invoiceCreatedAt)) : "—"}
                className="h-6 w-40 rounded-sm border border-border-normal bg-bg-overlay px-2 text-[11px] font-mono font-bold text-text-muted cursor-not-allowed outline-none text-center select-none" />
            </div>
          }
          actions={
            <PermissionGate page="quotations" action={editId ? "edit" : "add"}>
              <DocumentActionButton variant="primary" identity="slate" icon={Save} onClick={handleSave} loading={isSaving}>
                {isSaving ? "جاري الحفظ..." : "حفظ العرض"}
              </DocumentActionButton>
            </PermissionGate>
          }
        />
      </div>

      <div className="flex flex-1 min-h-0" style={{ paddingBottom: panelEffectiveCollapsed ? "var(--bottom-bar-h, 90px)" : undefined }}>
             <div className="flex flex-1 flex-col p-4 gap-4 min-w-0">
             {/* Entry Bar — Quotation */}
               <section data-help="items-section" className="rounded-2xl border p-3 shadow-sm shrink-0" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
                <div className="entry-bar">
                 {/* 1. Image thumbnail */}
                 <EntryItemThumb item={selectedItem} onView={(imgs) => { const u = resolveImageUrl(imgs[0]); if (u) { setImagePreviewUrl(u); setImageModalOpen(true); } }} />
                 {/* 2. Search field + barcode + browse */}
                 <div className="entry-field entry-field--item">
                   <label className="entry-label">الصنف</label>
                   <CategorySearchField
                     categories={categories}
                     value={listCategoryFilter}
                     query={listCategoryQuery}
                     onQueryChange={setListCategoryQuery}
                     onChange={(cat) => {
                       setListCategoryFilter(cat);
                       setListCategoryQuery("");
                       setSelectedItem(null);
                       setSearchItem("");
                     }}
                     onPickDone={(catId) => {
                       setTimeout(() => {
                         searchRef.current?.focus();
                         showAllItems();
                       }, 50);
                     }}
                   />
                   <ProductSearchField
                     ref={searchRef}
                     onNavigateNext={() => { qtyRef.current?.focus(); qtyRef.current?.select?.(); }}
                     query={searchItem}
                     onQueryChange={(val) => { setSearchItem(val); setSelectedItem(null); }}
                     results={filteredItems}
                     emptyLabel="الصنف غير موجود"
                     selectedItem={selectedItem}
                     chipCode={(it) => it.code || it.barcode || `#${it.id}`}
                     showChip={false}
                     onLoadMore={loadMoreItems}
                     hasMore={itemHasMore}
                     isLoadingMore={isLoadingMoreItems}
                     onShowAll={showAllItems}
                     hideZeroStock={false}
                      onPick={(item) => {
                        let suggestedPrice = item.sale_price;
                        if (selectedCustomer) {
                          const key = `${selectedCustomer.id}_${item.id}`;
                          if (recentPrices[key]) suggestedPrice = recentPrices[key];
                        }
                        setSelectedItem(item);
                        setStaging({ qty: 1, price: suggestedPrice, discount: 0, warehouse_id: warehouses.length > 0 ? warehouses[0].id : null });
                        setPriceType('retail');
                        const cat = categories.find(c => c.id === item.category_id) || categories.find(c => c.name === item.category_name) || null;
                        const skuPrefix = cat?.sku_prefix ?? item?.sku_prefix ?? null;
                        setListCategoryFilter(cat ? { id: cat.id, name: cat.name, sku_prefix: skuPrefix } : null);
                        setListCategoryQuery("");
                        setTimeout(() => qtyRef.current?.focus(), 50);
                      }}
                   />
                   <span className="text-[10px] font-bold mt-1" style={{ color: "var(--text-muted)" }}>يمكنك مسح الباركود مباشرة بالScanner</span>
                 </div>
                 {/* 3. Quantity */}
                 <div className="entry-field entry-field--qty">
                   <label className="entry-label">الكمية</label>
                   <input ref={qtyRef} type="number" min="1" step="1" value={staging.qty}
                     onChange={(e) => setStaging(s => ({ ...s, qty: Math.max(1, Number(e.target.value) || 1) }))}
                     onFocus={e => e.target.select()}
                      onKeyDown={(e) => handleKeyDown(e, { nextRef: priceTypeRef })}
                      className="entry-control text-center"
                   />
                 </div>
                 {/* 4. Price */}
                 <div className="entry-field entry-field--price">
                   <div className="flex items-center justify-between gap-1">
                     <label className="entry-label">السعر</label>
                     <span className="text-[10px] font-mono text-text-muted truncate">
                       {(() => {
                         if (selectedCustomer && selectedItem) {
                           const key = `${selectedCustomer.id}_${selectedItem.id}`;
                           if (recentPrices[key]) return `آخر: ${Number(recentPrices[key]).toFixed(2)}`;
                         }
                         return selectedItem ? formatMoney(Number(selectedItem.sale_price || 0)) : "";
                       })()}
                     </span>
                   </div>
                   <div className={`entry-control flex items-stretch !p-0 overflow-hidden
                     ${selectedItem && Number(staging.price) > 0 && Number(staging.price) < Number(selectedItem.purchase_price || 0) ? "!border-rose-400 !bg-rose-50" : ""}`}>
                     <select ref={priceTypeRef} value={priceType} onChange={(e) => {
                         const t = e.target.value; setPriceType(t);
                         if (!selectedItem) return;
                         if (t === "wholesale" && Number(selectedItem.wholesale_price) > 0) {
                           setStaging(s => ({ ...s, price: Number(selectedItem.wholesale_price) }));
                         } else {
                           setStaging(s => ({ ...s, price: Number(selectedItem.sale_price || 0) }));
                         }
                       }}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: priceRef })}
                       className="h-full shrink-0 bg-transparent text-[10px] font-bold text-text-secondary px-1 outline-none cursor-pointer border-e border-border-normal"
                     >
                       <option value="retail">مستهلك</option>
                       {selectedItem && Number(selectedItem.wholesale_price) > 0 && <option value="wholesale">جملة</option>}
                     </select>
                     <input ref={priceRef} type="number" step="0.01" value={staging.price}
                       onChange={(e) => setStaging(s => ({ ...s, price: Math.max(0, Number(e.target.value) || 0) }))}
                       onFocus={e => e.target.select()}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: discountRef })}
                       className="flex-1 min-w-0 h-full bg-transparent text-center text-2sm font-black text-text-primary outline-none px-1"
                     />
                   </div>
                 </div>
                 {/* 5. Discount */}
                 <div className="entry-field entry-field--disc">
                   <label className="entry-label">خصم</label>
                   <input ref={discountRef} type="number" min="0" step="0.01" value={staging.discount}
                     onChange={(e) => setStaging(s => ({ ...s, discount: Math.max(0, Number(e.target.value) || 0) }))}
                     onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: whRef })}
                     className="entry-control text-center"
                   />
                 </div>
                 {/* 6. Warehouse with stock */}
                 <div className="entry-field entry-field--wh">
                   <label className="entry-label">الرصيد / المخزن</label>
                   <WarehouseSelect
                     ref={whRef}
                     value={staging.warehouse_id == null ? (warehouses[0]?.id ?? null) : staging.warehouse_id}
                     onChange={(id) => setStaging(s => ({ ...s, warehouse_id: Number(id) }))}
                     placeholder={selectedItem ? "لا يوجد مخازن" : "اختر صنفاً أولاً"}
                     emptyLabel="لا يوجد مخازن"
                     onKeyDown={(e) => handleKeyDown(e, { nextRef: addBtnRef })}
                     options={(() => {
                       if (!selectedItem) return [];
                       const itemStock = Number(selectedItem.stock_quantity || 0);
                       const isInsuff = Number(staging.qty) > itemStock;
                       const tone = isInsuff ? "insufficient" : itemStock <= 0 ? "out" : itemStock < 5 ? "low" : "normal";
                       return warehouses.map(w => ({ id: w.id, name: w.name, qty: itemStock, tone }));
                     })()}
                   />
                 </div>
                 {/* 7. Unit */}
                 <div className="entry-field entry-field--unit">
                   <label className="entry-label">الوحدة</label>
                   <div className="entry-control entry-control--readonly">
                     <span className="truncate">{selectedItem?.unit_name || "أساسية"}</span>
                   </div>
                 </div>
                 {/* 8. Add button */}
                  <button ref={addBtnRef} onClick={addStagedToCart} disabled={!selectedItem}
                      onKeyDown={(e) => handleKeyDown(e, { nextRef: searchRef, prevRef: whRef, onEnter: addStagedToCart })}
                     data-help="quote-form-add-item"
                     className="entry-add-btn"
                   ><Plus className="h-4 w-4" /> إضافة</button>
                  <div ref={colSettingsRef} className="relative flex items-center">
                    <button onClick={() => setColSettingsOpen(p => !p)}
                      className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-amber-100 transition-all"
                      title="تخصيص الأعمدة"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                    {colSettingsOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-border-normal bg-bg-surface shadow-xl py-1">
                        <div className="px-3 py-1.5 text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border-subtle">الأعمدة الظاهرة</div>
                        {ALL_COLUMNS.filter(c => c !== "index" && c !== "actions").map(cid => {
                          const labels = { code: "الكود", name: "البيان", unit: "الوحدة", warehouse: "المخزن", quantity: "الكمية", unit_price: "سعر الوحدة", discount: "الخصم", total: "الإجمالي" };
                          return (
                            <label key={cid} className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-overlay cursor-pointer text-2sm font-bold text-text-primary">
                              <input type="checkbox" checked={visibleColumns.includes(cid)}
                                onChange={() => setVisibleColumns(p => p.includes(cid) ? p.filter(c => c !== cid) : [...p, cid])}
                                className="rounded border-border-strong text-indigo-600 focus:ring-indigo-300"
                              />
                              {labels[cid] || cid}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
               {selectedItem && (() => {
                 const purchasePrice = Number(selectedItem.purchase_price || 0);
                 const isBelowCost = staging.price > 0 && purchasePrice > 0 && staging.price < purchasePrice;
                 const availableStock = Number(selectedItem.stock_quantity || 0);
                 const isQtyExceeded = staging.qty > 0 && availableStock > 0 && staging.qty > availableStock;
                 return (
                   <>
                     {isQtyExceeded && (
                       <div className="flex items-center gap-1.5 rounded-sm bg-rose-50 border border-rose-200 px-3 py-1.5 mt-2 text-[11px] font-bold text-rose-700">
                         <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                         الكمية ({staging.qty}) تتجاوز المتاح ({availableStock})
                       </div>
                     )}
                     {isBelowCost && (
                       <div className="flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-3 py-1.5 mt-2 text-[11px] font-bold text-amber-700">
                         <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                         السعر أقل من سعر الشراء ({formatMoney(purchasePrice)})
                       </div>
                     )}
                   </>
                 );
                 })()}
               </section>

               {/* Cart Table */}
                <div data-help="quote-form-items" className="rounded-2xl border p-2 flex flex-1 flex-col overflow-x-auto" style={{ backgroundColor: "var(--primary-100)", borderColor: "var(--primary-200)" }}>
                <div style={{ gridTemplateColumns: gridTemplate }} className="grid items-center border-b border-border-strong bg-bg-overlay text-[11px] font-black uppercase text-text-secondary">
                    {effectiveVisible.includes("index") && <div className="px-1 py-2.5 border-l border-border-normal text-center">#</div>}
                    {effectiveVisible.includes("code") && <div className="px-1 py-2.5 border-l border-border-normal text-center">الكود</div>}
                    {effectiveVisible.includes("name") && <div className="px-2 py-2.5 border-l border-border-normal">البيان</div>}
                    {effectiveVisible.includes("unit") && <div className="px-1 py-2.5 border-l border-border-normal text-center">الوحدة</div>}
                    {effectiveVisible.includes("unit_price") && <div className="px-1 py-2.5 border-l border-border-normal text-center">سعر الوحدة</div>}
                    {effectiveVisible.includes("quantity") && <div className="px-1 py-2.5 border-l border-border-normal text-center">الكمية</div>}
                    {effectiveVisible.includes("discount") && <div className="px-1 py-2.5 border-l border-border-normal text-center">الخصم</div>}
                    {effectiveVisible.includes("warehouse") && <div className="px-1 py-2.5 border-l border-border-normal text-center">المخزن</div>}
                    {effectiveVisible.includes("total") && <div className="px-2 py-2.5 border-l border-border-normal text-left">الإجمالي</div>}
                    {effectiveVisible.includes("actions") && <div></div>}
                 </div>

                <div ref={gridNavRef} className="flex-1 overflow-y-auto divide-y divide-border-subtle scrollbar-thin">
                   {cart.length === 0 ? (
                     <div className="flex h-full flex-col items-center justify-center text-text-muted">
                        <div className="mb-3 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-black text-amber-700">عرض سعر</div>
                        <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm font-black text-text-secondary">عرض السعر فارغ</p>
                        <p className="text-[11px] font-bold text-text-muted mt-1">أضف أصنافاً باستخدام البحث أو ماسح الباركود</p>
                        <div className="flex gap-3 mt-4">
                          <button onClick={openBrowse} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 hover:bg-amber-100">
                            <Grid className="h-4 w-4" /> تصفح الأصناف
                          </button>
                        </div>
                     </div>
                    ) : cart.map((item, idx) => {
                     const origPrice = getOriginalPrice(item.id);
                     const discountPct = getDiscountPercent(item);
                     const rowKey = `${item.id}-${idx}`;
                     return (
                      <div key={rowKey} style={{ gridTemplateColumns: gridTemplate }} className={`grid items-center text-2sm transition-colors ${idx % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-overlay/40'}`}>
                         {effectiveVisible.includes("index") && (
                           <div className="px-1 py-2.5 text-center font-mono text-text-muted border-l border-border-subtle text-[11px]">{idx + 1}</div>
                         )}
                         {effectiveVisible.includes("code") && (
                           <div className="px-1 py-2.5 border-l border-border-subtle">
                             <span className="font-mono text-[11px] font-bold text-text-secondary whitespace-normal break-words block">{item.code || item.barcode || "—"}</span>
                           </div>
                         )}
                         {effectiveVisible.includes("name") && (
                           <div className="px-2 py-2.5 font-black text-text-primary border-l border-border-subtle">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const itemObj = items.find(i => i.id === item.id);
                                  const imgUrl = itemObj?.primary_image_url || itemObj?.image_url || itemObj?.image;
                                  if (imgUrl) {
                                    return (
                                      <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-border-normal">
                                        <img src={resolveImageUrl(imgUrl)} alt={item.name} className="w-7 h-7 object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <ZoomIn className="w-3 h-3 text-white" />
                                        </div>
                                      </button>
                                    );
                                   }
                                 })()}
                                 <div className="flex flex-col min-w-0">
                                   <span className="text-2sm whitespace-normal break-words">{item.name}</span>
                                  {item.stock > 0 && <span className="text-[9px] font-bold text-text-muted">المخزون: {item.stock}</span>}
                                </div>
                              </div>
                           </div>
                         )}
                         {effectiveVisible.includes("unit") && (
                           <div className="px-1 py-2.5 border-l border-border-subtle text-center font-bold text-text-secondary text-[11px]">
                             {item.unit_name || "أساسية"}
                           </div>
                         )}
                         {effectiveVisible.includes("unit_price") && (
                           <div className="px-1 py-2.5 border-l border-border-subtle">
                              <input type="number" min="0" step="0.01" value={item.price}
                                data-grid-cell data-row={idx} data-col="unit_price"
                                onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, price: Math.max(0, Number(e.target.value)) } : i))}
                                className={`w-full bg-transparent text-center font-black text-text-primary outline-none hover:bg-bg-overlay focus:bg-bg-surface focus:ring-1 focus:ring-slate-300 text-[13px] ${origPrice !== null && origPrice !== item.price ? 'text-amber-700' : ''}`}
                              />
                              {origPrice !== null && origPrice !== item.price && (
                                <div className="text-[9px] font-bold text-amber-400 text-center line-through">{formatMoney(origPrice)}</div>
                              )}
                           </div>
                         )}
                         {effectiveVisible.includes("quantity") && (
                           <div className="px-1 py-2.5 border-l border-border-subtle">
                              <input type="number" min="1" step="1" value={item.qty}
                                data-grid-cell data-row={idx} data-col="quantity"
                                onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(1, Number(e.target.value)) } : i))}
                                className="w-full bg-transparent text-center font-black text-text-primary outline-none hover:bg-bg-overlay focus:bg-bg-surface focus:ring-1 focus:ring-slate-300 text-[13px]"
                              />
                           </div>
                         )}
                         {effectiveVisible.includes("discount") && (
                           <div className="px-1 py-2.5 border-l border-border-subtle relative">
                              <input type="number" min="0" step="0.01" value={item.discount}
                                data-grid-cell data-row={idx} data-col="discount"
                                onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                                className="w-full bg-transparent text-center font-black text-text-muted outline-none hover:bg-bg-overlay focus:bg-bg-surface focus:ring-1 focus:ring-slate-300 text-[13px]"
                              />
                              {discountPct > 0 && (
                                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-rose-400 bg-rose-50 px-1 rounded-full">{discountPct}%</span>
                              )}
                           </div>
                         )}
                         {effectiveVisible.includes("warehouse") && (
                           <div className="px-1 py-2.5 border-l border-border-subtle">
                             <select value={item.warehouse_id || ''} data-grid-cell data-row={idx} data-col="warehouse_id" onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, warehouse_id: e.target.value ? Number(e.target.value) : null } : i))}
                               className="w-full bg-transparent text-center font-bold text-text-secondary outline-none hover:bg-bg-overlay focus:bg-bg-surface focus:ring-1 focus:ring-slate-300 text-[11px]"
                             >
                               {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                             </select>
                           </div>
                         )}
                         {effectiveVisible.includes("total") && (
                           <div className="px-2 py-2.5 text-left font-black text-text-primary border-l border-border-subtle text-[13px]">
                              {formatMoney((item.price * item.qty) - item.discount)}
                           </div>
                         )}
                         {effectiveVisible.includes("actions") && (
                           <div className="px-1 flex justify-center">
                              <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                                className="text-text-muted hover:text-rose-500 transition-colors">
                                 <Trash2 className="h-3.5 w-3.5" />
                              </button>
                           </div>
                         )}
                      </div>
                     );
                   })}
               </div>
            </div>
         </div>

         {/* PanelEdgeRail */}
         <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel} onResizeStart={(e) => startPanelResize(e, "right")} panelSide="right" />

         {/* Sidebar */}
         <aside className={`shrink-0 flex flex-col border-r border-border-strong bg-bg-surface p-5 gap-4 overflow-y-auto ${panelEffectiveCollapsed ? "hidden" : ""}`} style={{ width: panelWidth, minWidth: panelWidth }}>
            {/* Customer Section — Optional */}
            <div data-help="quote-form-customer" className="flex flex-col gap-1.5">
               <label className="text-[11px] number-fmt-primary uppercase text-text-muted tracking-wider">العميل المستهدف <span className="text-text-muted font-normal normal-case">(اختياري)</span></label>
               {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-3 text-white">
                     <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-900"><User className="h-4 w-4" /></div>
                        <div className="flex flex-col">
                           <span className="text-sm font-black">{selectedCustomer.name}</span>
                           <span className="text-[11px] font-bold opacity-60">{selectedCustomer.phone}</span>
                           {Number(selectedCustomer.opening_balance) !== 0 && (
                             <span className={`text-[10px] font-black mt-0.5 ${Number(selectedCustomer.opening_balance) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                               {Number(selectedCustomer.opening_balance) > 0 ? "رصيد: " : "مديونية: "}{Math.abs(Number(selectedCustomer.opening_balance)).toFixed(2)}
                             </span>
                           )}
                        </div>
                     </div>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); }} className="opacity-40 hover:opacity-100"><X className="h-4 w-4"/></button>
                 </div>
               ) : (
                 <div className="relative">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input ref={customerRef} type="text" autoFocus placeholder="ابحث عن عميل..." value={customerQuery}
                       onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerList(true); }}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: expiresAtRef, prevRef: searchRef })}
                       className="w-full rounded-sm border border-border-normal bg-bg-overlay py-2.5 pr-10 text-2sm font-bold text-text-primary outline-none focus:border-slate-800"
                     />
                    {showCustomerList && filteredCustomers.length > 0 && (
                      <div className="absolute top-full right-0 z-20 mt-1 w-full rounded-md border border-border-normal bg-bg-surface shadow-xl">
                         {filteredCustomers.map(c => (
                            <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); activateInvoice(); }}
                             className="flex w-full flex-col px-4 py-2 text-right hover:bg-bg-overlay border-b last:border-0 border-border-subtle">
                              <span className="text-2sm font-black text-text-primary">{c.name}</span>
                              <span className="text-[11px] font-bold text-text-muted">{c.phone}</span>
                           </button>
                         ))}
                         <button onClick={() => { setShowCustomerList(false); setCustomerCreateOpen(true); }}
                           className="flex w-full items-center gap-2 px-4 py-3 text-right text-sm font-black text-violet-600 hover:bg-violet-50 border-t border-border-subtle">
                           <Plus className="h-4 w-4" /> إنشاء عميل جديد
                         </button>
                      </div>
                    )}
                    {showCustomerList && filteredCustomers.length === 0 && customerQuery.trim() && (
                      <div className="absolute top-full right-0 z-20 mt-1 w-full rounded-md border border-border-normal bg-bg-surface shadow-xl p-3 text-center">
                        <p className="text-xs font-bold text-text-muted mb-2">لا يوجد عميل بهذا الاسم</p>
                        <button onClick={() => { setShowCustomerList(false); setCustomerCreateOpen(true); }}
                          className="text-sm font-black text-violet-600 hover:text-violet-800">+ إنشاء عميل جديد</button>
                      </div>
                    )}
                 </div>
               )}
            </div>

            {/* Payment Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase text-text-muted tracking-wider">طريقة الدفع</label>
              <p className="text-[10px] text-text-muted font-bold">اختر طريقة الدفع المناسبة لعرض السعر</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_TYPES.map(pt => {
                  const Icon = pt.icon;
                  const isActive = paymentType === pt.value;
                  const hasCustomer = selectedCustomer?.id != null;
                  const isDisabled = !hasCustomer && (pt.value === "credit" || pt.value === "installments" || pt.value === "bank_transfer");
                  const colorMap = {
                    cash: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", activeBg: "bg-emerald-600" },
                    bank_transfer: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", activeBg: "bg-blue-600" },
                    credit: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", activeBg: "bg-amber-600" },
                    installments: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", activeBg: "bg-violet-600" },
                    multi: { bg: "bg-bg-overlay", text: "text-text-secondary", border: "border-border-normal", activeBg: "bg-slate-700" },
                  };
                  const c = colorMap[pt.value];
                  return (
                    <button key={pt.value} onClick={() => !isDisabled && setPaymentType(pt.value)} disabled={isDisabled}
                      title={isDisabled ? "يجب اختيار عميل مسجل أولاً" : undefined}
                      className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all duration-150 ${
                        isActive
                          ? `${c.activeBg} text-white border-transparent shadow-md`
                          : isDisabled
                            ? "border-border-subtle opacity-40 cursor-not-allowed bg-bg-overlay text-text-muted"
                            : "border-border-normal hover:border-border-strong hover:shadow-sm text-text-primary bg-bg-surface"
                      }`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isActive ? "bg-bg-surface/20" : c.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : c.text}`} />
                      </div>
                      <span className="text-[10px] font-black leading-tight">{pt.label}</span>
                      {isActive && <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-bg-surface/80" />}
                    </button>
                  );
                })}
              </div>

              {/* Bank transfer sub-form */}
              {paymentType === "bank_transfer" && (
                <div className="mt-2 space-y-2 rounded-md border border-blue-200 bg-blue-50/50 p-3">
                  <label className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" /> اختر البنك / البطاقة
                  </label>
                   <select ref={bankSelectRef} value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, { nextRef: expiresAtRef, prevRef: customerRef })}
                     className="w-full rounded border border-blue-300 bg-bg-surface px-3 py-2 text-sm font-bold text-text-primary outline-none focus:border-blue-500"
                   >
                    <option value="">اختر البنك / البطاقة</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {/* Credit sub-form */}
              {paymentType === "credit" && selectedCustomer && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs font-bold text-amber-800 flex items-center gap-2">
                  <Wallet className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>سيتم إضافة {formatMoney(totals.total)} إلى رصيد {selectedCustomer.name}</span>
                </div>
              )}

              {/* Installments sub-form */}
              {paymentType === "installments" && (
                <div className="mt-2 space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-3">
                  <div className="text-xs font-black text-violet-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> إعداد الأقساط
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-secondary">دفعة مقدم</span>
                    <input ref={amountPaidRef} type="number" min="0" value={amountPaid}
                       onChange={e => setAmountPaid(e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: installmentDateRef, prevRef: customerRef })}
                       className="w-28 rounded border border-violet-300 bg-bg-surface px-3 py-1.5 text-center font-mono text-sm font-black text-text-primary outline-none focus:border-violet-500"
                     />
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-text-secondary">تاريخ استحقاق القسط</span>
                     <input ref={installmentDateRef} type="date" value={installmentDueDate}
                       onChange={e => setInstallmentDueDate(e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: expiresAtRef, prevRef: amountPaidRef })}
                       className="w-36 rounded border border-violet-300 bg-bg-surface px-3 py-1.5 text-sm font-bold text-text-primary outline-none focus:border-violet-500"
                     />
                  </div>
                  {selectedCustomer && (
                    <div className="rounded bg-violet-100/60 px-3 py-1.5 text-xs font-black text-violet-800 text-center border border-violet-200">
                      المتبقي: {formatMoney(Math.max(0, totals.total - Number(amountPaid || 0)))} على {selectedCustomer.name}
                    </div>
                  )}
                </div>
              )}

              {/* Multi payment sub-form */}
              {paymentType === "multi" && (
                <div className="mt-2 space-y-2 rounded-md border border-border-normal bg-bg-overlay/60 p-3">
                  <div className="text-xs font-black text-text-secondary flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> تفاصيل الدفع المتعدد
                  </div>
                  <div className="flex flex-col divide-y divide-border-subtle">
                    <div className="flex items-center gap-2 py-2 first:pt-0">
                      <span className="flex-1 min-w-0 text-xs font-bold text-text-secondary">💵 نقدي</span>
                      <input ref={multiCashRef} type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00"
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: multiCreditRef, prevRef: customerRef })}
                        className="w-28 shrink-0 rounded border border-emerald-200 bg-bg-surface px-3 py-1.5 text-2sm font-black text-text-primary text-left outline-none focus:border-emerald-400" />
                      <button type="button" title="املأ المتبقي" onClick={() => { const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); const cr = Number(multiCredit||0); setMultiCash(String(Math.max(0, totals.total - c - cr))); }}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 active:scale-90">
                        <Wand2 className="h-3 w-3" />
                      </button>
                    </div>
                    {customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').map(m => (
                      <div key={m.id} className="flex items-center gap-2 py-2">
                        <span className="flex-1 min-w-0 text-xs font-bold text-text-secondary leading-snug break-words">{m.icon} {m.name}</span>
                        <input type="number" min="0" value={multiCustomAmounts[m.id] || ""} onChange={(e) => setMultiCustomAmounts(prev => ({...prev, [m.id]: e.target.value}))} placeholder="0.00"
                          className="w-28 shrink-0 rounded border border-violet-200 bg-bg-surface px-3 py-1.5 text-2sm font-black text-text-primary text-left outline-none focus:border-violet-400" />
                        <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const cr = Number(multiCredit||0); const others = customPayMethods.filter(mm => !mm.name?.includes('بنك') && !mm.name?.includes('تحويل') && mm.icon !== '🏦' && mm.id !== m.id).reduce((s, mm) => s + Number(multiCustomAmounts[mm.id]||0), 0); setMultiCustomAmounts(prev => ({...prev, [m.id]: String(Math.max(0, totals.total - ca - others - cr))})); }}
                          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 active:scale-90">
                          <Wand2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 py-2 last:pb-0">
                      <span className={`flex-1 min-w-0 text-xs font-bold leading-snug ${selectedCustomer?.id ? 'text-amber-700' : 'text-text-muted'}`}>📋 آجل</span>
                      <input ref={multiCreditRef} type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)}
                        placeholder={selectedCustomer?.id ? "0.00" : "اختر عميل..."} disabled={!selectedCustomer?.id}
                        className={`w-28 shrink-0 rounded px-3 py-1.5 text-2sm font-black text-left outline-none ${selectedCustomer?.id ? 'border border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400' : 'border border-border-normal bg-bg-overlay text-text-muted cursor-not-allowed'}`} />
                      <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); setMultiCredit(String(Math.max(0, totals.total - ca - c))); }}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 active:scale-90">
                        <Wand2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0);
                    const entered = (Number(multiCash)||0) + c + (Number(multiCredit)||0);
                    const balanced = Math.abs(entered - totals.total) < 0.01;
                    return (
                      <div className={`flex items-center justify-between rounded px-3 py-1.5 text-xs font-black border ${balanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        <span>المُدخل</span>
                        <span className="number-fmt-primary">{formatMoney(entered)} / {formatMoney(totals.total)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-1 gap-3">
               <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black uppercase text-text-muted tracking-wider">صلاحية العرض حتى</label>
                  <div className="relative">
                     <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
                     <input ref={expiresAtRef} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: notesRef, prevRef: customerRef })}
                        className="w-full rounded-sm border border-border-normal bg-bg-overlay py-2.5 pr-10 text-2sm font-bold text-text-primary outline-none focus:border-slate-800" />
                  </div>
               </div>
                <div data-help="quote-form-notes" className="flex flex-col gap-1.5">
                   <label className="text-[11px] font-black uppercase text-text-muted tracking-wider">ملاحظات العرض</label>
                   <textarea ref={notesRef} rows="2" placeholder="ملاحظات إضافية..." value={notes} onChange={(e) => setNotes(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, { nextRef: increaseRef, prevRef: expiresAtRef })}
                     className="w-full rounded-sm border border-border-normal bg-bg-overlay p-3 text-2sm font-bold text-text-primary outline-none focus:border-slate-800 resize-none" />
               </div>
            </div>

            {/* Totals Section */}
            <div className="mt-auto space-y-3">
               <div className="rounded-md border border-border-normal bg-bg-overlay p-4 space-y-2.5">
                  <div className="flex justify-between text-2sm font-bold text-text-secondary">
                     <span>الإجمالي قبل الخصم</span>
                     <span>{formatMoney(totals.subtotal)}</span>
                  </div>
                   {/* Increase input with mode toggle */}
                  <div data-help="quote-form-discount" className="flex items-center justify-between gap-2">
                    <span className="text-2sm font-bold text-text-secondary">زيادة</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        const raw = increaseMode === 'pct' ? (totals.subtotal > 0 ? (increase / totals.subtotal) * 100 : 0) : increase;
                        const v = Math.max(0, raw - 1);
                        increaseMode === 'pct' ? setIncrease(totals.subtotal * v / 100) : setIncrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-bg-surface text-text-secondary hover:bg-bg-overlay text-xs font-black"><Minus className="h-3 w-3" /></button>
                       <input ref={increaseRef} type="number" min="0" step={increaseMode === 'pct' ? '0.1' : '0.5'}
                         value={increaseMode === 'pct' ? (totals.subtotal > 0 ? parseFloat(((increase / totals.subtotal) * 100).toFixed(2)) : 0) : increase}
                         onChange={e => {
                           const v = Math.max(0, Number(e.target.value) || 0);
                           increaseMode === 'pct' ? setIncrease(parseFloat(((v / 100) * totals.subtotal).toFixed(4))) : setIncrease(v);
                         }}
                         onKeyDown={(e) => handleKeyDown(e, { nextRef: decreaseRef, prevRef: notesRef })}
                         className="w-20 rounded border border-border-strong bg-bg-surface px-2 py-1 text-center font-mono text-sm font-black text-text-primary outline-none focus:border-violet-500" />
                      <button onClick={() => {
                        const raw = increaseMode === 'pct' ? (totals.subtotal > 0 ? (increase / totals.subtotal) * 100 : 0) : increase;
                        const v = raw + 1;
                        increaseMode === 'pct' ? setIncrease(totals.subtotal * v / 100) : setIncrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-bg-surface text-text-secondary hover:bg-bg-overlay text-xs font-black"><PlusIcon className="h-3 w-3" /></button>
                      <button type="button" onClick={() => setIncreaseMode(m => m === 'pct' ? 'flat' : 'pct')}
                        title={increaseMode === 'pct' ? 'تغيير إلى قيمة ثابتة' : 'تغيير إلى نسبة مئوية'}
                        className={`h-7 px-2 rounded text-xs font-black border transition-all ${increaseMode === 'pct' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-bg-overlay border-border-normal text-text-secondary hover:bg-bg-overlay'}`}
                      >{increaseMode === 'pct' ? '%' : 'ج'}</button>
                    </div>
                  </div>

                  {/* Decrease input with mode toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2sm font-bold text-text-secondary">نقصان</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        const raw = decreaseMode === 'pct' ? (totals.subtotal > 0 ? (decrease / totals.subtotal) * 100 : 0) : decrease;
                        const v = Math.max(0, raw - 1);
                        decreaseMode === 'pct' ? setDecrease(totals.subtotal * v / 100) : setDecrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-bg-surface text-text-secondary hover:bg-bg-overlay text-xs font-black"><Minus className="h-3 w-3" /></button>
                       <input ref={decreaseRef} type="number" min="0" step={decreaseMode === 'pct' ? '0.1' : '0.5'}
                         value={decreaseMode === 'pct' ? (totals.subtotal > 0 ? parseFloat(((decrease / totals.subtotal) * 100).toFixed(2)) : 0) : decrease}
                         onChange={e => {
                           const v = Math.max(0, Number(e.target.value) || 0);
                           decreaseMode === 'pct' ? setDecrease(parseFloat(((v / 100) * totals.subtotal).toFixed(4))) : setDecrease(v);
                         }}
                         onKeyDown={(e) => handleKeyDown(e, { nextRef: saveBtnRef, prevRef: increaseRef })}
                         className="w-20 rounded border border-border-strong bg-bg-surface px-2 py-1 text-center font-mono text-sm font-black text-text-primary outline-none focus:border-violet-500" />
                      <button onClick={() => {
                        const raw = decreaseMode === 'pct' ? (totals.subtotal > 0 ? (decrease / totals.subtotal) * 100 : 0) : decrease;
                        const v = raw + 1;
                        decreaseMode === 'pct' ? setDecrease(totals.subtotal * v / 100) : setDecrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-bg-surface text-text-secondary hover:bg-bg-overlay text-xs font-black"><PlusIcon className="h-3 w-3" /></button>
                      <button type="button" onClick={() => setDecreaseMode(m => m === 'pct' ? 'flat' : 'pct')}
                        title={decreaseMode === 'pct' ? 'تغيير إلى قيمة ثابتة' : 'تغيير إلى نسبة مئوية'}
                        className={`h-7 px-2 rounded text-xs font-black border transition-all ${decreaseMode === 'pct' ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-bg-overlay border-border-normal text-text-secondary hover:bg-bg-overlay'}`}
                      >{decreaseMode === 'pct' ? '%' : 'ج'}</button>
                    </div>
                  </div>

                  {totals.taxFeatureOn && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={taxEnabled === null ? true : Boolean(taxEnabled)}
                          onChange={e => setTaxEnabled(e.target.checked ? 1 : 0)} className="accent-indigo-600" />
                        <span className="text-2sm font-bold text-indigo-600">
                          ضريبة ({taxRate !== null ? taxRate : Number(appSettings?.tax_rate || 0)}%)
                        </span>
                      </div>
                      <span className="text-2sm font-black text-indigo-600">+{formatMoney(totals.taxAmount)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border-normal" />
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-black text-text-primary uppercase tracking-tight">الصافي النهائي</span>
                     <span className="text-[24px] font-black text-text-primary">{formatMoney(totals.total)}</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                   <PermissionGate page="quotations" action="print">
                      <button onClick={handlePrint} className="flex h-11 items-center justify-center gap-2 rounded-sm border border-border-strong bg-bg-surface text-sm font-black text-text-primary hover:bg-bg-overlay">
                         <Printer className="h-4 w-4 text-text-muted" /> معاينة <ShortcutKbd id="quotation.print" className="rounded bg-bg-overlay px-1 text-[9px] font-mono text-text-secondary" />
                      </button>
                   </PermissionGate>
                   <PermissionGate page="quotations" action={editId ? "edit" : "add"}>
                      <button ref={saveBtnRef} onClick={handleSave} disabled={isSaving}
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: searchRef, onEnter: handleSave })}
                        data-help="quote-form-submit"
                        className="flex h-11 items-center justify-center gap-2 rounded-sm bg-primary text-sm font-black text-white hover:bg-primary-600 shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                         {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                         {isSaving ? "جاري الحفظ..." : "حفظ العرض"}
                      </button>
                    </PermissionGate>
               </div>

               <div className="flex items-center gap-3 rounded-sm border border-amber-100 bg-amber-50 p-3">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-900 leading-tight">عرض السعر لا يخصم من رصيد المخزن حتى يتم تحويله لفاتورة بيع فعلية.</p>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted">
                 <Clock className="h-3 w-3" />
                 <span>اختصارات: {shortcutLabel("quotation.save")} حفظ | {shortcutLabel("quotation.print")} طباعة | الماسح الضوئي يعمل تلقائياً</span>
               </div>
            </div>
         </aside>
      </div>

      {/* Sticky Bottom Bar (shown when sidebar collapsed) */}
      <QuotationFormBottomBar
        forceShow={panelEffectiveCollapsed}
        totals={totals}
        cart={cart}
        selectedCustomer={selectedCustomer}
        customerQuery={customerQuery}
        onCustomerQueryChange={setCustomerQuery}
        onCustomerPick={(c) => { setSelectedCustomer(c); setShowCustomerList(false); }}
        showCustomerList={showCustomerList}
        onShowCustomerListChange={setShowCustomerList}
        filteredCustomers={filteredCustomers}
        onCustomerCreate={() => setCustomerCreateOpen(true)}
        onCustomerClear={() => { setSelectedCustomer(null); setCustomerQuery(""); }}
        paymentType={paymentType}
        onPaymentChange={setPaymentType}
        increase={increase}
        onIncreaseChange={setIncrease}
        increaseMode={increaseMode}
        onIncreaseModeChange={setIncreaseMode}
        decrease={decrease}
        onDecreaseChange={setDecrease}
        decreaseMode={decreaseMode}
        onDecreaseModeChange={setDecreaseMode}
        taxEnabled={taxEnabled}
        onTaxEnabledChange={setTaxEnabled}
        taxRate={taxRate !== null ? taxRate : Number(appSettings?.tax_rate || 0)}
        taxFeatureOn={totals.taxFeatureOn}
        onSave={handleSave}
        onPrint={handlePrint}
        isSaving={isSaving}
        banks={banks}
        selectedBankId={selectedBankId}
        onBankChange={setSelectedBankId}
        multiCash={multiCash}
        onMultiCashChange={setMultiCash}
        multiCredit={multiCredit}
        onMultiCreditChange={setMultiCredit}
        customPayMethods={customPayMethods}
        multiCustomAmounts={multiCustomAmounts}
        onMultiCustomAmountsChange={setMultiCustomAmounts}
        amountPaid={amountPaid}
        onAmountPaidChange={setAmountPaid}
        installmentDueDate={installmentDueDate}
        onInstallmentDueDateChange={setInstallmentDueDate}
      />

      {/* Image Preview Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="معاينة صورة الصنف" size="md" showDetach={false}>
        <div className="flex flex-col items-center justify-center p-4 bg-bg-overlay/50 rounded-lg border border-border-subtle">
          {imagePreviewUrl ? (
            <img src={imagePreviewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain rounded-md shadow-sm border border-border-normal bg-bg-surface" />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="font-bold">الصورة غير متوفرة</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Browse Items Modal */}
      <Modal open={browseItemsOpen} onClose={() => setBrowseItemsOpen(false)} title="تصفح الأصناف" size="lg" showDetach={false}>
        <div className="p-2">
          {browseLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-[3px] border-violet-100 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1">
                {browseItems.map(item => (
                  <button key={item.id} onClick={() => { addToCart(item); setBrowseItemsOpen(false); }}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border-normal bg-bg-surface p-4 hover:border-violet-300 hover:shadow-md transition-all text-center group">
                    {item.primary_image_url || item.image_url || item.image ? (
                      <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover border border-border-subtle" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-bg-overlay flex items-center justify-center border border-border-normal">
                        <Package className="w-6 h-6 text-text-muted" />
                      </div>
                    )}
                    <span className="text-xs font-black text-text-primary leading-tight line-clamp-2">{item.name}</span>
                    <span className="text-xs font-black text-violet-600">{formatMoney(item.sale_price)}</span>
                    <span className="text-[9px] font-bold text-text-muted">{item.code || ""}</span>
                    {item.stock_quantity > 0 && <span className="text-[9px] font-bold text-emerald-600">المخزون: {item.stock_quantity}</span>}
                  </button>
                ))}
              </div>
              {browseTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border-subtle">
                  <button disabled={browsePage <= 1} onClick={() => loadBrowseItems(browsePage - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-normal text-text-secondary hover:bg-bg-overlay disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-text-secondary px-3">صفحة {browsePage} من {browseTotalPages}</span>
                  <button disabled={browsePage >= browseTotalPages} onClick={() => loadBrowseItems(browsePage + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-normal text-text-secondary hover:bg-bg-overlay disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Add Customer Modal */}
      <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)}
        onCreated={(customer) => {
          setCustomers((prev) => [customer, ...prev]);
          setSelectedCustomer(customer);
          setCustomerQuery(customer.name);
          setCustomerCreateOpen(false);
        }}
      />

      {saveSuccess && (
        <InvoiceSaveSuccess
          invoiceNumber={saveSuccess.invoiceNumber}
          total={saveSuccess.total}
          customerName={saveSuccess.customerName}
          onDismiss={onDismissSaveSuccess}
        />
      )}

      <UnsavedChangesModal
        open={showUnsavedModal}
        onStay={() => { setPendingNav(null); blocker.reset?.(); }}
        onLeave={() => {
          discardDraft();
          const path = pendingNav;
          setPendingNav(null);
          if (path) navigate(path);
          else blocker.proceed?.();
        }}
      />

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoice={previewDoc}
        settings={appSettings || {}}
        docType="quotation"
        operationLabel="عرض سعر"
        confirmLabel="حفظ وطباعة"
        onConfirmPrint={handleSave}
        onSaveOnly={handleSave}
        saveOnlyLabel="حفظ فقط"
        isSaving={isSaving}
      />

    </div>
  );
}
