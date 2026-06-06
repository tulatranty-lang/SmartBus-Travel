const data = require('../../services/data.service');
async function findAll(routeId = null, filters = {}) { return data.getBuses(routeId, filters); }
async function findById(id) { return (await data.getBuses()).find((b) => String(b.id) === String(id)) || null; }
module.exports = { findAll, findById };
