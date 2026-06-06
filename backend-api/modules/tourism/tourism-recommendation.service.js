const { haversineMeters, walkingMinutes, distanceScore } = require('../../common/utils/distance.util');
const stopRepo = require('../stop/stop.repository');
const routeRepo = require('../route/route.repository');

function matchesMood(place, mood = '', timeAvailable = '') {
  const text = `${mood} ${timeAvailable}`.toLowerCase();
  if (!text.trim()) return true;
  if (/biển|bien|beach|tắm/.test(text)) return place.category === 'beach';
  if (/văn hóa|van hoa|culture|lịch sử/.test(text)) return place.category === 'culture';
  if (/mua sắm|shopping|chợ|cho/.test(text)) return ['shopping', 'food'].includes(place.category);
  if (/check|sống ảo|song ao/.test(text)) return place.category === 'checkin';
  if (/tâm linh|chùa|tam linh|spiritual/.test(text)) return place.category === 'spiritual';
  if (/vui chơi|giải trí|entertainment/.test(text)) return place.category === 'entertainment';
  return true;
}

async function enrichPlace(place, { lat, lng } = {}, nearbyStopLinks = []) {
  const userPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;
  const distanceMeters = userPoint ? haversineMeters(userPoint, { lat: place.latitude, lng: place.longitude }) : null;
  const stopLink = nearbyStopLinks.find((x) => Number(x.placeId) === Number(place.id));
  let stop = null;
  let route = null;
  if (stopLink) {
    const stops = await stopRepo.findAll(stopLink.routeId);
    stop = stops.find((s) => String(s.id) === String(stopLink.stopId)) || null;
    route = await routeRepo.findById(stopLink.routeId);
  }
  const busConvenience = stopLink ? Math.max(0, 1 - Math.min(stopLink.distanceMeters, 3000) / 3000) : 0.2;
  const reviewTrust = Math.min(1, Number(place.reviewCount || 0) / 100);
  const popularity = Math.min(1, Number(place.reviewCount || 0) / 200);
  const score = Number(((Number(place.averageRating || 0) / 5) * 0.35 + busConvenience * 0.25 + distanceScore(distanceMeters) * 0.20 + reviewTrust * 0.15 + popularity * 0.05).toFixed(3));
  return {
    ...place,
    lat: place.latitude,
    lng: place.longitude,
    distanceMeters,
    walkingMinutesFromUser: walkingMinutes(distanceMeters),
    nearestStop: stopLink ? { ...stopLink, stop, route } : null,
    recommendedRoute: route,
    score,
  };
}

module.exports = { matchesMood, enrichPlace };
