import React, { useState, useEffect, useCallback } from "react";
import { Grid3X3, Loader2, Package, X } from "lucide-react";
import api from "../../services/api";
import Modal from "../ui/Modal";

export default function VariantPickerModal({ open, item, onPick, onClose }) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchChildren = useCallback(async () => {
    if (!item?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/items/${item.id}/variant-children`);
      setChildren(res.data.data || []);
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [item?.id]);

  useEffect(() => {
    if (open) fetchChildren();
  }, [open, fetchChildren]);

  function groupByAttributes() {
    if (!children.length) return [];
    const attrKeys = [...new Set(children.flatMap(c => Object.keys(c.variant_attributes || {})))];
    const groups = {};
    children.forEach(c => {
      const key = attrKeys.map(k => c.variant_attributes?.[k] || "").join(" · ");
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return { attrKeys, groups };
  }

  const { attrKeys, groups } = groupByAttributes();

  return (
    <Modal open={open} title={item?.name || "اختيار متغير"} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-4">
        <p className="text-text-secondary text-sm mb-4">هذا الصنف له متغيرات — اختر المتغير المطلوب:</p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : children.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-text-muted">
            <Package size={40} className="mb-3 opacity-40" />
            <p className="text-sm">لا توجد متغيرات لهذا الصنف</p>
          </div>
        ) : attrKeys.length > 1 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Object.entries(groups).map(([groupKey, groupItems]) => (
              <div key={groupKey} className="rounded-xl border border-border-normal bg-bg-surface overflow-hidden">
                <div className="px-4 py-2 bg-bg-base text-xs font-bold text-text-secondary border-b border-border-subtle">
                  {attrKeys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && " · "}
                      <span className="text-text-muted">{k}:</span> {groupItems[0]?.variant_attributes?.[k]}
                    </span>
                  ))}
                </div>
                <div className="divide-y divide-border-subtle">
                  {groupItems.map(child => (
                    <button
                      key={child.id}
                      onClick={() => onPick(child)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-overlay transition-colors text-right"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Grid3X3 size={16} className="shrink-0 text-text-muted" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{child.name}</div>
                          <div className="text-xs text-text-muted">{child.barcode || child.code || "بدون كود"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs text-text-secondary">{child.stock_quantity || 0} في المخزون</span>
                        <span className="text-sm font-bold text-primary">{Number(child.sale_price || 0).toLocaleString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => onPick(child)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border-normal bg-bg-surface hover:border-primary hover:bg-primary-50/30 transition-all text-center"
              >
                <div className="text-sm font-bold text-text-primary">{child.name}</div>
                {child.barcode && <div className="text-xs text-text-muted font-mono">{child.barcode}</div>}
                <div className="text-sm font-bold text-primary">{Number(child.sale_price || 0).toLocaleString()}</div>
                <div className="text-xs text-text-secondary">المخزون: {child.stock_quantity || 0}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
