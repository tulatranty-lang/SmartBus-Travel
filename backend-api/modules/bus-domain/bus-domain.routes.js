const router = require('express').Router();
const c = require('./bus-domain.controller');
const asyncHandler = require('../../common/utils/async-handler');

router.get('/routes', asyncHandler(c.listRoutes));
router.get('/routes/:id', asyncHandler(c.getRoute));
router.get('/routes/:id/stops', asyncHandler(c.getRouteStops));
router.get('/routes/:id/schedules', asyncHandler(c.getRouteSchedules));
router.get('/stops', asyncHandler(c.listStops));
router.get('/stops/near', asyncHandler(c.nearStops));
router.get('/vehicles', asyncHandler(c.listVehicles));
router.get('/vehicle-locations', asyncHandler(c.vehicleLocations));

module.exports = router;
