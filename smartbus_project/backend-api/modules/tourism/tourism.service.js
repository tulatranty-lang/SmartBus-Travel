const repo = require('./tourism.repository');
const activity = require('../activity/activity.repository');
const cache = require('../../common/utils/cache.util');
const { enrichPlace, enrichPlacesBatch, matchesMood } = require('./tourism-recommendation.service');

async function categories() { return repo.listCategories(); }

// FIX: search dùng batch enrichment, không còn N+1 query
async function search(filters = {}) {
  const places = await repo.findPlaces(filters);
  if (!places.length) return [];
  // Batch query tất cả nearby stops + routes một lần
  const nearbyMap = await repo.nearbyStopsForPlaces(places.map((p) => p.id));
  // Enrich tất cả cùng lúc, không dùng await trong vòng lặp
  const enriched = await enrichPlacesBatch(places, filters, nearbyMap);
  return enriched.sort((a, b) => (b.score || 0) - (a.score || 0));
}

async function recommended(filters) {
  const all = await search(filters);
  return all.filter((p) => matchesMood(p, filters.mood, filters.time)).slice(0, 8);
}

async function detail(id, location) {
  const place = await repo.findById(id);
  if (!place) return null;
  const [nearbyStops, reviews] = await Promise.all([
    repo.nearbyStops(id),
    repo.reviews(id),
  ]);
  const nearbyMap = new Map([[Number(place.id), nearbyStops]]);
  const enriched = await enrichPlacesBatch([place], location, nearbyMap);
  return { ...enriched[0], nearbyStops, reviews: reviews.slice(0, 5) };
}

async function nearbyStops(id) { return repo.nearbyStops(id); }
async function reviews(id) { return repo.reviews(id); }

async function favorite(userId, id) {
  const result = await repo.favoritePlace(userId, id);
  await activity.logActivity({
    userId,
    actionType: 'favorite_place_add',
    targetType: 'tourist_place',
    targetId: id,
    description: `Đã lưu địa điểm du lịch #${id}`,
  });
  return result;
}

async function unfavorite(userId, id) {
  const result = await repo.unfavoritePlace(userId, id);
  await activity.logActivity({
    userId,
    actionType: 'favorite_place_remove',
    targetType: 'tourist_place',
    targetId: id,
    description: `Đã bỏ lưu địa điểm du lịch #${id}`,
  });
  return result;
}

async function favorites(userId) { return repo.myFavorites(userId); }
async function savePlace(input) { return repo.upsertPlace(input); }
async function deletePlace(id) { return repo.removePlace(id); }

module.exports = { categories, search, recommended, detail, nearbyStops, reviews, favorite, unfavorite, favorites, savePlace, deletePlace };
