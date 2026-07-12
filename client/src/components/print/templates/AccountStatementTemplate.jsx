import React, { useEffect } from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function AccountStatementTemplate({ statement = {}, settings = {}, currentPage, onPageCount }) {
  const rows = statement.rows || [];
  const summary = statement.summary || {};

  // One logical flow: the statement blocks render every row and the print
  // pipeline paginates at natural block/row boundaries. Reporting
  // ceil(rows/15) here while rendering ALL rows made the hidden print
  // container hold N full copies of the statement — printed duplicates.
  useEffect(() => {
    if (onPageCount) onPageCount(1);
  }, [onPageCount]);

  const invoice = {
    statement_rows: rows,
    statement_summary: summary,
    partyType: statement.partyType || "customer",
    period: statement.period || {},
    customer_name: summary.party_name || summary.customer_name || summary.supplier_name || "",
    doc_number: summary.party_code || "",
    doc_date: new Date().toLocaleDateString("ar-EG-u-nu-latn"),
    title: statement.partyType === "customer" ? "كشف حساب عميل" : "كشف حساب مورد",
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="account_statement"
    />
  );
}
