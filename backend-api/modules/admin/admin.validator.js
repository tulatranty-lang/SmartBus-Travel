const { body, param } = require('express-validator');

const id = [param('id').isInt({ min: 1 }).withMessage('id không hợp lệ')];

const placeBase = [
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Tên địa điểm từ 2 đến 200 ký tự'),
  body('provinceCode').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 30 }).withMessage('Tỉnh/khu vực không hợp lệ'),
  body('province').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 120 }).withMessage('Tỉnh/khu vực không hợp lệ'),
  body('category').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 120 }).withMessage('Nhóm địa điểm không hợp lệ'),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('categoryId không hợp lệ'),
  body('latitude').isFloat({ min: 8, max: 24 }).withMessage('Vĩ độ phải nằm trong khoảng 8–24'),
  body('longitude').isFloat({ min: 102, max: 110 }).withMessage('Kinh độ phải nằm trong khoảng 102–110'),
  body('imageUrl').optional({ nullable: true, checkFalsy: true }).isURL({ protocols:['http','https'], require_protocol: true }).withMessage('Image URL phải là URL hợp lệ'),
  body('thumbnailUrl').optional({ nullable: true, checkFalsy: true }).isURL({ protocols:['http','https'], require_protocol: true }).withMessage('Image URL phải là URL hợp lệ'),
];

const place = placeBase;
const placeUpdate = placeBase;

module.exports = { id, place, placeUpdate };
