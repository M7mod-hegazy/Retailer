import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function AjalFullStatementTemplate({ data = {}, settings = {} }) {
  const invoice = {
    ...data,
    debts: data.debts,
    doc_number: "SH-AJALFULL",
    doc_date: new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: "التقرير الكلي لحسابات الديون الآجلة",
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="ajal_full_statement"
    />
  );
}
