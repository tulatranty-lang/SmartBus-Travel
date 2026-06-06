const repo = require('./route.repository');

async function listRoutes(filters = {}) { return repo.findAll(filters); }
async function getRoute(id) { return repo.findById(id); }
async function getRouteStops(id) { return repo.findStops(id); }
async function getRouteBuses(id) { return repo.findBuses(id); }

module.exports = { listRoutes, getRoute, getRouteStops, getRouteBuses };
