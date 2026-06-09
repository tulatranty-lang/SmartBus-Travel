const service = require('./stats.service');
const { ok } = require('../../common/utils/response');
async function overview(req, res) { return ok(res, await service.overview(req.user || null)); }
async function recentActivities(req, res) { return ok(res, await service.recentActivities(req.user || null, req.query || {})); }
module.exports = { overview, recentActivities };
