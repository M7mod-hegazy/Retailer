import { useEffect } from 'react';
import { useHelpStore } from '../stores/helpStore';
import helpContent from '../help/helpContent';

export const usePageTour = (pageKey) => {
  const { isLoaded, triggerPageTour } = useHelpStore();

  useEffect(() => {
    if (!isLoaded || !helpContent[pageKey]) return;
    const timer = setTimeout(() => triggerPageTour(pageKey), 1200);
    return () => clearTimeout(timer);
  }, [isLoaded, pageKey, triggerPageTour]);
};
