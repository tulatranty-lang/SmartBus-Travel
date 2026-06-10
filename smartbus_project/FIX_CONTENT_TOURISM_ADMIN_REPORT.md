# FIX_CONTENT_TOURISM_ADMIN_REPORT

## Phạm vi sửa
Đã sửa trực tiếp project SmartBus Travel theo yêu cầu: Địa điểm du lịch, lưu địa điểm, xem bản đồ, gợi ý lịch trình, lịch sử chat/hoạt động, thống kê hoạt động gần đây và quản trị nội dung.

## Lỗi ban đầu và nguyên nhân chính
1. **Địa điểm du lịch load lâu**: backend lấy toàn bộ địa điểm rồi frontend mới lọc/phân trang; service còn enrich nhiều địa điểm cùng lúc.
2. **Lưu địa điểm không được**: frontend có nút `data-place-fav` nhưng chưa bind sự kiện; backend có nhiều endpoint yêu thích khác nhau nhưng thiếu alias `/tourism/places/:id/save`.
3. **Xem bản đồ địa điểm không được**: frontend có nút `data-place-map` nhưng chưa bind sự kiện để fetch chi tiết địa điểm và focus Leaflet map.
4. **Gợi ý lịch trình tạo lâu**: backend lấy danh sách tourism quá rộng; frontend không timeout/disable nút khi đang tạo.
5. **Lịch sử chat chưa đồng bộ hoạt động cộng đồng**: chỉ đọc `/chat/history`, chưa đọc timeline hoạt động người dùng.
6. **Thống kê Hoạt động gần đây chưa cập nhật**: frontend chủ yếu dùng log mô phỏng trong `State.activityLog`, chưa đọc activity thật từ backend.
7. **Quản trị nội dung bị rối tên**: UI dùng tên “review cộng đồng” gây trùng với “bài cộng đồng”; endpoint admin cộng đồng chưa có alias rõ theo tên yêu cầu.

## File đã sửa/thêm
### Backend
- `backend-api/modules/activity/activity.repository.js` — module mới ghi/đọc activity log an toàn, không làm hỏng thao tác chính nếu chưa chạy migration.
- `backend-api/modules/tourism/tourism.repository.js` — tối ưu query địa điểm theo q/province/category/limit/page ở SQL Server.
- `backend-api/modules/tourism/tourism.routes.js` — thêm `POST/DELETE /places/:id/save`.
- `backend-api/modules/tourism/tourism.service.js` — ghi activity khi lưu/bỏ lưu địa điểm.
- `backend-api/modules/favorites/favorites.service.js` — ghi activity khi lưu/bỏ lưu tuyến và địa điểm.
- `backend-api/modules/user/user.routes.js` — thêm `/me/favorite-places`, `/me/activity-history`.
- `backend-api/modules/user/user.controller.js`, `user.service.js`, `user.repository.js` — xử lý endpoint lịch sử/yêu thích.
- `backend-api/modules/auth/auth.service.js` — ghi activity đăng nhập/đăng ký.
- `backend-api/services/data.service.js` — ghi activity khi chatbot nhận câu hỏi.
- `backend-api/modules/report/report.service.js` — ghi activity khi gửi báo cáo.
- `backend-api/modules/review/review.service.js`, `review.repository.js` — ghi activity review; thêm hàm admin list review địa điểm.
- `backend-api/modules/community/community.service.js` — ghi activity bài cộng đồng/bình luận/duyệt.
- `backend-api/modules/admin/admin.routes.js`, `admin.controller.js`, `admin.service.js` — thêm alias API duyệt bài cộng đồng và `/admin/stats/recent-activities`.
- `backend-api/modules/stats/stats.routes.js`, `stats.controller.js`, `stats.service.js`, `stats.repository.js` — thêm API hoạt động gần đây.

### Database
- `database/08_ACTIVITY_HISTORY_TOURISM_ADMIN_FIXES.sql` — migration an toàn, tạo/bổ sung:
  - `activity_logs`
  - `favorites_places`
  - `place_favorites`
  - `favorites_routes`
  - cột/status/index cần thiết cho review, bài cộng đồng, hoạt động.

### Frontend / GitHub Pages
- `frontend/script.js`
- `docs/script.js`

Hai file đã đồng bộ. Nội dung sửa:
- Thêm timeout cho API request.
- Trang địa điểm du lịch có cache ngắn theo bộ lọc, limit 36 kết quả đầu để tải nhanh.
- Bind nút “Hiện trên bản đồ”.
- Bind nút “Lưu địa điểm”.
- Dùng `/tourism/places/:id/save`, fallback `/favorite-places`.
- Trang “Địa điểm yêu thích” ưu tiên `/users/me/favorite-places`.
- Trang lịch sử chat hiển thị cả chatbot và activity history.
- Thống kê “Hoạt động gần đây” gọi `/stats/recent-activities`.
- Gợi ý lịch trình có timeout, loading, disable nút submit và thông báo rõ nếu quá lâu.
- Quản trị nội dung đổi nhãn rõ hơn: “Duyệt review địa điểm” và “Duyệt bài cộng đồng”.

## API đã thêm/bổ sung
- `POST /api/v1/tourism/places/:id/save`
- `DELETE /api/v1/tourism/places/:id/save`
- `GET /api/v1/users/me/favorite-places`
- `GET /api/v1/users/me/activity-history`
- `GET /api/v1/stats/recent-activities`
- `GET /api/v1/admin/stats/recent-activities`
- `GET /api/v1/admin/community-posts/pending`
- `POST /api/v1/admin/community-posts/:id/approve`
- `POST /api/v1/admin/community-posts/:id/reject`
- `POST /api/v1/admin/reviews/:id/approve` alias thêm ngoài PUT cũ
- `POST /api/v1/admin/reviews/:id/reject` alias thêm ngoài PUT/hide cũ

## Cách test thủ công
### User thường
1. Đăng nhập user.
2. Vào “Địa điểm du lịch”.
3. Chọn tỉnh/danh mục/tìm kiếm, kiểm tra list tải nhanh và có loading.
4. Bấm “Lưu địa điểm”, kiểm tra nút đổi thành “Đã lưu”.
5. Vào “Địa điểm yêu thích”, kiểm tra địa điểm vừa lưu.
6. Bấm “Xem trên bản đồ”, kiểm tra map focus đúng tọa độ và popup địa điểm.
7. Đăng review cộng đồng.
8. Vào “Lịch sử chat”, kiểm tra có hoạt động cộng đồng/chatbot.

### Admin
1. Đăng nhập admin.
2. Vào “Thống kê”, kiểm tra Hoạt động gần đây lấy từ backend.
3. Vào “Quản trị nội dung”.
4. Kiểm tra tab “Duyệt review địa điểm”.
5. Kiểm tra tab “Duyệt bài cộng đồng”.
6. Duyệt/từ chối nội dung và xem activity cập nhật.

## Lệnh đã kiểm tra
```bash
node --check frontend/script.js
node --check docs/script.js
cd backend-api && npm run check
node --check backend-api/modules/activity/activity.repository.js
node --check backend-api/modules/user/user.controller.js
node --check backend-api/modules/user/user.service.js
node --check backend-api/modules/user/user.repository.js
node --check backend-api/modules/user/user.routes.js
node --check backend-api/modules/admin/admin.controller.js
node --check backend-api/modules/admin/admin.service.js
node --check backend-api/modules/admin/admin.routes.js
node --check backend-api/modules/stats/stats.controller.js
node --check backend-api/modules/stats/stats.repository.js
node --check backend-api/modules/stats/stats.service.js
node --check backend-api/modules/stats/stats.routes.js
node --check backend-api/modules/favorites/favorites.service.js
node --check backend-api/modules/community/community.service.js
node --check backend-api/modules/review/review.service.js
node --check backend-api/modules/review/review.repository.js
node --check backend-api/modules/tourism/tourism.routes.js
node --check backend-api/modules/tourism/tourism.service.js
```

## Chưa làm được / giới hạn kiểm tra
- Không thể chạy test đăng nhập thật, lưu thật và duyệt thật vì môi trường sandbox không có kết nối SQL Server/Render/database live.
- Không chạy `npm test` vì ZIP không có `node_modules`; không cài mới để tránh làm nặng project.
- Cần chạy file SQL `database/08_ACTIVITY_HISTORY_TOURISM_ADMIN_FIXES.sql` trên SQL Server trước khi muốn activity log lưu đầy đủ. Nếu chưa chạy migration, các thao tác chính vẫn hoạt động vì logging đã được bọc an toàn.
- Sau khi push GitHub: cần redeploy Render vì có sửa backend.
