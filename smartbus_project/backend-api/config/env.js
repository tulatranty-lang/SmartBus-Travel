require('dotenv').config();

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csv(value, fallback = []) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .length ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const apiPrefix = process.env.API_PREFIX || '/api/v1';
const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const corsOrigin = process.env.CORS_ORIGIN;

if (isProduction) {
  const missing = [];
  if (!accessSecret) missing.push('JWT_ACCESS_SECRET');
  if (!refreshSecret) missing.push('JWT_REFRESH_SECRET');
  if (!corsOrigin) missing.push('CORS_ORIGIN');
  if (!process.env.DB_USER) missing.push('DB_USER');
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
  if (missing.length) {
    throw new Error(`Thiếu biến môi trường production bắt buộc: ${missing.join(', ')}`);
  }
}

if (!isProduction && (!accessSecret || accessSecret === 'change_me_access_secret')) {
  // Cảnh báo nhưng không chặn môi trường demo/dev.
  console.warn('[SmartBus] JWT_ACCESS_SECRET đang dùng giá trị development. Hãy đổi trong production.');
}

const env = {
  nodeEnv,
  isProduction,
  port: number(process.env.PORT, 5000),
  apiPrefix,
  frontendOrigins: csv(corsOrigin, ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500']),
  jwtAccessSecret: accessSecret || 'dev_only_smartbus_access_secret_change_me',
  jwtRefreshSecret: refreshSecret || 'dev_only_smartbus_refresh_secret_change_me',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  rasaUrl: process.env.RASA_URL || '',
  db: {
    server: process.env.DB_SERVER || 'localhost',
    port: number(process.env.DB_PORT, 1433),
    name: process.env.DB_NAME || 'SmartBusDB',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    encrypt: bool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  enableRequestLog: bool(process.env.ENABLE_REQUEST_LOG, true),
  trustProxy: bool(process.env.TRUST_PROXY, false),
  rateLimit: {
    windowMs: number(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: number(process.env.RATE_LIMIT_MAX, 300),
    authMax: number(process.env.AUTH_RATE_LIMIT_MAX, 30),
    chatMax: number(process.env.CHAT_RATE_LIMIT_MAX, 80),
    writeMax: number(process.env.WRITE_RATE_LIMIT_MAX, 60),
  },
};

// Backward-compatible aliases used by older files in this project.
env.jwtSecret = env.jwtAccessSecret;
env.jwtExpiresIn = env.accessTokenExpiresIn;
env.jwtRefreshExpiresIn = env.refreshTokenExpiresIn;

module.exports = env;
