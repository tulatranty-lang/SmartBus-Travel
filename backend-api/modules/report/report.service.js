const repo = require('./report.repository');
async function create(user, body) { return repo.create({ userId: user?.id || null, routeId: body.routeId, plate: body.plate, crowding: body.crowding, problemType: body.problemType || 'crowding', note: body.note }); }
async function list() { return repo.list(); }
async function setStatus(id, status) { return repo.setStatus(id, status || 'processing'); }
module.exports = { create, list, setStatus };
