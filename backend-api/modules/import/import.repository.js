const { query } = require('../../config/db');
async function history() {
  const rs = await query(`
    SELECT TOP 100 id, source_type AS importType, source_file AS fileName, rows_total AS totalRows,
           rows_success AS insertedRows, rows_failed AS failedRows, status, message AS notes, created_at AS importedAt
    FROM import_history
    ORDER BY created_at DESC
  `);
  return rs.recordset;
}
module.exports = { history };
