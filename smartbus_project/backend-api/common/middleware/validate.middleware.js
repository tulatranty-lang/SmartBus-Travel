const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({ success: false, message: 'Dữ liệu đầu vào không hợp lệ', errorCode: 'VALIDATION_ERROR', errors: errors.array() });
}

module.exports = validate;
