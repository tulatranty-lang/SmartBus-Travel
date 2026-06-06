const routeRepo = require('../route/route.repository');
const busRepo = require('../bus/bus.repository');
const reportRepo = require('../report/report.repository');
const { query } = require('../../config/db');

async function summary() {
  const [routes, buses, reports, placesRs, reviewsRs, postsRs] = await Promise.all([
    routeRepo.findAll(),
    busRepo.findAll(),
    reportRepo.list(),
    query('SELECT id, is_active AS isActive FROM tourist_places'),
    query('SELECT id, status FROM reviews'),
    query('SELECT id, status FROM community_posts'),
  ]);
  return {
    routes,
    buses,
    reports,
    places: placesRs.recordset,
    reviews: reviewsRs.recordset,
    communityPosts: postsRs.recordset,
  };
}

module.exports = { summary };
