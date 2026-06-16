import React from "react";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { formatNumber } from "../../utils/currency";

export default function CurrencyDisplay({ value, symbol, decimals, primary }) {
  const settings = useAppSettingsStore((state) => state.settings);
  const effectiveSymbol = symbol || settings.currency_symbol || "ج.م";
  const effectiveDecimals =
    typeof decimals === "number" ? decimals : Number(settings.decimal_places ?? 2);
  const formatted = formatNumber(value, { decimals: effectiveDecimals });
  const weightClass = primary ? "number-fmt-primary" : "number-fmt";

  return (
    <span className={`${weightClass} inline-flex items-center gap-1`} dir="ltr">
      <span>{formatted}</span>
      {effectiveSymbol && <span className="opacity-70 text-[0.85em]">{effectiveSymbol}</span>}
    </span>
  );
}

