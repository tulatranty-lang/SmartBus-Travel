/* SmartBus v5 SQL hotfix: ensure V3 tourism import columns exist */
IF OBJECT_ID('tourist_places','U') IS NOT NULL
BEGIN
    IF COL_LENGTH('tourist_places','image_source') IS NULL ALTER TABLE tourist_places ADD image_source NVARCHAR(1000) NULL;
    IF COL_LENGTH('tourist_places','note') IS NULL ALTER TABLE tourist_places ADD note NVARCHAR(MAX) NULL;
    IF COL_LENGTH('tourist_places','image_url') IS NOT NULL ALTER TABLE tourist_places ALTER COLUMN image_url NVARCHAR(1000) NULL;
    IF COL_LENGTH('tourist_places','image_url_2') IS NOT NULL ALTER TABLE tourist_places ALTER COLUMN image_url_2 NVARCHAR(1000) NULL;
    IF COL_LENGTH('tourist_places','image_url_3') IS NOT NULL ALTER TABLE tourist_places ALTER COLUMN image_url_3 NVARCHAR(1000) NULL;
END
GO

/*
  SmartBus Architecture Upgrade data integrity fixes.
  Chạy sau các file schema/import chính. File này không DROP dữ liệu.
  Bản đã sửa lỗi cú pháp SQL Server: dynamic SQL đúng dấu nháy và tách batch sau ALTER TABLE.
*/
USE SmartBusDB;
GO

/* Preflight v4: mở rộng các cột text để chạy lại import không bị lỗi 'String or binary data would be truncated'. */
IF OBJECT_ID(N'dbo.bus_routes', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.bus_routes', N'fare') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN fare NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'operating_time') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN operating_time NVARCHAR(1000) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'interval_text') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN interval_text NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'first_trip_time') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN first_trip_time NVARCHAR(200) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'last_trip_time') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN last_trip_time NVARCHAR(200) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'operation_days') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN operation_days NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'lunch_start_time') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN lunch_start_time NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'lunch_end_time') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN lunch_end_time NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'operating_hours') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN operating_hours NVARCHAR(1000) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'frequency_text') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN frequency_text NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'speed_range_text') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN speed_range_text NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'break_time_text') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN break_time_text NVARCHAR(1000) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'source_text') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN source_text NVARCHAR(2000) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'source_url') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN source_url NVARCHAR(2000) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'source_name') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN source_name NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'status_text') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN status_text NVARCHAR(1000) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'operator_name') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN operator_name NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'origin_name') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN origin_name NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'destination_name') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN destination_name NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'start_point') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN start_point NVARCHAR(500) NULL;
    IF COL_LENGTH(N'dbo.bus_routes', N'end_point') IS NOT NULL ALTER TABLE dbo.bus_routes ALTER COLUMN end_point NVARCHAR(500) NULL;
END
GO


/* Tách route code sai dạng 'QN-06-old hoặc tour Hội An - Mỹ Sơn' thành route_code chuẩn + note. */
IF OBJECT_ID(N'dbo.place_nearby_stops', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.place_nearby_stops', N'route_note') IS NULL
    ALTER TABLE dbo.place_nearby_stops ADD route_note NVARCHAR(255) NULL;
GO

IF OBJECT_ID(N'dbo.place_nearby_stops', N'U') IS NOT NULL
BEGIN
    UPDATE dbo.place_nearby_stops
    SET route_note = COALESCE(route_note, N'tour Hội An - Mỹ Sơn'),
        note = CASE
            WHEN note IS NULL OR note NOT LIKE N'%tour Hội An - Mỹ Sơn%'
                THEN CONCAT(COALESCE(note, N''), N' | Ghi chú route: tour Hội An - Mỹ Sơn')
            ELSE note
        END,
        route_code = N'QN-06-old'
    WHERE route_code LIKE N'%hoặc%' OR route_code LIKE N'%tour%';
END
GO

IF OBJECT_ID(N'dbo.place_nearby_stops', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.place_nearby_stops', N'route_display_code') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE dbo.place_nearby_stops
        SET route_display_code = N''QN-06-old''
        WHERE route_display_code LIKE N''%hoặc%'' OR route_display_code LIKE N''%tour%'';
    ';
END
GO

IF OBJECT_ID(N'dbo.place_bus_mappings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.place_bus_mappings', N'route_note') IS NULL
    ALTER TABLE dbo.place_bus_mappings ADD route_note NVARCHAR(255) NULL;
GO

IF OBJECT_ID(N'dbo.place_bus_mappings', N'U') IS NOT NULL
BEGIN
    UPDATE dbo.place_bus_mappings
    SET route_note = COALESCE(route_note, N'tour Hội An - Mỹ Sơn'),
        route_code = N'QN-06-old',
        suggested_route_text = N'QN-06-old; ghi chú: tour Hội An - Mỹ Sơn'
    WHERE route_code LIKE N'%hoặc%' OR route_code LIKE N'%tour%';
END
GO

IF OBJECT_ID(N'dbo.chatbot_knowledge', N'U') IS NOT NULL
BEGIN
    UPDATE dbo.chatbot_knowledge
    SET route_code = N'QN-06-old'
    WHERE route_code LIKE N'%hoặc%' OR route_code LIKE N'%tour%';
END
GO

/* Unique constraints / indexes: chỉ tạo khi dữ liệu hiện tại không bị trùng để tránh làm script dừng. */
IF OBJECT_ID(N'dbo.route_stops', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_route_stops_route_direction_order' AND object_id = OBJECT_ID(N'dbo.route_stops'))
       AND NOT EXISTS (
            SELECT 1
            FROM dbo.route_stops
            WHERE sequence_no IS NOT NULL
            GROUP BY route_code, direction, sequence_no
            HAVING COUNT(*) > 1
       )
    BEGIN
        CREATE UNIQUE INDEX UX_route_stops_route_direction_order
        ON dbo.route_stops(route_code, direction, sequence_no)
        WHERE sequence_no IS NOT NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_route_stops_route_stop' AND object_id = OBJECT_ID(N'dbo.route_stops'))
    BEGIN
        CREATE INDEX IX_route_stops_route_stop ON dbo.route_stops(route_code, stop_id);
    END
END
GO

IF OBJECT_ID(N'dbo.review_votes', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_review_votes_review_user' AND object_id = OBJECT_ID(N'dbo.review_votes'))
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
GO

IF OBJECT_ID(N'dbo.post_votes', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_post_votes_post_user' AND object_id = OBJECT_ID(N'dbo.post_votes'))
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
GO

IF OBJECT_ID(N'dbo.user_roles', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_user_roles_user_role' AND object_id = OBJECT_ID(N'dbo.user_roles'))
   AND NOT EXISTS (
        SELECT 1 FROM dbo.user_roles
        GROUP BY user_id, role_id
        HAVING COUNT(*) > 1
   )
BEGIN
    CREATE UNIQUE INDEX UX_user_roles_user_role ON dbo.user_roles(user_id, role_id);
END
GO

/* GIS validation report: không xóa, chỉ xuất danh sách nghi ngờ. */
IF OBJECT_ID(N'dbo.bus_stops', N'U') IS NOT NULL
BEGIN
    SELECT N'bus_stops_invalid_gis' AS issue, id, name, latitude, longitude
    FROM dbo.bus_stops
    WHERE latitude IS NULL OR longitude IS NULL
       OR latitude = 0 OR longitude = 0
       OR latitude NOT BETWEEN 8 AND 24
       OR longitude NOT BETWEEN 102 AND 110;
END
GO

IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL
BEGIN
    SELECT N'tourist_places_invalid_gis' AS issue, id, name, latitude, longitude
    FROM dbo.tourist_places
    WHERE latitude IS NULL OR longitude IS NULL
       OR latitude = 0 OR longitude = 0
       OR latitude NOT BETWEEN 8 AND 24
       OR longitude NOT BETWEEN 102 AND 110;
END
GO
