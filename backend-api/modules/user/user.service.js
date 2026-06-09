const repo = require('./user.repository');
const favorites = require('../favorites/favorites.service');
async function getMe(user) { return repo.findById(user.id); }
async function updateMe(user, patch) { return repo.updateProfile(user.id, patch); }
async function favoritePlaces(user) { return favorites.listPlaces(user.id); }
async function activityHistory(user, filters = {}) { return repo.activityHistory(user.id, filters); }
module.exports = { getMe, updateMe, favoritePlaces, activityHistory };
