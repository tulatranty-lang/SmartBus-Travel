const { query } = require('../../config/db');

async function list(userId = null) {
  const rs = await query(`
    SELECT id, user_id AS userId, title, content, type, is_read AS read, created_at AS createdAt
    FROM notifications
    WHERE user_id IS NULL OR @userId IS NULL OR user_id=@userId
    ORDER BY created_at DESC
  `, { userId: userId ? Number(userId) : null });
  return rs.recordset;
}

module.exports = { list };
