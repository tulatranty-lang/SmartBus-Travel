const { param, query } = require('express-validator');
const eta = [param('id').notEmpty().withMessage('Mã xe là bắt buộc'), query('stopId').optional().trim()];
module.exports = { eta };
