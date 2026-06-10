const { body, param } = require('express-validator');
const create = [body('routeId').optional().trim(), body('note').optional().trim().isLength({ max: 500 }), body('crowding').optional().isIn(['quiet','moderate','busy'])];
const status = [param('id').isInt({ min: 1 }), body('status').isIn(['new','processing','resolved','rejected']).withMessage('Trạng thái không hợp lệ')];
module.exports = { create, status };
