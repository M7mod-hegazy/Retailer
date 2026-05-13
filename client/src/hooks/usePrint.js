import { useRef } from "react";

export function usePrint() {
  const ref = useRef(null);
  const print = () => {
    if (ref.current) window.print();
  };
  return { ref, print };
}
