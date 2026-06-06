const service = require('./map.service');
const { ok } = require('../../common/utils/response');
async function routesGeoJson(req, res) { return ok(res, await service.routesGeoJson(req.query || {})); }
async function stopsGeoJson(req, res) { return ok(res, await service.stopsGeoJson(req.query || {})); }
async function tourismGeoJson(req, res) { return ok(res, await service.tourismGeoJson(req.query || {})); }
async function vehicles(req, res) { return ok(res, await service.vehiclesLayer(req.query || {})); }
async function overview(req, res) { return ok(res, await service.overview(req.query || {})); }
module.exports = { routesGeoJson, stopsGeoJson, tourismGeoJson, vehicles, overview };
