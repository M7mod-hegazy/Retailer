const { userHasPagePermission } = require('../middleware/permission');

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Resolves tax for a sales document.
 * @param {object} db - better-sqlite3 db instance
 * @param {object} opts
 *   requestedEnabled - client-sent tax_enabled. undefined OR null = "not specified"
 *                      (JSON cannot carry undefined, so null must mean the same thing).
 *   requestedRate    - client-sent tax_rate (undefined/null = not specified)
 *   base             - the pre-tax total (lineNet - discount + increase)
 *   user             - req.user object (for permission check)
 *   existing         - optional existing document row { tax_enabled, tax_rate, tax_type }
 *                      for edit/amend/duplicate: unspecified fields inherit from it,
 *                      inherited rates never trigger the permission check, and its
 *                      snapshot tax_type is honored over current settings.
 * @returns {{ tax_enabled, tax_rate, tax_amount, tax_type, total }}
 */
function resolveTax(db, { requestedEnabled, requestedRate, base, user, existing }) {
  const s = db.prepare("SELECT tax_enabled, tax_rate, tax_type FROM settings WHERE id = 1").get() || {};
  const featureOn = Number(s.tax_enabled ?? 0) === 1
    && (s.tax_type === 'inclusive' || s.tax_type === 'exclusive');

  const zeroResult = { tax_enabled: 0, tax_rate: 0, tax_amount: 0, tax_type: null, total: round2(base) };

  const hasExplicitEnabled = requestedEnabled !== undefined && requestedEnabled !== null;
  const hasExplicitRate = requestedRate !== undefined && requestedRate !== null;

  const existingEnabled = existing ? Number(existing.tax_enabled || 0) === 1 : false;
  const existingRate = existing && existing.tax_rate != null ? Number(existing.tax_rate) : null;
  const existingType = (existing && (existing.tax_type === 'inclusive' || existing.tax_type === 'exclusive'))
    ? existing.tax_type : null;

  const explicitlyDisabled = hasExplicitEnabled && !Number(requestedEnabled);

  if (!featureOn) {
    // Feature off: never ADD tax. But an edit of a document that already carries a
    // tax snapshot must not silently strip it — preserve the snapshot unless the
    // client explicitly disables it.
    if (existingEnabled && existingType && !explicitlyDisabled) {
      return applyRate(base, existingRate || 0, existingType);
    }
    return zeroResult;
  }

  // Default: ON for new documents; inherit for existing documents.
  const enabled = hasExplicitEnabled
    ? Boolean(Number(requestedEnabled))
    : (existing ? existingEnabled : true);
  if (!enabled) return zeroResult;

  const settingsRate = Number(s.tax_rate || 0);
  let rate = (existing && existingEnabled && existingRate !== null) ? existingRate : settingsRate;

  if (hasExplicitRate) {
    const reqRate = Number(requestedRate);
    // A rate matching current settings or the document's own snapshot is not a
    // "custom rate" — only genuinely new rates require the permission.
    const permissionFree = reqRate === settingsRate
      || (existingRate !== null && reqRate === existingRate);
    if (!permissionFree && !userHasPagePermission(user, 'pos', 'edit_tax_rate')) {
      const err = new Error('ليس لديك صلاحية لتعديل نسبة الضريبة');
      err.status = 403;
      throw err;
    }
    rate = reqRate;
  }

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    const err = new Error('نسبة الضريبة غير صالحة (0-100)');
    err.status = 400;
    throw err;
  }

  // Edits keep the document's snapshot type; new documents (and newly-enabled tax
  // on an old untaxed document) use current settings.
  const taxType = (existing && existingEnabled && existingType) ? existingType : s.tax_type;
  return applyRate(base, rate, taxType);
}

function applyRate(base, rate, taxType) {
  let tax_amount, total;
  if (taxType === 'exclusive') {
    tax_amount = round2(base * rate / 100);
    total = round2(base + tax_amount);
  } else {
    total = round2(base);
    tax_amount = round2(total * rate / (100 + rate));
  }
  return { tax_enabled: 1, tax_rate: rate, tax_amount, tax_type: taxType, total };
}

module.exports = { round2, resolveTax };
