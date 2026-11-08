const{body}=require('express-validator');
const register=[body('email').isString().trim().isLength({max:254}).isEmail().withMessage('Email không hợp lệ'),body('password').isString().isLength({min:8,max:72}).withMessage('Mật khẩu từ 8 đến 72 ký tự'),body('fullName').optional().isString().trim().isLength({min:2,max:120}).withMessage('Họ tên từ 2 đến 120 ký tự')];
const login=[body('email').isString().trim().isEmail(),body('password').isString().isLength({min:1,max:72})];
const refresh=[body('refreshToken').isString().isLength({min:1,max:4096})];module.exports={register,login,refresh};
