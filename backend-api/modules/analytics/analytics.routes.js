const router = require('express').Router();
const c = require('./analytics.controller');
const asyncHandler = require('../../common/utils/async-handler');
const { requireAuth } = require('../../common/middleware/auth.middleware');
const { requireRole } = require('../../common/middleware/role.middleware');
router.get('/summary', requireAuth, requireRole('admin','moderator'), asyncHandler(c.summary));
module.exports = router;
