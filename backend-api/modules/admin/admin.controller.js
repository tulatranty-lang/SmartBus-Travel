const service = require('./admin.service');
const { ok, created, fail } = require('../../common/utils/response');

async function reviews(req, res) {
  return ok(res, await service.reviews(req.query || {}));
}

async function pendingReviews(req, res) {
  return ok(res, await service.reviews({ ...(req.query || {}), status: 'pending' }));
}

async function approveReview(req, res) {
  const item = await service.approveReview(req.params.id, req.user);
  return item ? ok(res, item, 'Đã duyệt review') : fail(res, 404, 'Không tìm thấy review');
}

async function hideReview(req, res) {
  const item = await service.hideReview(req.params.id, req.user);
  return item ? ok(res, item, 'Đã ẩn review') : fail(res, 404, 'Không tìm thấy review');
}

async function deleteReview(req, res) {
  const item = await service.deleteReview(req.params.id, req.user);
  return item ? ok(res, item, 'Đã xóa/ẩn review') : fail(res, 404, 'Không tìm thấy review');
}

async function pendingCommunity(_req, res) {
  return ok(res, await service.pendingCommunity());
}

async function approveCommunity(req, res) {
  const item = await service.approveCommunity(req.params.id, req.user);
  return item ? ok(res, item, 'Đã duyệt bài') : fail(res, 404, 'Không tìm thấy bài');
}

async function hideCommunity(req, res) {
  const item = await service.hideCommunity(req.params.id, req.user);
  return item ? ok(res, item, 'Đã ẩn bài') : fail(res, 404, 'Không tìm thấy bài');
}

async function deleteCommunity(req, res) {
  const item = await service.deleteCommunity(req.params.id, req.user);
  return item ? ok(res, item, 'Đã xóa/ẩn bài') : fail(res, 404, 'Không tìm thấy bài');
}

async function places(req, res) {
  return ok(res, await service.places(req.query || {}));
}

async function createPlace(req, res) {
  return created(res, await service.createPlace(req.body), 'Đã tạo địa điểm');
}

async function updatePlace(req, res) {
  const item = await service.updatePlace(req.params.id, req.body);
  return item ? ok(res, item, 'Đã cập nhật địa điểm') : fail(res, 404, 'Không tìm thấy địa điểm');
}

async function deletePlace(req, res) {
  return ok(res, await service.deletePlace(req.params.id), 'Đã xóa/ẩn địa điểm');
}

module.exports = {
  reviews,
  pendingReviews,
  approveReview,
  hideReview,
  deleteReview,
  pendingCommunity,
  approveCommunity,
  hideCommunity,
  deleteCommunity,
  places,
  createPlace,
  updatePlace,
  deletePlace,
};
