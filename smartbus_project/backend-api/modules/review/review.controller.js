const service = require('./review.service');
const { ok, created, fail } = require('../../common/utils/response');
async function listCommunity(req, res) { return ok(res, await service.listCommunity(req.query || {})); }
async function communityDetail(req, res) { const item = await service.findCommunityById(req.params.id); return item ? ok(res, item) : fail(res, 404, 'Không tìm thấy review cộng đồng'); }
async function createCommunity(req, res) { const item = await service.createCommunity(req.user, req.body); return created(res, item, item.status === 'pending' ? 'Bài review đã được gửi và chờ Admin duyệt' : 'Đã đăng bài review'); }
async function listByPlace(req, res) { return ok(res, await service.listByPlace(req.params.id)); }
async function create(req, res) { return created(res, await service.create(req.params.id, req.user, req.body), 'Review đã được gửi và chờ duyệt'); }
async function update(req, res) { const item = await service.update(req.params.id, req.user, req.body); return item ? ok(res, item, 'Đã cập nhật review') : fail(res, 404, 'Không tìm thấy review'); }
async function remove(req, res) { const item = await service.remove(req.params.id, req.user); return item ? ok(res, item, 'Đã xóa review') : fail(res, 404, 'Không tìm thấy review'); }
async function vote(req, res) { const item = await service.vote(req.params.id, req.user?.id || 0); return item ? ok(res, item, 'Đã đánh dấu hữu ích') : fail(res, 404, 'Không tìm thấy review'); }
async function report(req, res) { const item = await service.report(req.params.id, req.user?.id || 0, req.body.reason); return item ? created(res, item, 'Đã báo cáo review') : fail(res, 404, 'Không tìm thấy review'); }
module.exports = { listCommunity, communityDetail, createCommunity, listByPlace, create, update, remove, vote, report };
