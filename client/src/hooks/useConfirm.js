import { useState, useCallback } from "react";

/**
 * useConfirm — replaces window.confirm() with a styled ConfirmDialog.
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({ title: "تأكيد الحذف", message: "هل تريد حذف هذا العنصر؟" });
 *     if (ok) { ...proceed }
 *   };
 *
 * For destructive actions that require typing to confirm:
 *   const { dramaticConfirm } = useConfirm();
 *   const ok = await dramaticConfirm({ itemName: "فاتورة البيع #123" });
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, title: "", message: "", resolve: null, destructive: false, itemName: "" });

  const confirm = useCallback(({ title = "تأكيد العملية", message = "" } = {}) => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, resolve, destructive: false, itemName: "" });
    });
  }, []);

  const dramaticConfirm = useCallback(({ itemName = "", title = "تأكيد الحذف" } = {}) => {
    return new Promise((resolve) => {
      setState({ open: true, title, message: "", resolve, destructive: true, itemName });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  return {
    confirm,
    dramaticConfirm,
    confirmState: state,
    handleConfirm,
    handleCancel,
  };
}
