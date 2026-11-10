const { query, param } = require("express-validator");
const search = [
  query("limit").optional().isInt({ min: 1, max: 80 }).toInt(),
  query("pageSize").optional().isInt({ min: 1, max: 80 }).toInt(),
  query("page").optional().isInt({ min: 1, max: 100000 }).toInt(),
  query("offset").optional().isInt({ min: 0, max: 10000000 }).toInt(),
  query("q").optional().isString().isLength({ max: 200 }).trim(),
  query("category").optional().trim(),
  query("routeId").optional().trim(),
  query("lat").optional().isFloat({ min: -90, max: 90 }),
  query("lng").optional().isFloat({ min: -180, max: 180 }),
];
const id = [
  param("id").isInt({ min: 1 }).withMessage("id địa điểm không hợp lệ"),
];
module.exports = { search, id };
