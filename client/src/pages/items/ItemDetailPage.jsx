import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, ArrowRight } from "lucide-react";
import api from "../../services/api";
import DataGrid from "../../components/ui/DataGrid";
import Badge from "../../components/ui/Badge";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import PageWrapper from "../../components/ui/PageWrapper";

export default function ItemDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/items/${id}`).catch(() => ({ data: { data: null } })),
      api.get(`/api/stock/levels?item_id=${id}`).catch(() => ({ data: { data: [] } })),
      api.get(`/api/stock/movements?item_id=${id}&limit=20`).catch(() => ({ data: { data: [] } })),
    ]).then(([itemRes, stockRes, movRes]) => {
      setItem(itemRes.data?.data || null);
      setStock(stockRes.data?.data || []);
      setMovements(movRes.data?.data || []);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-surface mx-auto max-w-5xl py-12 text-center text-text-secondary">جاري التحميل...</div>;
  if (!item) return <div className="page-surface mx-auto max-w-5xl py-12 text-center text-text-secondary">الصنف غير موجود</div>;

  return (
    <PageWrapper className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-primary-300" />
          <div>
            <h1 className="page-title">{item.name}</h1>
            {item.name_en && <p className="page-subtitle">{item.name_en}</p>}
          </div>
        </div>
        <Link to="/definitions/items" className="flex items-center gap-1 text-sm text-primary-200 hover:underline">
          العودة للأصناف <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label="الكود" value={item.item_code || item.code} />
        <InfoCard label="الباركود" value={item.barcode || "—"} />
        <InfoCard label="الفئة" value={item.category_name || "—"} />
        <InfoCard label="الوحدة" value={item.unit_name || "—"} />
      </div>

      <div className="page-surface">
        <h3 className="section-title mb-3">الأسعار</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <PriceRow label="سعر البيع" value={item.sale_price} />
          <PriceRow label="سعر التكلفة" value={item.cost_price || item.purchase_price} />
          <PriceRow label="سعر الجملة" value={item.wholesale_price} />
          <PriceRow label="أقل سعر بيع" value={item.min_price} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Badge label={item.is_active ? "نشط" : "غير نشط"} color={item.is_active ? "green" : "gray"} />
        {item.is_service && <Badge label="خدمة" color="purple" />}
        {item.tax_exempt && <Badge label="معفى من الضريبة" color="yellow" />}
      </div>

      <div className="page-surface overflow-hidden p-0">
        <div className="p-4 border-b border-border-subtle">
          <h3 className="section-title mb-0">أرصدة المخزون</h3>
        </div>
        <DataGrid
          data={stock}
          rowKey={(r, i) => r.warehouse_id || i}
          className="border-0"
          columns={[
            { id: "warehouse_name", header: "المخزن", width: 250, sortable: true, cellClass: "font-semibold text-slate-800" },
            { id: "quantity", header: "الكمية", width: 150, sortable: true, cellClass: "font-mono font-black text-emerald-700" },
          ]}
        />
      </div>

      <div className="page-surface overflow-hidden p-0">
        <div className="p-4 border-b border-border-subtle">
          <h3 className="section-title mb-0">آخر حركات المخزون</h3>
        </div>
        <DataGrid
          data={movements}
          rowKey="id"
          className="border-0"
          columns={[
            { id: "created_at", header: "التاريخ", width: 150, sortable: true, render: r => new Date(r.created_at).toLocaleString("ar-EG") },
            { id: "type", header: "النوع", width: 150, sortable: true },
            { id: "quantity", header: "الكمية", width: 100, sortable: true, cellClass: "font-mono font-black text-slate-700" },
            { id: "warehouse_name", header: "المخزن", width: 200, sortable: true },
            { id: "reference", header: "المرجع", width: 150, sortable: true },
          ]}
        />
      </div>
    </PageWrapper>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="glass-panel rounded-[18px] p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value || "—"}</p>
    </div>
  );
}

function PriceRow({ label, value }) {
  return (
    <div>
      <span className="text-text-secondary">{label}: </span>
      <span className="font-semibold"><CurrencyDisplay value={value} /></span>
    </div>
  );
}
