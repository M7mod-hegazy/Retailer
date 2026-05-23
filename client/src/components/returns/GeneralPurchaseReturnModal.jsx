import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import SearchDropdown from "../ui/SearchDropdown";

const REASONS = [
  { value: "defective", label: "تلف / عيب" },
  { value: "wrong_qty", label: "كمية خاطئة" },
  { value: "supplier_error", label: "خطأ من المورد" },
  { value: "wrong_item", label: "صنف خاطئ" },
  { value: "other", label: "أخرى" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export default function GeneralPurchaseReturnModal({ open, onClose, onSuccess }) {
  const [lines, setLines] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState([]);
  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [reason, setReason] = useState("other");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);

  const ITEM_PAGE = 20;

  useEffect(() => {
    if (!open) {
      setLines([]);
      setSupplier(null);
      setSupplierQuery("");
      setRefundMethod("cash_back");
      setNotes("");
      setReason("other");
      setItemQuery("");
      setItemResults([]);
      setItemOffset(0);
      setItemHasMore(false);
    }
  }, [open]);

  useEffect(() => {
    if (supplierQuery.length < 2) { setSupplierResults([]); return; }
    api.get(`/api/suppliers?search=${encodeURIComponent(supplierQuery)}`)
      .then(r => {
        const all = r.data.data || r.data || [];
        const q = supplierQuery.toLowerCase();
        setSupplierResults(all.filter(s => s.name?.toLowerCase().includes(q)).slice(0, 8));
      })
      .catch(() => {});
  }, [supplierQuery]);

  useEffect(() => {
    const q = itemQuery.trim();
    if (!q) { setItemResults([]); setItemOffset(0); setItemHasMore(false); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=0`)
        .then(r => {
          const rows = r.data.data || [];
          setItemResults(rows);
          setItemOffset(rows.length);
          setItemHasMore(rows.length === ITEM_PAGE);
        }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [itemQuery]);

  function loadMoreItems() {
    const q = itemQuery.trim();
    if (!itemHasMore || !q || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    api.get(`/api/items?search=${encodeURIComponent(q)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = r.data.data || [];
        setItemResults(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function addItem(item) {
    if (item.id === -1) {
      setLines(ls => [...ls, { item_id: null, name: item.name, unit_price: 0, quantity: 1 }]);
    } else {
      setLines(ls => {
        const existing = ls.find(l => l.item_id === item.id);
        if (existing) return ls.map(l => l.item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l);
        const price = Number(item.cost_price || item.cost || item.price || 0);
        return [...ls, { item_id: item.id, name: item.name, unit_price: price, quantity: 1 }];
      });
    }
    setItemQuery("");
    setItemResults([]);
    setItemOffset(0);
    setItemHasMore(false);
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  async function handleSave() {
    if (!lines.length) { toast.error("أضف أصنافاً للمرتجع"); return; }
    setSaving(true);
    try {
      await api.post("/api/invoices/general-purchase-return", {
        lines: lines.filter(l => l.item_id).map(l => ({ item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price })),
        supplier_id: supplier?.id || null,
        refund_method: refundMethod,
        reason,
        notes,
      });
      toast.success("تم حفظ مرتجع الشراء بنجاح");
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="w-[720px] max-h-[88vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50 shrink-0">
          <div>
            <h2 className="text-[16px] font-black text-amber-900">مرتجع مشتريات عام</h2>
            <p className="text-[11px] font-bold text-amber-400 mt-0.5">إرجاع أصناف للمورد بدون ربطها بفاتورة شراء محددة</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-100 hover:text-amber-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
          {/* Supplier search (optional) */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
              المورد <span className="text-slate-300 font-normal normal-case">(اختياري)</span>
            </label>
            {supplier ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="flex-1 text-[13px] font-black text-slate-800">{supplier.name}</span>
                <button
                  onClick={() => { setSupplier(null); setRefundMethod("cash_back"); }}
                  className="text-slate-400 hover:text-amber-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={supplierQuery}
                  onChange={e => setSupplierQuery(e.target.value)}
                  placeholder="ابحث عن مورد..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-[13px] font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                {supplierResults.length > 0 && (
                  <div className="absolute top-full right-0 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-auto">
                    {supplierResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSupplier(s); setSupplierQuery(""); setSupplierResults([]); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-bold hover:bg-amber-50 text-right transition-colors"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refund method */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">طريقة التسوية</label>
            <div className="flex gap-2">
              <button
                onClick={() => setRefundMethod("cash_back")}
                className={`flex-1 rounded-xl border py-2.5 text-[13px] font-black transition-colors ${
                  refundMethod === "cash_back"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                نقدي — يرجع المورد المبلغ
              </button>
              <button
                onClick={() => {
                  if (!supplier) { toast.error("اختر مورداً أولاً لخصم الرصيد"); return; }
                  setRefundMethod("credit_note");
                }}
                className={`flex-1 rounded-xl border py-2.5 text-[13px] font-black transition-colors ${
                  refundMethod === "credit_note"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                } ${!supplier ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                خصم من ذمة المورد
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">سبب الإرجاع</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-[13px] font-bold outline-none focus:border-amber-400 bg-white"
            >
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Item search */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">إضافة أصناف</label>
            <div className="relative">
              <input
                value={itemQuery}
                onChange={e => { setItemQuery(e.target.value); }}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = itemQuery.trim();
                    if (itemResults.length > 0) addItem(itemResults[0]);
                    else if (q) addItem({ id: -1, name: q, code: q });
                  }
                }}
                placeholder="ابحث عن صنف بالاسم أو الباركود..."
                className="w-full rounded-xl border border-slate-300 pr-9 pl-4 py-2.5 text-[13px] font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              {itemQuery && (
                <SearchDropdown
                  items={itemResults}
                  onPick={addItem}
                  activeIndex={-1}
                  query={itemQuery}
                  emptyLabel="لا توجد نتائج"
                  rawText={itemQuery}
                  onPickRawText={(txt) => addItem({ id: -1, name: txt, code: txt })}
                  onLoadMore={loadMoreItems}
                  hasMoreFromServer={itemHasMore}
                  isLoadingMore={isLoadingMoreItems}
                />
              )}
            </div>
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["الصنف", "الكمية", "تكلفة الوحدة", "الإجمالي", ""].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-right font-black text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 font-bold text-slate-800">{line.name}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.quantity}
                          onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, quantity: Number(e.target.value) } : l))}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-[12px] font-black outline-none focus:border-amber-400"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, unit_price: Number(e.target.value) } : l))}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[12px] font-black outline-none focus:border-amber-400"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-black font-mono text-amber-700">
                        {fmt(line.quantity * line.unit_price)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-50 border-t border-amber-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-black text-amber-800 text-right">الإجمالي</td>
                    <td className="px-4 py-3 font-black font-mono text-amber-800 text-[15px]">{fmt(total)} ج.م</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {lines.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center text-slate-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-bold">ابحث عن صنف وأضفه للمرتجع</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">ملاحظات</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات اختيارية..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-[13px] outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 py-3 text-[13px] font-black text-slate-700 hover:bg-slate-100 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !lines.length}
            className="flex-1 rounded-xl bg-amber-600 py-3 text-[13px] font-black text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "جاري الحفظ..." : `حفظ المرتجع — ${fmt(total)} ج.م`}
          </button>
        </div>
      </div>
    </div>
  );
}
