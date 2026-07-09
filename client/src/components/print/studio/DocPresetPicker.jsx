// DocPresetPicker — opens the full preset gallery for ONE document scope,
// straight from the Document Settings table (no full Studio). It assembles the
// same context the gallery needs (merged flat settings + effective family
// layout) from already-loaded settings, then persists the chosen preset to that
// doc via PUT /api/print-settings-per-doc/:scope.
//
// Presets are family-scoped (roll = 58/80mm, page = A5/A4). The picker is opened
// at the row's *current* default size, so the family shown, previewed, applied,
// and printed all stay in sync. Applying stamps preset_<family> = {id,label} on
// the doc so the table can show the right preset per size without cross-family
// bleed.
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import PresetsGallery from "./PresetsGallery";
import TemplateDocPreview from "./TemplateDocPreview";
import { familyOfSize, BLOCK_DOCS } from "./studioData";
import { seedFamilyLayout, resolveEffectiveLayout } from "../layout/layoutModel";
import { applyPreset } from "../presets/presetEngine";

const stripLayout = ({ layout, ...rest } = {}) => rest;

export default function DocPresetPicker({
  open, scope, size,
  appSettings = {}, globalSettings = {}, docSettings = {},
  onClose, onApplied,
}) {
  // local mirror so the applied ring updates without a refetch
  const [doc, setDoc] = useState(docSettings);
  const family = familyOfSize(size);
  const isBlockDoc = scope === "_global" || BLOCK_DOCS.has(scope);

  // same precedence as the real pipeline: app → _global flat → per-doc flat
  const merged = useMemo(
    () => ({ ...appSettings, ...stripLayout(globalSettings), ...stripLayout(doc) }),
    [appSettings, globalSettings, doc]
  );

  const currentFamilyLayout = useMemo(
    () => resolveEffectiveLayout(globalSettings, doc, family, scope) || seedFamilyLayout(family, scope),
    [globalSettings, doc, family, scope]
  );

  const appliedPresetId = (doc[`preset_${family}`] || {}).id || null;

  const onApply = async (preset) => {
    const fam = family;
    let next;
    if (preset && preset.isFallback) {
      next = { ...doc };
      delete next[`preset_${fam}`];
      if (next.layout) {
        const nextLayout = { ...next.layout };
        delete nextLayout[fam];
        next.layout = nextLayout;
      }
    } else {
      const base = doc.layout ? doc : { ...doc, layout: {} };
      next = applyPreset(base, preset, scope);
      const targetFam = preset.family || fam;
      next[`preset_${targetFam}`] = { id: preset.id, label: preset.name || preset.label || "" };
    }
    setDoc(next);
    try {
      await api.put(`/api/print-settings-per-doc/${scope}`, next);
      if (preset && preset.isFallback) {
        toast.success("تمت إزالة القالب والعودة للتصميم العام المشترك");
      } else {
        toast.success(`طُبّق القالب: ${preset.name || preset.label || ""}`);
      }
      onApplied && onApplied(scope, next);
    } catch {
      toast.error("تعذّر حفظ القالب");
    }
  };

  if (!open) return null;

  return (
    <PresetsGallery
      open={open}
      onClose={onClose}
      family={family}
      size={size}
      merged={merged}
      currentFamilyLayout={currentFamilyLayout}
      appliedPresetId={appliedPresetId}
      onApply={onApply}
      isBlockDoc={isBlockDoc}
      scope={scope}
      renderPreview={(previewSettings) => <TemplateDocPreview scope={scope} settings={previewSettings} />}
    />
  );
}
