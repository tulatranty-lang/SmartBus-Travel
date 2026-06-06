const service = require('./provinces.service');
const { ok } = require('../../common/utils/response');
async function list(_req, res) { return ok(res, await service.list()); }
module.exports = { list };
