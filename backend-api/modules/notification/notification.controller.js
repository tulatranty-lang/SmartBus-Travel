const service = require('./notification.service');
const { ok } = require('../../common/utils/response');
async function list(req, res) { return ok(res, await service.list(req.user.id)); }
module.exports = { list };
