/**
 * printCalibration.js — per-printer thermal geometry, stored locally.
 *
 * A thermal printer's printable band (width + horizontal offset) and its
 * paper-size behavior are properties of the physical machine, not business
 * data, so calibration lives in localStorage next to the printer→size map
 * (see printService.js) instead of the settings table. Keys are
 * `<printerName>::<sizeKey>` (sizeKey = "58mm" | "80mm" | custom "NNmm").
 *
 * Entry shape:
 *   {
 *     printAreaWidthMm: number,  // 0 = use the default band for the paper
 *     shiftXMm: number,          // ± mm, slides the band inside the paper
 *     paperMode: "custom" | "driver", // how pageSize is passed to Electron print
 *     escposCut: boolean,        // send GS V cut after each job (raw channel)
 *     escposDrawer: boolean,     // send ESC p drawer kick after each job
 *   }
 */

const CALIBRATION_KEY = "retailer_print_calibration";

const ENTRY_DEFAULTS = {
  printAreaWidthMm: 0,
  shiftXMm: 0,
  paperMode: "custom",
  escposCut: false,
  escposDrawer: false,
};

export function getCalibrationMap() {
  try { return JSON.parse(localStorage.getItem(CALIBRATION_KEY) || "{}"); }
  catch { return {}; }
}

export function setCalibrationMap(map) {
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(map || {}));
}

function entryKey(printerName, sizeKey) {
  return `${printerName || ""}::${sizeKey || ""}`;
}

/** Resolve the calibration for a printer+size, always returning a full entry. */
export function resolveCalibration(printerName, sizeKey) {
  const map = getCalibrationMap();
  const entry = map[entryKey(printerName, sizeKey)] || {};
  return { ...ENTRY_DEFAULTS, ...entry };
}

/** Merge-and-save a calibration entry for a printer+size. */
export function saveCalibration(printerName, sizeKey, patch) {
  const map = getCalibrationMap();
  const key = entryKey(printerName, sizeKey);
  map[key] = { ...ENTRY_DEFAULTS, ...(map[key] || {}), ...(patch || {}) };
  setCalibrationMap(map);
  return map[key];
}

export function deleteCalibration(printerName, sizeKey) {
  const map = getCalibrationMap();
  delete map[entryKey(printerName, sizeKey)];
  setCalibrationMap(map);
}

/**
 * Inject a printer's calibration into a settings object for rendering, so the
 * preview and the printed band match the physical head. Returns a new object.
 */
export function withCalibration(settings, printerName, sizeKey) {
  if (!printerName) return settings;
  const cal = resolveCalibration(printerName, sizeKey);
  return {
    ...settings,
    print_area_width: cal.printAreaWidthMm,
    print_shift_x: cal.shiftXMm,
  };
}

/** Export everything device-local about printing (for terminal setup/backup). */
export function exportDeviceProfile(printerSizeMap) {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    printer_size_map: printerSizeMap || {},
    calibration: getCalibrationMap(),
  };
}

/** Import a device profile produced by exportDeviceProfile. Returns the map part. */
export function importDeviceProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("invalid_profile");
  if (profile.calibration && typeof profile.calibration === "object") {
    setCalibrationMap(profile.calibration);
  }
  return profile.printer_size_map && typeof profile.printer_size_map === "object"
    ? profile.printer_size_map
    : null;
}
