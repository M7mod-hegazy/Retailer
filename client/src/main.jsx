import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createHashRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
// colorThemeOverrides.css is no longer imported globally — applyColorTheme
// injects it only for non-default themes so the default theme renders natively.
import { applyColorTheme } from "./utils/applyColorTheme";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

// Apply the saved color theme synchronously on boot — BEFORE first paint — so
// pre-auth screens (LoginPage, ActivationPage) and the splash-to-app handoff are
// themed too. Previously applyColorTheme ran only inside AppShell (post-login),
// which left the login page permanently stuck on the default emerald palette.
// We theme by name from localStorage here; AppShell/LoginPage later refine it
// with the full settings payload (e.g. custom theme variables).
try {
  const savedTheme = window.localStorage.getItem("app_theme");
  if (savedTheme) applyColorTheme({ color_theme: savedTheme });
} catch {
  /* localStorage unavailable — fall back to default theme */
}

i18next.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: window.localStorage.getItem("retailer-language") || "ar",
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

const initialLanguage = i18next.language || "ar";
document.documentElement.dir = initialLanguage === "ar" ? "rtl" : "ltr";
document.documentElement.lang = initialLanguage;

const createRouter = window.location.protocol === "file:" ? createHashRouter : createBrowserRouter;

const router = createRouter(
  [{ path: "*", element: <App /> }],
  { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
