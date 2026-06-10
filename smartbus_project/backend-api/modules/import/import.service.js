const repo = require('./import.repository');
async function history() { return repo.history(); }
async function notImplementedYet(type) {
  return { importType: type, status: 'manual_sql_or_script', message: 'Chức năng import qua API đã có khung module. Với bản này hãy dùng npm run import:data hoặc các file SQL trong database/ để nạp dữ liệu an toàn.' };
}
module.exports = { history, notImplementedYet };
