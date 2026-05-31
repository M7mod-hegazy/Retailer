import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  User,
  Package,
  Calendar,
  FileText,
  ChevronDown,
  ArrowLeft,
  X,
  Clock,
  CheckCircle2,
  FileSearch,
  ImageIcon,
  ZoomIn,
  AlertTriangle,
  Save
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate } from "react-router-dom";
import DataGrid from "../../components/ui/DataGrid";
import Modal from "../../components/ui/Modal";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";
import PermissionGate from "../../components/ui/PermissionGate";


const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5000");
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  
  const ITEM_PAGE = 20;

  // --- Data States ---
  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  
  // Form States
  const [supplier, setSupplier] = useState(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  
  // Entry States
  const [itemQuery, setItemQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ quantity: "1", unitCost: "", unitId: "" });
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);

  // Refs
  const itemInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const unitSelectRef = useRef(null);
  const costInputRef = useRef(null);
  const addBtnRef = useRef(null);
  const pendingPickRef    = useRef(false);
  const itemSearchActiveRef = useRef(false);

  // --- Keyboard Navigation Hook ---
  const handleFieldKeyDown = (e, nextRef, prevRef, isEnterSubmit = false) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (prevRef?.current) {
          prevRef.current.focus();
          if (prevRef.current.select) prevRef.current.select();
        }
      } else {
        if (isEnterSubmit) addLine();
        else if (nextRef?.current) {
          nextRef.current.focus();
          if (nextRef.current.select) nextRef.current.select();
        }
      }
    }
  };

  // --- Init ---
  useEffect(() => {
    api.get("/api/suppliers").then(r => setSuppliers(r.data.data || [])).catch(() => {});
    api.get("/api/units").then(r => setUnits(r.data.data || [])).catch(() => {});
    api.get("/api/stock/levels").then(r => {
      const grouped = {};
      (r.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = 0;
        grouped[row.item_id] += row.quantity;
      });
      setStockLevels(grouped);
    }).catch(() => {});
  }, []);

  // --- Item search ---
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
            sub_label: `مخزون: ${stockLevels[i.id] || 0}`,
            price_label: `${i.purchase_price || 0}`,
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
  }, [itemQuery, stockLevels]);

  function loadMoreItems() {
    const q = itemQuery.trim();
    if (!itemHasMore || !q || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = (r.data.data || []).map(i => ({
          ...i,
          sub_label: `مخزون: ${stockLevels[i.id] || 0}`,
          price_label: `${i.purchase_price || 0}`,
        }));
        setFilteredItems(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    return suppliers
      .filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone).includes(q))
      .slice(0, 8);
  }, [supplierQuery, suppliers]);

  // --- Logic ---
  function handlePickItem(item) {
    setSelectedItem(item);
    setItemQuery(item.name);
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
    setStaging(prev => ({
      ...prev,
      unitCost: String(item.purchase_price || 0),
      unitId: String(item.unit_id || prev.unitId)
    }));
    setLookupOpen(false);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  }

  function handlePickSupplier(s) {
    setSupplier(s);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
  }

  function addLine() {
    if (!selectedItem) return;
    const qty = Number(staging.quantity || 1);
    const cost = Number(staging.unitCost || 0);
    
    setLines(prev => [
      ...prev,
      {
        item_id: selectedItem.id,
        name: selectedItem.name,
        code: selectedItem.code || selectedItem.barcode,
        quantity: qty,
        unit_cost: cost,
        unit_id: staging.unitId || null,
        total: qty * cost
      }
    ]);
    
    setSelectedItem(null);
    setItemQuery("");
    setStaging({ quantity: "1", unitCost: "", unitId: "" });
    setTimeout(() => {
      itemInputRef.current?.focus();
      itemInputRef.current?.select();
    }, 50);
  }

  const totals = useMemo(() => ({
    total: lines.reduce((acc, l) => acc + l.total, 0),
    items: lines.length
  }), [lines]);

  async function handleSave() {
    if (!supplier) { setMessage({ text: "اختر المورد اولاً", type: "error" }); return; }
    if (!lines.length) { setMessage({ text: "لا يوجد اصناف", type: "error" }); return; }
    
    setIsSaving(true);
    try {
      await api.post("/api/purchase-orders", {
        supplier_id: supplier.id,
        notes: notes,
        lines: lines.map(l => ({
          item_id: l.item_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost
        }))
      });
      setMessage({ text: "تم إنشاء أمر الشراء بنجاح", type: "success" });
      setTimeout(() => navigate("/purchases/orders"), 1500);
    } catch (e) {
      setMessage({ text: "فشل حفظ أمر الشراء", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden px-4 lg:px-8 pb-6">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { if (lines.length > 0) setWarnModalOpen(true); else navigate("/purchases/orders"); }} 
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">طلب توريد جديد (Purchase Order)</h1>
            <span className="text-[10px] font-bold text-slate-400">تخطيط المشتريات المستلمة لاحقاً</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {message.text && (
            <div className={`rounded-sm px-3 py-1.5 text-[11px] font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
              {message.text}
            </div>
          )}
          <PermissionGate page="purchase_orders" action="add">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              {isSaving ? "جاري الحفظ..." : "إرسال طلب التوريد"}
            </button>
          </PermissionGate>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Main Content Area */}
          <div className="flex flex-1 flex-col gap-3 min-w-0">
            {/* Supplier & Info Section */}
            <section className="grid grid-cols-3 gap-4 rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                <div className="relative flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">المورد المقترح</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={supplierQuery}
                      onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); }}
                      onFocus={() => setSupplierLookupOpen(true)}
                      onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                      placeholder="ابحث عن مورد..."
                      className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                    />
                    {supplierLookupOpen && (
                      <SearchDropdown 
                        items={filteredSuppliers} 
                        onPick={handlePickSupplier} 
                        activeIndex={activeSupplierIndex}
                        emptyLabel="لا يوجد مورد"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[11px] font-bold text-slate-600">ملاحظات الطلب</label>
                  <div className="relative">
                    <FileText className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أية تعليمات خاصة للتوريد..."
                      className="w-full border border-slate-300 rounded-sm bg-white py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                    />
                  </div>
                </div>
            </section>

            {/* Quick Entry Bar */}
            <section className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
              <div className="grid grid-cols-[3fr_100px_100px_120px_100px] gap-2 items-end">
                <div className="relative flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">البحث عن صنف</label>
                  <div className="relative">
                    <SearchInput
                      ref={itemInputRef}
                      value={itemQuery}
                      onChange={(val) => { setItemQuery(val); setLookupOpen(true); setSelectedItem(null); }}
                      onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
                      onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
                      placeholder="ابحث بالاسم، الباركود، أو الكود..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const q = itemQuery.trim();
                          if (filteredItems.length > 0) { handlePickItem(filteredItems[activeIndex] || filteredItems[0]); }
                          else if (itemSearchActiveRef.current) { pendingPickRef.current = true; }
                          else if (q) handlePickItem({ id: -1, name: q, code: q, barcode: q, purchase_price: 0, sale_price: 0 });
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setActiveIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
                        }
                      }}
                    />
                    {lookupOpen && (
                      <SearchDropdown
                        items={filteredItems}
                        onPick={handlePickItem}
                        activeIndex={activeIndex}
                        query={itemQuery}
                        emptyLabel="الصنف غير موجود"
                        rawText={itemQuery}
                        onPickRawText={(txt) => handlePickItem({ id: -1, name: txt, code: txt, barcode: txt, purchase_price: 0, sale_price: 0 })}
                        onLoadMore={loadMoreItems}
                        hasMoreFromServer={itemHasMore}
                        isLoadingMore={isLoadingMoreItems}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الكمية المطلوبة</label>
                  <input 
                    ref={qtyInputRef}
                    type="number"
                    min="0.001"
                    step="any"
                    value={staging.quantity}
                    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, unitSelectRef, itemInputRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-3 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                  <div className="relative">
                    <select
                      ref={unitSelectRef}
                      value={staging.unitId}
                      onChange={(e) => setStaging(s => ({ ...s, unitId: e.target.value }))}
                      onKeyDown={(e) => handleFieldKeyDown(e, costInputRef, qtyInputRef)}
                      className="w-full h-[37px] appearance-none border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                    >
                      <option value="">أساسية</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <ChevronDown className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">التكلفة المتوقعة</label>
                  <input 
                    ref={costInputRef}
                    type="number"
                    step="any"
                    value={staging.unitCost}
                    onChange={(e) => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleFieldKeyDown(e, addBtnRef, unitSelectRef, true)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-3 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>
                <button 
                  ref={addBtnRef}
                  onClick={addLine}
                  onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addLine(); } }}
                  disabled={!selectedItem}
                  className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-slate-800 px-6 text-[12px] font-black text-white hover:bg-slate-700 disabled:opacity-40 transition-all"
                >
                  <Plus className="h-4 w-4" /> إدراج
                </button>
              </div>
            </section>

            {/* Grid */}
            <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-300 bg-white min-h-0">
              <DataGrid
                data={lines}
                rowKey={(row, i) => i}
                emptyMessage="أمر الشراء فارغ حالياً"
                emptyIcon={<FileSearch className="h-14 w-14 mb-4" />}
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                columns={[
                  {
                    id: "index", header: "#", width: 40, sortable: false, headerClass: "text-center", cellClass: "text-center font-mono text-[12px] text-slate-400 border-l border-slate-100",
                    render: (_, i) => i + 1
                  },
                  {
                    id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[12px] font-black tracking-wider text-slate-500 border-l border-slate-100 text-center",
                    render: (l) => l.barcode || l.code || l.item_code || '-'
                  },
                  {
                    id: "name", header: "عنوان الصنف والباركود", width: 220, sortable: true, cellClass: "font-bold text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                    render: (l) => {
                      const item = items.find(i => i.id === l.item_id);
                      const imgUrl = item?.primary_image_url || item?.image_url || item?.image;
                      return (
                        <div className="flex items-center gap-2 py-1">
                          {imgUrl ? (
                            <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                              <img src={resolveImageUrl(imgUrl)} alt={l.name} className="w-8 h-8 object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                          )}
                          <span className="truncate">{l.name}</span>
                        </div>
                      );
                    }
                  },
                  {
                    id: "quantity", header: "الكمية", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[13px] text-slate-800 border-l border-slate-100",
                    render: (l) => Number(l.quantity)
                  },
                  {
                    id: "unit_cost", header: "سعر الوحدة", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[13px] text-slate-500 border-l border-slate-100",
                    render: (l) => Number(l.unit_cost).toLocaleString("en-US", { minimumFractionDigits: 2 })
                  },
                  {
                    id: "total", header: "إجمالي المتوقع", width: 140, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-slate-900 bg-slate-50/50 border-l-0",
                    sortValue: (l) => l.total,
                    render: (l) => Number(l.total).toLocaleString("en-US", { minimumFractionDigits: 2 })
                  },
                  {
                    id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center border-l-0",
                    render: (_, i) => (
                      <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} className="inline-flex h-[40px] w-full items-center justify-center text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition-colors focus:outline-none">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  }
                ]}
              />
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
                 <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                       <span className="text-[11px] font-bold text-slate-400">إجمالي الأصناف:</span>
                       <span className="text-[13px] font-black text-slate-700">{totals.items}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[11px] font-bold text-slate-400">إجمالي الكميات:</span>
                       <span className="text-[13px] font-black text-slate-700 font-mono">{lines.reduce((acc, l) => acc + l.quantity, 0)}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">القيمة الإجمالية المتوقعة</span>
                    <span className="text-[20px] font-black text-slate-900 font-mono">{totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    <span className="text-[10px] font-bold text-slate-400">ج.م</span>
                 </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="w-[320px] flex flex-col gap-4">
             <div className="rounded-md border border-slate-300 bg-white p-5 shadow-md">
                <h3 className="mb-4 text-[12px] font-black text-slate-800 border-b pb-2 border-slate-100 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" /> حالة الطلب
                </h3>
                <div className="space-y-3">
                   <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-amber-700">
                         <Plus className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[12px] font-black text-amber-900">مسودة (Pending)</span>
                         <span className="text-[10px] text-amber-600 font-bold">في انتظار المراجعة</span>
                      </div>
                   </div>
                   <p className="text-[11px] leading-relaxed text-slate-400 text-center font-bold">
                     تنبيه: تحويل أمر الشراء إلى "فاتورة مشتريات" سيتم فور استلام البضاعة في المخازن من خلال لوحة الاستلام.
                   </p>
                </div>
             </div>

             <div className="rounded-md border border-slate-200 bg-white p-5 flex-1 flex flex-col justify-end">
                 <button 
                  onClick={handleSave} 
                  className="w-full rounded-sm bg-slate-800 py-4 text-[14px] font-black text-white hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                 >
                   اعتماد وإرسال الطلب
                 </button>
             </div>
          </aside>
        </div>
      </main>
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

      {/* Confirm Leave Warning Modal */}
      <Modal open={warnModalOpen} onClose={() => setWarnModalOpen(false)} title="تحذير: مغادرة الصفحة" size="md">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">تجاهل التغييرات؟</h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في المغادرة؟ سيتم <span className="text-rose-600">فقدان جميع بيانات أمر الشراء</span> التي أدخلتها.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setWarnModalOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50">
              تراجع وإكمال الطلب
            </button>
            <button onClick={() => navigate("/purchases/orders")} className="rounded-sm bg-rose-600 px-5 py-2 text-[13px] font-black text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20">
              نعم، تجاهل ومغادرة
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
