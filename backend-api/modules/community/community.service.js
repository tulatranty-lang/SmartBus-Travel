const repo = require('./community.repository');
module.exports = {
  list: repo.list,
  findById: repo.findById,
  create: repo.create,
  update: repo.update,
  remove: repo.remove,
  comment: repo.comment,
  vote: repo.vote,
  pending: repo.pending,
  approve: (id, user) => repo.setStatus(id, 'approved', user),
  hide: (id, user) => repo.setStatus(id, 'hidden', user),
};
