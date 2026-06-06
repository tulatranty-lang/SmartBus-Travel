const repo = require('./stats.repository');
async function overview() { return repo.overview(); }
module.exports = { overview };
