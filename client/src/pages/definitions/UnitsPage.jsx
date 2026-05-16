import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from "../../hooks/usePageTour";

export default function UnitsPage() {
  usePageTour('units');
  return (
    <SimpleCrudPage
      pageKey="units"
      title="وحدات القياس"
      endpoint="/api/units"
      fields={[
        { name: "name", label: "اسم الوحدة", required: true },
        { name: "symbol", label: "الرمز" },
      ]}
      columns={[
        { key: "id", label: "#" },
        { key: "name", label: "الوحدة" },
        { key: "symbol", label: "الرمز" },
      ]}
    />
  );
}
