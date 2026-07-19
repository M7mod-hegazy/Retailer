import { useRef, useState, useLayoutEffect } from "react";

export default function PriceHealthHint({ label, children }) {
  const [show, setShow] = useState(false);
  const wrapperRef = useRef(null);
  const tipRef = useRef(null);

  // Fixed positioning (computed from the wrapper's own rect) escapes any
  // ancestor `overflow: hidden` — e.g. DataGrid cells clip absolutely
  // positioned children, which silently hid this label in the cart grid.
  useLayoutEffect(() => {
    if (!show || !tipRef.current || !wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    const tw = tipRef.current.offsetWidth;
    tipRef.current.style.left = `${r.left + r.width / 2 - tw / 2}px`;
    tipRef.current.style.top = `${r.bottom + 4}px`;
  }, [show]);

  if (!label) return children;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          ref={tipRef}
          style={{ position: "fixed", zIndex: 9999 }}
          className="pointer-events-none whitespace-nowrap rounded border border-border-subtle bg-bg-surface/95 px-1 py-0.5 text-[9px] font-bold leading-none text-text-muted shadow-sm"
        >
          {label}
        </span>
      )}
    </div>
  );
}
