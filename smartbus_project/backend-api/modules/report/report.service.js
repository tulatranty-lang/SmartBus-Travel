const repo = require('./report.repository');
const activity = require('../activity/activity.repository');
async function create(user, body) {
  const item = await repo.create({ userId: user?.id || null, routeId: body.routeId, plate: body.plate, crowding: body.crowding, problemType: body.problemType || 'crowding', note: body.note });
  await activity.logActivity({ userId: user?.id || null, actionType: 'report_create', targetType: 'report', targetId: item?.id, description: `Gửi báo cáo ${body.problemType || 'crowding'}${body.routeId ? ` cho tuyến ${body.routeId}` : ''}` });
  return item;
}
async function list() { return repo.list(); }
async function setStatus(id, status) { return repo.setStatus(id, status || 'processing'); }
module.exports = { create, list, setStatus };
