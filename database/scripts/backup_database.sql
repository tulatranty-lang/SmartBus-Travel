-- SmartBusDB full backup template. Chỉnh đường dẫn C:\SmartBusBackups trước khi chạy.
BACKUP DATABASE SmartBusDB
TO DISK = 'C:\SmartBusBackups\SmartBusDB_FULL.bak'
WITH INIT, FORMAT, COMPRESSION, CHECKSUM, STATS = 10;
GO
