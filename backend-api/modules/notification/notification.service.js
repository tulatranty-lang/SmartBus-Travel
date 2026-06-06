const repo = require('./notification.repository');
async function list(userId) { return repo.list(userId); }
module.exports = { list };
