const service = require('./user.service');
const { ok, fail } = require('../../common/utils/response');
async function me(req, res) { const user = await service.getMe(req.user); return user ? ok(res, user) : fail(res, 404, 'Không tìm thấy người dùng'); }
async function updateMe(req, res) { return ok(res, await service.updateMe(req.user, req.body)); }
module.exports = { me, updateMe };
