import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function AjalStatementTemplate({ debt, settings = {} }) {
  const invoice = {
    ...debt,
    debt,
    customer_name: debt?.customer_name,
    customer_phone: debt?.customer_phone || debt?.phone,
    doc_number: debt?.invoice_no || "",
    doc_date: debt?.created_at ? new Date(debt.created_at).toLocaleDateString("ar-EG-u-nu-latn") : new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: `كشف دين آجل - فاتورة ${debt?.invoice_no || ""}`,
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="ajal_statement"
    />
  );
}
