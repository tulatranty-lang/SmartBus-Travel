const crypto = require('crypto');
const env = require('../../config/env');

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = String(incoming || crypto.randomUUID());
  res.setHeader('x-request-id', req.id);
  return next();
}

function maskUrl(url = '') {
  return String(url).replace(/(accessToken|refreshToken|token|password)=([^&]+)/gi, '$1=***');
}

function requestLogger(req, res, next) {
  if (!env.enableRequestLog) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    if (env.logLevel === 'silent') return;
    const line = `[${new Date().toISOString()}] ${req.id} ${req.method} ${maskUrl(req.originalUrl || req.url)} ${status} ${ms.toFixed(1)}ms`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else if (['debug', 'info'].includes(env.logLevel)) console.log(line);
  });
  return next();
}

module.exports = { requestId, requestLogger };
