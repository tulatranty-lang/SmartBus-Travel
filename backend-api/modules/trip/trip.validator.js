const { body, param } = require('express-validator');
const generate = [body('timeAvailable').optional().trim(), body('interests').optional(), body('lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }), body('lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 })];
const id = [param('id').isInt({ min: 1 }).withMessage('id lịch trình không hợp lệ')];
module.exports = { generate, id };
