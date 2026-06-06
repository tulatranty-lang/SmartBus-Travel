const { query } = require('../../config/db');

async function safeQuery(sqlText, params = {}) {
  const rs = await query(sqlText, params);
  return rs.recordset || [];
}

async function safeExecute(sqlText, params = {}) {
  const rs = await query(sqlText, params);
  return rs.recordset?.[0] || null;
}

module.exports = { safeQuery, safeExecute };
