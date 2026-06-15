import React, { forwardRef } from "react";

const Select = forwardRef(({ options = [], className = "", children, ...props }, ref) => {
  return (
    <select ref={ref} {...props} className={`input w-full ${className}`.trim()}>
      {options.length > 0 ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  );
});

Select.displayName = "Select";
export { Select };
export default Select;
