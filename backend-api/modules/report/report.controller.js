const service = require('./report.service');
const { ok, created } = require('../../common/utils/response');
const { paginateArray } = require('../../common/utils/pagination.util');
async function create(req, res) { return created(res, await service.create(req.user || null, req.body), 'Đã gửi báo cáo'); }
async function list(req, res) { const { items, pagination } = paginateArray(await service.list(req.query || {}), req.query); return ok(res, items, 'OK', pagination); }
async function updateStatus(req, res) { return ok(res, await service.setStatus(req.params.id, req.body.status), 'Đã cập nhật trạng thái'); }
module.exports = { create, list, updateStatus };
