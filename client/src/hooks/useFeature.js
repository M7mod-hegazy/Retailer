import { useAppSettingsStore } from "../stores/appSettingsStore";

export function useFeatureEnabled(key) {
  const settings = useAppSettingsStore((s) => s.settings);
  if (!(key in settings)) return false;
  return Boolean(settings[key]);
}
