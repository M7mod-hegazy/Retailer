import React from "react";

// Canonical action button. Every primary call-to-action across the app should
// route through this so button color/shape stays identical per theme. The base
// look comes from the `.btn*` classes (index.css, @layer components) which are
// driven by theme CSS variables; anything passed via `className` are utilities
// that win over the component layer, so per-button width/shape tweaks still work.
const variants = {
  primary: "btn-primary",
  secondary: "btn-ghost",
  danger: "btn-danger",
  ghost: "btn-ghost",
  icon: "btn-icon",
};

const sizes = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export default function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  loading,
  icon: Icon,
  ...props
}) {
  const classes = [
    "btn",
    variants[variant] || variants.primary,
    sizes[size] || "",
    className,
  ].filter(Boolean).join(" ");

  // Native <button> gets a real `disabled`; polymorphic targets (e.g. Link, a)
  // can't be disabled natively, so we expose state via aria + a class hook.
  const isNativeButton = Component === "button";
  const isDisabled = disabled || loading;
  const stateProps = isNativeButton
    ? { disabled: isDisabled }
    : { "aria-disabled": isDisabled || undefined };

  return (
    <Component
      {...props}
      {...stateProps}
      className={isNativeButton ? classes : `${classes}${isDisabled ? " btn-disabled" : ""}`}
    >
      {loading ? (
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
      ) : Icon ? (
        <>
          <Icon className="w-4 h-4" />
          {children}
        </>
      ) : (
        children
      )}
    </Component>
  );
}
