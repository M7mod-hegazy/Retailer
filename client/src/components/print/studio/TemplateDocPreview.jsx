// Template-doc preview: renders a report/statement doc with its real template
// component + mock data (reduced-mode preview). Extracted from PrintStudio so
// both the Studio and the standalone DocPresetPicker render these docs
// identically.
import React from "react";
import BankStatementTemplate from "../templates/BankStatementTemplate";
import AjalStatementTemplate from "../templates/AjalStatementTemplate";
import AjalScheduleTemplate from "../templates/AjalScheduleTemplate";
import ChequeRegisterTemplate from "../templates/ChequeRegisterTemplate";
import PaymentMethodsReportTemplate from "../templates/PaymentMethodsReportTemplate";
import DailyTreasuryTemplate from "../templates/DailyTreasuryTemplate";
import AjalFullStatementTemplate from "../templates/AjalFullStatementTemplate";
import GenericReportTemplate from "../templates/GenericReportTemplate";
import { TEMPLATE_MOCK } from "./studioData";

// Docs that print via a dedicated template component (not the block library).
export const TEMPLATE_PREVIEW_DOCS = new Set([
  "bank_statement", "ajal_statement", "ajal_schedule", "cheque_register",
  "payment_methods_report", "daily_treasury", "ajal_full_statement", "reports_generic",
]);

// `mock` defaults to TEMPLATE_MOCK[scope] so call-sites without it still work.
export default function TemplateDocPreview({ scope, settings, mock: mockProp }) {
  const mock = mockProp || TEMPLATE_MOCK[scope] || {};
  switch (scope) {
    case "bank_statement":
      return <BankStatementTemplate bank={mock.bank} transactions={mock.transactions} from={mock.from} to={mock.to} settings={settings} />;
    case "ajal_statement":
      return <AjalStatementTemplate debt={mock.debt} settings={settings} />;
    case "ajal_schedule":
      return <AjalScheduleTemplate debt={mock.debt} settings={settings} />;
    case "cheque_register":
      return <ChequeRegisterTemplate rows={mock.rows} settings={settings} />;
    case "payment_methods_report":
      return <PaymentMethodsReportTemplate rows={mock.rows} filters={mock.filters} totalIn={mock.totalIn} totalOut={mock.totalOut} settings={settings} />;
    case "daily_treasury":
      return <DailyTreasuryTemplate data={mock} settings={settings} />;
    case "ajal_full_statement":
      return <AjalFullStatementTemplate data={mock} settings={settings} />;
    case "reports_generic":
      return <GenericReportTemplate data={mock} settings={settings} />;
    default:
      return null;
  }
}
