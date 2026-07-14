import { useState } from "react";

export default function PriceHealthHint({ label, children }) {
  const [show, setShow] = useState(false);

  if (!label) return children;

  return (
    <div
      className="relative w-full"
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="pointer-events-none absolute -bottom-4 inset-x-0 z-20 truncate rounded border border-slate-100 bg-white/95 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-slate-400"
        >
          {label}
        </span>
      )}
    </div>
  );
}
