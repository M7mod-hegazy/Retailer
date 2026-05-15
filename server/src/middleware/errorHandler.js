function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  console.error("[ERROR]", status, err.message, err.stack);
  res.status(status).json({
    success: false,
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "حدث خطأ غير متوقع",
  });
}

module.exports = { errorHandler };
