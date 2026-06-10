const repo = require('./stats.repository');
const cache = require('../../common/utils/cache.util');

async function overview(user = null) {
  const isAdmin = user?.role === 'admin';
  // FIX: Cache stats overview 2 phút để tránh gọi DB nhiều lần khi page load
  const cacheKey = `stats:overview:${isAdmin ? 'admin' : 'public'}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const result = await repo.overview({ includeAdmin: isAdmin });
  cache.set(cacheKey, result, 2 * 60 * 1000); // 2 phút
  return result;
}

async function recentActivities(user, query = {}) {
  // FIX: Cache recent activities 30 giây để dashboard không bị chậm
  const cacheKey = `stats:activities:${user?.id || 'public'}:${query.limit || 20}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const result = await repo.recentActivities({ userId: query.mine ? user?.id : null, limit: query.limit || 20 });
  cache.set(cacheKey, result, 30 * 1000); // 30 giây
  return result;
}

module.exports = { overview, recentActivities };
