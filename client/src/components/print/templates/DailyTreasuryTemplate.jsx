import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function DailyTreasuryTemplate({ data = {}, settings = {} }) {
  const invoice = {
    ...data,
    transactions: data.transactions,
    doc_number: data.shift_label || "",
    customer_name: data.cashier_name || "",
    doc_date: data.date ? new Date(data.date).toLocaleDateString("ar-EG-u-nu-latn") : new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: `تقرير حركة الخزينة اليومي - ${data.date || ""}`,
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="daily_treasury"
    />
  );
}
