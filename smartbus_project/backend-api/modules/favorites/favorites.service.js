const repo = require('./favorites.repository');
const activity = require('../activity/activity.repository');

async function addRoute(userId, routeId) {
  const result = await repo.addRoute(userId, routeId);
  await activity.logActivity({ userId, actionType: 'favorite_route_add', targetType: 'bus_route', targetId: routeId, description: `Đã lưu tuyến ${routeId}` });
  return result;
}
async function removeRoute(userId, routeId) {
  const result = await repo.removeRoute(userId, routeId);
  await activity.logActivity({ userId, actionType: 'favorite_route_remove', targetType: 'bus_route', targetId: routeId, description: `Đã bỏ lưu tuyến ${routeId}` });
  return result;
}
async function addPlace(userId, placeId) {
  const result = await repo.addPlace(userId, placeId);
  await activity.logActivity({ userId, actionType: 'favorite_place_add', targetType: 'tourist_place', targetId: placeId, description: `Đã lưu địa điểm du lịch #${placeId}` });
  return result;
}
async function removePlace(userId, placeId) {
  const result = await repo.removePlace(userId, placeId);
  await activity.logActivity({ userId, actionType: 'favorite_place_remove', targetType: 'tourist_place', targetId: placeId, description: `Đã bỏ lưu địa điểm du lịch #${placeId}` });
  return result;
}
module.exports = { addRoute, removeRoute, listRoutes: repo.listRoutes, addPlace, removePlace, listPlaces: repo.listPlaces };
