import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, User, Package, Search,
  ShoppingCart, Printer, Save, ChevronLeft, Info,
  Calendar, X, ImageIcon, ZoomIn, AlertTriangle,
  Grid, Clock, Banknote, CreditCard, Wallet, Layers, Minus, Plus as PlusIcon,
  Loader2
} from "lucide-react";
import api from "../../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import toast from "react-hot-toast";
import { buildQuotationPrintDoc } from "./quotationUtils";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

const DRAFT_KEY = "qtn_draft";

function formatMoney(v) {
  return formatNumber(v);
}

const PAYMENT_TYPES = [
  { value: 'cash', label: 'نقدي', icon: Banknote, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200', activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-md' },
  { value: 'bank_transfer', label: 'بنك/فيزا', icon: CreditCard, cls: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 active:bg-blue-200', activeCls: 'bg-blue-600 text-white border-blue-600 shadow-md' },
  { value: 'credit', label: 'آجل', icon: Wallet, cls: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 active:bg-amber-200', activeCls: 'bg-amber-600 text-white border-amber-600 shadow-md' },
  { value: 'installments', label: 'أقساط', icon: Layers, cls: 'text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100 active:bg-violet-200', activeCls: 'bg-violet-600 text-white border-violet-600 shadow-md' },
  { value: 'multi', label: 'متعدد', icon: Layers, cls: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100 active:bg-slate-200', activeCls: 'bg-slate-700 text-white border-slate-700 shadow-md' },
];

export default function QuotationFormPage() {
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

  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [browseItemsOpen, setBrowseItemsOpen] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);



  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ qty: 1, price: 0, discount: 0 });
  const [increaseMode, setIncreaseMode] = useState('flat');
  const [decreaseMode, setDecreaseMode] = useState('flat');
  const [warehouses, setWarehouses] = useState([]);
  const [priceType, setPriceType] = useState('retail');

   const searchRef = useRef(null);
   const qtyRef = useRef(null);
   const priceRef = useRef(null);
   const discountRef = useRef(null);
   const whRef = useRef(null);
   const addBtnRef = useRef(null);

  const handleKeyDown = useFieldNavigation();

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
  useEffect(() => {
    function handler(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSaveRef.current?.(); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    ]).then(([cust, itm, edit, settingsRes, whRes, banksRes]) => {
      setCustomers(cust.data.data || []);
      setItems(itm.data.data || []);
      setAppSettings(settingsRes.data.data || null);
      setWarehouses(whRes.data?.data || []);
      setBanks(banksRes.data?.data || []);
      if (edit) {
        const q = edit.data.data;
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
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
          const rows = r.data.data || [];
          setFilteredItems(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
        }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [searchItem]);

  function loadMoreItems() {
    const q = searchItem.trim();
    if (!itemHasMore || !q || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = r.data.data || [];
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function addStagedToCart() {
    if (!selectedItem) return;
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
    setSelectedItem(null);
    setStaging({ qty: 1, price: 0, discount: 0 });
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function addToCart(item) {
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
      discardDraft();
      toast.success(editId ? "تم تحديث عرض السعر بنجاح" : "تم إنشاء عرض السعر بنجاح");
      navigate("/operations/quotations");
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
  }), [cart, selectedCustomer, totals, expiresAt, notes, paymentType, editId]);

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-[var(--bg-base)] font-sans overflow-hidden px-4 lg:px-8 pb-6">
      <DocumentHeaderBar
        onBack={() => {
          if (cart.length > 0) setWarnModalOpen(true);
          else navigate("/operations/quotations");
        }}
        title={editId ? "تعديل عرض سعر" : "محرر عرض سعر"}
        subtitle="إعداد عرض سعر احترافي للعميل قبل اعتماد الفاتورة"
        actions={
          <PermissionGate page="quotations" action={editId ? "edit" : "add"}>
            <DocumentActionButton variant="primary" identity="slate" icon={Save} onClick={handleSave} loading={isSaving}>
              {isSaving ? "جاري الحفظ..." : "حفظ العرض"}
            </DocumentActionButton>
          </PermissionGate>
        }
      />

      <div className="flex flex-1 min-h-0">
         <div className="flex flex-1 flex-col p-4 gap-4 overflow-hidden">
             {/* Entry Bar — Quotation */}
              <section className="rounded-md border border-amber-200 bg-white shadow-sm shrink-0 overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] number-fmt-primary text-amber-800">
                    <span className="bg-amber-600 text-white text-[10px] rounded-sm px-1.5 py-0.5">عرض سعر</span>
                    <span className="hidden sm:inline">إضافة أصناف إلى عرض السعر</span>
                  </span>
                </div>
                <div className="p-2.5">
                <div className="entry-bar">
                 {/* 1. Image thumbnail */}
                 <EntryItemThumb item={selectedItem} onView={(imgs) => { const u = resolveImageUrl(imgs[0]); if (u) { setImagePreviewUrl(u); setImageModalOpen(true); } }} />
                 {/* 2. Search field + barcode + browse */}
                 <div className="entry-field entry-field--item">
                   <label className="entry-label">الصنف</label>
                   <ProductSearchField
                     ref={searchRef}
                     query={searchItem}
                     onQueryChange={(val) => { setSearchItem(val); setSelectedItem(null); }}
                     results={filteredItems}
                     emptyLabel="الصنف غير موجود"
                     selectedItem={selectedItem}
                     chipCode={(it) => it.code || it.barcode || `#${it.id}`}
                     onLoadMore={loadMoreItems}
                     hasMore={itemHasMore}
                     isLoadingMore={isLoadingMoreItems}
                     onPick={(item) => {
                       let suggestedPrice = item.sale_price;
                       if (selectedCustomer) {
                         const key = `${selectedCustomer.id}_${item.id}`;
                         if (recentPrices[key]) suggestedPrice = recentPrices[key];
                       }
                       setSelectedItem(item);
                       setStaging({ qty: 1, price: suggestedPrice, discount: 0, warehouse_id: warehouses.length > 0 ? warehouses[0].id : null });
                       setPriceType('retail');
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
                     <span className="text-[10px] font-mono text-slate-400 truncate">
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
                       className="h-full shrink-0 bg-transparent text-[10px] font-bold text-slate-500 px-1 outline-none cursor-pointer border-e border-slate-200"
                     >
                       <option value="retail">مستهلك</option>
                       {selectedItem && Number(selectedItem.wholesale_price) > 0 && <option value="wholesale">جملة</option>}
                     </select>
                     <input ref={priceRef} type="number" step="0.01" value={staging.price}
                       onChange={(e) => setStaging(s => ({ ...s, price: Math.max(0, Number(e.target.value) || 0) }))}
                       onFocus={e => e.target.select()}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: discountRef })}
                       className="flex-1 min-w-0 h-full bg-transparent text-center text-2sm font-black text-slate-800 outline-none px-1"
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
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: customerRef, onEnter: addStagedToCart })}
                   className="entry-add-btn"
                 ><Plus className="h-4 w-4" /> إضافة</button>
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
                </div>
              </section>

             {/* Cart Table */}
             <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-amber-200/60 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-50/80 px-3 py-1">
                  <span className="rounded-sm bg-amber-600 px-1.5 py-[1px] text-[9px] font-black text-white">عرض سعر</span>
                  <span className="text-[10px] font-bold text-amber-700">أصـناف عرض السعر</span>
                </div>
                <div className="grid grid-cols-[36px_70px_minmax(150px,2fr)_70px_80px_80px_80px_90px_90px_36px] items-center border-b border-slate-300 bg-slate-50 text-[11px] font-black uppercase text-slate-500">
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">#</div>
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">الكود</div>
                    <div className="px-2 py-2.5 border-l border-slate-200">البيان</div>
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">الوحدة</div>
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">سعر الوحدة</div>
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">الكمية</div>
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">الخصم</div>
                    <div className="px-1 py-2.5 border-l border-slate-200 text-center">المخزن</div>
                    <div className="px-2 py-2.5 border-l border-slate-200 text-left">الإجمالي</div>
                    <div></div>
                 </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                   {cart.length === 0 ? (
                     <div className="flex h-full flex-col items-center justify-center text-slate-400">
                        <div className="mb-3 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-black text-amber-700">عرض سعر</div>
                        <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm font-black text-slate-500">عرض السعر فارغ</p>
                        <p className="text-[11px] font-bold text-slate-400 mt-1">أضف أصنافاً باستخدام البحث أو ماسح الباركود</p>
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
                     <div key={rowKey} className={`grid grid-cols-[36px_70px_minmax(150px,2fr)_70px_80px_80px_80px_90px_90px_36px] items-center text-2sm transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <div className="px-1 py-2.5 text-center font-mono text-slate-400 border-l border-slate-50 text-[11px]">{idx + 1}</div>
                        <div className="px-1 py-2.5 border-l border-slate-50">
                          <span className="font-mono text-[11px] font-bold text-slate-500 truncate block">{item.code || item.barcode || "—"}</span>
                        </div>
                        <div className="px-2 py-2.5 font-black text-slate-800 border-l border-slate-50">
                           <div className="flex items-center gap-2">
                             {(() => {
                               const itemObj = items.find(i => i.id === item.id);
                               const imgUrl = itemObj?.primary_image_url || itemObj?.image_url || itemObj?.image;
                               if (imgUrl) {
                                 return (
                                   <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                                     <img src={resolveImageUrl(imgUrl)} alt={item.name} className="w-7 h-7 object-cover" />
                                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                       <ZoomIn className="w-3 h-3 text-white" />
                                     </div>
                                   </button>
                                 );
                               }
                               return (
                                 <div className="w-7 h-7 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-3.5 h-3.5 text-slate-300"/></div>
                               );
                             })()}
                             <div className="flex flex-col min-w-0">
                               <span className="text-2sm truncate">{item.name}</span>
                               {item.stock > 0 && <span className="text-[9px] font-bold text-slate-400">المخزون: {item.stock}</span>}
                             </div>
                           </div>
                        </div>
                        <div className="px-1 py-2.5 border-l border-slate-50 text-center font-bold text-slate-500 text-[11px]">
                          {item.unit_name || "أساسية"}
                        </div>
                        <div className="px-1 py-2.5 border-l border-slate-50">
                           <input type="number" min="0" step="0.01" value={item.price}
                             onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, price: Math.max(0, Number(e.target.value)) } : i))}
                             className={`w-full bg-transparent text-center font-black text-slate-700 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300 text-[13px] ${origPrice !== null && origPrice !== item.price ? 'text-amber-700' : ''}`}
                           />
                           {origPrice !== null && origPrice !== item.price && (
                             <div className="text-[9px] font-bold text-amber-400 text-center line-through">{formatMoney(origPrice)}</div>
                           )}
                        </div>
                        <div className="px-1 py-2.5 border-l border-slate-50">
                           <input type="number" min="1" step="1" value={item.qty}
                             onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(1, Number(e.target.value)) } : i))}
                             className="w-full bg-transparent text-center font-black text-slate-700 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300 text-[13px]"
                           />
                        </div>
                        <div className="px-1 py-2.5 border-l border-slate-50 relative">
                           <input type="number" min="0" step="0.01" value={item.discount}
                             onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                             className="w-full bg-transparent text-center font-black text-slate-400 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300 text-[13px]"
                           />
                           {discountPct > 0 && (
                             <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-rose-400 bg-rose-50 px-1 rounded-full">{discountPct}%</span>
                           )}
                        </div>
                        <div className="px-1 py-2.5 border-l border-slate-50">
                          <select value={item.warehouse_id || ''} onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, warehouse_id: e.target.value ? Number(e.target.value) : null } : i))}
                            className="w-full bg-transparent text-center font-bold text-slate-600 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300 text-[11px]"
                          >
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                        <div className="px-2 py-2.5 text-left font-black text-slate-900 border-l border-slate-50 text-[13px]">
                           {formatMoney((item.price * item.qty) - item.discount)}
                        </div>
                        <div className="px-1 flex justify-center">
                           <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                             className="text-slate-300 hover:text-rose-500 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                           </button>
                        </div>
                     </div>
                     );
                   })}
               </div>
            </div>
         </div>

         {/* Sidebar */}
         <aside className="w-[360px] flex flex-col border-r border-slate-300 bg-white p-5 gap-4 overflow-y-auto">
            {/* Customer Section — Optional */}
            <div className="flex flex-col gap-1.5">
               <label className="text-[11px] number-fmt-primary uppercase text-slate-400 tracking-wider">العميل المستهدف <span className="text-slate-300 font-normal normal-case">(اختياري)</span></label>
               {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-3 text-white">
                     <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-800"><User className="h-4 w-4" /></div>
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
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input ref={customerRef} type="text" autoFocus placeholder="ابحث عن عميل..." value={customerQuery}
                       onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerList(true); }}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: expiresAtRef, prevRef: searchRef })}
                       className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2.5 pr-10 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800"
                     />
                    {showCustomerList && filteredCustomers.length > 0 && (
                      <div className="absolute top-full right-0 z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-xl">
                         {filteredCustomers.map(c => (
                           <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); }}
                             className="flex w-full flex-col px-4 py-2 text-right hover:bg-slate-50 border-b last:border-0 border-slate-50">
                              <span className="text-2sm font-black text-slate-800">{c.name}</span>
                              <span className="text-[11px] font-bold text-slate-400">{c.phone}</span>
                           </button>
                         ))}
                         <button onClick={() => { setShowCustomerList(false); setCustomerCreateOpen(true); }}
                           className="flex w-full items-center gap-2 px-4 py-3 text-right text-sm font-black text-violet-600 hover:bg-violet-50 border-t border-slate-100">
                           <Plus className="h-4 w-4" /> إنشاء عميل جديد
                         </button>
                      </div>
                    )}
                    {showCustomerList && filteredCustomers.length === 0 && customerQuery.trim() && (
                      <div className="absolute top-full right-0 z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-xl p-3 text-center">
                        <p className="text-xs font-bold text-slate-400 mb-2">لا يوجد عميل بهذا الاسم</p>
                        <button onClick={() => { setShowCustomerList(false); setCustomerCreateOpen(true); }}
                          className="text-sm font-black text-violet-600 hover:text-violet-800">+ إنشاء عميل جديد</button>
                      </div>
                    )}
                 </div>
               )}
            </div>

            {/* Payment Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">طريقة الدفع</label>
              <p className="text-[10px] text-slate-300 font-bold">اختر طريقة الدفع المناسبة لعرض السعر</p>
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
                    multi: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", activeBg: "bg-slate-700" },
                  };
                  const c = colorMap[pt.value];
                  return (
                    <button key={pt.value} onClick={() => !isDisabled && setPaymentType(pt.value)} disabled={isDisabled}
                      title={isDisabled ? "يجب اختيار عميل مسجل أولاً" : undefined}
                      className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all duration-150 ${
                        isActive
                          ? `${c.activeBg} text-white border-transparent shadow-md`
                          : isDisabled
                            ? "border-slate-100 opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm text-slate-700 bg-white"
                      }`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isActive ? "bg-white/20" : c.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : c.text}`} />
                      </div>
                      <span className="text-[10px] font-black leading-tight">{pt.label}</span>
                      {isActive && <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-white/80" />}
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
                     className="w-full rounded border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
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
                    <span className="text-xs font-bold text-slate-600">دفعة مقدم</span>
                    <input ref={amountPaidRef} type="number" min="0" value={amountPaid}
                       onChange={e => setAmountPaid(e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: installmentDateRef, prevRef: customerRef })}
                       className="w-28 rounded border border-violet-300 bg-white px-3 py-1.5 text-center font-mono text-sm font-black text-slate-800 outline-none focus:border-violet-500"
                     />
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-600">تاريخ استحقاق القسط</span>
                     <input ref={installmentDateRef} type="date" value={installmentDueDate}
                       onChange={e => setInstallmentDueDate(e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: expiresAtRef, prevRef: amountPaidRef })}
                       className="w-36 rounded border border-violet-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-violet-500"
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
                <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
                  <div className="text-xs font-black text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> تفاصيل الدفع المتعدد
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">💰 نقدي</span>
                    <input ref={multiCashRef} type="number" min="0" step="0.01" value={multiCash}
                       onChange={e => setMultiCash(e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: multiCreditRef, prevRef: customerRef })}
                       className="w-28 rounded border border-slate-300 bg-white px-3 py-1.5 text-center font-mono text-sm font-black text-slate-800 outline-none focus:border-slate-500"
                     />
                   </div>
                   <div className="flex items-center justify-between">
                     <span className={`text-xs font-bold ${selectedCustomer?.id ? 'text-amber-700' : 'text-slate-400'}`}>📋 آجل</span>
                     <input ref={multiCreditRef} type="number" min="0" step="0.01" value={multiCredit}
                       onChange={e => setMultiCredit(e.target.value)}
                      disabled={!selectedCustomer?.id}
                      placeholder={selectedCustomer?.id ? "0.00" : "اختر عميل..."}
                      className={`w-28 rounded border px-3 py-1.5 text-center font-mono text-sm font-black outline-none focus:border-slate-500 ${selectedCustomer?.id ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    />
                  </div>
                  {(() => {
                    const entered = (Number(multiCash) || 0) + (Number(multiCredit) || 0);
                    return (
                      <div className="flex items-center justify-between rounded bg-slate-100 px-3 py-1.5 text-xs font-black">
                        <span>المجموع المُدخل</span>
                        <span className="number-fmt">{formatMoney(entered)} / {formatMoney(totals.total)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-1 gap-3">
               <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">صلاحية العرض حتى</label>
                  <div className="relative">
                     <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                     <input ref={expiresAtRef} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: notesRef, prevRef: customerRef })}
                        className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2.5 pr-10 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800" />
                  </div>
               </div>
               <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">ملاحظات العرض</label>
                   <textarea ref={notesRef} rows="2" placeholder="ملاحظات إضافية..." value={notes} onChange={(e) => setNotes(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, { nextRef: increaseRef, prevRef: expiresAtRef })}
                     className="w-full rounded-sm border border-slate-200 bg-slate-50 p-3 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800 resize-none" />
               </div>
            </div>

            {/* Totals Section */}
            <div className="mt-auto space-y-3">
               <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                  <div className="flex justify-between text-2sm font-bold text-slate-500">
                     <span>الإجمالي قبل الخصم</span>
                     <span>{formatMoney(totals.subtotal)}</span>
                  </div>
                   {/* Increase input with mode toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2sm font-bold text-slate-500">زيادة</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        const raw = increaseMode === 'pct' ? (totals.subtotal > 0 ? (increase / totals.subtotal) * 100 : 0) : increase;
                        const v = Math.max(0, raw - 1);
                        increaseMode === 'pct' ? setIncrease(totals.subtotal * v / 100) : setIncrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-xs font-black"><Minus className="h-3 w-3" /></button>
                       <input ref={increaseRef} type="number" min="0" step={increaseMode === 'pct' ? '0.1' : '0.5'}
                         value={increaseMode === 'pct' ? (totals.subtotal > 0 ? parseFloat(((increase / totals.subtotal) * 100).toFixed(2)) : 0) : increase}
                         onChange={e => {
                           const v = Math.max(0, Number(e.target.value) || 0);
                           increaseMode === 'pct' ? setIncrease(parseFloat(((v / 100) * totals.subtotal).toFixed(4))) : setIncrease(v);
                         }}
                         onKeyDown={(e) => handleKeyDown(e, { nextRef: decreaseRef, prevRef: notesRef })}
                         className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-center font-mono text-sm font-black text-slate-700 outline-none focus:border-violet-500" />
                      <button onClick={() => {
                        const raw = increaseMode === 'pct' ? (totals.subtotal > 0 ? (increase / totals.subtotal) * 100 : 0) : increase;
                        const v = raw + 1;
                        increaseMode === 'pct' ? setIncrease(totals.subtotal * v / 100) : setIncrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-xs font-black"><PlusIcon className="h-3 w-3" /></button>
                      <button type="button" onClick={() => setIncreaseMode(m => m === 'pct' ? 'flat' : 'pct')}
                        title={increaseMode === 'pct' ? 'تغيير إلى قيمة ثابتة' : 'تغيير إلى نسبة مئوية'}
                        className={`h-7 px-2 rounded text-xs font-black border transition-all ${increaseMode === 'pct' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                      >{increaseMode === 'pct' ? '%' : 'ج'}</button>
                    </div>
                  </div>

                  {/* Decrease input with mode toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2sm font-bold text-slate-500">نقصان</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        const raw = decreaseMode === 'pct' ? (totals.subtotal > 0 ? (decrease / totals.subtotal) * 100 : 0) : decrease;
                        const v = Math.max(0, raw - 1);
                        decreaseMode === 'pct' ? setDecrease(totals.subtotal * v / 100) : setDecrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-xs font-black"><Minus className="h-3 w-3" /></button>
                       <input ref={decreaseRef} type="number" min="0" step={decreaseMode === 'pct' ? '0.1' : '0.5'}
                         value={decreaseMode === 'pct' ? (totals.subtotal > 0 ? parseFloat(((decrease / totals.subtotal) * 100).toFixed(2)) : 0) : decrease}
                         onChange={e => {
                           const v = Math.max(0, Number(e.target.value) || 0);
                           decreaseMode === 'pct' ? setDecrease(parseFloat(((v / 100) * totals.subtotal).toFixed(4))) : setDecrease(v);
                         }}
                         onKeyDown={(e) => handleKeyDown(e, { nextRef: saveBtnRef, prevRef: increaseRef })}
                         className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-center font-mono text-sm font-black text-slate-700 outline-none focus:border-violet-500" />
                      <button onClick={() => {
                        const raw = decreaseMode === 'pct' ? (totals.subtotal > 0 ? (decrease / totals.subtotal) * 100 : 0) : decrease;
                        const v = raw + 1;
                        decreaseMode === 'pct' ? setDecrease(totals.subtotal * v / 100) : setDecrease(v);
                      }} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-xs font-black"><PlusIcon className="h-3 w-3" /></button>
                      <button type="button" onClick={() => setDecreaseMode(m => m === 'pct' ? 'flat' : 'pct')}
                        title={decreaseMode === 'pct' ? 'تغيير إلى قيمة ثابتة' : 'تغيير إلى نسبة مئوية'}
                        className={`h-7 px-2 rounded text-xs font-black border transition-all ${decreaseMode === 'pct' ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
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
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-black text-slate-800 uppercase tracking-tight">الصافي النهائي</span>
                     <span className="text-[24px] font-black text-slate-900">{formatMoney(totals.total)}</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                   <PermissionGate page="quotations" action="print">
                     <button onClick={handlePrint} className="flex h-11 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white text-sm font-black text-slate-700 hover:bg-slate-50">
                        <Printer className="h-4 w-4 text-slate-400" /> معاينة
                     </button>
                   </PermissionGate>
                   <PermissionGate page="quotations" action={editId ? "edit" : "add"}>
                      <button ref={saveBtnRef} onClick={handleSave} disabled={isSaving}
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: searchRef, onEnter: handleSave })}
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
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                 <Clock className="h-3 w-3" />
                 <span>اختصارات: Ctrl+S حفظ | Ctrl+P طباعة | الماسح الضوئي يعمل تلقائياً</span>
               </div>
            </div>
         </aside>
      </div>

      {/* Image Preview Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="معاينة صورة الصنف" size="md">
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

      {/* Browse Items Modal */}
      <Modal open={browseItemsOpen} onClose={() => setBrowseItemsOpen(false)} title="تصفح الأصناف" size="lg">
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
                    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-violet-300 hover:shadow-md transition-all text-center group">
                    {item.primary_image_url || item.image_url || item.image ? (
                      <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                    <span className="text-xs font-black text-slate-800 leading-tight line-clamp-2">{item.name}</span>
                    <span className="text-xs font-black text-violet-600">{formatMoney(item.sale_price)}</span>
                    <span className="text-[9px] font-bold text-slate-400">{item.code || ""}</span>
                    {item.stock_quantity > 0 && <span className="text-[9px] font-bold text-emerald-600">المخزون: {item.stock_quantity}</span>}
                  </button>
                ))}
              </div>
              {browseTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button disabled={browsePage <= 1} onClick={() => loadBrowseItems(browsePage - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-500 px-3">صفحة {browsePage} من {browseTotalPages}</span>
                  <button disabled={browsePage >= browseTotalPages} onClick={() => loadBrowseItems(browsePage + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30">
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

      {/* Confirm Leave Warning */}
      <Modal open={warnModalOpen} onClose={() => setWarnModalOpen(false)} title="تحذير: مغادرة الصفحة" size="md">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">تجاهل عرض السعر؟</h3>
              <p className="text-2sm font-bold text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في المغادرة؟ سيتم <span className="text-rose-600">إلغاء التعديلات غير المحفوظة</span> ولن يتم حفظها.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setWarnModalOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
              تراجع وإكمال العرض
            </button>
            <button onClick={() => { discardDraft(); navigate("/operations/quotations"); }} className="rounded-sm bg-rose-600 px-5 py-2 text-sm font-black text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20">
              نعم، تجاهل ومغادرة
            </button>
          </div>
        </div>
      </Modal>

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoice={previewDoc}
        settings={appSettings || {}}
        docType="quotation"
        operationLabel="عرض سعر"
      />

    </div>
  );
}
