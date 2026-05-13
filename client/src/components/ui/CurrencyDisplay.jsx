import React from "react";
import { useAppSettingsStore } from "../../stores/appSettingsStore";

export default function CurrencyDisplay({ value, symbol, decimals }) {
  const settings = useAppSettingsStore((state) => state.settings);
  const effectiveSymbol = symbol || settings.currency_symbol || "ج.م";
  const effectiveDecimals =
    typeof decimals === "number" ? decimals : Number(settings.decimal_places ?? 2);
  const formatted = Number(value || 0).toFixed(effectiveDecimals);

  return (
    <span className="font-mono tabular-nums" dir="ltr">
      {formatted} {effectiveSymbol}
    </span>
  );
}

