import React from "react";

/**
 * 80mm Thermal Receipt Print Component
 * Use with react-to-print: const componentRef = useRef(); <Receipt80mm ref={componentRef} invoice={invoice} settings={settings} />
 */
const Receipt80mm = React.forwardRef(function Receipt80mm({ invoice, settings = {} }, ref) {
  if (!invoice) return null;

  const lines = invoice.lines || [];
  const payments = invoice.payments || [];
  const currency = settings.currency_symbol || "ر.س";
  const taxRate = settings.tax_rate || 0;
  const taxType = settings.tax_type || "none";

  const subtotal = lines.reduce((s, l) => s + (l.unit_price * l.quantity), 0);
  const totalDiscount = lines.reduce((s, l) => s + (l.discount_amount || 0), 0);
  const taxAmount = taxType === "none" ? 0 : (subtotal - totalDiscount) * (taxRate / 100);
  const grandTotal = subtotal - totalDiscount + taxAmount;

  const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const change = paid - grandTotal;
  const remaining = grandTotal - paid;

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        fontFamily: "'Courier New', monospace",
        fontSize: "12px",
        width: "80mm",
        margin: "0 auto",
        padding: "4mm",
        color: "#000",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        {settings.logo_url && settings.logo_on_receipts !== false && settings.logo_on_receipts !== 0 ? (
          <img
            src={settings.logo_url}
            alt={settings.company_name || "Logo"}
            style={{ maxHeight: "48px", maxWidth: "100%", objectFit: "contain", margin: "0 auto 6px" }}
          />
        ) : null}
        {settings.company_name && (
          <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "2px" }}>{settings.company_name}</div>
        )}
        {settings.branch_name && <div>{settings.branch_name}</div>}
        {settings.address && <div style={{ fontSize: "10px" }}>{settings.address}</div>}
        {settings.phone && <div style={{ fontSize: "10px" }}>هاتف: {settings.phone}</div>}
        {settings.tax_id && <div style={{ fontSize: "10px" }}>الرقم الضريبي: {settings.tax_id}</div>}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Invoice Info */}
      <div style={{ fontSize: "11px", marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>رقم الفاتورة:</span>
          <span>{invoice.invoice_no || invoice.invoice_number}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>التاريخ:</span>
          <span>{new Date(invoice.created_at).toLocaleString("ar")}</span>
        </div>
        {invoice.customer_name && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>العميل:</span>
            <span>{invoice.customer_name}</span>
          </div>
        )}
        {invoice.cashier_name && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الكاشير:</span>
            <span>{invoice.cashier_name}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Items */}
      <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>الصنف</th>
            <th style={{ textAlign: "center" }}>الكمية</th>
            <th style={{ textAlign: "center" }}>السعر</th>
            <th style={{ textAlign: "left" }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td style={{ textAlign: "right", paddingTop: "3px" }}>
                {settings.show_item_code && line.item_code ? `${line.item_code} - ` : ""}
                {line.item_name}
              </td>
              <td style={{ textAlign: "center" }}>{line.quantity}</td>
              <td style={{ textAlign: "center" }}>{Number(line.unit_price).toFixed(2)}</td>
              <td style={{ textAlign: "left" }}>{Number(line.unit_price * line.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Totals */}
      <div style={{ fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الإجمالي قبل الخصم:</span>
          <span>{currency} {subtotal.toFixed(2)}</span>
        </div>
        {totalDiscount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الخصم:</span>
            <span>- {currency} {totalDiscount.toFixed(2)}</span>
          </div>
        )}
        {taxType !== "none" && taxAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الضريبة ({taxRate}%):</span>
            <span>{currency} {taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>
          <span>الإجمالي المستحق:</span>
          <span>{currency} {grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Payments */}
      <div style={{ fontSize: "11px" }}>
        <div style={{ fontWeight: "bold", marginBottom: "2px" }}>وسائل الدفع:</div>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{p.method_name || p.method || "دفع"}:</span>
            <span>{currency} {Number(p.amount).toFixed(2)}</span>
          </div>
        ))}
        {change > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الباقي (مرتجع):</span>
            <span>{currency} {change.toFixed(2)}</span>
          </div>
        )}
        {remaining > 0.01 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
            <span>المتبقي:</span>
            <span>{currency} {remaining.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
        {settings.receipt_footer || "شكراً لزيارتكم — ارجو العودة مرة أخرى"}
      </div>
    </div>
  );
});

export default Receipt80mm;
