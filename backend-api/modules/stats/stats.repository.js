const fs = require('fs');
const path = require('path');
const { query } = require('../../config/db');
const activity = require('../activity/activity.repository');

const BUS_JSON_PATH = path.join(__dirname, '../../data/import/smartbus-bus-data.normalized.json');
const TOURISM_JSON_PATH = path.join(__dirname, '../../data/import/smartbus-tourism-data.normalized.json');

let staticCache = null;
function readJsonSafe(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return fallback;
  }
}

function staticStats() {
  if (staticCache) return staticCache;
  const bus = readJsonSafe(BUS_JSON_PATH, {});
  const tourism = readJsonSafe(TOURISM_JSON_PATH, {});
  const routes = Array.isArray(bus.routes) ? bus.routes : [];
  const stops = Array.isArray(bus.stops) ? bus.stops : [];
  const places = Array.isArray(tourism.places) ? tourism.places : [];
  const provinces = new Set([
    ...(Array.isArray(bus.provinces) ? bus.provinces.map((p) => p.code || p.name) : []),
    ...routes.map((r) => r.provinceCode || r.province_code || r.province),
    ...places.map((p) => p.provinceCode || p.province_code || p.province),
  ].filter(Boolean));
  staticCache = {
    totalRoutes: routes.length,
    totalStops: stops.filter((s) => Number.isFinite(Number(s.lat ?? s.latitude)) && Number.isFinite(Number(s.lng ?? s.longitude))).length || stops.length,
    totalVehicles: routes.reduce((sum, r) => sum + (Number(r.vehicleCount || r.vehicle_count || r.estimatedVehicleCount || r.estimated_vehicle_count) || 0), 0) || routes.length,
    totalTourismPlaces: places.length,
    totalProvinces: provinces.size || 0,
    totalReviews: 0,
    totalCommunityPosts: 0,
    totalReports: 0,
    totalUsers: 0,
  };
  return staticCache;
}

async function scalar(sqlText, params = {}, alias = 'total') {
  try {
    const rs = await query(sqlText, params);
    return Number(rs.recordset?.[0]?.[alias] || 0);
  } catch (_err) {
    return 0;
  }
}

function preferSql(sqlValue, staticValue) {
  const n = Number(sqlValue);
  return Number.isFinite(n) && n > 0 ? n : Number(staticValue || 0);
}

async function overview({ includeAdmin = false } = {}) {
  const fileStats = staticStats();
  const [totalRoutesSql, totalStopsSql, totalVehiclesSql, totalTourismSql, totalReviewsSql, totalPostsSql, totalReportsSql, totalUsersSql, totalProvincesSql, pendingReviewsSql, totalTripPlansSql] = await Promise.all([
    scalar(`IF OBJECT_ID(N'dbo.bus_routes', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.bus_routes WHERE COALESCE(is_active, 1) = 1`),
    scalar(`IF OBJECT_ID(N'dbo.bus_stops', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.bus_stops WHERE latitude IS NOT NULL AND longitude IS NOT NULL`),
    scalar(`IF OBJECT_ID(N'dbo.buses', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.buses WHERE COALESCE(status, 'active') <> 'inactive'`),
    scalar(`IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.tourist_places WHERE COALESCE(is_active, 1) = 1`),
    scalar(`DECLARE @total INT = 0; IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL SELECT @total = @total + COUNT(1) FROM dbo.community_reviews WHERE COALESCE(status, 'approved') IN ('approved','approved_seed','pending'); IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL SELECT @total = @total + COUNT(1) FROM dbo.reviews; SELECT @total AS total`),
    scalar(`IF OBJECT_ID(N'dbo.community_posts', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.community_posts WHERE COALESCE(status, 'approved') <> 'hidden'`),
    scalar(`IF OBJECT_ID(N'dbo.reports', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.reports WHERE COALESCE(status, 'new') <> 'deleted'`),
    includeAdmin ? scalar(`IF OBJECT_ID(N'dbo.users', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.users WHERE COALESCE(is_active, 1) = 1`) : Promise.resolve(undefined),
    scalar(`DECLARE @total INT = 0; IF OBJECT_ID(N'dbo.bus_routes', N'U') IS NOT NULL SELECT @total = @total + COUNT(DISTINCT province_code) FROM dbo.bus_routes WHERE province_code IS NOT NULL; IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL SELECT @total = @total + COUNT(DISTINCT province_code) FROM dbo.tourist_places WHERE province_code IS NOT NULL; SELECT @total AS total`),
    scalar(`IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.community_reviews WHERE COALESCE(status, 'pending') = 'pending'`),
    scalar(`IF OBJECT_ID(N'dbo.trip_plans', N'U') IS NULL SELECT 0 AS total ELSE SELECT COUNT(1) AS total FROM dbo.trip_plans`),
  ]);

  const sqlHasData = [totalRoutesSql, totalStopsSql, totalVehiclesSql, totalTourismSql, totalReviewsSql, totalReportsSql].some((n) => Number(n) > 0);

  return {
    totalRoutes: preferSql(totalRoutesSql, fileStats.totalRoutes),
    totalStops: preferSql(totalStopsSql, fileStats.totalStops),
    totalVehicles: preferSql(totalVehiclesSql, fileStats.totalVehicles),
    totalTourismPlaces: preferSql(totalTourismSql, fileStats.totalTourismPlaces),
    totalProvinces: preferSql(totalProvincesSql, fileStats.totalProvinces),
    totalReviews: preferSql(totalReviewsSql, fileStats.totalReviews),
    totalCommunityPosts: preferSql(totalPostsSql, fileStats.totalCommunityPosts),
    totalReports: preferSql(totalReportsSql, fileStats.totalReports),
    pendingReviews: Number(pendingReviewsSql || 0),
    totalTripPlans: Number(totalTripPlansSql || 0),
    ...(includeAdmin ? { totalUsers: Number(totalUsersSql || 0) } : {}),
    source: sqlHasData ? 'sql-server' : 'static-import-cache',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeActivityRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    type: row.actionType,
    label: actionLabel(row.actionType),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }));
}

async function recentActivities(filters = {}) {
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 20));
  try {
    const rs = await query(`
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
    `, { userId: filters.userId ? Number(filters.userId) : null, limit });
    const rows = normalizeActivityRows(rs.recordset || []);
    if (rows.length) return rows;
  } catch (_err) {
    // Nếu SQL Server chưa sẵn sàng, rơi xuống activity repository cũ rồi static fallback.
  }

  const rows = await activity.recentActivities({ userId: filters.userId || null, limit });
  if (rows.length) return rows;

  const base = staticStats();
  return normalizeActivityRows([
    { id: 'static-sync', userId: null, userName: 'SmartBus', actionType: 'data_sync', targetType: 'system', targetId: 'static', description: `Đã sẵn sàng ${base.totalRoutes} tuyến, ${base.totalStops} bến và ${base.totalTourismPlaces} địa điểm từ bộ dữ liệu import`, metadataJson: null, createdAt: new Date().toISOString() },
  ]).slice(0, limit);
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
    data_sync: 'Đồng bộ dữ liệu',
  };
  return map[actionType] || actionType || 'Hoạt động';
}

module.exports = { overview, recentActivities };
