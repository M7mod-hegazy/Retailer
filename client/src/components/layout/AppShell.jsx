import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import DesktopLayout from "./DesktopLayout";
import MobileLayout from "./MobileLayout";
import api from "../../services/api";
import { syncOfflineData } from "../../services/offlineSync";
import { PageTour } from "../help/PageTour";
import { useHelpStore } from "../../stores/helpStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { usePerformanceStore, applyToDOM } from "../../stores/performanceStore";
import { usePageTour } from "../../hooks/usePageTour";
import { getHelpPageKey } from "../../help/routeHelp";
import { applyFontSettings } from "../../utils/fontSettings";
import { applyColorTheme } from "../../utils/applyColorTheme";
import FpsOverlay from "../ui/FpsOverlay";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function RouteHelpTrigger() {
  const location = useLocation();
  const pageKey = getHelpPageKey(location.pathname);
  usePageTour(pageKey);
  return null;
}

export default function AppShell({ children }) {
  const isMobile = useIsMobile();
  const loadHelpState = useHelpStore((state) => state.loadHelpState);
  const applySettings = useAppSettingsStore((state) => state.applySettings);
  const perfSettings = usePerformanceStore((s) => s.settings);
  const perfPreset = usePerformanceStore((s) => s.preset);
  const [branding, setBranding] = useState({
    title: "ElHegazi Retailer",
    subtitle: "Retailer Suite",
    logoUrl: null,
    showOnSidebar: true,
  });
  
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineData(api);
    };
    window.addEventListener("online", handleOnline);
    // Try to sync on mount if already online
    if (navigator.onLine) {
      handleOnline();
    }
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    loadHelpState();
  }, [loadHelpState]);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/settings")
      .then((response) => {
        if (!mounted) return;
        const settings = response.data?.data || {};
        applySettings(settings);
        applyFontSettings(settings);
        applyColorTheme(settings);
        setBranding({
          title: settings.app_name || settings.company_name || "ElHegazi Retailer",
          subtitle: settings.app_subtitle || settings.branch_name || "Retailer Suite",
          logoUrl: settings.logo_url || null,
          showOnSidebar: settings.logo_on_sidebar !== false && settings.logo_on_sidebar !== 0,
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [applySettings]);

  useEffect(() => {
    // data-theme is owned by applyColorTheme ("global" for the default theme,
    // "light"/"dark" for color themes). Don't force it here — doing so raced
    // applyColorTheme and briefly clobbered non-default themes' overrides.
    document.documentElement.classList.remove("light");
  }, []);

  useEffect(() => {
    applyToDOM(perfPreset, perfSettings);
  }, [perfPreset, perfSettings]);

  useEffect(() => {
    document.title = branding.title;
  }, [branding.title]);

  useEffect(() => {
    const existing = document.querySelector('link[rel="icon"]');
    if (branding.logoUrl) {
      const link = existing || document.createElement('link');
      link.rel = 'icon';
      link.href = branding.logoUrl;
      if (!existing) document.head.appendChild(link);
    } else {
      if (existing) existing.href = '/favicon.svg';
    }
  }, [branding.logoUrl]);

  return (
    <>
      <div className="app-background pointer-events-none">
        <div className="orb-1 pointer-events-none"></div>
        <div className="orb-2 pointer-events-none"></div>
        <div className="orb-3 pointer-events-none"></div>
      </div>
      <div className="shell-frame relative min-h-screen pointer-events-auto">
        <MotionConfig reducedMotion={perfSettings.reduceMotion ? "always" : "never"}>
          {isMobile ? <MobileLayout branding={branding}>{children}</MobileLayout> : <DesktopLayout branding={branding}>{children}</DesktopLayout>}
        </MotionConfig>
      </div>
      <RouteHelpTrigger />
      <PageTour />
      <FpsOverlay />
    </>
  );
}
