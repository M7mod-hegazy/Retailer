import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function ExpenseCategoriesPage() {
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
