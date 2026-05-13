import React from "react";

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

  return (
    <button {...props} className={classes} disabled={disabled || loading}>
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
    </button>
  );
}