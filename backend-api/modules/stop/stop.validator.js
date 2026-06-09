const { query } = require('express-validator');
const nearest = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat không hợp lệ'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng không hợp lệ'),
  query('routeId').optional().trim(),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('limit phải từ 1 đến 20'),
];
module.exports = { nearest };
