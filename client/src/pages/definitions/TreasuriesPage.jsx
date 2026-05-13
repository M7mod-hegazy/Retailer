import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function TreasuriesPage() {
  return (
    <SimpleCrudPage
      pageKey="banks"
      title="الخزن والصناديق"
      endpoint="/api/treasuries"
      fields={[
        { name: "name", label: "اسم الخزنة", required: true },
        { name: "code", label: "الكود" },
        { name: "balance", label: "الرصيد الافتتاحي", type: "number" },
      ]}
      columns={[
        { key: "name", label: "الخزنة" },
        { key: "code", label: "الكود" },
        { key: "balance", label: "الرصيد" },
      ]}
      buildPayload={(form) => ({
        ...form,
        balance: Number(form.balance || 0),
      })}
    />
  );
}
