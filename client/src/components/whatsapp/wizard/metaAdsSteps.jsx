import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Key, Users, FileText, CheckCircle, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import ChannelConnectWizard from "./ChannelConnectWizard";
import api from "../../../services/api";
import toast from "react-hot-toast";

const ACCENT = "#1877f2";

function ConceptScene() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: ACCENT }}><Globe className="h-5 w-5" /></div>
      <div className="h-px w-6 bg-border-normal" />
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary"><Users className="h-5 w-5" /></div>
        <span className="text-[9px] font-black text-text-muted">Custom Audiences</span>
      </div>
      <div className="h-px w-6 bg-border-normal" />
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary"><FileText className="h-5 w-5" /></div>
    </div>
  );
}

function SuccessScene() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
        <CheckCircle className="h-8 w-8 text-success-text" />
      </div>
      <p className="text-sm font-black text-text-primary">Meta مربوط بنجاح!</p>
    </div>
  );
}

export function useMetaAdsWizardSteps({ onSaved } = {}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState({
    access_token: "", app_id: "", app_secret: "", pixel_id: "", business_id: "", ad_account_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get("/api/meta-ads/config").then(r => {
      const d = r.data?.data;
      if (d) setConfig(prev => ({ ...prev, app_id: d.app_id || "", pixel_id: d.pixel_id || "", business_id: d.business_id || "", ad_account_id: d.ad_account_id || "" }));
    }).catch(() => {});
  }, []);

  async function saveConfig() {
    setSaving(true);
    try {
      await api.put("/api/meta-ads/config", config);
      setSaved(true);
      toast.success("تم حفظ إعدادات Meta");
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  async function testConn() {
    setTesting(true);
    try {
      const r = await api.post("/api/meta-ads/test-connection");
      setTestResult(r.data?.data);
      toast.success("الاتصال بنجاح!");
    } catch (e) { toast.error(e.response?.data?.message || "فشل الاتصال"); }
    finally { setTesting(false); }
  }

  const steps = [
    {
      key: "concept",
      illustration: <ConceptScene />,
      caption: t("wizard.meta.step1.caption"),
    },
    {
      key: "credentials",
      illustration: <Key className="h-10 w-10" style={{ color: ACCENT }} />,
      caption: t("wizard.meta.step2.caption"),
      content: (
        <div className="space-y-3">
          <div className="rounded-lg bg-info-bg border border-info-border px-4 py-3">
            <p className="text-xs font-bold text-info-text leading-relaxed">
              <strong>كيف تحصل على البيانات؟</strong><br />
              ١. اذهب إلى <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="underline">developers.facebook.com</a> وأنشئ تطبيق جديد<br />
              ٢. من الإعدادات، انسخ App ID و App Secret<br />
              ٣. من Business Manager، انسخ Business ID و Ad Account ID
            </p>
          </div>
          <div className="space-y-1 text-right">
            <label className="text-[10px] font-black text-text-secondary block">رمز الوصول للمستخدِم (Access Token)</label>
            <input type="password" dir="ltr" value={config.access_token === "null" || !config.access_token ? "" : config.access_token}
              onChange={e => setConfig(s => ({ ...s, access_token: e.target.value }))}
              placeholder="System User Access Token"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary block">معرّف التطبيق (App ID)</label>
              <input type="text" dir="ltr" value={config.app_id === "null" || !config.app_id ? "" : config.app_id}
                onChange={e => setConfig(s => ({ ...s, app_id: e.target.value }))}
                placeholder="App ID"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary block">سِر التطبيق (App Secret)</label>
              <input type="password" dir="ltr" value={config.app_secret === "null" || !config.app_secret ? "" : config.app_secret}
                onChange={e => setConfig(s => ({ ...s, app_secret: e.target.value }))}
                placeholder="App Secret"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary block">معرّف الأعمال (Business ID)</label>
              <input type="text" dir="ltr" value={config.business_id === "null" || !config.business_id ? "" : config.business_id}
                onChange={e => setConfig(s => ({ ...s, business_id: e.target.value }))}
                placeholder="Business Manager ID"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary block">معرّف الحساب الإعلاني (Ad Account ID)</label>
              <input type="text" dir="ltr" value={config.ad_account_id === "null" || !config.ad_account_id ? "" : config.ad_account_id}
                onChange={e => setConfig(s => ({ ...s, ad_account_id: e.target.value }))}
                placeholder="Ad Account ID (act_xxxxx)"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          <div className="space-y-1 text-right">
            <label className="text-[10px] font-black text-text-secondary block">معرّف البكسل (Pixel ID) - اختياري</label>
            <input type="text" dir="ltr" value={config.pixel_id === "null" || !config.pixel_id ? "" : config.pixel_id}
              onChange={e => setConfig(s => ({ ...s, pixel_id: e.target.value }))}
              placeholder="Pixel ID (اختياري)"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
          </div>
        </div>
      ),
      canGoNext: Boolean(config.access_token?.trim()),
    },
    {
      key: "enable-test",
      illustration: <CheckCircle className="h-10 w-10" style={{ color: ACCENT }} />,
      caption: t("wizard.meta.step3.caption"),
      content: (
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={saveConfig} disabled={saving || !config.access_token?.trim()}
              className="rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
            </button>
            {saved && (
              <button type="button" onClick={testConn} disabled={testing}
                className="rounded-lg border border-border-normal bg-bg-surface px-4 py-2 text-xs font-black text-text-secondary disabled:opacity-50 hover:bg-bg-base transition-all">
                {testing ? "جارٍ الفحص..." : "فحص الاتصال"}
              </button>
            )}
          </div>
          {testResult && (
            <div className="rounded-lg bg-success-bg border border-success-border px-4 py-3 text-center">
              <p className="text-sm font-black text-success-text">✓ متصل بـ {testResult.name}</p>
              <p className="text-[11px] font-bold text-text-muted mt-1">ID: {testResult.id}</p>
            </div>
          )}
        </div>
      ),
      canGoNext: saved,
    },
    { key: "success", illustration: <SuccessScene />, caption: t("wizard.meta.step4.caption") },
  ];

  return { steps };
}

export default function MetaAdsWizard({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { steps } = useMetaAdsWizardSteps({ onSaved });
  return (
    <ChannelConnectWizard
      onClose={onClose} icon={Globe} accent={ACCENT}
      title={t("wizard.meta.title")} subtitle={t("wizard.meta.subtitle")}
      steps={steps}
    />
  );
}
