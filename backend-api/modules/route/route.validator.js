const { param } = require('express-validator');
const routeId = [param('id').trim().notEmpty().withMessage('Mã tuyến là bắt buộc')];
module.exports = { routeId };
