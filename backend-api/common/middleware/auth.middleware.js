const jwt = require("jsonwebtoken"),
  env = require("../../config/env"),
  repo = require("../../modules/auth/auth.repository");
function normalizeUser(a = {}) {
  const role = a.role || "user";
  return {
    id: a.id,
    email: a.email,
    fullName: a.fullName || a.full_name,
    role,
    roles: Array.isArray(a.roles) ? a.roles : [role],
    permissions: Array.isArray(a.permissions) ? a.permissions : [],
    sessionVersion: Number(a.sessionVersion || 0),
  };
}
async function authenticate(req) {
  if (!req.authCheck)
    req.authCheck = (async () => {
      const token = /^Bearer\s+([^\s]+)$/i.exec(
        String(req.headers.authorization || ""),
      )?.[1];
      if (!token) return null;
      let p;
      try {
        p = jwt.verify(token, env.jwtAccessSecret, { algorithms: ["HS256"] });
      } catch {
        return null;
      }
      if (
        !Number.isSafeInteger(Number(p.id)) ||
        Number(p.id) < 1 ||
        (p.typ && p.typ !== "access")
      )
        return null;
      const a = await repo.findUserById(Number(p.id));
      if (
        !a ||
        a.isActive === false ||
        a.isActive === 0 ||
        Number(p.ver || 0) !== Number(a.sessionVersion || 0)
      )
        return null;
      return normalizeUser(a);
    })();
  return req.authCheck;
}
function optionalAuth(req, _res, next) {
  authenticate(req)
    .then((user) => {
      req.user = user || undefined;
      next();
    })
    .catch(next);
}
function requireAuth(req, res, next) {
  authenticate(req)
    .then((user) => {
      if (!user)
        return res
          .status(401)
          .json({
            success: false,
            message: "Bạn cần đăng nhập lại. Phiên đã hết hạn hoặc bị thu hồi.",
            errorCode: "AUTH_REQUIRED",
            errors: [],
          });
      req.user = user;
      next();
    })
    .catch(next);
}
module.exports = { optionalAuth, requireAuth, normalizeUser };
