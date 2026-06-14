import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, ArrowRight, ArrowLeft, CheckCircle2, Package, RotateCcw,
  User, Calendar, X, AlertCircle, ChevronLeft, Filter, SlidersHorizontal,
  Eye, Hash, Tag, ArrowUpDown, ChevronDown, ChevronUp, Clock,
  Banknote, FileText,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";

const REASONS_SALES = [
  { value: "changed_mind", label: "غيّر رأيه" },
  { value: "defective", label: "عيب في المنتج" },
  { value: "wrong_item", label: "صنف خاطئ" },
  { value: "damaged", label: "تالف" },
  { value: "other", label: "أخرى" },
];
const REASONS_PURCHASE = [
  { value: "defective", label: "تلف / عيب" },
  { value: "wrong_qty", label: "كمية خاطئة" },
  { value: "supplier_error", label: "خطأ من المورد" },
  { value: "wrong_item", label: "صنف خاطئ" },
  { value: "other", label: "أخرى" },
];
const REFUND_METHODS = [
  { value: "cash_back", label: "نقدي" },
  { value: "credit_note", label: "رصيد للعميل" },
];
const PURCHASE_SETTLEMENTS = [
  { value: "account", label: "خصم من حساب المورد" },
  { value: "cash", label: "استرداد نقدي من المورد" },
];

function fmt(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-5">
      {[1, 2, 3].map(n => (
        <div key={n} className={`flex items-center justify-center rounded-full font-black text-[11px] transition-all duration-300 ${
          step === n ? "h-8 w-8 bg-primary text-white shadow-lg scale-110" :
          step > n  ? "h-6 w-6 bg-emerald-500 text-white" :
                      "h-6 w-6 bg-slate-100 text-slate-400"
        }`}>
          {step > n ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
        </div>
      ))}
    </div>
  );
}

// ─── Doc Preview Panel ───────────────────────────────────────────────────────
function DocPreview({ doc, isSales, onClose, onSelect }) {
  const lines = doc._lines || [];
  return (
    <div className="absolute inset-0 z-10 bg-white flex flex-col rounded-xl">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="flex flex-col">
          <span className="text-sm font-black text-slate-800">
            {isSales ? (doc.invoice_no || `#${doc.id}`) : `PUR-${String(doc.id).padStart(5,"0")}`}
          </span>
          <span className="text-[11px] text-slate-400 font-bold">
            {isSales ? (doc.customer_name || "عميل نقدي") : (doc.supplier_name || "—")}
            {" · "}{fmtDate(doc.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelect}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-2sm font-black text-white hover:bg-primary-600"
          >
            إنشاء مرتجع <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <p className="text-center text-2sm text-slate-400 py-8">لا توجد أصناف</p>
        ) : (
          <table className="w-full text-right">
            <thead>
              <tr className="text-[11px] font-black text-slate-500 uppercase border-b border-slate-100">
                <th className="pb-2">الصنف</th>
                <th className="pb-2 text-center">الكمية</th>
                <th className="pb-2 text-center">المتاح</th>
                <th className="pb-2 text-left">السعر</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 text-2sm font-bold text-slate-800">{l.item_name}</td>
                  <td className="py-2 text-2sm font-black text-slate-600 text-center">{l.quantity}</td>
                  <td className="py-2 text-center">
                    <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-sm ${
                      (l.returnable_quantity ?? l.quantity) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}>
                      {l.returnable_quantity ?? l.quantity}
                    </span>
                  </td>
                  <td className="py-2 text-2sm font-black text-slate-700 text-left">
                    {fmt(l.unit_price ?? l.unit_cost)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 rounded-b-xl flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500">إجمالي الفاتورة</span>
        <span className="text-[16px] font-black text-slate-800">{fmt(doc.total)} ج.م</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function QuickReturnModal({ mode = "sales", open, onClose, onSuccess, initialDocId }) {
  const isSales = mode === "sales";
  const reasons = isSales ? REASONS_SALES : REASONS_PURCHASE;

  const [step, setStep] = useState(1);

  // Search filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyId, setPartyId] = useState(""); // supplier_id or customer_id
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("date_desc"); // date_desc | date_asc | total_desc | total_asc
  const [parties, setParties] = useState([]);
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState("");

  // Results
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null); // doc with _lines loaded
  const [previewLoading, setPreviewLoading] = useState(null); // docId being loaded

  // Selected doc & lines
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [selected, setSelected] = useState({});

  // Step 3
  const [reason, setReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [purchaseSettlement, setPurchaseSettlement] = useState("account");
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 350);
  const debouncedProduct = useDebounce(productSearch, 400);
  const searchRef = useRef(null);

  // Load parties
  useEffect(() => {
    if (!open) return;
    const url = isSales ? "/api/customers" : "/api/suppliers";
    api.get(url).then(r => setParties(r.data.data || [])).catch(() => {});
    if (!isSales) {
      api.get("/api/treasuries").then(r => {
        const rows = r.data.data || [];
        setTreasuries(rows);
        if (rows.length) setSelectedTreasury(String(rows[0].id));
      }).catch(() => {});
    }
  }, [open, isSales]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(initialDocId ? 2 : 1);
      setSearchTerm("");
      setProductSearch("");
      setDateFrom("");
      setDateTo("");
      setPartyId("");
      setShowFilters(false);
      setSortBy("date_desc");
      setSearchResults([]);
      setSelectedDoc(null);
      setSelected({});
      setReason("");
      setReturnNotes("");
      setRefundMethod("cash_back");
      setPurchaseSettlement("account");
      setPreviewDoc(null);
      if (initialDocId) loadDoc(initialDocId);
    }
  }, [open, initialDocId]);

  // Auto-focus
  useEffect(() => {
    if (open && step === 1) setTimeout(() => searchRef.current?.focus(), 100);
  }, [open, step]);

  // Trigger search whenever any filter changes
  useEffect(() => {
    if (step !== 1) return;
    if (!debouncedSearch && !debouncedProduct && !dateFrom && !dateTo && !partyId) {
      setSearchResults([]);
      return;
    }
    doSearch();
  }, [debouncedSearch, debouncedProduct, dateFrom, dateTo, partyId, step]);

  async function doSearch() {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (productSearch.trim()) params.set("item_search", productSearch.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (partyId) {
        if (isSales) params.set("customer_id", partyId);
        else params.set("supplier_id", partyId);
      }
      const url = isSales
        ? `/api/invoices?${params.toString()}`
        : `/api/purchases?${params.toString()}`;
      const res = await api.get(url);
      setSearchResults(res.data.data || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  const sortedResults = [...searchResults].sort((a, b) => {
    if (sortBy === "date_desc") return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "date_asc") return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === "total_desc") return Number(b.total) - Number(a.total);
    if (sortBy === "total_asc") return Number(a.total) - Number(b.total);
    return 0;
  });

  async function handlePreview(doc, e) {
    e.stopPropagation();
    if (previewLoading) return;
    setPreviewLoading(doc.id);
    try {
      const url = isSales ? `/api/invoices/${doc.id}` : `/api/purchases/${doc.id}`;
      const res = await api.get(url);
      const full = res.data.data;
      setPreviewDoc({ ...doc, _lines: full.lines || [] });
    } catch {
      toast.error("فشل تحميل تفاصيل الفاتورة");
    }
    setPreviewLoading(null);
  }

  async function loadDoc(id) {
    setDocLoading(true);
    try {
      const url = isSales ? `/api/invoices/${id}` : `/api/purchases/${id}`;
      const res = await api.get(url);
      setSelectedDoc(res.data.data);
      setStep(2);
    } catch {
      toast.error("فشل تحميل بيانات الفاتورة");
    }
    setDocLoading(false);
  }

  function toggleLine(line) {
    setSelected(prev => {
      if (prev[line.id]) { const next = { ...prev }; delete next[line.id]; return next; }
      return { ...prev, [line.id]: { quantity: 1, line } };
    });
  }

  function setQty(lineId, qty) {
    setSelected(prev => {
      if (!prev[lineId]) return prev;
      return { ...prev, [lineId]: { ...prev[lineId], quantity: qty } };
    });
  }

  const returnableLines = (selectedDoc?.lines || []).filter(l => (l.returnable_quantity ?? l.quantity) > 0);
  const selectedLines = Object.values(selected);
  const returnTotal = selectedLines.reduce((acc, { quantity, line }) => acc + quantity * (line.unit_price ?? line.unit_cost ?? 0), 0);

  async function handleSubmit() {
    if (selectedLines.length === 0) { toast.error("اختر صنفاً واحداً على الأقل"); return; }
    setSubmitting(true);
    try {
      const docId = selectedDoc.id;
      const body = isSales
        ? { reason, notes: returnNotes || null, refund_method: refundMethod, lines: selectedLines.map(({ quantity, line }) => ({ invoice_line_id: line.id, quantity })) }
        : {
            reason,
            notes: returnNotes || null,
            settlement_type: purchaseSettlement,
            treasury_id: purchaseSettlement === "cash" ? Number(selectedTreasury || 1) : null,
            lines: selectedLines.map(({ quantity, line }) => ({ purchase_line_id: line.id, quantity })),
          };
      const url = isSales ? `/api/invoices/${docId}/return` : `/api/purchases/${docId}/return`;
      await api.post(url, body);
      toast.success("تم إنشاء المرتجع بنجاح");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء إنشاء المرتجع");
    }
    setSubmitting(false);
  }

  const hasFilters = productSearch || dateFrom || dateTo || partyId;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <RotateCcw className={`h-4 w-4 ${isSales ? "text-blue-600" : "text-amber-600"}`} />
            <h2 className="text-[15px] font-black text-slate-800">
              {isSales ? "إنشاء مرتجع مبيعات" : "إنشاء مرتجع مشتريات"}
            </h2>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-6 pt-4 pb-2">
            <StepDots step={step} />
          </div>

          {/* ── Step 1: Search ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="px-6 pb-6 space-y-3 relative">
              {/* Preview overlay */}
              {previewDoc && (
                <DocPreview
                  doc={previewDoc}
                  isSales={isSales}
                  onClose={() => setPreviewDoc(null)}
                  onSelect={() => { setPreviewDoc(null); loadDoc(previewDoc.id); }}
                />
              )}

              {/* Main search row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 -translate-y-1/2 right-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={isSales ? "رقم الفاتورة، اسم العميل..." : "رقم الفاتورة، اسم المورد..."}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 py-2.5 text-sm font-bold text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-2sm font-bold transition-all ${
                    showFilters || hasFilters
                      ? "border-slate-700 bg-primary text-white"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {hasFilters ? "فلاتر نشطة" : "فلاتر"}
                </button>
              </div>

              {/* Filter panel */}
              {showFilters && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                  {/* Product search */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Tag className="h-3 w-3" /> بحث بالصنف
                    </label>
                    <div className="relative">
                      <Package className="absolute top-1/2 -translate-y-1/2 right-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="اسم صنف أو باركود..."
                        className="w-full rounded-md border border-slate-200 bg-white pr-8 pl-3 py-2 text-2sm font-bold text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                    {productSearch && <p className="text-[11px] text-slate-400">سيعرض الفواتير التي تحتوي هذا الصنف</p>}
                  </div>

                  {/* Party filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <User className="h-3 w-3" /> {isSales ? "العميل" : "المورد"}
                    </label>
                    <select
                      value={partyId}
                      onChange={e => setPartyId(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-2sm font-bold text-slate-700 focus:border-slate-400 focus:outline-none appearance-none"
                    >
                      <option value="">— الكل —</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> من
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-2sm font-bold text-slate-700 focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> إلى
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-2sm font-bold text-slate-700 focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick period buttons */}
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: "اليوم", days: 0 },
                      { label: "7 أيام", days: 7 },
                      { label: "30 يوم", days: 30 },
                      { label: "هذا الشهر", month: true },
                    ].map(p => (
                      <button
                        key={p.label}
                        onClick={() => {
                          const today = new Date();
                          const to = today.toISOString().split("T")[0];
                          let from;
                          if (p.month) {
                            from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
                          } else if (p.days === 0) {
                            from = to;
                          } else {
                            const d = new Date(today); d.setDate(d.getDate() - p.days);
                            from = d.toISOString().split("T")[0];
                          }
                          setDateFrom(from); setDateTo(to);
                        }}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={() => { setDateFrom(""); setDateTo(""); }}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100"
                      >
                        مسح التاريخ
                      </button>
                    )}
                  </div>

                  {/* Clear all */}
                  {hasFilters && (
                    <button
                      onClick={() => { setProductSearch(""); setDateFrom(""); setDateTo(""); setPartyId(""); }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-700"
                    >
                      مسح جميع الفلاتر
                    </button>
                  )}
                </div>
              )}

              {/* Sort + count row */}
              {sortedResults.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">{sortedResults.length} نتيجة</span>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="text-[11px] font-bold text-slate-600 bg-transparent border-none outline-none cursor-pointer"
                    >
                      <option value="date_desc">الأحدث أولاً</option>
                      <option value="date_asc">الأقدم أولاً</option>
                      <option value="total_desc">الأعلى قيمة</option>
                      <option value="total_asc">الأقل قيمة</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Loading */}
              {searching && (
                <p className="text-center text-2sm text-slate-400 animate-pulse py-4">جاري البحث...</p>
              )}

              {/* Empty state */}
              {!searching && (searchTerm || hasFilters) && searchResults.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <AlertCircle className="h-8 w-8 opacity-40" />
                  <p className="text-2sm font-bold">لا توجد نتائج مطابقة</p>
                  <p className="text-[11px] text-slate-300">جرب تغيير الفلاتر أو توسيع نطاق البحث</p>
                </div>
              )}

              {/* No search yet */}
              {!searching && !searchTerm && !hasFilters && (
                <p className="text-center text-[11px] text-slate-300 font-bold py-8">
                  ابدأ الكتابة أو استخدم الفلاتر للبحث
                </p>
              )}

              {/* Results list */}
              {sortedResults.length > 0 && (
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
                  {sortedResults.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 hover:bg-slate-50 transition-all group"
                    >
                      <button
                        className="flex-1 flex flex-col gap-0.5 text-right min-w-0"
                        onClick={() => loadDoc(doc.id)}
                        disabled={docLoading}
                      >
                        <span className="text-sm font-black text-slate-800 group-hover:text-slate-900">
                          {isSales ? (doc.invoice_no || `#${doc.id}`) : `PUR-${String(doc.id).padStart(5,"0")}`}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          {isSales ? (doc.customer_name || "عميل نقدي") : (doc.supplier_name || "—")}
                          <span className="mx-0.5">·</span>
                          <Clock className="h-3 w-3 shrink-0" />
                          {fmtDate(doc.created_at)}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0 mr-3">
                        <span className="text-sm font-black text-slate-700">{fmt(doc.total)} ج.م</span>

                        {/* Fast preview button */}
                        <button
                          onClick={(e) => handlePreview(doc, e)}
                          disabled={previewLoading === doc.id}
                          title="معاينة سريعة"
                          className={`flex items-center justify-center h-7 w-7 rounded-md border transition-all ${
                            previewLoading === doc.id
                              ? "border-slate-200 animate-pulse"
                              : "border-slate-200 text-slate-400 hover:border-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => loadDoc(doc.id)}
                          disabled={docLoading}
                          title="إنشاء مرتجع"
                          className="flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 text-slate-400 hover:border-slate-700 hover:bg-primary-600 hover:text-white transition-all"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Pick Lines ─────────────────────────────────────────── */}
          {step === 2 && selectedDoc && (
            <div className="px-6 pb-4 space-y-4">
              {/* Doc summary bar */}
              <div className={`rounded-lg p-3 flex items-center gap-3 ${isSales ? "bg-blue-50 border border-blue-100" : "bg-amber-50 border border-amber-100"}`}>
                <User className={`h-4 w-4 shrink-0 ${isSales ? "text-blue-500" : "text-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">
                    {isSales ? (selectedDoc.customer_name || "عميل نقدي") : (selectedDoc.supplier_name || `مورد #${selectedDoc.supplier_id}`)}
                  </p>
                  <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(selectedDoc.created_at)}
                    <span className="mx-1">·</span>
                    {isSales ? selectedDoc.invoice_no : `PUR-${String(selectedDoc.id).padStart(5,"0")}`}
                    <span className="mx-1">·</span>
                    {fmt(selectedDoc.total)} ج.م
                  </p>
                </div>
                {!initialDocId && (
                  <button onClick={() => { setStep(1); setSelectedDoc(null); setSelected({}); }} className="text-[11px] font-black text-slate-400 hover:text-slate-700 shrink-0">
                    تغيير
                  </button>
                )}
              </div>

              <p className="text-2sm font-bold text-slate-500">اختر الأصناف التي تريد إرجاعها:</p>

              {returnableLines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <Package className="h-8 w-8 opacity-40" />
                  <p className="text-2sm font-bold">جميع الأصناف تم إرجاعها مسبقاً</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {returnableLines.map(line => {
                    const maxQty = line.returnable_quantity ?? line.quantity;
                    const isChecked = !!selected[line.id];
                    return (
                      <div
                        key={line.id}
                        onClick={() => toggleLine(line)}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                          isChecked ? "border-slate-700 bg-primary text-white" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${isChecked ? "border-white bg-white" : "border-slate-300"}`}>
                            {isChecked && <div className="h-2 w-2 rounded-sm bg-slate-800" />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-black truncate ${isChecked ? "text-white" : "text-slate-800"}`}>{line.item_name}</p>
                            <p className={`text-[11px] font-bold ${isChecked ? "text-slate-300" : "text-slate-400"}`}>
                              المتاح للإرجاع: {maxQty} · {fmt(line.unit_price ?? line.unit_cost)} ج.م
                            </p>
                          </div>
                        </div>
                        {isChecked && (
                          <input
                            type="number" min={1} max={maxQty}
                            value={selected[line.id]?.quantity || 1}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setQty(line.id, Math.min(maxQty, Math.max(1, Number(e.target.value))))}
                            className="w-16 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-center text-sm font-black text-white focus:outline-none focus:ring-1 focus:ring-white/40"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedLines.length > 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">إجمالي المرتجع المحدد</span>
                  <span className="text-sm font-black text-slate-800">{fmt(returnTotal)} ج.م</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Confirm ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="px-6 pb-4 space-y-4">
              <p className="text-2sm font-bold text-slate-400 text-center">مراجعة وتأكيد المرتجع</p>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">الأصناف المرتجعة</span>
                </div>
                {selectedLines.map(({ quantity, line }) => (
                  <div key={line.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                    <span className="text-sm font-bold text-slate-700">{line.item_name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-2sm text-slate-400 font-bold">× {quantity}</span>
                      <span className="text-sm font-black text-slate-800">{fmt(quantity * (line.unit_price ?? line.unit_cost ?? 0))} ج.م</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-slate-800 px-4 py-3">
                  <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">إجمالي المرتجع</span>
                  <span className="text-[16px] font-black text-white">{fmt(returnTotal)} ج.م</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">سبب المرتجع</label>
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 focus:border-slate-400 focus:outline-none"
                  >
                    <option value="">اختر السبب (اختياري)</option>
                    {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {isSales && (
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">طريقة الاسترداد</label>
                    <div className="grid grid-cols-2 gap-2">
                      {REFUND_METHODS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => setRefundMethod(m.value)}
                          className={`rounded-lg border px-4 py-2.5 text-sm font-black transition-all ${
                            refundMethod === m.value
                              ? "border-slate-700 bg-primary text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!isSales && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">كيف سيتم تسوية المرتجع؟</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PURCHASE_SETTLEMENTS.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setPurchaseSettlement(m.value)}
                            className={`rounded-lg border px-3 py-2.5 text-2sm font-black transition-all ${
                              purchaseSettlement === m.value
                                ? "border-slate-700 bg-primary text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {purchaseSettlement === "cash" && (
                      <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">الخزنة</label>
                        <select
                          value={selectedTreasury}
                          onChange={(e) => setSelectedTreasury(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:outline-none"
                        >
                          {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">ملاحظات (اختياري)</label>
                  <textarea
                    rows={2}
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    placeholder="ملاحظة على المرتجع…"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {step === 1 && (
            <button onClick={onClose} className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-black text-slate-500 hover:bg-slate-100 transition-colors">
              إلغاء
            </button>
          )}
          {step === 2 && (
            <div className="flex gap-3">
              {!initialDocId && (
                <button onClick={() => { setStep(1); setSelectedDoc(null); setSelected({}); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-500 hover:bg-slate-100">
                  <ArrowRight className="h-4 w-4" /> رجوع
                </button>
              )}
              <button
                onClick={() => setStep(3)}
                disabled={selectedLines.length === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-black text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                التالي <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-500 hover:bg-slate-100">
                <ArrowRight className="h-4 w-4" /> رجوع
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex-1 rounded-lg py-2.5 text-sm font-black text-white transition-all disabled:opacity-60 ${
                  isSales ? "bg-blue-700 hover:bg-blue-600" : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {submitting ? "جاري الإنشاء..." : "تأكيد وإنشاء المرتجع"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
