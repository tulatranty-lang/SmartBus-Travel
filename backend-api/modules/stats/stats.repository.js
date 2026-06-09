const { query } = require('../../config/db');
const routeRepo = require('../route/route.repository');
const stopRepo = require('../stop/stop.repository');
const tourismService = require('../tourism/tourism.service');
const busRepo = require('../bus/bus.repository');
const activity = require('../activity/activity.repository');

async function scalar(sqlText, alias = 'total') {
  try {
    const rs = await query(sqlText);
    return Number(rs.recordset?.[0]?.[alias] || 0);
  } catch (_err) {
    return 0;
  }
}

async function overview() {
  const [routes, stops, places, buses] = await Promise.all([
    routeRepo.findAll().catch(() => []),
    stopRepo.findAll(null).catch(() => []),
    tourismService.search({}).catch(() => []),
    busRepo.findAll().catch(() => []),
  ]);

  const totalReviews = await scalar(`
    SELECT COUNT(1) AS total
    FROM community_reviews
    WHERE COALESCE(status, 'approved') IN ('approved','approved_seed','pending')
  `);
  const totalCommunityPosts = await scalar(`
    SELECT COUNT(1) AS total
    FROM community_posts
    WHERE COALESCE(status, 'approved') <> 'hidden'
  `);
  const provinceFromRoutes = new Set((routes || []).map((r) => r.provinceCode).filter(Boolean));
  const provinceFromPlaces = new Set((places || []).map((p) => p.provinceCode || p.province).filter(Boolean));

  return {
    totalRoutes: Array.isArray(routes) ? routes.length : 0,
    totalStops: Array.isArray(stops) ? stops.length : 0,
    totalVehicles: Array.isArray(buses) ? buses.length : 0,
    totalTourismPlaces: Array.isArray(places) ? places.length : 0,
    totalProvinces: new Set([...provinceFromRoutes, ...provinceFromPlaces]).size || 5,
    totalReviews,
    totalCommunityPosts,
    source: 'sql-server',
    updatedAt: new Date().toISOString(),
  };
}

async function recentActivities(filters = {}) { return activity.recentActivities({ userId: filters.userId || null, limit: filters.limit || 20 }); }
module.exports = { overview, recentActivities };
