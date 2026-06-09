const repo = require('./tourism.repository');
const activity = require('../activity/activity.repository');
const { enrichPlace, matchesMood } = require('./tourism-recommendation.service');

async function categories() { return repo.listCategories(); }
async function search(filters = {}) {
  const places = await repo.findPlaces(filters);
  const nearbyMap = await repo.nearbyStopsForPlaces(places.map((p) => p.id));
  const enriched = [];
  for (const p of places) enriched.push(await enrichPlace(p, filters, nearbyMap.get(Number(p.id)) || []));
  return enriched.sort((a, b) => (b.score || 0) - (a.score || 0));
}
async function recommended(filters) {
  const all = await search(filters);
  return all.filter((p) => matchesMood(p, filters.mood, filters.time)).slice(0, 8);
}
async function detail(id, location) {
  const place = await repo.findById(id);
  if (!place) return null;
  const nearbyStops = await repo.nearbyStops(id);
  const reviews = await repo.reviews(id);
  const enriched = await enrichPlace(place, location, nearbyStops);
  return { ...enriched, nearbyStops, reviews: reviews.slice(0, 5) };
}
async function nearbyStops(id) { return repo.nearbyStops(id); }
async function reviews(id) { return repo.reviews(id); }
async function favorite(userId, id) {
  const result = await repo.favoritePlace(userId, id);
  await activity.logActivity({ userId, actionType: 'favorite_place_add', targetType: 'tourist_place', targetId: id, description: `Đã lưu địa điểm du lịch #${id}` });
  return result;
}
async function unfavorite(userId, id) {
  const result = await repo.unfavoritePlace(userId, id);
  await activity.logActivity({ userId, actionType: 'favorite_place_remove', targetType: 'tourist_place', targetId: id, description: `Đã bỏ lưu địa điểm du lịch #${id}` });
  return result;
}
async function favorites(userId) { return repo.myFavorites(userId); }
async function savePlace(input) { return repo.upsertPlace(input); }
async function deletePlace(id) { return repo.removePlace(id); }
module.exports = { categories, search, recommended, detail, nearbyStops, reviews, favorite, unfavorite, favorites, savePlace, deletePlace };
