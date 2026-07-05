/**
 * ShiftStatusBar.jsx — Premium shift status indicator
 * Live pulse dot, gradient background, clear open/close states
 */
import React, { useState } from "react";
import PayInPayOutModal from "./PayInPayOutModal";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import { Clock, Plus, Minus, Lock, Unlock } from "lucide-react";

export default function ShiftStatusBar({ shift, onOpen, onClose }) {
  const [payType, setPayType] = useState(null);

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <section style={{
      background: shift ? 'linear-gradient(to left, var(--primary-50), var(--bg-surface))' : 'var(--bg-surface)',
      border: `1px solid ${shift ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
      borderRadius: '20px',
      padding: '16px 20px',
      marginBottom: '20px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      boxShadow: 'var(--shadow-card)',
    }}>
      {/* Status Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Pulse indicator */}
        <div style={{
          position: 'relative',
          width: 48, height: 48,
          borderRadius: '16px',
          background: shift ? 'var(--primary-100)' : 'var(--bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: shift ? 'var(--primary)' : 'var(--text-muted)'
        }}>
          {shift ? <Unlock size={22} /> : <Lock size={22} />}
          {shift && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: 'var(--primary)', border: '2px solid var(--bg-surface)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }} />
          )}
        </div>

        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {shift ? 'الوردية مفتوحة' : 'الوردية مغلقة'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <Clock size={12} />
            {shift ? `منذ ${formatTime(shift.opened_at)}` : "يرجى فتح وردية لبدء المبيعات"}
          </p>
        </div>
      </div>

      {/* Current Total (if open) */}
      {shift && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-normal)',
          borderRadius: '12px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>النقدية بالدرج:</span>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-number)' }}>
            <CurrencyDisplay value={Number(shift.current_total || shift.opening_cash || 0)} />
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!shift ? (
          <button
            onClick={onOpen}
            style={{
              padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: 'var(--shadow-glow)', transition: 'transform 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
          >
            فتح وردية جديدة
          </button>
        ) : (
          <>
            <button
              onClick={() => setPayType("in")}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: 'var(--bg-surface)', color: 'var(--primary)',
                border: '1px solid var(--border-accent)', cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-50)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
            >
              <Plus size={14} /> إيداع
            </button>
            <button
              onClick={() => setPayType("out")}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: 'var(--bg-surface)', color: 'var(--danger-text)',
                border: '1px solid var(--danger-text)', cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
            >
              <Minus size={14} /> سحب
            </button>
            
            <div style={{ width: '1px', height: '24px', background: 'var(--border-strong)', margin: '0 4px' }} />
            
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: 'var(--bg-overlay)', color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)', cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            >
              إغلاق الوردية
            </button>
          </>
        )}
      </div>

      {payType && (
        <PayInPayOutModal 
          open={true} 
          type={payType} 
          onClose={() => setPayType(null)} 
        />
      )}
    </section>
  );
}
