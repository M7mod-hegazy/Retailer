import React, { useEffect, useState, useMemo } from "react";
import { Search, X, RefreshCw, Package, Loader2, Filter, ChevronDown } from "lucide-react";
import Modal from "../ui/Modal";
import api from "../../services/api";

function fmt(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FilterSelect({ value, onChange, children, icon: Icon }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none h-10 rounded-xl border border-slate-200/80 bg-white ${Icon ? "pr-9" : "pr-3"} pl-8 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/50 cursor-pointer shadow-sm transition-all`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
    </div>
  );
}

function RangeInput({ label, min, max, onMinChange, onMaxChange }) {
  return (
    <div className="flex items-center rounded-xl border border-slate-200/80 bg-white h-10 overflow-hidden shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50/50 transition-all">
      <div className="px-3 bg-slate-50/80 border-l border-slate-200/80 h-full flex items-center justify-center">
        <span className="text-[11px] font-black text-slate-500">{label}</span>
      </div>
      <input
        type="number"
        min="0"
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder="من"
        className="w-[60px] h-full bg-transparent px-2 text-[12px] font-bold text-slate-700 text-center outline-none"
      />
      <div className="w-px h-4 bg-slate-200" />
      <input
        type="number"
        min="0"
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder="إلى"
        className="w-[60px] h-full bg-transparent px-2 text-[12px] font-bold text-slate-700 text-center outline-none"
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
    setSearch("");
    setCategoryFilter("");
    setWarehouseFilter("");
    setPriceMin("");
    setPriceMax("");
    setQtyMin("");
    setQtyMax("");
    setHideZero(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError(false);
      api.get("/api/stock/levels", {
        params: {
          search: search.trim() || undefined,
          limit: 300,
        },
        signal: controller.signal,
      })
        .then((res) => setRows(res.data.data || []))
        .catch((err) => {
          if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") setError(true);
        })
        .finally(() => setLoading(false));
    }, search.trim() ? 220 : 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [open, search]);

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

        {/* Search & Filters Cockpit */}
        <div className="flex flex-col gap-3 p-4 bg-slate-50/50 border border-slate-200/60 rounded-2xl shadow-sm mb-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500/80" />
          
          {/* Top Row: Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم، الكود، الباركود..."
                autoFocus
                className="w-full h-12 rounded-xl border border-slate-200/80 bg-white pr-11 pl-10 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/50 shadow-sm transition-all placeholder:font-normal placeholder:text-slate-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-1 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {hasFilters && (
              <button
                onClick={reset}
                className="flex h-12 items-center gap-2 px-4 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-sm shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
                تفريغ الفلاتر
              </button>
            )}
          </div>

          <div className="w-full h-px bg-slate-200/60" />

          {/* Bottom Row: Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect value={categoryFilter} onChange={setCategoryFilter}>
              <option value="">كل الفئات</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>

            <FilterSelect value={warehouseFilter} onChange={setWarehouseFilter}>
              <option value="">كل المخازن</option>
              {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </FilterSelect>

            <div className="h-6 w-px bg-slate-200/80 mx-1 hidden md:block"></div>

            <RangeInput label="السعر" min={priceMin} max={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} />
            <RangeInput label="الكمية" min={qtyMin} max={qtyMax} onMinChange={setQtyMin} onMaxChange={setQtyMax} />

            <div className="flex-1"></div>

            <label className="flex items-center gap-2 cursor-pointer select-none h-10 px-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(e) => setHideZero(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
              />
              <span className="text-[12px] font-bold text-slate-700">إخفاء نفاد المخزون</span>
            </label>
          </div>
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
