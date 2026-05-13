import { create } from 'zustand';
import api from '../services/api';

export const useHelpStore = create((set, get) => ({
  touredPages: {},              
  toursDisabledGlobally: false,
  tooltipsDisabledGlobally: false,
  isLoaded: false,
  activeTourPageKey: null,
  activeTourStepIndex: 0,
  isTourVisible: false,
  activeTooltipKey: null,

  loadHelpState: async () => {
    try {
      const { data } = await api.get('/api/help/state');
      const payload = data?.data || {};
      set({
        touredPages: payload.toured_pages || {},
        toursDisabledGlobally: Boolean(payload.tours_disabled_globally),
        tooltipsDisabledGlobally: Boolean(payload.tooltips_disabled_globally),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  triggerPageTour: (pageKey) => {
    const { touredPages, toursDisabledGlobally } = get();
    if (toursDisabledGlobally) return;
    if (touredPages[pageKey]) return; 
    set({
      activeTourPageKey: pageKey,
      activeTourStepIndex: 0,
      isTourVisible: true,
    });
  },

  nextTourStep: (totalSteps) => {
    const { activeTourStepIndex } = get();
    if (activeTourStepIndex < totalSteps - 1) {
      set({ activeTourStepIndex: activeTourStepIndex + 1 });
    } else {
      get().completeTour();
    }
  },

  prevTourStep: () => {
    const { activeTourStepIndex } = get();
    if (activeTourStepIndex > 0) {
      set({ activeTourStepIndex: activeTourStepIndex - 1 });
    }
  },

  completeTour: async () => {
    const { activeTourPageKey, touredPages } = get();
    if (!activeTourPageKey) return;

    set({
      isTourVisible: false,
      touredPages: { ...touredPages, [activeTourPageKey]: true },
      activeTourPageKey: null,
      activeTourStepIndex: 0,
    });

    try {
      await api.patch(`/api/help/state/tour/${activeTourPageKey}`, { seen: true });
    } catch { }
  },

  disableAllTours: async () => {
    set({ isTourVisible: false, toursDisabledGlobally: true });
    try {
      await api.patch('/api/help/state/disable-tours');
    } catch { }
  },

  disableAllTooltips: async () => {
    set({ activeTooltipKey: null, tooltipsDisabledGlobally: true });
    try {
      await api.patch('/api/help/state/disable-tooltips');
    } catch { }
  },

  openTooltip: (key) => set({ activeTooltipKey: key }),
  closeTooltip: () => set({ activeTooltipKey: null }),
}));
