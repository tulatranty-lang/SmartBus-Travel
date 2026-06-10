const service = require('./import.service');
const { ok, created } = require('../../common/utils/response');
async function history(_req, res) { return ok(res, await service.history()); }
async function busData(_req, res) { return created(res, await service.notImplementedYet('bus-data'), 'Đã nhận yêu cầu import dữ liệu xe buýt'); }
async function tourismData(_req, res) { return created(res, await service.notImplementedYet('tourism-data'), 'Đã nhận yêu cầu import dữ liệu du lịch'); }
module.exports = { history, busData, tourismData };
