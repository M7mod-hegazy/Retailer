import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  User,
  Package,
  Search,
  ShoppingCart,
  Receipt,
  Printer,
  Save,
  ChevronLeft,
  Info,
  CheckCircle2,
  Calendar,
  X,
  ImageIcon,
  ZoomIn,
  AlertTriangle
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import SearchDropdown from "../../components/ui/SearchDropdown";

import PermissionGate from "../../components/ui/PermissionGate";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}



function formatMoney(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

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
  
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/api/customers"),
      api.get("/api/items"),
      editId ? api.get(`/api/quotations/${editId}`) : null
    ]).then(([cust, itm, edit]) => {
      setCustomers(cust.data.data || []);
      setItems(itm.data.data || []);
      if (edit) {
        const q = edit.data.data;
        setSelectedCustomer(cust.data.data.find(c => c.id === q.customer_id));
        setCart(q.lines.map(l => ({
           id: l.item_id,
           name: l.item_name,
           code: l.item_code || "",
           price: l.unit_price,
           qty: l.quantity,
           discount: l.discount_amount || 0
        })));
        setNotes(q.notes || "");
        setExpiresAt(q.expires_at || "");
      }
    }).finally(() => setLoading(false));
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

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, code: item.code, price: item.sale_price, qty: 1, discount: 0 }];
    });
    setSearchItem("");
    setFilteredItems([]);
    setItemOffset(0);
    setItemHasMore(false);
  }

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const discount = cart.reduce((acc, i) => acc + Number(i.discount || 0), 0);
    return { subtotal, discount, total: subtotal - discount };
  }, [cart]);

  async function handleSave() {
    if (!selectedCustomer) return alert("يرجى اختيار عميل");
    if (!cart.length) return alert("السلة فارغة");

    setIsSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        notes,
        expires_at: expiresAt || null,
        lines: cart.map(i => ({
          item_id: i.id,
          quantity: i.qty,
          unit_price: i.price,
          discount_amount: i.discount,
          description: i.name
        }))
      };
      if (editId) await api.put(`/api/quotations/${editId}`, payload);
      else await api.post("/api/quotations", payload);
      navigate("/operations/quotations");
    } catch (e) {
      alert("فشل حفظ عرض السعر");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-[#F9FAFB] font-sans overflow-hidden px-4 lg:px-8 pb-6">
      {/* Workspace Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => {
               if (cart.length > 0) setWarnModalOpen(true);
               else navigate("/operations/quotations");
             }} 
             className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-400 hover:text-slate-800 transition-colors"
           >
              <ArrowLeft className="h-4 w-4" />
           </button>
           <div className="flex flex-col">
              <h1 className="text-[14px] font-black uppercase text-slate-800 tracking-tight">{editId ? "تعديل عرض سعر" : "محرر عروض الأسعار"}</h1>
              <span className="text-[10px] font-bold text-slate-400">إنشاء عروض أسعار احترافية موجهة للعملاء</span>
           </div>
        </div>

        <div className="flex items-center gap-2">
           <PermissionGate page="quotations" action={editId ? "edit" : "add"}>
             <button 
               onClick={handleSave}
               disabled={isSaving}
               className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 transition-all shadow-sm"
             >
               <Save className="h-4 w-4" /> {isSaving ? "جاري الحفظ..." : "حفظ العرض"}
             </button>
           </PermissionGate>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
         {/* Main Workspace: Cart & Items */}
         <div className="flex flex-1 flex-col p-4 gap-4 overflow-hidden">
            {/* Search Top Bar */}
            <div className="flex gap-4">
               <div className="relative flex-1 z-30">
                  <SearchInput 
                    value={searchItem}
                    onChange={(val) => { setSearchItem(val); setLookupOpen(true); }}
                    onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
                    onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
                    placeholder="ابحث عن صنف بالاسم، الباركود، أو الكود..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const q = searchItem.trim();
                        if (filteredItems.length > 0) addToCart(filteredItems[activeIndex]);
                        else if (q) addToCart({ id: -1, name: q, code: q, barcode: q, sale_price: 0, price: 0, stock_total: 0, stock_quantity: 0 });
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
                      onPick={addToCart}
                      activeIndex={activeIndex}
                      query={searchItem}
                      emptyLabel="الصنف غير موجود"
                      rawText={searchItem}
                      onPickRawText={(txt) => addToCart({ id: -1, name: txt, code: txt, barcode: txt, sale_price: 0, price: 0, stock_total: 0, stock_quantity: 0 })}
                      onLoadMore={loadMoreItems}
                      hasMoreFromServer={itemHasMore}
                      isLoadingMore={isLoadingMoreItems}
                    />
                  )}
               </div>
            </div>

            {/* Cart Table */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
               <div className="grid grid-cols-[50px_minmax(200px,3fr)_120px_100px_100px_120px_50px] items-center border-b border-slate-300 bg-slate-50 text-[11px] font-black uppercase text-slate-500">
                  <div className="px-4 py-2.5 border-l border-slate-200 text-center">#</div>
                  <div className="px-4 py-2.5 border-l border-slate-200">الأصناف</div>
                  <div className="px-4 py-2.5 border-l border-slate-200 text-center">سعر الوحدة</div>
                  <div className="px-4 py-2.5 border-l border-slate-200 text-center">الكمية</div>
                  <div className="px-4 py-2.5 border-l border-slate-200 text-center">الخصم</div>
                  <div className="px-4 py-2.5 border-l border-slate-200 text-left">الإجمالي</div>
                  <div></div>
               </div>

               <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                  {cart.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-300">
                       <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                       <p className="text-[14px] font-black">عرض السعر فارغ</p>
                       <p className="text-[11px] font-bold opacity-60">ابدأ بإضافة الأصناف للعرض</p>
                    </div>
                  ) : cart.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-[50px_minmax(200px,3fr)_120px_100px_100px_120px_50px] items-center text-[12px] hover:bg-slate-50 transition-colors">
                       <div className="px-4 py-3 text-center font-mono text-slate-400 border-l border-slate-50">{idx + 1}</div>
                       <div className="px-4 py-3 font-black text-slate-800 border-l border-slate-50">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const itemObj = items.find(i => i.id === item.id);
                              const imgUrl = itemObj?.primary_image_url || itemObj?.image_url || itemObj?.image;
                              if (imgUrl) {
                                return (
                                  <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                                    <img src={resolveImageUrl(imgUrl)} alt={item.name} className="w-8 h-8 object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </button>
                                );
                              }
                              return (
                                <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                              );
                            })()}
                            <div className="flex flex-col">
                              <span className="text-[12px]">{item.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
                            </div>
                          </div>
                       </div>
                       <div className="px-2 py-3 border-l border-slate-50">
                          <input 
                            type="number" 
                            value={item.price}
                            onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, price: Number(e.target.value) } : i))}
                            className="w-full bg-transparent text-center font-black text-slate-700 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300"
                          />
                       </div>
                       <div className="px-2 py-3 border-l border-slate-50">
                          <input 
                            type="number" 
                            value={item.qty}
                            onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Number(e.target.value) } : i))}
                            className="w-full bg-transparent text-center font-black text-slate-700 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300"
                          />
                       </div>
                       <div className="px-2 py-3 border-l border-slate-50">
                          <input 
                            type="number" 
                            value={item.discount}
                            onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? { ...i, discount: Number(e.target.value) } : i))}
                            className="w-full bg-transparent text-center font-black text-slate-400 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-300"
                          />
                       </div>
                       <div className="px-4 py-3 text-left font-black text-slate-900 border-l border-slate-50">
                          {formatMoney((item.price * item.qty) - item.discount)}
                       </div>
                       <div className="px-2 flex justify-center">
                          <button 
                            onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                            className="text-slate-300 hover:text-rose-500"
                          >
                             <Trash2 className="h-4 w-4" />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Sidebar: Totals & Context */}
         <aside className="w-[360px] flex flex-col border-r border-slate-300 bg-white p-5 gap-6">
            <div className="space-y-4">
               {/* Customer Section */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">العميل المستهدف</label>
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-3 text-white">
                       <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-800"><User className="h-4 w-4" /></div>
                          <div className="flex flex-col">
                             <span className="text-[13px] font-black">{selectedCustomer.name}</span>
                             <span className="text-[10px] font-bold opacity-60">{selectedCustomer.phone}</span>
                          </div>
                       </div>
                       <button onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); }} className="opacity-40 hover:opacity-100"><X className="h-4 w-4"/></button>
                    </div>
                  ) : (
                    <div className="relative">
                       <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                       <input 
                         type="text" 
                         autoFocus
                         placeholder="ابحث عن عميل..."
                         value={customerQuery}
                         onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerList(true); }}
                         className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2.5 pr-10 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                       />
                       {showCustomerList && filteredCustomers.length > 0 && (
                         <div className="absolute top-full right-0 z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-xl">
                            {filteredCustomers.map(c => (
                              <button 
                                key={c.id} 
                                onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); }}
                                className="flex w-full flex-col px-4 py-2 text-right hover:bg-slate-50 border-b last:border-0 border-slate-50"
                              >
                                 <span className="text-[12px] font-black text-slate-800">{c.name}</span>
                                 <span className="text-[10px] font-bold text-slate-400">{c.phone}</span>
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                  )}
               </div>

               {/* Meta Info */}
               <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">صلاحية العرض حتى</label>
                     <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        <input 
                          type="date" 
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2.5 pr-10 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                        />
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">ملاحظات العرض</label>
                     <textarea 
                        rows="3"
                        placeholder="اكتب أي ملاحظات إضافية تظهر في العرض..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-sm border border-slate-200 bg-slate-50 p-3 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800 resize-none"
                     />
                  </div>
               </div>
            </div>

            {/* Totals Section */}
            <div className="mt-auto space-y-4">
               <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between text-[12px] font-bold text-slate-500">
                     <span>الإجمالي قبل الخصم</span>
                     <span>{formatMoney(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[12px] font-bold text-rose-500">
                     <span>إجمالي الخصم</span>
                     <span>-{formatMoney(totals.discount)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-center justify-between">
                     <span className="text-[14px] font-black text-slate-800 uppercase tracking-tight">الصافي النهائي</span>
                     <span className="text-[24px] font-black text-slate-900">{formatMoney(totals.total)}</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <PermissionGate page="quotations" action="print">
                    <button className="flex h-11 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white text-[13px] font-black text-slate-700 hover:bg-slate-50">
                       <Printer className="h-4 w-4 text-slate-400" /> معاينة
                    </button>
                  </PermissionGate>
                  <PermissionGate page="quotations" action={editId ? "edit" : "add"}>
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex h-11 items-center justify-center gap-2 rounded-sm bg-slate-800 text-[13px] font-black text-white hover:bg-slate-700 shadow-md transition-all active:scale-95"
                    >
                       <Save className="h-4 w-4" /> حفظ العرض
                    </button>
                  </PermissionGate>
               </div>
               
               <div className="flex items-center gap-3 rounded-sm border border-amber-100 bg-amber-50 p-3">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-900 leading-tight">عروض الأسعار لا تخصم من رصيد المخزن حتى يتم تحويلها لفاتورة بيع فعلية.</p>
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

      {/* Confirm Leave Warning Modal */}
      <Modal open={warnModalOpen} onClose={() => setWarnModalOpen(false)} title="تحذير: مغادرة الصفحة" size="md">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">تجاهل عرض السعر؟</h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في المغادرة؟ سيتم <span className="text-rose-600">إلغاء التعديلات غير المحفوظة</span> ولن يتم حفظها.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setWarnModalOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50">
              تراجع وإكمال العرض
            </button>
            <button onClick={() => navigate("/operations/quotations")} className="rounded-sm bg-rose-600 px-5 py-2 text-[13px] font-black text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20">
              نعم، تجاهل ومغادرة
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
