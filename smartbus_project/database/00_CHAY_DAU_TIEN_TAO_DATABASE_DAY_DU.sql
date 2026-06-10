/*
  SMARTBUS - SCRIPT DATABASE DAY DU
  CACH DUNG:
  1) Mo SQL Server Management Studio.
  2) Dang nhap bang Windows Authentication hoac sa.
  3) Mo file nay, bam Execute.
  4) Sau khi xong, qua backend-api chay: npm install, npm run check:db, npm run dev.

  File nay se:
  - Tao database SmartBusDB neu chua co.
  - Tao SQL Login SmartBusUser / SmartBus@123456.
  - Cap quyen db_owner cho SmartBusUser trong SmartBusDB.
  - Tao day du bang can thiet.
  - Nap du lieu mau cho tuyen xe, ben xe, dia diem du lich.
  - Tao san tai khoan admin that trong bang users.
*/

USE master;
GO

IF DB_ID('SmartBusDB') IS NULL
BEGIN
    CREATE DATABASE SmartBusDB;
END
GO

IF NOT EXISTS (SELECT name FROM sys.sql_logins WHERE name = 'SmartBusUser')
BEGIN
    CREATE LOGIN SmartBusUser
    WITH PASSWORD = 'SmartBus@123456', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
END
ELSE
BEGIN
    ALTER LOGIN SmartBusUser ENABLE;
    ALTER LOGIN SmartBusUser
    WITH PASSWORD = 'SmartBus@123456', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
END
GO

USE SmartBusDB;
GO

/* SmartBus v3.1: widen text columns to prevent SQL Server truncation during GIS import */
IF OBJECT_ID('bus_routes','U') IS NOT NULL
BEGIN
    IF COL_LENGTH('bus_routes','fare') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN fare NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','operating_time') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN operating_time NVARCHAR(1000) NULL;
    IF COL_LENGTH('bus_routes','interval_text') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN interval_text NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','first_trip_time') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN first_trip_time NVARCHAR(200) NULL;
    IF COL_LENGTH('bus_routes','last_trip_time') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN last_trip_time NVARCHAR(200) NULL;
    IF COL_LENGTH('bus_routes','operation_days') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN operation_days NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','lunch_start_time') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN lunch_start_time NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','lunch_end_time') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN lunch_end_time NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','operating_hours') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN operating_hours NVARCHAR(1000) NULL;
    IF COL_LENGTH('bus_routes','frequency_text') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN frequency_text NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','speed_range_text') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN speed_range_text NVARCHAR(500) NULL;
    IF COL_LENGTH('bus_routes','break_time_text') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN break_time_text NVARCHAR(1000) NULL;
    IF COL_LENGTH('bus_routes','source_text') IS NOT NULL ALTER TABLE bus_routes ALTER COLUMN source_text NVARCHAR(2000) NULL;
END
GO
IF OBJECT_ID('bus_stops','U') IS NOT NULL
BEGIN
    IF COL_LENGTH('bus_stops','address') IS NOT NULL ALTER TABLE bus_stops ALTER COLUMN address NVARCHAR(500) NULL;
END
GO
IF OBJECT_ID('tourist_places','U') IS NOT NULL
BEGIN
    IF COL_LENGTH('tourist_places','address') IS NOT NULL ALTER TABLE tourist_places ALTER COLUMN address NVARCHAR(500) NULL;
    IF COL_LENGTH('tourist_places','opening_hours') IS NOT NULL ALTER TABLE tourist_places ALTER COLUMN opening_hours NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'SmartBusUser')
BEGIN
    CREATE USER SmartBusUser FOR LOGIN SmartBusUser;
END
GO

ALTER ROLE db_owner ADD MEMBER SmartBusUser;
GO

PRINT 'Da tao database SmartBusDB va user SmartBusUser.';
GO

/*
  SmartBusDB schema for SQL Server
  Chạy file này trong SQL Server Management Studio trước khi chạy backend.
  File này KHÔNG drop bảng cũ, có thể dùng để nâng cấp database SmartBusDB đã tạo trước đó.
*/

IF DB_ID('SmartBusDB') IS NULL
BEGIN
    CREATE DATABASE SmartBusDB;
END
GO

USE SmartBusDB;
GO

IF OBJECT_ID('users','U') IS NULL
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(100) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        phone NVARCHAR(30) NULL,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL
    );
END
GO
IF COL_LENGTH('users','phone') IS NULL ALTER TABLE users ADD phone NVARCHAR(30) NULL;
IF COL_LENGTH('users','is_active') IS NULL ALTER TABLE users ADD is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT 1;
IF COL_LENGTH('users','updated_at') IS NULL ALTER TABLE users ADD updated_at DATETIME2 NULL;
GO

IF OBJECT_ID('refresh_tokens','U') IS NULL
BEGIN
    CREATE TABLE refresh_tokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash NVARCHAR(255) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        revoked_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_refresh_tokens_users FOREIGN KEY (user_id) REFERENCES users(id)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_refresh_tokens_token_hash' AND object_id=OBJECT_ID('refresh_tokens'))
    CREATE INDEX IX_refresh_tokens_token_hash ON refresh_tokens(token_hash);
GO

IF OBJECT_ID('bus_stops','U') IS NULL
BEGIN
    CREATE TABLE bus_stops (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        address NVARCHAR(500) NULL,
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO
IF COL_LENGTH('bus_stops','latitude') IS NULL ALTER TABLE bus_stops ADD latitude FLOAT NULL;
IF COL_LENGTH('bus_stops','longitude') IS NULL ALTER TABLE bus_stops ADD longitude FLOAT NULL;
GO

IF OBJECT_ID('bus_routes','U') IS NULL
BEGIN
    CREATE TABLE bus_routes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        route_code NVARCHAR(50) NOT NULL UNIQUE,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NULL,
        start_stop_id INT NULL,
        end_stop_id INT NULL,
        type NVARCHAR(60) NULL,
        fare NVARCHAR(500) NULL,
        color NVARCHAR(20) NULL,
        operating_time NVARCHAR(1000) NULL,
        interval_text NVARCHAR(500) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_bus_routes_start_stop FOREIGN KEY (start_stop_id) REFERENCES bus_stops(id),
        CONSTRAINT FK_bus_routes_end_stop FOREIGN KEY (end_stop_id) REFERENCES bus_stops(id)
    );
END
GO
IF COL_LENGTH('bus_routes','type') IS NULL ALTER TABLE bus_routes ADD type NVARCHAR(60) NULL;
IF COL_LENGTH('bus_routes','fare') IS NULL ALTER TABLE bus_routes ADD fare NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','color') IS NULL ALTER TABLE bus_routes ADD color NVARCHAR(20) NULL;
IF COL_LENGTH('bus_routes','operating_time') IS NULL ALTER TABLE bus_routes ADD operating_time NVARCHAR(1000) NULL;
IF COL_LENGTH('bus_routes','interval_text') IS NULL ALTER TABLE bus_routes ADD interval_text NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','is_active') IS NULL ALTER TABLE bus_routes ADD is_active BIT NOT NULL CONSTRAINT DF_bus_routes_is_active DEFAULT 1;
GO

IF OBJECT_ID('buses','U') IS NULL
BEGIN
    CREATE TABLE buses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        bus_code NVARCHAR(30) NOT NULL UNIQUE,
        plate NVARCHAR(30) NOT NULL,
        route_code NVARCHAR(50) NOT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'active',
        capacity INT NOT NULL DEFAULT 40,
        speed_kmh FLOAT NOT NULL DEFAULT 22,
        progress FLOAT NOT NULL DEFAULT 0,
        crowding NVARCHAR(30) NOT NULL DEFAULT 'quiet',
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_buses_bus_routes FOREIGN KEY(route_code) REFERENCES bus_routes(route_code)
    );
END
GO

IF OBJECT_ID('tourist_categories','U') IS NULL
BEGIN
    CREATE TABLE tourist_categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(40) NOT NULL UNIQUE,
        name NVARCHAR(80) NOT NULL,
        icon NVARCHAR(40) NULL,
        sort_order INT NOT NULL DEFAULT 100,
        is_active BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID('tourist_places','U') IS NULL
BEGIN
    CREATE TABLE tourist_places (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        slug NVARCHAR(180) NULL,
        address NVARCHAR(500) NULL,
        description NVARCHAR(MAX) NULL,
        category_id INT NULL,
        image_url NVARCHAR(500) NULL,
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        nearest_stop_id INT NULL,
        opening_hours NVARCHAR(255) NULL,
        suggested_duration_minutes INT NOT NULL DEFAULT 90,
        min_budget INT NULL,
        max_budget INT NULL,
        average_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
        review_count INT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_tourist_places_bus_stops FOREIGN KEY (nearest_stop_id) REFERENCES bus_stops(id),
        CONSTRAINT FK_tourist_places_categories FOREIGN KEY (category_id) REFERENCES tourist_categories(id)
    );
END
GO
IF COL_LENGTH('tourist_places','slug') IS NULL ALTER TABLE tourist_places ADD slug NVARCHAR(180) NULL;
IF COL_LENGTH('tourist_places','category_id') IS NULL ALTER TABLE tourist_places ADD category_id INT NULL;
IF COL_LENGTH('tourist_places','opening_hours') IS NULL ALTER TABLE tourist_places ADD opening_hours NVARCHAR(255) NULL;
IF COL_LENGTH('tourist_places','suggested_duration_minutes') IS NULL ALTER TABLE tourist_places ADD suggested_duration_minutes INT NOT NULL CONSTRAINT DF_tourist_places_duration DEFAULT 90;
IF COL_LENGTH('tourist_places','min_budget') IS NULL ALTER TABLE tourist_places ADD min_budget INT NULL;
IF COL_LENGTH('tourist_places','max_budget') IS NULL ALTER TABLE tourist_places ADD max_budget INT NULL;
IF COL_LENGTH('tourist_places','average_rating') IS NULL ALTER TABLE tourist_places ADD average_rating DECIMAL(3,2) NOT NULL CONSTRAINT DF_tourist_places_rating DEFAULT 0;
IF COL_LENGTH('tourist_places','review_count') IS NULL ALTER TABLE tourist_places ADD review_count INT NOT NULL CONSTRAINT DF_tourist_places_review_count DEFAULT 0;
IF COL_LENGTH('tourist_places','is_active') IS NULL ALTER TABLE tourist_places ADD is_active BIT NOT NULL CONSTRAINT DF_tourist_places_is_active DEFAULT 1;
IF COL_LENGTH('tourist_places','updated_at') IS NULL ALTER TABLE tourist_places ADD updated_at DATETIME2 NULL;
GO

IF OBJECT_ID('place_nearby_stops','U') IS NULL
BEGIN
    CREATE TABLE place_nearby_stops (
        id INT IDENTITY(1,1) PRIMARY KEY,
        place_id INT NOT NULL,
        stop_id INT NOT NULL,
        route_code NVARCHAR(50) NOT NULL,
        distance_meters INT NOT NULL DEFAULT 0,
        walking_minutes INT NOT NULL DEFAULT 0,
        note NVARCHAR(255) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_place_nearby_stops_places FOREIGN KEY(place_id) REFERENCES tourist_places(id),
        CONSTRAINT FK_place_nearby_stops_stops FOREIGN KEY(stop_id) REFERENCES bus_stops(id)
    );
END
GO

IF OBJECT_ID('reviews','U') IS NULL
BEGIN
    CREATE TABLE reviews (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        place_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment NVARCHAR(MAX) NULL,
        content NVARCHAR(MAX) NULL,
        route_code NVARCHAR(50) NULL,
        stop_id INT NULL,
        visit_date DATE NULL,
        tags NVARCHAR(500) NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'approved',
        helpful_count INT NOT NULL DEFAULT 0,
        moderated_by INT NULL,
        moderated_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_reviews_users FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT FK_reviews_places FOREIGN KEY (place_id) REFERENCES tourist_places(id)
    );
END
GO
IF COL_LENGTH('reviews','content') IS NULL ALTER TABLE reviews ADD content NVARCHAR(MAX) NULL;
IF COL_LENGTH('reviews','route_code') IS NULL ALTER TABLE reviews ADD route_code NVARCHAR(50) NULL;
IF COL_LENGTH('reviews','stop_id') IS NULL ALTER TABLE reviews ADD stop_id INT NULL;
IF COL_LENGTH('reviews','visit_date') IS NULL ALTER TABLE reviews ADD visit_date DATE NULL;
IF COL_LENGTH('reviews','tags') IS NULL ALTER TABLE reviews ADD tags NVARCHAR(500) NULL;
IF COL_LENGTH('reviews','status') IS NULL ALTER TABLE reviews ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_reviews_status DEFAULT 'approved';
IF COL_LENGTH('reviews','helpful_count') IS NULL ALTER TABLE reviews ADD helpful_count INT NOT NULL CONSTRAINT DF_reviews_helpful DEFAULT 0;
IF COL_LENGTH('reviews','moderated_by') IS NULL ALTER TABLE reviews ADD moderated_by INT NULL;
IF COL_LENGTH('reviews','moderated_at') IS NULL ALTER TABLE reviews ADD moderated_at DATETIME2 NULL;
IF COL_LENGTH('reviews','updated_at') IS NULL ALTER TABLE reviews ADD updated_at DATETIME2 NULL;
GO

IF OBJECT_ID('review_votes','U') IS NULL
BEGIN
    CREATE TABLE review_votes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        review_id INT NOT NULL,
        user_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_review_votes_reviews FOREIGN KEY(review_id) REFERENCES reviews(id),
        CONSTRAINT FK_review_votes_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO
IF OBJECT_ID('review_votes','U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_review_votes_review_user' AND object_id = OBJECT_ID(N'dbo.review_votes'))
        DROP INDEX UX_review_votes_review_user ON dbo.review_votes;

    ALTER TABLE dbo.review_votes ALTER COLUMN user_id INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_review_votes_review_user' AND object_id = OBJECT_ID(N'dbo.review_votes'))
       AND NOT EXISTS (
            SELECT 1 FROM dbo.review_votes
            WHERE user_id IS NOT NULL
            GROUP BY review_id, user_id
            HAVING COUNT(*) > 1
       )
    BEGIN
        CREATE UNIQUE INDEX UX_review_votes_review_user
        ON dbo.review_votes(review_id, user_id)
        WHERE user_id IS NOT NULL;
    END
END
GO

IF OBJECT_ID('review_reports','U') IS NULL
BEGIN
    CREATE TABLE review_reports (
        id INT IDENTITY(1,1) PRIMARY KEY,
        review_id INT NOT NULL,
        user_id INT NULL,
        reason NVARCHAR(255) NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'new',
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_review_reports_reviews FOREIGN KEY(review_id) REFERENCES reviews(id),
        CONSTRAINT FK_review_reports_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO

IF OBJECT_ID('place_favorites','U') IS NULL
BEGIN
    CREATE TABLE place_favorites (
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        PRIMARY KEY(user_id, place_id),
        CONSTRAINT FK_place_favorites_users FOREIGN KEY(user_id) REFERENCES users(id),
        CONSTRAINT FK_place_favorites_places FOREIGN KEY(place_id) REFERENCES tourist_places(id)
    );
END
GO

IF OBJECT_ID('reports','U') IS NULL
BEGIN
    CREATE TABLE reports (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        route_code NVARCHAR(50) NULL,
        plate NVARCHAR(30) NULL,
        crowding NVARCHAR(30) NULL,
        problem_type NVARCHAR(60) NOT NULL DEFAULT 'crowding',
        note NVARCHAR(500) NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'new',
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_reports_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO

IF OBJECT_ID('chatbot_logs','U') IS NULL
BEGIN
    CREATE TABLE chatbot_logs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        question NVARCHAR(MAX) NOT NULL,
        answer NVARCHAR(MAX) NOT NULL,
        intent NVARCHAR(80) NULL,
        lat FLOAT NULL,
        lng FLOAT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_chatbot_logs_users FOREIGN KEY (user_id) REFERENCES users(id)
    );
END
GO
IF COL_LENGTH('chatbot_logs','intent') IS NULL ALTER TABLE chatbot_logs ADD intent NVARCHAR(80) NULL;
IF COL_LENGTH('chatbot_logs','lat') IS NULL ALTER TABLE chatbot_logs ADD lat FLOAT NULL;
IF COL_LENGTH('chatbot_logs','lng') IS NULL ALTER TABLE chatbot_logs ADD lng FLOAT NULL;
GO

IF OBJECT_ID('community_posts','U') IS NULL
BEGIN
    CREATE TABLE community_posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        title NVARCHAR(180) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        topic NVARCHAR(60) NULL,
        route_code NVARCHAR(50) NULL,
        place_id INT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'pending',
        votes INT NOT NULL DEFAULT 0,
        moderated_by INT NULL,
        moderated_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_community_posts_users FOREIGN KEY(user_id) REFERENCES users(id),
        CONSTRAINT FK_community_posts_places FOREIGN KEY(place_id) REFERENCES tourist_places(id)
    );
END
GO

IF OBJECT_ID('post_comments','U') IS NULL
BEGIN
    CREATE TABLE post_comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NULL,
        content NVARCHAR(MAX) NOT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'approved',
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_post_comments_posts FOREIGN KEY(post_id) REFERENCES community_posts(id),
        CONSTRAINT FK_post_comments_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO

IF OBJECT_ID('post_votes','U') IS NULL
BEGIN
    CREATE TABLE post_votes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_post_votes_posts FOREIGN KEY(post_id) REFERENCES community_posts(id),
        CONSTRAINT FK_post_votes_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO
IF OBJECT_ID('post_votes','U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_post_votes_post_user' AND object_id = OBJECT_ID(N'dbo.post_votes'))
        DROP INDEX UX_post_votes_post_user ON dbo.post_votes;

    ALTER TABLE dbo.post_votes ALTER COLUMN user_id INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_post_votes_post_user' AND object_id = OBJECT_ID(N'dbo.post_votes'))
       AND NOT EXISTS (
            SELECT 1 FROM dbo.post_votes
            WHERE user_id IS NOT NULL
            GROUP BY post_id, user_id
            HAVING COUNT(*) > 1
       )
    BEGIN
        CREATE UNIQUE INDEX UX_post_votes_post_user
        ON dbo.post_votes(post_id, user_id)
        WHERE user_id IS NOT NULL;
    END
END
GO

IF OBJECT_ID('trip_plans','U') IS NULL
BEGIN
    CREATE TABLE trip_plans (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        title NVARCHAR(180) NOT NULL,
        time_available NVARCHAR(80) NULL,
        interests NVARCHAR(255) NULL,
        budget NVARCHAR(40) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_trip_plans_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO

IF OBJECT_ID('trip_plan_items','U') IS NULL
BEGIN
    CREATE TABLE trip_plan_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trip_plan_id INT NOT NULL,
        sequence_no INT NOT NULL,
        place_id INT NULL,
        route_code NVARCHAR(50) NULL,
        stop_id INT NULL,
        estimated_stay_minutes INT NULL,
        CONSTRAINT FK_trip_plan_items_plans FOREIGN KEY(trip_plan_id) REFERENCES trip_plans(id),
        CONSTRAINT FK_trip_plan_items_places FOREIGN KEY(place_id) REFERENCES tourist_places(id)
    );
END
GO

IF OBJECT_ID('notifications','U') IS NULL
BEGIN
    CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        title NVARCHAR(180) NOT NULL,
        content NVARCHAR(500) NULL,
        type NVARCHAR(40) NOT NULL DEFAULT 'info',
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_notifications_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO


/* ==========================================================
   SmartBus V3 GIS + Import + RBAC extension
   - Bổ sung bảng/column để dùng dữ liệu Excel/CSV/JSON thật.
   - Có thể chạy lại nhiều lần, không drop dữ liệu cũ.
   ========================================================== */

IF OBJECT_ID('roles','U') IS NULL
BEGIN
    CREATE TABLE roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(50) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID('permissions','U') IS NULL
BEGIN
    CREATE TABLE permissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(80) NOT NULL UNIQUE,
        name NVARCHAR(120) NOT NULL,
        description NVARCHAR(255) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID('role_permissions','U') IS NULL
BEGIN
    CREATE TABLE role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        PRIMARY KEY(role_id, permission_id),
        CONSTRAINT FK_role_permissions_roles FOREIGN KEY(role_id) REFERENCES roles(id),
        CONSTRAINT FK_role_permissions_permissions FOREIGN KEY(permission_id) REFERENCES permissions(id)
    );
END
GO

IF OBJECT_ID('user_roles','U') IS NULL
BEGIN
    CREATE TABLE user_roles (
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        PRIMARY KEY(user_id, role_id),
        CONSTRAINT FK_user_roles_users FOREIGN KEY(user_id) REFERENCES users(id),
        CONSTRAINT FK_user_roles_roles FOREIGN KEY(role_id) REFERENCES roles(id)
    );
END
GO

IF OBJECT_ID('provinces','U') IS NULL
BEGIN
    CREATE TABLE provinces (
        code NVARCHAR(20) NOT NULL PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        region NVARCHAR(120) NULL,
        country NVARCHAR(80) NULL,
        note NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL
    );
END
GO

IF COL_LENGTH('bus_stops','external_stop_code') IS NULL ALTER TABLE bus_stops ADD external_stop_code NVARCHAR(120) NULL;
IF COL_LENGTH('bus_stops','province_code') IS NULL ALTER TABLE bus_stops ADD province_code NVARCHAR(20) NULL;
IF COL_LENGTH('bus_stops','note') IS NULL ALTER TABLE bus_stops ADD note NVARCHAR(MAX) NULL;
IF COL_LENGTH('bus_stops','stop_type') IS NULL ALTER TABLE bus_stops ADD stop_type NVARCHAR(80) NULL;
IF COL_LENGTH('bus_stops','ward') IS NULL ALTER TABLE bus_stops ADD ward NVARCHAR(120) NULL;
IF COL_LENGTH('bus_stops','district') IS NULL ALTER TABLE bus_stops ADD district NVARCHAR(120) NULL;
IF COL_LENGTH('bus_stops','nearby_landmark') IS NULL ALTER TABLE bus_stops ADD nearby_landmark NVARCHAR(255) NULL;
IF COL_LENGTH('bus_stops','is_major') IS NULL ALTER TABLE bus_stops ADD is_major BIT NOT NULL CONSTRAINT DF_bus_stops_is_major DEFAULT 0;
IF COL_LENGTH('bus_stops','source_url') IS NULL ALTER TABLE bus_stops ADD source_url NVARCHAR(2000) NULL;
IF COL_LENGTH('bus_stops','source_name') IS NULL ALTER TABLE bus_stops ADD source_name NVARCHAR(500) NULL;
IF COL_LENGTH('bus_stops','checked_at') IS NULL ALTER TABLE bus_stops ADD checked_at DATE NULL;
IF COL_LENGTH('bus_stops','reliability_level') IS NULL ALTER TABLE bus_stops ADD reliability_level NVARCHAR(80) NULL;
IF COL_LENGTH('bus_stops','coordinate_type') IS NULL ALTER TABLE bus_stops ADD coordinate_type NVARCHAR(120) NULL;
IF COL_LENGTH('bus_stops','google_maps_url') IS NULL ALTER TABLE bus_stops ADD google_maps_url NVARCHAR(1000) NULL;
IF COL_LENGTH('bus_stops','accuracy_note') IS NULL ALTER TABLE bus_stops ADD accuracy_note NVARCHAR(MAX) NULL;
IF COL_LENGTH('bus_stops','updated_at') IS NULL ALTER TABLE bus_stops ADD updated_at DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_bus_stops_external_stop_code' AND object_id=OBJECT_ID('bus_stops'))
    CREATE UNIQUE INDEX UX_bus_stops_external_stop_code ON bus_stops(external_stop_code) WHERE external_stop_code IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_bus_stops_province_type' AND object_id=OBJECT_ID('bus_stops'))
    CREATE INDEX IX_bus_stops_province_type ON bus_stops(province_code, stop_type);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_bus_stops_lat_lng' AND object_id=OBJECT_ID('bus_stops'))
    CREATE INDEX IX_bus_stops_lat_lng ON bus_stops(latitude, longitude);
GO

IF COL_LENGTH('bus_routes','external_route_code') IS NULL ALTER TABLE bus_routes ADD external_route_code NVARCHAR(120) NULL;
IF COL_LENGTH('bus_routes','province_code') IS NULL ALTER TABLE bus_routes ADD province_code NVARCHAR(20) NULL;
IF COL_LENGTH('bus_routes','route_number') IS NULL ALTER TABLE bus_routes ADD route_number NVARCHAR(30) NULL;
IF COL_LENGTH('bus_routes','operator_name') IS NULL ALTER TABLE bus_routes ADD operator_name NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','origin_name') IS NULL ALTER TABLE bus_routes ADD origin_name NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','destination_name') IS NULL ALTER TABLE bus_routes ADD destination_name NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','distance_km') IS NULL ALTER TABLE bus_routes ADD distance_km DECIMAL(10,2) NULL;
IF COL_LENGTH('bus_routes','estimated_minutes') IS NULL ALTER TABLE bus_routes ADD estimated_minutes INT NULL;
IF COL_LENGTH('bus_routes','first_trip_time') IS NULL ALTER TABLE bus_routes ADD first_trip_time NVARCHAR(200) NULL;
IF COL_LENGTH('bus_routes','last_trip_time') IS NULL ALTER TABLE bus_routes ADD last_trip_time NVARCHAR(200) NULL;
IF COL_LENGTH('bus_routes','operation_days') IS NULL ALTER TABLE bus_routes ADD operation_days NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','peak_interval_minutes') IS NULL ALTER TABLE bus_routes ADD peak_interval_minutes INT NULL;
IF COL_LENGTH('bus_routes','offpeak_interval_minutes') IS NULL ALTER TABLE bus_routes ADD offpeak_interval_minutes INT NULL;
IF COL_LENGTH('bus_routes','lunch_start_time') IS NULL ALTER TABLE bus_routes ADD lunch_start_time NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','lunch_end_time') IS NULL ALTER TABLE bus_routes ADD lunch_end_time NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','break_minutes') IS NULL ALTER TABLE bus_routes ADD break_minutes INT NULL;
IF COL_LENGTH('bus_routes','vehicle_count') IS NULL ALTER TABLE bus_routes ADD vehicle_count INT NULL;
IF COL_LENGTH('bus_routes','status_text') IS NULL ALTER TABLE bus_routes ADD status_text NVARCHAR(1000) NULL;
IF COL_LENGTH('bus_routes','source_url') IS NULL ALTER TABLE bus_routes ADD source_url NVARCHAR(2000) NULL;
IF COL_LENGTH('bus_routes','source_name') IS NULL ALTER TABLE bus_routes ADD source_name NVARCHAR(500) NULL;
IF COL_LENGTH('bus_routes','reliability_level') IS NULL ALTER TABLE bus_routes ADD reliability_level NVARCHAR(80) NULL;
IF COL_LENGTH('bus_routes','avg_speed_kmh') IS NULL ALTER TABLE bus_routes ADD avg_speed_kmh DECIMAL(10,2) NULL;
IF COL_LENGTH('bus_routes','min_speed_kmh') IS NULL ALTER TABLE bus_routes ADD min_speed_kmh DECIMAL(10,2) NULL;
IF COL_LENGTH('bus_routes','max_speed_kmh') IS NULL ALTER TABLE bus_routes ADD max_speed_kmh DECIMAL(10,2) NULL;
IF COL_LENGTH('bus_routes','speed_note') IS NULL ALTER TABLE bus_routes ADD speed_note NVARCHAR(MAX) NULL;
IF COL_LENGTH('bus_routes','checked_at') IS NULL ALTER TABLE bus_routes ADD checked_at DATE NULL;
IF COL_LENGTH('bus_routes','updated_at') IS NULL ALTER TABLE bus_routes ADD updated_at DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_bus_routes_external_route_code' AND object_id=OBJECT_ID('bus_routes'))
    CREATE UNIQUE INDEX UX_bus_routes_external_route_code ON bus_routes(external_route_code) WHERE external_route_code IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_bus_routes_province_number' AND object_id=OBJECT_ID('bus_routes'))
    CREATE INDEX IX_bus_routes_province_number ON bus_routes(province_code, route_number);
GO

IF OBJECT_ID('route_stops','U') IS NULL
BEGIN
    CREATE TABLE route_stops (
        id INT IDENTITY(1,1) PRIMARY KEY,
        external_route_stop_code NVARCHAR(120) NULL,
        route_code NVARCHAR(50) NOT NULL,
        stop_id INT NOT NULL,
        external_stop_code NVARCHAR(120) NULL,
        direction NVARCHAR(60) NOT NULL DEFAULT N'chiều_đi',
        sequence_no INT NOT NULL,
        distance_from_previous_km DECIMAL(10,3) NULL,
        minutes_from_previous INT NULL,
        source_url NVARCHAR(2000) NULL,
        reliability_level NVARCHAR(80) NULL,
        note NVARCHAR(MAX) NULL,
        google_maps_url NVARCHAR(1000) NULL,
        accuracy_note NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_route_stops_routes FOREIGN KEY(route_code) REFERENCES bus_routes(route_code),
        CONSTRAINT FK_route_stops_stops FOREIGN KEY(stop_id) REFERENCES bus_stops(id)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_route_stops_route_dir_seq' AND object_id=OBJECT_ID('route_stops'))
    CREATE UNIQUE INDEX UX_route_stops_route_dir_seq ON route_stops(route_code, direction, sequence_no);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_route_stops_stop' AND object_id=OBJECT_ID('route_stops'))
    CREATE INDEX IX_route_stops_stop ON route_stops(stop_id);
GO

IF OBJECT_ID('bus_vehicles','U') IS NULL
BEGIN
    CREATE TABLE bus_vehicles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vehicle_code NVARCHAR(60) NOT NULL UNIQUE,
        plate NVARCHAR(30) NOT NULL,
        route_code NVARCHAR(50) NOT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'active',
        capacity INT NOT NULL DEFAULT 40,
        avg_speed_kmh DECIMAL(10,2) NULL,
        min_speed_kmh DECIMAL(10,2) NULL,
        max_speed_kmh DECIMAL(10,2) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_bus_vehicles_routes FOREIGN KEY(route_code) REFERENCES bus_routes(route_code)
    );
END
GO
IF OBJECT_ID('vehicle_locations','U') IS NULL
BEGIN
    CREATE TABLE vehicle_locations (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vehicle_id INT NULL,
        vehicle_code NVARCHAR(60) NOT NULL,
        route_code NVARCHAR(50) NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        speed_kmh DECIMAL(10,2) NULL,
        heading DECIMAL(10,2) NULL,
        crowding NVARCHAR(30) NULL,
        progress DECIMAL(8,5) NULL,
        recorded_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_vehicle_locations_vehicles FOREIGN KEY(vehicle_id) REFERENCES bus_vehicles(id),
        CONSTRAINT FK_vehicle_locations_routes FOREIGN KEY(route_code) REFERENCES bus_routes(route_code)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_vehicle_locations_latest' AND object_id=OBJECT_ID('vehicle_locations'))
    CREATE INDEX IX_vehicle_locations_latest ON vehicle_locations(vehicle_code, recorded_at DESC);
GO

IF OBJECT_ID('chat_sessions','U') IS NULL
BEGIN
    CREATE TABLE chat_sessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        session_key NVARCHAR(120) NULL,
        title NVARCHAR(180) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_chat_sessions_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO
IF OBJECT_ID('chat_logs','U') IS NULL
BEGIN
    CREATE TABLE chat_logs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_id INT NULL,
        user_id INT NULL,
        message NVARCHAR(MAX) NOT NULL,
        reply NVARCHAR(MAX) NOT NULL,
        intent NVARCHAR(80) NULL,
        lat FLOAT NULL,
        lng FLOAT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_chat_logs_sessions FOREIGN KEY(session_id) REFERENCES chat_sessions(id),
        CONSTRAINT FK_chat_logs_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO

IF OBJECT_ID('favorites','U') IS NULL
BEGIN
    CREATE TABLE favorites (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        target_type NVARCHAR(40) NOT NULL,
        target_id NVARCHAR(80) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_favorites_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_favorites_user_target' AND object_id=OBJECT_ID('favorites'))
    CREATE UNIQUE INDEX UX_favorites_user_target ON favorites(user_id, target_type, target_id);
GO

IF OBJECT_ID('import_history','U') IS NULL
BEGIN
    CREATE TABLE import_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        source_type NVARCHAR(40) NOT NULL,
        source_file NVARCHAR(255) NOT NULL,
        status NVARCHAR(30) NOT NULL,
        rows_total INT NOT NULL DEFAULT 0,
        rows_success INT NOT NULL DEFAULT 0,
        rows_failed INT NOT NULL DEFAULT 0,
        message NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO
IF OBJECT_ID('analytics_events','U') IS NULL
BEGIN
    CREATE TABLE analytics_events (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        event_name NVARCHAR(100) NOT NULL,
        entity_type NVARCHAR(60) NULL,
        entity_id NVARCHAR(80) NULL,
        payload NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_analytics_events_users FOREIGN KEY(user_id) REFERENCES users(id)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_analytics_events_name_time' AND object_id=OBJECT_ID('analytics_events'))
    CREATE INDEX IX_analytics_events_name_time ON analytics_events(event_name, created_at DESC);
GO

IF COL_LENGTH('tourist_places','external_place_code') IS NULL ALTER TABLE tourist_places ADD external_place_code NVARCHAR(120) NULL;
IF COL_LENGTH('tourist_places','province_code') IS NULL ALTER TABLE tourist_places ADD province_code NVARCHAR(20) NULL;
IF COL_LENGTH('tourist_places','short_description') IS NULL ALTER TABLE tourist_places ADD short_description NVARCHAR(500) NULL;
IF COL_LENGTH('tourist_places','district') IS NULL ALTER TABLE tourist_places ADD district NVARCHAR(120) NULL;
IF COL_LENGTH('tourist_places','ticket_price_text') IS NULL ALTER TABLE tourist_places ADD ticket_price_text NVARCHAR(255) NULL;
IF COL_LENGTH('tourist_places','best_time') IS NULL ALTER TABLE tourist_places ADD best_time NVARCHAR(255) NULL;
IF COL_LENGTH('tourist_places','weather_note') IS NULL ALTER TABLE tourist_places ADD weather_note NVARCHAR(MAX) NULL;
IF COL_LENGTH('tourist_places','ideal_season') IS NULL ALTER TABLE tourist_places ADD ideal_season NVARCHAR(255) NULL;
IF COL_LENGTH('tourist_places','required_documents') IS NULL ALTER TABLE tourist_places ADD required_documents NVARCHAR(500) NULL;
IF COL_LENGTH('tourist_places','food_suggestions') IS NULL ALTER TABLE tourist_places ADD food_suggestions NVARCHAR(MAX) NULL;
IF COL_LENGTH('tourist_places','nearby_suggestions') IS NULL ALTER TABLE tourist_places ADD nearby_suggestions NVARCHAR(MAX) NULL;
IF COL_LENGTH('tourist_places','image_url_2') IS NULL ALTER TABLE tourist_places ADD image_url_2 NVARCHAR(1000) NULL;
IF COL_LENGTH('tourist_places','image_url_3') IS NULL ALTER TABLE tourist_places ADD image_url_3 NVARCHAR(1000) NULL;
IF COL_LENGTH('tourist_places','source_url') IS NULL ALTER TABLE tourist_places ADD source_url NVARCHAR(2000) NULL;
IF COL_LENGTH('tourist_places','source_name') IS NULL ALTER TABLE tourist_places ADD source_name NVARCHAR(500) NULL;
IF COL_LENGTH('tourist_places','checked_at') IS NULL ALTER TABLE tourist_places ADD checked_at DATE NULL;
IF COL_LENGTH('tourist_places','reliability_level') IS NULL ALTER TABLE tourist_places ADD reliability_level NVARCHAR(80) NULL;
IF COL_LENGTH('tourist_places','coordinate_type') IS NULL ALTER TABLE tourist_places ADD coordinate_type NVARCHAR(120) NULL;
IF COL_LENGTH('tourist_places','google_maps_url') IS NULL ALTER TABLE tourist_places ADD google_maps_url NVARCHAR(1000) NULL;
IF COL_LENGTH('tourist_places','accuracy_note') IS NULL ALTER TABLE tourist_places ADD accuracy_note NVARCHAR(MAX) NULL;
IF COL_LENGTH('tourist_places','image_source') IS NULL ALTER TABLE tourist_places ADD image_source NVARCHAR(1000) NULL;
IF COL_LENGTH('tourist_places','note') IS NULL ALTER TABLE tourist_places ADD note NVARCHAR(MAX) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_tourist_places_external_place_code' AND object_id=OBJECT_ID('tourist_places'))
    CREATE UNIQUE INDEX UX_tourist_places_external_place_code ON tourist_places(external_place_code) WHERE external_place_code IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_tourist_places_province_category' AND object_id=OBJECT_ID('tourist_places'))
    CREATE INDEX IX_tourist_places_province_category ON tourist_places(province_code, category_id, is_active);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_tourist_places_lat_lng' AND object_id=OBJECT_ID('tourist_places'))
    CREATE INDEX IX_tourist_places_lat_lng ON tourist_places(latitude, longitude);
GO

IF COL_LENGTH('place_nearby_stops','external_link_code') IS NULL ALTER TABLE place_nearby_stops ADD external_link_code NVARCHAR(120) NULL;
IF COL_LENGTH('place_nearby_stops','external_place_code') IS NULL ALTER TABLE place_nearby_stops ADD external_place_code NVARCHAR(120) NULL;
IF COL_LENGTH('place_nearby_stops','route_display_code') IS NULL ALTER TABLE place_nearby_stops ADD route_display_code NVARCHAR(30) NULL;
IF COL_LENGTH('place_nearby_stops','distance_method') IS NULL ALTER TABLE place_nearby_stops ADD distance_method NVARCHAR(80) NULL;
IF COL_LENGTH('place_nearby_stops','reliability_level') IS NULL ALTER TABLE place_nearby_stops ADD reliability_level NVARCHAR(80) NULL;
IF COL_LENGTH('place_nearby_stops','place_maps_url') IS NULL ALTER TABLE place_nearby_stops ADD place_maps_url NVARCHAR(1000) NULL;
IF COL_LENGTH('place_nearby_stops','stop_maps_url') IS NULL ALTER TABLE place_nearby_stops ADD stop_maps_url NVARCHAR(1000) NULL;
IF COL_LENGTH('place_nearby_stops','updated_at') IS NULL ALTER TABLE place_nearby_stops ADD updated_at DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_place_nearby_route' AND object_id=OBJECT_ID('place_nearby_stops'))
    CREATE INDEX IX_place_nearby_route ON place_nearby_stops(route_code, distance_meters);
GO

PRINT 'SmartBusDB schema is ready.';
GO


/* ===== DU LIEU MAU ===== */
/*
  SmartBusDB sample data.
  Chạy sau database/schema.sql. Tài khoản admin nên tạo bằng: cd backend-api && npm run seed:admin
*/
USE SmartBusDB;
GO

IF NOT EXISTS (SELECT 1 FROM tourist_categories WHERE code='beach')
INSERT INTO tourist_categories(code, name, icon, sort_order) VALUES
('beach', N'Biển', N'🏖️', 1),
('culture', N'Văn hóa', N'🏛️', 2),
('shopping', N'Mua sắm', N'🛍️', 3),
('checkin', N'Check-in', N'📸', 4),
('spiritual', N'Tâm linh', N'🙏', 5),
('entertainment', N'Vui chơi', N'🎡', 6),
('nature', N'Thiên nhiên', N'🌿', 7),
('food', N'Ẩm thực', N'🍜', 8);
GO

IF NOT EXISTS (SELECT 1 FROM bus_stops WHERE name=N'Bến xe Trung tâm')
INSERT INTO bus_stops(name, address, latitude, longitude) VALUES
(N'Bến xe Trung tâm', N'Tôn Đức Thắng, Đà Nẵng', 16.0718, 108.1487),
(N'Chợ Cồn', N'Hùng Vương, Đà Nẵng', 16.0678, 108.2148),
(N'Cầu Rồng / Bảo tàng Chăm', N'Đường 2 Tháng 9, Đà Nẵng', 16.0608, 108.2249),
(N'Bến Hội An', N'Phố cổ Hội An, Quảng Nam', 15.8794, 108.3380),
(N'Sân bay Đà Nẵng', N'Duy Tân, Đà Nẵng', 16.0439, 108.1998),
(N'Bà Nà Hills', N'Hòa Ninh, Hòa Vang, Đà Nẵng', 15.9975, 107.9975),
(N'Công viên Biển Đông', N'Võ Nguyên Giáp, Đà Nẵng', 16.0555, 108.2473),
(N'Ngũ Hành Sơn / Non Nước', N'Huyền Trân Công Chúa, Đà Nẵng', 16.0036, 108.2640),
(N'Chợ Hàn', N'Trần Phú, Đà Nẵng', 16.0680, 108.2243),
(N'Asia Park / Helio', N'2 Tháng 9, Đà Nẵng', 16.0382, 108.2265);
GO

DECLARE @BenXe INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bến xe Trung tâm');
DECLARE @ChoCon INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Chợ Cồn');
DECLARE @CauRong INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Cầu Rồng / Bảo tàng Chăm');
DECLARE @HoiAnStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bến Hội An');
DECLARE @SanBay INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Sân bay Đà Nẵng');
DECLARE @BaNaStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bà Nà Hills');
DECLARE @BienDong INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Công viên Biển Đông');
DECLARE @NguHanhSonStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Ngũ Hành Sơn / Non Nước');
DECLARE @ChoHanStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Chợ Hàn');
DECLARE @AsiaParkStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Asia Park / Helio');

IF NOT EXISTS (SELECT 1 FROM bus_routes WHERE route_code='02')
INSERT INTO bus_routes(route_code, name, description, start_stop_id, end_stop_id, type, fare, color, operating_time, interval_text)
VALUES
('02', N'Bến xe Trung tâm – Hội An', N'Tuyến kết nối Đà Nẵng với Hội An.', @BenXe, @HoiAnStop, N'Không trợ giá', N'6.000đ', '#e4008a', N'05:30 – 18:00', N'20 phút'),
('03', N'Sân bay – Bà Nà Hills', N'Tuyến gợi ý đi Bà Nà từ khu vực sân bay.', @SanBay, @BaNaStop, N'Trợ giá', N'6.000đ', '#7b61ff', N'05:30 – 18:00', N'30 phút'),
('05', N'Trung tâm – Biển Mỹ Khê', N'Tuyến phù hợp đi biển và Công viên Biển Đông.', @ChoCon, @BienDong, N'Trợ giá', N'5.000đ', '#00b0ff', N'05:30 – 21:00', N'15 phút'),
('06', N'Sân bay – Ngũ Hành Sơn', N'Tuyến phù hợp đi Non Nước và Ngũ Hành Sơn.', @SanBay, @NguHanhSonStop, N'Trợ giá', N'6.000đ', '#ff9800', N'05:30 – 20:00', N'20 phút'),
('07', N'Chợ Hàn – Asia Park', N'Tuyến nội đô đi mua sắm và vui chơi.', @ChoHanStop, @AsiaParkStop, N'Trợ giá', N'5.000đ', '#4caf50', N'06:00 – 21:00', N'15 phút');
GO

IF NOT EXISTS (SELECT 1 FROM buses WHERE bus_code='BUS-02-01')
INSERT INTO buses(bus_code, plate, route_code, status, capacity, speed_kmh, progress, crowding, latitude, longitude) VALUES
('BUS-02-01', '43B-020.01', '02', 'active', 40, 28, 0.20, 'moderate', 16.0608, 108.2249),
('BUS-02-02', '43B-020.02', '02', 'active', 40, 24, 0.60, 'quiet', 16.0308, 108.2449),
('BUS-03-01', '43B-030.01', '03', 'active', 40, 32, 0.35, 'busy', 16.0439, 108.1998),
('BUS-05-01', '43B-050.01', '05', 'active', 40, 22, 0.70, 'moderate', 16.0555, 108.2473),
('BUS-06-01', '43B-060.01', '06', 'active', 40, 26, 0.44, 'quiet', 16.0036, 108.2640),
('BUS-07-01', '43B-070.01', '07', 'active', 40, 20, 0.28, 'quiet', 16.0382, 108.2265);
GO

DECLARE @Beach INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='beach');
DECLARE @Culture INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='culture');
DECLARE @Shopping INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='shopping');
DECLARE @Checkin INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='checkin');
DECLARE @Spiritual INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='spiritual');
DECLARE @Entertainment INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='entertainment');
DECLARE @Nature INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='nature');
DECLARE @Food INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='food');

IF NOT EXISTS (SELECT 1 FROM tourist_places WHERE slug='hoi-an')
INSERT INTO tourist_places(name, slug, description, category_id, address, latitude, longitude, image_url, opening_hours, suggested_duration_minutes, min_budget, max_budget, average_rating, review_count, is_active)
VALUES
(N'Hội An', 'hoi-an', N'Phố cổ, đèn lồng, ẩm thực và văn hóa di sản. Phù hợp đi tuyến 02 từ Đà Nẵng.', @Culture, N'Phố cổ Hội An, Quảng Nam', 15.8794, 108.3380, 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b', N'Cả ngày', 180, 100000, 450000, 4.8, 128, 1),
(N'Bà Nà Hills', 'ba-na-hills', N'Khu du lịch núi nổi tiếng với Cầu Vàng, khí hậu mát và nhiều điểm check-in.', @Nature, N'Hòa Ninh, Hòa Vang, Đà Nẵng', 15.9975, 107.9975, 'https://images.unsplash.com/photo-1583417319070-4a69db38a482', N'07:00 - 17:00', 300, 900000, 1500000, 4.7, 96, 1),
(N'Ngũ Hành Sơn', 'ngu-hanh-son', N'Danh thắng núi đá vôi, hang động, chùa chiền và làng đá mỹ nghệ Non Nước.', @Spiritual, N'81 Huyền Trân Công Chúa, Ngũ Hành Sơn', 16.0036, 108.2640, 'https://images.unsplash.com/photo-1528127269322-539801943592', N'07:00 - 17:30', 120, 50000, 200000, 4.5, 76, 1),
(N'Biển Mỹ Khê', 'bien-my-khe', N'Bãi biển trung tâm đẹp, dễ tiếp cận bằng xe buýt.', @Beach, N'Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', 16.0597, 108.2476, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', N'Cả ngày', 120, 0, 250000, 4.6, 155, 1),
(N'Cầu Rồng', 'cau-rong', N'Biểu tượng Đà Nẵng, đẹp nhất buổi tối.', @Checkin, N'Nguyễn Văn Linh, Hải Châu', 16.0612, 108.2278, 'https://images.unsplash.com/photo-1528127269322-539801943592', N'Cả ngày', 60, 0, 120000, 4.7, 210, 1),
(N'Chợ Hàn', 'cho-han', N'Chợ trung tâm tiện mua quà, đặc sản và trải nghiệm ẩm thực địa phương.', @Shopping, N'119 Trần Phú, Hải Châu', 16.0680, 108.2243, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5', N'06:00 - 19:00', 90, 50000, 600000, 4.3, 88, 1),
(N'Asia Park / Da Nang Downtown', 'asia-park-da-nang-downtown', N'Khu vui chơi giải trí, vòng quay Sun Wheel và hoạt động buổi tối.', @Entertainment, N'01 Phan Đăng Lưu, Hải Châu', 16.0382, 108.2265, 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9', N'15:00 - 22:00', 180, 150000, 500000, 4.3, 69, 1);
GO

DECLARE @HoiAn INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='hoi-an');
DECLARE @BaNa INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='ba-na-hills');
DECLARE @NguHanhSon INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='ngu-hanh-son');
DECLARE @MyKhe INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='bien-my-khe');
DECLARE @CauRongPlace INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='cau-rong');
DECLARE @ChoHanPlace INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='cho-han');
DECLARE @AsiaPark INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='asia-park-da-nang-downtown');
DECLARE @HoiAnStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bến Hội An');
DECLARE @BaNaStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bà Nà Hills');
DECLARE @NguHanhSonStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Ngũ Hành Sơn / Non Nước');
DECLARE @BienDong2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Công viên Biển Đông');
DECLARE @CauRong2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Cầu Rồng / Bảo tàng Chăm');
DECLARE @ChoHan2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Chợ Hàn');
DECLARE @AsiaParkStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Asia Park / Helio');

IF NOT EXISTS (SELECT 1 FROM place_nearby_stops WHERE place_id=@HoiAn AND route_code='02')
INSERT INTO place_nearby_stops(place_id, stop_id, route_code, distance_meters, walking_minutes, note) VALUES
(@HoiAn, @HoiAnStop2, '02', 350, 5, N'Xuống gần khu phố cổ, đi bộ vào trung tâm.'),
(@BaNa, @BaNaStop2, '03', 500, 7, N'Tuyến 03 kết nối sân bay và khu Bà Nà.'),
(@NguHanhSon, @NguHanhSonStop2, '06', 650, 9, N'Phù hợp kết hợp Non Nước.'),
(@MyKhe, @BienDong2, '05', 220, 3, N'Bến gần biển, dễ tìm.'),
(@CauRongPlace, @CauRong2, '02', 300, 4, N'Có thể đi các tuyến qua trung tâm.'),
(@ChoHanPlace, @ChoHan2, '07', 240, 3, N'Bến trung tâm gần chợ.'),
(@AsiaPark, @AsiaParkStop2, '07', 450, 6, N'Dễ đi buổi chiều/tối.');
GO

IF NOT EXISTS (SELECT 1 FROM notifications WHERE title=N'Ra mắt SmartBus Travel Connect')
INSERT INTO notifications(user_id, title, content, type) VALUES
(NULL, N'Ra mắt SmartBus Travel Connect', N'Dữ liệu đang lấy từ SQL Server SmartBusDB.', 'info'),
(NULL, N'Bật GPS để tìm bến gần nhất', N'GPS giúp chatbot và trang bến gần tôi tính khoảng cách đi bộ chính xác hơn.', 'gps');
GO

PRINT 'SmartBusDB sample data is ready. Run backend-api npm run seed:admin to create admin login.';
GO

/* ===== TAO ADMIN THAT - MAT KHAU DA MA HOA BCRYPT ===== */
USE SmartBusDB;
GO

IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@smartbus.vn')
BEGIN
    UPDATE users
    SET full_name = N'Quản trị viên SmartBus',
        password_hash = '$2a$10$09.Fmi4D2epPOm42AYOZZedp0K4kB/G7Mnk1s/TC33P52GrPoI8jm',
        role = 'admin',
        is_active = 1,
        updated_at = SYSDATETIME()
    WHERE email = 'admin@smartbus.vn';
END
ELSE
BEGIN
    INSERT INTO users(full_name, email, password_hash, role, is_active)
    VALUES (
        N'Quản trị viên SmartBus',
        'admin@smartbus.vn',
        '$2a$10$09.Fmi4D2epPOm42AYOZZedp0K4kB/G7Mnk1s/TC33P52GrPoI8jm',
        'admin',
        1
    );
END
GO

PRINT 'HOAN TAT DATABASE SMARTBUS.';
PRINT 'Tai khoan dang nhap web:';
PRINT 'Email: admin@smartbus.vn';
PRINT 'Password: Admin123456';
GO
