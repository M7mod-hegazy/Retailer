import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

export function useEmailConnect(onSaved) {
  const [email, setEmail] = useState({
    email_enabled: false,
    email_provider: "smtp",
    email_host: "",
    email_port: 465,
    email_secure: true,
    email_user: "",
    email_pass: "",
    email_api_key: "",
    email_domain: "",
    email_from_name: "",
    email_from_email: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    api.get("/api/email/config")
      .then(r => {
        const d = r.data?.data || {};
        const loaded = {
          email_enabled: Boolean(d.email_enabled),
          email_provider: d.email_provider || "smtp",
          email_host: d.email_host || "",
          email_port: Number(d.email_port) || 465,
          email_secure: Boolean(d.email_secure ?? 1),
          email_user: d.email_user || "",
          email_pass: d.email_pass || "",
          email_api_key: d.email_api_key || "",
          email_domain: d.email_domain || "",
          email_from_name: d.email_from_name || "",
          email_from_email: d.email_from_email || "",
        };
        setEmail(loaded);
        setSaved(loaded.email_enabled && Boolean(loaded.email_from_email));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  async function save(overrideEmail) {
    const cfg = overrideEmail || email;
    if (cfg.email_enabled && !cfg.email_from_email.trim()) {
      toast.error("أدخل بريد المرسل أولاً");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/email/config", cfg);
      setSaved(cfg.email_enabled && Boolean(cfg.email_from_email.trim()));
      toast.success(cfg.email_enabled ? "تم تفعيل خدمة البريد — جرّب الإرسال" : "تم حفظ الإعدادات");
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTestingConnection(true);
    try {
      const r = await api.post("/api/email/test-connection");
      if (r.data?.success) toast.success("الاتصال ناجح ✓");
      else toast.error(r.data?.message || "فشل الاتصال");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الاتصال");
    } finally {
      setTestingConnection(false);
    }
  }

  async function sendTest() {
    if (!testEmail.trim()) return;
    setTesting(true);
    try {
      await api.post("/api/email/send-test", { email: testEmail.trim() });
      toast.success("وصلت؟ ✓ تم الإرسال عبر البريد بنجاح");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إرسال الرسالة التجريبية");
    } finally {
      setTesting(false);
    }
  }

  return {
    email, setEmail, loading, loadError, saving, saved,
    testEmail, setTestEmail, testing, testingConnection,
    save, testConnection, sendTest,
  };
}
