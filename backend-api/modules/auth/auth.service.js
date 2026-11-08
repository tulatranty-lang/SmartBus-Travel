const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../../config/env");
const repo = require("./auth.repository");
const activity = require("../activity/activity.repository");

function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName || user.full_name || user.email,
    email: user.email,
    role: user.role || "user",
    roles: Array.isArray(user.roles) ? user.roles : [user.role || "user"],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    sessionVersion: Number(user.sessionVersion || 0),
  };
}

function unauthorized() {
  const err = new Error("Sai thông tin đăng nhập");
  err.status = 401;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, typ: "access", ver: Number(user.sessionVersion || 0) },
    env.jwtAccessSecret,
    {
      expiresIn: env.accessTokenExpiresIn,
      algorithm: "HS256",
      jwtid: crypto.randomUUID(),
    },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || "user",
      roles: Array.isArray(user.roles) ? user.roles : [user.role || "user"],
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      typ: "refresh",
      ver: Number(user.sessionVersion || 0),
    },
    env.jwtRefreshSecret,
    {
      expiresIn: env.refreshTokenExpiresIn,
      algorithm: "HS256",
      jwtid: crypto.randomUUID(),
    },
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function durationToMs(value, fallbackMs) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return amount * factor;
}

async function issueTokens(user) {
  const safeUser = sanitizeUser(user);
  const token = signAccessToken(safeUser);
  const refreshToken = signRefreshToken(safeUser);
  const refreshMs = durationToMs(env.refreshTokenExpiresIn, 7 * 86400000);
  await repo.saveRefreshToken({
    userId: safeUser.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshMs),
  });
  return { token, accessToken: token, refreshToken };
}

async function register({ fullName = "SmartBus User", email, password }) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const existed = await repo.findUserByEmail(normalizedEmail);
  if (existed) {
    const err = new Error("Email đã tồn tại");
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await repo.createUser({
      fullName,
      email: normalizedEmail,
      passwordHash,
      role: "user",
    });
  } catch (error) {
    if (
      [2601, 2627].includes(error.number || error.originalError?.info?.number)
    )
      throw Object.assign(new Error("Email đã tồn tại"), { status: 409 });
    throw error;
  }
  const result = { user: sanitizeUser(user), ...(await issueTokens(user)) };
  await activity.logActivity({
    userId: user.id,
    actionType: "register",
    targetType: "user",
    targetId: user.id,
    description: "Tạo tài khoản SmartBus mới",
  });
  return result;
}

async function login({ email, password }) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const account = await repo.findUserByEmail(normalizedEmail);

  if (!account) throw unauthorized();
  if (account.isActive === false || account.isActive === 0)
    throw forbidden("Tài khoản đã bị khóa");
  if (!account.passwordHash) throw unauthorized();

  const ok = await bcrypt.compare(String(password || ""), account.passwordHash);
  if (!ok) throw unauthorized();

  const result = {
    user: sanitizeUser(account),
    ...(await issueTokens(account)),
  };
  await activity.logActivity({
    userId: account.id,
    actionType: "login",
    targetType: "user",
    targetId: account.id,
    description: "Đăng nhập vào SmartBus Travel",
  });
  return result;
}

async function refresh(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.jwtRefreshSecret, {
      algorithms: ["HS256"],
    });
    if (payload.typ !== "refresh") throw new Error("Invalid token type");

    const tokenHash = hashToken(refreshToken);
    const stored = await repo.consumeRefreshToken(tokenHash);
    if (!stored) throw new Error("Refresh token was revoked or expired");

    const account = await repo.findUserById(payload.id);
    if (
      !account ||
      account.isActive === false ||
      account.isActive === 0 ||
      Number(payload.ver || 0) !== Number(account.sessionVersion || 0)
    )
      throw new Error("User not found");
    return { user: sanitizeUser(account), ...(await issueTokens(account)) };
  } catch (_err) {
    const err = new Error("Refresh token không hợp lệ");
    err.status = 401;
    throw err;
  }
}

async function logout(refreshToken) {
  if (typeof refreshToken === "string" && refreshToken) {
    const revoked = await repo.revokeRefreshToken(hashToken(refreshToken));
    if (revoked?.userId) await repo.invalidateSessions(revoked.userId);
  }
  return { loggedOut: true };
}

module.exports = { register, login, refresh, logout };
