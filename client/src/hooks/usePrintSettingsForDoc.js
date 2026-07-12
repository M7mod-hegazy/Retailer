import { useEffect, useState } from "react";
import api from "../services/api";
import { resolveEffectiveLayout } from "../components/print/layout/layoutModel";
import { resolveDocPaperSize, DOC_PAPER_CONFIG, familyOfSize, BLOCK_DOC_SCOPES } from "../components/print/studio/studioData";

export function usePrintSettingsForDoc(docType) {
  const [loading, setLoading] = useState(Boolean(docType));
  const [template, setTemplate] = useState(() => (docType && DOC_PAPER_CONFIG[docType]?.defaultSize) || "A4");
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!docType) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/print-settings-per-doc/${docType}`).then((r) => r.data?.data || {}).catch(() => ({})),
      api.get("/api/print-settings-per-doc/_global").then((r) => r.data?.data || {}).catch(() => ({})),
      api.get("/api/settings").then((r) => r.data?.data || {}).catch(() => ({})),
    ]).then(([docSettings, globalScopeSettings, globalSettings]) => {
      if (cancelled) return;
      const resolvedTemplate = resolveDocPaperSize(docType, docSettings);
      const family = familyOfSize(resolvedTemplate);
      const effectiveLayout = { [family]: resolveEffectiveLayout(globalScopeSettings, docSettings, family, docType) };

      const { layout: _gsLayout, ...globalScopeFlat } = globalScopeSettings || {};
      const isReportDocForInherit = docType !== "_global" && !BLOCK_DOC_SCOPES.has(docType);
      const inheritFamilyKey = `inherit_global_${family}`;
      const docInheritVal = docSettings[inheritFamilyKey] ?? docSettings.inherit_global;
      const docInheritsGlobal = docInheritVal !== undefined ? docInheritVal : !isReportDocForInherit;
      const localFlatFields = docInheritsGlobal ? {} : docSettings;

      const combined = {
        ...(globalSettings || {}),
        ...globalScopeFlat,
        ...localFlatFields,
        layout: effectiveLayout,
      };

      setTemplate(resolvedTemplate);
      setSettings(combined);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [docType]);

  return { loading, template, settings };
}
