const { query, param } = require('express-validator');
const search = [query('q').optional().trim(), query('category').optional().trim(), query('routeId').optional().trim(), query('lat').optional().isFloat({ min: -90, max: 90 }), query('lng').optional().isFloat({ min: -180, max: 180 })];
const id = [param('id').isInt({ min: 1 }).withMessage('id địa điểm không hợp lệ')];
module.exports = { search, id };
