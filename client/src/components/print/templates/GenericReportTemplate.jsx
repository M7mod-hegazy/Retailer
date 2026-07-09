import React from "react";
import LayoutRenderer from "../LayoutRenderer";

export default function GenericReportTemplate({ data = {}, settings = {} }) {
  const invoice = { ...data };
  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={settings.layout || null}
      size={settings.paper_size || "A4"}
      scope="reports_generic"
    />
  );
}
