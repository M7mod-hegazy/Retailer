import React from "react";
import { usePerformanceStore, PRESETS } from "../../stores/performanceStore";
import {
  Monitor, Zap, BatteryLow, Wind, Eye, Sun, Table, Sidebar, ArrowLeftRight,
  Gauge, Image, Sparkles, MousePointer2, Activity, Sliders,
} from "lucide-react";

const PRESET_META = {
  high: { icon: Zap, label: "عالٍ", desc: "الرسوم كاملة — تستغل الجهاز بالكامل", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  medium: { icon: Monitor, label: "متوسط", desc: "تقليل الحركة والمؤثرات — أداء متوازن", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  low: { icon: BatteryLow, label: "منخفض", desc: "إيقاف كل المؤثرات — أقصى أداء للأجهزة البطيئة", color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-300", dot: "bg-slate-500" },
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
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
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
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-slate-300 transition-colors select-none">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-sm font-bold text-slate-700 flex-1">{label}</span>
      <div
        role="checkbox"
        tabIndex={0}
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!checked); } }}
        className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer shrink-0 ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <div className={`absolute top-0.5 ltr:left-0.5 rtl:right-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "ltr:translate-x-4 rtl:-translate-x-4" : "translate-x-0"
        }`} />
      </div>
    </label>
  );
}

function SelectRow({ icon: Icon, label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-sm font-bold text-slate-700 flex-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === "-1" ? -1 : Number(e.target.value) || e.target.value)}
        className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
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
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-l from-slate-50 to-white border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${modeDot} animate-pulse`} />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">
            وضع الأداء
          </span>
        </div>
        <span className="text-sm font-black text-slate-800">{modeLabel}</span>
      </div>

      {/* Preset selector */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-1">مستوى الرسوميات</h3>
        <p className="text-[11px] font-bold text-slate-400 mb-4">
          اختر مستوى جاهزًا أو خصص الإعدادات أدناه
        </p>
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
      </div>

      {/* Grouped settings */}
      <div className="space-y-4">
        {GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const hasCustomization = preset !== "custom" && (
            group.toggles.some((t) => settings[t.key] !== PRESETS[preset]?.[t.key]) ||
            group.extras?.some((e) => settings[e.key] !== PRESETS[preset]?.[e.key])
          );

          return (
            <div key={group.title} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 text-slate-500" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-600">
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
        <p className="text-[11px] font-bold text-slate-400 text-center leading-relaxed">
          أنت في وضع الإعدادات المخصصة. يمكنك العودة إلى أي مستوى جاهز أعلاه لإعادة تعيين الإعدادات.
        </p>
      )}
    </div>
  );
}
