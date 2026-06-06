const { body, param } = require('express-validator');
const id = [param('id').isInt({ min: 1 }).withMessage('id không hợp lệ')];
const create = [body('title').trim().isLength({ min: 5, max: 150 }).withMessage('Tiêu đề 5-150 ký tự'), body('content').trim().isLength({ min: 10, max: 3000 }).withMessage('Nội dung 10-3000 ký tự')];
const comment = [...id, body('content').trim().isLength({ min: 2, max: 1000 }).withMessage('Bình luận 2-1000 ký tự')];
module.exports = { id, create, comment };
