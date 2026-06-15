import React, { forwardRef } from "react";

const Input = forwardRef(({ label, error, required, ...props }, ref) => {
  const hasValue = props.value !== undefined && props.value !== null && String(props.value).length > 0;
  const inferredAutoComplete =
    props.autoComplete ?? (props.type === "password" ? "new-password" : "off");
  return (
    <label className={`floating-label-wrapper block ${hasValue ? "has-value" : ""}`}>
      <input
        ref={ref}
        {...props}
        autoComplete={inferredAutoComplete}
        placeholder=" "
        className={`input w-full ${error ? "input-error" : ""}`}
      />
      {label && (
        <span className="floating-label">
          {label} {required && <span className="ms-1 text-danger-DEFAULT">*</span>}
        </span>
      )}
      {error && <span className="absolute -bottom-5 inset-inline-start-0 text-xs text-danger-DEFAULT">{error}</span>}
    </label>
  );
});

Input.displayName = "Input";
export default Input;
