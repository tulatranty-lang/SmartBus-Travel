const repo = require('./review.repository');
const activity = require('../activity/activity.repository');
async function listByPlace(placeId) { return repo.listByPlace(placeId); }
async function create(placeId, user, body) {
  const item = await repo.create(placeId, user, body);
  await activity.logActivity({ userId: user?.id || null, actionType: 'review_create', targetType: 'place_review', targetId: item?.id, description: `Tạo review địa điểm #${placeId}` });
  return item;
}
async function update(id, user, body) { return repo.update(id, user, body); }
async function remove(id, user) { return repo.remove(id, user); }
async function vote(id, userId) { return repo.vote(id, userId); }
async function report(id, userId, reason) { return repo.report(id, userId, reason); }
async function pending() { return repo.pending(); }
async function approve(id, user) {
  const item = await repo.setStatus(id, 'approved', user);
  await activity.logActivity({ userId: user?.id || null, actionType: 'admin_moderate_review', targetType: 'place_review', targetId: id, description: `Admin duyệt review địa điểm #${id}` });
  return item;
}
async function hide(id, user) {
  const item = await repo.setStatus(id, 'hidden', user);
  await activity.logActivity({ userId: user?.id || null, actionType: 'admin_moderate_review', targetType: 'place_review', targetId: id, description: `Admin ẩn review địa điểm #${id}` });
  return item;
}
async function listCommunity(filters) { return repo.listCommunity(filters); }
async function findCommunityById(id) { return repo.findCommunityById(id); }
async function createCommunity(user, body) {
  const item = await repo.createCommunity(user, body);
  await activity.logActivity({ userId: user?.id || null, actionType: 'community_review_create', targetType: 'community_review', targetId: item?.id, description: `Đăng review cộng đồng: ${item?.title || ''}` });
  return item;
}
module.exports = { listByPlace, create, update, remove, vote, report, pending, approve, hide, listCommunity, findCommunityById, createCommunity };
