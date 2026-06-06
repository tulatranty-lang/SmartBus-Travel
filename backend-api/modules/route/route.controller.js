const service = require('./route.service');
const { ok, fail } = require('../../common/utils/response');
const { paginateArray } = require('../../common/utils/pagination.util');

function routeDto(r) {
  return {
    id: r.id,
    code: r.routeCode || r.id,
    name: r.name,
    startPoint: r.originName,
    endPoint: r.destinationName,
    operatingHours: r.operatingHours || r.time,
    frequencyText: r.frequencyText || r.interval,
    fare: r.fare,
    distanceKm: r.distanceKm,
    durationMinutes: r.durationMinutes || r.estimatedMinutes,
    province: r.provinceName,
    provinceCode: r.provinceCode,
    color: r.color,
    vehicleCount: r.vehicleCount,
    avgSpeedKmh: r.avgSpeedKmh,
    path: r.path || [],
  };
}

async function listRoutes(req, res) {
  const routes = (await service.listRoutes(req.query || {})).map(routeDto);
  const { items, pagination } = paginateArray(routes, req.query);
  return ok(res, items, 'OK', pagination);
}
async function getRoute(req, res) { const route = await service.getRoute(req.params.id); return route ? ok(res, routeDto(route)) : fail(res, 404, 'Không tìm thấy tuyến', [], 'ROUTE_NOT_FOUND'); }
async function getRouteStops(req, res) { return ok(res, await service.getRouteStops(req.params.id)); }
async function getRouteBuses(req, res) { return ok(res, await service.getRouteBuses(req.params.id)); }

module.exports = { listRoutes, getRoute, getRouteStops, getRouteBuses, routeDto };
