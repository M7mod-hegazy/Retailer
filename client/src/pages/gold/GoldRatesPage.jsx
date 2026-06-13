import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../services/api";
import { Gem, Plus, RefreshCw } from "lucide-react";
import Button from "../../components/ui/Button";
import FeatureRoute from "../../components/ui/FeatureRoute";

const KARATS = [18, 21, 22, 24];

const KARAT_LABELS = { 18: "عيار 18", 21: "عيار 21", 22: "عيار 22", 24: "عيار 24 (خالص)" };

export default function GoldRatesPage() {
  const qc = useQueryClient();
  const [rates, setRates] = useState({ 18: "", 21: "", 22: "", 24: "" });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["gold-rates-today"],
    queryFn: () => api.get("/api/gold/rates/today").then(r => r.data),
    onSuccess: (d) => {
      const updated = { 18: "", 21: "", 22: "", 24: "" };
      (d.data || []).forEach(r => { updated[r.karat] = String(r.price_per_gram); });
      setRates(updated);
    },
  });

  const isStale = data?.stale;
  const displayDate = data?.date;

  async function save(e) {
    e.preventDefault();
    const ratesArr = KARATS.filter(k => rates[k]).map(k => ({ karat: k, price_per_gram: Number(rates[k]) }));
    if (ratesArr.length === 0) { toast.error("أدخل سعراً لعيار واحد على الأقل"); return; }
    setSaving(true);
    try {
      await api.post("/api/gold/rates", { rates: ratesArr });
      qc.invalidateQueries(["gold-rates-today"]);
      toast.success("تم حفظ أسعار الذهب");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FeatureRoute featureKey="feature_gold">
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <Gem className="h-6 w-6 text-yellow-500" />
          <h1 className="text-xl font-black">أسعار الذهب اليومية</h1>
          {isStale && (
            <span className="rounded-full bg-amber-100 text-amber-700 text-[11px] font-black px-2 py-0.5">
              آخر تسعيرة: {displayDate}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-slate-400 py-8 text-center">جاري التحميل...</div>
        ) : (
          <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <p className="text-[12px] text-slate-500 font-bold">سعر الجرام بالجنيه المصري — اتركه فارغاً إذا لم يُباع</p>

            <div className="grid gap-4 md:grid-cols-2">
              {KARATS.map(k => (
                <div key={k} className="space-y-1">
                  <label className="text-sm font-black text-slate-700">{KARAT_LABELS[k]}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-200 pe-12 ps-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      placeholder="0.00"
                      value={rates[k]}
                      onChange={e => setRates(p => ({ ...p, [k]: e.target.value }))}
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">ج.م</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                <Plus className="h-4 w-4 me-1" />
                {saving ? "جاري الحفظ..." : "حفظ أسعار اليوم"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => qc.invalidateQueries(["gold-rates-today"])}>
                <RefreshCw className="h-4 w-4 me-1" />تحديث
              </Button>
            </div>
          </form>
        )}

        {/* History */}
        <GoldRateHistory />
      </div>
    </FeatureRoute>
  );
}

function GoldRateHistory() {
  const { data } = useQuery({
    queryKey: ["gold-rates-history"],
    queryFn: () => api.get("/api/gold/rates?limit=20").then(r => r.data.data || []),
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">آخر 20 سعر</h3>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-start">التاريخ</th>
              <th className="px-4 py-2 text-start">العيار</th>
              <th className="px-4 py-2 text-end">سعر الجرام</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-slate-600">{r.rate_date}</td>
                <td className="px-4 py-2 font-bold">{KARAT_LABELS[r.karat] || r.karat}</td>
                <td className="px-4 py-2 text-end font-black text-yellow-700">{Number(r.price_per_gram).toLocaleString()} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
