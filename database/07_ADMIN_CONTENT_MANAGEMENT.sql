/*
 SmartBus V4 - Migration quản trị nội dung
 Bổ sung cột phục vụ duyệt/ẩn nội dung. Script an toàn, không DROP database, không xóa dữ liệu cũ.
*/
USE SmartBusDB;
GO

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.community_reviews', 'review_id') IS NULL ALTER TABLE dbo.community_reviews ADD review_id NVARCHAR(30) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'slug') IS NULL ALTER TABLE dbo.community_reviews ADD slug NVARCHAR(200) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'user_id') IS NULL ALTER TABLE dbo.community_reviews ADD user_id INT NULL;
    IF COL_LENGTH('dbo.community_reviews', 'author_name') IS NULL ALTER TABLE dbo.community_reviews ADD author_name NVARCHAR(150) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'province') IS NULL ALTER TABLE dbo.community_reviews ADD province NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'place_name') IS NULL ALTER TABLE dbo.community_reviews ADD place_name NVARCHAR(200) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'category') IS NULL ALTER TABLE dbo.community_reviews ADD category NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'rating') IS NULL ALTER TABLE dbo.community_reviews ADD rating DECIMAL(3,1) NOT NULL CONSTRAINT DF_community_reviews_rating_admin DEFAULT 5;
    IF COL_LENGTH('dbo.community_reviews', 'title') IS NULL ALTER TABLE dbo.community_reviews ADD title NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'short_caption') IS NULL ALTER TABLE dbo.community_reviews ADD short_caption NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'content') IS NULL ALTER TABLE dbo.community_reviews ADD content NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'tips') IS NULL ALTER TABLE dbo.community_reviews ADD tips NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'tags') IS NULL ALTER TABLE dbo.community_reviews ADD tags NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'source_ref') IS NULL ALTER TABLE dbo.community_reviews ADD source_ref NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'image_url') IS NULL ALTER TABLE dbo.community_reviews ADD image_url NVARCHAR(1000) NULL;
    IF COL_LENGTH('dbo.community_reviews', 'status') IS NULL ALTER TABLE dbo.community_reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_community_reviews_status_admin DEFAULT N'pending';
    IF COL_LENGTH('dbo.community_reviews', 'is_seed') IS NULL ALTER TABLE dbo.community_reviews ADD is_seed BIT NOT NULL CONSTRAINT DF_community_reviews_is_seed_admin DEFAULT 0;
    IF COL_LENGTH('dbo.community_reviews', 'created_at') IS NULL ALTER TABLE dbo.community_reviews ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_community_reviews_created_admin DEFAULT SYSDATETIME();
    IF COL_LENGTH('dbo.community_reviews', 'updated_at') IS NULL ALTER TABLE dbo.community_reviews ADD updated_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.community_reviews', 'approved_at') IS NULL ALTER TABLE dbo.community_reviews ADD approved_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.community_reviews', 'approved_by') IS NULL ALTER TABLE dbo.community_reviews ADD approved_by INT NULL;
    IF COL_LENGTH('dbo.community_reviews', 'hidden_at') IS NULL ALTER TABLE dbo.community_reviews ADD hidden_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.community_reviews', 'hidden_by') IS NULL ALTER TABLE dbo.community_reviews ADD hidden_by INT NULL;
END
GO

IF OBJECT_ID(N'dbo.community_posts', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.community_posts', 'status') IS NULL ALTER TABLE dbo.community_posts ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_community_posts_status_admin DEFAULT N'pending';
    IF COL_LENGTH('dbo.community_posts', 'updated_at') IS NULL ALTER TABLE dbo.community_posts ADD updated_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.community_posts', 'moderated_at') IS NULL ALTER TABLE dbo.community_posts ADD moderated_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.community_posts', 'moderated_by') IS NULL ALTER TABLE dbo.community_posts ADD moderated_by INT NULL;
END
GO

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.reviews', 'status') IS NULL ALTER TABLE dbo.reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_reviews_status_admin DEFAULT N'pending';
    IF COL_LENGTH('dbo.reviews', 'updated_at') IS NULL ALTER TABLE dbo.reviews ADD updated_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.reviews', 'moderated_at') IS NULL ALTER TABLE dbo.reviews ADD moderated_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.reviews', 'moderated_by') IS NULL ALTER TABLE dbo.reviews ADD moderated_by INT NULL;
END
GO

IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.tourist_places', 'province_code') IS NULL ALTER TABLE dbo.tourist_places ADD province_code NVARCHAR(30) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'short_description') IS NULL ALTER TABLE dbo.tourist_places ADD short_description NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'best_time') IS NULL ALTER TABLE dbo.tourist_places ADD best_time NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'nearby_suggestions') IS NULL ALTER TABLE dbo.tourist_places ADD nearby_suggestions NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'tags') IS NULL ALTER TABLE dbo.tourist_places ADD tags NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'is_active') IS NULL ALTER TABLE dbo.tourist_places ADD is_active BIT NOT NULL CONSTRAINT DF_tourist_places_is_active_admin DEFAULT 1;
    IF COL_LENGTH('dbo.tourist_places', 'updated_at') IS NULL ALTER TABLE dbo.tourist_places ADD updated_at DATETIME2 NULL;
END
GO

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_admin_status' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
BEGIN
    CREATE INDEX IX_community_reviews_admin_status ON dbo.community_reviews(status, province, category, created_at);
END
GO

PRINT N'Hoàn tất migration 07_ADMIN_CONTENT_MANAGEMENT.sql';
