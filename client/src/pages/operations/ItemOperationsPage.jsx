import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronLeft,
  ClipboardList,
  Eye,
  ExternalLink,
  PackageSearch,
  Pencil,
  RefreshCcw,
  Search,
} from "lucide-react";
import api from "../../services/api";
import DocumentPreviewModal from "../../components/operations/DocumentPreviewModal";

const TYPE_OPTIONS = [
  { key: "sales", label: "مبيعات", tone: "emerald" },
  { key: "purchases", label: "مشتريات", tone: "blue" },
  { key: "sales_returns", label: "مرتجع مبيعات", tone: "amber" },
  { key: "purchase_returns", label: "مرتجع مشتريات", tone: "rose" },
  { key: "branch_transfers", label: "تحويلات", tone: "indigo" },
  { key: "opening_balance", label: "رصيد افتتاحي", tone: "slate" },
  { key: "price_changes", label: "تغيير سعر", tone: "cyan" },
  { key: "stock_movements", label: "حركة مخزون", tone: "zinc" },
  { key: "cost_movements", label: "تغير تكلفة", tone: "violet" },
];

const DEFAULT_TYPES = ["sales", "purchases", "sales_returns", "purchase_returns", "branch_transfers", "opening_balance"];

function money(value) {
  return Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toneClass(tone) {
  const tones = {
    emerald: "border-r-emerald-500 bg-emerald-50 text-emerald-700",
    blue: "border-r-blue-500 bg-blue-50 text-blue-700",
    amber: "border-r-amber-500 bg-amber-50 text-amber-700",
    rose: "border-r-rose-500 bg-rose-50 text-rose-700",
    indigo: "border-r-indigo-500 bg-indigo-50 text-indigo-700",
    violet: "border-r-violet-500 bg-violet-50 text-violet-700",
    cyan: "border-r-cyan-500 bg-cyan-50 text-cyan-700",
    zinc: "border-r-zinc-500 bg-zinc-50 text-zinc-700",
    slate: "border-r-slate-500 bg-slate-50 text-slate-700",
  };
  return tones[tone] || tones.slate;
}

function sourceRoute(row) {
  const id = row?.source_id;
  if (!id) return null;
  const routes = {
    sales: `/invoices/${id}`,
    purchases: `/purchases/${id}`,
    opening_balance: `/purchases/${id}`,
    sales_returns: `/pos/sales-returns/${id}`,
    purchase_returns: `/purchases/returns/${id}`,
    branch_transfers: `/operations/branch-transfer/edit/${id}`,
    price_changes: "/operations/bulk-price-update",
    stock_movements: "/stock/movements",
    cost_movements: "/reports/cost-movements",
  };
  return routes[row.type] || null;
}

function isEditable(row) {
  return ["sales", "purchases", "opening_balance", "sales_returns", "purchase_returns", "branch_transfers"].includes(row?.type);
}

function previewDocType(row) {
  const types = {
    sales: "invoice",
    purchases: "purchase",
    opening_balance: "opening_balance",
    sales_returns: "sales_return",
    purchase_returns: "purchase_return",
    branch_transfers: "branch_transfer",
  };
  return types[row?.type] || null;
}

export default function ItemOperationsPage() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const [itemSearch, setItemSearch] = useState("");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(itemId ? Number(itemId) : null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const initialTypes = useMemo(() => {
    const fromUrl = searchParams.get("types");
    return fromUrl ? fromUrl.split(",").filter(Boolean) : DEFAULT_TYPES;
  }, [searchParams]);
  const [types, setTypes] = useState(initialTypes);
  const [operationSearch, setOperationSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [previewTarget, setPreviewTarget] = useState(null);

  useEffect(() => {
    setSelectedId(itemId ? Number(itemId) : null);
  }, [itemId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoadingItems(true);
      api.get("/api/items", { params: { search: itemSearch, limit: 50 } })
        .then((res) => setItems(res.data?.data || []))
        .catch(() => setItems([]))
        .finally(() => setLoadingItems(false));
    }, itemSearch ? 250 : 0);
    return () => clearTimeout(handle);
  }, [itemSearch]);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      setSelectedItem(null);
      return;
    }
    setLoadingRows(true);
    api.get(`/api/items/${selectedId}/operations`, {
      params: { types: types.join(","), search: operationSearch, from: fromDate, to: toDate, dir: sortDir, page, limit: 10 },
    })
      .then((res) => {
        setRows(res.data?.data || []);
        setTotal(res.data?.total || 0);
        setSelectedItem(res.data?.item || null);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoadingRows(false));
  }, [selectedId, types, operationSearch, fromDate, toDate, sortDir, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedId, types, operationSearch, fromDate, toDate, sortDir]);

  const pages = Math.max(1, Math.ceil(total / 10));

  function toggleType(type) {
    setPage(1);
    setTypes((current) => current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]);
  }

  return (
    <div className="h-full min-h-screen bg-slate-50 text-slate-900" dir="rtl">
      <div className="flex h-screen">
        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <PackageSearch size={20} className="text-indigo-600" />
              <h1 className="text-base font-black">بطاقة الصنف التشغيلية</h1>
            </div>
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-sm outline-none focus:border-indigo-500"
                placeholder="بحث بالاسم أو الكود"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingItems ? (
              <div className="p-6 text-center text-sm text-slate-400">جاري التحميل...</div>
            ) : items.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedId(item.id); setPage(1); }}
                className={`w-full border-b border-slate-100 px-4 py-3 text-right hover:bg-slate-50 ${selectedId === item.id ? "bg-indigo-50" : ""}`}
              >
                <div className="font-bold text-sm text-slate-800">{item.name}</div>
                <div className="mt-1 font-mono text-[11px] font-black text-indigo-600" dir="ltr">{item.code || `ITEM-${item.id}`}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">العمليات الموحدة</div>
                  <h2 className="mt-1 text-2xl font-black">{selectedItem?.name || "اختر صنفا"}</h2>
                  {selectedItem?.code && <div className="mt-1 font-mono text-xs font-bold text-indigo-600">{selectedItem.code}</div>}
                  {selectedItem && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                      <span className="rounded-lg bg-slate-100 px-2 py-1">{selectedItem.category_name || "بدون قسم"}</span>
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">المخزون: {money(selectedItem.current_stock)}</span>
                      <span className="rounded-lg bg-indigo-50 px-2 py-1 text-indigo-700">سعر البيع: {money(selectedItem.sale_price)}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPage(1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  <RefreshCcw size={14} /> تحديث
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((option) => (
                  <label key={option.key} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={types.includes(option.key)} onChange={() => toggleType(option.key)} />
                    {option.label}
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={operationSearch}
                    onChange={(event) => setOperationSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-sm outline-none focus:border-indigo-500"
                    placeholder="بحث برقم المستند أو الطرف"
                  />
                </div>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setSortDir((value) => value === "desc" ? "asc" : "desc")}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100"
                >
                  {sortDir === "desc" ? "الأحدث أولا" : "الأقدم أولا"}
                </button>
              </div>
            </div>

            {!selectedId ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
                <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
                اختر صنفا من القائمة لعرض القصة التشغيلية الكاملة.
              </div>
            ) : loadingRows ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">جاري تحميل العمليات...</div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">لا توجد عمليات ضمن الفلاتر الحالية.</div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => {
                  const option = TYPE_OPTIONS.find((entry) => entry.key === row.type);
                  const route = sourceRoute(row);
                  const docType = previewDocType(row);
                  return (
                    <article key={`${row.type}-${row.source_line_id}-${row.date}`} className={`rounded-2xl border border-slate-200 border-r-4 bg-white p-4 shadow-sm ${toneClass(option?.tone)}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black">{row.type_label}</div>
                          <h3 className="mt-2 text-base font-black text-slate-900">{row.doc_no || "بدون رقم"}</h3>
                          <p className="mt-1 text-xs font-medium text-slate-500">{String(row.date || "").slice(0, 16)} {row.party_name ? `- ${row.party_name}` : ""}</p>
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-bold text-slate-400">الإجمالي</div>
                          <div className="font-mono text-lg font-black text-slate-900">{money(row.line_total)}</div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div><span className="text-slate-400">الكمية</span><div className="font-bold">{money(row.quantity)}</div></div>
                        <div><span className="text-slate-400">سعر الوحدة</span><div className="font-bold">{money(row.unit_price)}</div></div>
                        <div><span className="text-slate-400">التكلفة</span><div className="font-bold">{money(row.unit_cost)}</div></div>
                        <div><span className="text-slate-400">الربح</span><div className="font-bold">{row.profit == null ? "—" : money(row.profit)}</div></div>
                      </div>
                      {(row.context_key || row.context_before != null || row.context_after != null || row.context_source) && (
                        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-slate-600">
                          {row.context_key ? <span className="ml-2">{row.context_key}</span> : null}
                          {row.context_before != null || row.context_after != null ? (
                            <span className="font-mono" dir="ltr">{money(row.context_before)} → {money(row.context_after)}</span>
                          ) : null}
                          {row.context_source ? <span className="mr-2 text-slate-400">{row.context_source}</span> : null}
                        </div>
                      )}
                      {route && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {docType ? (
                            <button
                              onClick={() => setPreviewTarget({ docType, docId: row.source_id })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              <Eye size={13} /> معاينة
                            </button>
                          ) : (
                            <Link
                              to={route}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              <Eye size={13} /> معاينة
                            </Link>
                          )}
                          {isEditable(row) && (
                            <Link
                              to={route}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                            >
                              <Pencil size={13} /> تعديل
                            </Link>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {selectedId && pages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>
                <span className="text-xs font-bold text-slate-500">{page} / {pages}</span>
                <button className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}><ArrowDownUp size={16} /></button>
              </div>
            )}

            <Link to="/operations/bulk-price-update" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800">
              <ExternalLink size={13} /> العودة إلى سجل تغييرات الأسعار
            </Link>
          </div>
        </main>
      </div>
      <DocumentPreviewModal
        open={!!previewTarget}
        docType={previewTarget?.docType}
        docId={previewTarget?.docId}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  );
}
