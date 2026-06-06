const data = require('../../services/data.service');
const cache = require('../../common/utils/cache.util');
const { isValidLatLng } = require('../../common/utils/gis-validator.util');

async function findAll(routeId = null, filters = {}) {
  let stops = await cache.remember(`stops:${routeId || 'all'}`, 60_000, () => data.getStops(routeId || null));
  stops = stops.filter((s) => isValidLatLng(s.lat ?? s.latitude, s.lng ?? s.longitude, true));
  if (filters.province || filters.provinceCode) {
    const code = String(filters.provinceCode || filters.province).toUpperCase();
    stops = stops.filter((s) => String(s.provinceCode || '').toUpperCase() === code);
  }
  if (filters.q || filters.keyword) {
    const q = String(filters.q || filters.keyword).toLowerCase();
    stops = stops.filter((s) => [s.name, s.address, s.nearbyLandmark, s.provinceName, s.routeDisplayCode].join(' ').toLowerCase().includes(q));
  }
  return stops;
}

module.exports = { findAll };
