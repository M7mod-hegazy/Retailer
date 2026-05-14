import React from "react";

/**
 * A4 Formal Invoice Print Template
 */
const InvoiceA4 = React.forwardRef(function InvoiceA4({ invoice, settings = {} }, ref) {
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
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const change = paid - grandTotal;
  const remaining = grandTotal - paid;
  const extraAddresses = (() => { try { return JSON.parse(settings.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(settings.additional_phones || '[]'); } catch { return []; } })();

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{ fontFamily: "Arial, sans-serif", padding: "20mm", color: "#111", background: "#fff", minHeight: "297mm", width: "210mm", margin: "0 auto" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1e40af", paddingBottom: "12px", marginBottom: "16px" }}>
        <div>
          {settings.logo_url && settings.logo_on_invoices !== false && settings.logo_on_invoices !== 0 ? (
            <img
              src={settings.logo_url}
              alt={settings.company_name || "Logo"}
              style={{ maxHeight: "72px", maxWidth: "180px", objectFit: "contain", marginBottom: "10px" }}
            />
          ) : null}
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1e40af", margin: 0 }}>{settings.company_name}</h1>
          {settings.company_name_en && <p style={{ margin: "2px 0", color: "#666" }}>{settings.company_name_en}</p>}
          {(() => {
            const addrs = [settings.address, ...extraAddresses];
            const phones = [settings.phone, ...extraPhones];
            return addrs.map((addr, i) => {
              const phone = phones[i];
              if (!addr && !phone && i > 0) return null;
              if (!addr && !phone) return null;
              return (
                <div key={i} style={{ display: "flex", gap: "8px", ...(i > 0 ? { marginTop: "4px", borderTop: "1px solid #e2e8f0", paddingTop: "4px" } : {}) }}>
                  {addr && <span style={{ fontSize: "12px" }}>{addr}</span>}
                  {phone && <span style={{ fontSize: "12px" }}>{phone}</span>}
                </div>
              );
            });
          })()}
          {settings.tax_id && <p style={{ margin: "2px 0", fontSize: "12px" }}>الرقم الضريبي: {settings.tax_id}</p>}
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px" }}>{settings.receipt_footer || "فاتورة"}</h2>
          <p style={{ margin: "2px 0", fontSize: "13px" }}><strong>رقم المستند:</strong> {invoice.invoice_no || invoice.invoice_number}</p>
          <p style={{ margin: "2px 0", fontSize: "13px" }}><strong>التاريخ:</strong> {new Date(invoice.created_at).toLocaleDateString("ar")}</p>
        </div>
      </div>

      {/* Customer Info */}
      {invoice.customer_name && (
        <div style={{ marginBottom: "16px", padding: "10px", background: "#f8fafc", borderRadius: "6px" }}>
          <strong>العميل:</strong> {invoice.customer_name}
        </div>
      )}

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "13px" }}>
        <thead>
          <tr style={{ backgroundColor: "#1e40af", color: "#fff" }}>
            <th style={{ padding: "8px", textAlign: "right" }}>#</th>
            <th style={{ padding: "8px", textAlign: "right" }}>الصنف</th>
            <th style={{ padding: "8px", textAlign: "center" }}>الكمية</th>
            <th style={{ padding: "8px", textAlign: "center" }}>سعر الوحدة</th>
            <th style={{ padding: "8px", textAlign: "center" }}>الخصم</th>
            <th style={{ padding: "8px", textAlign: "left" }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ padding: "8px" }}>{i + 1}</td>
              <td style={{ padding: "8px" }}>
                {settings.show_item_code && line.item_code ? `${line.item_code} - ` : ""}
                {line.item_name}
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>{line.quantity}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>{Number(line.unit_price).toFixed(2)} {currency}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>{Number(line.discount_amount || 0).toFixed(2)} {currency}</td>
              <td style={{ padding: "8px", textAlign: "left" }}>{Number(line.unit_price * line.quantity - (line.discount_amount || 0)).toFixed(2)} {currency}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
        <table style={{ fontSize: "13px", minWidth: "280px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 12px" }}>الإجمالي قبل الخصم:</td>
              <td style={{ textAlign: "left", fontWeight: "600" }}>{subtotal.toFixed(2)} {currency}</td>
            </tr>
            {totalDiscount > 0 && (
              <tr>
                <td style={{ padding: "4px 12px" }}>إجمالي الخصم:</td>
                <td style={{ textAlign: "left", color: "red" }}>- {totalDiscount.toFixed(2)} {currency}</td>
              </tr>
            )}
            {taxType !== "none" && (
              <tr>
                <td style={{ padding: "4px 12px" }}>الضريبة ({taxRate}%):</td>
                <td style={{ textAlign: "left" }}>{taxAmount.toFixed(2)} {currency}</td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #1e40af" }}>
              <td style={{ padding: "6px 12px", fontWeight: "bold", fontSize: "15px" }}>الإجمالي المستحق:</td>
              <td style={{ textAlign: "left", fontWeight: "bold", fontSize: "15px", color: "#1e40af" }}>{grandTotal.toFixed(2)} {currency}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {payments.length > 0 && (
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "flex-end" }}>
          <table style={{ fontSize: "13px", minWidth: "280px", borderCollapse: "collapse" }}>
            <tbody>
              <tr><td colSpan={2} style={{ padding: "6px 12px", fontWeight: "bold", borderBottom: "1px solid #e2e8f0" }}>وسائل الدفع</td></tr>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: "4px 12px" }}>{p.method_name || p.method || "دفع"}</td>
                  <td style={{ padding: "4px 12px", textAlign: "left", fontWeight: 600 }}>{Number(p.amount || 0).toFixed(2)} {currency}</td>
                </tr>
              ))}
              {change > 0.01 && <tr><td style={{ padding: "4px 12px", fontWeight: "bold", color: "#16a34a" }}>الباقي للعميل</td><td style={{ padding: "4px 12px", textAlign: "left", fontWeight: "bold", color: "#16a34a" }}>{change.toFixed(2)} {currency}</td></tr>}
              {remaining > 0.01 && <tr><td style={{ padding: "4px 12px", fontWeight: "bold", color: "#dc2626" }}>المتبقي</td><td style={{ padding: "4px 12px", textAlign: "left", fontWeight: "bold", color: "#dc2626" }}>{remaining.toFixed(2)} {currency}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", textAlign: "center", fontSize: "11px", color: "#666" }}>
        {settings.receipt_footer || "شكراً لتعاملكم معنا"}
      </div>
    </div>
  );
});

export default InvoiceA4;
