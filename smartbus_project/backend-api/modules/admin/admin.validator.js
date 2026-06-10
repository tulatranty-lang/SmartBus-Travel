const { body, param } = require('express-validator');

const id = [param('id').isInt({ min: 1 }).withMessage('id không hợp lệ')];

const placeBase = [
  body('name').trim().isLength({ min: 2 }).withMessage('Tên địa điểm là bắt buộc'),
  body('provinceCode').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 30 }).withMessage('Tỉnh/khu vực không hợp lệ'),
  body('province').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 120 }).withMessage('Tỉnh/khu vực không hợp lệ'),
  body('category').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 120 }).withMessage('Nhóm địa điểm không hợp lệ'),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('categoryId không hợp lệ'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude phải là số từ -90 đến 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude phải là số từ -180 đến 180'),
  body('imageUrl').optional({ nullable: true, checkFalsy: true }).isURL({ require_protocol: true }).withMessage('Image URL phải là URL hợp lệ'),
  body('thumbnailUrl').optional({ nullable: true, checkFalsy: true }).isURL({ require_protocol: true }).withMessage('Image URL phải là URL hợp lệ'),
];

const place = placeBase;
const placeUpdate = placeBase;

module.exports = { id, place, placeUpdate };
