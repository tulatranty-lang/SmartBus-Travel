const jwt = require('jsonwebtoken');
const env = require('../../config/env');

function tokenFrom(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function normalizeUser(payload = {}) {
  const role = payload.role || (Array.isArray(payload.roles) ? payload.roles[0] : 'user') || 'user';
  return {
    ...payload,
    id: payload.id || payload.userId || payload.sub,
    role,
    roles: Array.isArray(payload.roles) ? payload.roles : [role],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

function optionalAuth(req, _res, next) {
  const token = tokenFrom(req);
  if (!token) return next();
  try { req.user = normalizeUser(jwt.verify(token, env.jwtAccessSecret)); } catch (_err) {}
  return next();
}

function requireAuth(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập', errorCode: 'AUTH_REQUIRED', errors: [] });
  try {
    req.user = normalizeUser(jwt.verify(token, env.jwtAccessSecret));
    return next();
  } catch (_err) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn', errorCode: 'TOKEN_INVALID', errors: [] });
  }
}

module.exports = { optionalAuth, requireAuth, normalizeUser };
