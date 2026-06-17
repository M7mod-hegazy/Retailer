import { create } from 'zustand'

const BANNER_DISMISSED_KEY = 'retailer:update-banner-dismissed'

const getStoredDismissed = () => {
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

export const useUpdateStore = create((set) => ({
  available: false,
  downloaded: false,
  info: null,
  progress: null,
  error: null,
  checking: false,
  bannerDismissed: getStoredDismissed(),
  setChecking: (v) => set({ checking: v }),
  setAvailable: (info) => set({ available: true, info, checking: false }),
  setNotAvailable: () => set({ available: false, checking: false }),
  setProgress: (p) => set({ progress: p }),
  setDownloaded: (info) => set({ downloaded: true, info, checking: false }),
  setError: (e) => set({ error: e, checking: false }),
  dismissBanner: () => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, 'true') } catch {}
    set({ bannerDismissed: true })
  },
  resetBanner: () => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, 'false') } catch {}
    set({ bannerDismissed: false })
  },
  reset: () => set({ available: false, downloaded: false, info: null, progress: null, error: null, checking: false }),
}))
