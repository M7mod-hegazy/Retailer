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

let _styleEl = null;

function getOrCreateStyle() {
  if (!_styleEl) {
    _styleEl = document.getElementById("__fontSettings");
    if (!_styleEl) {
      _styleEl = document.createElement("style");
      _styleEl.id = "__fontSettings";
      document.head.appendChild(_styleEl);
    }
  }
  return _styleEl;
}

export function applyFontSettings(settings = {}) {
  const family = settings.font_family || "Noto Sans Arabic";
  const size = settings.font_size || "normal";
  const htmlPx = SCALE_MAP[size] || 15;

  const numberFamily = settings.number_font_family || "Outfit";
  const numberScale = settings.number_font_scale || "normal";
  const numberScaleVal = NUMBER_SCALE_MAP[numberScale] ?? 1;
  const numeralStyle = settings.numeral_style || "western";
  const fontWeight = settings.font_weight || 700;
  const numberWeight = settings.number_font_weight || 700;

  // CSS variables — still used by number-fmt-* classes + Tailwind font-number
  document.documentElement.style.setProperty("--font-body", `"${family}", "Noto Sans Arabic", "Tajawal", sans-serif`);
  document.documentElement.style.setProperty("--font-number", `"${numberFamily}", "Outfit", sans-serif`);
  document.documentElement.style.setProperty("--font-number-scale", String(numberScaleVal));
  document.documentElement.style.setProperty("--font-weight", String(fontWeight));
  document.documentElement.style.setProperty("--font-number-weight-primary", String(numberWeight));
  document.documentElement.style.setProperty("--font-number-weight-secondary", String(numberWeight));
  document.documentElement.style.fontSize = `${htmlPx}px`;
  document.documentElement.dataset.numeralStyle = numeralStyle;

  // Injected <style> block — force-apply number font to ALL number containers
  const el = getOrCreateStyle();
  el.textContent = `
    html { font-size: ${htmlPx}px !important; }
    .number, .currency, .quantity, .invoice-number,
    .number-fmt, .number-fmt-primary, .number-fmt-secondary,
    .kpi-card__value {
      font-family: "${numberFamily}", "Outfit", sans-serif !important;
      font-size: calc(1em * ${numberScaleVal}) !important;
      font-weight: ${numberWeight} !important;
    }
    td, th,
    [class*="amount"], [class*="price"], [class*="total"],
    [class*="kpi"], [class*="stat"],
    .pos-total, .cart-total, .grand-total {
      font-family: "${numberFamily}", "Outfit", sans-serif !important;
      font-weight: ${numberWeight} !important;
    }
  `;
}

export { SCALE_MAP, NUMBER_SCALE_MAP };
