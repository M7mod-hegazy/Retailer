/**
 * paymentMethodDisplay.js
 * Shared helpers for rendering payment_splits strings and payment method labels/badges.
 * All "Today" modals use this to guarantee consistent split parsing and theming.
 */

/**
 * Known system payment types → themed badge classes (NO hardcoded Tailwind color names).
 * "multi" is intentionally absent — it is always unwound into its constituent parts.
 */
export const SYSTEM_PAYMENT_STYLES = {
  cash:          { label: 'نقدي',           cls: 'bg-success-bg text-success-text border-success-border' },
  bank_transfer: { label: 'بنك / فيزا',     cls: 'bg-info-bg text-info-text border-info-border' },
  credit:        { label: 'آجل',             cls: 'bg-warning-bg text-warning-text border-warning-border' },
  installments:  { label: 'أقساط',           cls: 'bg-primary-50 text-primary border-primary-200' },
  future_due:    { label: 'استحقاق لاحق',   cls: 'bg-warning-bg text-warning-text border-warning-border' },
  account:       { label: 'حساب',            cls: 'bg-warning-bg text-warning-text border-warning-border' },
};

/**
 * Safely parse a payment_splits string.
 * Format: "method:amount|||method:amount"
 * Method names can contain any Arabic text (they are stored as payment_methods.name).
 * Uses indexOf(':') so Arabic names with no colon are handled correctly.
 */
export function parseSplits(splitsStr) {
  if (!splitsStr) return [];
  return splitsStr
    .split('|||')
    .filter(Boolean)
    .map(s => {
      const idx = s.indexOf(':');
      if (idx === -1) return null;
      const method = s.slice(0, idx).trim();
      const amount = Number(s.slice(idx + 1));
      return method && amount > 0 ? { method, amount } : null;
    })
    .filter(Boolean);
}

/**
 * Resolve display label + badge CSS class for a given payment method key.
 * Falls back to the payment_methods list (fetched from the API) for custom user-created methods.
 * Custom methods are stored in payments.method as payment_methods.name (e.g. "فودافون كاش").
 *
 * @param {string} methodKey - The raw method string (e.g. "cash", "فودافون كاش")
 * @param {Array}  paymentMethods - Array of payment_methods rows from the API
 * @returns {{ label: string, cls: string }}
 */
export function resolvePaymentStyle(methodKey, paymentMethods = []) {
  if (SYSTEM_PAYMENT_STYLES[methodKey]) return SYSTEM_PAYMENT_STYLES[methodKey];
  // Custom user-created method: matched by name, type, or category
  const pm = paymentMethods.find(
    p => p.name === methodKey || p.type === methodKey || p.category === methodKey
  );
  const label = pm ? `${pm.icon || ''}${pm.name}`.trim() : methodKey;
  return { label, cls: 'bg-info-bg text-info-text border-info-border' };
}

/**
 * Calculate a breakdown of totals by payment method from an array of records.
 * Automatically unwinds payment_splits if present.
 * Skips voided and cancelled records.
 *
 * @param {Array} records - Array of invoice or purchase rows
 * @param {string} methodFallbackField - The fallback field to use if payment_splits is not present
 * @param {Array} paymentMethods - Optional array of payment_methods to normalize names
 * @returns {Object} A map of { [method]: totalAmount }
 */
export function calculatePaymentBreakdown(records, methodFallbackField = 'payment_method', paymentMethods = []) {
  const breakdown = {};
  
  const normalize = (methodStr) => {
    if (!methodStr) return 'cash';
    if (methodStr === "نقدي" || methodStr.includes("نقدي -") || methodStr.includes("نقدي")) return 'cash';
    if (SYSTEM_PAYMENT_STYLES[methodStr]) return methodStr;
    const pm = paymentMethods.find(p => p.name === methodStr || p.type === methodStr || p.category === methodStr);
    if (pm && pm.type === 'cash') return 'cash';
    return methodStr;
  };

  for (const r of records || []) {
    if (r.status === 'voided' || r.status === 'cancelled') continue;
    const total = Number(r.total || 0);

    if (r.payment_splits) {
      const splits = parseSplits(r.payment_splits);
      for (const s of splits) {
        const norm = normalize(s.method);
        breakdown[norm] = (breakdown[norm] || 0) + s.amount;
      }
    } else {
      const method = r[methodFallbackField] || r.payment_type || 'cash';
      const norm = normalize(method);
      breakdown[norm] = (breakdown[norm] || 0) + total;
    }
  }
  return breakdown;
}
