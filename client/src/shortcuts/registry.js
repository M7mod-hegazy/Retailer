// Central keyboard-shortcut registry — the ONE place every shortcut and its factory
// default is declared. Behaviour (useShortcut), on-screen badges (ShortcutKbd), the
// settings rebinding tab and the help screen all read from here, so what the user sees
// always matches what actually fires.
//
// Each entry:
//   id          unique, dot-namespaced  e.g. "pos.save"
//   defaultKeys factory default chord, display form  e.g. ["Ctrl","Shift","P"] or ["F9"]
//   scope       conflict domain (see SCOPES). "global" is active everywhere.
//   label       Arabic label shown in settings/help
//   group       Arabic section title for grouping in the UI
//   editable    false → reference-only (shown in help, not rebindable, not dispatched)
//   allowInInput true → fires even while typing in an input/textarea/select

export const SCOPES = {
  GLOBAL: "global",
  POS: "pos",
  INVOICE: "invoice",
  DASHBOARD: "dashboard",
  ITEMS: "items",
  FORM: "form",
  QUOTATION: "quotation",
  QUOTATION_LIST: "quotation_list",
  EXPENSES: "expenses",
  REVENUES: "revenues",
  WITHDRAWALS: "withdrawals",
  DESIGNER: "designer",
};

export const SHORTCUTS = [
  // ── Global ────────────────────────────────────────────────────────────────
  // Ctrl+K is reserved EXCLUSIVELY for global search — nothing else may use it.
  { id: "global.search",   defaultKeys: ["Ctrl", "K"], scope: SCOPES.GLOBAL, group: "عام", label: "بحث شامل", allowInInput: true, pages: ["كل الصفحات"] },
  { id: "global.help",     defaultKeys: ["?"],         scope: SCOPES.GLOBAL, group: "عام", label: "عرض كل الاختصارات", pages: ["كل الصفحات"] },
  { id: "global.minimize", defaultKeys: ["Ctrl", "M"], scope: SCOPES.GLOBAL, group: "عام", label: "تصغير التطبيق", pages: ["كل الصفحات"] },
  { id: "global.quit",     defaultKeys: ["Ctrl", "Q"], scope: SCOPES.GLOBAL, group: "عام", label: "إغلاق التطبيق بالكامل", pages: ["كل الصفحات"] },
  { id: "global.assistant", defaultKeys: ["Ctrl", "/"], scope: SCOPES.GLOBAL, group: "عام", label: "فتح المساعد الذكي", allowInInput: true, pages: ["كل الصفحات"] },

  // ── Point of sale ─────────────────────────────────────────────────────────
  { id: "pos.focusCustomer", defaultKeys: ["F1"],  scope: SCOPES.POS, group: "نقطة البيع", label: "البحث عن عميل", pages: ["نقطة البيع"] },
  { id: "pos.focusItem",     defaultKeys: ["F2"],  scope: SCOPES.POS, group: "نقطة البيع", label: "البحث عن صنف", pages: ["نقطة البيع"] },
  { id: "pos.cashCheckout",  defaultKeys: ["F7"],  scope: SCOPES.POS, group: "نقطة البيع", label: "دفع نقدي / حساب الباقي", pages: ["نقطة البيع"] },
  { id: "pos.save",          defaultKeys: ["F9"],  scope: SCOPES.POS, group: "نقطة البيع", label: "حفظ الفاتورة", pages: ["نقطة البيع"] },
  { id: "pos.savePrint",     defaultKeys: ["F12"], scope: SCOPES.POS, group: "نقطة البيع", label: "حفظ وطباعة", pages: ["نقطة البيع"] },

  // ── Invoice detail ───────────────────────────────────────────────────────────
  { id: "invoice.print", defaultKeys: ["Ctrl", "P"], scope: SCOPES.INVOICE, group: "الفواتير", label: "طباعة الفاتورة", pages: ["تفاصيل الفاتورة"] },

  // ── Invoice-creation grids ──────────────────────────────────────────────────
  { id: "grid.editLast", defaultKeys: ["F8"], scope: SCOPES.INVOICE, group: "تحرير الجدول", label: "تحرير آخر صنف مضاف", pages: ["نقطة البيع", "فاتورة شراء", "أمر شراء", "مرتجع شراء", "مرتجع بيع", "عرض سعر"] },

  // ── Forms: save (shared across all invoice-type forms) ──────────────────────
  { id: "form.save", defaultKeys: ["Ctrl", "S"], scope: SCOPES.FORM, group: "النماذج", label: "حفظ النموذج", allowInInput: true, pages: ["فاتورة شراء", "أمر شراء", "مرتجع شراء", "مرتجع بيع"] },

  // ── Dashboard quick navigation ─────────────────────────────────────────────
  { id: "dashboard.gotoPos",       defaultKeys: ["F2"], scope: SCOPES.DASHBOARD, group: "لوحة التحكم", label: "فتح نقطة البيع", blockInInput: true, pages: ["لوحة التحكم"] },
  { id: "dashboard.gotoAnalytics", defaultKeys: ["F3"], scope: SCOPES.DASHBOARD, group: "لوحة التحكم", label: "فتح التحليلات", blockInInput: true, pages: ["لوحة التحكم"] },
  { id: "dashboard.gotoTreasury",  defaultKeys: ["F4"], scope: SCOPES.DASHBOARD, group: "لوحة التحكم", label: "فتح الخزينة اليومية", blockInInput: true, pages: ["لوحة التحكم"] },

  // ── Items ──────────────────────────────────────────────────────────────────
  { id: "items.calculator", defaultKeys: ["F2"],        scope: SCOPES.ITEMS, group: "الأصناف", label: "فتح الحاسبة للسعر", pages: ["الأصناف"] },
  { id: "items.new",        defaultKeys: ["Alt", "N"],  scope: SCOPES.ITEMS, group: "الأصناف", label: "إضافة صنف جديد", allowInInput: true, pages: ["الأصناف"] },
  { id: "items.search",     defaultKeys: ["/"],         scope: SCOPES.ITEMS, group: "الأصناف", label: "تركيز البحث", pages: ["الأصناف"] },

  // ── Quotation form / list ──────────────────────────────────────────────────
  { id: "quotation.save",  defaultKeys: ["Ctrl", "S"], scope: SCOPES.QUOTATION,      group: "عروض الأسعار", label: "حفظ عرض السعر", allowInInput: true, pages: ["عرض سعر"] },
  { id: "quotation.print", defaultKeys: ["Ctrl", "P"], scope: SCOPES.QUOTATION,      group: "عروض الأسعار", label: "طباعة", allowInInput: true, pages: ["عرض سعر"] },
  { id: "quotation.new",   defaultKeys: ["Ctrl", "N"], scope: SCOPES.QUOTATION_LIST, group: "عروض الأسعار", label: "عرض سعر جديد", allowInInput: true, pages: ["قائمة عروض الأسعار"] },

  // ── Print designer (handled locally; reference-only) ───────────────────────
  { id: "designer.undo",      defaultKeys: ["Ctrl", "Z"],          scope: SCOPES.DESIGNER, group: "مصمم الطباعة", label: "تراجع", editable: false, pages: ["مصمم الطباعة"] },
  { id: "designer.redo",      defaultKeys: ["Ctrl", "Shift", "Z"], scope: SCOPES.DESIGNER, group: "مصمم الطباعة", label: "إعادة", editable: false, pages: ["مصمم الطباعة"] },
  { id: "designer.duplicate", defaultKeys: ["Ctrl", "D"],          scope: SCOPES.DESIGNER, group: "مصمم الطباعة", label: "تكرار العنصر", editable: false, pages: ["مصمم الطباعة"] },
];

export const SHORTCUT_MAP = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s]));

// Plain-language description of what each shortcut does — shown in the settings/help UI.
export const SHORTCUT_DESC = {
  "global.search": "يفتح نافذة البحث الشامل (الصفحات، الأصناف، الفواتير، العملاء…) من أي مكان.",
  "global.help": "يعرض هذه القائمة بكل الاختصارات وأماكن عملها.",
  "global.minimize": "يُصغّر التطبيق إلى شريط المهام.",
  "global.quit": "يُغلق التطبيق بالكامل فوراً.",
  "global.assistant": "يفتح نافذة المساعد الذكي من أي مكان في البرنامج.",
  "pos.focusCustomer": "ينقل المؤشر إلى خانة البحث عن العميل في شاشة البيع.",
  "pos.focusItem": "ينقل المؤشر إلى خانة البحث عن الصنف / الباركود في شاشة البيع.",
  "pos.cashCheckout": "يفتح نافذة الدفع النقدي لإدخال المبلغ المستلم وحساب الباقي ثم الحفظ والطباعة (للدفع النقدي الكامل فقط).",
  "pos.save": "يحفظ الفاتورة الحالية دون طباعة.",
  "pos.savePrint": "يحفظ الفاتورة الحالية ويطبع الإيصال.",
  "invoice.print": "يفتح نافذة معاينة الطباعة للفاتورة الحالية.",
  "grid.editLast": "ينقل المؤشر إلى خانة كمية آخر صنف مضاف؛ والضغط مرة أخرى يعيدك إلى خانة البحث عن صنف. تنقّل بين الخلايا بالأسهم.",
  "form.save": "يحفظ النموذج الحالي (فاتورة الشراء/المرتجع…).",
  "dashboard.gotoPos": "ينتقل مباشرة إلى شاشة نقطة البيع من لوحة التحكم.",
  "dashboard.gotoAnalytics": "ينتقل مباشرة إلى صفحة التحليلات من لوحة التحكم.",
  "dashboard.gotoTreasury": "ينتقل مباشرة إلى الخزينة اليومية من لوحة التحكم.",
  "items.calculator": "يفتح حاسبة هامش الربح لخانة سعر البيع المحددة.",
  "items.new": "يفتح نافذة إضافة صنف جديد (بعد اختيار فئة).",
  "items.search": "ينقل المؤشر إلى خانة البحث في قائمة الأصناف.",
  "quotation.save": "يحفظ عرض السعر الحالي.",
  "quotation.print": "يطبع عرض السعر الحالي.",
  "quotation.new": "ينشئ عرض سعر جديد من قائمة العروض.",
  "designer.undo": "تراجع عن آخر تعديل في مصمم الطباعة.",
  "designer.redo": "إعادة آخر تعديل في مصمم الطباعة.",
  "designer.duplicate": "تكرار العنصر المحدد في مصمم الطباعة.",
};

const MOD_NAMES = ["ctrl", "control", "alt", "shift", "meta", "cmd", "command", "win"];

// Canonical comparable string for a keys array, e.g. ["Ctrl","Shift","P"] -> "ctrl+shift+p".
export function keysToChord(keys = []) {
  const lower = keys.map((k) => String(k).toLowerCase());
  const mods = [];
  if (lower.includes("ctrl") || lower.includes("control")) mods.push("ctrl");
  if (lower.includes("alt")) mods.push("alt");
  if (lower.includes("shift")) mods.push("shift");
  if (lower.includes("meta") || lower.includes("cmd") || lower.includes("command") || lower.includes("win")) mods.push("meta");
  const main = lower.find((k) => !MOD_NAMES.includes(k));
  return [...mods, main || ""].filter(Boolean).join("+");
}

// Canonical comparable string for a keyboard event.
export function eventToChord(e) {
  const key = e.key;
  const printable = key.length === 1;
  const alnum = printable && /[a-z0-9]/i.test(key);
  const mods = [];
  if (e.ctrlKey) mods.push("ctrl");
  if (e.altKey) mods.push("alt");
  // Drop Shift when it merely produced a punctuation char (e.g. "?"), keep it for letters/F-keys.
  if (e.shiftKey && (!printable || alnum)) mods.push("shift");
  if (e.metaKey) mods.push("meta");
  return [...mods, key.toLowerCase()].join("+");
}

// Human-readable label for a keys array, e.g. ["Ctrl","K"] -> "Ctrl + K".
export function formatKeys(keys = []) {
  return keys
    .map((k) => {
      const l = String(k).toLowerCase();
      if (l === "control") return "Ctrl";
      if (l === "meta" || l === "cmd" || l === "command" || l === "win") return "Win";
      if (l.length === 1) return k.toUpperCase();
      return k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join(" + ");
}

// Build a display-form keys array from a keyboard event (used by the rebind capture).
export function eventToKeys(e) {
  const key = e.key;
  const printable = key.length === 1;
  const alnum = printable && /[a-z0-9]/i.test(key);
  const out = [];
  if (e.ctrlKey) out.push("Ctrl");
  if (e.altKey) out.push("Alt");
  if (e.shiftKey && (!printable || alnum)) out.push("Shift");
  if (e.metaKey) out.push("Meta");
  let main = key;
  if (printable) main = key.toUpperCase();
  out.push(main);
  return out;
}

// Reserved chords we never let users steal (clipboard / browser critical).
const RESERVED = new Set(["ctrl+c", "ctrl+v", "ctrl+x", "ctrl+a", "ctrl+z", "ctrl+w", "ctrl+r", "ctrl+t", "meta+c", "meta+v", "meta+x"]);

export function isReservedChord(keys = []) {
  return RESERVED.has(keysToChord(keys));
}

export function isPureModifier(e) {
  return ["Control", "Shift", "Alt", "Meta"].includes(e.key);
}
