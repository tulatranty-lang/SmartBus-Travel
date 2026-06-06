const repo = require('./favorites.repository');
module.exports = {
  addRoute: repo.addRoute,
  removeRoute: repo.removeRoute,
  listRoutes: repo.listRoutes,
  addPlace: repo.addPlace,
  removePlace: repo.removePlace,
  listPlaces: repo.listPlaces,
};
