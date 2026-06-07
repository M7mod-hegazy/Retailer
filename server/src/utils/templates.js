// Resolve {variable} placeholders in a template body against a vars map.
// Unknown placeholders are left intact (so a missing var is visible, not blanked).
function resolveTemplate(body, vars = {}) {
  return String(body || "").replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : `{${k}}`
  );
}

module.exports = { resolveTemplate };
