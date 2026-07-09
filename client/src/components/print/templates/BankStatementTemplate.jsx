import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function BankStatementTemplate({ bank, transactions, from, to, settings = {} }) {
  const invoice = {
    bank,
    transactions,
    from,
    to,
    customer_name: bank?.name || "",
    doc_number: bank?.account_number || "",
    doc_date: new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: `كشف حساب بنكي - ${bank?.name || ""}`,
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="bank_statement"
    />
  );
}
