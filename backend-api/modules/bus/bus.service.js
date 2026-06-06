const repo = require('./bus.repository');
const routeRepo = require('../route/route.repository');
const stopRepo = require('../stop/stop.repository');
const { haversineMeters } = require('../../common/utils/distance.util');
const { parseIntervalMinutes } = require('../../common/utils/time.util');

async function listBuses(routeId = null, filters = {}) { return repo.findAll(routeId, filters); }
async function estimateEta(busId, stopId) {
  const bus = await repo.findById(busId);
  if (!bus) return null;
  const route = await routeRepo.findById(bus.routeId);
  const stops = await stopRepo.findAll(bus.routeId);
  const stop = stops.find((s) => String(s.id) === String(stopId)) || stops[0] || null;
  let etaMinutes = parseIntervalMinutes(route?.interval, 12);
  if (bus?.lat && bus?.lng && stop?.lat && stop?.lng) {
    const meters = haversineMeters(bus, stop) || 0;
    const speedKmh = Number(bus.speed || 22);
    etaMinutes = Math.max(2, Math.ceil((meters / 1000) / Math.max(speedKmh, 10) * 60));
  }
  return { bus, route, stop, etaMinutes };
}
module.exports = { listBuses, estimateEta };
