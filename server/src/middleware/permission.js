const { getEffectivePermissions } = require("../constants/permissions");
const { getDb } = require("../config/database");

function requirePermission(flag) {
  return (req, _res, next) => {
    const permissions = getEffectivePermissions(req.user || {});
    const moduleWildcard = `${String(flag).split(":")[0]}:*`;
    if (permissions.includes("*") || permissions.includes(flag) || permissions.includes(moduleWildcard)) {
      return next();
    }
    const err = new Error("ليس لديك صلاحية للوصول إلى هذا المورد");
    err.status = 403;
    // The client's axios interceptor shows its permission toast only when it
    // sees this code — without it the action fails silently.
    err.code = "permission_denied";
    return next(err);
  };
}

function getUserPermissions(user) {
  if (user.page_permissions) {
    if (typeof user.page_permissions === "string") {
      try {
        return JSON.parse(user.page_permissions);
      } catch {
        return {};
      }
    }
    return user.page_permissions;
  }

  // Fall back to default permissions from settings table
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings_kv WHERE key = 'default_user_permissions'").get();
    if (row && row.value) {
      return JSON.parse(row.value);
    }
  } catch {
    // ignore DB or parse errors
  }
  return {};
}

function logPermissionDenial(userId, page, action, method, path, req) {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, resource, payload_json) VALUES (?, ?, ?, ?)"
    ).run(
      userId || null,
      "permission_denied",
      page,
      JSON.stringify({ action, method, path })
    );
  } catch {
    // non-fatal — don't let logging failure break the response
  }
}

function requirePagePermission(page, action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    // dev and admin have full access
    if (user.role === "dev" || user.role === "admin") return next();

    const perms = getUserPermissions(user);

    if (perms[page]?.includes(action)) return next();

    logPermissionDenial(user.id, page, action, req.method, req.path, req);

    return res.status(403).json({ error: "permission_denied", page, action });
  };
}

function userHasPagePermission(user, page, action) {
  if (!user) return false;
  if (user.role === "dev" || user.role === "admin") return true;
  const perms = getUserPermissions(user);
  return perms[page]?.includes(action) ?? false;
}

// Pass when the user holds the action on ANY of the listed pages. Used for
// shared resources (e.g. the WhatsApp engine is driven from both the settings
// page and the WhatsApp CRM page).
function requireAnyPagePermission(pages, action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (user.role === "dev" || user.role === "admin") return next();

    const perms = getUserPermissions(user);
    if (pages.some((page) => perms[page]?.includes(action))) return next();

    logPermissionDenial(user.id, pages[0], action, req.method, req.path, req);
    return res.status(403).json({ error: "permission_denied", page: pages[0], action });
  };
}

// Like requireAnyPagePermission but accepts a map of { page: action } so
// different pages can require different actions.
// e.g. requireAnyPageAction({ settings: "edit", whatsapp_crm: "manage_templates" })
function requireAnyPageAction(pageActionMap) {
  const entries = Object.entries(pageActionMap);
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (user.role === "dev" || user.role === "admin") return next();

    const perms = getUserPermissions(user);
    if (entries.some(([page, action]) => perms[page]?.includes(action))) return next();

    logPermissionDenial(user.id, entries[0][0], entries[0][1], req.method, req.path, req);
    return res.status(403).json({ error: "permission_denied", page: entries[0][0], action: entries[0][1] });
  };
}

module.exports = { requirePermission, requirePagePermission, requireAnyPagePermission, requireAnyPageAction, userHasPagePermission, getUserPermissions };
