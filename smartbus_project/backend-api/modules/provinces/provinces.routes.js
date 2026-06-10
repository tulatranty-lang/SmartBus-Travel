const router = require('express').Router();
const c = require('./provinces.controller');
const asyncHandler = require('../../common/utils/async-handler');
router.get('/', asyncHandler(c.list));
module.exports = router;
