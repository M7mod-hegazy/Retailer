import { create } from "zustand";
import { persist } from "zustand/middleware";

const PRESETS = {
  high: {
    animations: true,
    blur: true,
    shadows: true,
    loginOrbs: true,
    dataTableAnimations: true,
    sidebarAnimations: true,
    pageTransitions: true,
    reduceMotion: false,
    fpsCounter: false,
    targetFps: 60,
    imageQuality: "high",
    particles: true,
    smoothScrolling: true,
  },
  medium: {
    animations: false,
    blur: false,
    shadows: false,
    loginOrbs: false,
    dataTableAnimations: false,
    sidebarAnimations: false,
    pageTransitions: false,
    reduceMotion: true,
    fpsCounter: false,
    targetFps: 30,
    imageQuality: "medium",
    particles: false,
    smoothScrolling: true,
  },
  low: {
    animations: false,
    blur: false,
    shadows: false,
    loginOrbs: false,
    dataTableAnimations: false,
    sidebarAnimations: false,
    pageTransitions: false,
    reduceMotion: true,
    fpsCounter: false,
    targetFps: 30,
    imageQuality: "low",
    particles: false,
    smoothScrolling: false,
  },
};

export { PRESETS };

const QUALITY_CLASSES = {
  high: "perf-img-high",
  medium: "perf-img-medium",
  low: "perf-img-low",
};

// Every class this module may add to <html>. Removed up-front so each call
// rebuilds the class list cleanly from the current settings.
const ALL_PERF_CLASSES = [
  ...Object.values(QUALITY_CLASSES),
  "perf-smooth-scroll", "perf-no-smooth-scroll", "perf-fps-on",
  "perf-no-orbs", "perf-no-blur", "perf-no-shadows", "perf-sidebar-no-anim",
  "perf-no-page-transition", "perf-no-animations", "perf-reduce-motion",
  // legacy bucket classes (older persisted versions) — removed for safety
  "perf-low", "perf-medium", "perf-high", "perf-custom", "perf-particles-on",
];

// `preset` is accepted for call-site compatibility but no longer affects the
// output: every mode (presets AND custom) maps 1:1 from the individual
// settings to atomic CSS classes, so each toggle works independently.
export function applyToDOM(preset, settings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove(...ALL_PERF_CLASSES);

  const s = settings || {};

  if (s.imageQuality && QUALITY_CLASSES[s.imageQuality]) {
    html.classList.add(QUALITY_CLASSES[s.imageQuality]);
  }
  html.classList.add(s.smoothScrolling ? "perf-smooth-scroll" : "perf-no-smooth-scroll");
  if (!s.particles) html.classList.add("perf-no-orbs");
  if (!s.blur) html.classList.add("perf-no-blur");
  if (!s.shadows) html.classList.add("perf-no-shadows");
  if (!s.sidebarAnimations) html.classList.add("perf-sidebar-no-anim");
  if (!s.pageTransitions) html.classList.add("perf-no-page-transition");
  if (!s.animations) html.classList.add("perf-no-animations");
  if (s.reduceMotion) html.classList.add("perf-reduce-motion");
  if (s.fpsCounter) html.classList.add("perf-fps-on");

  // Honour the OS-level reduced-motion preference regardless of preset.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    html.classList.add("perf-reduce-motion");
  }
}

export const usePerformanceStore = create(
  persist(
    (set, get) => ({
      preset: "low",
      settings: { ...PRESETS.low },

      setPreset: (preset) => {
        const s = { ...PRESETS[preset] };
        set({ preset, settings: s });
        applyToDOM(preset, s);
      },

      setSetting: (key, value) => {
        const current = get();
        const newSettings = { ...current.settings, [key]: value };
        set({ preset: "custom", settings: newSettings });
        applyToDOM("custom", newSettings);
      },
    }),
    {
      name: "elhegazi-perf",
      version: 4,
      migrate: (persisted, version) => {
        const base = { ...PRESETS.low, ...persisted?.settings };
        return {
          preset: persisted?.preset ?? "low",
          settings: { ...PRESETS.low, ...persisted?.settings },
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) applyToDOM(state.preset, state.settings);
      },
    },
  ),
);

export function getPerformanceSnapshot() {
  return usePerformanceStore.getState();
}
