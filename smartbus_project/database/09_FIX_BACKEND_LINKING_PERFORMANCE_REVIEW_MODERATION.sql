/*
  SmartBus Travel - Fix backend linking, performance indexes, favorites and review moderation.
  Safe migration: no DROP TABLE, no DELETE, preserves existing data.
  Run this in SmartBusDB after the core schema/import scripts.
*/

IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.favorite_places (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    place_id INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_favorite_places_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_favorite_places_user_place UNIQUE(user_id, place_id)
  );
END;

IF OBJECT_ID(N'dbo.favorites_places', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.favorites_places (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    place_id INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_favorites_places_created_at_fix09 DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_favorites_places_user_place_fix09 UNIQUE(user_id, place_id)
  );
END;

IF OBJECT_ID(N'dbo.place_favorites', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.place_favorites (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    place_id INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_place_favorites_created_at_fix09 DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_place_favorites_user_place_fix09 UNIQUE(user_id, place_id)
  );
END;

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
    created_at DATETIME2 NOT NULL CONSTRAINT DF_activity_logs_created_at_fix09 DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.reviews', 'status') IS NULL
  ALTER TABLE dbo.reviews ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_reviews_status_fix09 DEFAULT N'pending';

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_reviews', 'status') IS NULL
  ALTER TABLE dbo.community_reviews ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_community_reviews_status_fix09 DEFAULT N'pending';

IF OBJECT_ID(N'dbo.community_posts', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_posts', 'status') IS NULL
  ALTER TABLE dbo.community_posts ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_community_posts_status_fix09 DEFAULT N'pending';

IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_favorite_places_user_place' AND object_id = OBJECT_ID(N'dbo.favorite_places'))
  CREATE INDEX IX_favorite_places_user_place ON dbo.favorite_places(user_id, place_id);

IF OBJECT_ID(N'dbo.favorites_places', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_favorites_places_user_place_fix09' AND object_id = OBJECT_ID(N'dbo.favorites_places'))
  CREATE INDEX IX_favorites_places_user_place_fix09 ON dbo.favorites_places(user_id, place_id);

IF OBJECT_ID(N'dbo.place_favorites', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_place_favorites_user_place_fix09' AND object_id = OBJECT_ID(N'dbo.place_favorites'))
  CREATE INDEX IX_place_favorites_user_place_fix09 ON dbo.place_favorites(user_id, place_id);

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_user_created_fix09' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_user_created_fix09 ON dbo.activity_logs(user_id, created_at DESC);

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_activity_logs_created_fix09' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_created_fix09 ON dbo.activity_logs(created_at DESC);

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_reviews_status_created_fix09' AND object_id = OBJECT_ID(N'dbo.reviews'))
  CREATE INDEX IX_reviews_status_created_fix09 ON dbo.reviews(status, created_at DESC);

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_status_created_fix09' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
  CREATE INDEX IX_community_reviews_status_created_fix09 ON dbo.community_reviews(status, created_at DESC);

IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tourist_places_province_category_fix09' AND object_id = OBJECT_ID(N'dbo.tourist_places'))
  CREATE INDEX IX_tourist_places_province_category_fix09 ON dbo.tourist_places(province_code, category_id, is_active);

IF OBJECT_ID(N'dbo.bus_stops', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bus_stops_lat_lng_fix09' AND object_id = OBJECT_ID(N'dbo.bus_stops'))
  CREATE INDEX IX_bus_stops_lat_lng_fix09 ON dbo.bus_stops(latitude, longitude) INCLUDE(name, address, province_code);

IF OBJECT_ID(N'dbo.favorite_places', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.favorites_places', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.favorites_places(user_id, place_id, created_at)
  SELECT fp.user_id, fp.place_id, MIN(fp.created_at)
  FROM dbo.favorite_places fp
  WHERE NOT EXISTS (SELECT 1 FROM dbo.favorites_places x WHERE x.user_id = fp.user_id AND x.place_id = fp.place_id)
  GROUP BY fp.user_id, fp.place_id;
END;
