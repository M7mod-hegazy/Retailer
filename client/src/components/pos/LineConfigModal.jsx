import React, { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import Modal from "../ui/Modal";
import TitleBar from "../ui/TitleBar";
import api from "../../services/api";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { formatNumber } from "../../utils/currency";
import { useDetach } from "../../hooks/useDetach";

function money(v) {
  return formatNumber(v, { decimals: 2 });
}

/**
 * Per-line configuration modal for POS cart lines.
 *
 * This is the single place every per-line feature lives, so that no matter how many
 * features are active at once, each one has a defined home and the cart row stays clean.
 * Sections render only when (a) their feature flag is on AND (b) the item actually needs
 * them — so with all flags off this modal is never opened, and with several on the user
 * sees one tidy stack of sections.
 *
 * Currently implemented: multi-unit (functional), gold (read-only breakdown). Serial and
 * modifier sections are placed here too and light up as those slices land.
 *
 * Props:
 *   line     – the cart line object (item_id, quantity, unit_price, sold_unit_id, ...)
 *   item     – the catalog item (optional; used for gold/serial flags)
 *   onClose  – () => void
 *   onApply  – (patch) => void   applies a partial update to the line
 */
export default function LineConfigModal({ line, item, onClose, onApply }) {
  const { handleDetach } = useDetach("line-config", {
    onClose, getState: () => ({ line, item }), actions: { apply: (data) => onApply?.(data) },
  });
  const multiUnitEnabled = useFeatureEnabled("feature_multi_unit");
  const serialsEnabled = useFeatureEnabled("feature_serials");
  const goldEnabled = useFeatureEnabled("feature_gold");

  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!line || !multiUnitEnabled) { setUnits([]); return; }
    setLoadingUnits(true);
    api.get(`/api/items/${line.item_id}/units`)
      .then((r) => { if (alive) setUnits(r.data?.data || []); })
      .catch(() => { if (alive) setUnits([]); })
      .finally(() => { if (alive) setLoadingUnits(false); });
    return () => { alive = false; };
  }, [line, multiUnitEnabled]);

  if (!line) return null;

  const basePrice = Number(line.master_sale_price ?? line.unit_price ?? 0);
  const activeUnitId = line.sold_unit_id || null;

  const pickBaseUnit = () => {
    onApply({
      sold_unit_id: null,
      sold_unit_name: null,
      sold_unit_factor: null,
      unit_price: basePrice || line.unit_price,
    });
  };

  const pickUnit = (u) => {
    const price = u.sale_price != null ? Number(u.sale_price) : basePrice * Number(u.factor || 1);
    onApply({
      sold_unit_id: u.id,
      sold_unit_name: u.unit_name,
      sold_unit_factor: Number(u.factor || 1),
      unit_price: price,
    });
  };

  const showMultiUnit = multiUnitEnabled;
  const showGold = goldEnabled && (item?.is_gold_item || line.is_gold_item);
  const showSerials = serialsEnabled && (item?.track_serials || line.track_serials);
  const nothing = !showMultiUnit && !showGold && !showSerials;

  return (
    <Modal open title={null} onClose={onClose} maxWidth="max-w-md">
      <div dir="rtl" className="space-y-5">
        <TitleBar title="تفاصيل السطر" subtitle={line.item_name} onClose={onClose} onDetach={handleDetach} />

        <div data-modal-content>
        {/* Multi-unit section */}
        {showMultiUnit && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-black text-sky-700">
              <Package className="h-4 w-4" /> وحدة البيع
            </div>
            {loadingUnits ? (
              <div className="flex items-center gap-2 text-[12px] text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل…</div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {/* Base unit */}
                <button type="button" onClick={pickBaseUnit}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-right transition-all ${
                    !activeUnitId ? "border-sky-300 bg-sky-50 ring-2 ring-sky-100" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}>
                  <span className="text-[13px] font-black text-slate-800">{line.unit_name || "الوحدة الأساسية"}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-black text-slate-600">{money(basePrice)}</span>
                    {!activeUnitId && <Check className="h-4 w-4 text-sky-600" />}
                  </span>
                </button>
                {/* Extra units */}
                {units.map((u) => {
                  const price = u.sale_price != null ? Number(u.sale_price) : basePrice * Number(u.factor || 1);
                  const active = activeUnitId === u.id;
                  return (
                    <button key={u.id} type="button" onClick={() => pickUnit(u)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-right transition-all ${
                        active ? "border-sky-300 bg-sky-50 ring-2 ring-sky-100" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}>
                      <span className="text-[13px] font-black text-slate-800">
                        {u.unit_name}
                        <span className="mr-1.5 text-[11px] font-bold text-slate-400">= {u.factor} {line.unit_name || "وحدة"}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-black text-slate-600">{money(price)}</span>
                        {active && <Check className="h-4 w-4 text-sky-600" />}
                      </span>
                    </button>
                  );
                })}
                {units.length === 0 && (
                  <p className="text-[11px] font-bold text-slate-400">لا توجد وحدات إضافية لهذا الصنف — يُباع بالوحدة الأساسية.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Gold breakdown (read-only) */}
        {showGold && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-black text-yellow-700">
              <Gem className="h-4 w-4" /> تسعير الذهب
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 px-3 py-2 text-[12px] font-bold text-yellow-800 space-y-1">
              <div className="flex justify-between"><span>العيار</span><span className="font-mono">{item?.gold_karat || line.gold_karat || "—"}</span></div>
              <div className="flex justify-between"><span>الوزن (جرام)</span><span className="font-mono">{item?.gold_weight_grams || line.gold_weight_grams || "—"}</span></div>
              <div className="flex justify-between"><span>السعر المحسوب</span><span className="font-mono">{money(line.unit_price)}</span></div>
            </div>
          </section>
        )}

        {/* Serial section placeholder (lights up in the serials slice) */}
        {showSerials && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-black text-rose-700">
              <Smartphone className="h-4 w-4" /> أرقام السيريال / IMEI
            </div>
            <p className="text-[11px] font-bold text-slate-400">سيتم إدخال {line.quantity} رقم سيريال هنا.</p>
          </section>
        )}

        {nothing && (
          <p className="text-[12px] font-bold text-slate-400">لا توجد خيارات إضافية لهذا السطر.</p>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-black text-white hover:bg-primary-600">تم</button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
