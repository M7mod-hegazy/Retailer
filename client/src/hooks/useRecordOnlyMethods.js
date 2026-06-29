import { useEffect, useState } from "react";
import api from "../services/api";

// Returns the active "record-only" payment methods — فيزا (system card) plus any
// digital wallets (Vodafone Cash, InstaPay, ...). Excludes cash/credit (handled
// explicitly) and any legacy bank methods. These are paid/received under their
// method NAME and move no balance. Use alongside an explicit "نقدي" option:
//
//   const methods = useRecordOnlyMethods();
//   <option value="cash">💵 نقدي</option>
//   {methods.map(m => <option key={m.id} value={m.name}>{(m.icon||'💳')+' '+m.name}</option>)}
export default function useRecordOnlyMethods() {
  const [methods, setMethods] = useState([]);
  useEffect(() => {
    let alive = true;
    api
      .get("/api/payment-methods")
      .then((r) => {
        if (!alive) return;
        setMethods(
          (r.data?.data || []).filter(
            (m) =>
              m.is_active !== 0 &&
              m.category !== "cash" &&
              m.category !== "credit" &&
              m.category !== "bank" &&
              m.type !== "bank",
          ),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return methods;
}
