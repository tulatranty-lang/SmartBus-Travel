const service = require('./stop.service');
const repo = require('./stop.repository');
const { ok, fail } = require('../../common/utils/response');
const { paginateArray } = require('../../common/utils/pagination.util');

function stopDto(s) {
  return {
    id: s.id,
    code: s.externalStopCode || s.id,
    name: s.name,
    address: s.address,
    latitude: Number(s.latitude ?? s.lat),
    longitude: Number(s.longitude ?? s.lng),
    lat: Number(s.latitude ?? s.lat),
    lng: Number(s.longitude ?? s.lng),
    province: s.provinceName,
    provinceCode: s.provinceCode,
    routeId: s.routeId,
    routeDisplayCode: s.routeDisplayCode,
    sequence: s.sequence,
    isMajor: Boolean(s.isMajor),
    routes: s.routes || [],
  };
}

async function list(req, res) {
  const stops = (await repo.findAll(req.query.routeId || null, req.query || {})).map(stopDto);
  const { items, pagination } = paginateArray(stops, req.query);
  return ok(res, items, 'OK', pagination);
}

async function nearest(req, res) {
  const result = await service.findNearest(req.query);
  return result ? ok(res, result) : fail(res, 400, 'Thiếu lat/lng hoặc không có dữ liệu bến', [], 'NEAREST_STOP_NOT_FOUND');
}

async function nearby(req, res) {
  const result = await service.findNearby(req.query);
  if (!result) return fail(res, 400, 'lat/lng không hợp lệ', [], 'INVALID_GPS');
  return ok(res, result, 'Danh sách bến gần tôi');
}

module.exports = { list, nearest, nearby, stopDto };
