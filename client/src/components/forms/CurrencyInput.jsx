import React from "react";

export default function CurrencyInput({ value = 0, onChange }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number.parseInt(e.target.value || "0", 10))}
      className="input w-full"
    />
  );
}
