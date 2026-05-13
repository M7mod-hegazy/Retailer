import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../../services/api";
import { HelpCircle, X } from "lucide-react";

const HelpContext = createContext();

export function HelpProvider({ children }) {
  const [activeTours, setActiveTours] = useState({});

  const checkTour = async (pageKey) => {
    try {
      const res = await api.get(`/api/help/${pageKey}`);
      if (res.data?.success && !res.data.data.completed) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const completeTour = async (pageKey) => {
    try {
      await api.post(`/api/help/${pageKey}/complete`);
      setActiveTours((prev) => ({ ...prev, [pageKey]: false }));
    } catch {}
  };

  return (
    <HelpContext.Provider value={{ checkTour, completeTour, activeTours, setActiveTours }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelpTour(pageKey) {
  const { checkTour, completeTour, activeTours, setActiveTours } = useContext(HelpContext);

  useEffect(() => {
    let mounted = true;
    checkTour(pageKey).then((needed) => {
      if (mounted && needed) {
        setActiveTours((prev) => ({ ...prev, [pageKey]: true }));
      }
    });
    return () => {
      mounted = false;
    };
  }, [pageKey, checkTour, setActiveTours]);

  return {
    showHelp: !!activeTours[pageKey],
    dismissHelp: () => completeTour(pageKey),
  };
}

export function HelpTooltip({ title, text, pageKey, position = "bottom" }) {
  const { showHelp, dismissHelp } = useHelpTour(pageKey);

  if (!showHelp) return null;

  const posClasses = {
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className={`glass-elevated absolute z-50 w-64 rounded-[20px] p-4 text-text-primary ${posClasses[position]}`}>
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2 font-bold">
          <HelpCircle className="h-4 w-4 text-primary-200" />
          {title}
        </div>
        <button onClick={dismissHelp} className="text-text-secondary transition hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-text-secondary">{text}</p>

      <div
        className={`absolute h-3 w-3 rotate-45 border-white/8 bg-bg-elevated
        ${position === "bottom" ? "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t" : ""}
        ${position === "top" ? "-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r" : ""}
        ${position === "left" ? "-right-1.5 top-1/2 -translate-y-1/2 border-r border-t" : ""}
        ${position === "right" ? "-left-1.5 top-1/2 -translate-y-1/2 border-b border-l" : ""}
      `}
      />
    </div>
  );
}
