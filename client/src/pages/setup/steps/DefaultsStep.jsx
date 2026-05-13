import React from "react";
import Input from "../../../components/ui/Input";

export default function DefaultsStep() {
  return (
    <div className="grid gap-3">
      <Input label="المخزن الافتراضي" required />
      <Input label="الخزينة الافتراضية" required />
    </div>
  );
}
