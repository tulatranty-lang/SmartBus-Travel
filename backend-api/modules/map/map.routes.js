const router = require('express').Router();
const c = require('./map.controller');
const asyncHandler = require('../../common/utils/async-handler');
router.get('/routes', asyncHandler(c.routesGeoJson));
router.get('/stops', asyncHandler(c.stopsGeoJson));
router.get('/tourism', asyncHandler(c.tourismGeoJson));
router.get('/vehicles', asyncHandler(c.vehicles));
router.get('/routes-geojson', asyncHandler(c.routesGeoJson)); // deprecated alias
router.get('/stops-geojson', asyncHandler(c.stopsGeoJson)); // deprecated alias
router.get('/tourism-geojson', asyncHandler(c.tourismGeoJson)); // deprecated alias
router.get('/overview', asyncHandler(c.overview));
module.exports = router;
