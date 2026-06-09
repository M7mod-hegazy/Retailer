import { useEffect, useState } from "react";

// Returns true when the viewport width is at or below `maxWidth` — used to switch
// space-constrained UI (e.g. the POS summary) into a compact mode on small/square
// screens. SSR-safe and updates on resize.
export function useIsNarrowViewport(maxWidth = 1100) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= maxWidth : false
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= maxWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxWidth]);
  return narrow;
}
