const { query, body, param } = require('express-validator');

const optionalLatLng = [
  query('lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('lat không hợp lệ'),
  query('lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('lng không hợp lệ'),
];

const bodyLatLng = [
  body('lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('lat không hợp lệ'),
  body('lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('lng không hợp lệ'),
];

const idParam = [param('id').notEmpty().withMessage('id là bắt buộc')];

module.exports = { optionalLatLng, bodyLatLng, idParam };
