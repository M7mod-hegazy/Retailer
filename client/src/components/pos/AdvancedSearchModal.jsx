import React, { useEffect, useState, useMemo } from "react";
import { Search, X, RefreshCw, Package, Loader2, Filter, ChevronDown } from "lucide-react";
import Modal from "../ui/Modal";
import api from "../../services/api";

function fmt(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FilterSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-9 rounded-lg border border-slate-200 bg-white pr-3 pl-7 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 cursor-pointer transition-all"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
    </div>
  );
}

function RangeInput({ label, min, max, onMinChange, onMaxChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">{label}</span>
      <input
        type="number"
        min="0"
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder="من"
        className="w-14 h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 text-center transition-all"
      />
      <span className="text-slate-300 font-bold">—</span>
      <input
        type="number"
        min="0"
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder="إلى"
        className="w-14 h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 text-center transition-all"
      />
    </div>
  );
}

export default function AdvancedSearchModal({ open, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [qtyMin, setQtyMin] = useState("");
  const [qtyMax, setQtyMax] = useState("");
  const [hideZero, setHideZero] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    setSearch("");
    setCategoryFilter("");
    setWarehouseFilter("");
    setPriceMin("");
    setPriceMax("");
    setQtyMin("");
    setQtyMax("");
    setHideZero(false);
    api.get("/api/stock/levels")
      .then((res) => setRows(res.data.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open]);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category_name).filter(Boolean))].sort(), [rows]);
  const warehouses = useMemo(() => [...new Set(rows.map((r) => r.warehouse_name).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideZero && Number(r.quantity) <= 0) return false;
      if (categoryFilter && r.category_name !== categoryFilter) return false;
      if (warehouseFilter && r.warehouse_name !== warehouseFilter) return false;
      if (priceMin !== "" && Number(r.sale_price) < Number(priceMin)) return false;
      if (priceMax !== "" && Number(r.sale_price) > Number(priceMax)) return false;
      if (qtyMin !== "" && Number(r.quantity) < Number(qtyMin)) return false;
      if (qtyMax !== "" && Number(r.quantity) > Number(qtyMax)) return false;
      if (q) {
        const name = (r.item_name || "").toLowerCase();
        const code = (r.code || "").toLowerCase();
        const barcode = (r.barcode || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !barcode.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, categoryFilter, warehouseFilter, priceMin, priceMax, qtyMin, qtyMax, hideZero]);

  const hasFilters = search || categoryFilter || warehouseFilter || priceMin || priceMax || qtyMin || qtyMax || hideZero;

  function reset() {
    setSearch("");
    setCategoryFilter("");
    setWarehouseFilter("");
    setPriceMin("");
    setPriceMax("");
    setQtyMin("");
    setQtyMax("");
    setHideZero(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="البحث المتقدم في الأصناف" maxWidth="max-w-5xl">
      <div className="flex flex-col gap-3" dir="rtl">

        {/* Search + quick filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Text search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الكود، الباركود..."
              autoFocus
              className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all placeholder:font-normal placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <FilterSelect value={categoryFilter} onChange={setCategoryFilter}>
            <option value="">كل الفئات</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>

          <FilterSelect value={warehouseFilter} onChange={setWarehouseFilter}>
            <option value="">كل المخازن</option>
            {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
          </FilterSelect>

          <RangeInput label="السعر" min={priceMin} max={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} />
          <RangeInput label="الكمية" min={qtyMin} max={qtyMax} onMinChange={setQtyMin} onMaxChange={setQtyMax} />

          <label className="flex items-center gap-1.5 cursor-pointer select-none h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            <span className="text-[12px] font-bold text-slate-600">إخفاء نفاد المخزون</span>
          </label>

          {hasFilters && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-200 bg-rose-50 text-[12px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              مسح الفلاتر
            </button>
          )}
        </div>

        {/* Stats bar */}
        {!loading && !error && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-[12px] font-bold text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              <span>{filtered.length} صنف</span>
              {rows.length !== filtered.length && (
                <span className="text-slate-400">من أصل {rows.length}</span>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm" style={{ maxHeight: 440 }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <span className="text-[13px] font-bold">جاري تحميل بيانات المخزون...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-3">
              <Package className="h-10 w-10 text-rose-300" />
              <span className="text-[13px] font-bold">تعذر تحميل البيانات</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Package className="h-10 w-10 text-slate-300" />
              <span className="text-[13px] font-bold">لا توجد نتائج مطابقة</span>
              {hasFilters && (
                <button onClick={reset} className="text-[12px] font-bold text-indigo-500 hover:text-indigo-700 underline">
                  مسح الفلاتر
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-[12px]" dir="rtl">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">#</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">اسم الصنف</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">الكود / SKU</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">الباركود</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">الفئة</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">الوحدة</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">سعر البيع</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">الكمية</th>
                  <th className="px-4 py-3 text-right font-black text-[11px] tracking-wide">المخزن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, idx) => {
                  const qty = Number(row.quantity);
                  const isZero = qty <= 0;
                  const isLow = qty > 0 && qty <= Number(row.min_stock_qty || 0);
                  return (
                    <tr
                      key={`${row.item_id}-${row.warehouse_id}-${idx}`}
                      className={`transition-colors ${
                        isZero ? "bg-rose-50/60 hover:bg-rose-50" : isLow ? "bg-amber-50/60 hover:bg-amber-50" : "bg-white hover:bg-indigo-50/40"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-black text-slate-800 max-w-[200px]">
                        <span className="block truncate">{row.item_name}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{row.code || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-400 text-[11px]">{row.barcode || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.category_name || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.unit_name || "—"}</td>
                      <td className="px-4 py-2.5 font-mono font-black text-emerald-700 tabular-nums">{fmt(row.sale_price)}</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        <span className={`inline-flex items-center justify-center min-w-[40px] rounded-full px-2 py-0.5 text-[11px] font-black ${
                          isZero ? "bg-rose-100 text-rose-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {qty}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 font-bold">{row.warehouse_name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
