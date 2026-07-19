import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from '../../hooks/usePageTour';

export default function ExpenseCategoriesPage() {
  usePageTour('expense_categories');
  return (
    <SimpleCrudPage
      pageKey="financial_categories"
      title="أقسام المصروفات"
      endpoint="/api/expenses/categories"
      fields={[
        { name: "name", label: "اسم القسم", required: true },
      ]}
      columns={[
        { key: "id", label: "#" },
        { key: "name", label: "القسم" },
      ]}
      buildPayload={(form) => ({
        name: form.name,
      })}
    />
  );
}
