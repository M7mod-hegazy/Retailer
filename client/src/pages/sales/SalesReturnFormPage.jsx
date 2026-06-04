import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Trash2, Plus, Minus, RotateCcw, Clock,
  CheckCircle2, AlertCircle, Lock, Pencil, Printer, X, ExternalLink,
  Package, UserPlus, Calendar, Loader2, ChevronDown, Filter,
} from "lucide-react";
import SearchDropdown from "../../components/ui/SearchDropdown";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../services/api";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import CustomerInfoModal from "../../components/modals/CustomerInfoModal";
import SalesReturnTodayModal from "../../components/sales/SalesReturnTodayModal";
import InvoicePickerTodayModal from "../../components/sales/InvoicePickerTodayModal";
import { ReturnSaveSuccess } from "../../components/returns/ReturnSaveSuccess";
import { useAppSettingsStore } from "../../stores/appSettingsStore";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG-u-nu-latn");
}

// Live indicator of how far the entered return price is from the item's catalog price.
function PriceDelta({ entered, baseline, baseLabel = "سعر البيع", className = "" }) {
  const e = Number(entered) || 0;
  const b = Number(baseline) || 0;
  if (!b || !e) return <span className={`text-[10px] font-mono text-slate-400 ${className}`}>—</span>;
  const diff = e - b;
  const pct = (diff / b) * 100;
  if (Math.abs(diff) < 0.005) return <span className={`text-[10px] font-bold text-slate-400 ${className}`}>مطابق {baseLabel}</span>;
  const up = diff > 0;
  return (
    <span className={`text-[10px] font-bold font-mono ${up ? "text-emerald-600" : "text-rose-600"} ${className}`}>
      {up ? "▲ أعلى بـ" : "▼ أقل بـ"} {formatMoney(Math.abs(diff))} ({up ? "+" : "−"}{Math.abs(pct).toFixed(1)}%)
    </span>
  );
}


const REASONS = [
  { value: "defective", label: "عيب في المنتج" },
  { value: "wrong_order", label: "خطأ في الطلب" },
  { value: "shipping_damage", label: "تلف أثناء الشحن" },
  { value: "not_as_described", label: "لا يطابق الوصف" },
  { value: "other", label: "أخرى" },
];


// ── Original Invoice Preview ──────────────────────────────────────────────────
function statusLabel(s) {
  const map = { paid: "مدفوع", partial: "جزئي", unpaid: "غير مدفوع", cancelled: "ملغي", draft: "مسودة" };
  return map[s] || s || "—";
}
function statusColor(s) {
  if (s === "paid") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "partial") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "cancelled") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}
function paymentTypeLabel(t) {
  const map = { cash: "نقداً", credit: "آجل", multi: "متعدد", bank: "بنك", future_due: "آجل مؤجل" };
  return map[t] || t || "—";
}

function OriginalInvoicePreview({ invoice }) {
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discount || 0);
  const increase = Number(invoice.increase || 0);
  const total = Number(invoice.total || 0);
  const lines = invoice.lines || [];
  return (
    <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white overflow-hidden text-[12px] shadow-[0_2px_10px_rgba(251,191,36,0.1)] relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-[0.03] pointer-events-none mix-blend-multiply" />
      {/* Header */}
      <div className="px-3 py-2.5 bg-amber-100/50 border-b border-amber-200/60 flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-white border border-amber-200 shadow-sm shrink-0">
            <Clock className="h-3 w-3 text-amber-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-amber-700/80 leading-tight">الفاتورة الأصلية</span>
            <span className="text-[11px] font-black text-amber-900 font-mono tracking-tight leading-tight">#{invoice.invoice_no || invoice.doc_no}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {invoice.payment_type && (
            <span className="text-[10px] text-amber-700 font-bold bg-white px-1.5 py-0.5 rounded-md border border-amber-200">{paymentTypeLabel(invoice.payment_type)}</span>
          )}
          {invoice.status && (
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black ${statusColor(invoice.status)}`}>{statusLabel(invoice.status)}</span>
          )}
        </div>
      </div>
      {/* Line items — name + sku + qty × price */}
      {lines.length > 0 && (
        <div className="border-b border-amber-200/50 px-3 py-2 flex flex-col gap-1 relative z-10">
          <span className="text-[9px] font-bold text-amber-700/70 uppercase tracking-widest mb-0.5">الأصناف ({lines.length})</span>
          {lines.map((l, i) => {
            const qty = Number(l.quantity || 0);
            const price = Number(l.unit_price || 0);
            const code = l.item_code || l.code || l.barcode;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-[10px] leading-tight">
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-700 truncate">{l.item_name_ar || l.item_name || l.name || `#${l.item_id}`}</span>
                  {code && <span className="font-mono text-[8px] text-slate-400 leading-none">{code}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0 font-mono text-slate-500">
                  <span className="font-black text-slate-700">{qty}</span>
                  <span className="text-slate-300">×</span>
                  <span>{formatMoney(price)}</span>
                  <span className="text-slate-300">=</span>
                  <span className="font-black text-slate-700">{formatMoney(l.line_total || qty * price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Financials */}
      <div className="px-4 py-3 flex flex-col gap-2 relative z-10">
        <div className="flex justify-between items-center text-slate-600 text-[11px]">
          <span>المجموع الفرعي</span>
          <span className="font-bold">{formatMoney(subtotal)} <span className="font-sans text-[9px]">ج.م</span></span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center text-rose-600 text-[11px]">
            <span>الخصم</span>
            <span className="font-bold">− {formatMoney(discount)} <span className="font-sans text-[9px]">ج.م</span></span>
          </div>
        )}
        {increase > 0 && (
          <div className="flex justify-between items-center text-emerald-600 text-[11px]">
            <span>الزيادة</span>
            <span className="font-bold">+ {formatMoney(increase)} <span className="font-sans text-[9px]">ج.م</span></span>
          </div>
        )}
        <div className="flex justify-between items-center border-t border-amber-200/50 pt-2 mt-1 text-slate-900 font-black text-[13px]">
          <span>الإجمالي</span>
          <span>{formatMoney(total)} <span className="text-slate-500 font-sans text-[10px]">ج.م</span></span>
        </div>
      </div>
      {/* Payments */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="border-t border-amber-200/50 px-4 py-3 flex flex-col gap-2 bg-amber-50/50 relative z-10">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">وسائل الدفع</span>
          {invoice.payments.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-300"/>{p.method_name || p.method}</span>
              <span className="font-bold text-slate-900">{formatMoney(p.amount)} <span className="text-slate-500 font-sans text-[9px]">ج.م</span></span>
            </div>
          ))}
        </div>
      )}
      {/* Footer stamp */}
      <div className="border-t border-amber-200/80 px-3 py-2 bg-amber-100 flex items-center justify-center relative z-10">
        <span className="text-[9px] font-black tracking-widest text-amber-700 uppercase flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> للمعاينة فقط · غير قابل للتعديل
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SalesReturnFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editReturnId = location.state?.edit_return_id || null;
  const isEditMode = !!editReturnId;

  const [mode, setMode] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const [cart, setCart] = useState([]);

  const [invoiceLines, setInvoiceLines] = useState([]);
  const [loadedInvoice, setLoadedInvoice] = useState(null);

  const [customer, setCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerLockedFromInvoice, setCustomerLockedFromInvoice] = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(null);
  const [ajalDebt, setAjalDebt] = useState(0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);

  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [reason, setReason] = useState("other");
  const [reasonOther, setReasonOther] = useState("");

  // Header-level خصم/زيادة on the return document (mirrors invoice discount/increase).
  // For from-invoice returns these are pro-rated from the original invoice until the user edits them.
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [headerIncrease, setHeaderIncrease] = useState(0);
  const [adjustmentTouched, setAdjustmentTouched] = useState(false);
  const [supervisorOverride, setSupervisorOverride] = useState(false);

  const [editActivation, setEditActivation] = useState(null);
  const [rawEditData, setRawEditData] = useState(null);

  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [stagingItem, setStagingItem] = useState(null);
  const [stagingQty, setStagingQty] = useState("1");
  const [stagingPrice, setStagingPrice] = useState("");
  const [stagingPurchasePrice, setStagingPurchasePrice] = useState("");
  const [stagingWarehouseId, setStagingWarehouseId] = useState("");
  const [stagingUnitId, setStagingUnitId] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});

  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  const [pendingBelowCostAdd, setPendingBelowCostAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showEditWarnModal, setShowEditWarnModal] = useState(false);
  const [showSwitchInvoiceWarning, setShowSwitchInvoiceWarning] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todayReturnsOpen, setTodayReturnsOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  const itemInputRef = useRef(null);
  const stagingWHRef = useRef(null);
  const stagingUnitRef = useRef(null);
  const stagingQtyRef = useRef(null);
  const stagingPriceRef = useRef(null);
  const addBtnRef = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);

  // isDirty must be after all state declarations to avoid TDZ on `customer`
  const isDirty = isEditMode ? !isLocked : (cart.length > 0 || !!customer);

  const customerResults = useMemo(() => {
    if (!customerLookupOpen) return [];
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customers.filter(c => String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").includes(q))
      : customers.slice(0, 8);
    return list.slice(0, 8).map(c => ({
      ...c,
      sub_label: c.phone || "",
      price_label: "",
    }));
  }, [customerLookupOpen, customerQuery, customers]);
  const { blocker } = useUnsavedChangesGuard(isDirty);

  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("sales_return", editActivation);

  const subtotal = useMemo(() => {
    if (mode === "direct") return cart.reduce((acc, l) => acc + l.unit_price * l.quantity, 0);
    if (mode === "invoice") return invoiceLines.filter(l => l.checked).reduce((acc, l) => acc + l.unit_price * l.qty_to_return, 0);
    return 0;
  }, [mode, cart, invoiceLines]);

  // Net refundable = lines subtotal − خصم + زيادة (mirrors invoice total). Everything
  // downstream (refund, balance, treasury, payload) derives from this `total`.
  const total = useMemo(
    () => Math.max(0, subtotal - (Number(headerDiscount) || 0) + (Number(headerIncrease) || 0)),
    [subtotal, headerDiscount, headerIncrease],
  );

  const maxDiscountPercent = useAppSettingsStore(s => Number(s.settings?.max_discount_percent ?? 15));
  const discountCapEnabled = useAppSettingsStore(s => Number(s.settings?.discount_cap_enabled ?? 1) !== 0);
  const discountExceedsCap = discountCapEnabled && (Number(headerDiscount) || 0) > subtotal * (maxDiscountPercent / 100);

  const returnCreditEffect = useMemo(() => {
    if (!total) return 0;
    if (refundMethod === "store_credit") return total;
    if (refundMethod === "split") return Math.max(0, total - (Number(splitCashAmount) || 0));
    return 0;
  }, [refundMethod, total, splitCashAmount]);

  // In edit mode, the DB balance already has the ORIGINAL return's credit effect applied.
  // We compute the NET change so we never double-count.
  const originalCreditEffect = useMemo(() => {
    if (!isEditMode || !rawEditData) return 0;
    const origTotal = Number(rawEditData.total || 0);
    const origMethod = rawEditData.refund_method || "cash_back";
    if (origMethod === "store_credit") return origTotal;
    if (origMethod === "split") return Math.max(0, origTotal - Number(rawEditData.cash_amount || 0));
    return 0;
  }, [isEditMode, rawEditData]);

  // NET credit adjustment = what changes in the balance after saving this edit.
  // In create mode: netCreditAdjustment = returnCreditEffect (originalCreditEffect is 0)
  // In edit mode:   netCreditAdjustment = new - old (0 if same, positive if more credit, negative if less)
  const netCreditAdjustment = returnCreditEffect - originalCreditEffect;

  // Predicted balance = current DB balance minus the net change
  const predictedBalance = customerBalance !== null ? customerBalance - netCreditAdjustment : null;

  const hasCustomerBalance = customerBalance !== null && customerBalance > 0;

  useEffect(() => {
    api.get("/api/warehouses").then(r => {
      const wh = r.data.data || [];
      setWarehouses(wh);
      if (wh.length) setStagingWarehouseId(String(wh[0].id));
    }).catch(() => {});
    api.get("/api/units").then(r => {
      const u = r.data.data || [];
      setUnits(u);
      if (u.length) setStagingUnitId(String(u[0].id));
    }).catch(() => {});
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
    api.get("/api/stock/levels").then(r => {
      const grouped = {};
      (r.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = {};
        grouped[row.item_id][row.warehouse_id] = row.quantity;
      });
      setStockLevels(grouped);
    }).catch(() => {});
  }, []);

  // Effect 1: fetch edit data — sets non-cart fields only
  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
      const sr = r.data.data;
      setRawEditData(sr);
      setEditActivation({ docNo: sr.doc_no || "", createdAt: sr.created_at || new Date().toISOString() });
      setRefundMethod(sr.refund_method || "cash_back");
      if (sr.refund_method === "split") setSplitCashAmount(String(sr.cash_amount || ""));
      setReason(sr.reason || "other");
      setHeaderDiscount(Number(sr.discount || 0));
      setHeaderIncrease(Number(sr.increase || 0));
      setAdjustmentTouched(true); // saved values — do not auto-recompute over the user's data
      if (sr.customer_id) { const name = sr.customer_name || String(sr.customer_id); setCustomer({ id: sr.customer_id, name }); setCustomerQuery(name); }
      setMode(sr.invoice_id ? "invoice" : "direct");
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  // Pro-rate the original invoice's خصم/زيادة onto the return by returned-value fraction,
  // recomputing as the returned quantities change — until the user manually edits the field.
  useEffect(() => {
    if (mode !== "invoice" || !loadedInvoice || adjustmentTouched) return;
    const invSub = Number(loadedInvoice.subtotal || 0);
    const invDisc = Number(loadedInvoice.discount || 0);
    const invInc = Number(loadedInvoice.increase || 0);
    if (invSub <= 0 || (invDisc === 0 && invInc === 0)) { setHeaderDiscount(0); setHeaderIncrease(0); return; }
    const ratio = Math.min(1, subtotal / invSub);
    setHeaderDiscount(Math.round(invDisc * ratio * 100) / 100);
    setHeaderIncrease(Math.round(invInc * ratio * 100) / 100);
  }, [mode, loadedInvoice, subtotal, adjustmentTouched]);

  // Effect 2: resolve warehouse/unit names once reference lists are loaded
  useEffect(() => {
    if (!rawEditData || !warehouses.length || !units.length) return;
    const sr = rawEditData;

    if (sr.invoice_id) {
      api.get(`/api/invoices/${sr.invoice_id}`).then(inv => {
        const invData = inv.data.data;
        setLoadedInvoice(invData);
        const returnedIds = new Set((sr.lines || []).map(l => l.invoice_line_id));
        setInvoiceLines((invData.lines || []).map(l => {
          const returnLine = (sr.lines || []).find(rl => rl.invoice_line_id === l.id);
          const alreadyReturned = Number(l.returned_quantity || 0);
          return {
            invoice_line_id: l.id,
            item_id: l.item_id,
            item_code: l.item_code || l.barcode || "",
            item_name: l.item_name_ar || l.item_name || l.name,
            unit_price: Number(l.unit_price || 0),
            purchase_price: Number(l.purchase_price || 0),
            original_qty: Number(l.quantity),
            already_returned: alreadyReturned,
            qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
            checked: !!returnLine,
          };
        }).filter(l => l.original_qty - l.already_returned > 0 || returnedIds.has(l.invoice_line_id)));
      }).catch(() => {});
    } else {
      setCart((sr.lines || []).map((l, idx) => ({
        key: `edit-${l.id || idx}`,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name || l.name,
        item_code: l.item_code || "",
        unit_price: Number(l.unit_price || 0),
        purchase_price: Number(l.purchase_price || 0),
        quantity: Number(l.quantity),
        warehouse_id: l.warehouse_id || "",
        warehouse_name: warehouses.find(w => String(w.id) === String(l.warehouse_id))?.name || "—",
        original_warehouse_id: l.warehouse_id || "",
        unit_id: String(l.unit_id || ""),
        unit_name: units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية",
      })));
    }
  }, [rawEditData, warehouses, units]);

  useEffect(() => {
    if (!customer?.id) { setCustomerBalance(null); setAjalDebt(0); return; }
    api.get(`/api/customers/${customer.id}`).then(r => setCustomerBalance(Number(r.data.data?.opening_balance || 0))).catch(() => {});
    api.get(`/api/ajal-debts?customer_id=${customer.id}&status=pending`).then(r => {
      setAjalDebt((r.data.data || []).reduce((s, d) => s + Number(d.remaining_amount || 0), 0));
    }).catch(() => {});
  }, [customer?.id]);

  const ITEM_PAGE = 20;
  useEffect(() => {
    pendingPickRef.current = false;
    if (!itemQuery.trim() || stagingItem) { setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); itemSearchActiveRef.current = false; return; }
    itemSearchActiveRef.current = true;
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(itemQuery)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
          const rows = r.data.data || [];
          setItemResults(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
          setLookupOpen(true);
          setActiveIndex(-1);
          if (pendingPickRef.current && rows.length > 0) {
            pendingPickRef.current = false;
            selectItemForStaging(rows[0]);
          } else {
            pendingPickRef.current = false;
          }
        })
        .catch(() => { pendingPickRef.current = false; })
        .finally(() => { itemSearchActiveRef.current = false; });
    }, 250);
    return () => { clearTimeout(t); itemSearchActiveRef.current = false; };
  }, [itemQuery, stagingItem]);

  function loadMoreItems() {
    if (!itemHasMore || !itemQuery.trim() || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get(`/api/items?search=${encodeURIComponent(itemQuery)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = r.data.data || [];
        setItemResults(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMoreItems(false));
  }

  useEffect(() => {
    if (!customer) setRefundMethod(prev => prev === "store_credit" ? "cash_back" : prev);
  }, [customer]);

  function handleFieldKeyDown(e, nextRef, prevRef, isEnterSubmit = false) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isEnterSubmit) addStagingToCart();
      else nextRef?.current?.focus();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  }

  function selectItemForStaging(item) {
    setStagingItem(item);
    setStagingPrice(String(item.sale_price || "0"));
    setStagingPurchasePrice(String(item.purchase_price || item.unit_cost || "0"));
    setStagingQty("1");
    if (item.unit_id) {
      setStagingUnitId(String(item.unit_id));
    } else if (units.length > 0) {
      setStagingUnitId(String(units[0].id));
    } else {
      setStagingUnitId("");
    }
    const code = item.code || item.item_code;
    const displayName = item.name_ar || item.name;
    setItemQuery(code ? `${code} - ${displayName}` : displayName);
    setItemResults([]);
    setLookupOpen(false);
    setActiveIndex(-1);
    setTimeout(() => stagingWHRef.current?.focus(), 30);
  }

  function addStagingToCart() {
    if (!stagingItem) return;
    const qty = Math.max(0, Number(stagingQty) || 0);
    const price = Math.max(0, Number(stagingPrice) || 0);
    if (!qty) return;
    const purchasePrice = Number(stagingPurchasePrice || 0);
    if (purchasePrice > 0 && price > 0 && price < purchasePrice) {
      if (!pendingBelowCostAdd) {
        setPendingBelowCostAdd(true);
        setMessage({ text: `تحذير: السعر (${formatMoney(price)}) أقل من سعر الشراء (${formatMoney(purchasePrice)}). اضغط إضافة مرة أخرى للتأكيد.`, type: "warning" });
        setTimeout(() => { setMessage({ text: "", type: "" }); setPendingBelowCostAdd(false); }, 4000);
        return;
      }
      setPendingBelowCostAdd(false);
    } else {
      setPendingBelowCostAdd(false);
    }
    if (!invoiceIsActive) activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(stagingUnitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const finalQty = allowDecimal ? qty : Math.max(1, Math.round(qty));
    setCart(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === stagingItem.id && l.key?.startsWith("direct-"));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + finalQty : Math.round(l.quantity) + finalQty,
          unit_price: price || l.unit_price,
        });
      }
      return [...prev, {
        key: `direct-${stagingItem.id}-${Date.now()}`,
        item_id: stagingItem.id,
        item_name: stagingItem.name_ar || stagingItem.name,
        item_code: stagingItem.code || stagingItem.item_code || "",
        unit_price: price,
        purchase_price: purchasePrice,
        sale_price: Number(stagingItem.sale_price || 0),
        quantity: finalQty,
        warehouse_id: stagingWarehouseId,
        warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
        original_warehouse_id: stagingWarehouseId,
        unit_id: stagingUnitId,
        unit_name: selectedUnit?.name || "أساسية",
      }];
    });
    setStagingItem(null); setStagingQty("1"); setStagingPrice(""); setStagingPurchasePrice("");
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); setActiveIndex(-1);
    setTimeout(() => itemInputRef.current?.focus(), 30);
  }

  function removeCartLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }
  function updateCartQty(key, delta) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, l.quantity + delta) }).filter(l => l.quantity > 0));
  }
  function updateCartPrice(key, val) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, unit_price: Math.max(0, Number(val) || 0) }));
  }
  function updateCartWarehouse(key, warehouseId) {
    setCart(prev => prev.map(l => l.key !== key ? l : {
      ...l,
      warehouse_id: warehouseId,
      warehouse_name: warehouses.find(w => String(w.id) === String(warehouseId))?.name || "",
    }));
  }

  function selectMode(m) {
    if (m === "invoice") { setMode(m); setInvoicePickerOpen(true); }
    else { setMode(m); activateInvoice(); }
  }

  function resetToIdle() {
    setMode(null); setCart([]); setInvoiceLines([]); setLoadedInvoice(null);
    setCustomer(null); setCustomerLockedFromInvoice(false); setReason("other"); setReasonOther("");
    setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setStagingItem(null); setStagingQty("1");
    setStagingPrice(""); setStagingPurchasePrice(""); setInvoicePickerOpen(false); resetActivation();
    setHeaderDiscount(0); setHeaderIncrease(0); setAdjustmentTouched(false); setSupervisorOverride(false);
  }

  function handleBack() {
    if (mode === null || isEditMode) { navigate("/sales/returns"); return; }
    setShowWarningModal(true);
  }

  function loadInvoice(inv) {
    setLoadedInvoice(inv);
    setInvoiceLines((inv.lines || []).map(l => ({
      invoice_line_id: l.id,
      item_id: l.item_id,
      item_code: l.item_code || l.barcode || "",
      item_name: l.item_name_ar || l.item_name || l.name,
      unit_price: Number(l.unit_price || 0),
      purchase_price: Number(l.purchase_price || 0),
      original_qty: Number(l.quantity),
      already_returned: Number(l.returned_quantity || 0),
      qty_to_return: 0,
      checked: false,
    })).filter(l => l.original_qty - l.already_returned > 0));
    if (inv.customer_id) {
      const name = inv.customer_name || String(inv.customer_id);
      setCustomer({ id: inv.customer_id, name });
      setCustomerQuery(name);
      setCustomerLockedFromInvoice(true);
    }
  }

  function handleDetailConfirm(inv) {
    loadInvoice(inv); setInvoicePickerOpen(false); activateInvoice();
  }

  function toggleInvoiceLine(invoice_line_id) {
    setInvoiceLines(prev => prev.map(l => {
      if (l.invoice_line_id !== invoice_line_id) return l;
      const checked = !l.checked;
      return { ...l, checked, qty_to_return: checked ? Math.max(0, l.original_qty - l.already_returned) : 0 };
    }));
  }

  function setInvoiceLineQty(invoice_line_id, val) {
    setInvoiceLines(prev => prev.map(l => {
      if (l.invoice_line_id !== invoice_line_id) return l;
      const max = l.original_qty - l.already_returned;
      return { ...l, qty_to_return: Math.max(0, Math.min(max, Number(val) || 0)) };
    }));
  }

  function handleTodayInvoicesClick() {
    if (mode === "invoice" && loadedInvoice) setShowSwitchInvoiceWarning(true);
    else setInvoicePickerOpen(true);
  }

  async function handleSave() {
    const lines = mode === "direct"
      ? cart.map(l => ({ item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price, warehouse_id: l.warehouse_id || null, unit_id: l.unit_id || null, invoice_line_id: null }))
      : invoiceLines.filter(l => l.checked && l.qty_to_return > 0).map(l => ({ invoice_line_id: l.invoice_line_id, item_id: l.item_id, quantity: l.qty_to_return, unit_price: l.unit_price }));
    if (!lines.length) { setMessage({ text: "أضف أصناف للمرتجع أولاً", type: "error" }); return; }
    if (discountExceedsCap && !supervisorOverride) {
      setMessage({ text: `الخصم يتجاوز ${maxDiscountPercent}% — فعّل موافقة المشرف للمتابعة`, type: "error" });
      return;
    }
    const payload = {
      doc_no: docNo || undefined, customer_id: customer?.id || null,
      refund_method: refundMethod, treasury_id: null,
      cash_amount: refundMethod === "split" ? Math.max(0, Number(splitCashAmount) || 0) : undefined,
      reason: reason === "other" ? (reasonOther || "other") : reason, lines,
      discount: Number(headerDiscount) || 0,
      increase: Number(headerIncrease) || 0,
      supervisor_override: supervisorOverride,
    };
    setIsSaving(true); setMessage({ text: "", type: "" });
    try {
      const savedDocNo = docNo;
      const successData = {
        docNo: savedDocNo,
        total,
        discount: Number(headerDiscount) || 0,
        increase: Number(headerIncrease) || 0,
        refundMethod,
        cashAmount: refundMethod === 'split' ? Math.max(0, Number(splitCashAmount) || 0) : null,
        creditAmount: returnCreditEffect,
        entityName: customer?.name,
        entityNewBalance: predictedBalance,
        type: 'sales_return',
      };
      if (isEditMode) {
        await api.put(`/api/invoices/returns/${editReturnId}`, payload);
        setIsLocked(true);
        setSaveSuccess(successData);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      } else if (mode === "invoice" && loadedInvoice) {
        const res = await api.post(`/api/invoices/${loadedInvoice.id}/return`, payload);
        setSaveSuccess({ ...successData, returnId: res.data.data?.id });
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
        setCart([]); setCustomer(null);
      } else {
        const res = await api.post("/api/invoices/general-return", payload);
        setSaveSuccess({ ...successData, returnId: res.data.data?.id });
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
        setCart([]); setCustomer(null);
      }
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  function handleSuccessDismiss() {
    const id = saveSuccess?.returnId;
    setSaveSuccess(null);
    if (!isEditMode) navigate("/sales/returns", { replace: true });
  }

  async function handleDelete() {
    if (!editReturnId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/invoices/returns/${editReturnId}`);
      navigate("/sales/returns", { replace: true });
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل حذف المرتجع", type: "error" });
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  }

  // ══ IDLE SCREEN ══
  if (mode === null && !isEditMode) {
    return (
      <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden relative">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

        <div className="flex items-center px-6 pt-5 pb-2 relative z-10">
          <button onClick={() => navigate("/sales/returns")}
            className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white border border-slate-200/60 shadow-sm text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-12 px-4 relative z-10 pb-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-100 text-emerald-700 shadow-xl shadow-emerald-600/10">
              <RotateCcw className="h-10 w-10" />
            </div>
            <h1 className="text-[32px] font-black text-slate-900 tracking-tight">إنشاء مرتجع مبيعات</h1>
            <p className="text-[15px] font-bold text-slate-500 max-w-[40ch] leading-relaxed">
              قم بتحديد الطريقة المناسبة لاستلام المرتجعات من العملاء لضمان تحديث المخزون بدقة.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
            <button onClick={() => selectMode("direct")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-white border border-slate-200/60 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-2xl hover:border-emerald-300 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="bg-slate-50 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-110 transition-all duration-500 mb-8 border border-slate-100">
                <RotateCcw className="h-8 w-8 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-slate-900 mb-2">مرتجع مباشر (حر)</span>
                <span className="text-[14px] font-bold text-slate-500 leading-relaxed">إضافة الأصناف يدوياً وتحديد الكميات والأسعار بدون الارتباط بفاتورة مبيعات مسبقة.</span>
              </div>
            </button>

            <button data-help="invoice-select" onClick={() => selectMode("invoice")}
              className="group relative flex-1 flex flex-col justify-between rounded-[2.5rem] bg-emerald-600 border-b-4 border-emerald-800 p-8 overflow-hidden transition-all duration-300 hover:-translate-y-2 shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 hover:shadow-emerald-600/40 text-right">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
              <div className="bg-white/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-all duration-500 mb-8 backdrop-blur-sm">
                <Search className="h-8 w-8 text-white" />
              </div>
              <div className="relative z-10 flex flex-col">
                <span className="text-[22px] font-black text-white mb-2">من فاتورة سابقة</span>
                <span className="text-[14px] font-bold text-emerald-100 leading-relaxed">البحث برقم الفاتورة وتحديد الكميات المرتجعة منها بدقة لضمان التسعير والخصومات الصحيحة.</span>
              </div>
            </button>
          </div>
          {message.text && (
            <div className={`flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-black ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {message.text}
            </div>
          )}
        </div>
        <InvoicePickerTodayModal open={invoicePickerOpen} onClose={() => { setInvoicePickerOpen(false); setMode(null); }} onSelectInvoice={handleDetailConfirm} customers={customers} />
        <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); }} />
      </div>
    );
  }

  // ══ ACTIVE SCREEN ══
  return (
    <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden animate-fade-in relative">
      <DocumentHeaderBar
        accent="emerald"
        className="shadow-sm"
        onBack={handleBack}
        title={isEditMode ? "تعديل مرتجع مبيعات" : mode === "invoice" && loadedInvoice ? `مرتجع فاتورة #${loadedInvoice.invoice_no || loadedInvoice.doc_no}` : "مرتجع مبيعات جديد"}
        subtitle={isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : mode === "direct" ? "مرتجع مباشر" : "مرتجع من فاتورة"}
        extras={
          <>
            {isLocked && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <Lock className="h-3 w-3" /> محفوظة
              </div>
            )}
            {mode && (
              <div className="flex gap-1.5">
                <input readOnly value={invoiceIsActive ? (docNo || "") : "—"} className="h-7 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
                <input readOnly value={invoiceIsActive && invoiceCreatedAt ? new Date(invoiceCreatedAt).toLocaleString("en-US") : "—"} className="h-7 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
              </div>
            )}
            {mode === "invoice" && loadedInvoice && (
              <Link to={`/sales/returns?invoice_id=${loadedInvoice.id}`} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline shrink-0">
                <ExternalLink className="h-3.5 w-3.5" /> عرض كل مرتجعات هذه الفاتورة
              </Link>
            )}
          </>
        }
        actions={
          <>
            {message.text && (
              <div className={`flex items-center gap-1.5 rounded-sm px-3 py-1 text-[12px] font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {message.text}
              </div>
            )}
            <DocumentActionButton variant="today" icon={Calendar} onClick={() => setTodayReturnsOpen(true)}>
              سجل المرتجعات
            </DocumentActionButton>
            <PermissionGate page="sales_returns" action="print">
              <DocumentActionButton variant="print" icon={Printer} onClick={() => setPrintPreview(true)} disabled={!total}>
                طباعة
              </DocumentActionButton>
            </PermissionGate>
            {isEditMode && isLocked && (
              <PermissionGate page="sales_returns" action="edit">
                <DocumentActionButton variant="edit" icon={Pencil} onClick={() => setShowEditWarnModal(true)}>
                  تعديل
                </DocumentActionButton>
              </PermissionGate>
            )}
            {isEditMode && !isLocked && (
              <PermissionGate page="sales_returns" action="delete">
                <DocumentActionButton variant="delete" icon={Trash2} onClick={() => setShowDeleteModal(true)}>
                  حذف
                </DocumentActionButton>
              </PermissionGate>
            )}
            {!isEditMode && (
              <DocumentActionButton variant="today" icon={RotateCcw} onClick={() => setShowWarningModal(true)}>
                مرتجع جديد
              </DocumentActionButton>
            )}
            {mode && !isLocked && (
              <PermissionGate page="sales_returns" action={isEditMode ? "edit" : "add"}>
                <DocumentActionButton
                  variant="primary"
                  identity="emerald"
                  onClick={() => setShowSaveConfirmModal(true)}
                  disabled={isSaving || !total}
                  loading={isSaving}
                >
                  {isSaving ? "جاري الحفظ..." : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                </DocumentActionButton>
              </PermissionGate>
            )}
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="flex w-[340px] lg:w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto">
          <div className="flex flex-col gap-5 p-5">
            <button onClick={handleTodayInvoicesClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-[13px] font-bold text-white hover:bg-slate-800 transition-all shadow-sm active:scale-[0.98]">
              <Clock className="h-4 w-4" /> فواتير المبيعات
            </button>

            {/* Customer */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">العميل</label>
                {!isLocked && !customerLockedFromInvoice && (
                  <button onClick={() => setCustomerCreateOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
                    <UserPlus className="h-3 w-3" /> عميل جديد
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={customerQuery}
                  placeholder={customer?.id ? customer.name : "ابحث عن عميل..."}
                  onChange={e => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); if (!e.target.value) setCustomer(null); }}
                  onFocus={() => { if (!customer?.id) setCustomerQuery(""); setCustomerLookupOpen(true); }}
                  onBlur={() => { setTimeout(() => { setCustomerLookupOpen(false); if (!customer?.id) setCustomerQuery(""); }, 200); }}
                  disabled={isLocked || customerLockedFromInvoice}
                  className={`w-full h-10 rounded-xl border px-3 text-[13px] font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400 ${hasCustomerBalance ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100" : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"}`}
                />
                {customerLookupOpen && !isLocked && !customerLockedFromInvoice && (
                  <SearchDropdown
                    items={customerResults}
                    onPick={c => { setCustomer({ id: c.id, name: c.name }); setCustomerQuery(c.name); setCustomerLookupOpen(false); }}
                    query={customerQuery}
                    emptyLabel="لم يتم العثور على عميل"
                  />
                )}
              </div>
              {customerLockedFromInvoice && !isLocked && <p className="text-[10px] text-slate-400 font-medium">العميل محدد من الفاتورة الأصلية</p>}
              {customer?.id && (
                <button onClick={() => setCustomerInfoOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors">
                  <ExternalLink className="h-3 w-3" /> بيانات العميل
                </button>
              )}
              {customer?.id && customerBalance !== null && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${customerBalance > 0 ? "text-amber-700 bg-amber-100/50 border-amber-200" : "text-slate-600 bg-slate-100/50 border-slate-200"}`}>
                    الرصيد: {formatMoney(customerBalance)}
                  </div>
                  {netCreditAdjustment !== 0 && total > 0 && (
                    <>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${netCreditAdjustment > 0 ? "text-emerald-700 bg-emerald-100/50 border-emerald-200" : "text-rose-700 bg-rose-100/50 border-rose-200"}`}>
                        {netCreditAdjustment > 0 ? `خصم: −${formatMoney(netCreditAdjustment)}` : `إضافة: +${formatMoney(Math.abs(netCreditAdjustment))}`}
                      </div>
                      <div className={`text-[11px] font-black px-2 py-1 rounded-sm border ${predictedBalance > 0 ? "text-rose-700 bg-rose-100/50 border-rose-200" : "text-emerald-700 bg-emerald-100/50 border-emerald-200"}`}>
                        بعد المرتجع: {formatMoney(predictedBalance)}
                      </div>
                    </>
                  )}
                  {netCreditAdjustment === 0 && returnCreditEffect > 0 && total > 0 && (
                    <div className="text-[11px] font-black text-slate-500 bg-slate-100/50 border border-slate-200 px-2 py-1 rounded-sm">
                      لا تغيير في الرصيد
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer balance */}
            {customer && customerBalance !== null && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-slate-200" />
                <div className="flex justify-between items-center text-[12px]">
                  <span className="font-bold text-slate-500">الرصيد الحالي</span>
                  <span className={`font-black font-mono ${customerBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(customerBalance)} ج.م</span>
                </div>
                {total > 0 && netCreditAdjustment !== 0 && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600">
                        {netCreditAdjustment > 0 ? "الخصم من الرصيد" : "إضافة للرصيد"}
                      </span>
                      <span className={`text-[13px] font-black font-mono ${netCreditAdjustment > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {netCreditAdjustment > 0 ? "−" : "+"}{formatMoney(Math.abs(netCreditAdjustment))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200/60 pt-1.5">
                      <span className="text-[11px] font-bold text-slate-600">الرصيد بعد الحفظ</span>
                      <span className={`text-[13px] font-black font-mono ${predictedBalance > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {formatMoney(predictedBalance)}
                      </span>
                    </div>
                  </div>
                )}
                {total > 0 && netCreditAdjustment === 0 && returnCreditEffect > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-500 text-center">
                    لا تغيير في الرصيد — نفس التأثير كما كان مسجلاً
                  </div>
                )}
                {ajalDebt > 0 && (
                  <div className="flex justify-between items-center text-[11px] pt-2 mt-1 border-t border-slate-100 border-dashed">
                    <span className="font-bold text-amber-600">ديون آجل معلقة</span>
                    <span className="font-black font-mono text-amber-700">{formatMoney(ajalDebt)} ج.م</span>
                  </div>
                )}
                <Link to={`/definitions/customers/${customer.id}`} className="flex items-center justify-center gap-1 mt-2 py-1.5 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">
                  <ExternalLink className="h-3 w-3" /> عرض سجل العميل الكامل
                </Link>
              </div>
            )}

            <div className="w-full h-px bg-slate-100" />

            {/* Original-invoice خصم/زيادة preview (read-only) + this return's pro-rated share */}
            {mode === "invoice" && loadedInvoice && (Number(loadedInvoice.discount) > 0 || Number(loadedInvoice.increase) > 0) && (() => {
              const invSub = Number(loadedInvoice.subtotal || 0);
              const pct = invSub > 0 ? Math.min(100, (subtotal / invSub) * 100) : 0;
              return (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> تعديلات الفاتورة الأصلية #{loadedInvoice.invoice_no || loadedInvoice.doc_no}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-bold text-slate-500">خصم الفاتورة الكامل</label>
                      <input readOnly value={formatMoney(loadedInvoice.discount || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center text-[12px] font-black font-mono text-rose-600 cursor-not-allowed" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-bold text-slate-500">زيادة الفاتورة الكاملة</label>
                      <input readOnly value={formatMoney(loadedInvoice.increase || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center text-[12px] font-black font-mono text-emerald-600 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/70 border border-amber-200/70 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 leading-relaxed">
                    {subtotal > 0 ? (
                      <>هذا المرتجع = <span className="font-black text-amber-700">{pct.toFixed(1)}%</span> من الفاتورة، فيُطبَّق نصيبه:
                        {Number(headerDiscount) > 0 && <span className="text-rose-600 font-black"> خصم −{formatMoney(headerDiscount)}</span>}
                        {Number(headerIncrease) > 0 && <span className="text-emerald-600 font-black"> زيادة +{formatMoney(headerIncrease)}</span>}
                        {Number(headerDiscount) === 0 && Number(headerIncrease) === 0 && <span> لا شيء</span>}
                        {adjustmentTouched && <span className="text-slate-400"> (معدّل يدوياً)</span>}
                      </>
                    ) : (
                      <>اختر أصنافاً للإرجاع ليُحتسب نصيب هذا المرتجع من خصم/زيادة الفاتورة.</>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Return total breakdown — subtotal − خصم + زيادة = صافي */}
            {subtotal > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-600">إجمالي الأصناف</span>
                  <span className="text-[13px] font-black text-slate-700 font-mono">{formatMoney(subtotal)} ج.م</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[12px] font-bold text-rose-600 shrink-0">خصم على المرتجع</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="any" value={headerDiscount || ""}
                      disabled={isLocked}
                      onChange={e => { setAdjustmentTouched(true); setHeaderDiscount(Math.max(0, Number(e.target.value) || 0)); }}
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      className={`w-24 rounded-lg border px-2 py-1 text-center text-[13px] font-black font-mono outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${discountExceedsCap ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-200" : "border-rose-200 bg-white text-rose-700 focus:border-rose-400 focus:ring-rose-100"}`}
                    />
                    <span className="text-[10px] text-slate-400 shrink-0">ج.م</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[12px] font-bold text-emerald-700 shrink-0">زيادة على المرتجع</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="any" value={headerIncrease || ""}
                      disabled={isLocked}
                      onChange={e => { setAdjustmentTouched(true); setHeaderIncrease(Math.max(0, Number(e.target.value) || 0)); }}
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      className="w-24 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-center text-[13px] font-black font-mono text-emerald-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    />
                    <span className="text-[10px] text-slate-400 shrink-0">ج.م</span>
                  </div>
                </div>
                {mode === "invoice" && (headerDiscount > 0 || headerIncrease > 0) && (
                  <div className="text-[10px] font-bold text-slate-400 -mt-1">
                    {adjustmentTouched ? "معدّل يدوياً" : "محسوب تلقائياً من الفاتورة الأصلية"}
                  </div>
                )}
                {discountExceedsCap && !isLocked && (
                  <label className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-2 py-1.5 text-[11px] font-bold text-amber-800 cursor-pointer">
                    <input type="checkbox" checked={supervisorOverride} onChange={e => setSupervisorOverride(e.target.checked)} className="accent-amber-600" />
                    الخصم يتجاوز {maxDiscountPercent}% — موافقة المشرف
                  </label>
                )}
                <div className="flex items-center justify-between border-t border-emerald-200/60 pt-2 mt-0.5">
                  <span className="text-[12px] font-black text-emerald-700">صافي المرتجع</span>
                  <span className="text-[16px] font-black text-emerald-800">{formatMoney(total)} ج.م</span>
                </div>
              </div>
            )}

            {/* Refund method */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">طريقة الاسترداد</label>
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60 shadow-inner">
                {[
                  { value: "cash_back", label: "نقداً", desc: "استرداد كامل نقداً من الصندوق", requiresCustomer: false },
                  { value: "store_credit", label: "رصيد حساب", desc: "يُضاف للرصيد ويُخصم من دينه", requiresCustomer: true },
                  { value: "split", label: "مختلط", desc: "جزء نقداً والباقي يُضاف للرصيد", requiresCustomer: true },
                ].map(opt => {
                  const disabled = isLocked || (opt.requiresCustomer && !customer);
                  const active = refundMethod === opt.value;
                  return (
                    <button key={opt.value} onClick={() => !disabled && setRefundMethod(opt.value)} disabled={disabled}
                      className={`flex-1 rounded-lg py-2 px-1 text-center transition-all disabled:cursor-not-allowed ${active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 disabled:opacity-40"}`}>
                      <div className="text-[12px] font-bold">{opt.label}</div>
                      <div className="text-[9px] font-medium opacity-70 leading-tight mt-0.5 hidden sm:block">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              {refundMethod === "split" && total > 0 && (
                <div className="flex flex-col gap-1 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <label className="text-[11px] font-bold text-indigo-600">المبلغ النقدي</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max={total} step="0.01"
                      value={splitCashAmount}
                      onChange={e => setSplitCashAmount(e.target.value)}
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[13px] font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="0.00"
                    />
                    <span className="text-[11px] text-slate-500 shrink-0">ج.م</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>رصيد حساب</span>
                    <span className="font-bold text-indigo-600">{formatMoney(Math.max(0, total - (Number(splitCashAmount) || 0)))} ج.م</span>
                  </div>
                </div>
              )}
            </div>

            {/* Reason — collapsible */}
            <div className="flex flex-col">
              <button onClick={() => setReasonOpen(o => !o)}
                className="flex w-full items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest">
                <span>سبب الاسترداد {reason !== "other" ? <span className="text-emerald-600 normal-case tracking-normal text-[10px] ml-1">({REASONS.find(r => r.value === reason)?.label})</span> : reasonOther ? <span className="text-emerald-600 normal-case tracking-normal text-[10px] ml-1">({reasonOther})</span> : ""}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
              </button>
              {reasonOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="relative">
                    <select value={reason} onChange={e => setReason(e.target.value)} disabled={isLocked}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm appearance-none">
                      {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {reason === "other" && !isLocked && (
                    <input value={reasonOther} onChange={e => setReasonOther(e.target.value)} placeholder="اذكر السبب بتفصيل..."
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 shadow-sm transition-all" />
                  )}
                </div>
              )}
            </div>

            {/* Action buttons — mirrors header */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="w-full h-px bg-slate-100" />
              <div className="flex gap-2">
                <button onClick={() => setTodayReturnsOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 transition-all">
                  <Calendar className="h-4 w-4" /> سجل المرتجعات
                </button>
                <PermissionGate page="sales_returns" action="print">
                  <button onClick={() => setPrintPreview(true)} disabled={!total}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <Printer className="h-4 w-4" /> طباعة
                  </button>
                </PermissionGate>
              </div>
              {mode && !isLocked && (
                <PermissionGate page="sales_returns" action={isEditMode ? "edit" : "add"}>
                  <button onClick={() => setShowSaveConfirmModal(true)} disabled={isSaving || !total}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-[13px] font-black text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
                  </button>
                </PermissionGate>
              )}
              <div className="flex gap-2">
                {isEditMode && isLocked && (
                  <PermissionGate page="sales_returns" action="edit">
                    <button onClick={() => setShowEditWarnModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-[12px] font-black text-white hover:bg-indigo-700 transition-all">
                      <Pencil className="h-4 w-4" /> تعديل
                    </button>
                  </PermissionGate>
                )}
                {isEditMode && !isLocked && (
                  <PermissionGate page="sales_returns" action="delete">
                    <button onClick={() => setMessage({ text: "حذف المرتجع غير متاح حالياً", type: "error" })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-black text-rose-600 hover:bg-rose-100 transition-all">
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                  </PermissionGate>
                )}
                {!isEditMode && (
                  <button onClick={() => setShowWarningModal(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 transition-all">
                    <RotateCcw className="h-4 w-4" /> مرتجع جديد
                  </button>
                )}
              </div>
            </div>

            {/* Invoice selected count */}
            {mode === "invoice" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-bold text-slate-500 flex items-center gap-2 mt-2">
                <Package className="w-4 h-4 opacity-50" />
                {invoiceLines.filter(l => l.checked).length > 0 ? (
                  <span className="text-emerald-700">تم اختيار <span className="font-black">{invoiceLines.filter(l => l.checked).length}</span> أصناف للاسترداد</span>
                ) : (
                  "لم يتم تحديد أي أصناف للإرجاع"
                )}
              </div>
            )}

            {/* Original invoice preview — collapsible */}
            {mode === "invoice" && loadedInvoice && (
              <div className="mt-2 flex flex-col">
                <button onClick={() => setPreviewOpen(o => !o)}
                  className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> الفاتورة الأصلية · #{loadedInvoice.invoice_no || loadedInvoice.doc_no}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${previewOpen ? "rotate-180" : ""}`} />
                </button>
                {previewOpen && (
                  <div className="mt-3 animate-slide-up origin-top">
                    <OriginalInvoicePreview invoice={loadedInvoice} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-emerald-200 bg-emerald-700 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-emerald-300">سيتم استرداد</span>
                <span className="text-[10px] text-emerald-400">المبلغ المُعاد للعميل</span>
              </div>
              <span className="text-[20px] font-black text-white">{formatMoney(total)} ج.م</span>
            </div>
          </div>
        </aside>

        {/* Right Panel */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50 p-4">

          {mode === "direct" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              {!isLocked && (
                <div className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
                  <div className="grid grid-cols-[3fr_110px_100px_80px_100px_100px_160px_80px] gap-2 items-end">
                    {/* Item search */}
                    <div className="relative flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                      <div className="flex items-center gap-1">
                        <div className={`relative flex flex-1 items-center gap-2 rounded-sm border px-2.5 h-[37px] ${lookupOpen ? "border-slate-800 bg-white" : "border-slate-300 bg-slate-50"}`}>
                          <Search className="h-4 w-4 shrink-0 text-slate-400" />
                          <input ref={itemInputRef} value={itemQuery}
                            onChange={e => { setItemQuery(e.target.value); setLookupOpen(true); if (stagingItem) { setStagingItem(null); setStagingPrice(""); setStagingPurchasePrice(""); } }}
                            onFocus={e => { setLookupOpen(true); e.target.select(); }}
                            placeholder="ابحث عن صنف بالاسم أو الكود..."
                            className="flex-1 bg-transparent text-[12px] font-bold text-slate-800 outline-none placeholder:text-slate-400"
                            onKeyDown={e => {
                              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, itemResults.length - 1)); }
                              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
                              else if (e.key === "Enter") {
                                e.preventDefault();
                                if (itemResults.length > 0) { selectItemForStaging(itemResults[activeIndex >= 0 ? activeIndex : 0]); }
                                else if (itemSearchActiveRef.current) { pendingPickRef.current = true; }
                              }
                              else if (e.key === "Escape") { setLookupOpen(false); setActiveIndex(-1); }
                            }} />
                          {stagingItem && (
                            <button onClick={() => { setStagingItem(null); setStagingPrice(""); setStagingPurchasePrice(""); setItemQuery(""); setItemResults([]); setItemOffset(0); setItemHasMore(false); setLookupOpen(false); setTimeout(() => itemInputRef.current?.focus(), 30); }}
                              className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                          )}
                          {lookupOpen && itemResults.length > 0 && (
                            <SearchDropdown
                              items={itemResults.map(item => ({ ...item, name: item.name_ar || item.name, price_label: `${formatMoney(item.sale_price || 0)} ج.م` }))}
                              onPick={selectItemForStaging}
                              activeIndex={activeIndex}
                              query={itemQuery}
                              onLoadMore={loadMoreItems}
                              hasMoreFromServer={itemHasMore}
                              isLoadingMore={isLoadingMoreItems}
                            />
                          )}
                        </div>
                        <button onClick={() => setAdvancedSearchOpen(true)}
                          className="flex h-[37px] w-[37px] shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                          title="بحث متقدم">
                          <Filter className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Warehouse dropdown */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">المستودع</label>
                      <select ref={stagingWHRef} value={stagingWarehouseId} onChange={e => setStagingWarehouseId(e.target.value)} onKeyDown={e => handleFieldKeyDown(e, stagingQtyRef, itemInputRef)}
                        className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800">
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    {/* Unit — read-only preview */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                      <div className="w-full h-[37px] border border-slate-200 rounded-sm bg-slate-100 py-2 px-2 text-[12px] font-bold text-slate-500 flex items-center">
                        {stagingItem
                          ? (units.find(u => String(u.id) === String(stagingUnitId))?.name || "أساسية")
                          : "—"}
                      </div>
                    </div>

                    {/* Qty input */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                      <input ref={stagingQtyRef} type="number"
                        min={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "0.001"}
                        step={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "any"}
                        value={stagingQty}
                        onChange={e => {
                          const u = units.find(u => String(u.id) === String(stagingUnitId));
                          setStagingQty(u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value);
                        }}
                        onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, stagingPriceRef, stagingWHRef)}
                        className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center" />
                    </div>

                    {/* Return price input */}
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] font-bold text-slate-600">سعر المرتجع</label>
                      <input ref={stagingPriceRef} type="number" step="any" value={stagingPrice} onChange={e => setStagingPrice(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, addBtnRef, stagingQtyRef, true)}
                        className={`w-full h-[37px] border rounded-sm py-2 px-2 text-[12px] font-black outline-none text-center transition-colors
                          ${stagingItem && Number(stagingPurchasePrice) > 0 && Number(stagingPrice) > 0 && Number(stagingPrice) < Number(stagingPurchasePrice)
                            ? "border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-600"
                            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-slate-800"}`} />
                      <div className="h-[18px] flex items-center justify-center gap-2 rounded-sm bg-slate-100 border border-slate-200 px-1 overflow-hidden">
                        {stagingItem ? (
                          <>
                            <span className="text-[9px] font-mono text-slate-400 shrink-0">بيع {Number(stagingItem.sale_price || 0).toFixed(2)} · شراء {Number(stagingPurchasePrice || 0).toFixed(2)}</span>
                            <PriceDelta entered={stagingPrice} baseline={stagingItem.sale_price} className="shrink-0" />
                          </>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">—</span>
                        )}
                      </div>
                    </div>

                    {/* Warehouse stock table */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600">المخزون الحالي</label>
                      <div className="border border-slate-300 rounded-sm bg-slate-50 overflow-y-auto outline-none" style={{height:"37px"}}>
                        <table className="w-full text-[10px] border-collapse">
                          <tbody>
                            {warehouses.map(w => {
                              const qty = stagingItem && stockLevels[stagingItem.id] ? (stockLevels[stagingItem.id][w.id] || 0) : 0;
                              return (
                                <tr key={w.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-100">
                                  <td className="px-1.5 py-0.5 font-bold text-slate-600 truncate">{w.name}</td>
                                  <td className={`px-1.5 py-0.5 font-mono text-center ${qty > 0 ? "text-emerald-600 font-black" : "text-slate-400"}`}>{qty}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Add button */}
                    <button ref={addBtnRef} onClick={addStagingToCart} disabled={!stagingItem}
                      className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-emerald-600 px-4 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm">
                      <Plus className="h-4 w-4" /> إضافة
                    </button>
                  </div>
                </div>
              )}
              {cart.length > 0 ? (
                <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-right">
                    <thead className="border-b-2 border-slate-300 bg-slate-50 sticky top-0">
                      <tr className="[&>*+*]:border-r [&>*+*]:border-slate-200">
                        <th className="px-3 py-2.5 text-[11px] font-bold text-slate-400 text-center w-14">الكود</th>
                        <th className="px-4 py-2.5 text-[12px] font-bold text-slate-700">الصنف</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-center">المستودع</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 text-center">الوحدة</th>
                        <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-[11px] font-bold text-slate-400">سعر البيع</span>
                            <span className="text-[9px] font-medium text-slate-300 leading-none">للمعاينة فقط</span>
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-[11px] font-bold text-slate-400">سعر الشراء</span>
                            <span className="text-[9px] font-medium text-slate-300 leading-none">للمعاينة فقط</span>
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-px">
                            <span className="text-[12px] font-black text-emerald-700">سعر المرتجع</span>
                            <span className="text-[9px] font-medium text-slate-400 leading-none">قابل للتعديل</span>
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-center">الكمية</th>
                        <th className="px-3 py-2.5 text-[12px] font-black text-slate-700 text-center">الإجمالي</th>
                        {!isLocked && <th className="px-3 py-2.5 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l, idx) => (
                        <tr key={l.key} className="border-b border-slate-100 hover:bg-slate-50/80 animate-slide-up [&>*+*]:border-r [&>*+*]:border-slate-100" style={{ animationDelay: `${idx * 50}ms` }}>
                          <td className="px-3 py-3 text-center text-[11px] font-mono text-slate-400">{l.item_code || "—"}</td>
                          <td className="px-4 py-3 text-[13px] font-bold text-slate-800">{l.item_name}</td>
                          <td className="px-2 py-2 text-center">
                            {!isLocked ? (
                              <div className="flex flex-col items-center gap-1">
                                <select
                                  value={l.warehouse_id}
                                  onChange={e => updateCartWarehouse(l.key, e.target.value)}
                                  className="h-7 w-full rounded border border-slate-200 bg-slate-50 px-1.5 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-100 transition-colors cursor-pointer"
                                >
                                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {(() => {
                                  const wh = stockLevels[l.item_id] || {};
                                  const current = wh[Number(l.warehouse_id)] ?? wh[l.warehouse_id];
                                  if (current === undefined) return null;
                                  const after = current + l.quantity;
                                  return (
                                    <div className="flex items-center gap-1 text-[11px] font-mono font-black">
                                      <span className="text-slate-400">{current}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className="text-emerald-600">{after}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[12px] font-bold text-slate-600">{l.warehouse_name}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-[12px] font-bold text-slate-500">{l.unit_name}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div
                              className="inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-3 py-1 text-[13px] font-mono font-bold text-slate-400 cursor-not-allowed select-none min-w-[80px]"
                              title="سعر البيع — للمعاينة فقط"
                            >
                              {l.sale_price > 0 ? formatMoney(l.sale_price) : "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div
                              className="inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-3 py-1 text-[13px] font-mono font-bold text-slate-400 cursor-not-allowed select-none min-w-[80px]"
                              title="سعر الشراء — للمعاينة فقط"
                            >
                              {l.purchase_price > 0 ? formatMoney(l.purchase_price) : "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {!isLocked ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <input type="number" step="any" min="0" value={l.unit_price}
                                  onChange={e => updateCartPrice(l.key, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  className={`w-24 rounded border px-2 py-1 text-center text-[13px] font-black font-mono outline-none focus:ring-1 transition-colors
                                    ${l.purchase_price > 0 && Number(l.unit_price) > 0 && Number(l.unit_price) < l.purchase_price
                                      ? "border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100"
                                      : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white focus:ring-emerald-200"}`} />
                                <PriceDelta entered={l.unit_price} baseline={l.sale_price} />
                              </div>
                            ) : (
                              <span className="text-[13px] font-black text-slate-700 font-mono">{formatMoney(l.unit_price)}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {!isLocked ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => updateCartQty(l.key, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Minus className="h-3 w-3" /></button>
                                <span className="w-8 text-center text-[13px] font-black text-slate-800">{l.quantity}</span>
                                <button onClick={() => updateCartQty(l.key, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Plus className="h-3 w-3" /></button>
                              </div>
                            ) : <span className="text-[13px] font-black text-slate-700">{l.quantity}</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-[14px] font-black text-emerald-700 font-mono">{formatMoney(l.unit_price * l.quantity)}</td>
                          {!isLocked && <td className="px-3 py-3 text-center"><button onClick={() => removeCartLine(l.key)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white text-slate-400">
                  <RotateCcw className="h-10 w-10 opacity-30" />
                  <div className="text-[13px] font-bold">ابحث عن صنف وأضفه للمرتجع</div>
                </div>
              )}
            </div>
          )}

          {mode === "invoice" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-1 flex-col gap-4 overflow-hidden min-w-0">
                {!loadedInvoice ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
                    <Search className="h-12 w-12 opacity-20" />
                    <p className="text-[14px] font-black">لم يتم اختيار فاتورة بعد</p>
                    <button onClick={() => setInvoicePickerOpen(true)} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-[13px] font-black text-white hover:bg-emerald-800 transition-colors">
                      <Search className="h-4 w-4" /> اختيار فاتورة مبيعات
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shrink-0">
                      <div className="flex items-center gap-4 text-[13px]">
                        <span className="font-black text-emerald-800">فاتورة #{loadedInvoice.invoice_no || loadedInvoice.doc_no}</span>
                        {loadedInvoice.customer_name && <span className="text-slate-600">العميل: <strong>{loadedInvoice.customer_name}</strong></span>}
                        <span className="text-slate-500">{formatDate(loadedInvoice.created_at)}</span>
                        <span className="font-bold text-emerald-700">الإجمالي: {formatMoney(loadedInvoice.total)} ج.م</span>
                      </div>
                      {!isLocked && (
                        <button onClick={() => setInvoicePickerOpen(true)} className="flex items-center gap-1.5 text-[12px] font-bold text-rose-600 hover:text-rose-800">
                          <X className="h-3.5 w-3.5" /> تغيير الفاتورة
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-right">
                        <thead className="border-b border-slate-200 bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-3 w-8"></th>
                            <th className="px-2 py-3 text-[11px] font-bold text-slate-400 text-center w-20">الكود</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500">الصنف</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">السعر</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية الأصلية</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">إجمالي الفاتورة</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">المُرتجع سابقاً</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">كمية الإرجاع</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-emerald-600 text-center">إجمالي الإرجاع</th>
                            <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية المتبقية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceLines.map((l, idx) => {
                            const afterReturn = l.original_qty - l.already_returned - (l.checked ? l.qty_to_return : 0);
                            const originalTotal = l.original_qty * l.unit_price;
                            const returnTotal = l.checked ? l.qty_to_return * l.unit_price : 0;
                            return (
                              <tr key={l.invoice_line_id} className={`border-b border-slate-100 transition-colors animate-slide-up ${l.checked ? "bg-emerald-50/50" : "hover:bg-slate-50"}`} style={{ animationDelay: `${idx * 50}ms` }}>
                                <td className="px-3 py-3 text-center">
                                  <input type="checkbox" checked={l.checked} onChange={() => !isLocked && toggleInvoiceLine(l.invoice_line_id)} disabled={isLocked}
                                    className="h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed" />
                                </td>
                                <td className="px-2 py-3 text-center text-[11px] font-mono text-slate-400">{l.item_code || "—"}</td>
                                <td className="px-3 py-3 text-[13px] font-bold text-slate-800">{l.item_name}</td>
                                <td className="px-3 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`text-[12px] font-mono ${l.purchase_price > 0 && l.unit_price < l.purchase_price ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                                      {formatMoney(l.unit_price)}
                                    </span>
                                    {l.purchase_price > 0 && l.unit_price < l.purchase_price && (
                                      <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" title={`أقل من سعر المخزون (${formatMoney(l.purchase_price)})`} />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center text-[13px] text-slate-600">{l.original_qty}</td>
                                <td className="px-3 py-3 text-center text-[12px] font-bold text-slate-700">{formatMoney(originalTotal)}</td>
                                <td className="px-3 py-3 text-center text-[13px] text-slate-500">{l.already_returned || "—"}</td>
                                <td className="px-3 py-3 text-center">
                                  <input type="number" min="0" max={l.original_qty - l.already_returned} value={l.qty_to_return}
                                    onChange={e => setInvoiceLineQty(l.invoice_line_id, e.target.value)}
                                    disabled={!l.checked || isLocked}
                                    className="w-16 rounded-sm border border-slate-200 px-2 py-1 text-center text-[13px] font-black text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                                </td>
                                <td className="px-3 py-3 text-center text-[12px] font-black text-emerald-700">
                                  {l.checked && returnTotal > 0 ? formatMoney(returnTotal) : "—"}
                                </td>
                                <td className={`px-3 py-3 text-center text-[13px] font-bold ${afterReturn < 0 ? "text-rose-600" : "text-slate-500"}`}>{afterReturn}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {invoiceLines.length === 0 && (() => {
                        const fullyReturned = loadedInvoice?.status === "returned" || (loadedInvoice?.lines || []).length > 0;
                        return fullyReturned ? (
                          <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                              <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <div className="text-[14px] font-black text-emerald-700">تم إرجاع جميع أصناف هذه الفاتورة بالكامل</div>
                            <div className="text-[12px] font-bold text-slate-400">لا توجد كميات متبقية قابلة للإرجاع</div>
                            <Link to={`/sales/returns?invoice_id=${loadedInvoice?.id}`} className="flex items-center gap-1 text-[12px] font-bold text-emerald-600 hover:underline mt-1">
                              <ExternalLink className="h-3.5 w-3.5" /> عرض مرتجعات هذه الفاتورة
                            </Link>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                            <AlertCircle className="h-8 w-8 opacity-30" />
                            <div className="text-[13px]">لا توجد أصناف قابلة للإرجاع في هذه الفاتورة</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal open={showSaveConfirmModal} onClose={() => setShowSaveConfirmModal(false)} title="تأكيد حفظ المرتجع">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-black text-slate-800">هل أنت متأكد من حفظ هذا المرتجع؟</p>
              <p className="text-[12px] text-slate-600">سيتم {isEditMode ? "تعديل" : "تسجيل"} المرتجع بقيمة إجمالية <span className="font-black text-emerald-700">{formatMoney(total)} ج.م</span> وتحديث المخزون والحسابات.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSaveConfirmModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowSaveConfirmModal(false); handleSave(); }} disabled={isSaving}
              className="flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-2 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition-all active:scale-[0.98]">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><CheckCircle2 className="w-4 h-4" /> نعم، حفظ المرتجع</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showWarningModal} onClose={() => setShowWarningModal(false)} title="تأكيد الإلغاء">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-[14px] text-slate-700">هل تريد إلغاء المرتجع الحالي؟ سيتم فقدان البيانات غير المحفوظة.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowWarningModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">لا، متابعة</button>
            <button onClick={() => { setShowWarningModal(false); resetToIdle(); }} className="rounded-md bg-rose-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-rose-700 transition-all active:scale-[0.98]">نعم، إلغاء</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditWarnModal} onClose={() => setShowEditWarnModal(false)} title="تعديل المرتجع">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-[14px] text-slate-700">هل تريد تعديل هذا المرتجع؟ سيتم فتح المرتجع للتعديل.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowEditWarnModal(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowEditWarnModal(false); setIsLocked(false); }} className="rounded-md bg-indigo-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-indigo-700 transition-all active:scale-[0.98]">نعم، تعديل</button>
          </div>
        </div>
      </Modal>

      <Modal open={showSwitchInvoiceWarning} onClose={() => setShowSwitchInvoiceWarning(false)} title="تغيير الفاتورة">
        <div className="flex flex-col gap-5 animate-modal-enter">
          <p className="text-[14px] text-slate-700">يوجد مرتجع قيد التحرير. هل تريد حفظه أولاً قبل اختيار فاتورة أخرى؟</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSwitchInvoiceWarning(false)} className="rounded-md border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
            <button onClick={() => { setShowSwitchInvoiceWarning(false); setLoadedInvoice(null); setInvoiceLines([]); setInvoicePickerOpen(true); }} className="rounded-md bg-rose-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-rose-700 transition-all active:scale-[0.98]">تجاهل وتغيير</button>
            <button onClick={async () => { setShowSwitchInvoiceWarning(false); await handleSave(); setLoadedInvoice(null); setInvoiceLines([]); setInvoicePickerOpen(true); }} className="rounded-md bg-emerald-700 px-5 py-2 text-[13px] font-bold text-white hover:bg-emerald-800 transition-all active:scale-[0.98]">حفظ ثم تغيير</button>
          </div>
        </div>
      </Modal>

      <InvoicePickerTodayModal open={invoicePickerOpen && !isEditMode} onClose={() => { setInvoicePickerOpen(false); if (!loadedInvoice) setMode(null); }} onSelectInvoice={handleDetailConfirm} customers={customers} />
      <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />
      <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); setCustomerCreateOpen(false); }} />
      <SalesReturnTodayModal open={todayReturnsOpen} onClose={() => setTodayReturnsOpen(false)} />
      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="sales_return"
        invoice={{
          invoice_no: docNo,
          created_at: invoiceCreatedAt || new Date().toISOString(),
          customer_name: customer?.name,
          discount: Number(headerDiscount) || 0,
          increase: Number(headerIncrease) || 0,
          lines: (mode === "direct" ? cart : invoiceLines.filter(l => l.checked)).map(l => ({
            item_name: l.item_name,
            quantity: mode === "direct" ? l.quantity : l.qty_to_return,
            unit_price: l.unit_price,
            discount_amount: 0,
          })),
        }}
        settings={{}}
        operationLabel="مرتجع مبيعات"
        onConfirmPrint={() => handleSave()}
        confirmLabel="حفظ وطباعة"
        onSaveOnly={() => handleSave()}
        saveOnlyLabel="حفظ بدون طباعة"
        isSaving={isSaving}
      />
      <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); }} />
      <CustomerInfoModal open={customerInfoOpen} customerId={customer?.id} onClose={() => setCustomerInfoOpen(false)} onUpdated={(u) => { setCustomers(prev => prev.map(c => c.id === u.id ? u : c)); setCustomer({ id: u.id, name: u.name }); }} />
      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
      />

      {/* Delete warning modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-7">
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-[17px] font-black text-slate-900 mb-1">تأكيد حذف المرتجع</h2>
                  <p className="text-[13px] font-medium text-slate-500 leading-relaxed">
                    سيتم حذف هذا المرتجع نهائياً وعكس تأثيره على المخزون ورصيد العميل. هذا الإجراء لا يمكن التراجع عنه.
                  </p>
                </div>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 mb-6 text-[12px] font-bold text-rose-700">
                تأكد من صحة قرارك قبل المتابعة.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-2xl bg-rose-600 text-white text-[13px] font-black hover:bg-rose-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isDeleting ? "جاري الحذف..." : "نعم، احذف المرتجع"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="h-11 px-6 rounded-2xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {saveSuccess && (
        <ReturnSaveSuccess
          docNo={saveSuccess.docNo}
          total={saveSuccess.total}
          discount={saveSuccess.discount}
          increase={saveSuccess.increase}
          refundMethod={saveSuccess.refundMethod}
          cashAmount={saveSuccess.cashAmount}
          creditAmount={saveSuccess.creditAmount}
          entityName={saveSuccess.entityName}
          entityNewBalance={saveSuccess.entityNewBalance}
          type={saveSuccess.type}
          onDismiss={handleSuccessDismiss}
        />
      )}
    </div>
  );
}
