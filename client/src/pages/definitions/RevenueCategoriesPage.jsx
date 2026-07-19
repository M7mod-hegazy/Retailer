import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from '../../hooks/usePageTour';

export default function RevenueCategoriesPage() {
  usePageTour('revenue_categories');
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
