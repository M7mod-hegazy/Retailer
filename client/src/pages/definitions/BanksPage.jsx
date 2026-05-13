import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function BanksPage() {
  return (
    <SimpleCrudPage
      pageKey="banks"
      title="الحسابات البنكية"
      endpoint="/api/banks"
      fields={[
        { name: "name", label: "اسم البنك", required: true },
        { name: "code", label: "الكود" },
        { name: "balance", label: "الرصيد", type: "number" },
      ]}
      columns={[
        { key: "name", label: "البنك" },
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
