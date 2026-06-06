const service = require('./stats.service');
const { ok } = require('../../common/utils/response');
async function overview(_req, res) { return ok(res, await service.overview()); }
module.exports = { overview };
