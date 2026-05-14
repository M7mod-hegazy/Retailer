import React from "react";

const Receipt58mm = React.forwardRef(function Receipt58mm({ invoice, settings = {} }, ref) {
  if (!invoice) return null;

  const lines = invoice.lines || [];
  const payments = invoice.payments || [];
  const currency = settings.currency_symbol || "ر.س";
  const subtotal = lines.reduce((sum, line) => sum + Number(line.unit_price || 0) * Number(line.quantity || 0), 0);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const change = paid - subtotal;
  const remaining = subtotal - paid;
  const extraAddresses = (() => { try { return JSON.parse(settings.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(settings.additional_phones || '[]'); } catch { return []; } })();
  const addressAtBottom = settings.address_position === 'bottom';

  const AddressBlock = () => (
    <>
      {settings.address && <div>{settings.address}</div>}
      {extraAddresses.filter(Boolean).map((a, i) => <div key={`addr-${i}`}>{a}</div>)}
      {settings.phone && <div>هاتف: {settings.phone}</div>}
      {extraPhones.filter(Boolean).map((p, i) => <div key={`ph-${i}`}>هاتف: {p}</div>)}
      {settings.tax_id && <div>الرقم الضريبي: {settings.tax_id}</div>}
    </>
  );

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        fontFamily: "'Noto Sans Arabic', 'Courier New', monospace",
        fontSize: "11px",
        width: "58mm",
        margin: "0 auto",
        padding: "3mm",
        color: "#111",
        background: "#fff",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        {settings.logo_url && settings.logo_on_receipts !== false && settings.logo_on_receipts !== 0 ? (
          <img
            src={settings.logo_url}
            alt={settings.company_name || "Logo"}
            style={{ maxHeight: "36px", maxWidth: "100%", objectFit: "contain", margin: "0 auto 4px" }}
          />
        ) : null}
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{settings.company_name || "ElHegazi Retailer"}</div>
        <div style={{ fontSize: "10px" }}>{invoice.invoice_no || invoice.invoice_number || "INV-0001"}</div>
        {!addressAtBottom && <AddressBlock />}
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      {lines.map((line, index) => (
        <div key={`${line.item_name}-${index}`} style={{ marginBottom: "4px" }}>
          <div>
            {settings.show_item_code && line.item_code ? `${line.item_code} - ` : ""}
            {line.item_name}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>{line.quantity} × {Number(line.unit_price || 0).toFixed(2)}</span>
            <span>{(Number(line.quantity || 0) * Number(line.unit_price || 0)).toFixed(2)}</span>
          </div>
        </div>
      ))}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
        <span>الإجمالي</span>
        <span>{currency} {subtotal.toFixed(2)}</span>
      </div>
      {payments.length > 0 && (
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0", paddingTop: "4px" }}>
          <div style={{ fontWeight: "bold" }}>وسائل الدفع:</div>
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
              <span>{p.method_name || p.method || "دفع"}</span>
              <span>{currency} {Number(p.amount || 0).toFixed(2)}</span>
            </div>
          ))}
          {change > 0.01 && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}><span>الباقي للعميل</span><span>{currency} {change.toFixed(2)}</span></div>}
          {remaining > 0.01 && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}><span>المتبقي</span><span>{currency} {remaining.toFixed(2)}</span></div>}
        </div>
      )}
      <div style={{ marginTop: "8px", textAlign: "center", fontSize: "9px" }}>
        {settings.receipt_footer || "شكراً لزيارتكم"}
      </div>

      {addressAtBottom && (
        <div style={{ marginTop: "6px", borderTop: "1px dashed #000", paddingTop: "6px", fontSize: "10px", textAlign: "center" }}>
          <AddressBlock />
        </div>
      )}
    </div>
  );
});

export default Receipt58mm;
