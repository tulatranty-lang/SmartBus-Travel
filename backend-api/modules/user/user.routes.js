const router = require('express').Router();
const c = require('./user.controller');
const v = require('./user.validator');
const validate = require('../../common/middleware/validate.middleware');
const { requireAuth } = require('../../common/middleware/auth.middleware');
const asyncHandler = require('../../common/utils/async-handler');
router.get('/me', requireAuth, asyncHandler(c.me));
router.put('/me', requireAuth, v.updateMe, validate, asyncHandler(c.updateMe));
module.exports = router;
