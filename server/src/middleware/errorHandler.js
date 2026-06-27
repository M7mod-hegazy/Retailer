const { isForeignKeyError, describeForeignKeyViolations } = require("../utils/fkDiagnostics");

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  console.error("[ERROR]", status, err.message, err.stack);

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
