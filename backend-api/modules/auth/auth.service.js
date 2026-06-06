const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../../config/env');
const repo = require('./auth.repository');

function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName || user.full_name || user.email,
    email: user.email,
    role: user.role || 'user',
    roles: Array.isArray(user.roles) ? user.roles : [user.role || 'user'],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

function unauthorized() {
  const err = new Error('Sai thông tin đăng nhập');
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
    { id: user.id, email: user.email, role: user.role || 'user', roles: user.roles || [user.role || 'user'], permissions: user.permissions || [] },
    env.jwtAccessSecret,
    { expiresIn: env.accessTokenExpiresIn },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user',
    roles: Array.isArray(user.roles) ? user.roles : [user.role || 'user'],
    permissions: Array.isArray(user.permissions) ? user.permissions : [], typ: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.refreshTokenExpiresIn },
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function durationToMs(value, fallbackMs) {
  const raw = String(value || '').trim();
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

async function register({ fullName = 'SmartBus User', email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existed = await repo.findUserByEmail(normalizedEmail);
  if (existed) {
    const err = new Error('Email đã tồn tại');
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.createUser({ fullName, email: normalizedEmail, passwordHash, role: 'user' });
  return { user: sanitizeUser(user), ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const account = await repo.findUserByEmail(normalizedEmail);

  if (!account) throw unauthorized();
  if (account.isActive === false || account.isActive === 0) throw forbidden('Tài khoản đã bị khóa');
  if (!account.passwordHash) throw unauthorized();

  const ok = await bcrypt.compare(String(password || ''), account.passwordHash);
  if (!ok) throw unauthorized();

  return { user: sanitizeUser(account), ...(await issueTokens(account)) };
}

async function refresh(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    if (payload.typ !== 'refresh') throw new Error('Invalid token type');

    const tokenHash = hashToken(refreshToken);
    const stored = await repo.findActiveRefreshToken(tokenHash);
    if (!stored) throw new Error('Refresh token was revoked or expired');

    const account = await repo.findUserById(payload.id);
    if (!account || account.isActive === false || account.isActive === 0) throw new Error('User not found');

    await repo.revokeRefreshToken(tokenHash);
    return { user: sanitizeUser(account), ...(await issueTokens(account)) };
  } catch (_err) {
    const err = new Error('Refresh token không hợp lệ');
    err.status = 401;
    throw err;
  }
}

async function logout(refreshToken) {
  if (refreshToken) await repo.revokeRefreshToken(hashToken(refreshToken));
  return { loggedOut: true };
}

module.exports = { register, login, refresh, logout };
