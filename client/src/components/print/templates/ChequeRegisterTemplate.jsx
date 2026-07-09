import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function ChequeRegisterTemplate({ rows = [], settings = {} }) {
  const invoice = {
    rows,
    doc_number: "SH-CHEQUES",
    doc_date: new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: "سجل حركة شيكات أوراق القبض الكلي",
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="cheque_register"
    />
  );
}
