const routeService = require('../route/route.service');
const stopRepo = require('../stop/stop.repository');
const tourismService = require('../tourism/tourism.service');
const data = require('../../services/data.service');
const cache = require('../../common/utils/cache.util');

function lineFeature(route) {
  const coordinates = (route.path || []).map(([lat, lng]) => [Number(lng), Number(lat)]).filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng));
  return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { id: route.id, routeCode: route.routeCode, displayCode: route.displayCode, name: route.name, provinceCode: route.provinceCode, provinceName: route.provinceName, color: route.color, operatingHours: route.time, frequencyText: route.interval, vehicleCount: route.vehicleCount, distanceKm: route.distanceKm, avgSpeedKmh: route.avgSpeedKmh } };
}
function pointFeature(item, type) {
  const lat = Number(item.lat ?? item.latitude);
  const lng = Number(item.lng ?? item.longitude);
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { ...item, type } };
}
async function routesGeoJson(filters = {}) {
  return cache.remember(`map:routes:${JSON.stringify(filters)}`, 45_000, async () => {
    const routes = await routeService.listRoutes(filters || {});
    return { type: 'FeatureCollection', features: routes.map(lineFeature).filter((f) => f.geometry.coordinates.length >= 2) };
  });
}
async function stopsGeoJson(filters = {}) {
  return cache.remember(`map:stops:${JSON.stringify(filters)}`, 45_000, async () => {
    const stops = await stopRepo.findAll(null, filters || {});
    return { type: 'FeatureCollection', features: stops.map((s) => pointFeature(s, 'bus_stop')).filter((f) => Number.isFinite(f.geometry.coordinates[0])) };
  });
}
async function tourismGeoJson(filters = {}) {
  return cache.remember(`map:tourism:${JSON.stringify(filters)}`, 45_000, async () => {
    const places = await tourismService.search(filters || {});
    return { type: 'FeatureCollection', features: places.map((p) => pointFeature({ ...p, lat: p.lat || p.latitude, lng: p.lng || p.longitude }, 'tourist_place')).filter((f) => Number.isFinite(f.geometry.coordinates[0])) };
  });
}
async function vehiclesLayer(filters = {}) {
  const vehicles = await data.getVehicles(filters || {}).catch(() => []);
  return { type: 'FeatureCollection', features: vehicles.map((v) => pointFeature(v, 'vehicle')).filter((f) => Number.isFinite(f.geometry.coordinates[0])) };
}
async function overview(filters = {}) {
  const [routes, stops, places, vehicles] = await Promise.all([
    routeService.listRoutes(filters || {}),
    stopRepo.findAll(null, filters || {}),
    tourismService.search(filters || {}),
    data.getVehicles(filters || {}).catch(() => []),
  ]);
  return { counts: { routes: routes.length, stops: stops.length, tourismPlaces: places.length, vehicles: vehicles.length }, layers: { routes: `/map/routes?provinceCode=${filters.provinceCode || ''}`, stops: `/map/stops?provinceCode=${filters.provinceCode || ''}`, tourism: `/map/tourism?provinceCode=${filters.provinceCode || ''}`, vehicles: `/map/vehicles?provinceCode=${filters.provinceCode || ''}` } };
}
module.exports = { routesGeoJson, stopsGeoJson, tourismGeoJson, vehiclesLayer, overview };
