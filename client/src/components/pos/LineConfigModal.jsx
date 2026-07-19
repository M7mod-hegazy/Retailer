import React, { useEffect, useState, useRef, useMemo } from "react";
import { Loader2, Package, Check, Gem, Smartphone, QrCode, UtensilsCrossed } from "lucide-react";
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
  const restaurantEnabled = useFeatureEnabled("feature_restaurant");

  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [serials, setSerials] = useState(() => {
    if (!line?.serials || !line.serials.length) return [];
    return [...line.serials];
  });
  const firstSerialRef = useRef(null);

  // Modifier picker state
  const [modifierGroups, setModifierGroups] = useState([]);
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState(() => {
    if (!line?.modifiers || !line.modifiers.length) return [];
    return line.modifiers.map((m) => ({ ...m }));
  });

  const showModifiers = restaurantEnabled && line?.item_id;

  // Seed serials array when modal opens for tracked items
  useEffect(() => {
    if (!serialsEnabled || !line?.track_serials) return;
    const qty = Number(line.quantity);
    setSerials((prev) => {
      if (prev.length >= qty) return prev;
      const next = [...prev];
      for (let i = prev.length; i < qty; i++) next.push("");
      return next;
    });
  }, [line?.quantity, line?.track_serials, serialsEnabled]);

  const handleSerialChange = (idx, value) => {
    setSerials((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleSerialApply = () => {
    const filled = serials.filter(Boolean);
    if (filled.length) onApply?.({ serials: filled });
  };

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

  // Fetch modifier groups for this item
  useEffect(() => {
    let alive = true;
    if (!line || !restaurantEnabled) { setModifierGroups([]); return; }
    setLoadingModifiers(true);
    api.get(`/api/restaurant/items/${line.item_id}/modifier-groups`)
      .then((r) => { if (alive) setModifierGroups(r.data?.data || []); })
      .catch(() => { if (alive) setModifierGroups([]); })
      .finally(() => { if (alive) setLoadingModifiers(false); });
    return () => { alive = false; };
  }, [line, restaurantEnabled]);

  // Clear stale selected modifiers that no longer exist in any group
  useEffect(() => {
    if (!modifierGroups.length || !selectedModifiers.length) return;
    const validIds = new Set();
    for (const g of modifierGroups) {
      for (const m of (g.modifiers || [])) validIds.add(m.id);
    }
    setSelectedModifiers((prev) => prev.filter((m) => validIds.has(m.id)));
  }, [modifierGroups]);

  // Compute modifier price adjustment total
  const modifierPriceDelta = useMemo(() => {
    return selectedModifiers.reduce((sum, m) => sum + Number(m.price_adjustment || 0), 0);
  }, [selectedModifiers]);

  const toggleModifier = (modifier) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === modifier.id);
      if (exists) return prev.filter((m) => m.id !== modifier.id);
      return [...prev, { id: modifier.id, name: modifier.name, price_adjustment: Number(modifier.price_adjustment || 0) }];
    });
  };

  const selectSingleModifier = (modifier, groupModifiers) => {
    setSelectedModifiers((prev) => {
      const withoutGroup = prev.filter((m) => !groupModifiers.find((gm) => gm.id === m.id));
      return [...withoutGroup, { id: modifier.id, name: modifier.name, price_adjustment: Number(modifier.price_adjustment || 0) }];
    });
  };

  const isModifierSelected = (modifierId) => selectedModifiers.some((m) => m.id === modifierId);

  const handleModifierApply = () => {
    const masterPrice = Number(line.master_sale_price ?? line.unit_price ?? 0);
    const adjustedPrice = selectedModifiers.length > 0 && modifierPriceDelta !== 0
      ? masterPrice + modifierPriceDelta
      : masterPrice;
    onApply?.({ modifiers: selectedModifiers, unit_price: adjustedPrice });
  };

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
  const showModifiersSection = showModifiers && modifierGroups.length > 0;
  const nothing = !showMultiUnit && !showGold && !showSerials && !showModifiersSection;

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
              <div className="flex items-center gap-2 text-[12px] text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل…</div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {/* Base unit */}
                <button type="button" onClick={pickBaseUnit}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-right transition-all ${
                    !activeUnitId ? "border-sky-300 bg-sky-50 ring-2 ring-sky-100" : "border-border-normal bg-bg-surface hover:border-border-strong"
                  }`}>
                  <span className="text-[13px] font-black text-text-primary">{line.unit_name || "الوحدة الأساسية"}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-black text-text-secondary">{money(basePrice)}</span>
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
                        active ? "border-sky-300 bg-sky-50 ring-2 ring-sky-100" : "border-border-normal bg-bg-surface hover:border-border-strong"
                      }`}>
                      <span className="text-[13px] font-black text-text-primary">
                        {u.unit_name}
                        <span className="mr-1.5 text-[11px] font-bold text-text-muted">= {u.factor} {line.unit_name || "وحدة"}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-black text-text-secondary">{money(price)}</span>
                        {active && <Check className="h-4 w-4 text-sky-600" />}
                      </span>
                    </button>
                  );
                })}
                {units.length === 0 && (
                  <p className="text-[11px] font-bold text-text-muted">لا توجد وحدات إضافية لهذا الصنف — يُباع بالوحدة الأساسية.</p>
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

        {/* Serial section — N input fields for N quantity */}
        {showSerials && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-black text-rose-700">
              <Smartphone className="h-4 w-4" /> أرقام السيريال / IMEI
            </div>
            <p className="text-[11px] font-bold text-text-secondary mb-1">ادخل أو امسح {line.quantity} رقماً سيريال</p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pl-1">
              {Array.from({ length: Math.max(Number(line.quantity), 1) }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 text-[11px] font-black text-text-muted shrink-0">{idx + 1}</span>
                  <input
                    ref={idx === 0 ? firstSerialRef : null}
                    type="text"
                    value={serials[idx] || ""}
                    onChange={(e) => handleSerialChange(idx, e.target.value)}
                    placeholder="امسح أو اكتب السيريال"
                    className="w-full rounded-lg border border-rose-200 bg-bg-surface px-3 py-1.5 text-[13px] font-bold text-text-primary placeholder:text-text-muted focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 rtl:text-right"
                    autoFocus={idx === 0}
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={handleSerialApply}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-100 px-3 py-2 text-[12px] font-black text-rose-700 hover:bg-rose-200 transition-colors">
              <QrCode className="h-4 w-4" /> تطبيق {serials.filter(Boolean).length} سيريال
            </button>
          </section>
        )}

        {/* Modifier section (feature_restaurant) */}
        {showModifiersSection && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-black text-emerald-700">
              <UtensilsCrossed className="h-4 w-4" /> الإضافات
            </div>
            {loadingModifiers ? (
              <div className="flex items-center gap-2 text-[12px] text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل…</div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {modifierGroups.map((group) => (
                  <div key={group.id} className="rounded-lg border border-border-normal overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-bg-overlay/80 border-b border-border-subtle">
                      <span className="text-[13px] font-black text-text-primary">{group.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${group.selection_type === "multi" ? "bg-blue-100 text-blue-700" : "bg-bg-overlay text-text-secondary"}`}>
                          {group.selection_type === "multi" ? "متعدد" : "اختيار واحد"}
                        </span>
                        {group.required ? <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">إجباري</span> : null}
                      </div>
                    </div>
                    <div className="p-1 space-y-0.5">
                      {group.modifiers.map((mod) => {
                        const selected = isModifierSelected(mod.id);
                        return (
                          <button key={mod.id} type="button" onClick={() =>
                            group.selection_type === "multi"
                              ? toggleModifier(mod)
                              : selectSingleModifier(mod, group.modifiers)
                          }
                            className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-right transition-all ${
                              selected
                                ? "border-emerald-200 bg-emerald-50 ring-1 ring-emerald-100"
                                : "border-transparent hover:bg-bg-overlay"
                            }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                selected ? "border-emerald-500 bg-emerald-500" : "border-border-strong"
                              }`}>
                                {selected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className="text-[13px] font-bold text-text-primary">{mod.name}</span>
                            </div>
                            {mod.price_adjustment !== 0 && (
                              <span className={`text-[12px] font-mono font-black ${mod.price_adjustment > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {mod.price_adjustment > 0 ? "+" : ""}{money(mod.price_adjustment)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedModifiers.length > 0 && modifierPriceDelta !== 0 && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50/80 px-3 py-2 text-[12px]">
                <span className="font-bold text-text-secondary">إجمالي تعديل السعر</span>
                <span className={`font-mono font-black ${modifierPriceDelta > 0 ? "text-emerald-700" : "text-red-500"}`}>
                  {modifierPriceDelta > 0 ? "+" : ""}{money(modifierPriceDelta)}
                </span>
              </div>
            )}
          </section>
        )}

        {nothing && (
          <p className="text-[12px] font-bold text-text-muted">لا توجد خيارات إضافية لهذا السطر.</p>
        )}

        <div className="flex justify-end border-t border-border-subtle pt-3">
          <button type="button" onClick={() => { if (showModifiersSection) handleModifierApply(); onClose(); }}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-black text-white hover:bg-primary-600">تم</button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
