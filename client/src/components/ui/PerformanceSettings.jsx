import React from "react";
import { usePerformanceStore, PRESETS } from "../../stores/performanceStore";
import {
  Monitor, Zap, BatteryLow, Wind, Eye, Sun, Table, Sidebar, ArrowLeftRight,
  Gauge, Image, Sparkles, MousePointer2, Activity, Sliders, Bell, Server,
} from "lucide-react";

const PRESET_META = {
  high: { icon: Zap, label: "عالٍ", desc: "الرسوم كاملة — تستغل الجهاز بالكامل", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  medium: { icon: Monitor, label: "متوسط", desc: "تقليل الحركة والمؤثرات — أداء متوازن", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  low: { icon: BatteryLow, label: "منخفض", desc: "إيقاف كل المؤثرات — أقصى أداء للأجهزة البطيئة", color: "text-text-secondary", bg: "bg-bg-overlay", border: "border-border-strong", dot: "bg-bg-overlay0" },
};

const GROUPS = [
  {
    title: "الرسوم المتحركة",
    icon: Wind,
    toggles: [
      { key: "animations", icon: Wind, label: "الرسوم المتحركة والانتقالات" },
      { key: "dataTableAnimations", icon: Table, label: "حركة صفوف الجداول" },
      { key: "sidebarAnimations", icon: Sidebar, label: "حركة القائمة الجانبية" },
      { key: "pageTransitions", icon: ArrowLeftRight, label: "انتقالات بين الصفحات" },
      { key: "reduceMotion", icon: Activity, label: "وضع الحركة المخفضة (Reduce Motion)" },
    ],
  },
  {
    title: "جودة العرض",
    icon: Image,
    toggles: [
      { key: "blur", icon: Eye, label: "تأثيرات التمويه (Backdrop Blur)" },
      { key: "shadows", icon: Sun, label: "الظلال (Box Shadows)" },
      { key: "particles", icon: Sparkles, label: "الجسيمات والكرات المتحركة", linkedKey: "loginOrbs" },
    ],
    extras: [
      {
        key: "imageQuality",
        label: "جودة الصور",
        icon: Image,
        options: [
          { value: "high", label: "عالية" },
          { value: "medium", label: "متوسطة" },
          { value: "low", label: "منخفضة" },
        ],
      },
    ],
  },
  {
    title: "أدوات متقدمة",
    icon: Sliders,
    toggles: [
      { key: "fpsCounter", icon: Activity, label: "عداد الإطارات (FPS)" },
      { key: "smoothScrolling", icon: MousePointer2, label: "التمرير السلس" },
      { key: "virtualizeLists", icon: Table, label: "التمرير الافتراضي للجداول الكبيرة" },
    ],
    extras: [
      {
        key: "targetFps",
        label: "معدل الإطارات المستهدف",
        icon: Gauge,
        options: [
          { value: 60, label: "60 إطار/ث" },
          { value: 30, label: "30 إطار/ث" },
          { value: -1, label: "غير محدود" },
        ],
      },
    ],
  },
  {
    title: "الشبكة والخادم",
    icon: Server,
    toggles: [],
    extras: [
      {
        key: "healthCheckInterval",
        label: "التحقق من صحة الخادم",
        icon: Activity,
        options: [
          { value: 5000, label: "كل 5 ثوان" },
          { value: 15000, label: "كل 15 ثانية" },
          { value: 30000, label: "كل 30 ثانية" },
          { value: 60000, label: "كل دقيقة" },
        ],
      },
      {
        key: "notificationPollInterval",
        label: "استعلام الإشعارات",
        icon: Bell,
        options: [
          { value: 60000, label: "كل دقيقة" },
          { value: 120000, label: "كل دقيقتين" },
          { value: 300000, label: "كل 5 دقائق" },
          { value: 600000, label: "كل 10 دقائق" },
          { value: 0, label: "معطل" },
        ],
      },
    ],
  },
];

function PresetCard({ presetKey, meta, active, onSelect }) {
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(presetKey)}
      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
        active
          ? `${meta.bg} ${meta.border} ${meta.color} shadow-sm scale-[1.02]`
          : "border-border-normal bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      <Icon className="h-6 w-6" />
      <div>
        <div className="text-sm font-black">{meta.label}</div>
        <div className="text-[10px] font-bold mt-0.5 opacity-70 leading-relaxed">{meta.desc}</div>
      </div>
      {active && (
        <div className="absolute -top-2 ltr:-right-2 rtl:-left-2 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
          <span className="text-[10px]">✓</span>
        </div>
      )}
    </button>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border-normal bg-bg-surface p-3 cursor-pointer hover:border-border-strong transition-colors select-none">
      <Icon className="h-4 w-4 text-text-muted shrink-0" />
      <span className="text-sm font-bold text-text-primary flex-1">{label}</span>
      <div
        role="checkbox"
        tabIndex={0}
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!checked); } }}
        className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer shrink-0 ${
          checked ? "bg-emerald-500" : "bg-border-strong"
        }`}
      >
        <div className={`absolute top-0.5 ltr:left-0.5 rtl:right-0.5 h-4 w-4 rounded-full bg-bg-surface shadow-sm transition-transform ${
          checked ? "ltr:translate-x-4 rtl:-translate-x-4" : "translate-x-0"
        }`} />
      </div>
    </label>
  );
}

function SelectRow({ icon: Icon, label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-normal bg-bg-surface p-3">
      <Icon className="h-4 w-4 text-text-muted shrink-0" />
      <span className="text-sm font-bold text-text-primary flex-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === "-1" ? -1 : Number(e.target.value) || e.target.value)}
        className="text-sm font-bold text-text-primary bg-bg-overlay border border-border-normal rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function PerformanceSettings({ compact }) {
  const preset = usePerformanceStore((s) => s.preset);
  const settings = usePerformanceStore((s) => s.settings);
  const setPreset = usePerformanceStore((s) => s.setPreset);
  const setSetting = usePerformanceStore((s) => s.setSetting);

  const modeLabel = preset !== "custom"
    ? PRESET_META[preset]?.label
    : "مخصص";
  const modeDot = preset !== "custom"
    ? PRESET_META[preset]?.dot
    : "bg-blue-500";

  return (
    <div className="space-y-6">
      {/* Preset selector */}
      <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-border-normal/70 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">مستوى الرسوميات</h3>
              <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                اختر مستوى جاهزًا أو خصص الإعدادات أدناه
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-border-normal bg-bg-surface px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${modeDot} motion-safe:animate-pulse`} />
            <span className="text-[11px] font-black text-text-secondary">{modeLabel}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(PRESET_META).map(([key, meta]) => (
            <PresetCard
              key={key}
              presetKey={key}
              meta={meta}
              active={preset === key}
              onSelect={setPreset}
            />
          ))}
        </div>
      </section>

      {/* Grouped settings */}
      <div className="space-y-4">
        {GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const hasCustomization = preset !== "custom" && (
            group.toggles.some((t) => settings[t.key] !== PRESETS[preset]?.[t.key]) ||
            group.extras?.some((e) => settings[e.key] !== PRESETS[preset]?.[e.key])
          );

          return (
            <div key={group.title} className="rounded-lg border border-border-normal bg-bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-bg-overlay border-b border-border-normal">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white shadow-sm">
                    <GroupIcon className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary">
                    {group.title}
                  </h4>
                </div>
                {hasCustomization && preset !== "custom" && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                    معدّل
                  </span>
                )}
              </div>
              <div className="p-3 space-y-2">
                {group.toggles.map(({ key, icon, label, linkedKey }) => (
                  <ToggleRow
                    key={key}
                    icon={icon}
                    label={label}
                    checked={settings[key]}
                    onChange={(v) => {
                      setSetting(key, v);
                      if (linkedKey) setSetting(linkedKey, v);
                    }}
                  />
                ))}
                {group.extras?.map((extra) => (
                  <SelectRow
                    key={extra.key}
                    icon={extra.icon}
                    label={extra.label}
                    value={settings[extra.key]}
                    options={extra.options}
                    onChange={(v) => setSetting(extra.key, v)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset hint when custom */}
      {preset === "custom" && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-[11px] font-bold text-blue-700 leading-relaxed">
          <Sliders className="h-3.5 w-3.5 shrink-0" />
          أنت في وضع الإعدادات المخصصة. يمكنك العودة إلى أي مستوى جاهز أعلاه لإعادة تعيين الإعدادات.
        </div>
      )}
    </div>
  );
}
