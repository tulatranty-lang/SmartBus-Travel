const { reviewRepo, communityRepo, tourismRepo } = require('./admin.repository');
const activity = require('../activity/activity.repository');
const cache = require('../../common/utils/cache.util');

// FIX: reviews() - Mặc định dùng community_reviews (bảng review cộng đồng thật)
async function reviews(filters = {}) {
  if (String(filters.source || '').toLowerCase() === 'place') {
    return reviewRepo.adminListPlaceReviews(filters);
  }
  // Default: luôn dùng community_reviews
  return reviewRepo.adminListCommunity(filters);
}

async function approveReview(id, user) {
  const item = await reviewRepo.adminSetCommunityStatus(id, 'approved', user);
  if (item) {
    // FIX: Xóa cache stats sau khi duyệt review
    cache.clear('stats:');
    await activity.logActivity({
      userId: user?.id || null,
      actionType: 'admin_moderate_review',
      targetType: 'community_review',
      targetId: id,
      description: `Admin duyệt review cộng đồng #${id}: "${item.title || ''}"`,
    });
  }
  return item;
}

async function hideReview(id, user) {
  const item = await reviewRepo.adminSetCommunityStatus(id, 'rejected', user);
  if (item) {
    cache.clear('stats:');
    await activity.logActivity({
      userId: user?.id || null,
      actionType: 'admin_moderate_review',
      targetType: 'community_review',
      targetId: id,
      description: `Admin từ chối review cộng đồng #${id}: "${item.title || ''}"`,
    });
  }
  return item;
}

async function deleteReview(id, user) {
  const result = await reviewRepo.adminRemoveCommunity(id, user);
  cache.clear('stats:');
  return result;
}

async function pendingCommunity() {
  return communityRepo.pending();
}

async function approveCommunity(id, user) {
  const item = await communityRepo.setStatus(id, 'approved', user);
  await activity.logActivity({
    userId: user?.id || null,
    actionType: 'admin_moderate_post',
    targetType: 'community_post',
    targetId: id,
    description: `Admin duyệt bài cộng đồng #${id}`,
  });
  return item;
}

async function hideCommunity(id, user) {
  const item = await communityRepo.setStatus(id, 'hidden', user);
  await activity.logActivity({
    userId: user?.id || null,
    actionType: 'admin_moderate_post',
    targetType: 'community_post',
    targetId: id,
    description: `Admin ẩn bài cộng đồng #${id}`,
  });
  return item;
}

async function deleteCommunity(id, user) {
  return communityRepo.remove(id, user);
}

async function places(filters = {}) {
  return tourismRepo.findPlaces({ ...filters, includeInactive: true });
}

async function createPlace(body) {
  return tourismRepo.upsertPlace(body);
}

async function updatePlace(id, body) {
  return tourismRepo.upsertPlace({ ...body, id: Number(id) });
}

async function deletePlace(id) {
  return tourismRepo.removePlace(id);
}

async function recentActivities(filters = {}) {
  return activity.recentActivities({ limit: filters.limit || 30 });
}

module.exports = {
  reviews,
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
  recentActivities,
};
