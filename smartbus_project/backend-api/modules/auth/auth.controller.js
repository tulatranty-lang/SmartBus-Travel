const service = require('./auth.service');
const { ok, created } = require('../../common/utils/response');
async function register(req, res) { return created(res, await service.register(req.body), 'Đăng ký thành công'); }
async function login(req, res) { return ok(res, await service.login(req.body), 'Đăng nhập thành công'); }
async function refresh(req, res) { return ok(res, await service.refresh(req.body.refreshToken), 'Làm mới token thành công'); }
async function logout(req, res) { return ok(res, await service.logout(req.body.refreshToken), 'Đã đăng xuất'); }
module.exports = { register, login, refresh, logout };
