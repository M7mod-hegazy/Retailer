const { userHasPagePermission } = require('../middleware/permission');

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Resolves tax for a sales document.
 * @param {object} db - better-sqlite3 db instance
 * @param {object} opts
 *   requestedEnabled - client-sent tax_enabled (undefined = default to true when feature on)
 *   requestedRate    - client-sent tax_rate (undefined = use settings rate)
 *   base             - the pre-tax total (lineNet - discount + increase)
 *   user             - req.user object (for permission check)
 * @returns {{ tax_enabled, tax_rate, tax_amount, tax_type, total }}
 */
function resolveTax(db, { requestedEnabled, requestedRate, base, user }) {
  const s = db.prepare("SELECT tax_enabled, tax_rate, tax_type FROM settings WHERE id = 1").get() || {};
  const featureOn = Number(s.tax_enabled ?? 0) === 1
    && (s.tax_type === 'inclusive' || s.tax_type === 'exclusive');

  const zeroResult = { tax_enabled: 0, tax_rate: 0, tax_amount: 0, tax_type: null, total: round2(base) };
  if (!featureOn) return zeroResult;

  const enabled = requestedEnabled === undefined ? true : Boolean(Number(requestedEnabled));
  if (!enabled) return zeroResult;

  const settingsRate = Number(s.tax_rate || 0);
  let rate = settingsRate;

  if (requestedRate !== undefined && requestedRate !== null) {
    const reqRate = Number(requestedRate);
    if (reqRate !== settingsRate) {
      if (!userHasPagePermission(user, 'pos', 'edit_tax_rate')) {
        const err = new Error('ليس لديك صلاحية لتعديل نسبة الضريبة');
        err.status = 403;
        throw err;
      }
    }
    rate = reqRate;
  }

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    const err = new Error('نسبة الضريبة غير صالحة (0-100)');
    err.status = 400;
    throw err;
  }

  const taxType = s.tax_type;
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
