const repo = require('./stats.repository');
const cache = require('../../common/utils/cache.util');

async function overview(user = null) {
  const isAdmin = user?.role === 'admin';
  const cacheKey = `stats:overview:${isAdmin ? 'admin' : 'public'}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const result = await repo.overview({ includeAdmin: isAdmin });
  cache.set(cacheKey, result, 2 * 60 * 1000);
  return result;
}

async function recentActivities(user, query = {}) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role || 'user'];
  const canViewAll = roles.some((role) => ['admin', 'moderator'].includes(role));
  const mineOnly = String(query.mine || '').toLowerCase() === 'true' || !canViewAll;
  const userId = mineOnly ? user?.id : null;
  const cacheKey = `stats:activities:${userId || 'all'}:${query.limit || 20}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const result = await repo.recentActivities({ userId, limit: query.limit || 20 });
  cache.set(cacheKey, result, 30 * 1000);
  return result;
}

module.exports = { overview, recentActivities };
