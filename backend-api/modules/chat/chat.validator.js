const { body } = require('express-validator');
const ask = [
  body().custom((value) => {
    const message = String(value?.message ?? value?.question ?? '').trim();
    if (!message) throw new Error('Tin nhắn không được rỗng');
    if (message.length > 1000) throw new Error('Tin nhắn tối đa 1000 ký tự');
    return true;
  }),
  body('lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('lat không hợp lệ'),
  body('lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('lng không hợp lệ'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('latitude không hợp lệ'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('longitude không hợp lệ'),
];
module.exports = { ask };
