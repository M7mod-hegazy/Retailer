import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { usePosStore } from "../../stores/posStore";
import { User, ShieldAlert } from "lucide-react";

export default function CustomerSelector() {
  const customer = usePosStore((state) => state.customer);
  const setCustomer = usePosStore((state) => state.setCustomer);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api.get("/api/customers").then((response) => setCustomers(response.data.data || [])).catch(() => setCustomers([]));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={14} /> العميل
        </label>
        <span style={{ fontSize: '10px', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>اختياري</span>
      </div>

      <select
        value={customer?.id || ""}
        onChange={(event) => {
          const next = customers.find((entry) => entry.id === Number(event.target.value)) || null;
          setCustomer(next);
        }}
        style={{
          width: '100%', padding: '10px 12px',
          border: '1px solid var(--border-normal)',
          borderRadius: '8px', background: 'var(--bg-surface)',
          fontSize: '13px', color: 'var(--text-primary)',
          outline: 'none', transition: 'all 150ms ease'
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border-normal)'; e.target.style.boxShadow = 'none'; }}
      >
        <option value="">-- عميل نقدي عام --</option>
        {customers.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name} {entry.phone ? `| ${entry.phone}` : ''}
          </option>
        ))}
      </select>

      {customer ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px'
        }}>
          <div><span style={{ color: 'var(--text-muted)' }}>الرصيد: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customer.opening_balance || 0}</span></div>
          {customer.is_blacklisted && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger-text)', fontWeight: 600 }}>
              <ShieldAlert size={12} /> محظور
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
