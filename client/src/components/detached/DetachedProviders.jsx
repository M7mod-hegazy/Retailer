import React from "react";
import { MotionConfig } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { queryClient } from "../../services/queryClient";
import { usePerformanceStore } from "../../stores/performanceStore";
import ErrorBoundary from "../ErrorBoundary";
import RootErrorFallback from "../../pages/error/RootErrorFallback";

// Shared provider shell for detached (child BrowserWindow) modals.
//
// A detached window is the *same* React app loaded with ?detachedModal=1, but
// App.jsx returns <DetachedModalHost/> BEFORE the main provider stack — so a
// detached modal otherwise renders with no QueryClient, no toast portal, no
// error boundary, and no motion config. That is the root cause of "buttons and
// inputs don't work" inside detached windows: anything using useQuery /
// useMutation / toast silently fails, and any thrown error white-screens.
//
// Router and i18next are already global (set up in main.jsx around <App/>), so
// they are intentionally NOT re-provided here.
export default function DetachedProviders({ children }) {
  const perfAnimations = usePerformanceStore((s) => s.settings.animations);
  const perfReduceMotion = usePerformanceStore((s) => s.settings.reduceMotion);
  const reduceMotion = !perfAnimations || perfReduceMotion;

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <ErrorBoundary FallbackComponent={RootErrorFallback}>
        <QueryClientProvider client={queryClient}>
          <Toaster
            position="top-center"
            toastOptions={{ duration: 3000, style: { fontSize: "13px", fontWeight: 700, fontFamily: "inherit" } }}
            containerStyle={{ marginTop: "16px" }}
          />
          {children}
        </QueryClientProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
