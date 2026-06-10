const routeService = require('../route/route.service');
const stopRepo = require('../stop/stop.repository');
const data = require('../../services/data.service');
const { ok, fail } = require('../../common/utils/response');

async function listRoutes(req, res) { return ok(res, await routeService.listRoutes(req.query || {})); }
async function getRoute(req, res) {
  const item = await routeService.getRoute(req.params.id);
  return item ? ok(res, item) : fail(res, 404, 'Không tìm thấy tuyến xe');
}
async function getRouteStops(req, res) { return ok(res, await routeService.getRouteStops(req.params.id)); }
async function getRouteSchedules(req, res) {
  const rs = await require('../../config/db').query(`
    SELECT id, route_code AS routeCode, direction, trip_label AS tripLabel, first_departure AS firstDeparture,
           last_departure AS lastDeparture, departure_times_sample AS departureTimesSample,
           arrival_times_sample AS arrivalTimesSample, frequency_text AS frequencyText, notes, source_text AS sourceText
    FROM bus_schedules
    WHERE route_code=@routeId
    ORDER BY id
  `, { routeId: req.params.id });
  return ok(res, rs.recordset);
}
async function listStops(req, res) { return ok(res, await stopRepo.findAll(req.query.routeId || null, req.query || {})); }
async function nearStops(req, res) {
  const stopService = require('../stop/stop.service');
  const result = await stopService.findNearest({ ...req.query, limit: req.query.limit || 5 });
  return result ? ok(res, result) : ok(res, { nearestStops: [] });
}
async function listVehicles(req, res) { return ok(res, await data.getVehicles(req.query || {})); }
async function vehicleLocations(req, res) { return ok(res, await data.getVehicleLocations(req.query || {})); }

module.exports = { listRoutes, getRoute, getRouteStops, getRouteSchedules, listStops, nearStops, listVehicles, vehicleLocations };
