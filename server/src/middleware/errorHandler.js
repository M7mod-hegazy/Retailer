const { isForeignKeyError, describeForeignKeyViolations } = require("../utils/fkDiagnostics");

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  // Expected auth/permission rejections are routine (expired token, missing
  // permission) — one concise line, no stack, or the console drowns in noise.
  if (status === 401 || status === 403) {
    console.warn("[AUTH]", status, req?.method, req?.originalUrl || req?.url, "-", err.message);
  } else {
    console.error("[ERROR]", status, err.message, err.stack);
  }

  const body = {
    success: false,
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "حدث خطأ غير متوقع",
  };

  // Turn opaque "FOREIGN KEY constraint failed" into a detailed, copyable report.
  if (isForeignKeyError(err)) {
    try {
      const { getDb } = require("../config/database");
      const { text, summary } = describeForeignKeyViolations(getDb());
      body.code = "SQLITE_CONSTRAINT_FOREIGNKEY";
      body.message = "فشل بسبب رابط مفتاح خارجي (مرجع لصف محذوف).";
      body.detail = text;
      body.fk_violations = summary;
    } catch (_) {
      /* diagnostics are best-effort */
    }
  }

  res.status(status).json(body);
}

module.exports = { errorHandler };
