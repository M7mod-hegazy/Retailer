import { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useReportsConfig } from "../../hooks/useReportsConfig";

// Old report URLs (/reports/<slug>, e.g. /reports/margin-health) used to render a
// standalone workspace page. That page was removed; this redirect maps the legacy
// slug through the registry compat maps (reportSlugToSource / reportSlugToClassification)
// to the source workspace, keeping any query params (dates, filters) intact.
export default function LegacyReportRedirect() {
  const { reportSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: config, isLoading } = useReportsConfig();

  useEffect(() => {
    if (isLoading) return;
    const sourceKey = config?.reportSlugToSource?.[reportSlug];
    const cls = config?.reportSlugToClassification?.[reportSlug];
    if (sourceKey && cls?.classification) {
      const mode = cls.dataMode || "detailed";
      navigate(`/reports/source/${sourceKey}/${cls.classification}/${mode}${location.search}`, { replace: true });
    } else {
      navigate("/reports/center", { replace: true });
    }
  }, [isLoading, config, reportSlug, navigate, location.search]);

  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center text-text-muted">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}
