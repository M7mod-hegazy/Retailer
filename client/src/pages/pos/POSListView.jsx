import React, { useRef, useState, useEffect, useCallback } from "react";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import {
  AlertTriangle, Banknote, Building2, Calendar, ChevronDown, CreditCard, GripHorizontal,
  FilePlus, Filter, Image as ImageIcon, Layers, List, LayoutGrid,
  Loader2, Minus, PackageCheck, PauseCircle, Plus, Printer,
  Receipt, RefreshCw, RotateCcw, Search, Settings2, ShieldCheck, ShoppingCart,
  Sparkles, Trash2, Pencil, User, Wallet, X, TrendingUp, ExternalLink, FileText, Save,
  Wand2,
} from "lucide-react";
import BarcodeListener from "../../components/pos/BarcodeListener";
import PosStickyTotalBar from "../../components/pos/PosStickyTotalBar";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import ProductSearchField from "../../components/ui/ProductSearchField";
import EntryItemThumb from "../../components/ui/EntryItemThumb";
import WarehouseSelect from "../../components/ui/WarehouseSelect";
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
import { resolveImageUrl, formatMoney } from "./posPageUtils";
import { formatNumber } from "../../utils/currency";
import { cartLineKey } from "../../stores/posStore";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function POSListView({ vm }) {
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
    amendContext, amendOriginalQty,
    quotationContext, setQuotationContext,
    showQuotationSummary, setShowQuotationSummary,
    selectedTreasuryId, treasuries,
    creditEffect, displayBalance,
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
    activeCustomerIndex,
    customerResults, handlePickCustomer, handleCustomerKeyDown,
    customers, setCustomers,
    items, units,
    panelEffectiveCollapsed, panelWidth,
    expandPanel, togglePanel, startPanelResize,
    handleHold,
    selectedItem, setSelectedItem, staging, setStaging,
    itemNameQuery, setItemNameQuery,
    itemLookupOpen, setItemLookupOpen,
    activeLookupIndex, setActiveLookupIndex,
    itemResults,
    searchedItemHasMore, isLoadingMoreItems, loadMorePOSItems,
    listItemInputRef, listQtyRef, listPriceRef, listDiscRef, listWhRef, listAddBtnRef,
    customerInputRef,
    handleListFieldKeyDown, handleSelectItem,
    addCurrentLine, openGallery,
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
  } = vm;

  const entryBarRef = useRef(null);
  const discountRef = useRef(null);
  const increaseRef = useRef(null);
  const taxRateRef = useRef(null);
  const notesRef = useRef(null);
  const sellerRef = useRef(null);
  const bankRef = useRef(null);
  const multiCashRef = useRef(null);
  const multiCreditRef = useRef(null);
  const handleFieldEnter = useFieldNavigation();
  const [entryBarNarrow, setEntryBarNarrow] = useState(false);
  useEffect(() => {
    const el = entryBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setEntryBarNarrow(entry.contentRect.width < 850);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const removeUndoRefs = useRef({});
  const [confirmDelKey, setConfirmDelKey] = useState(null);
  const delTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(delTimerRef.current), []);
  const handleRemoveWithUndo = useCallback((row) => {
    const key = cartLineKey(row);
    const lineData = { ...row };
    removeLine(key);
    const toastId = toast(
      (t) => (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-slate-600">تم حذف {lineData.item_name}</span>
          <button onClick={() => {
            addLine({
              id: lineData.item_id, name: lineData.item_name, code: lineData.code || "",
              barcode: lineData.barcode || "", sale_price: lineData.unit_price,
              category_name: lineData.category_name || "",
              warehouse_id: lineData.warehouse_id, warehouse_name: lineData.warehouse_name,
              stock_quantity: lineData.stock_quantity, unit_id: lineData.unit_id,
              unit_name: lineData.unit_name || "قطعة",
              primary_image_url: lineData.primary_image_url || null,
              quantity: lineData.quantity, line_discount: lineData.line_discount || 0,
            });
            toast.dismiss(t.id);
          }} className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-black text-white hover:bg-indigo-700 transition-all">
            تراجع
          </button>
        </div>
      ),
      { duration: 5000 }
    );
  }, [removeLine, addLine]);

  useEffect(() => { setTimeout(() => listItemInputRef?.current?.focus(), 300); }, []);
  const [flashAdd, setFlashAdd] = useState(false);
  useEffect(() => {
    if (lines.length > 0) {
      setFlashAdd(true);
      setTimeout(() => listItemInputRef?.current?.focus(), 100);
      const t = setTimeout(() => setFlashAdd(false), 600);
      return () => clearTimeout(t);
    }
  }, [lines.length]);

  const ALL_COLUMNS = ["index", "sku", "name", "quantity", "unitPrice", "lineDiscount", "warehouseId", "unit", "profit_pct", "barcode", "cost_price", "category", "wholesale_price", "total", "actions"];
  const DEFAULT_VISIBLE = ["index", "sku", "name", "quantity", "unitPrice", "lineDiscount", "warehouseId", "unit", "profit_pct", "total", "actions"];
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer.pos.visibleColumns") || "null") || DEFAULT_VISIBLE; } catch { return DEFAULT_VISIBLE; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.pos.visibleColumns", JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns]);
  useEffect(() => {
    const handler = (e) => {
      setVisibleColumns(prev => {
        if (e.detail.show) {
          return prev.includes("profit_pct") ? prev : [...prev, "profit_pct"];
        } else {
          return prev.filter(c => c !== "profit_pct");
        }
      });
    };
    window.addEventListener("pos:toggleProfit", handler);
    return () => window.removeEventListener("pos:toggleProfit", handler);
  }, []);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) setColSettingsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [densityLevel, setDensityLevel] = useState(() => {
    try { return Number(localStorage.getItem("retailer.pos.densityLevel") || 0); } catch { return 0; }
  });
  useEffect(() => {
    try { localStorage.setItem("retailer.pos.densityLevel", String(densityLevel)); } catch {}
  }, [densityLevel]);

  const cycleDensity = () => setDensityLevel(p => (p + 1) % 3);

  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)] font-sans overflow-hidden animate-fade-in" dir="rtl">
      <style>{`
        .dense-data-grid [class*="h-["] {
          height: 26px !important;
          min-height: 26px !important;
          line-height: 26px !important;
        }
        .dense-data-grid [class*="h-["] input,
        .dense-data-grid [class*="h-["] select {
          height: 26px !important;
          min-height: 26px !important;
          font-size: 10px !important;
        }
        .dense-data-grid td,
        .dense-data-grid .px-2.py-2 {
          padding: 1px 4px !important;
          font-size: 11px !important;
        }
        .ultra-dense-data-grid [class*="h-["] {
          height: 22px !important;
          min-height: 22px !important;
          line-height: 22px !important;
        }
        .ultra-dense-data-grid [class*="h-["] input,
        .ultra-dense-data-grid [class*="h-["] select {
          height: 22px !important;
          min-height: 22px !important;
          font-size: 9px !important;
        }
        .ultra-dense-data-grid td,
        .ultra-dense-data-grid .px-2.py-2 {
          padding: 0px 2px !important;
          font-size: 10px !important;
        }
      `}</style>
      <BarcodeListener />
      <PosStickyTotalBar
        total={totals.total}
        subtotal={totals.subtotal}
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
        banks={vm.banks}
        selectedBankId={selectedBankId}
        onBankChange={setSelectedBankId}
        amountPaid={amountPaid}
        onAmountPaidChange={setAmountPaid}
        multiCash={multiCash}
        onMultiCashChange={setMultiCash}
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
        activeTaxRate={taxCalc.taxAmount > 0 ? (taxRate !== null ? Number(taxRate) : Number(storeSettings?.tax_rate || 0)) : 0}
        hasNotes={Boolean(invoiceNotes && invoiceNotes.trim())}
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
              readOnly disabled
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
          <select ref={sellerRef}
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            onKeyDown={(e) => handleFieldEnter(e, { nextRef: discountRef })}
            className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-2sm font-bold text-slate-700 outline-none focus:border-slate-800 min-w-[130px]"
          >
            <option value="">البائع (اختياري)</option>
            {employees.filter((emp) => emp.is_active !== 0).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setReceiptsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-all"
            title="فواتير اليوم"
          ><Receipt className="h-4 w-4" /></button>
          <button onClick={() => setAdvancedSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-all"
            title="بحث متقدم في المخزون"
          ><Filter className="h-4 w-4" /></button>
          <PermissionGate page="pos" action="profit">
            <button onClick={() => setProfitModalOpen(true)} disabled={!lines.length}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all disabled:opacity-40"
              title="تحليل ربح الفاتورة"
            ><TrendingUp className="h-4 w-4" /></button>
          </PermissionGate>
          <PermissionGate page="pos" action="print">
            <button onClick={() => setPrintPreview(true)}
              disabled={!lines.length || isSaving || (hasBlockingErrors && !stockOnlyErrors)}
              className={`flex h-9 items-center gap-2 rounded-sm px-6 text-sm font-black text-white transition-all disabled:opacity-50
                ${hasBlockingErrors && !stockOnlyErrors && lines.length ? "bg-rose-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              <Printer className="h-4 w-4" /> طباعة  
              {hasBlockingErrors && <span className="ml-1.5 rounded-full bg-rose-400 text-white text-[9px] font-black px-1.5 py-0.5">{blockingErrorCount}</span>}
            </button>
          </PermissionGate>
          <PermissionGate page="pos" action="add">
            <button onClick={() => setSaveConfirmOpen(true)}
              disabled={!lines.length || isSaving || hasBlockingErrors}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-6 text-sm font-black text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" /> حفظ 
            </button>
          </PermissionGate>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden"
        style={{ paddingBottom: "calc(1rem + var(--pos-bottom-bar-h, 0px))" }}
      >
        {/* Right Sidebar (Customer, Summary, Payment) */}
        <aside style={panelEffectiveCollapsed ? undefined : { width: panelWidth }}
          className={`shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar animate-fade-in ${panelEffectiveCollapsed ? "hidden" : ""}`}
        >
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
                  <button onClick={() => { setCustomer(null); setCustomerQuery(""); setPaymentType("cash"); }}
                    title="إلغاء تحديد العميل"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                  ><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
            <div className="relative">
              <input ref={customerInputRef} type="text" value={customerQuery}
                placeholder={customer?.id ? customer.name : "ابحث عن عميل..."}
                onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); if (!e.target.value) { setCustomer(null); setPaymentType("cash"); } }}
                onFocus={() => { if (!customer?.id) setCustomerQuery(""); setCustomerLookupOpen(true); }}
                onBlur={() => { setTimeout(() => { setCustomerLookupOpen(false); if (!customer?.id) setCustomerQuery(""); }, 200); }}
                onKeyDown={handleCustomerKeyDown}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 placeholder:font-normal"
              />
              {customerLookupOpen && (
                <SearchDropdown items={customerResults} onPick={handlePickCustomer}
                  activeIndex={activeCustomerIndex} query={customerQuery}
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
                    <button key={c.id} onClick={() => handlePickCustomer(c)}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                    >{c.name}</button>
                  ))}
                </div>
              </div>
            )}
            {!customer?.id && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50/50 px-2.5 py-1.5">
                <span className="text-sm shrink-0">📱</span>
                <input type="tel" dir="ltr" value={vm.waLeadPhone}
                  onChange={(e) => vm.setWaLeadPhone(e.target.value)}
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
                <span className="number-fmt text-sm text-slate-800">{lines.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-2sm font-bold text-slate-500">مجموع الكميات</span>
                <span className="number-fmt text-sm text-slate-800">{lines.reduce((acc, l) => acc + Number(l.quantity), 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-2sm font-bold text-slate-500">الإجمالي الفرعي</span>
                <span className="number-fmt-primary text-sm text-slate-800">{formatMoney(totals.subtotal)}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> خصم الفاتورة
                </label>
                <div className="flex items-center gap-1.5">
                  <input ref={discountRef} type="number" min="0"
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
                    onKeyDown={(e) => handleFieldEnter(e, { nextRef: increaseRef, prevRef: sellerRef })}
                    className="flex-1 min-w-0 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2 text-sm font-black text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-center transition-all"
                  />
                  <button type="button"
                    onClick={() => setInvoiceDiscountMode((m) => m === "pct" ? "flat" : "pct")}
                    title={invoiceDiscountMode === "pct" ? "تغيير إلى قيمة ثابتة" : "تغيير إلى نسبة مئوية"}
                    className={`h-[40px] px-3 rounded-lg text-2sm font-black border transition-all shrink-0
                      ${invoiceDiscountMode === "pct"
                        ? "bg-rose-100 border-rose-300 text-rose-700 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                  >{invoiceDiscountMode === "pct" ? "%" : "ج"}</button>
                </div>
                {discount > 0 && invoiceDiscountMode === "flat" && totals.subtotal > 0 && (
                  <span className="text-[11px] number-fmt text-rose-400 px-1">{((discount / totals.subtotal) * 100).toFixed(1)}% من الإجمالي</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> إضافة / رسوم
                </label>
                <div className="flex items-center gap-1.5">
                  <input ref={increaseRef} type="number" min="0"
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
                    onKeyDown={(e) => handleFieldEnter(e, { nextRef: taxRateRef, prevRef: discountRef })}
                    className="flex-1 min-w-0 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-black text-blue-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-center transition-all"
                  />
                  <button type="button"
                    onClick={() => setInvoiceIncreaseMode((m) => m === "pct" ? "flat" : "pct")}
                    title={invoiceIncreaseMode === "pct" ? "تغيير إلى قيمة ثابتة" : "تغيير إلى نسبة مئوية"}
                    className={`h-[40px] px-3 rounded-lg text-2sm font-black border transition-all shrink-0
                      ${invoiceIncreaseMode === "pct"
                        ? "bg-blue-100 border-blue-300 text-blue-700 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                  >{invoiceIncreaseMode === "pct" ? "%" : "ج"}</button>
                </div>
              </div>
              {taxFeatureOn && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> الضريبة{storeSettings?.tax_type === "inclusive" ? " (شاملة)" : ""}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <label className="flex flex-1 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 transition-all">
                      <input type="checkbox" className="accent-indigo-600"
                        checked={taxEnabled == null ? true : Boolean(Number(taxEnabled))}
                        onChange={(e) => setTaxEnabled(e.target.checked ? 1 : 0)}
                      />
                      <span className="flex-1 text-center number-fmt-primary text-sm text-indigo-900">
                        {(taxEnabled == null || Number(taxEnabled)) ? formatMoney(taxCalc.taxAmount) : "—"}
                      </span>
                    </label>
                    {canEditTaxRate ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <input ref={taxRateRef} type="number" min="0" max="100" step="0.01"
                          value={taxRate != null ? taxRate : Number(storeSettings?.tax_rate || 0)}
                          onChange={(e) => setTaxRate(e.target.value === "" ? null : Number(e.target.value))}
                          onKeyDown={(e) => handleFieldEnter(e, { nextRef: notesRef, prevRef: increaseRef })}
                          className="h-[40px] w-16 rounded-lg border border-indigo-200 bg-indigo-50/50 px-2 text-center text-sm font-black text-indigo-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                        /><span className="text-2sm font-black text-slate-400">%</span>
                      </div>
                    ) : (
                      <span className="flex h-[40px] shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-2sm font-black text-slate-500">
                        {taxRate != null ? taxRate : Number(storeSettings?.tax_rate || 0)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="h-px bg-slate-100 my-1" />
              <div className="rounded-2xl bg-slate-950 p-4 text-center text-white shadow-lg">
                <div className="text-[11px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                <div className="text-[32px] number-fmt-primary tracking-tighter leading-none mt-1.5">
                  {formatNumber(totals.total)}
                </div>
                <div className="text-[11px] opacity-40 mt-1">ج.م</div>
              </div>
              {hasBlockingErrors && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-3">
                  <div className="text-[11px] font-black text-rose-700 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> تحذيرات تمنع الحفظ
                  </div>
                  {Object.entries(lineWarnings).flatMap(([lineKey, ws]) =>
                    ws.filter((w) => w.type === "error").map((w, i) => {
                      const l = lines.find((ln) => cartLineKey(ln) === lineKey);
                      return (
                        <div key={`${lineKey}-${i}`} className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" /> {l?.item_name || lineKey}: {w.msg}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Amend: original invoice summary */}
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
                    <span className="number-fmt-primary">{(() => {
                      const lines = amendContext.prefill?.lines || [];
                      const sub = lines.reduce((s, l) => s + (Number(l.unit_price||0) * Number(l.quantity||1) * (1 - Number(l.discount||0)/100)), 0);
                      return formatNumber(sub - (amendContext.prefill?.discount||0) + (amendContext.prefill?.increase||0));
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

          {/* Quotation convert summary */}
          {quotationContext && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1">
                  <FileText className="h-3 w-3" /> من عرض سعر
                  <span className="rounded-sm bg-violet-600 px-1.5 py-0.5 text-[9px] font-black text-white font-mono normal-case tracking-normal">
                    {quotationContext.prefill?.quotation_no || `#${quotationContext.from_quotation_id}`}
                  </span>
                </span>
                <button onClick={() => setShowQuotationSummary(false)} className="text-violet-400 hover:text-violet-700">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {showQuotationSummary && (
                <div className="space-y-1 text-[11px] font-bold text-violet-800">
                  <div className="flex gap-1.5 mb-2">
                    <input disabled value={quotationContext.prefill?.quotation_no || ""}
                      className="flex-1 h-7 rounded-sm border border-violet-200 bg-violet-100/60 px-2 text-[11px] font-mono font-black text-violet-700 cursor-not-allowed outline-none" />
                    <input disabled value={quotationContext.prefill?.quotation_created_at ? new Date(quotationContext.prefill.quotation_created_at).toLocaleDateString("ar-EG-u-nu-latn") : ""}
                      className="flex-1 h-7 rounded-sm border border-violet-200 bg-violet-100/60 px-2 text-[11px] font-mono font-black text-violet-700 cursor-not-allowed outline-none" />
                  </div>
                  {quotationContext.prefill?.customer_name && (
                    <div className="flex justify-between"><span className="text-violet-600">العميل</span><span>{quotationContext.prefill.customer_name}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-violet-600">الأصناف</span><span>{(quotationContext.prefill?.lines || []).length} صنف</span></div>
                  <div className="flex justify-between">
                    <span className="text-violet-600">الدفع المقترح</span>
                    <span>{{ cash: "نقدي", credit: "آجل", bank_transfer: "بنك/فيزا", installments: "أقساط", multi: "متعدد" }[quotationContext.prefill?.payment_type] || quotationContext.prefill?.payment_type || "—"}</span>
                  </div>
                  {quotationContext.prefill?.quotation_expires_at && (
                    <div className="flex justify-between">
                      <span className="text-violet-600">صلاحية العرض</span>
                      <span>{new Date(quotationContext.prefill.quotation_expires_at).toLocaleDateString("ar-EG-u-nu-latn")}</span>
                    </div>
                  )}
                  <p className="text-[10px] font-bold text-violet-500 pt-1 border-t border-violet-200/60 mt-2">
                    يمكنك تعديل الأصناف والأسعار قبل تأكيد البيع
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>
            <p className="text-[10px] text-slate-300 font-bold mb-2">اختر طريقة الدفع المناسبة للفاتورة</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_TYPES.filter(({ type }) => !(type === "bank_transfer" && vm.banks.length === 0)).map(({ type, label, desc, Icon }) => {
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
                  <button key={type} onClick={() => !isDisabled && setPaymentType(type)} disabled={isDisabled}
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
                    <span className={`text-[8.5px] font-medium leading-tight text-center mt-0.5 transition-colors duration-150 ${isActive ? "text-white/80" : "text-slate-400"}`}>{desc}</span>
                    {isActive && <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-white/80" />}
                  </button>
                );
              })}
            </div>

            {paymentType === "bank_transfer" && (
              <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-blue-50/50 border border-blue-100 p-3">
                <label className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" /> اختر البنك / البطاقة
                </label>
                <select ref={bankRef} value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}
                  onKeyDown={(e) => handleFieldEnter(e, { nextRef: notesRef })}
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-2sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">اختر البنك / البطاقة</option>
                  {vm.banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
              <InstallmentPlanner
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
              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50/60 border border-slate-200 p-4">
                <div className="text-[11px] font-black text-slate-600 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> تفاصيل الدفع المتعدد
                </div>
                <div className="flex flex-col divide-y divide-slate-100">
                  <div className="flex items-center gap-2 py-2 first:pt-0">
                    <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 leading-snug">💵 نقدي</span>
                    <input ref={multiCashRef} type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00"
                      onKeyDown={(e) => handleFieldEnter(e, { nextRef: multiCreditRef })}
                      className="w-28 shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-black text-slate-800 text-left outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                    <button type="button" title="املأ المتبقي" onClick={() => { const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); const cr = Number(multiCredit||0); setMultiCash(String(Math.max(0, totals.total - c - cr))); }}
                      className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-all active:scale-90">
                      <Wand2 className="h-3 w-3" />
                    </button>
                  </div>
                  {customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').map(m => (
                    <div key={m.id} className="flex items-center gap-2 py-2">
                      <span className="flex-1 min-w-0 text-2sm font-bold text-slate-600 leading-snug break-words">{m.icon} {m.name}</span>
                      <input type="number" min="0" value={multiCustomAmounts[m.id] || ""} onChange={(e) => setMultiCustomAmounts(prev => ({...prev, [m.id]: e.target.value}))} placeholder="0.00"
                        className="w-28 shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-2sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                      <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const cr = Number(multiCredit||0); const others = customPayMethods.filter(mm => !mm.name?.includes('بنك') && !mm.name?.includes('تحويل') && mm.icon !== '🏦' && mm.id !== m.id).reduce((s, mm) => s + Number(multiCustomAmounts[mm.id]||0), 0); setMultiCustomAmounts(prev => ({...prev, [m.id]: String(Math.max(0, totals.total - ca - others - cr))})); }}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 transition-all active:scale-90">
                        <Wand2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 py-2 last:pb-0">
                    <span className={`flex-1 min-w-0 text-2sm font-bold leading-snug ${customer?.id ? 'text-amber-700' : 'text-slate-400'}`}>📋 آجل</span>
                    <input ref={multiCreditRef} type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)}
                      placeholder={customer?.id ? "0.00" : "اختر عميل..."} disabled={!customer?.id}
                      onKeyDown={(e) => handleFieldEnter(e, { nextRef: notesRef, prevRef: multiCashRef })}
                      className={`w-28 shrink-0 rounded-lg px-3 py-1.5 text-2sm font-black text-left outline-none transition-all ${customer?.id ? 'border border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`} />
                    <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); setMultiCredit(String(Math.max(0, totals.total - ca - c))); }}
                      className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all active:scale-90">
                      <Wand2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {(() => {
                  const entered = (Number(multiCash)||0) + customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0) + (Number(multiCredit)||0);
                  const balanced = Math.abs(entered - totals.total) < 0.01;
                  return (
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 border text-[11px] font-black ${balanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                      <span>المُدخل</span>
                      <span className="number-fmt-primary">{formatMoney(entered)} / {formatMoney(totals.total)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Invoice note */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <label className="mb-2 flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <span>ملاحظة الفاتورة</span>
              {Boolean(invoiceNotes && invoiceNotes.trim()) && <span className="h-2 w-2 rounded-full bg-amber-400" title="توجد ملاحظة" />}
            </label>
            <textarea ref={notesRef} rows={2} value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="ملاحظة اختيارية تُحفظ مع الفاتورة وتظهر على الإيصال…"
              onKeyDown={(e) => handleFieldEnter(e, { prevRef: taxRateRef })}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
            />
          </div>

          {/* Customer detail when selected */}
          {customer && customer.id && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-black">{(customer.name || "?")[0]}</div>
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
                    <span className={`number-fmt-primary text-sm ${displayBalance > 0 ? "text-rose-600" : "text-slate-800"}`}>{displayBalance.toFixed(3)}</span>
                  </div>
                  {creditEffect > 0 && lines.length > 0 && (
                    <div className="mt-1.5 space-y-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-600">
                          {paymentType === "installments" ? "الإضافة للأقساط" : paymentType === "multi" ? "الإضافة للآجل" : "الإضافة للرصيد"}
                        </span>
                        <span className="number-fmt-primary text-sm text-amber-700">+{creditEffect.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-amber-200/60 pt-1">
                        <span className="text-[11px] font-bold text-amber-600">
                          {paymentType === "installments" ? "الرصيد بعد الأقساط" : paymentType === "multi" ? "الرصيد بعد الآجل" : "الرصيد بعد الفاتورة"}
                        </span>
                        <span className={`number-fmt-primary text-sm ${displayBalance + creditEffect > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {(displayBalance + creditEffect).toFixed(3)}
                        </span>
                      </div>
                    </div>
                  )}
                  {vm.selectedTreasuryId && (paymentType === "cash" || paymentType === "multi") && lines.length > 0 && (
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1.5">
                      <span className="text-[11px] font-bold text-emerald-600">الخزينة بعد الفاتورة</span>
                      <span className="number-fmt-primary text-2sm text-emerald-700">
                        {(Number(vm.treasuries.find(t => String(t.id) === String(vm.selectedTreasuryId))?.balance || 0) + totals.total).toFixed(3)}
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
                <button data-help="confirm-button" onClick={() => setPrintPreview(true)}
                  disabled={!lines.length || isSaving || hasBlockingErrors}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-white transition-all shadow-md active:scale-[0.98] ${!lines.length || isSaving || hasBlockingErrors ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100"}`}
                ><Printer className="h-5 w-5" /> طباعة ومراجعة المستند</button>
              </PermissionGate>
              <div className="flex gap-2">
                <PermissionGate page="pos" action="void">
                  <button type="button" onClick={() => setCancelModalOpen(true)} disabled={!lines.length}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-2sm font-black text-rose-700 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  ><Trash2 className="h-4 w-4" /> إلغاء</button>
                </PermissionGate>
                <button type="button" onClick={() => setNewInvoiceModalOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                ><FilePlus className="h-4 w-4" /> جديدة</button>
              </div>
              {heldInvoices.length > 0 && (
                <div className="relative mt-2">
                  <button data-help="hold-button" type="button" onClick={() => setHeldDropdownOpen((v) => !v)}
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

        <PanelEdgeRail collapsed={panelEffectiveCollapsed} onToggle={togglePanel}
          onResizeStart={(e) => startPanelResize(e, "left")} panelSide="right"
        />

        {/* Main Content (Entry & Grid) */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
          {/* Quick Entry Bar */}
          <section ref={entryBarRef} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shrink-0">
            <div className="entry-bar">
              <EntryItemThumb item={selectedItem} onView={(imgs) => openGallery(imgs)} />

              {/* الصنف */}
              <div data-help="search-bar" className="entry-field entry-field--item">
                <label className="entry-label">الصنف</label>
                <ProductSearchField
                  ref={listItemInputRef}
                  query={itemNameQuery}
                  onQueryChange={(val) => { setItemNameQuery(val); setSelectedItem(null); }}
                  results={itemResults}
                  onPick={(item) => { handleSelectItem(item); setTimeout(() => listQtyRef.current?.focus(), 50); }}
                  selectedItem={selectedItem}
                  onLoadMore={loadMorePOSItems}
                  hasMore={searchedItemHasMore}
                  isLoadingMore={isLoadingMoreItems}
                />
              </div>

              {/* الكمية */}
              <div className="entry-field entry-field--qty">
                <label className="entry-label">الكمية</label>
                <input ref={listQtyRef} type="number"
                  min={selectedItem && units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "0.001"}
                  step={selectedItem && units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "any"}
                  value={staging.quantity}
                  onChange={(e) => {
                    const u = selectedItem ? units.find(u => String(u.id) === String(staging.unitId)) : null;
                    const v = u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value;
                    setStaging(s => ({ ...s, quantity: v }));
                  }}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleListFieldKeyDown(e, listPriceRef, listItemInputRef)}
                  className="entry-control text-center"
                />
              </div>

              {/* السعر — tier select sits above so the number input gets full width */}
              <div className="entry-field entry-field--price">
                <div className="flex items-center justify-between gap-1">
                  <label className="entry-label">السعر</label>
                  <select value={priceType} onChange={(e) => {
                      const t = e.target.value; setPriceType(t);
                      if (!selectedItem) return;
                      if (t === "wholesale" && Number(selectedItem.wholesale_price) > 0) {
                        setStaging((s) => ({ ...s, unitPrice: String(Number(selectedItem.wholesale_price)) }));
                      } else {
                        setStaging((s) => ({ ...s, unitPrice: String(Number(selectedItem.sale_price || selectedItem.price || 0)) }));
                      }
                    }}
                    className="entry-tier-select"
                  >
                    <option value="retail">مستهلك</option>
                    {selectedItem && Number(selectedItem.wholesale_price) > 0 && <option value="wholesale">جملة</option>}
                  </select>
                </div>
                <input ref={listPriceRef} type="number" step="any" value={staging.unitPrice}
                  onChange={(e) => canOverridePrice && setStaging(s => ({ ...s, unitPrice: e.target.value }))}
                  onFocus={e => canOverridePrice && e.target.select()}
                  onKeyDown={(e) => handleListFieldKeyDown(e, listDiscRef, listQtyRef)}
                  readOnly={!canOverridePrice}
                  title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : (lastSalePrice !== null ? `آخر بيع: ${Number(lastSalePrice).toFixed(2)}` : undefined)}
                  className={`entry-control text-center ${selectedItem && Number(staging.unitPrice) > 0 && Number(staging.unitPrice) < Number(selectedItem.purchase_price || 0) ? "entry-control--error" : ""}`}
                />
              </div>

              {/* خصم */}
              <div className="entry-field entry-field--disc">
                <label className="entry-label">خصم</label>
                <input ref={listDiscRef} type="number" min="0" step="any" value={staging.lineDiscount}
                  onChange={(e) => setStaging(s => ({ ...s, lineDiscount: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleListFieldKeyDown(e, listWhRef, listPriceRef)}
                  className="entry-control text-center"
                />
              </div>

              {/* الرصيد / المخزن */}
              <div className="entry-field entry-field--wh">
                <label className="entry-label">الرصيد / المخزن</label>
                <WarehouseSelect
                  ref={listWhRef}
                  value={staging.warehouseId}
                  onChange={(id) => setStaging((s) => ({ ...s, warehouseId: id }))}
                  emptyLabel={selectedItem ? "لا يوجد مخازن" : "اختر صنفاً أولاً"}
                  onKeyDown={(e) => handleListFieldKeyDown(e, listAddBtnRef, listDiscRef)}
                  options={(() => {
                    if (!selectedItem) return [];
                    return warehouses.map((w) => {
                      const rawQty = stockLevels[selectedItem.id]?.[w.id] || 0;
                      const origQty = amendContext ? (amendOriginalQty[`${selectedItem.id}_${w.id}`] || 0) : 0;
                      const inCart = lines.find(l => String(l.item_id) === String(selectedItem.id) && String(l.warehouse_id) === String(w.id))?.quantity || 0;
                      const qty = Math.max(0, rawQty + origQty - inCart);
                      const isInsuff = Number(staging.quantity) > qty;
                      const tone = isInsuff ? "insufficient" : qty <= 0 ? "out" : qty < 5 ? "low" : "normal";
                      return { id: w.id, name: w.name, qty, tone };
                    });
                  })()}
                />
              </div>

              {/* الوحدة */}
              <div className="entry-field entry-field--unit">
                <label className="entry-label">الوحدة</label>
                <div className="entry-control entry-control--readonly">
                  <span className="truncate">
                    {selectedItem && staging.unitId ? (units.find(u => String(u.id) === String(staging.unitId))?.name || "أساسية") : "أساسية"}
                  </span>
                </div>
              </div>

              {/* إضافة */}
              <button ref={listAddBtnRef} onClick={addCurrentLine} disabled={!selectedItem}
                onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addCurrentLine(); } }}
                className="entry-add-btn"
              ><Plus className="h-4 w-4" /> إضافة</button>

              {/* تنبيهات (سطر كامل) */}
              {selectedItem && staging.warehouseId && (() => {
                const itemStock = stockLevels[selectedItem?.id] || stockLevels[String(selectedItem?.id)];
                const totalStock = Number(itemStock?.[staging.warehouseId] ?? itemStock?.[String(staging.warehouseId)] ?? itemStock?.[Number(staging.warehouseId)] ?? 0);
                const inCart = lines.find(l => String(l.item_id) === String(selectedItem.id) && String(l.warehouse_id) === String(staging.warehouseId))?.quantity || 0;
                const remaining = Math.max(0, totalStock - inCart);
                return Number(staging.quantity) > remaining ? (
                  <div className="basis-full flex items-center gap-1.5 rounded bg-rose-50 border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    الكمية ({staging.quantity}) تتجاوز المتاح للإضافة ({remaining}) — الرصيد الكلي {totalStock}{inCart > 0 ? ` (${inCart} في السلة)` : ""}
                  </div>
                ) : null;
              })()}
              {selectedItem && Number(staging.unitPrice) > 0 && Number(staging.unitPrice) < Number(selectedItem.purchase_price || 0) && (
                <div className="basis-full flex items-center gap-1.5 rounded bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  السعر أقل من سعر الشراء ({Number(selectedItem.purchase_price).toFixed(2)}) - ستحتاج موافقة مشرف
                </div>
              )}
            </div>
          </section>

          {/* Lines DataGrid */}
          <div className="flex flex-col flex-1 min-h-0">
            <div ref={colSettingsRef} className="flex items-center justify-between px-1 py-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-400">أصناف الفاتورة ({lines.length})</span>
              {flashAdd && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
              <div className="flex items-center gap-1">
                <button onClick={cycleDensity}
                  className={`p-1.5 rounded-md transition-all ${densityLevel > 0 ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                  title={["عرض عادي", "عرض مضغوط", "عرض فائق الضغط"][densityLevel]}
                >
                  <GripHorizontal className={`h-4 w-4 transition-transform ${densityLevel === 2 ? "rotate-180" : ""}`} />
                </button>
                <div className="relative">
                  <button onClick={() => setColSettingsOpen(p => !p)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                    title="تخصيص الأعمدة"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  {colSettingsOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-xl py-1 animate-[fade-in_0.1s_ease-out]">
                      <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">الأعمدة الظاهرة</div>
                      {ALL_COLUMNS.filter(c => c !== "index" && c !== "actions").map(cid => {
                        const labels = { sku: "الكود", name: "البيان", quantity: "الكمية", unitPrice: "السعر", lineDiscount: "الخصم", warehouseId: "المخزن", unit: "الوحدة", profit_pct: "الربح", barcode: "الباركود", cost_price: "سعر الشراء", category: "التصنيف", wholesale_price: "سعر الجملة", total: "الإجمالي" };
                        return (
                          <label key={cid} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-2sm font-bold text-slate-700">
                            <input type="checkbox" checked={visibleColumns.includes(cid)}
                              onChange={() => setVisibleColumns(p => p.includes(cid) ? p.filter(c => c !== cid) : [...p, cid])}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                            />
                            {labels[cid] || cid}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DataGrid data-help="cart" data={lines}
              rowKey={(row, i) => row.line_key || `${cartLineKey(row)}-${i}`}
              emptyMessage=""
              emptyIcon={
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <ShoppingCart className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="text-sm font-black text-slate-600">فاتورة فارغة</div>
                  <div className="flex flex-col items-center gap-1.5 text-2sm text-slate-400">
                    <span className="font-bold">ابدأ بإضافة الأصناف:</span>
                    <span className="flex items-center gap-1">① ابحث عن الصنف في شريط البحث أعلاه</span>
                    <span className="flex items-center gap-1">② حدد الكمية والسعر والمخزن</span>
                    <span className="flex items-center gap-1">③ اضغط "إضافة" لإدراج الصنف في الفاتورة</span>
                  </div>
                  <span className="text-[11px] text-slate-300 mt-1">يمكنك أيضاً مسح الباركود ضوئياً</span>
                </div>
              }
              className="border-0"
              containerClass={`flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent rounded-2xl border border-slate-100 min-h-0 ${densityLevel === 1 ? "dense-data-grid" : densityLevel === 2 ? "ultra-dense-data-grid" : ""}`}
              renderExpandedRow={null}
              onRowClick={null}
              columns={[
                { id: "index", header: "#", width: 40, sortable: false, headerClass: "text-center hdr-center", cellClass: "text-center number-fmt text-[11px] text-slate-400 border-l border-slate-100", render: (_, i) => i + 1 },
                ...(visibleColumns.includes("sku") ? [{ id: "sku", header: "الكود", width: 75, minWidth: 55, sortable: false, headerClass: "text-center px-1 hdr-center", cellClass: "font-mono text-[10px] text-slate-500 text-center border-l border-slate-100 px-1 truncate", render: (l) => { const item = items.find((it) => it.id === l.item_id); return <span>{item?.item_code || item?.code || l.code || "-"}</span>; } }] : []),
                  ...(visibleColumns.includes("name") ? [{ id: "name", header: "البيان", width: 200, minWidth: 100, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-1 text-center", headerClass: "text-center px-2 hdr-center", render: (l) => {
                      const item = items.find(it => it.id === l.item_id);
                      const imgUrl = item?.primary_image_url || item?.image_url || item?.image || l.primary_image_url;
                      const resolved = imgUrl ? resolveImageUrl(imgUrl) : null;
                      const lineKey = cartLineKey(l);
                      const warnings = lineWarnings[lineKey] || [];
                      const hasError = warnings.some((w) => w.type === "error");
                      return (
                        <div className="flex items-center justify-center gap-1.5 w-full min-w-0">
                          {resolved ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); const imgs = item?.image_urls?.length ? item.image_urls : [resolved]; openGallery(imgs); }}
                              className="shrink-0 rounded overflow-hidden border border-slate-200 hover:border-indigo-300"
                            >
                              <img src={resolved} alt={l.item_name} className="w-[22px] h-[22px] object-cover" />
                            </button>
                          ) : null}
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`whitespace-normal break-words text-2sm font-black leading-tight ${hasError ? "text-rose-700" : "text-slate-800"}`}>{l.item_name}</span>
                            {warnings.length > 0 && (
                              <span className={`shrink-0 text-[8px] font-black px-1 py-0.5 rounded-sm ${warnings.some(w => w.type === "error") ? "text-rose-600 bg-rose-50 border border-rose-200" : "text-amber-700 bg-amber-50 border border-amber-200"}`}
                                title={warnings.map(w => w.msg).join(" | ")}
                              >{warnings.some(w => w.type === "error") ? "خطأ" : "!"}</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                  }] : []),
              ...(visibleColumns.includes("quantity") ? [{ id: "quantity", header: "الكمية", width: 80, minWidth: 60, sortable: true, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100", render: (l, i) => {
                  const maxStock = getLineMaxStock(l.item_id, l.warehouse_id);
                  const hasLimit = stockLoaded && maxStock !== Infinity;
                  const atLimit  = hasLimit && Number(l.quantity) >= maxStock;
                  const remaining = hasLimit ? maxStock - Number(l.quantity) : null;
                  return (
                    <div className={`w-full h-[34px] flex items-center justify-center gap-1 transition-colors ${atLimit ? 'bg-rose-50' : ''}`}
                      title={hasLimit ? `المتاح: ${maxStock}` : undefined}>
                      <input type="number" min="1" step="1" value={l.quantity} max={hasLimit ? maxStock : undefined}
                        onKeyDown={(e) => {
                          if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) { e.preventDefault(); return; }
                          if (hasLimit && e.key >= '0' && e.key <= '9') { const next = Number(String(l.quantity) + e.key); if (next > maxStock) e.preventDefault(); }
                        }}
                        onChange={(e) => { const v = Math.max(1, Math.floor(Number(e.target.value) || 1)); updateLine(cartLineKey(l), { quantity: hasLimit ? Math.min(v, maxStock) : v }); }}
                        className={`w-[40px] text-center number-fmt text-sm bg-transparent outline-none border-0 ring-0 leading-none ${atLimit ? 'text-rose-600' : ''}`}
                      />
                      {hasLimit && <span className={`text-[8px] font-black leading-none shrink-0 ${atLimit ? 'text-rose-500' : 'text-slate-400'}`}>{atLimit ? 'نفد' : remaining}</span>}
                    </div>
                  );
                }
              }] : []),
              ...(visibleColumns.includes("unitPrice") ? [{ id: "unitPrice", header: "السعر", width: 90, minWidth: 70, sortable: true, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100", render: (l) => {
                  const isOverride = l.item_id !== -1 && l.master_sale_price > 0 && Math.abs(Number(l.unit_price) - Number(l.master_sale_price)) > 0.001;
                  return (
                    <div className="relative w-full" title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : undefined}>
                      <input type="number" step="any" value={l.unit_price}
                        onChange={(e) => canOverridePrice && updateLine(cartLineKey(l), { unit_price: Number(e.target.value) || 0 })}
                        readOnly={!canOverridePrice}
                        className={`w-full h-[34px] text-center number-fmt-primary text-xs outline-none border-0 ring-0 focus:ring-0 transition-colors ${!canOverridePrice ? "bg-slate-50 text-slate-500 cursor-not-allowed" : isOverride ? "bg-amber-50 text-amber-800 focus:bg-amber-100" : "bg-transparent focus:bg-indigo-50/50"}`} />
                      {isOverride && <span title={`السعر الأصلي: ${Number(l.sale_price).toFixed(2)}`} className="absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 pointer-events-none" />}
                    </div>
                  );
                }
              }] : []),
              ...(visibleColumns.includes("lineDiscount") ? [{ id: "lineDiscount", header: "خصم", width: 90, minWidth: 70, sortable: false, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100", render: (l) => {
                  const lineKey = cartLineKey(l);
                  const mode = discountModes[lineKey] || "flat";
                  const lineMax = Number(l.unit_price) * Number(l.quantity);
                  const flatDisc = Number(l.line_discount || 0);
                  const pctVal = lineMax > 0 ? (flatDisc / lineMax) * 100 : 0;
                  const isOver = flatDisc > lineMax && lineMax > 0;
                  return (
                    <div className="flex items-center h-[34px] px-1 gap-0.5">
                      <input type="number" min="0" step="any"
                        value={mode === "pct" ? parseFloat(pctVal.toFixed(2)) : flatDisc}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          if (mode === "pct") { const flat = parseFloat(((v / 100) * lineMax).toFixed(4)); updateLine(lineKey, { line_discount: Math.min(flat, lineMax) }); }
                          else { updateLine(lineKey, { line_discount: Math.min(v, lineMax) }); }
                        }}
                        className={`w-full h-[24px] text-center number-fmt-primary text-2sm bg-transparent outline-none border rounded-sm transition-colors ${isOver ? "border-rose-400 bg-rose-50/50 text-rose-700 focus:border-rose-600" : "border-slate-200 focus:border-amber-400 focus:bg-amber-50/50"}`}
                      />
                      <button type="button" onClick={() => setDiscountModes((m) => ({ ...m, [lineKey]: mode === "pct" ? "flat" : "pct" }))}
                        className={`h-[24px] px-1.5 rounded-sm text-[10px] font-black border transition-colors shrink-0 ${mode === "pct" ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200"}`}
                      >{mode === "pct" ? "%" : "ج"}</button>
                    </div>
                  );
                }
              }] : []),
              ...(visibleColumns.includes("warehouseId") ? [{ id: "warehouseId", header: "المخزن", width: 100, minWidth: 70, sortable: false, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100 relative", render: (l) => {
                  const whStock = stockLevels[l.item_id] || stockLevels[Number(l.item_id)] || stockLevels[String(l.item_id)] || {};
                  const lineQty = Number(l.quantity) || 1;
                  const currentWhId = l.warehouse_id || staging.warehouseId;
                  const currentStock = whStock[currentWhId] || 0;
                  const hasShortage = currentStock < lineQty;
                  return (
                    <div className="relative w-full">
                      <select value={currentWhId}
                        onChange={(e) => updateLine(cartLineKey(l), { warehouse_id: e.target.value })}
                        className={`w-full h-[34px] text-[10px] font-bold outline-none border-0 ring-0 text-center truncate transition-colors cursor-pointer ${hasShortage ? "bg-rose-50 text-rose-700" : "bg-transparent text-slate-700 focus:bg-indigo-50"}`}>
                        {getFilteredWarehouses(l.item_id, l.warehouse_id).map(w => {
                          const sqty = whStock[w.id] || 0;
                          const insufficient = sqty < lineQty && String(w.id) !== String(currentWhId);
                          return <option key={w.id} value={w.id} disabled={insufficient}>{w.name}</option>;
                        })}
                      </select>
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] number-fmt pointer-events-none" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                        {currentStock}
                      </span>
                    </div>
                  );
                }
              }] : []),
              ...(visibleColumns.includes("unit") ? [{ id: "unit", header: "الوحدة", width: 65, minWidth: 50, sortable: false, headerClass: "text-center hdr-center", cellClass: "text-center text-[10px] font-bold text-slate-600 border-l border-slate-100 px-1 truncate", render: (l) => l.unit_name || "أساسية" }] : []),
              ...(canViewProfit && visibleColumns.includes("profit_pct") ? [{
                id: "profit_pct", header: "الربح", width: 80, minWidth: 60, sortable: false, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l) => {
                  const item = items.find(i => String(i.id) === String(l.item_id));
                  const cost = Number(item?.purchase_price || item?.current_cost || 0);
                  const price = Number(l.unit_price || 0);
                  const profitFlat = price - cost;
                  const pct = cost > 0 ? (profitFlat / cost) * 100 : null;
                  const isProfit = profitFlat >= 0;
                  return (
                    <div className="relative w-full h-full flex items-center justify-center gap-0.5">
                      <span className={`number-fmt-primary text-2sm ${cost <= 0 ? "text-slate-500" : isProfit ? "text-emerald-700" : "text-rose-600"}`}>
                        {cost <= 0
                          ? `${profitFlat >= 0 ? "+" : ""}${profitFlat.toFixed(2)}`
                          : profitDisplayMode === "pct"
                            ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
                            : `${profitFlat >= 0 ? "+" : ""}${profitFlat.toFixed(2)}`}
                      </span>
                      {cost > 0 && <button onClick={(e) => { e.stopPropagation(); setProfitDisplayMode(m => m === "pct" ? "flat" : "pct"); }}
                        className={`shrink-0 h-4 px-1 flex items-center justify-center rounded-sm text-[8px] font-black border transition-all ${profitDisplayMode === "pct" ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100" : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"}`}>
                        {profitDisplayMode === "pct" ? "%" : "ج"}
                      </button>}
                    </div>
                  );
                }
              }] : []),
              ...(visibleColumns.includes("barcode") ? [{ id: "barcode", header: "الباركود", width: 100, minWidth: 70, sortable: false, headerClass: "text-center hdr-center", cellClass: "font-mono text-[10px] text-slate-500 text-center border-l border-slate-100 px-1 truncate", render: (l) => { const item = items.find((it) => it.id === l.item_id); return <span>{item?.barcode || l.item_barcode || "-"}</span>; } }] : []),
              ...(visibleColumns.includes("cost_price") ? [{ id: "cost_price", header: "سعر الشراء", width: 85, minWidth: 60, sortable: true, headerClass: "text-center hdr-center", cellClass: "text-center number-fmt-primary text-[10px] text-slate-500 border-l border-slate-100 px-1", render: (l) => { const item = items.find((it) => it.id === l.item_id); return <span>{Number(item?.purchase_price || item?.current_cost || 0).toFixed(2)}</span>; } }] : []),
              ...(visibleColumns.includes("category") ? [{ id: "category", header: "التصنيف", width: 90, minWidth: 60, sortable: true, headerClass: "text-center hdr-center", cellClass: "text-center text-[10px] text-slate-500 border-l border-slate-100 px-1 truncate", render: (l) => { const item = items.find((it) => it.id === l.item_id); return <span>{item?.category_name || l.category_name || "-"}</span>; } }] : []),
              ...(visibleColumns.includes("wholesale_price") ? [{ id: "wholesale_price", header: "سعر الجملة", width: 80, minWidth: 60, sortable: true, headerClass: "text-center hdr-center", cellClass: "text-center number-fmt-primary text-[10px] text-slate-500 border-l border-slate-100 px-1", render: (l) => { const item = items.find((it) => it.id === l.item_id); const wp = item?.wholesale_price || 0; return <span className={wp > 0 ? 'text-amber-700' : 'text-slate-400'}>{wp > 0 ? Number(wp).toFixed(2) : "-"}</span>; } }] : []),
              ...(visibleColumns.includes("total") ? [{ id: "total", header: "الإجمالي", width: 90, minWidth: 70, sortable: true, headerClass: "text-center px-2 hdr-center", cellClass: "text-center px-2 number-fmt-primary text-xs text-slate-900 bg-slate-50/50 border-l border-slate-100 truncate", render: (l) => formatMoney(l.quantity * l.unit_price - (l.line_discount || 0)) }] : []),
              { id: "actions", header: "إجراءات", width: 70, minWidth: 60, sortable: false, headerClass: "text-center hdr-center", cellClass: "p-0 text-center", render: (row) => {
                  const key = cartLineKey(row);
                  const armed = confirmDelKey === key;
                  return (
                    <button
                      onClick={() => {
                        if (armed) { clearTimeout(delTimerRef.current); setConfirmDelKey(null); handleRemoveWithUndo(row); }
                        else {
                          setConfirmDelKey(key);
                          clearTimeout(delTimerRef.current);
                          delTimerRef.current = setTimeout(() => setConfirmDelKey(null), 3000);
                        }
                      }}
                      title={armed ? "اضغط مرة أخرى للتأكيد" : "حذف الصنف"}
                      className={`inline-flex h-[34px] w-full items-center justify-center gap-1 transition-all duration-150 ${
                        armed
                          ? "bg-rose-500 text-white font-black text-[10px] shadow-inner"
                          : "text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                      }`}
                    >
                      {armed
                        ? <><Trash2 className="h-3.5 w-3.5" /><span>تأكيد</span></>
                        : <X className="h-3.5 w-3.5" />}
                    </button>
                  );
                }
              },
            ]}
          />
        </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <PrintPreviewModal open={printPreview} onClose={() => setPrintPreview(false)} docType="pos_receipt"
        invoice={{
          invoice_no: docNo || invoiceNumber, created_at: new Date().toISOString(),
          customer_name: customer?.name,
          lines: lines.map(l => ({ item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, discount_amount: l.line_discount || 0, unit_name: l.unit_name || "", code: l.code || "" })),
          payments: paymentType === "multi" ? [
            ...(Number(multiCash) > 0 ? [{ method: "cash", method_name: "نقدي", amount: Number(multiCash) }] : []),
            ...customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦' && Number(multiCustomAmounts[m.id]||0) > 0).map(m => ({ method_id: m.id, method_name: m.name, amount: Number(multiCustomAmounts[m.id]) })),
            ...(Number(multiCredit) > 0 && customer?.id ? [{ method: "credit", method_name: "آجل", amount: Number(multiCredit) }] : []),
          ] : paymentType === "installments"
            ? (Number(amountPaid) > 0 ? [{ method: "cash", method_name: "دفعة مقدمة", amount: Number(amountPaid) }] : [])
            : [{ method: paymentType, method_name: { cash: "نقدي", credit: "آجل", bank: "بنك" }[paymentType] || paymentType, amount: totals.total }],
          ...(paymentType === "installments" ? { installment_plan: installmentRows.map((r, i) => ({ installment_no: i + 1, due_date: r.due_date, amount: Number(r.amount || 0), status: "pending" })) } : {}),
          notes: invoiceNotes || null,
          discount: Number(discount || 0) + Number(promotionDiscount || 0),
          increase: Number(increase || 0),
          total: totals.total,
          tax_enabled: taxCalc.taxAmount > 0 ? 1 : 0,
          tax_amount: taxCalc.taxAmount,
          tax_rate: taxCalc.taxAmount > 0 ? (taxRate != null ? Number(taxRate) : Number(storeSettings?.tax_rate || 0)) : 0,
          tax_type: storeSettings?.tax_type || null,
        }}
        settings={storeSettings} operationLabel="فاتورة مبيعات نقدية"
        onConfirmPrint={() => saveInvoice(false)} confirmLabel="حفظ وطباعة"
        onSaveOnly={() => saveInvoice(false)} saveOnlyLabel="حفظ فقط" isSaving={isSaving}
      />
      <GalleryModal open={galleryOpen} onClose={() => { setGalleryOpen(false); setGalleryZoom(1); }}
        images={galleryImages} idx={galleryIdx} setIdx={setGalleryIdx} zoom={galleryZoom} setZoom={setGalleryZoom}
      />
      <POSTodayModal open={receiptsOpen} onClose={() => setReceiptsOpen(false)} />

      {/* Supervisor override modal */}
      <Modal open={supervisorOverrideOpen} onClose={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }} title="تجاوز حد الخصم">
        <div className="space-y-4 text-center animate-modal-enter">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mx-auto"><ShieldCheck className="h-7 w-7 text-amber-600" /></div>
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
            <button onClick={() => {
                api.put("/api/settings", { ...storeSettings, default_pos_view: pendingViewMode })
                  .then(() => { setStoreSettings(s => ({ ...s, default_pos_view: pendingViewMode })); setSaveMessage("تم حفظ تفضيل العرض"); setTimeout(() => setSaveMessage(""), 3000); })
                  .catch((e) => { setSaveMessage(e.response?.data?.message || "فشل الحفظ"); setTimeout(() => setSaveMessage(""), 4000); });
                setShowSetDefaultModal(false);
              }}
              className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-white hover:bg-primary-600 transition-all active:scale-[0.98]"
            >نعم، احفظه كافتراضي</button>
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
                <div><p className="text-sm font-black text-amber-800">يوجد أصناف في الفاتورة الحالية</p><p className="text-2sm font-bold text-amber-700 mt-1">اختر كيف تريد المتابعة:</p></div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setNewInvoiceModalOpen(false); saveInvoice(false); }} disabled={isSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                >{isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><Sparkles className="h-4 w-4" /> حفظ الحالية وإنشاء جديدة</>}</button>
                <button onClick={() => { setNewInvoiceModalOpen(false); holdCurrentInvoice(); clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1); toast.success("تم تعليق الفاتورة"); }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100 transition-all active:scale-[0.98]"
                ><PauseCircle className="h-4 w-4" /> تعليق الحالية وإنشاء جديدة</button>
                <button onClick={() => { setNewInvoiceModalOpen(false); clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1); }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
                ><Trash2 className="h-4 w-4" /> تجاهل وإنشاء جديدة</button>
                <button onClick={() => setNewInvoiceModalOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <FilePlus className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div><p className="text-sm font-black text-emerald-800">إنشاء فاتورة جديدة</p><p className="text-2sm font-bold text-emerald-700 mt-1">الفاتورة الحالية فارغة</p></div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setNewInvoiceModalOpen(false); clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1); }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all active:scale-[0.98]"
                ><FilePlus className="h-4 w-4" /> إنشاء فاتورة جديدة</button>
                <button onClick={() => setNewInvoiceModalOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">إلغاء</button>
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
            <div><p className="text-sm font-black text-emerald-800">هل أنت متأكد من حفظ الفاتورة؟</p><p className="text-2sm font-bold text-emerald-700 mt-1">سيتم حفظ الفاتورة بقيمة {formatMoney(totals.total)}</p></div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setSaveConfirmOpen(false); saveInvoice(false); }} disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-[0.98]"
            >{isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : "تأكيد الحفظ"}</button>
            <button onClick={() => setSaveConfirmOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
          </div>
        </div>
      </Modal>

      {/* Cancel Invoice Modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="إلغاء الفاتورة">
        <div className="flex flex-col gap-4 mt-2 animate-modal-enter">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
            <Trash2 className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div><p className="text-sm font-black text-rose-800">هل تريد إلغاء الفاتورة الحالية؟</p><p className="text-2sm font-bold text-rose-700 mt-1">سيتم حذف جميع الأصناف المضافة</p></div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setCancelModalOpen(false); clear(); resetPaymentFields(); resetStaging(); resetCustomer(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1); }}
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 transition-all active:scale-[0.98]"
            ><Trash2 className="h-4 w-4" /> نعم، إلغاء الفاتورة</button>
            <button onClick={() => setCancelModalOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]">تراجع</button>
          </div>
        </div>
      </Modal>

      {saveMessage && (
        <div className="absolute left-1/2 top-20 z-[150] -translate-x-1/2 rounded-sm border border-rose-200 bg-rose-50 px-5 py-2.5 font-bold text-sm text-rose-700 shadow-xl animate-fade-in">{saveMessage}</div>
      )}
      {saveSuccess && <InvoiceSaveSuccess invoiceNumber={saveSuccess.invoiceNumber} total={saveSuccess.total} payments={saveSuccess.payments} customerName={saveSuccess.customerName} customerNewBalance={saveSuccess.customerNewBalance} discount={saveSuccess.discount} increase={saveSuccess.increase} onDismiss={onDismissSaveSuccess} />}

      <InvoiceProfitModal open={profitModalOpen} onClose={() => setProfitModalOpen(false)} lines={lines} items={items} />
      <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />
      <AddCustomerModal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} onCreated={(customer) => { setCustomers((prev) => [customer, ...prev]); setCustomer(customer); setCustomerQuery(customer.name); }} />
      <QuickAddLeadPopover open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <CustomerInfoModal open={customerInfoOpen} customerId={customer?.id} onClose={() => setCustomerInfoOpen(false)} onUpdated={(updated) => { setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c)); setCustomer(updated); setCustomerQuery(updated.name); }} />
      <UnsavedChangesModal open={blocker.state === "blocked"} onStay={() => blocker.reset?.()} onLeave={() => { clearActiveDraftFromDB(); blocker.proceed?.(); }} />
    </div>
  );
}