import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function EmployeesPage() {
  return (
    <SimpleCrudPage
      pageKey="employees"
      title="الموظفون"
      endpoint="/api/employees"
      fields={[
        { name: "name", label: "اسم الموظف", required: true },
        { name: "role", label: "المسمى الوظيفي" },
        { name: "phone", label: "الهاتف" },
      ]}
      columns={[
        { key: "name", label: "الموظف" },
        { key: "role", label: "المسمى" },
        { key: "phone", label: "الهاتف" },
      ]}
    />
  );
}
