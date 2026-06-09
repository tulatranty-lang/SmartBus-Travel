const router = require('express').Router();
const c = require('./stats.controller');
const asyncHandler = require('../../common/utils/async-handler');
router.get('/overview', asyncHandler(c.overview));
router.get('/recent-activities', asyncHandler(c.recentActivities));
module.exports = router;
