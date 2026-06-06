const { body } = require('express-validator');
const updateMe = [body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Họ tên quá ngắn'), body('phone').optional().trim().isLength({ min: 8 }).withMessage('Số điện thoại không hợp lệ')];
module.exports = { updateMe };
