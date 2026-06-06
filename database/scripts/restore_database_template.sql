-- Restore template. Đổi đường dẫn .bak và bảo đảm không có user đang dùng database.
USE master;
GO
ALTER DATABASE SmartBusDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO
RESTORE DATABASE SmartBusDB
FROM DISK = 'C:\SmartBusBackups\SmartBusDB_FULL.bak'
WITH REPLACE, RECOVERY, STATS = 10;
GO
ALTER DATABASE SmartBusDB SET MULTI_USER;
GO
