# backend-api/src

Dự án gốc đang chạy ổn định bằng các thư mục `config`, `common`, `modules` ở root `backend-api`.
Thư mục này là mốc chuẩn hóa kiến trúc cho các lần refactor tiếp theo. Không di chuyển toàn bộ file trong lần nâng cấp này để tránh phá lệnh chạy hiện tại.

Luồng chuẩn vẫn là:
Controller → Service → Repository → SQL Server.
