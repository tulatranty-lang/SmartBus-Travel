const repo = require('./stop.repository');
const routeRepo = require('../route/route.repository');
const { haversineMeters, walkingMinutes } = require('../../common/utils/distance.util');

function normalizeLimit(value, fallback = 5, max = 20) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function normalizeOrigin({ lat, lng } = {}) {
  const origin = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null;
  if (origin.lat < -90 || origin.lat > 90 || origin.lng < -180 || origin.lng > 180) return null;
  return origin;
}

function toNearbyDto(stop, origin) {
  const distanceMeters = Math.round(haversineMeters(origin, stop) || 0);
  const minutes = walkingMinutes(distanceMeters);
  const routes = Array.isArray(stop.routes) ? stop.routes : [];
  const primaryRoute = routes[0] || null;
  return {
    id: stop.id,
    code: stop.externalStopCode || stop.id,
    name: stop.name,
    address: stop.address || stop.nearbyLandmark || '',
    routeId: stop.routeId || primaryRoute?.id || null,
    routeCode: stop.routeDisplayCode || primaryRoute?.displayCode || primaryRoute?.id || null,
    routeName: primaryRoute?.name || null,
    routes,
    province: stop.provinceName,
    provinceCode: stop.provinceCode,
    lat: Number(stop.lat ?? stop.latitude),
    lng: Number(stop.lng ?? stop.longitude),
    latitude: Number(stop.lat ?? stop.latitude),
    longitude: Number(stop.lng ?? stop.longitude),
    distanceMeters,
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    walkingMinutes: minutes,
    isMajor: Boolean(stop.isMajor),
  };
}

async function findNearby({ lat, lng, routeId, limit = 5, province, provinceCode, q } = {}) {
  const origin = normalizeOrigin({ lat, lng });
  if (!origin) return null;
  const max = normalizeLimit(limit, 5, 20);
  const nearbyRows = typeof repo.findNearby === 'function'
    ? await repo.findNearby({ lat: origin.lat, lng: origin.lng, routeId, limit: max, province, provinceCode, q })
    : await repo.findAll(routeId || null, { province, provinceCode, q });
  return nearbyRows
    .map((stop) => toNearbyDto(stop, origin))
    .filter((stop) => Number.isFinite(stop.distanceMeters))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, max);
}

async function findNearest({ lat, lng, routeId, limit = 5, province, provinceCode, q } = {}) {
  const list = await findNearby({ lat, lng, routeId, limit, province, provinceCode, q });
  if (!list || !list.length) return null;
  const stop = list[0];
  const route = stop.routeId ? await routeRepo.findById(stop.routeId).catch(() => null) : null;
  return {
    stop,
    nearestStop: stop,
    nearestStops: list,
    route,
    distanceMeters: stop.distanceMeters,
    distanceKm: stop.distanceKm,
    walkingMinutes: stop.walkingMinutes,
  };
}

module.exports = { findNearest, findNearby };
