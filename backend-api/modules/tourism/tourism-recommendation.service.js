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

// FIX: enrichPlace đơn lẻ (dùng nearbyStopLinks từ batch)
function enrichPlaceSync(place, { lat, lng } = {}, nearbyStopLinks = []) {
  const userPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? { lat: Number(lat), lng: Number(lng) } : null;
  const distanceMeters = userPoint ? haversineMeters(userPoint, { lat: place.latitude, lng: place.longitude }) : null;
  const stopLink = nearbyStopLinks.find((x) => Number(x.placeId) === Number(place.id))
    || nearbyStopLinks[0] || null;
  const busConvenience = stopLink ? Math.max(0, 1 - Math.min(stopLink.distanceMeters || 500, 3000) / 3000) : 0.2;
  const reviewTrust = Math.min(1, Number(place.reviewCount || 0) / 100);
  const popularity = Math.min(1, Number(place.reviewCount || 0) / 200);
  const score = Number((
    (Number(place.averageRating || 0) / 5) * 0.35 +
    busConvenience * 0.25 +
    distanceScore(distanceMeters) * 0.20 +
    reviewTrust * 0.15 +
    popularity * 0.05
  ).toFixed(3));
  return {
    ...place,
    lat: place.latitude,
    lng: place.longitude,
    distanceMeters,
    walkingMinutesFromUser: walkingMinutes(distanceMeters),
    nearestStop: stopLink ? {
      stopId: stopLink.stopId,
      stopName: stopLink.stopName,
      routeId: stopLink.routeId,
      routeDisplayCode: stopLink.routeDisplayCode,
      distanceMeters: stopLink.distanceMeters,
      walkingMinutes: stopLink.walkingMinutes,
      lat: stopLink.lat,
      lng: stopLink.lng,
    } : null,
    recommendedRoute: stopLink ? {
      id: stopLink.routeId,
      routeCode: stopLink.routeDisplayCode,
    } : null,
    score,
  };
}

// FIX MỚI: enrichPlacesBatch - batch query routes một lần, không N+1
async function enrichPlacesBatch(places, locationFilters = {}, nearbyMap = new Map()) {
  if (!places || !places.length) return [];
  const { lat, lng } = locationFilters || {};

  // Lấy danh sách routeIds cần query từ nearbyMap
  const routeIds = new Set();
  for (const [, links] of nearbyMap.entries()) {
    for (const link of (links || [])) {
      if (link.routeId) routeIds.add(String(link.routeId));
    }
  }

  // Batch query routes nếu cần (tối đa 1 query)
  const routeCache = new Map();
  if (routeIds.size > 0 && routeIds.size <= 50) {
    try {
      const routeArr = Array.from(routeIds);
      for (const rid of routeArr) {
        if (rid && !routeCache.has(rid)) {
          const r = await routeRepo.findById(rid).catch(() => null);
          if (r) routeCache.set(rid, r);
        }
      }
    } catch (_err) { /* không làm chết nếu batch query lỗi */ }
  }

  // Enrich từng place KHÔNG dùng await trong vòng lặp (dữ liệu đã có sẵn)
  return places.map((place) => {
    const stopLinks = nearbyMap.get(Number(place.id)) || [];
    const enriched = enrichPlaceSync(place, { lat, lng }, stopLinks);
    // Gắn route thực từ cache nếu có
    if (enriched.recommendedRoute && routeCache.has(enriched.recommendedRoute.id)) {
      enriched.recommendedRoute = routeCache.get(enriched.recommendedRoute.id);
    }
    return enriched;
  });
}

// Giữ lại enrichPlace cũ để tương thích backward
async function enrichPlace(place, { lat, lng } = {}, nearbyStopLinks = []) {
  return enrichPlaceSync(place, { lat, lng }, nearbyStopLinks);
}

module.exports = { matchesMood, enrichPlace, enrichPlacesBatch };
