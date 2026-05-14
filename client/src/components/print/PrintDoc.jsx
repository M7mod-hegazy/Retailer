import React from "react";
import { BlockRenderer, getCustomBlocks } from "../../pages/settings/CustomTextBlocks";

const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV",
  receipt_header: "", receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 11, footer_font_size: 10,
  item_font_size: 11, print_font: "monospace", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  margin_top: 4, margin_side: 4, qr_size: 44,
  show_cashier_name: true, show_customer_name: true, show_tax: true,
  show_footer: true, show_qr: false, show_logo: true,
  show_discount_line: true, show_payment_details: true, show_subtotal: true,
  show_phone: true, show_address: true, show_tax_id: true,
  show_branch: true, show_invoice_date: true,
  tax_rate: 15, currency_symbol: "ر.س", show_item_code: true,
};

const g = (s, k) => (s[k] !== undefined && s[k] !== null) ? s[k] : DEFAULTS[k];

const noop = () => {};

/**
 * Real-print thermal receipt (58mm / 80mm).
 * Respects all settings toggles, custom text blocks, fonts, colors.
 */
export function PrintThermalDoc({ invoice = {}, settings: s = {} }) {
  const lines    = invoice.lines    || [];
  const payments = invoice.payments || [];
  const currency = g(s, "currency_symbol");
  const taxRate  = parseFloat(g(s, "tax_rate") || 0);
  const accent   = g(s, "accent_color");
  const dashed   = `1px dashed ${accent}66`;
  const solid    = `1px solid ${accent}`;
  const w        = (s.receipt_width || g(s, "receipt_width")) === "58mm" ? "58mm" : "80mm";
  const customBlocks = getCustomBlocks(s);
  const extraAddresses = (() => { try { return JSON.parse(s.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(s.additional_phones || '[]'); } catch { return []; } })();
  const addressAtBottom = s.address_position === 'bottom';

  const subtotal      = lines.reduce((sum, l) => sum + ((Number(l.unit_price) || Number(l.unit_cost) || 0) * Number(l.quantity)), 0);
  const totalDiscount = lines.reduce((sum, l) => sum + (Number(l.discount_amount) || 0), 0);
  const taxAmount     = g(s, "show_tax") !== false ? (subtotal - totalDiscount) * (taxRate / 100) : 0;
  const grandTotal    = subtotal - totalDiscount + taxAmount;
  const paid          = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const change        = paid - grandTotal;

  return (
    <div dir="rtl" style={{
      fontFamily: g(s, "print_font"),
      fontSize: `${g(s, "body_font_size")}px`,
      width: w, margin: "0 auto",
      padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      color: accent, background: "#fff",
    }}>
      {/* Header */}
      <div style={{ textAlign: g(s, "logo_alignment"), marginBottom: "8px" }}>
        {g(s, "show_logo") !== false && s.logo_url &&
          <img src={s.logo_url} alt="" style={{ maxHeight: `${g(s, "logo_max_height")}px`, objectFit: "contain", margin: "0 auto 4px" }} />}
        <div style={{ fontSize: `${g(s, "header_font_size")}px`, fontWeight: "900" }}>{s.company_name || ""}</div>
        {g(s, "show_branch")  !== false && s.branch_name  && <div>{s.branch_name}</div>}
        {g(s, "show_address") !== false && s.address       && <div style={{ fontSize: "9px", opacity: 0.6 }}>{s.address}</div>}
        {g(s, "show_address") !== false && extraAddresses.filter(Boolean).map((a, i) => <div key={`addr-${i}`} style={{ fontSize: "9px", opacity: 0.6 }}>{a}</div>)}
        {g(s, "show_phone")   !== false && s.phone         && <div style={{ fontSize: "9px" }}>هاتف: {s.phone}</div>}
        {g(s, "show_phone")   !== false && extraPhones.filter(Boolean).map((p, i) => <div key={`ph-${i}`} style={{ fontSize: "9px" }}>هاتف: {p}</div>)}
        {g(s, "show_tax_id")  !== false && s.tax_id        && <div style={{ fontSize: "9px" }}>الرقم الضريبي: {s.tax_id}</div>}
      </div>

      {g(s, "receipt_header") && (
        <div style={{ textAlign: "center", fontSize: "10px", marginBottom: "4px", fontStyle: "italic" }}>{g(s, "receipt_header")}</div>
      )}
      <BlockRenderer blocks={customBlocks} position="after_header" paperSize={w} accentColor={accent} hovered={null} onElementClick={noop} />

      <div style={{ borderTop: dashed, margin: "5px 0" }} />

      {/* Meta */}
      <div style={{ fontSize: `${g(s, "item_font_size")}px`, marginBottom: "5px" }}>
        <BlockRenderer blocks={customBlocks} position="before_meta" paperSize={w} accentColor={accent} hovered={null} onElementClick={noop} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>رقم الفاتورة:</span>
          <span style={{ fontWeight: "bold" }}>{invoice.invoice_no || invoice.invoice_number || ""}</span>
        </div>
        {g(s, "show_invoice_date") !== false && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>التاريخ:</span>
            <span>{invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("ar-SA") : new Date().toLocaleDateString("ar-SA")}</span>
          </div>
        )}
        {g(s, "show_customer_name") !== false && invoice.customer_name && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>العميل:</span><span>{invoice.customer_name}</span>
          </div>
        )}
        {g(s, "show_cashier_name") !== false && (invoice.cashier_name || invoice.cashier) && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الكاشير:</span><span>{invoice.cashier_name || invoice.cashier}</span>
          </div>
        )}
      </div>
      <BlockRenderer blocks={customBlocks} position="after_meta" paperSize={w} accentColor={accent} hovered={null} onElementClick={noop} />

      <div style={{ borderTop: dashed, margin: "5px 0" }} />
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={w} accentColor={accent} hovered={null} onElementClick={noop} />

      {/* Items */}
      <table style={{ width: "100%", fontSize: `${g(s, "item_font_size")}px`, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: solid }}>
            {g(s, "show_item_code") !== false && <th style={{ textAlign: "right", paddingBottom: "3px", opacity: 0.6, fontSize: "9px" }}>كود</th>}
            <th style={{ textAlign: "right", paddingBottom: "3px" }}>الصنف</th>
            <th style={{ textAlign: "center" }}>كمية</th>
            <th style={{ textAlign: "left" }}>إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const lineTotal = ((Number(line.unit_price) || Number(line.unit_cost) || 0) * Number(line.quantity)) - (Number(line.discount_amount) || 0);
            return (
              <tr key={i}>
                {g(s, "show_item_code") !== false && (
                  <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px", opacity: 0.6, fontFamily: "monospace" }}>
                    {line.sku || line.barcode || line.product_code || ""}
                  </td>
                )}
                <td style={{ textAlign: "right", padding: "2px 0" }}>{line.product_name || line.item_name || line.name || ""}</td>
                <td style={{ textAlign: "center" }}>{line.quantity}</td>
                <td style={{ textAlign: "left" }}>{lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderTop: dashed, margin: "5px 0" }} />

      {/* Totals */}
      <div style={{ fontSize: `${g(s, "item_font_size")}px` }}>
        {g(s, "show_subtotal") !== false && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الإجمالي:</span><span>{currency} {subtotal.toFixed(2)}</span>
          </div>
        )}
        {g(s, "show_discount_line") !== false && totalDiscount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الخصم:</span><span>- {currency} {totalDiscount.toFixed(2)}</span>
          </div>
        )}
        {g(s, "show_tax") !== false && taxAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ضريبة ({taxRate}%):</span><span>{currency} {taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", marginTop: "4px", paddingTop: "3px", borderTop: solid }}>
          <span>المستحق:</span><span>{currency} {grandTotal.toFixed(2)}</span>
        </div>
        <BlockRenderer blocks={customBlocks} position="after_totals" paperSize={w} accentColor={accent} hovered={null} onElementClick={noop} />
      </div>

      {/* Payment details */}
      {g(s, "show_payment_details") !== false && payments.length > 0 && (
        <>
          <div style={{ borderTop: dashed, margin: "5px 0" }} />
          <div style={{ fontSize: `${g(s, "item_font_size")}px` }}>
            {payments.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{p.method_name || "نقداً"}:</span>
                <span>{currency} {Number(p.amount).toFixed(2)}</span>
              </div>
            ))}
            {paid > grandTotal && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>الباقي:</span><span>{currency} {change.toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      {g(s, "show_footer") !== false && (
        <>
          <div style={{ borderTop: dashed, margin: "6px 0" }} />
          <BlockRenderer blocks={customBlocks} position="before_footer" paperSize={w} accentColor={accent} hovered={null} onElementClick={noop} />
          <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, fontStyle: "italic" }}>
            {g(s, "receipt_footer")}
          </div>
        </>
      )}

      {g(s, "show_qr") !== false && (
        <div style={{ margin: "8px auto 0", width: `${g(s, "qr_size")}px`, height: `${g(s, "qr_size")}px`, background: "#f0f0f0", border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#888" }}>QR</div>
      )}
    </div>
  );
}

/**
 * Real-print A4/A5 document.
 * Respects all settings toggles, custom text blocks, fonts, colors.
 */
export function PrintA4Doc({ invoice = {}, settings: s = {}, size = "A4" }) {
  const lines    = invoice.lines    || [];
  const payments = invoice.payments || [];
  const currency = g(s, "currency_symbol");
  const taxRate  = parseFloat(g(s, "tax_rate") || 0);
  const accent   = g(s, "accent_color");
  const w        = size === "A5" ? "148mm" : "210mm";
  const customBlocks = getCustomBlocks(s);
  const showCode = g(s, "show_item_code") !== false;

  const subtotal      = lines.reduce((sum, l) => sum + ((Number(l.unit_price) || Number(l.unit_cost) || 0) * Number(l.quantity)), 0);
  const totalDiscount = lines.reduce((sum, l) => sum + (Number(l.discount_amount) || 0), 0);
  const taxAmount     = g(s, "show_tax") !== false ? (subtotal - totalDiscount) * (taxRate / 100) : 0;
  const grandTotal    = subtotal - totalDiscount + taxAmount;
  const paid          = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div dir="rtl" style={{
      width: w,
      padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      fontFamily: g(s, "print_font"),
      fontSize: `${g(s, "body_font_size")}px`,
      color: "#1e293b", background: "#fff",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px" }}>
        <div>
          {g(s, "show_logo") !== false && s.logo_url &&
            <img src={s.logo_url} alt="" style={{ maxHeight: `${g(s, "logo_max_height")}px`, objectFit: "contain", marginBottom: "4px" }} />}
          <div style={{ fontSize: `${g(s, "header_font_size")}px`, fontWeight: "900", color: accent }}>{s.company_name || ""}</div>
          {g(s, "show_branch")  !== false && s.branch_name && <div style={{ fontSize: "11px", color: "#64748b" }}>{s.branch_name}</div>}
        {g(s, "show_address") !== false && s.address      && <div style={{ fontSize: "9px", color: "#94a3b8" }}>{s.address}</div>}
        {g(s, "show_address") !== false && extraAddresses.filter(Boolean).map((a, i) => <div key={`addr-${i}`} style={{ fontSize: "9px", color: "#94a3b8" }}>{a}</div>)}
        {g(s, "show_phone")   !== false && s.phone        && <div style={{ fontSize: "9px", color: "#94a3b8" }}>هاتف: {s.phone}</div>}
        {g(s, "show_phone")   !== false && extraPhones.filter(Boolean).map((p, i) => <div key={`ph-${i}`} style={{ fontSize: "9px", color: "#94a3b8" }}>هاتف: {p}</div>)}
        {g(s, "show_tax_id")  !== false && s.tax_id       && <div style={{ fontSize: "9px", color: "#94a3b8" }}>الرقم الضريبي: {s.tax_id}</div>}
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "18px", fontWeight: "900", color: accent }}>{g(s, "receipt_footer") || "فاتورة"}</div>
          <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>{invoice.invoice_no || invoice.invoice_number || ""}</div>
          {g(s, "show_invoice_date") !== false && (
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("ar-SA") : ""}
            </div>
          )}
        </div>
      </div>

      {g(s, "receipt_header") && (
        <div style={{ textAlign: "center", fontSize: "10px", marginBottom: "8px", fontStyle: "italic", color: "#64748b" }}>{g(s, "receipt_header")}</div>
      )}
      <BlockRenderer blocks={customBlocks} position="after_header" paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />

      {/* Customer / cashier meta */}
      {(g(s, "show_customer_name") !== false && invoice.customer_name) || (g(s, "show_cashier_name") !== false && (invoice.cashier_name || invoice.cashier)) ? (
        <div style={{ display: "flex", gap: "24px", marginBottom: "10px", fontSize: "11px", background: "#f8fafc", padding: "8px 10px", borderRadius: "4px" }}>
          {g(s, "show_customer_name") !== false && invoice.customer_name && (
            <div><span style={{ color: "#64748b" }}>العميل: </span><strong>{invoice.customer_name}</strong></div>
          )}
          {g(s, "show_cashier_name") !== false && (invoice.cashier_name || invoice.cashier) && (
            <div><span style={{ color: "#64748b" }}>الكاشير: </span><strong>{invoice.cashier_name || invoice.cashier}</strong></div>
          )}
        </div>
      ) : null}

      <BlockRenderer blocks={customBlocks} position="before_meta"  paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />
      <BlockRenderer blocks={customBlocks} position="after_meta"   paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${g(s, "item_font_size")}px`, marginBottom: "8px" }}>
        <thead>
          <tr style={{ background: accent, color: "#fff" }}>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>#</th>
            {showCode && <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "9px", opacity: 0.85 }}>كود</th>}
            <th style={{ textAlign: "right", padding: "4px 6px" }}>المنتج</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>كمية</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>سعر</th>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const lineTotal = ((Number(line.unit_price) || Number(line.unit_cost) || 0) * Number(line.quantity)) - (Number(line.discount_amount) || 0);
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: "3px 6px", color: "#94a3b8" }}>{i + 1}</td>
                {showCode && (
                  <td style={{ textAlign: "center", padding: "3px 6px", fontSize: "9px", color: "#94a3b8", fontFamily: "monospace" }}>
                    {line.sku || line.barcode || line.product_code || ""}
                  </td>
                )}
                <td style={{ padding: "3px 6px", fontWeight: "600" }}>{line.product_name || line.item_name || line.name || ""}</td>
                <td style={{ textAlign: "center", padding: "3px 6px" }}>{line.quantity}</td>
                <td style={{ textAlign: "center", padding: "3px 6px" }}>{(Number(line.unit_price) || Number(line.unit_cost) || 0).toFixed(2)}</td>
                <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: "700" }}>{lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <BlockRenderer blocks={customBlocks} position="after_items"   paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />
      <BlockRenderer blocks={customBlocks} position="before_totals" paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "45%", fontSize: `${g(s, "item_font_size")}px` }}>
          {g(s, "show_subtotal") !== false && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#64748b" }}>الإجمالي الفرعي</span>
              <span style={{ fontWeight: "700" }}>{currency} {subtotal.toFixed(2)}</span>
            </div>
          )}
          {g(s, "show_discount_line") !== false && totalDiscount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#64748b" }}>الخصم</span>
              <span style={{ fontWeight: "700", color: "#dc2626" }}>- {currency} {totalDiscount.toFixed(2)}</span>
            </div>
          )}
          {g(s, "show_tax") !== false && taxAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#64748b" }}>الضريبة ({taxRate}%)</span>
              <span style={{ fontWeight: "700" }}>{currency} {taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px", background: accent, color: "#fff", borderRadius: "2px", marginTop: "3px" }}>
            <span style={{ fontWeight: "900" }}>الإجمالي</span>
            <span style={{ fontWeight: "900" }}>{currency} {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <BlockRenderer blocks={customBlocks} position="after_totals" paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />

      {/* Payment details */}
      {g(s, "show_payment_details") !== false && payments.length > 0 && (
        <div style={{ marginTop: "8px", fontSize: `${g(s, "item_font_size")}px` }}>
          <div style={{ fontWeight: "700", marginBottom: "3px", color: accent }}>طريقة الدفع</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {payments.map((p, i) => (
              <span key={i}>{p.method_name || "نقداً"}: {currency} {Number(p.amount).toFixed(2)}</span>
            ))}
            {paid < grandTotal && (
              <span style={{ color: "#dc2626" }}>المتبقي: {currency} {(grandTotal - paid).toFixed(2)}</span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {g(s, "show_footer") !== false && (
        <>
          <div style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44` }} />
          <BlockRenderer blocks={customBlocks} position="before_footer" paperSize={size} accentColor={accent} hovered={null} onElementClick={noop} />
          <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, color: "#94a3b8", fontStyle: "italic" }}>
            {g(s, "receipt_footer")}
          </div>
        </>
      )}

      {g(s, "show_qr") !== false && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
          <div style={{ width: `${g(s, "qr_size")}px`, height: `${g(s, "qr_size")}px`, background: "#f0f0f0", border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#888" }}>QR</div>
        </div>
      )}
    </div>
  );
}
