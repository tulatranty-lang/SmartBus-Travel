const service = require('./app-bff.service');
const { ok, fail } = require('../../common/utils/response');
async function dashboard(_req, res) { return ok(res, await service.dashboard()); }
async function placeDiscovery(req, res) { return ok(res, await service.placeDiscovery(req.query)); }
async function placeDetail(req, res) { const data = await service.placeDetail(req.params.id, req.query); return data ? ok(res, data) : fail(res, 404, 'Không tìm thấy địa điểm'); }
async function tripOptions(_req, res) { return ok(res, await service.tripPlannerOptions()); }
async function tripGenerate(req, res) { return ok(res, await service.tripGenerate(req.body)); }
async function chatContext(req, res) { return ok(res, await service.chatContext(req.query)); }
module.exports = { dashboard, placeDiscovery, placeDetail, tripOptions, tripGenerate, chatContext };
