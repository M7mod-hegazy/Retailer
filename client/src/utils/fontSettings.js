const SCALE_MAP = {
  small: 13,
  normal: 15,
  medium: 16,
  large: 18,
  xlarge: 20,
  huge: 22,
  giant: 24,
};
const NUMBER_SCALE_MAP = {
  tiny: 0.5,
  small: 0.75,
  normal: 1,
  large: 1.125,
  xlarge: 1.25,
  huge: 1.5,
  giant: 2,
};

export function applyFontSettings(settings = {}) {
  const family = settings.font_family || "Noto Sans Arabic";
  const size = settings.font_size || "normal";
  const htmlPx = SCALE_MAP[size] || 15;

  const numberFamily = settings.number_font_family || "Outfit";
  const numberScale = settings.number_font_scale || "normal";
  const numberScaleVal = NUMBER_SCALE_MAP[numberScale] ?? 1;
  const numeralStyle = settings.numeral_style || "western";

  document.documentElement.style.setProperty("--font-body", `"${family}", "Noto Sans Arabic", "Tajawal", sans-serif`);
  document.documentElement.style.setProperty("--font-number", `"${numberFamily}", "Outfit", sans-serif`);
  document.documentElement.style.setProperty("--font-number-scale", String(numberScaleVal));
  document.documentElement.style.fontSize = `${htmlPx}px`;
  document.documentElement.dataset.numeralStyle = numeralStyle;
}

export { SCALE_MAP, NUMBER_SCALE_MAP };
