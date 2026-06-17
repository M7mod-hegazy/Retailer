import { create } from 'zustand'

// Dismissal is date-stamped: the dashboard installment banner reappears the next day
// (and whenever new installments come due) rather than being permanently dismissed.
const KEY = 'retailer:installment-alert-dismissed'
const todayStr = () => new Date().toISOString().slice(0, 10)

const getStoredDismissed = () => {
  try {
    return localStorage.getItem(KEY) === todayStr()
  } catch {
    return false
  }
}

export const useInstallmentAlertStore = create((set) => ({
  dismissed: getStoredDismissed(),
  dismiss: () => {
    try { localStorage.setItem(KEY, todayStr()) } catch {}
    set({ dismissed: true })
  },
  // Re-evaluate against the current date (e.g. on window focus after midnight).
  refresh: () => set({ dismissed: getStoredDismissed() }),
}))
