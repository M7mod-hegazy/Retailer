import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, X, Printer, Eye, Pencil } from "lucide-react";
import api from "../../services/api";
import DataGrid from "../../components/ui/DataGrid";
import SearchInput from "../../components/ui/SearchInput";
import useDebounce from "../../hooks/useDebounce";
import toast from "react-hot-toast";

const REASON_MAP = {
  defective: "عيب في المنتج",
  wrong_order: "خطأ في الطلب",
  damaged_shipping: "تلف أثناء الشحن",
  not_as_described: "لا يطابق الوصف",
  other: "أخرى",
};

const REFUND_MAP = {
  cash_back: "نقداً",
  credit_note: "رصيد حساب",
};

const STATUS_MAP = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  cancelled: { label: "ملغى", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.active;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${s.cls}`}>
      {s.label}
    </span>
  );
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function SalesReturnsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdFilter = searchParams.get("invoice_id") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debouncedSearch = useDebounce(searchTerm, 300);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (invoiceIdFilter) params.set("invoice_id", invoiceIdFilter);
      const res = await api.get(`/api/invoices/returns?${params}`);
      setRows(res.data.data || []);
    } catch {
      toast.error("فشل تحميل بيانات المرتجعات");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [debouncedSearch, dateFrom, dateTo, invoiceIdFilter]);

  function clearInvoiceFilter() {
    searchParams.delete("invoice_id");
    setSearchParams(searchParams);
  }

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-black text-slate-800">قائمة مرتجعات المبيعات</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">
            عرض وإدارة جميع مرتجعات فواتير المبيعات
          </p>
        </div>
        <button
          onClick={() => navigate("/sales/returns/new")}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-emerald-500 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" /> مرتجع جديد
        </button>
      </div>

      {/* Invoice filter banner */}
      {invoiceIdFilter && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-3">
          <span className="text-[13px] font-black text-emerald-700">
            عرض مرتجعات الفاتورة #{invoiceIdFilter}
          </span>
          <button
            onClick={clearInvoiceFilter}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-emerald-600 hover:bg-emerald-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> إزالة التصفية
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="بحث برقم المرتجع أو اسم العميل..."
            className="flex-1 min-w-[160px]"
            size="md"
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-black text-slate-400 whitespace-nowrap">من:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-black text-slate-400 whitespace-nowrap">إلى:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <span className="mr-auto text-[11px] font-bold text-slate-400">{rows.length} مرتجع</span>
        </div>

        <DataGrid
          data={rows}
          rowKey="id"
          loading={loading}
          emptyMessage={debouncedSearch ? "لا توجد مرتجعات مطابقة للبحث" : "لا توجد مرتجعات مبيعات"}
          emptyIcon={<RotateCcw className="h-10 w-10 opacity-30 mb-2" />}
          className="border-0"
          columns={[
            {
              id: "doc_no",
              header: "رقم المرتجع",
              width: 130,
              sortable: true,
              headerClass: "text-center",
              cellClass: "text-center font-mono text-[13px] font-black text-slate-800 border-l border-slate-100",
              render: (r) => r.doc_no || `RT-${String(r.id).padStart(5, "0")}`,
            },
            {
              id: "created_at",
              header: "التاريخ",
              width: 120,
              sortable: true,
              headerClass: "text-center",
              cellClass: "text-center text-slate-500 text-[12px] font-medium border-l border-slate-100",
              render: (r) => new Date(r.created_at).toLocaleDateString("ar-EG"),
            },
            {
              id: "original_invoice_no",
              header: "رقم الفاتورة الأصلية",
              width: 160,
              sortable: true,
              headerClass: "text-center",
              cellClass: "text-center font-mono text-[12px] border-l border-slate-100",
              render: (r) =>
                r.original_invoice_no && r.invoice_id ? (
                  <Link
                    to={`/pos/invoices/${r.invoice_id}`}
                    className="font-black text-emerald-600 hover:underline"
                  >
                    {r.original_invoice_no}
                  </Link>
                ) : (
                  <span className="text-slate-400">{r.original_invoice_no || "—"}</span>
                ),
            },
            {
              id: "customer_name",
              header: "العميل",
              width: 180,
              sortable: true,
              headerClass: "text-right px-3",
              cellClass: "font-bold text-slate-700 px-3 border-l border-slate-100",
              render: (r) =>
                r.customer_id ? (
                  <Link
                    to={`/definitions/customers/${r.customer_id}`}
                    className="hover:text-emerald-600 hover:underline transition-colors"
                  >
                    {r.customer_name || `عميل #${r.customer_id}`}
                  </Link>
                ) : (
                  <span className="text-slate-400">{r.customer_name || "—"}</span>
                ),
            },
            {
              id: "reason",
              header: "السبب",
              width: 160,
              sortable: false,
              headerClass: "text-right px-3",
              cellClass: "text-slate-600 text-[12px] font-medium px-3 border-l border-slate-100",
              render: (r) => REASON_MAP[r.reason] || "أخرى",
            },
            {
              id: "refund_method",
              header: "طريقة الاسترداد",
              width: 140,
              sortable: false,
              headerClass: "text-center",
              cellClass: "text-center text-slate-600 text-[12px] font-medium border-l border-slate-100",
              render: (r) => REFUND_MAP[r.refund_method] || r.refund_method || "—",
            },
            {
              id: "total",
              header: "الإجمالي",
              width: 120,
              sortable: true,
              headerClass: "text-left px-3",
              cellClass: "text-left font-black font-mono text-slate-800 px-3 border-l border-slate-100",
              render: (r) => `${formatMoney(r.total)} ج.م`,
            },
            {
              id: "status",
              header: "الحالة",
              width: 90,
              sortable: true,
              headerClass: "text-center",
              cellClass: "text-center border-l border-slate-100",
              render: (r) => (
                <div className="flex justify-center">
                  <StatusBadge status={r.status} />
                </div>
              ),
            },
            {
              id: "actions",
              header: "إجراءات",
              width: 160,
              sortable: false,
              headerClass: "text-center",
              cellClass: "text-center p-0",
              render: (row) => (
                <div className="flex items-center justify-center gap-1 h-[40px] px-2">
                  <button
                    onClick={() => navigate(`/pos/sales-returns/${row.id}`)}
                    title="عرض"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/pos/sales-returns/${row.id}`)}
                    title="طباعة"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      navigate("/sales/returns/new", {
                        state: { edit_return_id: row.id },
                      })
                    }
                    title="تعديل"
                    className="flex h-7 items-center gap-1 px-2 rounded-lg text-emerald-600 hover:bg-emerald-50 text-[11px] font-black transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> تعديل
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
