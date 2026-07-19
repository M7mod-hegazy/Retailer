import React from "react";

export default function Radio({ label, name, value, checked, onChange, disabled }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="h-4 w-4 border-border-normal/20 bg-bg-surface/5 text-primary focus:ring-primary/40"
      />
      {label ? <span className="text-sm text-text-primary">{label}</span> : null}
    </label>
  );
}
