const { body, param } = require('express-validator');
const id = [param('id').isInt({ min: 1 }).withMessage('id không hợp lệ')];
const create = [...id, body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating phải từ 1 đến 5'), body('content').trim().isLength({ min: 10, max: 1000 }).withMessage('Nội dung review phải từ 10 đến 1000 ký tự'), body('routeId').optional().trim(), body('stopId').optional().trim(), body('tags').optional()];
const update = [param('id').isInt({ min: 1 }), body('rating').optional().isInt({ min: 1, max: 5 }), body('content').optional().trim().isLength({ min: 10, max: 1000 })];
module.exports = { id, create, update };
