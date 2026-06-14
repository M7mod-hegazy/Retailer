import React, { useState } from "react";
import { Search, Smartphone, Package, CheckCircle, AlertCircle, Clock } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import FeatureRoute from "../../components/ui/FeatureRoute";

const STATUS_LABELS = {
  in_stock: { label: "في المخزون", icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
  sold:     { label: "مُباع", icon: Package, color: "text-blue-600 bg-blue-50" },
  returned: { label: "مُعاد", icon: CheckCircle, color: "text-amber-600 bg-amber-50" },
  defective:{ label: "معطوب", icon: AlertCircle, color: "text-red-600 bg-red-50" },
};

function SerialCard({ data }) {
  const status = STATUS_LABELS[data.status] || { label: data.status, icon: Clock, color: "text-slate-600 bg-slate-50" };
  const Icon = status.icon;
  const warrantyOk = data.warranty_expires && new Date(data.warranty_expires) >= new Date();
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4 max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">{data.serial}</h3>
          <p className="text-sm font-bold text-slate-500 mt-0.5">{data.item_name}</p>
          {data.item_barcode && <p className="text-xs font-mono text-slate-400 mt-0.5">{data.item_barcode}</p>}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${status.color}`}>
          <Icon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {data.sold_at && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">تاريخ البيع</span>
            <p className="font-bold text-slate-700">{data.sold_at.slice(0, 10)}</p>
          </div>
        )}
        {data.warranty_months && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">الضمان</span>
            <p className={`font-bold ${warrantyOk ? "text-emerald-600" : "text-red-500"}`}>
              {data.warranty_expires ? (warrantyOk ? `ينتهي ${data.warranty_expires}` : `انتهى ${data.warranty_expires}`) : `${data.warranty_months} شهر`}
            </p>
          </div>
        )}
        {data.invoice_id && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">رقم الفاتورة</span>
            <p className="font-bold text-slate-700">#{data.invoice_id}</p>
          </div>
        )}
        {data.returned_at && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">تاريخ الإعادة</span>
            <p className="font-bold text-amber-600">{data.returned_at.slice(0, 10)}</p>
          </div>
        )}
      </div>

      {data.notes && (
        <p className="text-xs font-bold text-slate-500 bg-slate-50 rounded-lg p-3">{data.notes}</p>
      )}
    </div>
  );
}

function SerialLookupContent() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    try {
      const r = await api.get(`/api/serials/search?q=${encodeURIComponent(query.trim())}`);
      setResult(r.data?.data);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else toast.error("تعذر البحث");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="standard-page-container space-y-6 pb-20">
      <div>
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          <Smartphone className="h-4 w-4" />
          <span className="text-[11px] font-black uppercase tracking-widest">بحث السيريال</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">البحث عن سيريال / IMEI</h1>
        <p className="text-sm font-bold text-slate-400 mt-1">اعرف حالة أي جهاز: هل هو في المخزون، مُباع، أو مُعاد؟</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 max-w-lg">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="أدخل رقم السيريال أو IMEI..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none shadow-sm"
          />
        </div>
        <button type="submit" disabled={loading} className="rounded-xl bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-600 disabled:opacity-50">
          {loading ? "..." : "بحث"}
        </button>
      </form>

      {result && <SerialCard data={result} />}
      {notFound && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 max-w-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">السيريال <strong>{query}</strong> غير موجود في النظام</p>
        </div>
      )}
    </div>
  );
}

export default function SerialLookupPage() {
  return (
    <FeatureRoute featureKey="feature_serials">
      <SerialLookupContent />
    </FeatureRoute>
  );
}
