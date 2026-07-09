import React, { useEffect } from "react";
import LayoutRenderer from "../LayoutRenderer";

const ROWS_PER_PAGE = 15;

export default function AccountStatementTemplate({ statement = {}, settings = {}, currentPage, onPageCount }) {
  const rows = statement.rows || [];
  const summary = statement.summary || {};
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

  useEffect(() => {
    if (onPageCount) onPageCount(totalPages);
  }, [totalPages, onPageCount]);

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
