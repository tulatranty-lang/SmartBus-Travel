# Phạm vi hoàn thiện SmartBus

Giữ Express/CommonJS, SQL Server, Leaflet và giao diện hiện có. Entry point: backend-api/server.js và frontend/script.js. docs/ là bản frontend sinh cho GitHub Pages, đồng bộ bằng scripts/sync-pages.js.

Các lỗi đã quan sát: registry nội bộ trong lock, thiếu hướng dẫn/startup tổng thể, API gắn cứng, SQL bỏ sót patch và view06 sai cột, .env bị đưa vào Git, refresh trùng trong cùng giây/không atomic, role JWT không kiểm khóa hiện tại, pagination/nearest fixture không khớp, pending review công khai, import API chỉ khung, itinerary che lỗi DB/lưu thất bại.

Luồng: Browser → HTTP/auth/validate → Controller → Service → Repository → SQL Server có tham số → JSON/DOM/Leaflet. Mục tiêu kiểm thử: cài mới/rerun/upgrade giữ dữ liệu; auth/favorites/review/moderation/chat/trips qua DB thật; phân quyền/phiên/lỗi/đầu vào; map và mobile. Dữ liệu bus nhập từ bộ tài liệu có sẵn là tham khảo, không phải feed GPS trực tiếp.

Kết quả thực tế, môi trường và giới hạn ghi ở VERIFICATION.md khi kiểm tra xong. Các báo cáo lịch sử không chứng minh bản mới đã chạy.
