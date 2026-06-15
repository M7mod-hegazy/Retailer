import React, { forwardRef } from "react";

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

const Button = forwardRef(({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  loading,
  icon: Icon,
  ...props
}, ref) => {
  const classes = [
    "btn",
    variants[variant] || variants.primary,
    sizes[size] || "",
    className,
  ].filter(Boolean).join(" ");

  const isNativeButton = Component === "button";
  const isDisabled = disabled || loading;
  const stateProps = isNativeButton
    ? { disabled: isDisabled }
    : { "aria-disabled": isDisabled || undefined };

  return (
    <Component
      ref={ref}
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
});

Button.displayName = "Button";
export default Button;
