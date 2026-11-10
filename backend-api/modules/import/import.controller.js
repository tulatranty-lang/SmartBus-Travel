const service = require("./import.service");
const { ok, created } = require("../../common/utils/response");
async function history(_req, res) {
  return ok(res, await service.history());
}
async function busData(req, res) {
  return created(
    res,
    await service.importRows("bus-data", req.body, req.user),
    "Đã nhập dữ liệu xe buýt",
  );
}
async function tourismData(req, res) {
  return created(
    res,
    await service.importRows("tourism-data", req.body, req.user),
    "Đã nhập dữ liệu du lịch",
  );
}
module.exports = { history, busData, tourismData };
