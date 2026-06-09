const repo = require('./stats.repository');
async function overview() { return repo.overview(); }
async function recentActivities(user, query = {}) { return repo.recentActivities({ userId: query.mine ? user?.id : null, limit: query.limit || 20 }); }
module.exports = { overview, recentActivities };
