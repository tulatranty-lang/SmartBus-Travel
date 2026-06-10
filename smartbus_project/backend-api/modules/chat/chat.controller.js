const service = require('./chat.service');
const { chat, ok, fail } = require('../../common/utils/response');
async function ask(req, res) { const message = req.body.message ?? req.body.question; const lat = req.body.lat ?? req.body.latitude; const lng = req.body.lng ?? req.body.longitude; if (!message || !String(message).trim()) return fail(res, 400, 'Nội dung chat không được rỗng'); return chat(res, await service.answer({ message: String(message).trim(), lat, lng, userId: req.user?.id || null })); }
async function history(req, res) { return ok(res, await service.history(req.user?.id || null)); }
async function suggestions(_req, res) { return ok(res, await service.suggestions()); }
module.exports = { ask, history, suggestions };
