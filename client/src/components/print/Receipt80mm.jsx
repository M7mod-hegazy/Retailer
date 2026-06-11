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

  const subtotal = lines.reduce((s, l) => s + (l.unit_price * l.quantity), 0);
  const totalDiscount = lines.reduce((s, l) => s + (l.discount_amount || 0), 0);
  // Snapshot fields are authoritative: tax_amount 0 means no tax was charged (no phantom
  // tax line). Settings-based derivation only for ad-hoc objects with no stored total.
  const hasTaxSnapshot = invoice.tax_amount !== undefined || invoice.tax_enabled !== undefined;
  const hasStoredTotal = invoice.total !== undefined && invoice.total !== null;
  const taxAmount = hasTaxSnapshot ? (Number(invoice.tax_amount) || 0)
    : hasStoredTotal ? 0
    : (() => { const tr = settings.tax_rate || 0; const tt = settings.tax_type || "none"; return tt === "none" ? 0 : (subtotal - totalDiscount) * (tr / 100); })();
  const taxRate = hasTaxSnapshot ? (Number(invoice.tax_rate) || 0) : hasStoredTotal ? 0 : (settings.tax_rate || 0);
  const grandTotal = hasStoredTotal ? Number(invoice.total) : subtotal - totalDiscount + taxAmount;

  const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const change = paid - grandTotal;
  const remaining = grandTotal - paid;
  const extraAddresses = (() => { try { return JSON.parse(settings.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(settings.additional_phones || '[]'); } catch { return []; } })();
  const addressAtBottom = settings.address_position === 'bottom';

  const AddressBlock = () => {
    const addrs = [settings.address, ...extraAddresses];
    const phones = [settings.phone, ...extraPhones];
    return (
      <>
        {addrs.map((addr, i) => {
          const phone = phones[i];
          if (!addr && !phone && i > 0) return null;
          if (!addr && !phone) return null;
          return (
            <div key={i} style={{ display: "flex", gap: "8px", justifyContent: { right: "flex-start", center: "center", left: "flex-end" }[settings.address_alignment] || "flex-start", ...(i > 0 ? { marginTop: "4px", borderTop: "1px dotted #ccc", paddingTop: "4px" } : {}) }}>
              {addr && <span style={{ fontSize: `${settings.address_font_size || 9}px` }}>{addr}</span>}
              {phone && <span style={{ fontSize: `${settings.address_font_size || 9}px` }}>{phone}</span>}
            </div>
          );
        })}
        {settings.tax_id && <div style={{ fontSize: `${settings.tax_id_font_size || 9}px`, marginTop: "4px", textAlign: settings.tax_id_alignment || "right" }}>الرقم الضريبي: {settings.tax_id}</div>}
      </>
    );
  };

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
        {!addressAtBottom && <AddressBlock />}
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
          <span>{new Date(invoice.created_at).toLocaleString("ar-u-nu-latn")}</span>
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
        {taxAmount > 0 && (
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

      {invoice.notes && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ fontSize: "10px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "2px" }}>ملاحظات:</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
          </div>
        </>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
        {settings.receipt_footer || "شكراً لزيارتكم — ارجو العودة مرة أخرى"}
      </div>

      {addressAtBottom && (
        <div style={{ textAlign: "center", marginTop: "8px", borderTop: "1px dashed #000", paddingTop: "6px", fontSize: "10px" }}>
          <AddressBlock />
        </div>
      )}
    </div>
  );
});

export default Receipt80mm;
