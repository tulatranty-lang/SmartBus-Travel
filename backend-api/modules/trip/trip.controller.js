const service = require('./trip.service');
const { ok, created, fail } = require('../../common/utils/response');
async function options(_req, res) { return ok(res, await service.options()); }
async function generate(req, res) { return created(res, await service.generate(req.body, req.user || null, true), 'Đã tạo lịch trình gợi ý'); }
async function my(req, res) { return ok(res, await service.my(req.user)); }
async function detail(req, res) { const item = await service.detail(req.params.id, req.user); return item ? ok(res, item) : fail(res, 404, 'Không tìm thấy lịch trình'); }
async function remove(req, res) { const item = await service.remove(req.params.id, req.user); return item ? ok(res, item, 'Đã xóa lịch trình') : fail(res, 404, 'Không tìm thấy lịch trình'); }
module.exports = { options, generate, my, detail, remove };
