const service = require('./favorites.service');
const { ok, created } = require('../../common/utils/response');

async function addRoute(req, res) { return created(res, await service.addRoute(req.user.id, req.body.routeId || req.params.routeId), 'Đã lưu tuyến yêu thích'); }
async function removeRoute(req, res) { return ok(res, await service.removeRoute(req.user.id, req.params.routeId), 'Đã bỏ lưu tuyến'); }
async function listRoutes(req, res) { return ok(res, await service.listRoutes(req.user.id)); }
async function addPlace(req, res) { return created(res, await service.addPlace(req.user.id, req.body.placeId || req.params.placeId), 'Đã lưu địa điểm'); }
async function removePlace(req, res) { return ok(res, await service.removePlace(req.user.id, req.params.placeId), 'Đã bỏ lưu địa điểm'); }
async function listPlaces(req, res) { return ok(res, await service.listPlaces(req.user.id)); }

module.exports = { addRoute, removeRoute, listRoutes, addPlace, removePlace, listPlaces };
