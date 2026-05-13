import React from "react";

export default function BarcodeLabel({ item = {} }) {
  return (
    <div className="w-[240px] rounded-md border border-slate-300 bg-white p-3 text-center text-black">
      <div className="text-sm font-semibold">{item.name || "اسم الصنف"}</div>
      <div className="mt-2 font-mono text-lg tracking-[0.35em]" dir="ltr">
        {item.barcode || "000000000000"}
      </div>
      <div className="mt-2 text-xs text-slate-500" dir="ltr">
        {item.code || "ITEM-0001"}
      </div>
    </div>
  );
}
