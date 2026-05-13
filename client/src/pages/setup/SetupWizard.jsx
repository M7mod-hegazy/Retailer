import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import PageWrapper from "../../components/ui/PageWrapper";

const initialForm = {
  license: { signed_license: "", status: "unlicensed", message: "" },
  settings: {
    company_name: "",
    company_name_en: "",
    branch_name: "",
    branch_code: "",
    address: "",
    phone: "",
    tax_id: "",
    commercial_register: "",
    currency_code: "EGP",
    currency_symbol: "ج.م",
    decimal_places: 2,
    tax_rate: 0,
    tax_type: "none",
    invoice_prefix: "INV-",
    purchase_prefix: "PUR-",
    fiscal_year_start: "January",
    date_format: "dd/MM/yyyy",
    language: "ar",
  },
  admin: { full_name: "", username: "", password: "", confirm_password: "" },
  defaults: {
    default_warehouse_name: "",
    default_warehouse_code: "",
    default_treasury_name: "",
    default_treasury_code: "",
    default_treasury_balance: 0,
    walk_in_customer_name: "زبون نقدي",
    receipt_width: "80mm",
    auto_backup_enabled: false,
    auto_backup_path: "",
  },
};

const stepTitles = ["الحماية", "بيانات الشركة", "الإعدادات المالية", "حساب المدير", "الإعدادات الافتراضية"];

async function fetchHardwareIdWithRetry(maxAttempts = 8) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await api.get("/api/settings/hardware-id");
      const id = String(response.data?.data?.hardware_id || "").trim();
      if (id) return id;
      throw new Error("hardware id empty");
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 300));
      }
    }
  }
  throw lastError || new Error("hardware id unavailable");
}

function SectionCard({ title, hint, children }) {
  return (
    <section className="workspace-card workspace-card--inset">
      <div className="workspace-card__header">
        <div>
          <div className="workspace-card__title">{title}</div>
          {hint ? <div className="workspace-card__hint">{hint}</div> : null}
        </div>
      </div>
      <div className="workspace-card__body">{children}</div>
    </section>
  );
}

export default function SetupWizard() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState("idle");
  const [protectionMode, setProtectionMode] = useState("hybrid_license");
  const [hardwareId, setHardwareId] = useState("");
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [hardwareError, setHardwareError] = useState("");

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await api.get("/api/settings/setup-status");
        if (response.data.data.is_setup_complete) {
          navigate("/login", { replace: true });
          return;
        }
        const draft = response.data.data.draft;
        if (draft) setForm((current) => ({ ...current, ...draft }));
        const mode = String(response?.data?.data?.protection_mode || "hybrid_license");
        setProtectionMode(mode);
        if (mode === "windows_managed") {
          setForm((current) => ({
            ...current,
            license: { ...current.license, status: "activated", message: "Windows managed protection mode" },
          }));
          setLicenseStatus("success");
        }
        setStep(response.data.data.step || 1);
      } catch (_error) {
        const localDraft = window.localStorage.getItem("retailer.setupDraft");
        if (localDraft) setForm(JSON.parse(localDraft));
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    setHardwareLoading(true);
    fetchHardwareIdWithRetry()
      .then((id) => {
        if (!mounted) return;
        setHardwareId(id);
      })
      .catch(() => {
        if (!mounted) return;
        setHardwareError("تعذر قراءة معرف الجهاز حالياً.");
      })
      .finally(() => {
        if (!mounted) return;
        setHardwareLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (step === 1) return protectionMode === "windows_managed" || String(form.license.status) === "activated";
    if (step === 2) return Boolean(form.settings.company_name && form.settings.branch_name && form.settings.branch_code);
    if (step === 4) return Boolean(form.admin.full_name && form.admin.username && form.admin.password && form.admin.password === form.admin.confirm_password);
    if (step === 5) return Boolean(form.defaults.default_warehouse_name && form.defaults.default_treasury_name);
    return true;
  }, [form, step, protectionMode]);

  function updateSection(section, name, value) {
    setForm((current) => {
      const next = { ...current, [section]: { ...current[section], [name]: value } };
      window.localStorage.setItem("retailer.setupDraft", JSON.stringify(next));
      return next;
    });
  }

  async function persistProgress(nextStep) {
    await api.post("/api/settings/setup-progress", { step: nextStep, draft: form });
  }

  async function validateLicense() {
    if (protectionMode === "windows_managed") {
      setLicenseStatus("success");
      setMessage("لا يلزم تفعيل ترخيص في وضع windows_managed.");
      setForm((current) => ({ ...current, license: { ...current.license, status: "activated", message: "Windows managed protection mode" } }));
      return;
    }
    setLicenseStatus("checking");
    try {
      const response = await api.post("/api/license/activate", { signed_license: form.license.signed_license });
      const nextStatus = response.data.data.status === "activated" ? "success" : "error";
      setForm((current) => ({
        ...current,
        license: { ...current.license, status: response.data.data.status, message: response.data.data.message },
      }));
      setLicenseStatus(nextStatus);
      setMessage(nextStatus === "success" ? "تم تفعيل الترخيص ويمكنك المتابعة." : "تعذر التفعيل.");
    } catch (error) {
      setLicenseStatus("error");
      setMessage(error.response?.data?.message || "فشل التحقق من الترخيص");
    }
  }

  function copyHardwareId() {
    if (!hardwareId) return;
    navigator.clipboard.writeText(hardwareId);
    toast.success("تم نسخ معرف الجهاز");
  }

  async function retryHardwareId() {
    setHardwareLoading(true);
    setHardwareError("");
    try {
      const id = await fetchHardwareIdWithRetry();
      setHardwareId(id);
    } catch (_error) {
      setHardwareError("لا يمكن قراءة معرف الجهاز الآن.");
    } finally {
      setHardwareLoading(false);
    }
  }

  async function goNext() {
    if (!canSubmit) return;
    setMessage("");
    if (step < 5) {
      const nextStep = step + 1;
      await persistProgress(nextStep);
      setStep(nextStep);
      return;
    }
    try {
      await api.post("/api/settings/setup-complete", form);
      window.localStorage.removeItem("retailer.setupDraft");
      navigate("/login", { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || "فشل إكمال الإعداد");
    }
  }

  async function goBack() {
    if (step === 1) return;
    const nextStep = step - 1;
    await persistProgress(nextStep);
    setStep(nextStep);
  }

  if (loading) {
    return (
      <PageWrapper className="px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-[24px] border border-border-subtle bg-[var(--bg-surface)] px-6 py-5 text-text-secondary shadow-card">
          جاري تحميل الإعدادات...
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="workspace-card workspace-card--inset p-5">
          <div className="text-xs font-bold text-text-secondary">STEP {step}/5</div>
          <div className="mt-2 text-2xl font-black text-text-primary">{stepTitles[step - 1]}</div>
        </div>

        {step === 1 ? (
          <SectionCard
            title={protectionMode === "windows_managed" ? "حماية ويندوز" : "تفعيل الترخيص"}
            hint={protectionMode === "windows_managed" ? "التفعيل معطل لأن الحماية عبر ويندوز." : "ألصق الترخيص الموقع أو مفتاح ELH1"}
          >
            <div className="grid gap-4">
              {protectionMode === "windows_managed" ? (
                <div className="rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-text-primary">
                  وضع الحماية الحالي: <span className="font-black">windows_managed</span>. يمكن المتابعة مباشرة.
                </div>
              ) : (
                <Input
                  label="مفتاح الترخيص"
                  value={form.license.signed_license}
                  onChange={(event) => updateSection("license", "signed_license", event.target.value)}
                />
              )}

              <div className="rounded-[18px] border border-border-subtle bg-[var(--bg-surface)] p-4">
                <div className="mb-2 text-sm font-bold text-text-primary">معرف الجهاز</div>
                <code className="block rounded-[12px] border border-border-subtle px-3 py-2 text-sm">
                  {hardwareLoading ? "جاري القراءة..." : hardwareId || "غير متاح"}
                </code>
                {hardwareError ? <div className="mt-2 text-xs text-danger-DEFAULT">{hardwareError}</div> : null}
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={retryHardwareId}>
                    إعادة المحاولة
                  </Button>
                  <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={copyHardwareId} disabled={!hardwareId}>
                    <Copy className="h-4 w-4" />
                    نسخ
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={validateLicense}
                  disabled={(protectionMode !== "windows_managed" && !form.license.signed_license) || licenseStatus === "checking" || hardwareLoading}
                >
                  {protectionMode === "windows_managed" ? "تأكيد الحماية" : licenseStatus === "checking" ? "جاري التحقق..." : "تحقق من الترخيص"}
                </Button>
                <div className="text-sm text-text-secondary">{message || form.license.message}</div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {step === 2 ? (
          <SectionCard title="بيانات الشركة" hint="هذه البيانات تظهر في الفواتير والتقارير">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="اسم الشركة" required value={form.settings.company_name} onChange={(e) => updateSection("settings", "company_name", e.target.value)} />
              <Input label="اسم الفرع" required value={form.settings.branch_name} onChange={(e) => updateSection("settings", "branch_name", e.target.value)} />
              <Input label="كود الفرع" required value={form.settings.branch_code} onChange={(e) => updateSection("settings", "branch_code", e.target.value.toUpperCase())} />
              <Input label="الهاتف" value={form.settings.phone} onChange={(e) => updateSection("settings", "phone", e.target.value)} />
            </div>
          </SectionCard>
        ) : null}

        {step === 3 ? (
          <SectionCard title="الإعدادات المالية" hint="العملة والضريبة وتنسيق الفواتير">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="رمز العملة" value={form.settings.currency_code} onChange={(e) => updateSection("settings", "currency_code", e.target.value)} />
              <Input label="رمز الفاتورة" value={form.settings.invoice_prefix} onChange={(e) => updateSection("settings", "invoice_prefix", e.target.value)} />
              <Input label="نسبة الضريبة" type="number" value={form.settings.tax_rate} onChange={(e) => updateSection("settings", "tax_rate", Number(e.target.value || 0))} />
              <Input label="رمز المشتريات" value={form.settings.purchase_prefix} onChange={(e) => updateSection("settings", "purchase_prefix", e.target.value)} />
            </div>
          </SectionCard>
        ) : null}

        {step === 4 ? (
          <SectionCard title="حساب المدير" hint="سيتم إنشاء حساب المدير لأول تشغيل">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="الاسم الكامل" required value={form.admin.full_name} onChange={(e) => updateSection("admin", "full_name", e.target.value)} />
              <Input label="اسم المستخدم" required value={form.admin.username} onChange={(e) => updateSection("admin", "username", e.target.value)} />
              <Input label="كلمة المرور" type="password" required value={form.admin.password} onChange={(e) => updateSection("admin", "password", e.target.value)} />
              <Input label="تأكيد كلمة المرور" type="password" required value={form.admin.confirm_password} onChange={(e) => updateSection("admin", "confirm_password", e.target.value)} />
            </div>
          </SectionCard>
        ) : null}

        {step === 5 ? (
          <SectionCard title="الإعدادات الافتراضية" hint="الخزنة والمخزن والعميل النقدي">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="المخزن الافتراضي" required value={form.defaults.default_warehouse_name} onChange={(e) => updateSection("defaults", "default_warehouse_name", e.target.value)} />
              <Input label="الخزنة الافتراضية" required value={form.defaults.default_treasury_name} onChange={(e) => updateSection("defaults", "default_treasury_name", e.target.value)} />
              <Input label="رصيد الخزنة" type="number" value={form.defaults.default_treasury_balance} onChange={(e) => updateSection("defaults", "default_treasury_balance", Number(e.target.value || 0))} />
              <Input label="اسم عميل نقدي" value={form.defaults.walk_in_customer_name} onChange={(e) => updateSection("defaults", "walk_in_customer_name", e.target.value)} />
            </div>
          </SectionCard>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1}>
            السابق
          </Button>
          <Button type="button" onClick={goNext} disabled={!canSubmit}>
            {step === 5 ? "إكمال الإعداد" : "التالي"}
          </Button>
        </div>
      </div>
    </PageWrapper>
  );
}

