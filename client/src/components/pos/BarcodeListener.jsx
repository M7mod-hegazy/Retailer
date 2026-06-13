import { useEffect } from "react";
import api from "../../services/api";
import { useSound } from "../../hooks/useSound";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { parseScaleBarcode } from "../../utils/scaleBarcode";

export default function BarcodeListener() {
  const posVoiceEnabled = useAppSettingsStore((s) => s.settings.pos_voice_enabled);
  const settings = useAppSettingsStore((s) => s.settings);
  const { playBeep } = useSound(posVoiceEnabled);

  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;

    async function handleKeydown(event) {
      const now = Date.now();
      if (now - lastKeyTime > 300) buffer = "";
      lastKeyTime = now;

      if (event.key === "Enter" && buffer.length >= 4) {
        event.preventDefault();
        const code = buffer.trim();
        buffer = "";

        try {
          // Try scale barcode first when feature is on
          if (settings.feature_scale_barcodes && code.length === 13) {
            const parsed = parseScaleBarcode(code, settings);
            if (parsed) {
              // Look up by PLU
              const plRes = await api.get(`/api/items/scale-plu/${encodeURIComponent(parsed.plu)}`).catch(() => null);
              const item = plRes?.data?.data;
              if (item) {
                const unitPrice = Number(item.sale_price || 0);
                const qty = parsed.qty ?? (parsed.price ? Math.round(parsed.price / unitPrice * 1000) / 1000 : 1);
                window.dispatchEvent(new CustomEvent("pos-barcode-scanned", {
                  detail: { ...item, quantity: qty, unit_price: parsed.price ? parsed.price / qty : unitPrice, _scale: true },
                }));
                playBeep();
                return;
              }
            }
          }

          // Normal barcode lookup
          const response = await api.get(`/api/items/barcode/${encodeURIComponent(code)}`);
          const item = response.data.data;
          const unit = response.data.unit || null;
          window.dispatchEvent(
            new CustomEvent("pos-barcode-scanned", {
              detail: unit ? { ...item, sold_unit_id: unit.id, sold_unit_name: unit.unit_name, sold_unit_factor: unit.factor, sold_unit_price: unit.sale_price ?? item.sale_price } : item,
            }),
          );
          playBeep();
        } catch (_error) {
          playBeep();
        }
      } else if (event.key.length === 1) {
        buffer += event.key;
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [playBeep, settings]);

  return null;
}
