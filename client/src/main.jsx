import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createHashRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

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
