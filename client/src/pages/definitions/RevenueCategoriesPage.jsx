import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function RevenueCategoriesPage() {
  return (
    <SimpleCrudPage
      pageKey="financial_categories"
      title="تصنيفات الإيرادات الأخرى"
      endpoint="/api/revenues/categories"
      fields={[
        { name: "name", label: "اسم التصنيف", required: true },
      ]}
      columns={[
        { key: "id", label: "#" },
        { key: "name", label: "التصنيف" },
      ]}
      buildPayload={(form) => ({
        name: form.name,
      })}
    />
  );
}
