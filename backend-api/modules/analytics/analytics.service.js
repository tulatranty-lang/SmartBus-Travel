const repo = require('./analytics.repository');
async function summary() {
  const d = await repo.summary();
  const byCrowding = d.buses.reduce((acc, b) => { acc[b.crowding] = (acc[b.crowding] || 0) + 1; return acc; }, {});
  const reportsByStatus = d.reports.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  return { totalRoutes: d.routes.length, totalBuses: d.buses.length, activeBuses: d.buses.filter((b) => b.status === 'active').length, reports: d.reports.length, byCrowding, reportsByStatus, tourismPlaces: d.places.filter((p) => p.isActive).length, approvedReviews: d.reviews.filter((r) => r.status === 'approved').length, communityPosts: d.communityPosts.filter((p) => p.status === 'approved').length };
}
module.exports = { summary };
