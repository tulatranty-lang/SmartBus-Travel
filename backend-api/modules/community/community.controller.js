const service = require('./community.service');
const { ok, created, fail } = require('../../common/utils/response');
const { paginateArray } = require('../../common/utils/pagination.util');
async function list(req, res) { const { items, pagination } = paginateArray(await service.list(req.query), req.query); return ok(res, items, 'OK', pagination); }
async function detail(req, res) { const post = await service.findById(req.params.id); return post ? ok(res, post) : fail(res, 404, 'Không tìm thấy bài viết', [], 'POST_NOT_FOUND'); }
async function create(req, res) { return created(res, await service.create(req.user, req.body), 'Bài viết đã được gửi'); }
async function update(req, res) { const item = await service.update(req.params.id, req.user, req.body); return item ? ok(res, item, 'Đã cập nhật bài viết') : fail(res, 404, 'Không tìm thấy bài viết', [], 'POST_NOT_FOUND'); }
async function remove(req, res) { const item = await service.remove(req.params.id, req.user); return item ? ok(res, item, 'Đã xóa bài viết') : fail(res, 404, 'Không tìm thấy bài viết', [], 'POST_NOT_FOUND'); }
async function comment(req, res) { return created(res, await service.comment(req.params.id, req.user, req.body), 'Đã gửi bình luận'); }
async function vote(req, res) { const item = await service.vote(req.params.id, req.user?.id || 0); return item ? ok(res, item, 'Đã vote bài viết') : fail(res, 404, 'Không tìm thấy bài viết', [], 'POST_NOT_FOUND'); }
module.exports = { list, detail, create, update, remove, comment, vote };
