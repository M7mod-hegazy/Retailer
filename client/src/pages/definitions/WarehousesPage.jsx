import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function WarehousesPage() {
  return (
    <SimpleCrudPage
      pageKey="warehouses"
      title="المخازن"
      endpoint="/api/warehouses"
      fields={[
        { name: "name", label: "اسم المخزن", required: true },
        { name: "code", label: "الكود" },
        { name: "is_default", label: "افتراضي (1/0)", type: "number" },
      ]}
      columns={[
        { key: "name", label: "المخزن" },
        { key: "code", label: "الكود" },
        { key: "is_default", label: "افتراضي" },
      ]}
      buildPayload={(form) => ({
        name: form.name,
        code: form.code || null,
        is_default: Number(form.is_default || 0) === 1,
      })}
    />
  );
}
