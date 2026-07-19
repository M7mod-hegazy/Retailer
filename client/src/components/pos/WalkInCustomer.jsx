import React from "react";

// Unified customer display for invoice previews/lists. Anonymous invoices that
// captured a walk-in contact (invoices.walk_in_phone/walk_in_name) show it as
// the customer identity instead of a bare "عميل نقدي".

// Plain-text variant — for table cells, tooltips, and sorting-friendly spots.
export function invoiceCustomerText(inv) {
  if (inv?.customer_name) return inv.customer_name;
  if (inv?.walk_in_phone) return `عميل نقدي — ${inv.walk_in_name || inv.walk_in_phone}`;
  return "عميل نقدي";
}

// Rich variant — walk-in badge + captured name/phone.
export function InvoiceCustomer({ invoice }) {
  if (invoice?.customer_name) return <span>{invoice.customer_name}</span>;
  const phone = invoice?.walk_in_phone;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black whitespace-nowrap">
        🚶 عميل نقدي
      </span>
      {phone && (
        <span className="font-bold text-text-primary">
          {invoice.walk_in_name ? `${invoice.walk_in_name} — ` : ""}
          <span className="font-mono text-text-secondary" dir="ltr">{phone}</span>
        </span>
      )}
    </span>
  );
}
