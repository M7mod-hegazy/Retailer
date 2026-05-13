import React from "react";
import Input from "../../../components/ui/Input";

export default function AdminAccountStep() {
  return (
    <div className="grid gap-3">
      <Input label="اسم المستخدم" required />
      <Input label="كلمة المرور" type="password" required />
      <Input label="تأكيد كلمة المرور" type="password" required />
    </div>
  );
}
