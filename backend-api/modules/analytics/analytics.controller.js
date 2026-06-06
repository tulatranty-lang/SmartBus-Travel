const service = require('./analytics.service');
const { ok } = require('../../common/utils/response');
async function summary(_req, res) { return ok(res, await service.summary()); }
module.exports = { summary };
