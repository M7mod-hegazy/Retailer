import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle, Banknote, Building2, Calendar, ChevronDown, CreditCard,
  FilePlus, Filter, Image as ImageIcon, Layers, List, LayoutGrid,
  ListTodo, Loader2, Minus, PackageCheck, PauseCircle, Plus, Printer,
  Receipt, RefreshCw, RotateCcw, Search, ShieldCheck, ShoppingCart,
  Sparkles, Trash2, Pencil, User, Wallet, X, TrendingUp, ExternalLink, FileText,
  Wand2, Settings2, Copy,
} from "lucide-react";
import BarcodeListener from "../../components/pos/BarcodeListener";
import PosStickyTotalBar from "../../components/pos/PosStickyTotalBar";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import Modal from "../../components/ui/Modal";
import PermissionGate from "../../components/ui/PermissionGate";
import DataGrid from "../../components/ui/DataGrid";
import PanelEdgeRail from "./parts/PanelEdgeRail";
import InstallmentPlanner from "../../components/pos/InstallmentPlanner";
import HeldDropdown from "./parts/HeldDropdown";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import GalleryModal from "./parts/GalleryModal";
import POSTodayModal from "../../components/pos/POSTodayModal";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import InvoiceProfitModal from "../../components/pos/InvoiceProfitModal";
import AdvancedSearchModal from "../../components/pos/AdvancedSearchModal";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import QuickAddLeadPopover from "./QuickAddLeadPopover";
import CustomerInfoModal from "../../components/modals/CustomerInfoModal";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";
import SortTh from "./parts/SortTh";
import { resolveImageUrl, formatMoney } from "./posPageUtils";
import { formatNumber } from "../../utils/currency";
import { cartLineKey } from "../../stores/posStore";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useGridNavigation } from "../../hooks/useGridNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";

export default function POSDetailedView({ vm }) {
  const {
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
    isOffline, copyConnectionError, user,
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
    amountPaid, setAmountPaid,
    amountReceived, setAmountReceived,
    installmentStartDate, setInstallmentStartDate,
    installmentCount, setInstallmentCount,
    installmentFrequency, setInstallmentFrequency,
    installmentCustomDays, setInstallmentCustomDays,
    installmentRows, handleInstallmentRowChange,
    installmentRemaining, installmentAllocated, installmentBalanced,
    multiCash, setMultiCash,
    multiVisa, setMultiVisa, visaMethod,
    multiCredit, setMultiCredit,
    customPayMethods, multiCustomAmounts, setMultiCustomAmounts,
    customerQuery, setCustomerQuery,
    customerLookupOpen, setCustomerLookupOpen,
    activeCustomerIndex,
    customerResults, handlePickCustomer, handleCustomerKeyDown,
    setActiveCustomerIndex,
    customers, setCustomers,
    items, units,
    panelEffectiveCollapsed, panelWidth,
    expandPanel, togglePanel, startPanelResize,
    handleHold,
    selectedItem, staging, setStaging,
    itemNameQuery, setItemNameQuery,
    totals,
    getLineMaxStock,
    PAYMENT_TYPES,
    WAIT_ICON,
    banks,
    isSaving,
    saveInvoice,
    invoiceSeq, setInvoiceSeq,
    resetPaymentFields, resetStaging, resetCustomer,
    detailedSearchOpen, setDetailedSearchOpen,
    detailedSearchQuery, setDetailedSearchQuery,
    detailedCategoryFilter, setDetailedCategoryFilter,
    detailedSortConfig, setDetailedSortConfig,
    detailedColWidths, setDetailedColWidths, onDetailedResizeStart, toggleDetailedSort,
    activeMultiPayments, setActiveMultiPayments,
    multiModalOpen, setMultiModalOpen,
    waLeadPhone, setWaLeadPhone,
    lastSavedInvoice, setLastSavedInvoice,
    detailedItemResults, detailedCategories,
    getItemImage, handleGridItemClick, handleSelectItem,
    multiTotal, paymentMethods,
    multiUnitEnabled, setConfigLine,
    customerInputRef,
    discountModes, setDiscountModes,
    stockLevels, stockLoaded,
    warehouses, getFilteredWarehouses,
  } = vm;

  const gridNavRef = useRef(null);

  const [gridDisplayMode, setGridDisplayMode] = useState(() => {
    try { return localStorage.getItem("retailer.pos.gridDisplayMode") || "cards"; } catch { return "cards"; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.pos.gridDisplayMode", gridDisplayMode); } catch {}
  }, [gridDisplayMode]);

  const ALL_COLUMNS = ["image","code","name","price","stock","actions"];
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("retailer.posDetailed.visibleColumns");
      return saved ? JSON.parse(saved) : ALL_COLUMNS;
    } catch { return ALL_COLUMNS; }
  });
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) {
        setColSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFieldNav = useFieldNavigation();
  const discountRef = useRef(null);
  const increaseRef = useRef(null);
  const taxRateRef = useRef(null);
  const notesRef = useRef(null);
  const sellerRef = useRef(null);
  const waLeadRef = useRef(null);
  const multiCashRef = useRef(null);
  const multiVisaRef = useRef(null);
  const multiCreditRef = useRef(null);

  const detailedSearchRef = useRef(null);
  const { focusLastRowQty } = useGridNavigation(gridNavRef, { qtyCol: "quantity", entryRef: detailedSearchRef });
  useShortcut("grid.editLast", () => focusLastRowQty());
  useEffect(() => { setTimeout(() => detailedSearchRef.current?.focus(), 300); }, []);
  const [flashAdd, setFlashAdd] = useState(false);
  useEffect(() => {
    if (lines.length > 0) {
      setFlashAdd(true); setTimeout(() => detailedSearchRef.current?.focus(), 100);
      const t = setTimeout(() => setFlashAdd(false), 600);
      return () => clearTimeout(t);
    }
  }, [lines.length]);

  const [frequentItems, setFrequentItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer.pos.frequentItems") || "[]"); } catch { return []; }
  });

  const trackItemAdd = useCallback((item) => {
    setFrequentItems(prev => {
      const next = [{ id: item.id, name: item.name, code: item.code || item.item_code || "", ts: Date.now() }, ...prev.filter(f => f.id !== item.id)].slice(0, 20);
      try { localStorage.setItem("retailer.pos.frequentItems", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleQuickAdd = useCallback((item, qty) => {
    const wh = warehouses.find((w) => (stockLevels[item.id]?.[w.id] || 0) > 0) || (warehouses.length ? warehouses[0] : { id: "default", name: "المخزن الرئيسي" });
    const stockVal = Number(stockLevels[item.id]?.[wh.id] ?? item.stock_quantity ?? item.stock ?? 0);
    const price = Number(item.sale_price || item.price || 0);
    if (price <= 0) return;
    addLine({
      id: item.id, name: item.name, code: item.code || item.item_code || "", barcode: item.barcode || "",
      sale_price: price, category_name: item.category_name || "غير مصنف",
      warehouse_id: wh.id, warehouse_name: wh.name, stock_quantity: stockVal,
      unit_id: item.unit_id || item.unit?.id || null, unit_name: item.unit_name || "قطعة",
      primary_image_url: getItemImage(item) || null, quantity: qty, line_discount: 0,
    });
    trackItemAdd(item);
  }, [addLine, warehouses, stockLevels, getItemImage, trackItemAdd]);

  const handleGridClickTracked = useCallback((item) => {
    handleGridItemClick(item);
    trackItemAdd(item);
  }, [handleGridItemClick, trackItemAdd]);

  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)] font-sans overflow-hidden" dir="rtl">
      <BarcodeListener />
      <PosStickyTotalBar
        total={totals.total}
        subtotal={totals.subtotal}
        activeTaxRate={taxCalc.taxAmount > 0 ? (taxRate != null ? Number(taxRate) : Number(storeSettings?.tax_rate || 0)) : 0}
        hasNotes={Boolean(invoiceNotes && invoiceNotes.trim())}
        discount={discount}
        increase={increase}
        discountMode={invoiceDiscountMode}
        onDiscountModeChange={setInvoiceDiscountMode}
        increaseMode={invoiceIncreaseMode}
        onIncreaseModeChange={setInvoiceIncreaseMode}
        itemCount={lines.length}
        quantityCount={lines.reduce((acc, l) => acc + Number(l.quantity || 0), 0)}
        customerName={customer?.name}
        customerId={customer?.id}
        customerBalance={displayBalance}
        displayBalance={displayBalance}
        paymentType={paymentType}
        paymentTypes={PAYMENT_TYPES}
        hasErrors={hasBlockingErrors && !stockOnlyErrors}
        errorCount={blockingErrorCount}
        disabled={!lines.length || isSaving || (hasBlockingErrors && !stockOnlyErrors)}
        isSaving={isSaving}
        canHold={lines.length > 0}
        onDiscountChange={(v) => setDiscount(Math.min(Math.max(0, Number(v || 0)), totals.subtotal))}
        onIncreaseChange={(v) => setIncrease(Math.max(0, Number(v || 0)))}
        onPaymentChange={setPaymentType}
        onHold={handleHold}
        onPrint={() => setPrintPreview(true)}
        onSave={() => saveInvoice(false)}
        onSaveOnly={() => setSaveConfirmOpen(true)}
        onCancel={() => setCancelModalOpen(true)}
        onExpand={expandPanel}
        onNewInvoice={() => setNewInvoiceModalOpen(true)}
        onCustomerLookup={() => setCustomerLookupOpen(true)}
        onCustomerCreate={() => setCustomerCreateOpen(true)}
        onCustomerClear={() => { setCustomer(null); setCustomerQuery(""); setPaymentType("cash"); }}
        onCustomerInfo={() => setCustomerInfoOpen(true)}

        amountReceived={amountReceived}
        onAmountReceivedChange={setAmountReceived}
        amountPaid={amountPaid}
        onAmountPaidChange={setAmountPaid}
        multiCash={multiCash}
        onMultiCashChange={setMultiCash}
        multiVisa={multiVisa}
        onMultiVisaChange={setMultiVisa}
        visaMethod={visaMethod}
        multiCredit={multiCredit}
        onMultiCreditChange={setMultiCredit}
        heldInvoices={heldInvoices}
        heldDropdownOpen={heldDropdownOpen}
        onHeldToggle={() => setHeldDropdownOpen((v) => !v)}
        onResumeHeld={(id) => { if (lines.length) holdCurrentInvoice(); resumeHeldInvoice(id); setHeldDropdownOpen(false); }}
        onDiscardHeld={discardHeldInvoice}
        onCloseHeld={() => setHeldDropdownOpen(false)}
        customerQuery={customerQuery}
        onCustomerQueryChange={setCustomerQuery}
        customerLookupOpen={customerLookupOpen}
        onCustomerLookupOpenChange={setCustomerLookupOpen}
        activeCustomerIndex={activeCustomerIndex}
        customerResults={customerResults}
        onCustomerPick={handlePickCustomer}
        onCustomerKeyDown={handleCustomerKeyDown}
        customPayMethods={customPayMethods}
        multiCustomAmounts={multiCustomAmounts}
        onMultiCustomAmountChange={(id, value) => setMultiCustomAmounts(prev => ({...prev, [id]: value}))}
        forceShow={panelEffectiveCollapsed}
      />
      {staleHeldAlert && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center" dir="rtl">
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="text-[16px] font-black text-slate-800 mb-1">فواتير معلقة قديمة</h3>
            <p className="text-sm text-slate-500 mb-4">لديك فواتير معلقة منذ فترة طويلة. يرجى مراجعتها.</p>
            <button onClick={() => setStaleHeldAlert(false)} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold">
              حسناً
            </button>
          </div>
        </div>
      )}
      {isOffline && (
        <div className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-2sm font-black tracking-wide text-white shrink-0 z-50">
          <AlertTriangle className="h-3.5 w-3.5" />
          تعذّر الاتصال بالخادم المحلي — بعض العمليات قد لا تعمل حتى يعود الاتصال
          <button
            type="button"
            onClick={copyConnectionError}
            className="ms-2 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-2xs font-bold hover:bg-white/30 active:scale-95"
            title="نسخ تفاصيل الخطأ"
          >
            <Copy className="h-3 w-3" />
            نسخ التفاصيل
          </button>
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
                return formatNumber(sub - disc + inc);
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

      {/* Quotation convert banner */}
      {quotationContext && showQuotationSummary && (
        <div className="shrink-0 bg-violet-50 border-b border-violet-200 px-4 py-2.5 z-20" dir="rtl">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
              <FileText className="h-4 w-4 text-violet-600" />
              <span className="text-2sm font-black text-violet-800">من عرض سعر</span>
              <span className="rounded-sm bg-violet-600 px-1.5 py-0.5 text-[10px] font-black text-white font-mono">
                {quotationContext.prefill?.quotation_no || `#${quotationContext.from_quotation_id}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 flex-1 text-[11px] font-bold text-violet-700">
              {quotationContext.prefill?.customer_name && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {quotationContext.prefill.customer_name}</span>
              )}
              <span>{(quotationContext.prefill?.lines || []).length} صنف</span>
              {quotationContext.prefill?.payment_type && (
                <span>{{ cash: "نقدي", credit: "آجل", bank_transfer: "بنك/فيزا", installments: "أقساط", multi: "متعدد" }[quotationContext.prefill.payment_type] || quotationContext.prefill.payment_type}</span>
              )}
              {quotationContext.prefill?.quotation_expires_at && (
                <span>صلاحية: {new Date(quotationContext.prefill.quotation_expires_at).toLocaleDateString("ar-EG-u-nu-latn")}</span>
              )}
              <span className="text-violet-500">راجع الأصناف والأسعار ثم أكّد البيع</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setQuotationContext(null); clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); }}
                className="flex items-center gap-1.5 rounded-md bg-white border border-violet-300 px-3 py-1 text-[11px] font-black text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> فاتورة جديدة
              </button>
              <button onClick={() => setShowQuotationSummary(false)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-violet-100 text-violet-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className="flex min-h-0 flex-1 transition-all flex-row relative"
        style={{ paddingBottom: "var(--pos-bottom-bar-h, 0px)" }}
      >
        {/* ── Left Column: Grid & Search (~65%) ── */}
        <div className="flex flex-col flex-[1.4] bg-[var(--bg-base)] border-l border-slate-100 overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-3 shrink-0 bg-white border-b border-slate-100 p-4 shadow-[0_1px_10px_-5px_rgba(0,0,0,0.07)] z-10">
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <input
                readOnly
                disabled
                value={invoiceIsActive ? (docNo || invoiceNumber) : "—"}
                className="w-full max-w-[140px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-2sm font-mono font-black text-slate-600 cursor-default text-center select-none disabled:opacity-70"
              />
              {invoiceIsActive && invoiceCreatedAt && (
                <input readOnly disabled
                  value={new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" }).format(new Date(invoiceCreatedAt))}
                  className="w-full max-w-[120px] rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono font-bold text-slate-400 cursor-default text-center select-none disabled:opacity-70"
                />
              )}
              {storeSettings.branch_name && (
                <div className="flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1">
                  <Building2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-700 max-w-[100px] truncate">{storeSettings.branch_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1">
                <User className="h-3 w-3 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500 max-w-[90px] truncate">{user?.name || "-"}</span>
              </div>
              <select
                ref={sellerRef}
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                onKeyDown={(e) => handleFieldNav(e, { nextRef: waLeadRef })}
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
                <SearchInput ref={detailedSearchRef}
                  value={detailedSearchQuery}
                  onChange={(val) => setDetailedSearchQuery(val)}
                  placeholder="ابحث بالاسم، الكود، الباركود (عربي/إنجليزي)..."
                  className="w-full text-sm py-2"
                  autoFocus
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
              <div className="w-px h-6 bg-slate-200 shrink-0" />
              <div className="flex shrink-0 bg-white rounded-lg p-0.5 border border-indigo-200 shadow-sm">
                <button
                  onClick={() => setGridDisplayMode("cards")}
                  className={`p-1 rounded-md transition-all ${gridDisplayMode === "cards" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-400 hover:text-indigo-600"}`}
                  title="البطاقات"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setGridDisplayMode("compact")}
                  className={`p-1 rounded-md transition-all ${gridDisplayMode === "compact" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-400 hover:text-indigo-600"}`}
                  title="مدمج"
                >
                  <ListTodo className="w-3.5 h-3.5" />
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
            {frequentItems.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                <span className="shrink-0 text-[10px] font-bold text-slate-400 py-1 pl-2">المتكرر:</span>
                {frequentItems.slice(0, 10).map(fi => {
                  const matched = detailedItemResults.find(d => d.id === fi.id) || items.find(i => i.id === fi.id);
                  if (!matched) return null;
                  return (
                    <button key={fi.id} onClick={() => handleGridClickTracked(matched)}
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                    >
                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80px]">{fi.name}</span>
                      <span className="text-[9px] font-mono text-slate-400">{fi.code}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Body Toggle */}
          {viewMode === "detailed" ? (
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

            {detailedItemResults.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                  <Search className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-black tracking-widest text-slate-500">لا توجد أصناف مطابقة</p>
                <p className="text-2sm font-bold text-slate-400 mt-1">جرّب تغيير كلمة البحث أو تصفح الفئات</p>
              </div>
            ) : gridDisplayMode === "compact" ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {detailedItemResults.map(item => {
                  const cq = lines.filter(l => l.item_id === item.id).reduce((s, l) => s + Number(l.quantity || 0), 0);
                  const stockVal = Number(item.stock_quantity || item.stock || 0);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleGridClickTracked(item)}
                      className="group relative flex flex-col rounded-xl border bg-white p-2.5 shadow-sm transition-all text-right overflow-hidden
                        hover:border-indigo-300 hover:shadow-[0_4px_16px_-4px_rgba(99,102,241,0.12)] hover:-translate-y-0.5
                        active:scale-[0.98]"
                    >
                      {/* Cart count badge */}
                      {cq > 0 && (
                        <span className="absolute top-1.5 left-1.5 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white shadow-md ring-2 ring-white z-10 animate-[scale-in_0.15s_ease-out]">{cq}</span>
                      )}
                      {/* Stock indicator bar */}
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl transition-all ${
                        stockVal <= 0 ? "bg-rose-400" : stockVal < 5 ? "bg-amber-400" : "bg-emerald-400/60"
                      }`} />
                      {/* Name - full, multi-line */}
                      <div className="flex flex-col w-full min-w-0 pb-2">
                        <span className="text-xs font-black text-slate-800 leading-snug block min-h-[2.4em] line-clamp-2">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono mt-0.5 truncate">{item.item_code || item.code || ""}</span>
                      </div>
                      {/* Price + Stock row */}
                      <div className="flex items-center justify-between gap-1 mt-auto pt-1.5 border-t border-slate-100">
                          <span className="number-fmt-primary text-xs text-indigo-600">{formatMoney(item.sale_price || item.price || 0)}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          stockVal <= 0 ? "bg-rose-50 text-rose-600" : stockVal < 5 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                        }`}>{stockVal}</span>
                      </div>
                      {/* Hover overlay: quick-add */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/92 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity rounded-xl z-20 border border-indigo-200 shadow-lg">
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 5, 10].map(n => (
                            <span key={n}
                              onClick={(e) => { e.stopPropagation(); handleQuickAdd(item, n); }}
                              className="cursor-pointer text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white active:scale-90 rounded-lg min-w-[30px] h-[30px] flex items-center justify-center transition-all shadow-sm border border-indigo-200 hover:border-indigo-600"
                            >{n}</span>
                          ))}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); const v = parseFloat(e.currentTarget.querySelector("input").value); if (v > 0) { handleQuickAdd(item, v); e.currentTarget.querySelector("input").value = ""; } }} className="w-[85%] max-w-[130px]">
                          <input onFocus={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") e.target.blur(); }}
                            type="number" min="1" step="any" placeholder="كمية..." dir="rtl"
                            className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 px-2 py-1.5 text-center text-xs font-black text-indigo-800 outline-none focus:border-indigo-500 focus:bg-white placeholder:text-indigo-300 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </form>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {detailedItemResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleGridClickTracked(item)}
                    className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm hover:border-indigo-200 hover:shadow-[0_8px_24px_-6px_rgba(99,102,241,0.14)] hover:-translate-y-1 transition-all text-right overflow-hidden"
                  >
                    <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                      {getItemImage(item) ? (
                        <img src={getItemImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                      {(() => {
                        const cq = lines.filter(l => l.item_id === item.id).reduce((s, l) => s + Number(l.quantity || 0), 0);
                        return cq > 0 ? (
                          <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white shadow-md ring-2 ring-white animate-[scale-in_0.15s_ease-out] z-10">
                            {cq}
                          </span>
                        ) : null;
                      })()}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none z-20">
                        {(() => {
                          const cq = lines.filter(l => l.item_id === item.id).reduce((s, l) => s + Number(l.quantity || 0), 0);
                          return cq > 0 ? (
                            <span className="pointer-events-auto text-[11px] font-black text-white bg-indigo-500/60 rounded-full px-3 py-0.5 backdrop-blur-sm border border-white/15 shadow-sm">في الفاتورة: {cq}</span>
                          ) : null;
                        })()}
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                          {[1, 2, 5, 10].map(n => (
                            <span key={n}
                              onClick={(e) => { e.stopPropagation(); handleQuickAdd(item, n); }}
                              className="cursor-pointer text-sm font-black text-white bg-white/20 hover:bg-indigo-500 active:bg-indigo-600 rounded-lg min-w-[32px] h-[32px] flex items-center justify-center transition-all backdrop-blur-sm hover:scale-110 active:scale-95 shadow-sm border border-white/10"
                            >{n}</span>
                          ))}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); const v = parseFloat(e.currentTarget.querySelector("input").value); if (v > 0) { handleQuickAdd(item, v); e.currentTarget.querySelector("input").value = ""; } }} className="pointer-events-auto w-[80%] max-w-[140px]">
                          <input
                            onFocus={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") e.target.blur(); }}
                            type="number" min="1" step="any" placeholder="كمية..." dir="rtl"
                            className="w-full rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-center text-xs font-black text-white outline-none focus:border-indigo-400 focus:bg-black/70 placeholder:text-white/40 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </form>
                      </div>
                    </div>
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-2sm font-black text-slate-800 truncate block leading-tight">{item.name}</span>
                      <span className="text-[11px] font-bold text-slate-400 font-mono truncate">{item.barcode || item.code || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-auto pt-1.5 border-t border-slate-100">
                      <span className="number-fmt-primary text-sm text-indigo-600">{formatMoney(item.sale_price || item.price || 0)}</span>
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
                <div className="flex items-center justify-between shrink-0 px-3 pt-3 pb-1">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">الأصناف ({detailedItemResults.length})</span>
                  <div className="relative" ref={colSettingsRef}>
                    <button
                      onClick={() => setColSettingsOpen((v) => !v)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    {colSettingsOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-lg p-2">
                        <div className="text-[10px] font-black text-slate-400 px-2 pb-1 border-b border-slate-100 mb-1">إظهار الأعمدة</div>
                        {ALL_COLUMNS.map((col) => (
                          <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-2sm font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={visibleColumns.includes(col)}
                              onChange={() => {
                                const next = visibleColumns.includes(col)
                                  ? visibleColumns.filter((c) => c !== col)
                                  : [...visibleColumns, col];
                                setVisibleColumns(next);
                                localStorage.setItem("retailer.posDetailed.visibleColumns", JSON.stringify(next));
                              }}
                              className="accent-indigo-500"
                            />
                            {col === "image" ? "صورة" : col === "code" ? "الكود" : col === "name" ? "اسم الصنف" : col === "price" ? "السعر" : col === "stock" ? "الرصيد" : col === "actions" ? "إجراءات" : col}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
                    { id: "price", header: "السعر", width: detailedColWidths.price, render: r => <span className="number-fmt-primary text-emerald-600">{formatMoney(r.sale_price || r.price)}</span> },
                    { id: "stock", header: "الرصيد", width: detailedColWidths.stock, render: r => <span className="number-fmt">{r.stock_quantity || r.stock || 0}</span> },
                    { id: "actions", header: "", width: 60, render: r => (
                        <button onClick={() => handleGridClickTracked(r)} className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Plus className="h-4 w-4"/></button>
                    )}
                  ].filter(c => c.id === "index" || c.id === "actions" || visibleColumns.includes(c.id))}
                />
             </div>
          )}
        </div>

        <PanelEdgeRail
          collapsed={panelEffectiveCollapsed}
          onToggle={togglePanel}
          onResizeStart={(e) => startPanelResize(e, "right")}
          panelSide="left"
        />

          {/* ── Right Column: Invoice Panel ── */}
          <div
            className={`flex flex-col min-w-[300px] bg-slate-50/80 shadow-[-2px_0_25px_-8px_rgba(0,0,0,0.08)] z-20 overflow-y-auto custom-scrollbar animate-fade-in gap-3 p-3 ${panelEffectiveCollapsed ? "hidden" : ""}`}
            style={{ width: panelWidth }}
          >
            
            {/* Top Panel: Customer & Actions */}
            <div className="flex flex-col shrink-0 min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm gap-2.5">
              {/* Meta Row */}
              <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Receipt className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="font-mono text-[11px] font-black bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-600 truncate max-w-[120px]">{invoiceIsActive ? (docNo || invoiceNumber) : "—"}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
              <div className="relative z-[70] flex-1">
                <div className={`pointer-events-none absolute inset-y-0 right-2.5 flex items-center ${hasCustomerBalance ? "text-amber-500" : "text-slate-400"}`}>
                  <User className="h-4 w-4" />
                </div>
                <input
                  ref={customerInputRef}
                  type="text"
                  value={(!customer && !customerQuery) ? "عميل نقدي" : customerQuery}
                  placeholder="ابحث عن عميل..."
                  onChange={(e) => {
                    const v = e.target.value.replace("عميل نقدي", "");
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
                  <div className="absolute left-0 right-0 z-50" style={{ top: "calc(100% + 4px)" }}>
                    <SearchDropdown items={customerResults} activeIndex={activeCustomerIndex} emptyLabel="ابحث عن عميل..." onPick={(c) => { setCustomer(c); setCustomerQuery(c.name); setCustomerLookupOpen(false); }} />
                  </div>
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
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <div className="text-[11px] font-black text-amber-700 bg-amber-100/50 border border-amber-200 px-2 py-1 rounded-sm whitespace-nowrap">
                  {amendContext ? "قبل التعديل: " : "الرصيد: "}{formatMoney(displayBalance)}
                </div>
                {creditEffect > 0 && lines.length > 0 && (
                  <>
                    <div className="text-[11px] font-black text-amber-700 bg-amber-100/50 border border-amber-200 px-2 py-1 rounded-sm whitespace-nowrap">
                      {paymentType === "installments" ? "الإضافة للأقساط: " : paymentType === "multi" ? "الإضافة للآجل: " : "الإضافة للرصيد: "}+{formatMoney(creditEffect)}
                    </div>
                    <div className="text-[11px] font-black text-rose-700 bg-rose-100/50 border border-rose-200 px-2 py-1 rounded-sm whitespace-nowrap">
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
                  ref={waLeadRef}
                  type="tel"
                  dir="ltr"
                  value={waLeadPhone}
                  onChange={(e) => setWaLeadPhone(e.target.value)}
                  onKeyDown={(e) => handleFieldNav(e, { prevRef: sellerRef })}
                  placeholder="واتساب (اختياري) — يُحفظ مع البيع"
                  className="flex-1 min-w-0 bg-transparent text-[12px] font-bold text-slate-700 outline-none placeholder:text-green-600/60 placeholder:font-normal text-right"
                />
              </div>
            )}
          </div>

          {/* Cart List */}
            <div className="shrink-0 min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm relative">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <ShoppingCart className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <div className="flex items-center gap-1"><h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest truncate">الأصناف المضافة</h3><ShortcutKbd id="grid.editLast" /></div>
              {lines.length > 0 && (
                <span className="mr-auto flex items-center justify-center h-5 min-w-[20px] rounded-full bg-indigo-100 px-1.5 text-[10px] font-black text-indigo-700">{lines.length}</span>
              )}
              {flashAdd && <span className="absolute top-3 left-3 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
            </div>
            {saveSuccess && <InvoiceSaveSuccess invoiceNumber={saveSuccess.invoiceNumber} total={saveSuccess.total} payments={saveSuccess.payments} customerName={saveSuccess.customerName} customerNewBalance={saveSuccess.customerNewBalance} discount={saveSuccess.discount} increase={saveSuccess.increase} onDismiss={onDismissSaveSuccess} />}
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                  <ShoppingCart className="h-8 w-8 text-slate-300" />
                </div>
                <span className="text-sm font-black tracking-widest text-slate-500">الفاتورة فارغة</span>
                <span className="mt-1 text-2sm font-bold text-slate-400">اضغط على الأصناف لإضافتها</span>
              </div>
            ) : (
              <div ref={gridNavRef} className="flex flex-col gap-1.5 max-h-[35vh] overflow-y-auto custom-scrollbar">
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
                  const maxStock = getLineMaxStock(line.item_id, line.warehouse_id);
                  const stockAtLimit = stockLoaded && maxStock !== Infinity && Number(line.quantity) >= maxStock;
                  return (
                    <div key={`${line.item_id}-${idx}`}
                      className={`animate-slide-up rounded-lg border bg-white text-right text-2sm transition-all hover:shadow-sm ${
                        isExceedingStock ? "border-rose-200 bg-rose-50/30" : hasWarning ? "border-amber-200" : "border-slate-100 hover:border-indigo-200"
                      }`}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      {/* Row 1: name + delete */}
                      <div className="flex items-center justify-between gap-1 px-2.5 pt-2 pb-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="shrink-0 text-[10px] font-black text-slate-300 number-fmt min-w-[14px]">{idx + 1}</span>
                          <span className="truncate font-black text-slate-800 text-2sm" title={line.item_name || line.name}>{line.item_name || line.name}</span>
                          {hasWarning && (
                            <span className="shrink-0" title={
                              isExceedingStock ? `تجاوز المخزون (متاح: ${line.stock_quantity})` :
                              isBelowCost ? `سعر أقل من التكلفة (${cost.toFixed(2)})` :
                              "الخصم يتجاوز الإجمالي"
                            }>
                              <AlertTriangle className={`w-3 h-3 ${isExceedingStock ? "text-rose-500" : "text-amber-500"}`} />
                            </span>
                          )}
                          {isPriceOverride && (
                            <span className="shrink-0 text-[10px] font-bold text-amber-600 truncate max-w-[100px]" title={`${formatMoney(unitPrice)} ← أصل ${formatMoney(line.master_sale_price)}`}>
                              {formatMoney(unitPrice)} ← {formatMoney(line.master_sale_price)}
                            </span>
                          )}
                        </div>
                        <button onClick={() => removeLine(line.item_id)} className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Row 2: code + multi-unit */}
                      <div className="flex items-center gap-2 px-2.5 pb-1">
                        <span className="text-[10px] font-bold text-slate-400 font-mono truncate">{line.code || "—"}</span>
                        {multiUnitEnabled && (
                          <button type="button" onClick={() => setConfigLine(line)}
                            className="shrink-0 text-[10px] font-black text-sky-600 hover:underline">
                            {line.sold_unit_name || line.unit_name || "أساسية"} ▾
                          </button>
                        )}
                      </div>

                      {/* Row 3: stepper + discount + price */}
                      <div className="flex items-center justify-between gap-1.5 px-2.5 pb-2">
                        {/* Stepper */}
                        <div className="flex items-center shrink-0 rounded-md border border-slate-200 bg-white overflow-hidden">
                          <button onClick={() => updateLine(line.item_id, { quantity: Math.max(1, Number(line.quantity) - 1) })}
                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><Minus className="w-3 h-3" /></button>
                          <input type="number" min="1" max={maxStock === Infinity ? undefined : maxStock} value={line.quantity}
                            data-grid-cell data-row={idx} data-col="quantity"
                            onChange={(e) => { const v = Number(e.target.value || 1); updateLine(line.item_id, { quantity: maxStock === Infinity ? v : Math.min(v, maxStock) }); }}
                            className="w-9 h-6 text-center text-2sm font-black bg-transparent outline-none ring-0 border-x border-slate-100 text-slate-800" />
                          <button
                            onClick={() => { const next = Number(line.quantity) + 1; if (next <= maxStock) updateLine(line.item_id, { quantity: next }); }}
                            disabled={stockAtLimit}
                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          ><Plus className="w-3 h-3" /></button>
                        </div>

                        {/* Stock remaining indicator */}
                        {stockLoaded && maxStock !== Infinity && (
                          <span className={`text-[10px] font-bold ${stockAtLimit ? 'text-rose-500' : 'text-slate-400'}`}>
                            {stockAtLimit ? 'نفد' : `+${maxStock - Number(line.quantity)}`}
                          </span>
                        )}

                        {/* Discount */}
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" step="any"
                            data-grid-cell data-row={idx} data-col="discount"
                            value={discountModes[line.item_id] === "pct"
                              ? parseFloat(((Number(line.line_discount || 0) / (Number(line.unit_price || 1) * Number(line.quantity || 1))) * 100).toFixed(2))
                              : Number(line.line_discount || 0)}
                            onChange={(e) => {
                              const v = Math.max(0, Number(e.target.value || 0));
                              const lineMax = Number(line.unit_price || 0) * Number(line.quantity || 0);
                              if (discountModes[line.item_id] === "pct") {
                                updateLine(line.item_id, { line_discount: Math.min(parseFloat(((v / 100) * lineMax).toFixed(4)), lineMax) });
                              } else {
                                updateLine(line.item_id, { line_discount: Math.min(v, lineMax) });
                              }
                            }}
                            className="w-12 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[11px] font-black text-center outline-none focus:border-amber-400"
                          />
                          <button onClick={() => setDiscountModes((m) => ({...m, [line.item_id]: m[line.item_id] === "pct" ? "flat" : "pct"}))}
                            className={`px-1 py-0.5 rounded text-[10px] font-black border ${discountModes[line.item_id] === "pct" ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-slate-100 border-slate-300 text-slate-500"}`}>
                            {discountModes[line.item_id] === "pct" ? "%" : "ج"}
                          </button>
                        </div>

                        {/* Price */}
                        <div className={`shrink-0 rounded-md px-2 py-0.5 border ${isPriceOverride ? "bg-amber-50 border-amber-200" : "bg-indigo-50 border-indigo-100"}`}>
                          <span className={`number-fmt-primary text-xs ${isPriceOverride ? "text-amber-700" : "text-indigo-700"}`}>{formatMoney(lineTotal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Totals & Payments */}
          <div data-help="payment-section" className="shrink-0 flex flex-col gap-3 animate-fade-in">
            {/* Totals Summary */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                  <Receipt className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ملخص الفاتورة</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-2sm font-bold text-slate-500">الإجمالي الفرعي</span>
                  <span className="number-fmt-primary text-sm text-slate-800">{formatMoney(totals.subtotal)}</span>
                </div>
                <div data-help="discount-field" className="flex items-center justify-between gap-2 rounded-lg bg-rose-50/50 px-3 py-2">
                  <span className="text-2sm font-bold text-rose-600 shrink-0">خصم إضافي</span>
                  <div className="flex items-center gap-1">
                    <input
                      ref={discountRef}
                      type="number" min="0"
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
                      onKeyDown={(e) => handleFieldNav(e, { nextRef: increaseRef })}
                      className="w-16 rounded-lg border border-rose-200 bg-white px-2 py-1 text-center number-fmt-primary text-2sm text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceDiscountMode((m) => m === "pct" ? "flat" : "pct")}
                      className={`px-2 py-1 rounded-lg text-[11px] font-black border transition-all shrink-0
                        ${invoiceDiscountMode === "pct"
                          ? "bg-rose-100 border-rose-300 text-rose-700 shadow-sm"
                          : "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"}`}
                    >
                      {invoiceDiscountMode === "pct" ? "%" : "ج"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50/50 px-3 py-2">
                  <span className="text-2sm font-bold text-blue-600 shrink-0">إضافة / رسوم</span>
                  <div className="flex items-center gap-1">
                    <input
                      ref={increaseRef}
                      type="number" min="0"
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
                      onKeyDown={(e) => handleFieldNav(e, { nextRef: taxRateRef, prevRef: discountRef })}
                      className="w-16 rounded-lg border border-blue-200 bg-white px-2 py-1 text-center number-fmt-primary text-2sm text-blue-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceIncreaseMode((m) => m === "pct" ? "flat" : "pct")}
                      className={`px-2 py-1 rounded-lg text-[11px] font-black border transition-all shrink-0
                        ${invoiceIncreaseMode === "pct"
                          ? "bg-blue-100 border-blue-300 text-blue-700 shadow-sm"
                          : "border-blue-200 bg-white text-blue-500 hover:bg-blue-50"}`}
                    >
                      {invoiceIncreaseMode === "pct" ? "%" : "ج"}
                    </button>
                  </div>
                </div>
                {taxFeatureOn && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-indigo-50/50 px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-1.5 font-bold text-indigo-600 shrink-0 text-2sm">
                      <input type="checkbox" className="accent-indigo-500"
                        checked={taxEnabled == null ? true : Boolean(Number(taxEnabled))}
                        onChange={(e) => setTaxEnabled(e.target.checked ? 1 : 0)}
                      />
                      الضريبة{storeSettings?.tax_type === "inclusive" ? " (شاملة)" : ""}
                    </label>
                    <div className="flex items-center gap-1">
                      {canEditTaxRate ? (
                        <input ref={taxRateRef} type="number" min="0" max="100" step="0.01"
                          value={taxRate != null ? taxRate : Number(storeSettings?.tax_rate || 0)}
                          onChange={(e) => setTaxRate(e.target.value === "" ? null : Number(e.target.value))}
                          onKeyDown={(e) => handleFieldNav(e, { nextRef: notesRef, prevRef: increaseRef })}
                          className="w-14 rounded-lg border border-indigo-200 bg-white px-1.5 py-1 text-center number-fmt-primary text-2sm text-indigo-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                        />
                      ) : (
                        <span className="number-fmt-primary text-2sm text-indigo-600">{taxRate != null ? taxRate : Number(storeSettings?.tax_rate || 0)}%</span>
                      )}
                      <span className="number-fmt-primary text-indigo-600">
                        {(taxEnabled == null || Number(taxEnabled)) ? formatMoney(taxCalc.taxAmount) : "—"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="h-px bg-slate-100 my-1" />
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-black text-slate-700">الإجمالي المطلوب</span>
                  <span className="number-fmt-primary text-[28px] text-emerald-600 leading-none">{formatMoney(totals.total)}</span>
                </div>
              </div>
            </div>
            {/* Payment Methods */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>
              <p className="text-[10px] text-slate-300 font-bold mb-2">اختر طريقة الدفع المناسبة للفاتورة</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_TYPES.map(({ type, label, desc, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && (type === "credit" || type === "installments");
                  const isActive = paymentType === type;
                  const colorMap = {
                    cash: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", ring: "ring-emerald-200", activeBg: "bg-emerald-600" },
                    credit: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", ring: "ring-amber-200", activeBg: "bg-amber-600" },
                    installments: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", ring: "ring-violet-200", activeBg: "bg-violet-600" },
                    multi: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", ring: "ring-slate-200", activeBg: "bg-slate-700" },
                  };
                  const c = colorMap[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => !isDisabled && setPaymentType(type)}
                      disabled={isDisabled}
                      title={isDisabled ? "يجب اختيار عميل مسجل أولاً" : undefined}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all duration-150 ${
                        isActive
                          ? `${c.activeBg} text-white border-transparent shadow-md ring-2 ${c.ring} ring-offset-1`
                          : isDisabled
                            ? "border-slate-100 opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-px text-slate-700 bg-white"
                      }`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isActive ? "bg-white/20" : c.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : c.text}`} />
                      </div>
                      <span className="text-[11px] font-black leading-tight whitespace-nowrap">{label}</span>
                      <span className={`text-[8.5px] font-medium leading-tight text-center mt-0.5 transition-colors duration-150 ${isActive ? "text-white/80" : "text-slate-400"}`}>{desc}</span>
                      {isActive && <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-white/80" />}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Payment Input */}
              {paymentType === "credit" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[11px] text-amber-800 font-bold flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span className="truncate">سيتم إضافة {formatMoney(totals.total)} لرصيد {customer?.name || "العميل"}</span>
                </div>
              )}
              {paymentType === "installments" && (
                <InstallmentPlanner
                  compact
                  remaining={installmentRemaining}
                  downPayment={amountPaid} setDownPayment={setAmountPaid}
                  count={installmentCount} setCount={setInstallmentCount}
                  frequency={installmentFrequency} setFrequency={setInstallmentFrequency}
                  customDays={installmentCustomDays} setCustomDays={setInstallmentCustomDays}
                  startDate={installmentStartDate} setStartDate={setInstallmentStartDate}
                  rows={installmentRows} onRowChange={handleInstallmentRowChange}
                  allocated={installmentAllocated} balanced={installmentBalanced}
                  customer={customer} formatMoney={formatMoney}
                />
              )}
              {paymentType === "multi" && (
                <div className="flex flex-col gap-2 rounded-xl bg-slate-50/60 border border-slate-200 p-3">
                  <div className="text-[11px] font-black text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> تفاصيل الدفع المتعدد
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-2sm font-bold text-slate-600 shrink-0">💵 نقدي</span>
                      <input ref={multiCashRef} type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} onKeyDown={(e) => handleFieldNav(e, { nextRef: multiVisaRef })} placeholder="0"
                        className="w-16 shrink-0 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-2sm font-black text-slate-800 text-left outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                      <button type="button" title="املأ المتبقي" onClick={() => { const c = customPayMethods.reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); const cr = Number(multiCredit||0); setMultiCash(String(Math.max(0, totals.total - c - cr - (Number(multiVisa)||0)))); }}
                        className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-all active:scale-90">
                        <Wand2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    {visaMethod && (
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-2sm font-bold text-blue-700 shrink-0">{visaMethod.icon || "💳"} {visaMethod.name}</span>
                        <input ref={multiVisaRef} type="number" min="0" value={multiVisa} onChange={(e) => setMultiVisa(e.target.value)} onKeyDown={(e) => handleFieldNav(e, { prevRef: multiCashRef, nextRef: multiCreditRef })} placeholder="0"
                          className="w-16 shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-2sm font-black text-slate-800 text-left outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
                        <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const cr = Number(multiCredit||0); const c = customPayMethods.reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); setMultiVisa(String(Math.max(0, totals.total - ca - c - cr))); }}
                          className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all active:scale-90">
                          <Wand2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                    {customPayMethods.map(m => (
                      <div key={m.id} className="flex items-center gap-1 min-w-0">
                        <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 truncate">{m.icon} {m.name}</span>
                        <input type="number" min="0" value={multiCustomAmounts[m.id] || ""} onChange={(e) => setMultiCustomAmounts(prev => ({...prev, [m.id]: e.target.value}))} placeholder="0"
                          className="w-16 shrink-0 rounded-lg border border-violet-200 bg-white px-2 py-1 text-2sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                        <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const cr = Number(multiCredit||0); const others = customPayMethods.filter(mm => mm.id !== m.id).reduce((s, mm) => s + Number(multiCustomAmounts[mm.id]||0), 0); setMultiCustomAmounts(prev => ({...prev, [m.id]: String(Math.max(0, totals.total - ca - others - cr - (Number(multiVisa)||0)))})); }}
                          className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 transition-all active:scale-90">
                          <Wand2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`flex-1 min-w-0 text-2sm font-bold truncate ${customer?.id ? 'text-amber-700' : 'text-slate-400'}`}>📋 آجل</span>
                      <input ref={multiCreditRef} type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)} onKeyDown={(e) => handleFieldNav(e, { prevRef: multiVisaRef })}
                        placeholder={customer?.id ? "0" : "—"}
                        disabled={!customer?.id}
                        className={`w-16 shrink-0 rounded-lg px-2 py-1 text-2sm font-black text-left outline-none transition-all ${customer?.id ? 'border border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`} />
                      <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const c = customPayMethods.reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); setMultiCredit(String(Math.max(0, totals.total - ca - c - (Number(multiVisa)||0)))); }}
                        className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all active:scale-90">
                        <Wand2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const entered = (Number(multiCash)||0) + (Number(multiVisa)||0) + customPayMethods.reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0) + (Number(multiCredit)||0);
                    const balanced = Math.abs(entered - totals.total) < 0.01;
                    return (
                      <div className={`flex items-center justify-between rounded-lg px-2 py-1.5 border text-[11px] font-black ${balanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        <span>المُدخل</span>
                        <span className="number-fmt-primary">{formatMoney(entered)} / {formatMoney(totals.total)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Main Actions */}
              {/* Invoice note */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>ملاحظة الفاتورة</span>
                  {Boolean(invoiceNotes && invoiceNotes.trim()) && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="توجد ملاحظة" />}
                </label>
                <textarea
                  ref={notesRef}
                  rows={2}
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  onKeyDown={(e) => handleFieldNav(e, { prevRef: taxRateRef })}
                  placeholder="ملاحظة اختيارية تُحفظ مع الفاتورة…"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-2sm font-medium text-slate-800 outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-100 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2 mt-1">
                <PermissionGate page="pos" action="print">
                  <button type="button" onClick={() => setPrintPreview(true)} disabled={!lines.length || isSaving || hasBlockingErrors} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-black text-white transition-all shadow-md active:scale-[0.98] ${!lines.length || isSaving || hasBlockingErrors ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100"}`}>
                    <Printer className="h-5 w-5" /> طباعة ومراجعة المستند
                  </button>
                </PermissionGate>
                <div className="flex gap-2">
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
               <div className="flex-1" />
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
      <Modal open={detailedSearchOpen} onClose={() => setDetailedSearchOpen(false)} title="بحث تفصيلي عن الأصناف" showDetach={false}>
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
                  <tr key={item.id} className="cursor-pointer border-t border-slate-100 hover:bg-primary-600 hover:text-white transition-colors group" onClick={() => handleSelectItem(item)}>
                    <td className="p-2 border-l border-slate-50">
                      <div className="h-8 w-8 overflow-hidden rounded-sm border border-slate-200 bg-white">
                        {getItemImage(item) ? <img src={getItemImage(item)} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageIcon className="h-3.5 w-3.5" /></div>}
                      </div>
                    </td>
                    <td className="p-2 font-mono font-bold text-slate-600 group-hover:text-slate-200 border-l border-slate-50 whitespace-normal break-words leading-tight" style={{ maxWidth: `${detailedColWidths.code}px` }}>{item.code || item.item_code || "—"}</td>
                    <td className="p-2 font-black text-slate-800 group-hover:text-white border-l border-slate-50 whitespace-normal break-words leading-tight" style={{ maxWidth: `${detailedColWidths.name}px` }}>{item.name}</td>
                    <td className="p-2 font-mono font-bold text-slate-500 group-hover:text-slate-300 border-l border-slate-50 whitespace-normal break-words leading-tight" style={{ maxWidth: `${detailedColWidths.barcode}px` }}>{item.barcode || "—"}</td>
                    <td className="p-2 font-bold text-slate-500 group-hover:text-slate-300 border-l border-slate-50 whitespace-normal break-words leading-tight" style={{ maxWidth: `${detailedColWidths.category}px` }}>{item.category_name || "—"}</td>
                    <td className="p-2 number-fmt-primary text-emerald-700 group-hover:text-emerald-300 border-l border-slate-50" style={{ maxWidth: `${detailedColWidths.price}px` }}>{formatMoney(item.sale_price || item.price || 0)}</td>
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
      <Modal open={supervisorOverrideOpen} onClose={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }} title="تجاوز حد الخصم" showDetach={false}>
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
      <Modal open={multiModalOpen} onClose={() => setMultiModalOpen(false)} title="توزيع مبالغ الدفع المتعدد" showDetach={false}>
        <div className="space-y-4 animate-modal-enter">
          <div className="rounded-sm bg-slate-950 p-5 text-center">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">المبلغ المطلوب توزيعه</p>
            <p className="number-fmt-primary text-[28px] text-white">{formatMoney(totals.total)}</p>
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
                    className="w-28 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-right number-fmt-primary text-sm text-slate-800 outline-none focus:border-slate-800" />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-400 uppercase">الموزع</span>
              <span className={`number-fmt-primary text-[16px] ${Math.abs(totals.total - multiTotal) < 0.005 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatMoney(multiTotal)}
              </span>
            </div>
            <button onClick={() => setMultiModalOpen(false)}
              className="rounded-sm bg-primary px-8 py-2.5 text-sm font-black text-white hover:bg-primary-600 shadow-sm active:scale-[0.98] transition-all">
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
          payments: lastSavedInvoice.payments || [{ method: lastSavedInvoice.paymentType, method_name: { cash: "نقدي", credit: "آجل", bank: "بنك" }[lastSavedInvoice.paymentType] || lastSavedInvoice.paymentType, amount: lastSavedInvoice.totals?.total }],
          installment_plan: lastSavedInvoice.installment_plan || [],
          notes: lastSavedInvoice.notes || null,
          discount: Number(lastSavedInvoice.discount || 0) + Number(lastSavedInvoice.promotionDiscount || 0),
          increase: Number(lastSavedInvoice.increase || 0),
          total: lastSavedInvoice.totals?.total,
          tax_enabled: Number(lastSavedInvoice.tax_amount || 0) > 0 ? 1 : 0,
          tax_amount: Number(lastSavedInvoice.tax_amount || 0),
          tax_rate: Number(lastSavedInvoice.tax_rate || 0),
          tax_type: lastSavedInvoice.tax_type || null,
        } : {
          invoice_no: docNo || invoiceNumber,
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
            ...(Number(multiVisa) > 0 && visaMethod ? [{ method_id: visaMethod.id, method_name: visaMethod.name, amount: Number(multiVisa) }] : []),
            ...customPayMethods.filter(m => Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, method_name: m.name, amount: Number(multiCustomAmounts[m.id]) })),
            ...(Number(multiCredit) > 0 && customer?.id ? [{ method: "credit", method_name: "آجل", amount: Number(multiCredit) }] : []),
          ] : paymentType === "installments"
            ? (Number(amountPaid) > 0 ? [{ method: "cash", method_name: "دفعة مقدمة", amount: Number(amountPaid) }] : [])
            : [{ method: paymentType, method_name: { cash: "نقدي", credit: "آجل", bank: "بنك" }[paymentType] || paymentType, amount: (paymentType === "cash" && Number(amountReceived) > totals.total) ? Number(amountReceived) : totals.total }],
          installment_plan: paymentType === "installments" ? installmentRows.map((r, i) => ({ installment_no: i + 1, due_date: r.due_date, amount: Number(r.amount || 0), status: "pending" })) : [],
          notes: invoiceNotes || null,
          discount: Number(discount || 0) + Number(promotionDiscount || 0),
          increase: Number(increase || 0),
          total: totals.total,
          tax_enabled: taxCalc.taxAmount > 0 ? 1 : 0,
          tax_amount: taxCalc.taxAmount,
          tax_rate: taxCalc.taxAmount > 0 ? (taxRate != null ? Number(taxRate) : Number(storeSettings?.tax_rate || 0)) : 0,
          tax_type: taxCalc.taxAmount > 0 ? (storeSettings?.tax_type || null) : null,
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
      <Modal open={showSetDefaultModal} onClose={() => setShowSetDefaultModal(false)} title="حفظ تفضيل العرض" showDetach={false}>
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
              className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-white hover:bg-primary-600 transition-all active:scale-[0.98]"
            >
              نعم، احفظه كافتراضي
            </button>
          </div>
        </div>
      </Modal>

      {/* New Invoice Warning Modal */}
      <Modal open={newInvoiceModalOpen} onClose={() => setNewInvoiceModalOpen(false)} title="فاتورة جديدة" showDetach={false}>
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
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title="تأكيد حفظ الفاتورة" showDetach={false}>
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
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="إلغاء الفاتورة" showDetach={false}>
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
              className="flex items-center justify-center gap-2 rounded-lg btn-danger px-4 py-3 text-sm font-black transition-all active:scale-[0.98]"
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
