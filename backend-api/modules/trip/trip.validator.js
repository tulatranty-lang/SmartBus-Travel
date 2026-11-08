const { body, param } = require("express-validator");
const generate = [
  body("timeAvailable")
    .optional()
    .isIn(["nửa ngày", "1 ngày", "2 ngày", "3 ngày"]),
  body("title").optional().isString().isLength({ max: 200 }),
  body("interests").optional().isArray({ max: 10 }),
  body("interests.*").optional().isString().isLength({ max: 60 }),
  body("budget").optional().isIn(["low", "medium", "high"]),
  body("lat").optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body("lng").optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
];
const id = [
  param("id").isInt({ min: 1 }).withMessage("id lịch trình không hợp lệ"),
];
module.exports = { generate, id };
