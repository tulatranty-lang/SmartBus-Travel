const repo = require('./community.repository');
const activity = require('../activity/activity.repository');
async function create(user, body) {
  const item = await repo.create(user, body);
  await activity.logActivity({ userId: user?.id || null, actionType: 'community_post_create', targetType: 'community_post', targetId: item?.id, description: `Đăng bài cộng đồng: ${item?.title || ''}` });
  return item;
}
async function comment(id, user, body) {
  const item = await repo.comment(id, user, body);
  await activity.logActivity({ userId: user?.id || null, actionType: 'community_comment_create', targetType: 'community_post', targetId: id, description: `Bình luận vào bài cộng đồng #${id}` });
  return item;
}
async function approve(id, user) {
  const item = await repo.setStatus(id, 'approved', user);
  await activity.logActivity({ userId: user?.id || null, actionType: 'admin_moderate_post', targetType: 'community_post', targetId: id, description: `Admin duyệt bài cộng đồng #${id}` });
  return item;
}
async function hide(id, user) {
  const item = await repo.setStatus(id, 'hidden', user);
  await activity.logActivity({ userId: user?.id || null, actionType: 'admin_moderate_post', targetType: 'community_post', targetId: id, description: `Admin ẩn bài cộng đồng #${id}` });
  return item;
}
module.exports = {
  list: repo.list,
  findById: repo.findById,
  create,
  update: repo.update,
  remove: repo.remove,
  comment,
  vote: repo.vote,
  pending: repo.pending,
  approve,
  hide,
};
