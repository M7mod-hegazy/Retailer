import React from "react";
import StepTable from "../StepTable";

export default function Step8FinalTable({ wizard }) {
  return (
    <StepTable
      wizard={wizard}
      rows={wizard.filteredRows}
      columns={wizard.orderedFields}
      title="الجدول النهائي القابل للتعديل"
      helper="ابحث في المشكلات، عدل الخلايا مباشرة، غير الإجراء لكل صف، واحذف أو استعد أي صف قبل المعاينة."
      showActions
      height={560}
    />
  );
}
