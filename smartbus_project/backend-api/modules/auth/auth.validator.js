const { body } = require('express-validator');
const register = [body('email').isEmail().withMessage('Email không hợp lệ'), body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'), body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Họ tên quá ngắn')];
const login = [body('email').isEmail().withMessage('Email không hợp lệ'), body('password').notEmpty().withMessage('Mật khẩu bắt buộc')];
const refresh = [body('refreshToken').notEmpty().withMessage('refreshToken là bắt buộc')];
module.exports = { register, login, refresh };
