import { useRef, useState, useLayoutEffect } from "react";

export default function SmartTooltip({ children, content, side = "top", fill = false, wide = false }) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef(null);
  const tipRef = useRef(null);

  useLayoutEffect(() => {
    if (!show || !tipRef.current || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const tw = tipRef.current.offsetWidth;
    const th = tipRef.current.offsetHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x, y;
    if (side === "bottom") { x = cx - tw / 2; y = r.bottom + 8; }
    else if (side === "top") { x = cx - tw / 2; y = r.top - 8 - th; }
    else if (side === "left") { x = r.left - 8 - tw; y = cy - th / 2; }
    else { x = r.right + 8; y = cy - th / 2; }
    tipRef.current.style.left = x + "px";
    tipRef.current.style.top = y + "px";
  }, [show, side]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      className={fill ? "block" : "inline-block"}
    >
      {children}
      {show && (
        <div
          ref={tipRef}
          style={{ position: "fixed", zIndex: 9999, pointerEvents: "none" }}
          className={`rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl px-4 py-3 text-xs font-bold text-white shadow-2xl shadow-slate-900/40 whitespace-normal leading-relaxed ring-1 ring-inset ring-white/10 text-right ${wide ? "max-w-[320px]" : "max-w-[220px] text-center"}`}
        >
          {wide && typeof content === "string"
            ? content.split("\n\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-2 pt-2 border-t border-white/10 text-slate-300" : ""}>{para}</p>
              ))
            : content}
        </div>
      )}
    </div>
  );
}
