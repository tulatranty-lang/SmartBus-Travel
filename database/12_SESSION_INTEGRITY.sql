-- Additive: no account or history is deleted.
IF COL_LENGTH('dbo.users','session_version') IS NULL
 ALTER TABLE dbo.users ADD session_version int NOT NULL CONSTRAINT DF_users_session_version DEFAULT 0;
GO
CREATE OR ALTER VIEW dbo.vw_demo_bus_vehicle_locations AS
WITH ranked AS (
 SELECT v.*,r.province_code AS route_province_code,
 ROW_NUMBER() OVER (PARTITION BY r.province_code ORDER BY v.id) AS rn
 FROM dbo.bus_vehicles v LEFT JOIN dbo.bus_routes r ON r.route_code=v.route_code
)
SELECT * FROM ranked WHERE rn<=20;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_refresh_token_hash_active' AND object_id=OBJECT_ID('dbo.refresh_tokens'))
 CREATE INDEX IX_refresh_token_hash_active ON dbo.refresh_tokens(token_hash,revoked_at,expires_at);
GO
