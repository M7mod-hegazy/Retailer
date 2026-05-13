import { create } from 'zustand'

export const useUpdateStore = create((set) => ({
  available: false,
  downloaded: false,
  info: null,
  progress: null,
  error: null,
  checking: false,
  setChecking: (v) => set({ checking: v }),
  setAvailable: (info) => set({ available: true, info, checking: false }),
  setNotAvailable: () => set({ available: false, checking: false }),
  setProgress: (p) => set({ progress: p }),
  setDownloaded: (info) => set({ downloaded: true, info }),
  setError: (e) => set({ error: e, checking: false }),
  reset: () => set({ available: false, downloaded: false, info: null, progress: null, error: null, checking: false }),
}))
