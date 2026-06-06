const { reviewRepo, communityRepo, tourismRepo } = require('./admin.repository');

async function reviews(filters = {}) {
  return reviewRepo.adminListCommunity(filters);
}

async function approveReview(id, user) {
  return reviewRepo.adminSetCommunityStatus(id, 'approved', user);
}

async function hideReview(id, user) {
  return reviewRepo.adminSetCommunityStatus(id, 'hidden', user);
}

async function deleteReview(id, user) {
  return reviewRepo.adminRemoveCommunity(id, user);
}

async function pendingCommunity() {
  return communityRepo.pending();
}

async function approveCommunity(id, user) {
  return communityRepo.setStatus(id, 'approved', user);
}

async function hideCommunity(id, user) {
  return communityRepo.setStatus(id, 'hidden', user);
}

async function deleteCommunity(id, user) {
  return communityRepo.remove(id, user);
}

async function places(filters = {}) {
  return tourismRepo.findPlaces({ ...filters, includeInactive: true });
}

async function createPlace(body) {
  return tourismRepo.upsertPlace(body);
}

async function updatePlace(id, body) {
  return tourismRepo.upsertPlace({ ...body, id: Number(id) });
}

async function deletePlace(id) {
  return tourismRepo.removePlace(id);
}

module.exports = {
  reviews,
  approveReview,
  hideReview,
  deleteReview,
  pendingCommunity,
  approveCommunity,
  hideCommunity,
  deleteCommunity,
  places,
  createPlace,
  updatePlace,
  deletePlace,
};
