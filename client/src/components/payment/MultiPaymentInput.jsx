import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../services/api";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });

export default function MultiPaymentInput({
  totalAmount = 0,
  value = [],
  onChange,
  disabled = false,
  allowPartial = false,
}) {
  const { t } = useTranslation();
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    api.get("/api/payment-methods")
      .then((response) => setMethods(response.data.data || []))
      .catch(() => setMethods([]));
  }, []);

  const paid = useMemo(
    () => value.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [value],
  );
  const remaining = Number(totalAmount || 0) - paid;
  const isComplete = allowPartial ? paid > 0 : Math.abs(remaining) < 0.01;

  function emit(next) {
    if (typeof onChange === "function") onChange(next);
  }

  function addLine() {
    const firstUnused = methods.find((method) => !value.some((line) => Number(line.method_id) === Number(method.id)));
    if (!firstUnused) return;
    emit([
      ...value,
      {
        method_id: firstUnused.id,
        method_name: firstUnused.name,
        amount: remaining > 0 ? Number(remaining.toFixed(2)) : 0,
      },
    ]);
  }

  function updateLine(idx, field, rawValue) {
    const next = value.map((line, i) => {
      if (i !== idx) return line;
      if (field === "method_id") {
        const method = methods.find((m) => Number(m.id) === Number(rawValue));
        return { ...line, method_id: Number(rawValue), method_name: method?.name || "" };
      }
      return { ...line, [field]: field === "amount" ? Number(rawValue || 0) : rawValue };
    });
    emit(next);
  }

  function removeLine(idx) {
    emit(value.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    if (methods.length > 0 && value.length === 0) {
      const cash = methods.find((method) => method.category === "cash") || methods[0];
      emit([{ method_id: cash.id, method_name: cash.name, amount: Number(totalAmount || 0) }]);
    }
  }, [methods]);

  useEffect(() => {
    // Only sync single-line amount when it hasn't been manually set yet (amount is 0 or unset)
    if (value.length === 1 && Number(value[0].amount || 0) === 0) {
      emit([{ ...value[0], amount: Number(totalAmount || 0) }]);
    }
  }, [totalAmount]);

  const cashLine = value.find((line) => {
    const method = methods.find((m) => Number(m.id) === Number(line.method_id));
    return method?.category === "cash";
  });

  return (
    <div className="space-y-2" dir="rtl">
      {value.map((line, idx) => (
        <div key={`${line.method_id}-${idx}`} className="flex items-center gap-2">
          <select
            value={line.method_id || ""}
            disabled={disabled}
            onChange={(event) => updateLine(idx, "method_id", event.target.value)}
            className="flex-1 h-10 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-bold outline-none focus:border-violet-500"
          >
            {methods.map((method) => (
              <option key={method.id} value={method.id}>{method.icon || "card"} {method.name}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.amount}
            disabled={disabled}
            onChange={(event) => updateLine(idx, "amount", event.target.value)}
            className="w-32 h-10 rounded-xl border border-slate-300 px-3 text-left text-[13px] font-black font-mono outline-none focus:border-violet-500 ltr:text-left"
            dir="ltr"
          />
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => removeLine(idx)}
              disabled={disabled}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 disabled:opacity-40"
              title={t("payment.multi.remove", "حذف وسيلة الدفع")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addLine}
          disabled={disabled || methods.length <= value.length}
          className="flex items-center gap-1 text-[11px] font-black text-violet-600 hover:text-violet-800 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> {t("payment.multi.add", "إضافة وسيلة دفع أخرى")}
        </button>

        <div className="text-left" dir="ltr">
          {!isComplete && remaining > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-black text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("payment.multi.remaining", "متبقي")}: {fmt(remaining)} {t("currency.egp", "ج.م")}
            </span>
          )}
          {!isComplete && remaining < 0 && (
            <span className="flex items-center gap-1 text-[11px] font-black text-rose-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("payment.multi.overpaid", "زيادة")}: {fmt(Math.abs(remaining))} {t("currency.egp", "ج.م")}
            </span>
          )}
          {isComplete && (
            <span className="text-[11px] font-black text-emerald-600">{t("payment.multi.complete", "✓ مكتمل")}</span>
          )}
        </div>
      </div>

      {cashLine && remaining < -0.01 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-black text-emerald-700">
          {t("payment.multi.change", "الباقي للعميل")}: {fmt(Math.abs(remaining))} {t("currency.egp", "ج.م")}
        </div>
      )}
    </div>
  );
}
