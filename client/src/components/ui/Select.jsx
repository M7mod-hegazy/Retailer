import React from "react";

export function Select({ options = [], className = "", ...props }) {
  return (
    <select {...props} className={`input w-full ${className}`.trim()}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default Select;
