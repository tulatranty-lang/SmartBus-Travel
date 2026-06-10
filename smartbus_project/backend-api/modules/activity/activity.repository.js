const { query } = require('../../config/db');

function normalizeLimit(value, fallback = 30) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

function toNullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function logActivity({ userId = null, actionType = 'unknown', targetType = null, targetId = null, description = '', metadata = null } = {}) {
  try {
    await query(`
      IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL
      BEGIN
        INSERT INTO activity_logs(user_id, action_type, target_type, target_id, description, metadata_json, created_at)
        VALUES(@userId, @actionType, @targetType, @targetId, @description, @metadata, SYSDATETIME())
      END
    `, {
      userId: toNullableNumber(userId),
      actionType: String(actionType || 'unknown').slice(0, 80),
      targetType: targetType ? String(targetType).slice(0, 80) : null,
      targetId: targetId == null ? null : String(targetId).slice(0, 120),
      description: String(description || '').slice(0, 1000),
      metadata: metadata ? JSON.stringify(metadata).slice(0, 2000) : null,
    });
  } catch (_err) {
    // Activity log không được làm hỏng thao tác chính nếu database chưa chạy migration.
  }
  return { logged: true };
}

async function recentActivities({ userId = null, limit = 30 } = {}) {
  try {
    const rs = await query(`
      IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NULL
      BEGIN
        SELECT TOP 0 CAST(NULL AS INT) AS id, CAST(NULL AS INT) AS userId, CAST(NULL AS NVARCHAR(255)) AS userName,
          CAST(NULL AS NVARCHAR(80)) AS actionType, CAST(NULL AS NVARCHAR(80)) AS targetType,
          CAST(NULL AS NVARCHAR(120)) AS targetId, CAST(NULL AS NVARCHAR(1000)) AS description,
          CAST(NULL AS NVARCHAR(MAX)) AS metadataJson, SYSDATETIME() AS createdAt
      END
      ELSE
      BEGIN
        SELECT TOP (@limit)
          a.id,
          a.user_id AS userId,
          COALESCE(u.full_name, u.email, N'Người dùng SmartBus') AS userName,
          a.action_type AS actionType,
          a.target_type AS targetType,
          a.target_id AS targetId,
          a.description,
          a.metadata_json AS metadataJson,
          a.created_at AS createdAt
        FROM activity_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE (@userId IS NULL OR a.user_id = @userId)
        ORDER BY a.created_at DESC, a.id DESC
      END
    `, { userId: toNullableNumber(userId), limit: normalizeLimit(limit) });
    return (rs.recordset || []).map((row) => ({
      ...row,
      type: row.actionType,
      label: actionLabel(row.actionType),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }));
  } catch (_err) {
    return [];
  }
}

function actionLabel(actionType) {
  const map = {
    login: 'Đăng nhập',
    register: 'Đăng ký',
    favorite_place_add: 'Lưu địa điểm',
    favorite_place_remove: 'Bỏ lưu địa điểm',
    favorite_route_add: 'Lưu tuyến',
    favorite_route_remove: 'Bỏ lưu tuyến',
    review_create: 'Tạo review địa điểm',
    community_review_create: 'Đăng review cộng đồng',
    community_post_create: 'Đăng bài cộng đồng',
    community_comment_create: 'Bình luận cộng đồng',
    chat_ask: 'Hỏi chatbot',
    report_create: 'Gửi báo cáo',
    admin_moderate_review: 'Admin duyệt review',
    admin_moderate_post: 'Admin duyệt bài cộng đồng',
    trip_plan_create: 'Tạo lịch trình',
  };
  return map[actionType] || actionType || 'Hoạt động';
}

module.exports = { logActivity, recentActivities };
