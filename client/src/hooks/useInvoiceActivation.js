import { useState, useRef, useCallback, useEffect } from "react";
import api from "../services/api";

/**
 * Manages idle → active state for invoice forms.
 * Doc number and createdAt are null until the user's first meaningful interaction.
 *
 * @param {string} documentType - 'pos_sale' | 'purchase_receipt' | 'sales_return' | 'purchase_return'
 * @param {{ docNo: string, createdAt: string }|null} editValues
 *   Pass existing doc_no + created_at when in edit/amend mode — skips activation entirely.
 */
export function useInvoiceActivation(documentType, editValues = null) {
  const isEditMode = !!editValues;

  const [docNo, setDocNo] = useState(editValues?.docNo ?? null);
  const [createdAt, setCreatedAt] = useState(editValues?.createdAt ?? null);
  const [isActive, setIsActive] = useState(isEditMode);
  const activating = useRef(false);

  // Sync when editValues arrive asynchronously (returns pages load edit data from API after mount)
  useEffect(() => {
    if (editValues?.docNo && !isActive) {
      setDocNo(editValues.docNo);
      setCreatedAt(editValues.createdAt ?? null);
      setIsActive(true);
    }
  }, [editValues?.docNo]);

  // Call on first meaningful user interaction (add item / select party / toggle search).
  const activate = useCallback(async () => {
    if (isActive || activating.current || isEditMode) return;
    activating.current = true;
    try {
      const res = await api.post("/api/documents/reserve", { type: documentType });
      const reserved = res.data.data.doc_no;
      const now = new Date().toISOString();
      setDocNo(reserved);
      setCreatedAt(now);
      setIsActive(true);
    } catch {
      // Non-fatal: doc number will be generated server-side on save as fallback
    } finally {
      activating.current = false;
    }
  }, [isActive, isEditMode, documentType]);

  // Reset to idle state — call after successful save
  const reset = useCallback(() => {
    setDocNo(null);
    setCreatedAt(null);
    setIsActive(false);
    activating.current = false;
  }, []);

  return { docNo, createdAt, isActive, activate, reset };
}
