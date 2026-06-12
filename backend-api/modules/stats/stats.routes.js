const router = require('express').Router();
const c = require('./stats.controller');
const asyncHandler = require('../../common/utils/async-handler');
const { requireAuth } = require('../../common/middleware/auth.middleware');

router.get('/overview', asyncHandler(c.overview));
router.get('/recent-activities', requireAuth, asyncHandler(c.recentActivities));

module.exports = router;
