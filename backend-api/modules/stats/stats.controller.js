const service = require('./stats.service');
const { ok } = require('../../common/utils/response');
async function overview(_req, res) { return ok(res, await service.overview()); }
async function recentActivities(req, res) { return ok(res, await service.recentActivities(req.user || null, req.query || {})); }
module.exports = { overview, recentActivities };
