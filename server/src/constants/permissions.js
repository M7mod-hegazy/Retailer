const ROLE_DEFAULTS = {
  admin: ["*"],
  manager: ["dashboard:view", "items:*", "customers:*", "invoices:*"],
  cashier: ["pos:*", "invoices:create", "customers:view"],
  viewer: ["dashboard:view", "reports:view"],
};

function getEffectivePermissions(user) {
  const defaults = ROLE_DEFAULTS[user.role] || [];
  const overrides = Array.isArray(user.permission_overrides) ? user.permission_overrides : [];
  return Array.from(new Set([...defaults, ...overrides]));
}

module.exports = { ROLE_DEFAULTS, getEffectivePermissions };
