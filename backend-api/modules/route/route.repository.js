const data = require('../../services/data.service');
const cache = require('../../common/utils/cache.util');

async function findAll(filters = {}) {
  const routes = await cache.remember('routes:all', 60_000, () => data.getRoutes());
  let out = routes;
  if (filters.province || filters.provinceCode) {
    const code = String(filters.provinceCode || filters.province).toUpperCase();
    out = out.filter((r) => String(r.provinceCode || '').toUpperCase() === code);
  }
  if (filters.q || filters.keyword) {
    const q = String(filters.q || filters.keyword).toLowerCase();
    out = out.filter((r) => [r.routeCode, r.displayCode, r.name, r.originName, r.destinationName, r.description, r.provinceName].join(' ').toLowerCase().includes(q));
  }
  return out;
}
async function findById(id) { return data.getRoute(id); }
async function findStops(routeId) { return data.getStops(routeId); }
async function findBuses(routeId) { return data.getBuses(routeId); }

module.exports = { findAll, findById, findStops, findBuses };
