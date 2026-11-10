# Cài và nâng cấp SQL Server

Dùng CLI từ thư mục gốc thay vì tự chạy các file SQL theo số thứ tự:

```bash
npm run db:setup
```

Lệnh này tạo database nếu chưa có; chạy schema theo thứ tự `01 → 99 → 06 → 07 → 08 → 09 → 10 → 11 → 12`, sau đó import `02 → 03 → 04 → 05`. Toàn bộ thay đổi trong một transaction, khóa migration bằng `sp_getapplock`. Mỗi file được ghi SHA-256 vào `smartbus_migrations`; lần sau bỏ qua file đã áp dụng.

Nâng cấp database đã có: sao lưu và chạy `npm run db:migrate`; không đổi DB_NAME, không xóa database, không sửa SQL đã ghi journal. Các bộ import cũ cập nhật lại liên kết tuyến/bến nên không tự nạp lại sau khi đã ghi nhận. Các file `00_*`, `schema.sql` và patch lịch sử ngoài danh sách trên không phải lệnh cài hiện hành.

Migration 12 bổ sung session_version, index refresh token và sửa view tọa độ xe. CLI không sửa file 06: bỏ riêng batch view cũ bị trùng/sai cột và tạo view đúng ở 12. View này là vị trí tham khảo, không phải dữ liệu GPS trực tiếp.

Cấu hình và xử lý lỗi: [README gốc](../README.md). Kết quả kiểm thử cài mới/nâng cấp: [VERIFICATION](../docs/current/VERIFICATION.md).
