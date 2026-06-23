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
  // Auto update state
  available: false,
  downloaded: false,
  info: null,
  progress: null,
  error: null,
  checking: false,
  phase: 'idle',
  lastCheckedAt: null,

  // Manual download state
  manualAvailable: false,
  manualDownloading: false,
  manualProgress: null,
  manualFilePath: null,
  manualError: null,
  downloadUrl: null,
  fileSize: null,

  bannerDismissed: getStoredDismissed(),

  // Auto update actions
  setChecking: (v) => set({ checking: v, phase: v ? 'checking' : 'idle', ...(v ? { error: null, lastCheckedAt: Date.now() } : {}) }),
  // A newly detected update must clear any stale manual-download state from a
  // previous update (file path / error) so the manual section starts fresh.
  setAvailable: (info) => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, 'false') } catch {}
    return set({
      available: true,
      info,
      checking: false,
      phase: 'available',
      lastCheckedAt: Date.now(),
      manualAvailable: true,
      manualDownloading: false,
      manualProgress: null,
      manualFilePath: null,
      manualError: null,
      downloadUrl: null,
      fileSize: null,
      bannerDismissed: false,
    });
  },
  setNotAvailable: () => set({ available: false, checking: false, phase: 'up-to-date', manualAvailable: false, lastCheckedAt: Date.now() }),
  setProgress: (p) => set((state) =>
    state.phase === 'ready-to-install' || state.phase === 'installing'
      ? { progress: p }
      : { progress: p, phase: 'downloading' }
  ),
  setDownloaded: (info) => set({ downloaded: true, info, checking: false, phase: 'ready-to-install', progress: { percent: 100 } }),
  setError: (e) => set({ error: e, checking: false, phase: 'idle', lastCheckedAt: Date.now() }),
  // User stopped an in-progress auto download — return to the available state
  // (not an error) so they can retry or switch to the manual path.
  setCanceled: () => set({ progress: null, downloaded: false, checking: false, phase: 'available' }),
  setPhase: (phase) => set({ phase }),

  // Manual download actions
  setManualInfo: (d) => set({ manualAvailable: true, downloadUrl: d.downloadUrl, fileSize: d.fileSize }),
  setManualProgress: (p) => set({ manualProgress: p, manualDownloading: true, manualError: null }),
  setManualComplete: (filePath) => set({ manualFilePath: filePath, manualDownloading: false }),
  setManualError: (e) => set({ manualError: e, manualDownloading: false }),
  resetManual: () => set({ manualAvailable: false, manualDownloading: false, manualProgress: null, manualFilePath: null, manualError: null, downloadUrl: null, fileSize: null }),

  // Banner
  dismissBanner: () => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, 'true') } catch {}
    set({ bannerDismissed: true })
  },
  resetBanner: () => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, 'false') } catch {}
    set({ bannerDismissed: false })
  },
  reset: () => set({
    available: false, downloaded: false, info: null, progress: null,
    error: null, checking: false, phase: 'idle', lastCheckedAt: null,
    manualAvailable: false, manualDownloading: false, manualProgress: null,
    manualFilePath: null, manualError: null, downloadUrl: null, fileSize: null,
  }),
}))
