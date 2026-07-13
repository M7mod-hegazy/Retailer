import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen } from "lucide-react";
import IllustratedGuide from "./IllustratedGuide";
import pageGuides from "../../help/pageGuides";
import helpContent from "../../help/helpContent";
import { getHelpPageKey } from "../../help/routeHelp";
import { useHelpStore } from "../../stores/helpStore";

// Topbar host for the per-page illustrated guides ("كيف تعمل هذه الصفحة؟").
// Shows a button whenever the current route has a guide in pageGuides, and
// auto-opens it once on the user's first visit (persisted server-side via the
// same help-state table tours use, under a "guide:" prefixed key).
export default function PageGuideLauncher() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const autoOpenedFor = useRef(null);

  const { touredPages, toursDisabledGlobally, isLoaded, isTourVisible, markSeen } = useHelpStore();

  const pageKey = useMemo(() => getHelpPageKey(location.pathname), [location.pathname]);
  const guide = pageKey ? pageGuides[pageKey] : null;
  const seenKey = pageKey ? `guide:${pageKey}` : null;

  useEffect(() => {
    setOpen(false);
  }, [pageKey]);

  useEffect(() => {
    if (!guide || !seenKey || !isLoaded) return;
    if (toursDisabledGlobally) return;
    // The existing spotlight tour system always owns the first visit: if this
    // page has a tour that hasn't been completed yet (usePageTour will fire it
    // ~1.2s after load), the guide must not auto-open — no races, no stacking.
    // It stays reachable from its button and may auto-open on a later visit.
    if (helpContent[pageKey] && !touredPages[pageKey]) {
      autoOpenedFor.current = seenKey;
      return;
    }
    if (isTourVisible) {
      autoOpenedFor.current = seenKey;
      return;
    }
    if (touredPages[seenKey]) return;
    if (autoOpenedFor.current === seenKey) return;
    autoOpenedFor.current = seenKey;
    setOpen(true);
  }, [guide, seenKey, isLoaded, toursDisabledGlobally, isTourVisible, touredPages]);

  if (!guide) return null;

  function close() {
    setOpen(false);
    if (seenKey && !touredPages[seenKey]) markSeen(seenKey);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="كيف تعمل هذه الصفحة؟"
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
          open
            ? "bg-primary text-white shadow-lg"
            : "bg-zinc-50/50 border border-zinc-200/60 text-zinc-600 hover:bg-white hover:shadow-sm"
        }`}
      >
        <BookOpen strokeWidth={2} className="h-4.5 w-4.5" />
      </button>
      {open && <IllustratedGuide guide={guide} onClose={close} />}
    </>
  );
}
