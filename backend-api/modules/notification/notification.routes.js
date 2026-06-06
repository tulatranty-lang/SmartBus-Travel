const router = require('express').Router();
const c = require('./notification.controller');
const asyncHandler = require('../../common/utils/async-handler');
const { requireAuth } = require('../../common/middleware/auth.middleware');
router.get('/', requireAuth, asyncHandler(c.list));
module.exports = router;
