const service = require('./bus.service');
const { ok, fail } = require('../../common/utils/response');
async function listBuses(req, res) { return ok(res, await service.listBuses(req.query.routeId || null, req.query || {})); }
async function busEta(req, res) { const result = await service.estimateEta(req.params.id, req.query.stopId); return result ? ok(res, result) : fail(res, 404, 'Không tìm thấy xe'); }
module.exports = { listBuses, busEta };
