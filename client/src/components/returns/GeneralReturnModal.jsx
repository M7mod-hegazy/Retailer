import React, { useState, useEffect, useRef } from "react";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { Search, Trash2, AlertCircle } from "lucide-react";
import api from "../../services/api";
import TitleBar from "../ui/TitleBar";
import toast from "react-hot-toast";
import SearchDropdown from "../ui/SearchDropdown";
import ProductSearchField from "../ui/ProductSearchField";
import { formatNumber } from "../../utils/currency";
import { useDetach } from "../../hooks/useDetach";

const REASONS = [
  { value: "defective", label: "عيب في المنتج" },
  { value: "wrong_item", label: "صنف خاطئ" },
  { value: "damaged", label: "تالف" },
  { value: "changed_mind", label: "غيّر رأيه" },
  { value: "other", label: "أخرى" },
];

function fmt(n) {
  return formatNumber(n);
}

export default function GeneralReturnModal({ open, onClose, onSuccess }) {
  const { handleDetach } = useDetach("general-return", {
    onClose, getState: () => ({}), actions: { success: () => onSuccess?.() },
  });
  const handleKeyDown = useFieldNavigation();
  const reasonRef = useRef(null);
  const notesRef = useRef(null);
  const saveBtnRef = useRef(null);

  const [lines, setLines] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [reason, setReason] = useState("other");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [itemOffset, setItemOffset] = useState(0);
  const [itemHasMore, setItemHasMore] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [allItemsMode, setAllItemsMode] = useState(false);

  const ITEM_PAGE = 20;

  function resetAll() {
    setLines([]);
    setCustomer(null);
    setCustomerQuery("");
    setRefundMethod("cash_back");
    setNotes("");
    setReason("other");
    setItemQuery("");
    setItemResults([]);
    setItemOffset(0);
    setItemHasMore(false);
  }

  useEffect(() => {
    if (customerQuery.length < 2) { setCustomerResults([]); return; }
    api.get(`/api/customers?search=${encodeURIComponent(customerQuery)}&limit=8`)
      .then(r => setCustomerResults(r.data.data || r.data || []))
      .catch(() => {});
  }, [customerQuery]);

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
    if (!itemHasMore || isLoadingMoreItems) return;
    const q = itemQuery.trim();
    if (!q && !allItemsMode) return;
    setIsLoadingMoreItems(true);
    const searchParam = allItemsMode ? "" : q;
    api.get(`/api/items?search=${encodeURIComponent(searchParam)}&limit=${ITEM_PAGE}&offset=${itemOffset}`)
      .then(r => {
        const rows = r.data.data || [];
        setItemResults(prev => [...prev, ...rows]);
        setItemOffset(prev => prev + rows.length);
        setItemHasMore(rows.length === ITEM_PAGE);
      }).catch(() => {}).finally(() => setIsLoadingMoreItems(false));
  }

  function showAllItems() {
    setAllItemsMode(true);
    setItemResults([]);
    setItemOffset(0);
    setItemHasMore(true);
    setIsLoadingMoreItems(true);
    api.get(`/api/items?limit=${ITEM_PAGE}&offset=0`)
      .then(r => {
        const rows = r.data.data || [];
        setItemResults(rows);
        setItemOffset(rows.length);
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
        return [...ls, { item_id: item.id, name: item.name, unit_price: Number(item.price || 0), quantity: 1 }];
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
      await api.post("/api/invoices/general-return", {
        lines: lines.filter(l => l.item_id).map(l => ({ item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price })),
        customer_id: customer?.id || null,
        refund_method: refundMethod,
        reason,
        notes,
      });
      toast.success("تم حفظ المرتجع بنجاح");
      resetAll();
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
        <TitleBar title="مرتجع مبيعات عام" subtitle="إرجاع أصناف بدون ربطها بفاتورة محددة" onClose={onClose} onDetach={handleDetach} />

        <div data-modal-content className="flex-1 overflow-auto p-5 flex flex-col gap-4">
          {/* Customer search (optional) */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
              العميل <span className="text-slate-300 font-normal normal-case">(اختياري)</span>
            </label>
            {customer ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="flex-1 text-sm font-black text-slate-800">{customer.name}</span>
                <button
                  onClick={() => { setCustomer(null); setRefundMethod("cash_back"); }}
                  className="text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={customerQuery}
                  onChange={e => setCustomerQuery(e.target.value)}
                  placeholder="ابحث عن عميل..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 bg-white"
                />
                {customerResults.length > 0 && (
                  <div className="absolute top-full right-0 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-auto">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCustomer(c); setCustomerQuery(""); setCustomerResults([]); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold hover:bg-rose-50 text-right transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refund method */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">طريقة الاسترداد</label>
            <div className="flex gap-2">
              <button
                onClick={() => setRefundMethod("cash_back")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-black transition-colors ${
                  refundMethod === "cash_back"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                نقدي — استرداد من الخزينة
              </button>
              <button
                onClick={() => {
                  if (!customer) { toast.error("اختر عميل أولاً لاستخدام الرصيد"); return; }
                  setRefundMethod("credit_note");
                }}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-black transition-colors ${
                  refundMethod === "credit_note"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : !customer
                      ? "border-rose-300 border-dashed text-rose-500 bg-rose-50 cursor-not-allowed"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {!customer ? (
                  <span className="flex items-center justify-center gap-1"><AlertCircle className="h-4 w-4" /> رصيد على حساب العميل</span>
                ) : "رصيد على حساب العميل"}
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">سبب الإرجاع</label>
            <select
              ref={reasonRef}
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: notesRef })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold outline-none focus:border-rose-400 bg-white"
            >
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Item search */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">إضافة أصناف</label>
            <ProductSearchField
              query={itemQuery}
              onQueryChange={(val) => setItemQuery(val)}
              results={itemResults}
              onPick={addItem}
              emptyLabel="لا توجد نتائج"
              rawText={itemQuery}
              onPickRawText={(txt) => addItem({ id: -1, name: txt, code: txt })}
              onLoadMore={loadMoreItems}
              hasMore={itemHasMore}
              isLoadingMore={isLoadingMoreItems}
              onShowAll={showAllItems}
              showChip={false}
              hideZeroStock={false}
              placeholder="ابحث عن صنف بالاسم أو الباركود..."
            />
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-2sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["الصنف", "الكمية", "السعر", "الإجمالي", ""].map((h, i) => (
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
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-2sm font-black outline-none focus:border-rose-400 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, unit_price: Number(e.target.value) } : l))}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-2sm font-black outline-none focus:border-rose-400 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2.5 number-fmt text-rose-700">
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
                <tfoot className="bg-rose-50 border-t border-rose-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-black text-rose-800 text-right">الإجمالي</td>
                    <td className="px-4 py-3 number-fmt-primary text-rose-800 text-[15px]">{fmt(total)} ج.م</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {lines.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center text-slate-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold">ابحث عن صنف وأضفه للمرتجع</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">ملاحظات</label>
            <input
              ref={notesRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: saveBtnRef, prevRef: reasonRef })}
              placeholder="ملاحظات اختيارية..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-rose-400 bg-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="btn-danger flex-1 rounded-xl py-3 text-sm font-black transition-colors"
          >
            إلغاء
          </button>
          <button
            ref={saveBtnRef}
            onClick={handleSave}
            disabled={saving || !lines.length}
            className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "جاري الحفظ..." : `حفظ المرتجع — ${fmt(total)} ج.م`}
          </button>
        </div>
      </div>
    </div>
  );
}
