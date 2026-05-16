import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Trash2, Plus, Minus, RotateCcw, Clock,
  CheckCircle2, AlertCircle, Lock, Pencil, Printer, X, ExternalLink,
  Package, RefreshCw, ChevronRight, UserPlus, Phone, Calendar,
  Loader2,
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../services/api";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import PermissionGate from "../../components/ui/PermissionGate";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import SalesReturnTodayModal from "../../components/sales/SalesReturnTodayModal";
import InvoicePickerTodayModal from "../../components/sales/InvoicePickerTodayModal";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
}
function last30Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const REASONS = [
  { value: "defective", label: "عيب في المنتج" },
  { value: "wrong_order", label: "خطأ في الطلب" },
  { value: "shipping_damage", label: "تلف أثناء الشحن" },
  { value: "not_as_described", label: "لا يطابق الوصف" },
  { value: "other", label: "أخرى" },
];


// ── Customer Create Modal ─────────────────────────────────────────────────────
function CustomerCreateModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phones, setPhones] = useState([""]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() { setName(""); setPhones([""]); setNote(""); setError(""); }

  async function handleSave() {
    if (!name.trim()) { setError("اسم العميل مطلوب"); return; }
    setSaving(true);
    try {
      const validPhones = phones.filter(p => p.trim());
      const r = await api.post("/api/customers", {
        name: name.trim(),
        phone: validPhones[0] || "",
        additional_phones: validPhones.length > 1 ? JSON.stringify(validPhones.slice(1)) : undefined,
        notes: note.trim() || undefined,
      });
      reset();
      onCreated(r.data.data);
    } catch (e) {
      setError(e.response?.data?.message || "فشل إنشاء العميل");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="w-[480px] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-[15px] font-black text-slate-900">إضافة عميل جديد</h2>
          <button onClick={() => { reset(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">اسم العميل *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً: أحمد محمد..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500">أرقام الهاتف</label>
              <button onClick={() => setPhones(p => [...p, ""])}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800">
                <Phone className="h-3 w-3" /> إضافة هاتف
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {phones.map((ph, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ph} onChange={e => setPhones(p => p.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={i === 0 ? "الهاتف الرئيسي..." : `هاتف ${i + 1}...`}
                    className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200" />
                  {i > 0 && (
                    <button onClick={() => setPhones(p => p.filter((_, j) => j !== i))}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">ملاحظة (اختياري)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="أي ملاحظات..."
              rows={2} className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 resize-none" />
          </div>
          {error && <p className="text-[12px] font-bold text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={() => { reset(); onClose(); }}
            className="rounded-lg border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-emerald-700 px-6 py-2 text-[13px] font-black text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors">
            {saving ? "جاري الحفظ..." : "إنشاء وتحديد"}
          </button>
        </div>
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
  const [customerBalance, setCustomerBalance] = useState(null);
  const [ajalDebt, setAjalDebt] = useState(0);

  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [reason, setReason] = useState("other");
  const [reasonOther, setReasonOther] = useState("");

  const [editActivation, setEditActivation] = useState(null);

  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState([]);
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

  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showEditWarnModal, setShowEditWarnModal] = useState(false);
  const [showSwitchInvoiceWarning, setShowSwitchInvoiceWarning] = useState(false);
  const [todayReturnsOpen, setTodayReturnsOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);

  const itemInputRef = useRef(null);
  const stagingWHRef = useRef(null);
  const stagingUnitRef = useRef(null);
  const stagingQtyRef = useRef(null);
  const stagingPriceRef = useRef(null);
  const addBtnRef = useRef(null);

  const { docNo, createdAt: invoiceCreatedAt, isActive: invoiceIsActive, activate: activateInvoice, reset: resetActivation } =
    useInvoiceActivation("sales_return", editActivation);

  const total = useMemo(() => {
    if (mode === "direct") return cart.reduce((acc, l) => acc + l.unit_price * l.quantity, 0);
    if (mode === "invoice") return invoiceLines.filter(l => l.checked).reduce((acc, l) => acc + l.unit_price * l.qty_to_return, 0);
    return 0;
  }, [mode, cart, invoiceLines]);

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
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
      const sr = r.data.data;
      setEditActivation({ docNo: sr.doc_no || "", createdAt: sr.created_at || new Date().toISOString() });
      setRefundMethod(sr.refund_method || "cash_back");
      setReason(sr.reason || "other");
      if (sr.customer_id) setCustomer({ id: sr.customer_id, name: sr.customer_name || String(sr.customer_id) });
      if (sr.invoice_id) {
        setMode("invoice");
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
              item_name: l.item_name_ar || l.item_name || l.name,
              unit_price: Number(l.unit_price || 0),
              original_qty: Number(l.quantity),
              already_returned: alreadyReturned,
              qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
              checked: !!returnLine,
            };
          }).filter(l => l.original_qty - l.already_returned > 0 || returnedIds.has(l.invoice_line_id)));
        }).catch(() => {});
      } else {
        setMode("direct");
        setCart((sr.lines || []).map((l, idx) => ({
          key: `edit-${l.id || idx}`,
          item_id: l.item_id,
          item_name: l.item_name_ar || l.item_name || l.name,
          unit_price: Number(l.unit_price || 0),
          quantity: Number(l.quantity),
          warehouse_id: l.warehouse_id || "",
          unit_id: l.unit_id || "",
        })));
      }
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  useEffect(() => {
    if (!customer?.id) { setCustomerBalance(null); setAjalDebt(0); return; }
    api.get(`/api/customers/${customer.id}`).then(r => setCustomerBalance(Number(r.data.data?.opening_balance || 0))).catch(() => {});
    api.get(`/api/ajal-debts?customer_id=${customer.id}&status=pending`).then(r => {
      setAjalDebt((r.data.data || []).reduce((s, d) => s + Number(d.remaining_amount || 0), 0));
    }).catch(() => {});
  }, [customer?.id]);

  useEffect(() => {
    if (!itemQuery.trim() || stagingItem) { setItemResults([]); setLookupOpen(false); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(itemQuery)}&limit=20`)
        .then(r => { setItemResults(r.data.data || []); setLookupOpen(true); setActiveIndex(-1); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [itemQuery, stagingItem]);

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
    setItemQuery(item.name_ar || item.name);
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
    if (!invoiceIsActive) activateInvoice();
    setCart(prev => [...prev, {
      key: `direct-${stagingItem.id}-${Date.now()}`,
      item_id: stagingItem.id,
      item_name: stagingItem.name_ar || stagingItem.name,
      unit_price: price,
      quantity: qty,
      warehouse_id: stagingWarehouseId,
      unit_id: stagingUnitId,
    }]);
    setStagingItem(null); setStagingQty("1"); setStagingPrice(""); setStagingPurchasePrice("");
    setItemQuery(""); setItemResults([]); setLookupOpen(false); setActiveIndex(-1);
    setTimeout(() => itemInputRef.current?.focus(), 30);
  }

  function removeCartLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }
  function updateCartQty(key, delta) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, l.quantity + delta) }).filter(l => l.quantity > 0));
  }

  function selectMode(m) {
    if (m === "invoice") { setMode(m); setInvoicePickerOpen(true); }
    else { setMode(m); activateInvoice(); }
  }

  function resetToIdle() {
    setMode(null); setCart([]); setInvoiceLines([]); setLoadedInvoice(null);
    setCustomer(null); setCustomerLockedFromInvoice(false); setReason("other"); setReasonOther("");
    setItemQuery(""); setItemResults([]); setStagingItem(null); setStagingQty("1");
    setStagingPrice(""); setStagingPurchasePrice(""); setInvoicePickerOpen(false); resetActivation();
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
      item_name: l.item_name_ar || l.item_name || l.name,
      unit_price: Number(l.unit_price || 0),
      original_qty: Number(l.quantity),
      already_returned: Number(l.returned_quantity || 0),
      qty_to_return: 0,
      checked: false,
    })).filter(l => l.original_qty - l.already_returned > 0));
    if (inv.customer_id) {
      setCustomer({ id: inv.customer_id, name: inv.customer_name || String(inv.customer_id) });
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
    const payload = {
      doc_no: docNo || undefined, customer_id: customer?.id || null,
      refund_method: refundMethod, treasury_id: null,
      reason: reason === "other" ? (reasonOther || "other") : reason, lines,
    };
    setIsSaving(true); setMessage({ text: "", type: "" });
    try {
      const savedDocNo = docNo;
      if (isEditMode) {
        await api.put(`/api/invoices/returns/${editReturnId}`, payload);
        setIsLocked(true);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      } else if (mode === "invoice" && loadedInvoice) {
        await api.post(`/api/invoices/${loadedInvoice.id}/return`, payload);
        resetToIdle();
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      } else {
        await api.post("/api/invoices/general-return", payload);
        resetToIdle();
        setMessage({ text: `تم تسجيل المرتجع ${savedDocNo || ""} بنجاح`, type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      }
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
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

            <button onClick={() => selectMode("invoice")}
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
            <div className={`flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-black ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {message.text}
            </div>
          )}
        </div>
        <InvoicePickerTodayModal open={invoicePickerOpen} onClose={() => { setInvoicePickerOpen(false); setMode(null); }} onSelectInvoice={handleDetailConfirm} customers={customers} />
        <CustomerCreateModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); setCustomerCreateOpen(false); }} />
      </div>
    );
  }

  // ══ ACTIVE SCREEN ══
  return (
    <div dir="rtl" className="flex h-full flex-col bg-slate-50 overflow-hidden animate-fade-in">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-emerald-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col shrink-0">
            <h1 className="text-[14px] font-black text-slate-800">
              {isEditMode ? "تعديل مرتجع مبيعات" : mode === "invoice" && loadedInvoice ? `مرتجع فاتورة #${loadedInvoice.invoice_no || loadedInvoice.doc_no}` : "مرتجع مبيعات جديد"}
            </h1>
            <span className="text-[10px] font-bold text-slate-400">
              {isEditMode ? (isLocked ? "محفوظة — اضغط تعديل للتغيير" : "وضع التعديل") : mode === "direct" ? "مرتجع مباشر" : "مرتجع من فاتورة"}
            </span>
          </div>
          {isLocked && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <Lock className="h-3 w-3" /> محفوظة
            </div>
          )}
          {mode && (
            <div className="flex gap-1.5">
              <input readOnly value={invoiceIsActive ? (docNo || "") : "—"} className="h-7 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
              <input readOnly value={invoiceIsActive && invoiceCreatedAt ? new Date(invoiceCreatedAt).toLocaleString("ar-EG") : "—"} className="h-7 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed outline-none" />
            </div>
          )}
          {mode === "invoice" && loadedInvoice && (
            <Link to={`/sales/returns?invoice_id=${loadedInvoice.id}`} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline shrink-0">
              <ExternalLink className="h-3.5 w-3.5" /> عرض كل مرتجعات هذه الفاتورة
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {message.text && (
            <div className={`flex items-center gap-1.5 rounded-sm px-3 py-1 text-[12px] font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {message.text}
            </div>
          )}
          <button onClick={() => setTodayReturnsOpen(true)}
            className="flex h-9 items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-4 text-[13px] font-black text-emerald-700 hover:bg-emerald-100 transition-all">
            <Calendar className="h-4 w-4" /> مرتجعات اليوم
          </button>
          <PermissionGate page="sales_returns" action="print">
            <button
              onClick={() => setPrintPreview(true)}
              disabled={!total}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </PermissionGate>
          {isEditMode && isLocked && (
            <PermissionGate page="sales_returns" action="edit">
              <button onClick={() => setShowEditWarnModal(true)} className="flex h-9 items-center gap-2 rounded-sm bg-indigo-600 px-5 text-[13px] font-black text-white hover:bg-indigo-700 transition-all">
                <Pencil className="h-4 w-4" /> تعديل
              </button>
            </PermissionGate>
          )}
          {isEditMode && !isLocked && (
            <PermissionGate page="sales_returns" action="delete">
              <button onClick={() => setMessage({ text: "حذف المرتجع غير متاح حالياً", type: "error" })} className="flex h-9 items-center gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 text-[13px] font-black text-rose-600 hover:bg-rose-100 transition-all">
                <Trash2 className="h-4 w-4" /> حذف
              </button>
            </PermissionGate>
          )}
          {mode && !isLocked && (
            <PermissionGate page="sales_returns" action={isEditMode ? "edit" : "add"}>
              <button
                onClick={isEditMode ? handleSave : () => setPrintPreview(true)}
                disabled={isSaving || !total}
                className="flex h-9 items-center gap-2 rounded-sm bg-emerald-700 px-6 text-[13px] font-black text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}
              </button>
            </PermissionGate>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            <button onClick={handleTodayInvoicesClick} className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
              <Clock className="h-4 w-4" /> فواتير المبيعات
            </button>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500">العميل</label>
                {!isLocked && !customerLockedFromInvoice && (
                  <button onClick={() => setCustomerCreateOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800">
                    <UserPlus className="h-3 w-3" /> عميل جديد
                  </button>
                )}
              </div>
              <select value={customer?.id || ""} onChange={e => { const c = customers.find(x => String(x.id) === e.target.value); setCustomer(c ? { id: c.id, name: c.name } : null); }}
                disabled={isLocked || customerLockedFromInvoice}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">— بدون عميل —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {customerLockedFromInvoice && !isLocked && <p className="mt-1 text-[10px] text-slate-400">العميل محدد من الفاتورة الأصلية</p>}
            </div>

            {customer && customerBalance !== null && (
              <div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px]">
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span className="font-bold">رصيد الحساب</span>
                    <span className={`font-black ${customerBalance >= 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(customerBalance)} ج.م</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-sm bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 mt-2">
                  <span className="text-[10px] font-bold text-emerald-600">الرصيد بعد المرتجع</span>
                  <span className={`text-[12px] font-black font-mono ${(customerBalance - total) >= 0 ? "text-rose-600" : "text-emerald-700"}`}>{formatMoney(customerBalance - total)} ج.م</span>
                </div>
                {ajalDebt > 0 && (
                  <div className="flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-2.5 py-1.5 mt-1.5">
                    <span className="text-[10px] font-bold text-amber-600">ديون آجل معلقة</span>
                    <span className="text-[12px] font-black font-mono text-amber-700">{formatMoney(ajalDebt)} ج.م</span>
                  </div>
                )}
                <Link to={`/definitions/customers/${customer.id}`} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-700 pt-0.5 mt-1.5">
                  <ExternalLink className="h-3 w-3" /> عرض سجل العميل
                </Link>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-slate-500">طريقة الاسترداد</label>
              <div className="flex gap-2">
                {[{ value: "cash_back", label: "نقداً", requiresCustomer: false }, { value: "store_credit", label: "رصيد حساب", requiresCustomer: true }].map(opt => {
                  const disabled = isLocked || (opt.requiresCustomer && !customer);
                  return (
                    <button key={opt.value} onClick={() => !disabled && setRefundMethod(opt.value)} disabled={disabled}
                      className={`flex-1 rounded-md border py-2 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${refundMethod === opt.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-slate-500">السبب</label>
              <select value={reason} onChange={e => setReason(e.target.value)} disabled={isLocked}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {reason === "other" && !isLocked && (
                <input value={reasonOther} onChange={e => setReasonOther(e.target.value)} placeholder="اذكر السبب..."
                  className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200" />
              )}
            </div>

            {mode === "invoice" && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                {invoiceLines.filter(l => l.checked).length > 0 ? `تم اختيار ${invoiceLines.filter(l => l.checked).length} أصناف` : "لم يتم اختيار أصناف بعد"}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-emerald-200 bg-emerald-700 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-emerald-200">إجمالي المرتجع</span>
              <span className="text-[18px] font-black text-white">{formatMoney(total)} ج.م</span>
            </div>
          </div>
        </aside>

        {/* Right Panel */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50 p-4">

          {mode === "direct" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              {!isLocked && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shrink-0">
                  <div className="mb-3 text-[12px] font-bold text-slate-500">إضافة صنف</div>
                  <div className="relative mb-3">
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${lookupOpen ? "border-emerald-400 bg-white" : "border-slate-200 bg-slate-50"}`}>
                      <Search className="h-4 w-4 shrink-0 text-slate-400" />
                      <input ref={itemInputRef} value={itemQuery}
                        onChange={e => { setItemQuery(e.target.value); if (stagingItem) { setStagingItem(null); setStagingPrice(""); setStagingPurchasePrice(""); } }}
                        placeholder="ابحث عن صنف بالاسم أو الباركود..."
                        className="flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
                        onKeyDown={e => {
                          if (!lookupOpen || !itemResults.length) return;
                          if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, itemResults.length - 1)); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
                          else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); selectItemForStaging(itemResults[activeIndex]); }
                          else if (e.key === "Escape") { setLookupOpen(false); setActiveIndex(-1); }
                        }} />
                      {stagingItem && (
                        <button onClick={() => { setStagingItem(null); setStagingPrice(""); setStagingPurchasePrice(""); setItemQuery(""); setItemResults([]); setLookupOpen(false); setTimeout(() => itemInputRef.current?.focus(), 30); }}
                          className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                    {lookupOpen && itemResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-xl border border-slate-100 bg-white shadow-xl max-h-60 overflow-y-auto">
                        {itemResults.map((item, idx) => (
                          <button key={item.id} onMouseDown={e => e.preventDefault()} onClick={() => selectItemForStaging(item)}
                            className={`flex w-full items-center justify-between px-3 py-2.5 text-right transition-colors border-b border-slate-100 last:border-0 ${idx === activeIndex ? "bg-emerald-50" : "hover:bg-emerald-50"}`}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 border border-slate-200">
                                <Package className="h-4 w-4 text-slate-300" />
                              </div>
                              <div>
                                <div className="text-[13px] font-black text-slate-800">{item.name_ar || item.name}</div>
                                <div className="text-[10px] font-bold text-slate-400">{item.item_code || item.barcode || `#${item.id}`}</div>
                              </div>
                            </div>
                            <div className="text-[12px] font-black text-emerald-700">{formatMoney(item.sale_price)} ج.م</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`rounded-lg border px-4 py-3 transition-opacity ${stagingItem ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50 opacity-40 pointer-events-none"}`}>
                    {stagingItem && <div className="mb-2 text-[12px] font-black text-emerald-800 truncate">{stagingItem.name_ar || stagingItem.name}</div>}
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500">المستودع</label>
                        <select ref={stagingWHRef} value={stagingWarehouseId} onChange={e => setStagingWarehouseId(e.target.value)} onKeyDown={e => handleFieldKeyDown(e, stagingUnitRef, itemInputRef)}
                          className="rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-emerald-400 min-w-[120px]">
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500">الوحدة</label>
                        <select ref={stagingUnitRef} value={stagingUnitId} onChange={e => setStagingUnitId(e.target.value)} onKeyDown={e => handleFieldKeyDown(e, stagingQtyRef, stagingWHRef)}
                          className="rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-emerald-400 min-w-[90px]">
                          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500">الكمية</label>
                        <input ref={stagingQtyRef} type="number" min="1" value={stagingQty} onChange={e => setStagingQty(e.target.value)} onKeyDown={e => handleFieldKeyDown(e, stagingPriceRef, stagingUnitRef)}
                          className="w-16 rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-center text-[13px] font-black text-slate-800 outline-none focus:border-emerald-400" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500">سعر البيع</label>
                        <input ref={stagingPriceRef} type="number" min="0" value={stagingPrice} onChange={e => setStagingPrice(e.target.value)} onKeyDown={e => handleFieldKeyDown(e, addBtnRef, stagingQtyRef, true)}
                          className="w-24 rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-center text-[13px] font-black text-slate-800 outline-none focus:border-emerald-400" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400">سعر الشراء</label>
                        <input type="number" value={stagingPurchasePrice} disabled tabIndex={-1}
                          className="w-24 rounded-sm border border-slate-100 bg-slate-100 px-2 py-1.5 text-center text-[13px] font-bold text-slate-400 outline-none cursor-not-allowed" />
                      </div>
                      <button ref={addBtnRef} onClick={addStagingToCart} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStagingToCart(); } }}
                        className="mb-0.5 flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-1.5 text-[12px] font-black text-white hover:bg-emerald-800 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> إضافة
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {cart.length > 0 ? (
                <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-right">
                    <thead className="border-b border-slate-200 bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500">الصنف</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">السعر</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الإجمالي</th>
                        {!isLocked && <th className="px-3 py-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l, idx) => (
                        <tr key={l.key} className="border-b border-slate-100 hover:bg-slate-50 animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                          <td className="px-4 py-3 text-[13px] font-bold text-slate-800">{l.item_name}</td>
                          <td className="px-3 py-3 text-center text-[13px] text-slate-600">{formatMoney(l.unit_price)}</td>
                          <td className="px-3 py-3 text-center">
                            {!isLocked ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => updateCartQty(l.key, -1)} className="flex h-6 w-6 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                <span className="w-8 text-center text-[13px] font-black text-slate-700">{l.quantity}</span>
                                <button onClick={() => updateCartQty(l.key, 1)} className="flex h-6 w-6 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                              </div>
                            ) : <span className="text-[13px] font-black text-slate-700">{l.quantity}</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-[13px] font-bold text-emerald-700">{formatMoney(l.unit_price * l.quantity)}</td>
                          {!isLocked && <td className="px-3 py-3 text-center"><button onClick={() => removeCartLine(l.key)} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>}
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
              {!loadedInvoice ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
                  <Search className="h-12 w-12 opacity-20" />
                  <p className="text-[14px] font-black">لم يتم اختيار فاتورة بعد</p>
                  <button onClick={() => setInvoicePickerOpen(true)} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-[13px] font-black text-white hover:bg-emerald-800 transition-colors">
                    <Search className="h-4 w-4" /> اختيار فاتورة
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
                          <th className="px-3 py-3 text-[11px] font-bold text-slate-500 w-8"></th>
                          <th className="px-4 py-3 text-[11px] font-bold text-slate-500">الصنف</th>
                          <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية الأصلية</th>
                          <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">المُرتجع سابقاً</th>
                          <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية للإرجاع</th>
                          <th className="px-3 py-3 text-[11px] font-bold text-slate-500 text-center">الكمية بعد الإرجاع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceLines.map((l, idx) => {
                          const afterReturn = l.original_qty - l.already_returned - (l.checked ? l.qty_to_return : 0);
                          return (
                            <tr key={l.invoice_line_id} className={`border-b border-slate-100 transition-colors animate-slide-up ${l.checked ? "bg-emerald-50/50" : "hover:bg-slate-50"}`} style={{ animationDelay: `${idx * 50}ms` }}>
                              <td className="px-3 py-3 text-center">
                                <input type="checkbox" checked={l.checked} onChange={() => !isLocked && toggleInvoiceLine(l.invoice_line_id)} disabled={isLocked}
                                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed" />
                              </td>
                              <td className="px-4 py-3 text-[13px] font-bold text-slate-800">{l.item_name}</td>
                              <td className="px-3 py-3 text-center text-[13px] text-slate-600">{l.original_qty}</td>
                              <td className="px-3 py-3 text-center text-[13px] text-slate-500">{l.already_returned || "—"}</td>
                              <td className="px-3 py-3 text-center">
                                <input type="number" min="0" max={l.original_qty - l.already_returned} value={l.qty_to_return}
                                  onChange={e => setInvoiceLineQty(l.invoice_line_id, e.target.value)}
                                  disabled={!l.checked || isLocked}
                                  className="w-16 rounded-sm border border-slate-200 px-2 py-1 text-center text-[13px] font-black text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                              </td>
                              <td className={`px-3 py-3 text-center text-[13px] font-bold ${afterReturn < 0 ? "text-rose-600" : "text-slate-700"}`}>{afterReturn}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {invoiceLines.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                        <AlertCircle className="h-8 w-8 opacity-30" />
                        <div className="text-[13px]">لا توجد أصناف قابلة للإرجاع في هذه الفاتورة</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

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
      <CustomerCreateModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setCustomer({ id: c.id, name: c.name }); setCustomerCreateOpen(false); }} />
      <SalesReturnTodayModal open={todayReturnsOpen} onClose={() => setTodayReturnsOpen(false)} />
      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="sales_return"
        invoice={{
          invoice_no: docNo,
          created_at: invoiceCreatedAt || new Date().toISOString(),
          customer_name: customer?.name,
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
    </div>
  );
}
