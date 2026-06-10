-- ============================================================
-- Migration 10: Fix Core Linking, Performance & Review Moderation
-- SmartBus Travel Connect v2.2
-- Chạy sau: 09_FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION.sql
-- ============================================================
USE SmartBusDB;
GO

-- ============================================================
-- 1. activity_logs – bảng ghi log mọi hoạt động
-- ============================================================
IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NULL
BEGIN
  CREATE TABLE activity_logs (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT NULL,
    action_type  NVARCHAR(80)   NOT NULL DEFAULT N'unknown',
    target_type  NVARCHAR(80)   NULL,
    target_id    NVARCHAR(120)  NULL,
    description  NVARCHAR(1000) NULL,
    metadata_json NVARCHAR(MAX) NULL,
    created_at   DATETIME2(3)   NOT NULL DEFAULT SYSDATETIME()
  );
  PRINT N'Created activity_logs';
END
GO

-- Thêm cột nếu thiếu
IF COL_LENGTH(N'dbo.activity_logs', N'metadata_json') IS NULL
  ALTER TABLE activity_logs ADD metadata_json NVARCHAR(MAX) NULL;
GO

-- Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_user_created' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_created' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_created ON activity_logs(created_at DESC);
GO

-- ============================================================
-- 2. chatbot_logs – lịch sử chat
-- ============================================================
IF OBJECT_ID(N'dbo.chatbot_logs', N'U') IS NULL
BEGIN
  CREATE TABLE chatbot_logs (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT NULL,
    session_id   NVARCHAR(100) NULL,
    question     NVARCHAR(2000) NOT NULL,
    answer       NVARCHAR(MAX) NOT NULL,
    intent       NVARCHAR(80) NULL,
    lat          FLOAT NULL,
    lng          FLOAT NULL,
    source       NVARCHAR(50) NULL DEFAULT N'web',
    created_at   DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
  );
  PRINT N'Created chatbot_logs';
END
GO

-- Thêm cột thiếu
IF COL_LENGTH(N'dbo.chatbot_logs', N'session_id') IS NULL
  ALTER TABLE chatbot_logs ADD session_id NVARCHAR(100) NULL;
GO
IF COL_LENGTH(N'dbo.chatbot_logs', N'source') IS NULL
  ALTER TABLE chatbot_logs ADD source NVARCHAR(50) NULL DEFAULT N'web';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chatbot_logs_user_created' AND object_id = OBJECT_ID(N'dbo.chatbot_logs'))
  CREATE INDEX IX_chatbot_logs_user_created ON chatbot_logs(user_id, created_at DESC);
GO

-- ============================================================
-- 3. chat_history – bảng lịch sử chat có related_place/route
-- ============================================================
IF OBJECT_ID(N'dbo.chat_history', N'U') IS NULL
BEGIN
  CREATE TABLE chat_history (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    user_id            INT NULL,
    message            NVARCHAR(2000) NOT NULL,
    bot_response       NVARCHAR(MAX) NOT NULL,
    intent             NVARCHAR(80) NULL,
    related_place_id   INT NULL,
    related_route_id   NVARCHAR(30) NULL,
    lat                FLOAT NULL,
    lng                FLOAT NULL,
    created_at         DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
  );
  PRINT N'Created chat_history';
END
GO

IF COL_LENGTH(N'dbo.chat_history', N'related_place_id') IS NULL
  ALTER TABLE chat_history ADD related_place_id INT NULL;
GO
IF COL_LENGTH(N'dbo.chat_history', N'related_route_id') IS NULL
  ALTER TABLE chat_history ADD related_route_id NVARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chat_history_user_created' AND object_id = OBJECT_ID(N'dbo.chat_history'))
  CREATE INDEX IX_chat_history_user_created ON chat_history(user_id, created_at DESC);
GO

-- ============================================================
-- 4. community_reviews – bảng duyệt review cộng đồng chính
-- ============================================================
IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NULL
BEGIN
  CREATE TABLE community_reviews (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    review_id        NVARCHAR(40) NULL,
    slug             NVARCHAR(200) NULL,
    user_id          INT NULL,
    author_name      NVARCHAR(120) NULL,
    province         NVARCHAR(100) NULL,
    place_name       NVARCHAR(255) NULL,
    category         NVARCHAR(80) NULL,
    rating           TINYINT NULL,
    title            NVARCHAR(255) NOT NULL,
    short_caption    NVARCHAR(500) NULL,
    content          NVARCHAR(MAX) NULL,
    tips             NVARCHAR(1000) NULL,
    tags             NVARCHAR(500) NULL,
    source_ref       NVARCHAR(200) NULL,
    image_url        NVARCHAR(500) NULL,
    status           NVARCHAR(30) NOT NULL DEFAULT N'pending',
    is_seed          BIT NOT NULL DEFAULT 0,
    moderated_by     INT NULL,
    moderated_at     DATETIME2(3) NULL,
    moderation_note  NVARCHAR(500) NULL,
    created_at       DATETIME2(3) NOT NULL DEFAULT SYSDATETIME(),
    updated_at       DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
  );
  PRINT N'Created community_reviews';
END
GO

-- Thêm cột thiếu
IF COL_LENGTH(N'dbo.community_reviews', N'moderated_by') IS NULL
  ALTER TABLE community_reviews ADD moderated_by INT NULL;
GO
IF COL_LENGTH(N'dbo.community_reviews', N'moderated_at') IS NULL
  ALTER TABLE community_reviews ADD moderated_at DATETIME2(3) NULL;
GO
IF COL_LENGTH(N'dbo.community_reviews', N'moderation_note') IS NULL
  ALTER TABLE community_reviews ADD moderation_note NVARCHAR(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_status_created' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
  CREATE INDEX IX_community_reviews_status_created ON community_reviews(status, created_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_user' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
  CREATE INDEX IX_community_reviews_user ON community_reviews(user_id, created_at DESC);
GO

-- ============================================================
-- 5. favorites_places và place_favorites (hỗ trợ cả 2 tên cũ)
-- ============================================================
IF OBJECT_ID(N'dbo.favorites_places', N'U') IS NULL
BEGIN
  CREATE TABLE favorites_places (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT NOT NULL,
    place_id   INT NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_favorites_places UNIQUE (user_id, place_id)
  );
  PRINT N'Created favorites_places';
END
GO

IF OBJECT_ID(N'dbo.place_favorites', N'U') IS NULL
BEGIN
  CREATE TABLE place_favorites (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT NOT NULL,
    place_id   INT NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_place_favorites UNIQUE (user_id, place_id)
  );
  PRINT N'Created place_favorites';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_favorites_places_user' AND object_id = OBJECT_ID(N'dbo.favorites_places'))
  CREATE INDEX IX_favorites_places_user ON favorites_places(user_id, created_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_place_favorites_user' AND object_id = OBJECT_ID(N'dbo.place_favorites'))
  CREATE INDEX IX_place_favorites_user ON place_favorites(user_id, created_at DESC);
GO

-- ============================================================
-- 6. trip_plans & trip_plan_items
-- ============================================================
IF OBJECT_ID(N'dbo.trip_plans', N'U') IS NULL
BEGIN
  CREATE TABLE trip_plans (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NULL,
    title           NVARCHAR(255) NOT NULL,
    province        NVARCHAR(100) NULL,
    time_available  NVARCHAR(50) NULL,
    budget          NVARCHAR(20) NULL,
    interests_json  NVARCHAR(500) NULL,
    summary         NVARCHAR(1000) NULL,
    start_lat       FLOAT NULL,
    start_lng       FLOAT NULL,
    created_at      DATETIME2(3) NOT NULL DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
  );
  PRINT N'Created trip_plans';
END
GO

IF OBJECT_ID(N'dbo.trip_plan_items', N'U') IS NULL
BEGIN
  CREATE TABLE trip_plan_items (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    trip_plan_id     INT NOT NULL,
    place_id         INT NULL,
    place_name       NVARCHAR(255) NULL,
    sort_order       INT NOT NULL DEFAULT 0,
    time_block       NVARCHAR(50) NULL,
    suggested_start  NVARCHAR(10) NULL,
    duration_minutes INT NULL,
    notes            NVARCHAR(1000) NULL,
    lat              FLOAT NULL,
    lng              FLOAT NULL,
    created_at       DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
  );
  PRINT N'Created trip_plan_items';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_trip_plans_user' AND object_id = OBJECT_ID(N'dbo.trip_plans'))
  CREATE INDEX IX_trip_plans_user ON trip_plans(user_id, created_at DESC);
GO

-- ============================================================
-- 7. Index performance cho bus_stops và tourist_places
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_stops_location' AND object_id = OBJECT_ID(N'dbo.bus_stops'))
  CREATE INDEX IX_bus_stops_location ON bus_stops(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_stops_province' AND object_id = OBJECT_ID(N'dbo.bus_stops'))
  CREATE INDEX IX_bus_stops_province ON bus_stops(province_code);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tourist_places_location' AND object_id = OBJECT_ID(N'dbo.tourist_places'))
  CREATE INDEX IX_tourist_places_location ON tourist_places(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tourist_places_province' AND object_id = OBJECT_ID(N'dbo.tourist_places'))
  CREATE INDEX IX_tourist_places_province ON tourist_places(province_code, is_active);
GO

-- ============================================================
-- 8. community_posts – thêm cột moderated_by nếu thiếu
-- ============================================================
IF OBJECT_ID(N'dbo.community_posts', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.community_posts', N'moderated_by') IS NULL
    ALTER TABLE community_posts ADD moderated_by INT NULL;
  IF COL_LENGTH(N'dbo.community_posts', N'moderated_at') IS NULL
    ALTER TABLE community_posts ADD moderated_at DATETIME2(3) NULL;
END
GO

PRINT N'Migration 10_FIX_CORE_LINKING_PERFORMANCE completed successfully.';
GO
