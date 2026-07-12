import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

export function useSmsConnect(onSaved) {
  const [sms, setSms] = useState({ sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "", sms_body_template: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then(r => {
      const d = r.data?.data || {};
      const loaded = {
        sms_enabled: Boolean(d.sms_enabled),
        sms_api_url: d.sms_api_url || "",
        sms_api_key: d.sms_api_key || "",
        sms_sender: d.sms_sender || "",
        sms_body_template: d.sms_body_template || "",
      };
      setSms(loaded);
      setSaved(loaded.sms_enabled && Boolean(loaded.sms_api_url));
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);

  async function save(overrideSms) {
    const cfg = overrideSms || sms;
    if (cfg.sms_enabled && !cfg.sms_api_url.trim()) {
      toast.error("أدخل رابط بوابة الإرسال أولاً");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/settings", cfg);
      setSaved(cfg.sms_enabled && Boolean(cfg.sms_api_url.trim()));
      toast.success(cfg.sms_enabled ? "تم تفعيل خدمة SMS — جرّب الإرسال لرقمك" : "تم حفظ الإعدادات");
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      await api.post("/api/whatsapp/sms-test", { phone: testPhone.trim() });
      toast.success("وصلت؟ ✓ تم الإرسال عبر بوابة SMS بنجاح");
    } catch (e) { toast.error(e.response?.data?.message || "فشل إرسال الرسالة التجريبية"); }
    finally { setTesting(false); }
  }

  return { sms, setSms, loading, loadError, saving, saved, testPhone, setTestPhone, testing, save, sendTest };
}
