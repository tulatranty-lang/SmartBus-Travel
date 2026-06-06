const repo = require('./user.repository');
async function getMe(user) { return repo.findById(user.id); }
async function updateMe(user, patch) { return repo.updateProfile(user.id, patch); }
module.exports = { getMe, updateMe };
