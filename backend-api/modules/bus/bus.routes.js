const router = require('express').Router();
const c = require('./bus.controller');
const v = require('./bus.validator');
const validate = require('../../common/middleware/validate.middleware');
const asyncHandler = require('../../common/utils/async-handler');
router.get('/', asyncHandler(c.listBuses));
router.get('/:id/eta', v.eta, validate, asyncHandler(c.busEta));
module.exports = router;
