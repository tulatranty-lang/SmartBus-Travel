const fs = require('fs');
const path = require('path');
const assert = require('assert');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

function runStaticChecks() {
  const frontendScript = fs.readFileSync(path.join(__dirname, '../../frontend/script.js'), 'utf8');
  const dbConfig = read('config/db.js');
  const dataService = read('services/data.service.js');
  const authService = read('modules/auth/auth.service.js');

  assert.ok(frontendScript.includes('/auth/login'), 'Frontend phải gọi /auth/login');
  assert.ok(frontendScript.includes('smartbus_access_token'), 'Frontend phải lưu smartbus_access_token');
  assert.ok(frontendScript.includes('smartbus_refresh_token'), 'Frontend phải lưu smartbus_refresh_token');
  assert.ok(frontendScript.includes('Authorization') && frontendScript.includes('Bearer'), 'Frontend phải gửi Authorization Bearer');

  assert.ok(dbConfig.includes('SmartBusDB'), 'DB mặc định phải là SmartBusDB');
  assert.ok(dbConfig.includes('DB_SERVER') && dbConfig.includes('DB_NAME'), 'Phải có cấu hình SQL Server bằng env');
  assert.ok(!dbConfig.includes('in-memory fallback'), 'Không được còn fallback database giả trong config/db.js');
  assert.ok(!dataService.includes('memory ='), 'services/data.service.js không được còn memory database');
  assert.ok(!dataService.includes('seed-data'), 'services/data.service.js không được dùng seed-data làm database giả');
  assert.ok(!authService.includes('DEMO_ADMIN'), 'auth.service.js không được còn DEMO_ADMIN fallback');
  assert.ok(!authService.includes('DEMO_LOGIN_ENABLED'), 'auth.service.js không được còn DEMO_LOGIN_ENABLED');
}

runStaticChecks();
console.log('✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.');
