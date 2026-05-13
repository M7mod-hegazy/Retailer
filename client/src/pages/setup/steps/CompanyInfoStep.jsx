import React from "react";
import Input from "../../../components/ui/Input";

export default function CompanyInfoStep() {
  return (
    <div className="grid gap-3">
      <Input label="اسم الشركة" required />
      <Input label="عنوان الشركة" />
      <Input label="رقم الهاتف" type="number" />
    </div>
  );
}
