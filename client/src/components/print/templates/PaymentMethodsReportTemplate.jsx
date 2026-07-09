import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function PaymentMethodsReportTemplate({ rows = [], filters = {}, totalIn = 0, totalOut = 0, byMethod = [], settings = {} }) {
  const invoice = {
    rows,
    filters,
    totalIn,
    totalOut,
    byMethod,
    doc_number: "SH-PAYMETHODS",
    doc_date: new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: "تقرير حركة وسائل الدفع والمحافظ",
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="payment_methods_report"
    />
  );
}
