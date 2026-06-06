const { WALKING_SPEED_METERS_PER_MINUTE } = require('../constants/app.constants');

function toRad(deg) {
  return (Number(deg) * Math.PI) / 180;
}

function normalizePoint(point) {
  return { lat: Number(point?.lat ?? point?.latitude), lng: Number(point?.lng ?? point?.longitude) };
}

function haversineMeters(a, b) {
  const p1 = normalizePoint(a);
  const p2 = normalizePoint(b);
  if (!Number.isFinite(p1.lat) || !Number.isFinite(p1.lng) || !Number.isFinite(p2.lat) || !Number.isFinite(p2.lng)) return null;
  const R = 6371000;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function walkingMinutes(distanceMeters) {
  const d = Number(distanceMeters);
  if (!Number.isFinite(d)) return null;
  return Math.max(1, Math.ceil(d / WALKING_SPEED_METERS_PER_MINUTE));
}

function distanceScore(distanceMeters, maxMeters = 8000) {
  const d = Number(distanceMeters);
  if (!Number.isFinite(d)) return 0.5;
  return Math.max(0, 1 - Math.min(d, maxMeters) / maxMeters);
}

module.exports = { haversineMeters, walkingMinutes, distanceScore };
