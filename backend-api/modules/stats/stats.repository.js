const { query } = require("../../config/db");
const activity = require("../activity/activity.repository");

async function scalar(text, params = {}) {
  const result = await query(text, params);
  return Number(result.recordset[0]?.total || 0);
}
async function overview({ includeAdmin = false } = {}) {
  const fields = {
    totalRoutes: "SELECT COUNT(*) total FROM bus_routes WHERE is_active=1",
    totalStops:
      "SELECT COUNT(*) total FROM bus_stops WHERE latitude BETWEEN 8 AND 24 AND longitude BETWEEN 102 AND 110",
    totalVehicles: "SELECT COUNT(*) total FROM buses WHERE status<>'inactive'",
    totalTourismPlaces:
      "SELECT COUNT(*) total FROM tourist_places WHERE is_active=1 AND latitude BETWEEN 8 AND 24 AND longitude BETWEEN 102 AND 110",
    totalProvinces:
      "SELECT COUNT(DISTINCT province_code) total FROM (SELECT province_code FROM bus_routes WHERE is_active=1 UNION SELECT province_code FROM tourist_places WHERE is_active=1) p",
    totalReviews:
      "SELECT (SELECT COUNT(*) FROM community_reviews WHERE status IN ('approved','approved_seed'))+(SELECT COUNT(*) FROM reviews WHERE status='approved') total",
    totalCommunityPosts:
      "SELECT COUNT(*) total FROM community_posts WHERE status='approved'",
  };
  if (includeAdmin)
    Object.assign(fields, {
      totalUsers: "SELECT COUNT(*) total FROM users WHERE is_active=1",
      totalReports:
        "SELECT COUNT(*) total FROM reports WHERE status<>'deleted'",
      pendingReviews:
        "SELECT COUNT(*) total FROM community_reviews WHERE status='pending'",
      totalTripPlans: "SELECT COUNT(*) total FROM trip_plans",
    });
  try {
    return {
      ...Object.fromEntries(
        await Promise.all(
          Object.entries(fields).map(async ([key, sql]) => [
            key,
            await scalar(sql),
          ]),
        ),
      ),
      source: "sql-server",
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    error.status = 503;
    error.errorCode = "STATS_UNAVAILABLE";
    throw error;
  }
}

function normalizeActivityRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    type: row.actionType,
    label: actionLabel(row.actionType),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
  }));
}

async function recentActivities(filters = {}) {
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 20));
  try {
    const rs = await query(
      `
      DECLARE @items TABLE(
        id NVARCHAR(80), userId INT NULL, userName NVARCHAR(255) NULL,
        actionType NVARCHAR(80), targetType NVARCHAR(80) NULL, targetId NVARCHAR(120) NULL,
        description NVARCHAR(1000), metadataJson NVARCHAR(MAX) NULL, createdAt DATETIME2
      );

      IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL
      BEGIN
        INSERT INTO @items(id, userId, userName, actionType, targetType, targetId, description, metadataJson, createdAt)
        SELECT TOP (@limit)
          CAST(a.id AS NVARCHAR(80)), a.user_id,
          COALESCE(u.full_name, u.email, N'Người dùng SmartBus'),
          a.action_type, a.target_type, CAST(a.target_id AS NVARCHAR(120)),
          COALESCE(NULLIF(a.description, N''), a.action_type), a.metadata_json, a.created_at
        FROM dbo.activity_logs a
        LEFT JOIN dbo.users u ON OBJECT_ID(N'dbo.users', N'U') IS NOT NULL AND u.id = a.user_id
        WHERE (@userId IS NULL OR a.user_id = @userId)
        ORDER BY a.created_at DESC, a.id DESC;
      END

      IF OBJECT_ID(N'dbo.reports', N'U') IS NOT NULL
      BEGIN
        INSERT INTO @items(id, userId, userName, actionType, targetType, targetId, description, metadataJson, createdAt)
        SELECT TOP (@limit)
          CONCAT(N'report-', id), user_id, N'Người dùng SmartBus', N'report_create', N'report', CAST(id AS NVARCHAR(120)),
          CONCAT(N'Gửi báo cáo tuyến ', COALESCE(route_code, N'?'), N' - ', COALESCE(crowding, status, N'đã nhận')),
          NULL, COALESCE(created_at, SYSDATETIME())
        FROM dbo.reports
        WHERE (@userId IS NULL OR user_id = @userId)
        ORDER BY created_at DESC, id DESC;
      END

      IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL
      BEGIN
        INSERT INTO @items(id, userId, userName, actionType, targetType, targetId, description, metadataJson, createdAt)
        SELECT TOP (@limit)
          CONCAT(N'review-', id), user_id, COALESCE(author_name, N'Người dùng SmartBus'), N'community_review_create', N'community_review', CAST(id AS NVARCHAR(120)),
          CONCAT(N'Review cộng đồng: ', COALESCE(title, place_name, content, N'Đã gửi review')),
          NULL, COALESCE(created_at, SYSDATETIME())
        FROM dbo.community_reviews
        WHERE (@userId IS NULL OR user_id = @userId)
        ORDER BY created_at DESC, id DESC;
      END

      IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL
      BEGIN
        INSERT INTO @items(id, userId, userName, actionType, targetType, targetId, description, metadataJson, createdAt)
        SELECT TOP (@limit)
          CONCAT(N'chat-', id), user_id, N'Người dùng SmartBus', N'chat_ask', N'chatbot', CAST(id AS NVARCHAR(120)),
          CONCAT(N'Hỏi chatbot: ', LEFT(COALESCE(question, message, N''), 120)),
          NULL, COALESCE(created_at, SYSDATETIME())
        FROM dbo.chatbot_logs
        WHERE (@userId IS NULL OR user_id = @userId)
        ORDER BY created_at DESC, id DESC;
      END

      SELECT TOP (@limit) * FROM @items ORDER BY createdAt DESC;
    `,
      { userId: filters.userId ? Number(filters.userId) : null, limit },
    );
    const rows = normalizeActivityRows(rs.recordset || []);
    if (rows.length) return rows;
  } catch (_err) {
    // Nếu SQL Server chưa sẵn sàng, rơi xuống activity repository cũ rồi static fallback.
  }

  const rows = await activity.recentActivities({
    userId: filters.userId || null,
    limit,
  });
  if (rows.length) return rows;

  return [];
}

function actionLabel(actionType) {
  const map = {
    login: "Đăng nhập",
    register: "Đăng ký",
    favorite_place_add: "Lưu địa điểm",
    favorite_place_remove: "Bỏ lưu địa điểm",
    favorite_route_add: "Lưu tuyến",
    favorite_route_remove: "Bỏ lưu tuyến",
    review_create: "Tạo review địa điểm",
    community_review_create: "Đăng review cộng đồng",
    community_post_create: "Đăng bài cộng đồng",
    community_comment_create: "Bình luận cộng đồng",
    chat_ask: "Hỏi chatbot",
    report_create: "Gửi báo cáo",
    admin_moderate_review: "Admin duyệt review",
    admin_moderate_post: "Admin duyệt bài cộng đồng",
    trip_plan_create: "Tạo lịch trình",
    data_sync: "Đồng bộ dữ liệu",
  };
  return map[actionType] || actionType || "Hoạt động";
}

module.exports = { overview, recentActivities };
