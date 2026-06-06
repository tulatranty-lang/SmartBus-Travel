const sql = require('mssql');
const env = require('./env');

const server = env.db.server;
const database = env.db.name;
const rawPort = process.env.DB_PORT;
const useNamedInstance = String(server).includes('\\');

const config = {
  user: env.db.user,
  password: env.db.password,
  server,
  database,
  options: {
    encrypt: env.db.encrypt,
    trustServerCertificate: env.db.trustServerCertificate,
    enableArithAbort: true,
  },
  pool: { max: Number(process.env.DB_POOL_MAX || 20), min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000),
  requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT_MS || 15000),
};

if (rawPort && !useNamedInstance) config.port = Number(rawPort);

let poolPromise = null;

function hasDbConfig() {
  return Boolean(config.server && config.database && config.user && config.password);
}

function missingConfigMessage() {
  return [
    'SQL Server chưa được cấu hình đầy đủ.',
    'Hãy tạo backend-api/.env từ .env.example và điền DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD.',
    'Ví dụ: DB_SERVER=localhost, DB_NAME=SmartBusDB, DB_USER=sa, DB_PASSWORD=mat_khau_sql_server.',
  ].join(' ');
}

async function getPool() {
  if (!hasDbConfig()) {
    const err = new Error(missingConfigMessage());
    err.status = 500;
    err.errorCode = 'DB_CONFIG_MISSING';
    throw err;
  }
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function query(text, params = {}) {
  const pool = await getPool();
  const req = pool.request();
  Object.entries(params || {}).forEach(([key, value]) => req.input(key, value));
  return req.query(text);
}

async function healthCheck() {
  if (!hasDbConfig()) {
    return { configured: false, connected: false, status: 'missing_config', message: missingConfigMessage() };
  }
  try {
    const rs = await query('SELECT 1 AS ok');
    return { configured: true, connected: rs.recordset?.[0]?.ok === 1, status: 'ok' };
  } catch (err) {
    return { configured: true, connected: false, status: 'error', message: err.message };
  }
}

async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    if (pool) await pool.close();
    poolPromise = null;
  }
}

module.exports = { sql, config, getPool, query, closePool, hasDbConfig, missingConfigMessage, healthCheck };
