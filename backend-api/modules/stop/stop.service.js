const repo = require('./stop.repository');
const routeRepo = require('../route/route.repository');
const { haversineMeters, walkingMinutes } = require('../../common/utils/distance.util');

async function findNearest({ lat, lng, routeId, limit = 5 }) {
  const origin = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null;
  const stops = await repo.findAll(routeId || null);
  const max = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const list = stops
    .map((stop) => ({ ...stop, distanceMeters: Math.round(haversineMeters(origin, stop) || 0) }))
    .filter((s) => Number.isFinite(s.distanceMeters))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, max)
    .map((s) => ({ ...s, walkingMinutes: walkingMinutes(s.distanceMeters) }));
  const stop = list[0] || null;
  if (!stop) return null;
  const route = await routeRepo.findById(stop.routeId || routeId);
  return { stop, nearestStop: stop, nearestStops: list, route, distanceMeters: stop.distanceMeters, walkingMinutes: stop.walkingMinutes };
}
module.exports = { findNearest };
