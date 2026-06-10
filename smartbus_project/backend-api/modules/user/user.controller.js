const service = require('./user.service');
const { ok, fail } = require('../../common/utils/response');
async function me(req, res) { const user = await service.getMe(req.user); return user ? ok(res, user) : fail(res, 404, 'Không tìm thấy người dùng'); }
async function updateMe(req, res) { return ok(res, await service.updateMe(req.user, req.body)); }
async function favoritePlaces(req, res) { return ok(res, await service.favoritePlaces(req.user)); }
async function chatHistory(req, res) { return ok(res, await service.chatHistory(req.user, req.query || {})); }
async function communityHistory(req, res) { return ok(res, await service.communityHistory(req.user, req.query || {})); }
async function activityHistory(req, res) { return ok(res, await service.activityHistory(req.user, req.query || {})); }
module.exports = { me, updateMe, favoritePlaces, chatHistory, communityHistory, activityHistory };
