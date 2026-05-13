import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { usePosStore } from "../../stores/posStore";
import { queueOfflineInvoice } from "../../services/offlineSync";
import { Printer, Save, Trash2, Clock, PauseCircle, PlayCircle } from "lucide-react";
import CurrencyDisplay from "../ui/CurrencyDisplay";
import MultiPaymentInput from "../payment/MultiPaymentInput";
import PrintPreviewModal from "../print/PrintPreviewModal";

const paymentLabels = {
  cash: "نقدي",
  credit: "آجل",
  bank_transfer: "فيزا/بنك",
  multi: "متعدد",
};

export default function PaymentPanel({ onHold, heldCount, onResume, heldInvoices }) {
  const lines = usePosStore((state) => state.lines);
  const customer = usePosStore((state) => state.customer);
  const discount = usePosStore((state) => state.discount);
  const promotionDiscount = usePosStore((state) => state.promotionDiscount);
  const appliedPromotions = usePosStore((state) => state.appliedPromotions);
  const setDiscount = usePosStore((state) => state.setDiscount);
  const paymentType = usePosStore((state) => state.paymentType);
  const setPaymentType = usePosStore((state) => state.setPaymentType);
  const getTotals = usePosStore((state) => state.getTotals);
  const clear = usePosStore((state) => state.clear);
  const [message, setMessage] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [banks, setBanks] = useState([]);
  const [paymentDetails, setPaymentDetails] = useState({
    treasury_id: "", bank_id: "", split_cash_amount: "", split_bank_amount: "",
  });
  const [payments, setPayments] = useState([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState(null);

  const totals = getTotals();
  const isEmpty = lines.length === 0;

  useEffect(() => {
    api.get("/api/treasuries").then((response) => setTreasuries(response.data.data || [])).catch(() => setTreasuries([]));
    api.get("/api/banks").then((response) => setBanks(response.data.data || [])).catch(() => setBanks([]));
  }, []);

  async function saveInvoice(printAfter = false) {
    const payload = {
      customer_id: customer?.id || null, lines, discount, promotion_discount: promotionDiscount,
      payment_type: paymentType,
      treasury_id: paymentDetails.treasury_id ? Number(paymentDetails.treasury_id) : null,
      bank_id: paymentDetails.bank_id ? Number(paymentDetails.bank_id) : null,
      split_cash_amount: Number(paymentDetails.split_cash_amount || 0),
      split_bank_amount: Number(paymentDetails.split_bank_amount || 0),
      payments: paymentType === "multi" ? payments.map((p) => ({ method_id: p.method_id, method_name: p.method_name, amount: Number(p.amount || 0) })) : [],
    };

    try {
      const response = await api.post("/api/invoices", payload);
      setMessage(`تم حفظ الفاتورة بنجاح`);
      setTimeout(() => setMessage(""), 3000);
      if (printAfter) {
        setPrintInvoice({
          ...(response.data.data || {}),
          lines,
          total: totals.total,
          payments: paymentType === "multi" ? payments : [{ method: paymentLabels[paymentType], amount: totals.total }],
        });
        setPrintOpen(true);
      }
      clear();
      setPaymentDetails({ treasury_id: "", bank_id: "", split_cash_amount: "", split_bank_amount: "" });
      setPayments([]);
    } catch (error) {
      if (!error.response || error.code === "ERR_NETWORK") {
        await queueOfflineInvoice(payload);
        clear();
        setPaymentDetails({ treasury_id: "", bank_id: "", split_cash_amount: "", split_bank_amount: "" });
        setPayments([]);
      } else {
        setMessage(error.response?.data?.message || "فشل حفظ الفاتورة");
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 16px 16px', background: 'var(--bg-surface)' }}>
      
      {/* Subtotals & Discounts */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>المجموع الفرعي</span>
        <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, monospace' }}>{totals.subtotal}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>خصم / عروض</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Number(promotionDiscount) > 0 && <span style={{ fontSize: '12px', color: 'var(--danger-text)' }}>-{promotionDiscount}</span>}
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="خصم مضاف"
            style={{
              width: '70px', padding: '4px 6px',
              border: '1px solid var(--border-normal)', borderRadius: '6px',
              textAlign: 'center', fontSize: '12px', fontFamily: 'Inter, monospace',
              color: 'var(--text-primary)', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Grand Total */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: '12px', borderTop: '2px dashed var(--border-subtle)', marginBottom: '16px'
      }}>
        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>الإجمالي</span>
        <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'Inter, sans-serif' }}>
          <CurrencyDisplay value={totals.total} />
        </span>
      </div>

      {/* Payment Types (Condensed) */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {Object.entries(paymentLabels).map(([type, label]) => (
          <button
            key={type} onClick={() => setPaymentType(type)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              background: paymentType === type ? 'var(--primary-50)' : 'var(--bg-input)',
              color: paymentType === type ? 'var(--primary)' : 'var(--text-secondary)',
              border: `1px solid ${paymentType === type ? 'var(--primary)' : 'var(--border-normal)'}`,
              cursor: 'pointer', transition: 'all 150ms ease'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Multi / Bank Extra fields (Collapsible) */}
      {(paymentType === 'multi' || paymentType === 'bank_transfer' || paymentType === 'cash') && (
        <div style={{ marginBottom: '16px', background: 'var(--bg-overlay)', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
          {paymentType === "multi" ? (
            <MultiPaymentInput totalAmount={totals.total} value={payments} onChange={setPayments} />
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>تفاصيل الدفع: {paymentLabels[paymentType]} يتم تجهيزها.</span>
          )}
        </div>
      )}

      {/* MAIN ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={() => saveInvoice(true)} disabled={isEmpty}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 700,
            background: isEmpty ? 'var(--border-strong)' : 'linear-gradient(135deg, var(--primary), var(--primary-600))',
            color: '#fff', border: 'none', cursor: isEmpty ? 'not-allowed' : 'pointer',
            boxShadow: isEmpty ? 'none' : 'var(--shadow-glow)', gridColumn: '1 / -1'
          }}
        >
          <Printer size={18} /> حفظ وطباعة الفاتورة
        </button>

        <button
          onClick={() => saveInvoice(false)} disabled={isEmpty}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)', cursor: isEmpty ? 'not-allowed' : 'pointer',
          }}
        >
          <Save size={16} /> حفظ فقط
        </button>

        <button
          onClick={onHold} disabled={isEmpty}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: 'var(--warning-bg)', color: 'var(--warning-text)',
            border: '1px solid var(--warning-border)', cursor: isEmpty ? 'not-allowed' : 'pointer',
          }}
        >
          <PauseCircle size={16} /> تعليق ({heldCount})
        </button>
      </div>

      {/* Delete / Clear Action */}
      <div style={{ marginTop: '12px' }}>
        <button
          onClick={clear} disabled={isEmpty}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: 'transparent', color: isEmpty ? 'var(--text-muted)' : 'var(--danger-text)',
            border: 'none', cursor: isEmpty ? 'not-allowed' : 'pointer', transition: 'all 150ms ease'
          }}
          onMouseEnter={e => { if(!isEmpty) e.currentTarget.style.background = 'var(--danger-bg)' }}
          onMouseLeave={e => { if(!isEmpty) e.currentTarget.style.background = 'transparent' }}
        >
          <Trash2 size={15} /> إلغاء الفاتورة / مسح
        </button>
      </div>
      
      {/* Held Invoices Mini List if any */}
      {heldInvoices && heldInvoices.length > 0 && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>فواتير معلقة ({heldInvoices.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {heldInvoices.map((held) => (
              <button
                key={held.id} onClick={() => onResume(held.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-normal)', cursor: 'pointer', textAlign: 'start'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{held.customer?.name || "زبون نقدي"}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{held.lines.length} بنود • {new Date(held.heldAt).toLocaleTimeString("ar-EG")}</div>
                </div>
                <PlayCircle size={14} color="var(--primary)" />
              </button>
            ))}
          </div>
        </div>
      )}

      {message && <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--success-text)', fontWeight: 600 }}>{message}</div>}
      {printOpen && printInvoice && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="pos_receipt"
          invoice={printInvoice}
          operationLabel="فاتورة مبيعات"
        />
      )}
    </div>
  );
}
