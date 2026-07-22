import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function PhysicalCountTemplate({ session = {}, settings = {} }) {
  const invoice = {
    ...session,
    doc_number: session.id || "",
    title: session.name || `جرد #${session.id}`,
    doc_date: session.created_at ? new Date(session.created_at).toLocaleDateString("ar-EG-u-nu-latn") : "",
  };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="physical_count_report"
    />
  );
}
