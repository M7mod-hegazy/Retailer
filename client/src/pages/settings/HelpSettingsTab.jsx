import React, { useEffect, useState } from "react";
import { useHelpStore } from "../../stores/helpStore";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Sparkles, Route, RotateCcw, ShieldOff, CheckCircle2,
  Monitor, LifeBuoy, Info, Copy, ExternalLink,
  Mail, Phone, Globe, Play, Search
} from 'lucide-react';
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";

const PAGE_TOURS = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { key: "dashboard", label: "لوحة التحكم" },
  { key: "pos", label: "نقطة البيع" },
  { key: "analytics", label: "التحليلات" },
  { key: "settings", label: "الإعدادات" },
  { key: "updates", label: "التحديثات" },
  { key: "history", label: "السجل" },
  { key: "notifications", label: "الإشعارات" },
  // ── Sales chain ───────────────────────────────────────────────────────────
  { key: "sales_hub", label: "فواتير المبيعات" },
  { key: "invoice_detail", label: "تفاصيل الفاتورة" },
  { key: "sales_returns", label: "مرتجعات المبيعات" },
  { key: "sales_return_form", label: "إنشاء مرتجع مبيعات" },
  { key: "sales_return_detail", label: "تفاصيل مرتجع المبيعات" },
  { key: "quotations", label: "عروض الأسعار" },
  // ── Purchases chain ───────────────────────────────────────────────────────
  { key: "purchases", label: "المشتريات" },
  { key: "purchase_form", label: "فاتورة مشتريات" },
  { key: "purchase_orders", label: "أوامر الشراء" },
  { key: "purchase_order_form", label: "أمر شراء" },
  { key: "purchase_returns", label: "مرتجعات المشتريات" },
  { key: "purchase_return_form", label: "إنشاء مرتجع مشتريات" },
  { key: "purchase_return_detail", label: "تفاصيل مرتجع المشتريات" },
  // ── Payments ──────────────────────────────────────────────────────────────
  { key: "payments", label: "المدفوعات" },
  { key: "payment_form", label: "حركة مالية جديدة" },
  { key: "payment_methods", label: "طرق الدفع" },
  { key: "cheques", label: "الشيكات" },
  { key: "bank_operations", label: "عمليات بنكية" },
  // ── Treasury ──────────────────────────────────────────────────────────────
  { key: "daily_treasury", label: "الخزينة اليومية" },
  { key: "cashflow_ledger", label: "كشف الحركات" },
  // ── Expenses / Revenues ───────────────────────────────────────────────────
  { key: "expenses", label: "المصروفات" },
  { key: "revenues", label: "الإيرادات" },
  { key: "withdrawals", label: "السحوبات" },
  // ── Accounts ──────────────────────────────────────────────────────────────
  { key: "customer_accounts", label: "حسابات العملاء" },
  { key: "customer_profile", label: "ملف العميل" },
  { key: "supplier_accounts", label: "حسابات الموردين" },
  { key: "supplier_profile", label: "ملف المورد" },
  { key: "account_import", label: "استيراد الحسابات" },
  // ── Items / Catalog ───────────────────────────────────────────────────────
  { key: "items", label: "الأصناف" },
  { key: "item_import", label: "استيراد الأصناف" },
  { key: "item_operations", label: "عمليات الأصناف" },
  { key: "categories", label: "التصنيفات" },
  { key: "units", label: "الوحدات" },
  { key: "bulk_price_update", label: "تحديث الأسعار" },
  { key: "promotions", label: "العروض" },
  // ── Stock ─────────────────────────────────────────────────────────────────
  { key: "stock", label: "المخزون" },
  { key: "stock_transfer", label: "تحويل مخزني" },
  { key: "stock_transfer_form", label: "إنشاء تحويل مخزني" },
  { key: "physical_count", label: "الجرد الفعلي" },
  { key: "serial_lookup", label: "البحث بالسيريال" },
  // ── Operations ────────────────────────────────────────────────────────────
  { key: "branch_transfer", label: "نقل بين الفروع" },
  { key: "branch_transfer_form", label: "إنشاء نقل بين الفروع" },
  { key: "employee_adjustments", label: "تسويات الموظفين" },
  // ── Definitions ───────────────────────────────────────────────────────────
  { key: "customers", label: "العملاء" },
  { key: "suppliers", label: "الموردين" },
  { key: "branches", label: "الفروع" },
  { key: "warehouses", label: "المخازن" },
  { key: "banks", label: "البنوك" },
  { key: "financial_categories", label: "الفئات المالية" },
  { key: "expense_categories", label: "أقسام المصروفات" },
  { key: "revenue_categories", label: "تصنيفات الإيرادات" },
  { key: "users", label: "المستخدمين" },
  { key: "employees", label: "الموظفين" },
  // ── Reports ───────────────────────────────────────────────────────────────
  { key: "reports", label: "التقارير" },
  { key: "source_workspace", label: "تقرير مخصص" },
  { key: "expiry_report", label: "تقرير انتهاء الصلاحية" },
  { key: "owner_statement", label: "كشف المالك" },
  // ── Sync / Feature modules ────────────────────────────────────────────────
  { key: "sync_page", label: "المزامنة" },
  { key: "sync_config", label: "ربط المتجر" },
  { key: "repair_orders", label: "أوامر الصيانة" },
  { key: "table_map", label: "خريطة الطاولات" },
  { key: "modifier_groups", label: "الإضافات" },
  { key: "gold_rates", label: "أسعار الذهب" },
  { key: "whatsapp_crm", label: "واتساب CRM" },
  // ── Workspace pages ─────────────────────────────────────────────────────
  { key: "finance_workspace", label: "مساحة الماليات" },
  { key: "purchases_workspace", label: "مساحة المشتريات" },
  { key: "inventory_workspace", label: "مساحة المخزون" },
  { key: "operations_workspace", label: "مساحة العمليات" },
  { key: "catalog_workspace", label: "مساحة الأصناف" },
  { key: "parties_workspace", label: "مساحة العملاء والموردين" },
  { key: "resources_workspace", label: "مساحة الموارد" },
  { key: "team_workspace", label: "مساحة الفريق" },
];

export function HelpSettingsTab() {
  const lang = document.documentElement.lang || "ar";
  const isRTL = lang === "ar";
  const {
    touredPages, toursDisabledGlobally, tooltipsDisabledGlobally,
    disableAllTours, enableAllTours, disableAllTooltips, enableAllTooltips,
    resetPageTour, resetAllTours
  } = useHelpStore();
  const [systemInfo, setSystemInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.get("/api/help/info").then((res) => {
      if (res.data?.success) setSystemInfo(res.data.data);
    }).catch(() => {});
  }, []);

  const copyInfo = () => {
    if (!systemInfo) return;
    const text = `م/ محمود حجازي — الحجازي Retailer\nVersion: ${systemInfo.version}\nUsers: ${systemInfo.user_count}\nCompleted Tours: ${systemInfo.completed_tours}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success(isRTL ? "تم نسخ المعلومات" : "Info copied");
    });
  };

  const filteredTours = searchQuery
    ? PAGE_TOURS.filter(t => t.label.includes(searchQuery))
    : PAGE_TOURS;

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* ═══════════════ 1. ONBOARDING & GUIDANCE ═══════════════ */}
      <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
        <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Route className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              {isRTL ? "شروحات البرنامج والمساعد" : "Onboarding & Guidance"}
            </h3>
            <p className="text-[11px] font-bold text-text-muted leading-relaxed">
              {isRTL ? "لو عايز البرنامج يشرحلك الصفحات أول مرة تفتحها، أو يوريك تلميحات صغيرة." : "Manage page tours and smart tooltips"}
            </p>
          </div>
        </div>

        {/* Tours global toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg border border-border-normal bg-bg-surface shadow-sm mb-4">
          <div className="flex gap-4 items-start">
            <div className="mt-0.5 flex shrink-0 h-10 w-10 items-center justify-center rounded-sm bg-blue-50 text-blue-600">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-text-primary">
                {isRTL ? "الجولات التعريفية (شرح الصفحات)" : "Page Tours"}
              </div>
              <p className="mt-1 text-[11px] font-bold leading-relaxed text-text-secondary max-w-[400px]">
                {isRTL
                  ? "البرنامج هيمشي معاك خطوة بخطوة ويشرحلك كل زراير الصفحة لو دي أول مرة تفتحها."
                  : "When enabled, shows step-by-step walkthroughs on first page visit"}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className={`inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-black uppercase tracking-widest ${toursDisabledGlobally ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
              {toursDisabledGlobally
                ? (isRTL ? "معطل" : "Disabled")
                : (isRTL ? "مفعل" : "Enabled")}
            </span>
            {toursDisabledGlobally ? (
              <button onClick={enableAllTours} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-normal bg-bg-surface px-3 text-[11px] font-black text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 hover:border-emerald-200 active:scale-95">
                <Play size={12} />
                {isRTL ? "شغّل الشروحات" : "Enable"}
              </button>
            ) : (
              <button onClick={disableAllTours} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-normal bg-bg-surface px-3 text-[11px] font-black text-rose-600 shadow-sm transition-all hover:bg-rose-50 hover:border-rose-200 active:scale-95">
                <ShieldOff size={12} />
                {isRTL ? "وقّف الشروحات" : "Disable"}
              </button>
            )}
          </div>
        </div>

        {/* Tooltips global toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg border border-border-normal bg-bg-surface shadow-sm mb-4">
          <div className="flex gap-4 items-start">
            <div className="mt-0.5 flex shrink-0 h-10 w-10 items-center justify-center rounded-sm bg-violet-50 text-violet-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-text-primary">
                {isRTL ? "تلميحات المساعدة" : "Smart Tooltips"}
              </div>
              <p className="mt-1 text-[11px] font-bold leading-relaxed text-text-secondary max-w-[400px]">
                {isRTL
                  ? "شرح صغير بيظهر جمب بعض الخانات عشان يفهمك بتعمل إيه بالظبط."
                  : "Quick contextual hints near complex fields"}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className={`inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-black uppercase tracking-widest ${tooltipsDisabledGlobally ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
              {tooltipsDisabledGlobally
                ? (isRTL ? "معطل" : "Disabled")
                : (isRTL ? "مفعل" : "Enabled")}
            </span>
            {tooltipsDisabledGlobally ? (
              <button onClick={enableAllTooltips} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-normal bg-bg-surface px-3 text-[11px] font-black text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 hover:border-emerald-200 active:scale-95">
                <Play size={12} />
                {isRTL ? "تفعيل التلميحات" : "Enable"}
              </button>
            ) : (
              <button onClick={disableAllTooltips} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-normal bg-bg-surface px-3 text-[11px] font-black text-rose-600 shadow-sm transition-all hover:bg-rose-50 hover:border-rose-200 active:scale-95">
                <ShieldOff size={12} />
                {isRTL ? "تعطيل التلميحات" : "Disable"}
              </button>
            )}
          </div>
        </div>

        {/* Per-page tour list */}
        <div className="rounded-lg border border-border-normal bg-bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary">
              {isRTL ? "النتيجة: إيه اللي اتشرح وإيه لأ؟" : "Tour Status Per Page"}
            </h4>
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 right-3 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRTL ? "ابحث عن صفحة..." : "Search page..."}
                className="h-8 w-48 rounded-md border border-border-normal bg-bg-input pr-8 pl-3 text-[11px] font-bold text-text-primary outline-none focus:bg-bg-surface focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border-t border-border-subtle">
            {filteredTours.length === 0 ? (
              <div className="p-5 text-center text-[11px] font-bold text-text-muted">
                {isRTL ? "لا توجد نتائج" : "No results"}
              </div>
            ) : (
              filteredTours.map((page) => {
                const completed = touredPages[page.key];
                return (
                  <div key={page.key} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-bg-overlay border-b border-border-subtle last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-border-strong" />
                      )}
                      <span className="text-sm font-bold text-text-primary truncate">{page.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await resetPageTour(page.key);
                        toast.success(isRTL ? `تم إعادة تعيين شرح ${page.label}` : `"${page.label}" tour reset`);
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-sm border border-transparent px-2 py-1 text-[11px] font-black text-text-muted hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all"
                    >
                      <RotateCcw size={10} />
                      {isRTL ? "إعادة" : "Reset"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-bg-overlay border-t border-border-subtle">
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-border-normal overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${PAGE_TOURS.length ? (Object.keys(touredPages).length / PAGE_TOURS.length) * 100 : 0}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-black text-text-secondary">
                {isRTL
                  ? `${Object.keys(touredPages).length} / ${PAGE_TOURS.length} مكتملة`
                  : `${Object.keys(touredPages).length} / ${PAGE_TOURS.length} completed`}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await resetAllTours();
                toast.success(isRTL ? "تم إعادة تعيين جميع الشروحات" : "All tours reset");
              }}
              className="shrink-0 flex items-center gap-1.5 rounded-sm border border-amber-200 bg-bg-surface px-3 py-1.5 text-[11px] font-black text-amber-700 shadow-sm transition-all hover:bg-amber-50 active:scale-95"
            >
              <RotateCcw size={12} />
              {isRTL ? "إعادة تعيين الكل" : "Reset All"}
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════ 2. SYSTEM INFORMATION ═══════════════ */}
      <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
        <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              {isRTL ? "تفاصيل نسختك" : "System Information"}
            </h3>
            <p className="text-[11px] font-bold text-text-muted leading-relaxed">
              {isRTL ? "بيانات النسخة دي بالظبط.. بتحتاجها لو بتكلم الدعم الفني." : "Technical data for the current build — for support"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border-normal bg-bg-surface shadow-sm p-5">
          {systemInfo ? (
            <div className="space-y-3">
              {[
                { label: isRTL ? "إصدار النظام" : "App Version", value: `v${systemInfo.version}` },
                { label: isRTL ? "البيئة" : "Environment", value: systemInfo.node_env },
                { label: isRTL ? "عدد المستخدمين" : "Users", value: systemInfo.user_count },
                { label: isRTL ? "الشروحات المكتملة" : "Completed Tours", value: systemInfo.completed_tours },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-1.5 border-b border-border-subtle last:border-0">
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary">{item.label}</span>
                  <span className="text-sm font-bold text-text-primary">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted">
              <Info className="h-3.5 w-3.5" />
              {isRTL ? "جاري تحميل معلومات النظام..." : "Loading system info..."}
            </div>
          )}
          <button
            type="button"
            onClick={copyInfo}
            disabled={!systemInfo}
            className="mt-4 flex items-center gap-2 rounded-sm border border-border-normal bg-bg-surface px-4 py-2 text-[11px] font-black text-text-secondary shadow-sm transition-all hover:bg-bg-overlay active:scale-95 disabled:opacity-50"
          >
            <Copy size={12} />
            {isRTL ? "نسخ معلومات النظام للحافظة" : "Copy System Info"}
          </button>
        </div>
      </section>

      {/* ═══════════════ 3. SUPPORT ═══════════════ */}
      <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
        <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <LifeBuoy className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              {isRTL ? "المبرمج والدعم" : "Developer"}
            </h3>
            <p className="text-[11px] font-bold text-text-muted leading-relaxed">
              {isRTL ? "لو في مشكلة وقفت معاك أو عايز تسأل على حاجة، كلمني." : "Contact the developer directly for support"}
            </p>
          </div>
        </div>

        {/* Dev identity card */}
        <div className="rounded-lg border border-border-normal bg-gradient-to-br from-slate-50 to-white shadow-sm p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg">
              <span className="text-xl font-black tracking-tight">مح</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-black text-text-primary">م/ محمود حجازي</h4>
              <p className="text-[12px] font-bold text-emerald-600 mt-0.5 tracking-wide">
                {isRTL ? "مطور ومصمم النظام" : "Full-Stack Developer & Designer"}
              </p>
              <p className="text-[11px] font-bold text-text-muted leading-relaxed mt-2 max-w-xl">
                {isRTL
                  ? "أنا هنا لمساعدتك في أي استفسار أو مشكلة تواجهها أثناء استخدام النظام. لا تتردد في التواصل معي عبر أي من القنوات أدناه."
                  : "I'm here to help with any questions or issues you encounter while using the system. Feel free to reach out through any channel below."}
              </p>
            </div>
          </div>
        </div>

        {/* Contact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

          <div className="group flex items-center gap-4 rounded-lg border border-border-normal bg-bg-surface p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-all group-hover:bg-emerald-600 group-hover:text-white group-hover:scale-110">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-widest text-text-muted">{isRTL ? "البريد الإلكتروني" : "Email"}</div>
              <div className="text-sm font-bold text-text-primary mt-0.5 truncate">medo.hagaze33@gmail.com</div>
              <div className="text-[11px] font-bold text-text-muted mt-0.5">{isRTL ? "أرسل لي بريداً وسأرد في أقرب وقت" : "Send me an email and I'll reply ASAP"}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText("medo.hagaze33@gmail.com"); toast.success(isRTL ? "تم نسخ البريد" : "Email copied"); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 active:scale-90"
              title={isRTL ? "نسخ البريد" : "Copy email"}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href="mailto:medo.hagaze33@gmail.com"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 active:scale-90"
              title={isRTL ? "فتح البريد" : "Open email"}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="group flex items-center gap-4 rounded-lg border border-border-normal bg-bg-surface p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-all group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-widest text-text-muted">{isRTL ? "الهاتف" : "Phone"}</div>
              <div className="text-sm font-bold text-text-primary mt-0.5" dir="ltr">+20 103 244 0775</div>
              <div className="text-[11px] font-bold text-text-muted mt-0.5">{isRTL ? "مكالمة أو واتساب" : "Call or WhatsApp"}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText("01032440775"); toast.success(isRTL ? "تم نسخ الرقم" : "Phone copied"); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 active:scale-90"
              title={isRTL ? "نسخ الرقم" : "Copy phone"}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href="tel:+201032440775"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 active:scale-90"
              title={isRTL ? "اتصال" : "Call"}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="group flex items-center gap-4 rounded-lg border border-border-normal bg-bg-surface p-4 shadow-sm transition-all hover:border-green-500 hover:shadow-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600 transition-all group-hover:bg-green-600 group-hover:text-white group-hover:scale-110">
              <WhatsAppIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-widest text-text-muted">WhatsApp</div>
              <div className="text-sm font-bold text-text-primary mt-0.5 truncate">+20 103 244 0775</div>
              <div className="text-[11px] font-bold text-text-muted mt-0.5">{isRTL ? "تواصل فوري — رد سريع" : "Instant chat — fast reply"}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText("01032440775"); toast.success(isRTL ? "تم نسخ الرقم" : "Phone copied"); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-green-50 hover:text-green-600 hover:border-green-200 active:scale-90"
              title={isRTL ? "نسخ الرقم" : "Copy phone"}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href="https://wa.me/201032440775"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-green-50 hover:text-green-600 hover:border-green-200 active:scale-90"
              title={isRTL ? "فتح واتساب" : "Open WhatsApp"}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="group flex items-center gap-4 rounded-lg border border-border-normal bg-bg-surface p-4 shadow-sm transition-all hover:border-violet-300 hover:shadow-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition-all group-hover:bg-violet-600 group-hover:text-white group-hover:scale-110">
              <Globe className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-widest text-text-muted">{isRTL ? "الموقع الشخصي" : "Website"}</div>
              <div className="text-sm font-bold text-text-primary mt-0.5 truncate">m7modhegazy.vercel.app</div>
              <div className="text-[11px] font-bold text-text-muted mt-0.5">{isRTL ? "أعمالي ومشاريعي" : "Portfolio & projects"}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText("https://m7modhegazy.vercel.app/"); toast.success(isRTL ? "تم نسخ الرابط" : "Link copied"); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 active:scale-90"
              title={isRTL ? "نسخ الرابط" : "Copy link"}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href="https://m7modhegazy.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 active:scale-90"
              title={isRTL ? "فتح الموقع" : "Open site"}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="group flex items-center gap-4 rounded-lg border border-border-normal bg-bg-surface p-4 shadow-sm transition-all hover:border-sky-500 hover:shadow-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition-all group-hover:bg-[#0866FF] group-hover:text-white group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-widest text-text-muted">Facebook</div>
              <div className="text-sm font-bold text-text-primary mt-0.5 truncate">@medo.hagaze</div>
              <div className="text-[11px] font-bold text-text-muted mt-0.5">{isRTL ? "أخبار وتحديثات" : "News & updates"}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText("https://web.facebook.com/medo.hagaze/"); toast.success(isRTL ? "تم نسخ الرابط" : "Link copied"); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 active:scale-90"
              title={isRTL ? "نسخ الرابط" : "Copy link"}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href="https://web.facebook.com/medo.hagaze/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-normal text-text-muted transition-all hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 active:scale-90"
              title={isRTL ? "فتح فيسبوك" : "Open Facebook"}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

        </div>

      </section>

    </div>
  );
}
