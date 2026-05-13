import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function BranchesPage() {
  return (
    <SimpleCrudPage
      pageKey="branches"
      title="الفروع"
      endpoint="/api/branches"
      fields={[
        { name: "name", label: "اسم الفرع", required: true },
      ]}
      columns={[
        { key: "name", label: "الفرع" },
      ]}
      buildPayload={(form) => ({
        name: form.name,
      })}
    />
  );
}
