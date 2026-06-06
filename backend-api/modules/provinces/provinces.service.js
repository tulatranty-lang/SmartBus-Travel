const repo = require('./provinces.repository');
async function list() { return repo.findAll(); }
module.exports = { list };
