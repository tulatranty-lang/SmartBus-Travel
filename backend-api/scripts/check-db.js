require('dotenv').config();
const assert = require('assert');
const { query, closePool } = require('../config/db');
const authService = require('../modules/auth/auth.service');

async function main() {
  const health = await query('SELECT DB_NAME() AS databaseName, SYSDATETIME() AS now');
  assert.ok(health.recordset[0].databaseName, 'Không lấy được DB_NAME()');

  const login = await authService.login({ email: 'admin@smartbus.vn', password: 'Admin123456' });
  assert.strictEqual(login.user.email, 'admin@smartbus.vn');
  assert.ok(login.accessToken, 'Login phải trả accessToken');
  assert.ok(login.refreshToken, 'Login phải trả refreshToken');

  const refreshed = await authService.refresh(login.refreshToken);
  assert.ok(refreshed.accessToken, 'Refresh phải trả accessToken mới');

  await authService.logout(refreshed.refreshToken);
  console.log('✅ SmartBus DB check passed: SQL Server connection, admin login, refresh, logout.');
}

main()
  .catch((err) => {
    console.error('❌ SmartBus DB check failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
