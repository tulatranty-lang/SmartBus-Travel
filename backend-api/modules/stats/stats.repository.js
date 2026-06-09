const { query } = require('../../config/db');
const activity = require('../activity/activity.repository');

async function scalar(sqlText, params = {}, alias = 'total') {
  try {
    const rs = await query(sqlText, params);
    return Number(rs.recordset?.[0]?.[alias] || 0);
  } catch (_err) {
    return 0;
  }
}

async function overview({ includeAdmin = false } = {}) {
  const [totalRoutes, totalStops, totalVehicles, totalTourismPlaces, totalReviews, totalCommunityPosts, totalReports, totalUsers, totalProvinces] = await Promise.all([
    scalar(`SELECT COUNT(1) AS total FROM bus_routes WHERE COALESCE(is_active, 1) = 1`),
    scalar(`SELECT COUNT(1) AS total FROM bus_stops WHERE latitude IS NOT NULL AND longitude IS NOT NULL`),
    scalar(`SELECT COUNT(1) AS total FROM buses WHERE COALESCE(status, 'active') <> 'inactive'`),
    scalar(`SELECT COUNT(1) AS total FROM tourist_places WHERE COALESCE(is_active, 1) = 1`),
    scalar(`SELECT COUNT(1) AS total FROM community_reviews WHERE COALESCE(status, 'approved') IN ('approved','approved_seed','pending')`),
    scalar(`SELECT COUNT(1) AS total FROM community_posts WHERE COALESCE(status, 'approved') <> 'hidden'`),
    scalar(`SELECT COUNT(1) AS total FROM reports WHERE COALESCE(status, 'new') <> 'deleted'`),
    includeAdmin ? scalar(`SELECT COUNT(1) AS total FROM users WHERE COALESCE(is_active, 1) = 1`) : Promise.resolve(undefined),
    scalar(`
      SELECT COUNT(DISTINCT province_code) AS total FROM (
        SELECT province_code FROM bus_routes WHERE province_code IS NOT NULL
        UNION ALL
        SELECT province_code FROM tourist_places WHERE province_code IS NOT NULL
      ) x
    `),
  ]);

  return {
    totalRoutes,
    totalStops,
    totalVehicles,
    totalTourismPlaces,
    totalProvinces: totalProvinces || 0,
    totalReviews,
    totalCommunityPosts,
    totalReports,
    ...(includeAdmin ? { totalUsers } : {}),
    source: 'sql-server',
    updatedAt: new Date().toISOString(),
  };
}

async function recentActivities(filters = {}) {
  return activity.recentActivities({ userId: filters.userId || null, limit: filters.limit || 20 });
}

module.exports = { overview, recentActivities };
