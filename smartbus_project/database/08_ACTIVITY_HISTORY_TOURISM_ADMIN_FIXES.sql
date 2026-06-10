/*
  SmartBus Travel - tourism/favorites/activity/admin hotfix migration
  Safe migration: no DROP TABLE, preserves existing data.
*/

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
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.favorites_places', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.favorites_places (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    place_id INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_favorites_places_user_place UNIQUE(user_id, place_id)
  );
END;

IF OBJECT_ID(N'dbo.place_favorites', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.place_favorites (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    place_id INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_place_favorites_user_place UNIQUE(user_id, place_id)
  );
END;

IF OBJECT_ID(N'dbo.favorites_routes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.favorites_routes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    route_id NVARCHAR(60) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_favorites_routes_user_route UNIQUE(user_id, route_id)
  );
END;

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_reviews', 'status') IS NULL
  ALTER TABLE dbo.community_reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_community_reviews_status DEFAULT N'pending';

IF OBJECT_ID(N'dbo.community_posts', N'U') IS NOT NULL AND COL_LENGTH('dbo.community_posts', 'status') IS NULL
  ALTER TABLE dbo.community_posts ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_community_posts_status DEFAULT N'pending';

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL AND COL_LENGTH('dbo.reviews', 'status') IS NULL
  ALTER TABLE dbo.reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_reviews_status DEFAULT N'pending';

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activity_logs_user_created' AND object_id = OBJECT_ID('dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_user_created ON dbo.activity_logs(user_id, created_at DESC);

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activity_logs_type_created' AND object_id = OBJECT_ID('dbo.activity_logs'))
  CREATE INDEX IX_activity_logs_type_created ON dbo.activity_logs(action_type, created_at DESC);

IF OBJECT_ID(N'dbo.favorites_places', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_favorites_places_user_created' AND object_id = OBJECT_ID('dbo.favorites_places'))
  CREATE INDEX IX_favorites_places_user_created ON dbo.favorites_places(user_id, created_at DESC);

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_community_reviews_status_created' AND object_id = OBJECT_ID('dbo.community_reviews'))
  CREATE INDEX IX_community_reviews_status_created ON dbo.community_reviews(status, created_at DESC);

IF OBJECT_ID(N'dbo.community_posts', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_community_posts_status_created' AND object_id = OBJECT_ID('dbo.community_posts'))
  CREATE INDEX IX_community_posts_status_created ON dbo.community_posts(status, created_at DESC);

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_reviews_status_created' AND object_id = OBJECT_ID('dbo.reviews'))
  CREATE INDEX IX_reviews_status_created ON dbo.reviews(status, created_at DESC);
