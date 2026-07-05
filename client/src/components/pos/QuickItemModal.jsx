import React, { useState, useEffect, useRef } from "react";
import { Scale, Package } from "lucide-react";
import api from "../../services/api";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import toast from "react-hot-toast";

export default function QuickItemModal({ pluData, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (pluData && nameRef.current) {
      nameRef.current.focus();
    }
  }, [pluData]);

  if (!pluData) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("اسم الصنف مطلوب");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/api/items/quick", {
        name: name.trim(),
        sale_price: Number(salePrice) || 0,
        scale_plu: pluData.plu,
      });
      const item = res.data.data;
      toast.success(`تم إنشاء ${item.name}`);
      const parsed = pluData.parsed;
      const qty = parsed.qty ?? 1;
      const unitPrice = Number(salePrice) || Number(item.sale_price) || 0;
      window.dispatchEvent(new CustomEvent("pos-barcode-scanned", {
        detail: { ...item, quantity: qty, unit_price: unitPrice, _scale: true },
      }));
      onClose();
      onCreated?.(item);
    } catch (err) {
      const msg = err.response?.data?.message || "تعذر إنشاء الصنف";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="رقم PLU غير مسجل" onClose={onClose} maxWidth="max-w-sm" showDetach={false}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <Scale className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-[13px] font-black text-amber-800">رقم PLU غير موجود في قاعدة البيانات</p>
            <p className="text-[12px] font-bold text-amber-600 mt-0.5" dir="ltr">
              PLU: <span className="font-mono">{pluData.plu}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-bg-base p-3">
          <Package className="h-4 w-4 text-text-muted shrink-0" />
          <p className="text-[12px] font-bold text-text-secondary">
            سيتم إنشاء صنف جديد وربطه برقم PLU هذا ليتم التعرّف عليه تلقائياً في المرات القادمة
          </p>
        </div>

        <Input
          ref={nameRef}
          label="اسم الصنف"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="أدخل اسم الصنف..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <Input
          label="سعر البيع"
          type="number"
          min={0}
          step="0.01"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="0.00"
        />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">
            إلغاء
          </Button>
          <Button type="button" disabled={!name.trim() || saving} loading={saving} onClick={handleCreate} className="flex-1">
            إنشاء وإضافة ←
          </Button>
        </div>
      </div>
    </Modal>
  );
}
