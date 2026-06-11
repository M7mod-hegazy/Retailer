import { useEffect } from "react";
import api from "../../services/api";
import { useSound } from "../../hooks/useSound";
import { useAppSettingsStore } from "../../stores/appSettingsStore";

export default function BarcodeListener() {
  const posVoiceEnabled = useAppSettingsStore((s) => s.settings.pos_voice_enabled);
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
        try {
          const response = await api.get(`/api/items/barcode/${buffer.trim()}`);
          window.dispatchEvent(
            new CustomEvent("pos-barcode-scanned", {
              detail: response.data.data,
            }),
          );
          playBeep();
        } catch (_error) {
          playBeep();
        }
        buffer = "";
      } else if (event.key.length === 1) {
        buffer += event.key;
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [playBeep]);

  return null;
}
