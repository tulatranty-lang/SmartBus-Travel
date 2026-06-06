const router = require('express').Router();
const c = require('./favorites.controller');
const { requireAuth } = require('../../common/middleware/auth.middleware');
const { writeLimiter } = require('../../common/middleware/rate-limit.middleware');
const asyncHandler = require('../../common/utils/async-handler');

router.get('/favorite-routes', requireAuth, asyncHandler(c.listRoutes));
router.post('/favorite-routes', requireAuth, writeLimiter, asyncHandler(c.addRoute));
router.delete('/favorite-routes/:routeId', requireAuth, asyncHandler(c.removeRoute));
router.get('/favorite-places', requireAuth, asyncHandler(c.listPlaces));
router.post('/favorite-places', requireAuth, writeLimiter, asyncHandler(c.addPlace));
router.delete('/favorite-places/:placeId', requireAuth, asyncHandler(c.removePlace));

module.exports = router;
