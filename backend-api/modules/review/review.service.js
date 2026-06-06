const repo = require('./review.repository');
async function listByPlace(placeId) { return repo.listByPlace(placeId); }
async function create(placeId, user, body) { return repo.create(placeId, user, body); }
async function update(id, user, body) { return repo.update(id, user, body); }
async function remove(id, user) { return repo.remove(id, user); }
async function vote(id, userId) { return repo.vote(id, userId); }
async function report(id, userId, reason) { return repo.report(id, userId, reason); }
async function pending() { return repo.pending(); }
async function approve(id, user) { return repo.setStatus(id, 'approved', user); }
async function hide(id, user) { return repo.setStatus(id, 'hidden', user); }
async function listCommunity(filters) { return repo.listCommunity(filters); }
async function findCommunityById(id) { return repo.findCommunityById(id); }
async function createCommunity(user, body) { return repo.createCommunity(user, body); }
module.exports = { listByPlace, create, update, remove, vote, report, pending, approve, hide, listCommunity, findCommunityById, createCommunity };
