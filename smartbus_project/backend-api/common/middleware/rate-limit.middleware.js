const rateLimit = require('express-rate-limit');
const env = require('../../config/env');

const standard = rateLimit({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.max, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.authMax, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Quá nhiều yêu cầu đăng nhập/đăng ký, vui lòng thử lại sau.', errors: [] } });
const chatLimiter = rateLimit({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.chatMax, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Bạn gửi chat quá nhanh, vui lòng thử lại sau.', errors: [] } });
const writeLimiter = rateLimit({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.writeMax, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Quá nhiều yêu cầu ghi dữ liệu, vui lòng thử lại sau.', errors: [] } });

module.exports = { standard, authLimiter, chatLimiter, writeLimiter };
