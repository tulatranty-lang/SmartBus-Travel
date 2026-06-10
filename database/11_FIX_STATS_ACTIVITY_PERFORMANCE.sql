/* ==========================================================
   SmartBus Travel - Fix thống kê, hoạt động gần đây và hiệu năng
   An toàn dữ liệu: không DROP, không DELETE.
   Chạy trong database SmartBusDB sau khi deploy code.
   ========================================================== */

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.activity_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NULL,
    action_type NVARCHAR(80) NOT NULL,
    target_type NVARCHAR(80) NULL,
    target_id NVARCHAR(120) NULL,
    description NVARCHAR(1000) NULL,
    metadata_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_activity_logs_created_stats11 DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.activity_logs', N'metadata_json') IS NULL
  ALTER TABLE dbo.activity_logs ADD metadata_json NVARCHAR(MAX) NULL;

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_created_stats11' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_created_stats11 ON dbo.activity_logs(created_at DESC);

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_user_created_stats11' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_user_created_stats11 ON dbo.activity_logs(user_id, created_at DESC);

IF OBJECT_ID(N'dbo.reports', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_reports_created_stats11' AND object_id = OBJECT_ID(N'dbo.reports'))
  CREATE INDEX IX_reports_created_stats11 ON dbo.reports(created_at DESC);

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_status_created_stats11' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
  CREATE INDEX IX_community_reviews_status_created_stats11 ON dbo.community_reviews(status, created_at DESC);

IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chatbot_logs_created_stats11' AND object_id = OBJECT_ID(N'dbo.chatbot_logs'))
  CREATE INDEX IX_chatbot_logs_created_stats11 ON dbo.chatbot_logs(created_at DESC);

IF OBJECT_ID(N'dbo.bus_routes', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_routes_province_active_stats11' AND object_id = OBJECT_ID(N'dbo.bus_routes'))
  CREATE INDEX IX_bus_routes_province_active_stats11 ON dbo.bus_routes(province_code, is_active);

IF OBJECT_ID(N'dbo.bus_stops', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_stops_location_stats11' AND object_id = OBJECT_ID(N'dbo.bus_stops'))
  CREATE INDEX IX_bus_stops_location_stats11 ON dbo.bus_stops(latitude, longitude);

IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tourist_places_province_active_stats11' AND object_id = OBJECT_ID(N'dbo.tourist_places'))
  CREATE INDEX IX_tourist_places_province_active_stats11 ON dbo.tourist_places(province_code, is_active);

PRINT N'11_FIX_STATS_ACTIVITY_PERFORMANCE.sql completed.';
