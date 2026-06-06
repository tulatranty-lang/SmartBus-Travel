const { query } = require('../../config/db');

async function findAll() {
  const rs = await query(`
    SELECT
      COALESCE(CAST(id AS INT), ROW_NUMBER() OVER (ORDER BY code)) AS id,
      code AS provinceCode,
      COALESCE(display_name, province_name, name) AS displayName,
      COALESCE(province_name, name) AS provinceName,
      region,
      country,
      COALESCE(is_active, 1) AS isActive
    FROM provinces
    WHERE COALESCE(is_active, 1) = 1
    ORDER BY CASE code WHEN 'QT' THEN 1 WHEN 'HUE' THEN 2 WHEN 'DN' THEN 3 WHEN 'QNG' THEN 4 WHEN 'QN_CU' THEN 5 ELSE 99 END, name
  `);
  return rs.recordset;
}

module.exports = { findAll };
