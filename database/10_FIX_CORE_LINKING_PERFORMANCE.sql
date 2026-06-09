/*
  SmartBus migration 10
  Core linking + performance + review moderation hardening.
  Safe to run multiple times in SmartBusDB. No DROP/DELETE.
*/

SET NOCOUNT ON;
GO

/* 1) Chuẩn hóa bảng lưu địa điểm yêu thích */
IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.favorite_places (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_favorite_places PRIMARY KEY,
    user_id INT NOT NULL,
    place_id INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_favorite_places_created_at_core10 DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_favorite_places_user_place_core10 UNIQUE(user_id, place_id)
  );
END
GO

IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL
AND OBJECT_ID(N'dbo.users', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_favorite_places_users_core10')
BEGIN
  ALTER TABLE dbo.favorite_places
  ADD CONSTRAINT FK_favorite_places_users_core10 FOREIGN KEY(user_id) REFERENCES dbo.users(id);
END
GO

IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL
AND OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_favorite_places_tourist_places_core10')
BEGIN
  ALTER TABLE dbo.favorite_places
  ADD CONSTRAINT FK_favorite_places_tourist_places_core10 FOREIGN KEY(place_id) REFERENCES dbo.tourist_places(id);
END
GO

/* Migration mềm từ các bảng cũ sang bảng chuẩn. */
IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.favorites_places', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.favorite_places(user_id, place_id, created_at)
  SELECT fp.user_id, fp.place_id, COALESCE(fp.created_at, SYSDATETIME())
  FROM dbo.favorites_places fp
  JOIN dbo.users u ON u.id = fp.user_id
  JOIN dbo.tourist_places tp ON tp.id = fp.place_id
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.favorite_places std WHERE std.user_id = fp.user_id AND std.place_id = fp.place_id
  );
END
GO

IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.place_favorites', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.favorite_places(user_id, place_id, created_at)
  SELECT pf.user_id, pf.place_id, COALESCE(pf.created_at, SYSDATETIME())
  FROM dbo.place_favorites pf
  JOIN dbo.users u ON u.id = pf.user_id
  JOIN dbo.tourist_places tp ON tp.id = pf.place_id
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.favorite_places std WHERE std.user_id = pf.user_id AND std.place_id = pf.place_id
  );
END
GO

/* 2) Activity logs: giữ cột cũ, bổ sung alias/cột mở rộng để các module mới dùng chung. */
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.activity_logs (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_activity_logs_core10 PRIMARY KEY,
    user_id INT NULL,
    actor_type NVARCHAR(40) NULL,
    action_type NVARCHAR(80) NOT NULL,
    target_type NVARCHAR(80) NULL,
    target_id NVARCHAR(120) NULL,
    entity_type NVARCHAR(80) NULL,
    entity_id NVARCHAR(120) NULL,
    title NVARCHAR(255) NULL,
    description NVARCHAR(1000) NULL,
    metadata_json NVARCHAR(MAX) NULL,
    metadata NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_activity_logs_created_at_core10 DEFAULT SYSDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.activity_logs', 'actor_type') IS NULL ALTER TABLE dbo.activity_logs ADD actor_type NVARCHAR(40) NULL;
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.activity_logs', 'entity_type') IS NULL ALTER TABLE dbo.activity_logs ADD entity_type NVARCHAR(80) NULL;
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.activity_logs', 'entity_id') IS NULL ALTER TABLE dbo.activity_logs ADD entity_id NVARCHAR(120) NULL;
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.activity_logs', 'title') IS NULL ALTER TABLE dbo.activity_logs ADD title NVARCHAR(255) NULL;
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.activity_logs', 'metadata_json') IS NULL ALTER TABLE dbo.activity_logs ADD metadata_json NVARCHAR(MAX) NULL;
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.activity_logs', 'metadata') IS NULL ALTER TABLE dbo.activity_logs ADD metadata NVARCHAR(MAX) NULL;
GO

/* 3) Chatbot logs: bảo đảm đủ cột lưu lịch sử theo user. */
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.chatbot_logs (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_chatbot_logs_core10 PRIMARY KEY,
    user_id INT NULL,
    session_id NVARCHAR(120) NULL,
    question NVARCHAR(MAX) NOT NULL,
    answer NVARCHAR(MAX) NOT NULL,
    intent NVARCHAR(80) NULL,
    source NVARCHAR(60) NULL,
    lat FLOAT NULL,
    lng FLOAT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_chatbot_logs_created_at_core10 DEFAULT SYSDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.chatbot_logs', 'session_id') IS NULL ALTER TABLE dbo.chatbot_logs ADD session_id NVARCHAR(120) NULL;
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.chatbot_logs', 'source') IS NULL ALTER TABLE dbo.chatbot_logs ADD source NVARCHAR(60) NULL;
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.chatbot_logs', 'intent') IS NULL ALTER TABLE dbo.chatbot_logs ADD intent NVARCHAR(80) NULL;
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.chatbot_logs', 'lat') IS NULL ALTER TABLE dbo.chatbot_logs ADD lat FLOAT NULL;
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL AND COL_LENGTH('dbo.chatbot_logs', 'lng') IS NULL ALTER TABLE dbo.chatbot_logs ADD lng FLOAT NULL;
GO

/* 4) Trip plan tables nếu database cũ còn thiếu. */
IF OBJECT_ID(N'dbo.trip_plans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.trip_plans (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_trip_plans_core10 PRIMARY KEY,
    user_id INT NULL,
    title NVARCHAR(180) NOT NULL,
    time_available NVARCHAR(80) NULL,
    interests NVARCHAR(255) NULL,
    budget NVARCHAR(40) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_trip_plans_created_at_core10 DEFAULT SYSDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.trip_plan_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.trip_plan_items (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_trip_plan_items_core10 PRIMARY KEY,
    trip_plan_id INT NOT NULL,
    sequence_no INT NOT NULL,
    place_id INT NULL,
    route_code NVARCHAR(50) NULL,
    stop_id INT NULL,
    estimated_stay_minutes INT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.trip_plan_items', N'U') IS NOT NULL
AND OBJECT_ID(N'dbo.trip_plans', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_trip_plan_items_plans_core10')
BEGIN
  ALTER TABLE dbo.trip_plan_items
  ADD CONSTRAINT FK_trip_plan_items_plans_core10 FOREIGN KEY(trip_plan_id) REFERENCES dbo.trip_plans(id);
END
GO

/* 5) Community review moderation columns. */
IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_reviews', 'status') IS NULL
  ALTER TABLE dbo.community_reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_community_reviews_status_core10 DEFAULT N'pending';
IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_reviews', 'moderated_by') IS NULL
  ALTER TABLE dbo.community_reviews ADD moderated_by INT NULL;
IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_reviews', 'moderated_at') IS NULL
  ALTER TABLE dbo.community_reviews ADD moderated_at DATETIME2 NULL;
IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_reviews', 'moderation_note') IS NULL
  ALTER TABLE dbo.community_reviews ADD moderation_note NVARCHAR(500) NULL;
GO

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.reviews', 'status') IS NULL
  ALTER TABLE dbo.reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_reviews_status_core10 DEFAULT N'pending';
IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.reviews', 'moderated_by') IS NULL
  ALTER TABLE dbo.reviews ADD moderated_by INT NULL;
IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.reviews', 'moderated_at') IS NULL
  ALTER TABLE dbo.reviews ADD moderated_at DATETIME2 NULL;
GO

/* 6) Index hiệu năng. */
IF OBJECT_ID(N'dbo.bus_stops', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_stops_location_core10' AND object_id = OBJECT_ID(N'dbo.bus_stops'))
  CREATE INDEX IX_bus_stops_location_core10 ON dbo.bus_stops(latitude, longitude) INCLUDE(name, address, province_code, is_major);
GO
IF OBJECT_ID(N'dbo.bus_stops', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_stops_province_core10' AND object_id = OBJECT_ID(N'dbo.bus_stops'))
  CREATE INDEX IX_bus_stops_province_core10 ON dbo.bus_stops(province_code, name);
GO
IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tourism_places_location_core10' AND object_id = OBJECT_ID(N'dbo.tourist_places'))
  CREATE INDEX IX_tourism_places_location_core10 ON dbo.tourist_places(latitude, longitude) INCLUDE(name, province_code, category_id);
GO
IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tourism_places_province_category_core10' AND object_id = OBJECT_ID(N'dbo.tourist_places'))
  CREATE INDEX IX_tourism_places_province_category_core10 ON dbo.tourist_places(province_code, category_id, is_active, average_rating DESC);
GO
IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_favorite_places_user_place_core10' AND object_id = OBJECT_ID(N'dbo.favorite_places'))
  CREATE INDEX IX_favorite_places_user_place_core10 ON dbo.favorite_places(user_id, place_id);
GO
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_user_created_core10' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_user_created_core10 ON dbo.activity_logs(user_id, created_at DESC);
GO
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_created_core10' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_created_core10 ON dbo.activity_logs(created_at DESC);
GO
IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_status_created_core10' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
  CREATE INDEX IX_community_reviews_status_created_core10 ON dbo.community_reviews(status, created_at DESC);
GO
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chatbot_logs_user_created_core10' AND object_id = OBJECT_ID(N'dbo.chatbot_logs'))
  CREATE INDEX IX_chatbot_logs_user_created_core10 ON dbo.chatbot_logs(user_id, created_at DESC);
GO

PRINT N'✅ Migration 10_FIX_CORE_LINKING_PERFORMANCE.sql completed safely.';
GO
