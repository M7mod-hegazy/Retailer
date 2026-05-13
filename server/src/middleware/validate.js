function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const err = new Error("بيانات الطلب غير صحيحة");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      return next(err);
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validate };
