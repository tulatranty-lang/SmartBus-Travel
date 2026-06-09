# FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION_REPORT

Ngày sửa: 09/06/2026
Project: SmartBus Travel

## 1. Tóm tắt lỗi ban đầu

Các lỗi chính theo prompt:

- Một số chức năng load lâu hoặc phản hồi không rõ trạng thái.
- “Bến gần tôi” trên frontend đang gọi luồng cũ `/bus/stops/near`, hiển thị thông báo “Backend chưa phản hồi...” khi format trả về không khớp hoặc backend lỗi.
- “Địa điểm du lịch” có nguy cơ load nặng, lưu địa điểm qua `/tourism/places/:id/save` không đồng bộ với danh sách `/users/me/favorite-places` vì backend đang dùng nhiều bảng yêu thích khác nhau.
- “Gợi ý lịch trình” lấy nhiều ứng viên hơn cần thiết và response chưa có các field tóm tắt rõ ràng.
- “Lịch sử chat” chưa tách rõ Chatbot / Cộng đồng review / Hoạt động gần đây.
- “Thống kê hoạt động gần đây” còn fallback sang dữ liệu local khi backend không có dữ liệu, dễ tạo cảm giác chưa liên kết thật.
- “Quản trị nội dung” còn lẫn nhãn duyệt review địa điểm / bài cộng đồng, trong khi yêu cầu hiện tại là tập trung duyệt review cộng đồng.
- Thiếu file SQL update số 09 theo đúng yêu cầu prompt.

## 2. Nguyên nhân kỹ thuật

- Frontend “Bến gần tôi” gọi endpoint cũ và chỉ render 1 object `stop`, trong khi yêu cầu cần endpoint chuẩn `/api/v1/stops/nearby` trả danh sách bến gần nhất.
- Backend module `stop` chỉ có `/nearest`, chưa có alias `/nearby` đúng convention trong prompt.
- Luồng lưu địa điểm bị chia giữa `place_favorites`, `favorites_places` và endpoint `/favorite-places`; lưu bằng `/tourism/places/:id/save` chưa chắc xuất hiện ở “Địa điểm yêu thích”.
- `tourism.controller` gọi `paginateArray` sau khi repository đã limit/offset bằng SQL, có thể gây phân trang kép nếu dùng page/offset.
- `stats.repository` đếm tổng địa điểm bằng `tourismService.search({})`, trong khi `search` mặc định giới hạn danh sách, dẫn đến số liệu thống kê không chắc là tổng thật.
- Frontend lịch sử gom chat và activity vào một danh sách chung, chưa có tab tách loại dữ liệu.
- Admin UI còn hiển thị tab “Duyệt bài cộng đồng”; prompt yêu cầu tập trung vào “Duyệt review cộng đồng”.

## 3. File đã sửa

### Backend

- `backend-api/modules/stop/stop.routes.js`
- `backend-api/modules/stop/stop.controller.js`
- `backend-api/modules/stop/stop.service.js`
- `backend-api/modules/tourism/tourism.controller.js`
- `backend-api/modules/tourism/tourism.repository.js`
- `backend-api/modules/tourism/tourism.service.js`
- `backend-api/modules/user/user.routes.js`
- `backend-api/modules/user/user.controller.js`
- `backend-api/modules/user/user.service.js`
- `backend-api/modules/user/user.repository.js`
- `backend-api/modules/stats/stats.controller.js`
- `backend-api/modules/stats/stats.service.js`
- `backend-api/modules/stats/stats.repository.js`
- `backend-api/modules/admin/admin.service.js`
- `backend-api/modules/review/review.repository.js`
- `backend-api/modules/trip/trip.service.js`

### Frontend deploy/local

- `frontend/script.js`
- `frontend/style.css`
- `docs/script.js`
- `docs/style.css`
- `docs/index.html` được đồng bộ lại từ `frontend/index.html`
- `docs/css/*`, `docs/js/*`, `docs/modules/*` được đồng bộ lại từ frontend tương ứng

### Database

- Tạo mới: `database/09_FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION.sql`

## 4. API đã thêm/sửa

### Bến gần tôi

- Thêm `GET /api/v1/stops/nearby?lat=...&lng=...&limit=5`
- Thêm alias `GET /api/v1/stops/near?lat=...&lng=...&limit=5`
- Response chuẩn:

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "...",
      "routeCode": "...",
      "routeName": "...",
      "lat": 16.0,
      "lng": 108.0,
      "distanceMeters": 450,
      "distanceKm": 0.45,
      "walkingMinutes": 6
    }
  ],
  "message": "Danh sách bến gần tôi"
}
```

### Du lịch / lưu địa điểm

- Giữ endpoint hiện có:
  - `GET /api/v1/tourism/places?province=&category=&q=&routeId=&limit=&offset=`
  - `GET /api/v1/tourism/places/:id`
  - `POST /api/v1/tourism/places/:id/save`
  - `DELETE /api/v1/tourism/places/:id/save`
  - `GET /api/v1/users/me/favorite-places`
- Sửa lưu địa điểm để ghi đồng bộ vào `favorites_places` và `place_favorites`, tránh lỗi lưu xong không thấy trong trang yêu thích.
- Sửa phân trang du lịch để không paginate hai lần sau khi SQL đã limit/offset.

### Lịch sử cá nhân

- Thêm:
  - `GET /api/v1/users/me/chat-history`
  - `GET /api/v1/users/me/community-history`
  - `GET /api/v1/users/me/activity-history` đã có và tiếp tục dùng.

### Thống kê

- Sửa `GET /api/v1/stats/overview` để đếm trực tiếp từ SQL Server, không đếm qua danh sách đã limit.
- Giữ `GET /api/v1/stats/recent-activities` và render frontend theo dữ liệu backend thật.

### Admin review cộng đồng

- Giữ/sử dụng:
  - `GET /api/v1/admin/reviews?status=pending`
  - `GET /api/v1/admin/reviews/pending`
  - `POST /api/v1/admin/reviews/:id/approve`
  - `POST /api/v1/admin/reviews/:id/reject`
- Backend vẫn có middleware `requireAuth + requireRole('admin')`, user thường gọi API admin sẽ bị chặn 403.
- Từ chối review cộng đồng chuyển status sang `rejected` thay vì chỉ dùng nhãn mơ hồ `hidden`.

## 5. Database đã thêm/sửa

File mới: `database/09_FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION.sql`

Nội dung chính:

- Tạo `favorite_places` nếu thiếu.
- Tạo/đảm bảo `favorites_places` và `place_favorites` nếu thiếu, để tương thích code cũ và code hiện tại.
- Tạo `activity_logs` nếu thiếu.
- Thêm cột `status` cho `reviews`, `community_reviews`, `community_posts` nếu thiếu.
- Thêm index:
  - `favorite_places(user_id, place_id)`
  - `favorites_places(user_id, place_id)`
  - `place_favorites(user_id, place_id)`
  - `activity_logs(user_id, created_at)`
  - `activity_logs(created_at)`
  - `reviews(status, created_at)`
  - `community_reviews(status, created_at)`
  - `tourist_places(province_code, category_id, is_active)`
  - `bus_stops(latitude, longitude)` include các cột hiển thị cơ bản
- Không dùng `DROP TABLE`.
- Không dùng `DELETE` dữ liệu cũ.

## 6. Cách chạy SQL update

Trong SQL Server Management Studio hoặc Azure Data Studio:

1. Chọn database `SmartBusDB`, không chọn `master`.
2. Mở file:
   `database/09_FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION.sql`
3. Bấm Execute.
4. Sau khi chạy xong, restart backend Render hoặc backend local.

## 7. Lệnh đã test

Đã chạy trong môi trường sandbox:

```bash
node --check frontend/script.js
node --check docs/script.js
node --check backend-api/server.js
node --check backend-api/app.js
node --check backend-api/modules/stop/stop.routes.js
node --check backend-api/modules/stop/stop.controller.js
node --check backend-api/modules/stop/stop.service.js
node --check backend-api/modules/tourism/tourism.repository.js
node --check backend-api/modules/tourism/tourism.controller.js
node --check backend-api/modules/tourism/tourism.service.js
node --check backend-api/modules/user/user.routes.js
node --check backend-api/modules/user/user.controller.js
node --check backend-api/modules/user/user.service.js
node --check backend-api/modules/user/user.repository.js
node --check backend-api/modules/stats/stats.controller.js
node --check backend-api/modules/stats/stats.service.js
node --check backend-api/modules/stats/stats.repository.js
node --check backend-api/modules/admin/admin.service.js
node --check backend-api/modules/review/review.repository.js
node --check backend-api/modules/trip/trip.service.js
cd backend-api && npm run check
```

Kết quả `npm run check`:

```text
✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.
```

Đã kiểm tra đồng bộ deploy:

```bash
cmp -s frontend/script.js docs/script.js
cmp -s frontend/index.html docs/index.html
cmp -s frontend/style.css docs/style.css
```

Kết quả: `script synced`, `index synced`, `style synced`.

## 8. Kết quả test

Đã test được:

- Cú pháp frontend `frontend/script.js`.
- Cú pháp deploy `docs/script.js`.
- Cú pháp các file backend đã sửa.
- Lệnh `npm run check` của backend.
- Kiểm tra route bằng đọc source:
  - `/api/v1/stops/nearby` đã được đăng ký qua `stop.routes.js`.
  - `/api/v1/tourism/places` vẫn tồn tại.
  - `/api/v1/tourism/places/:id/save` vẫn tồn tại.
  - `/api/v1/users/me/favorite-places` vẫn tồn tại.
  - `/api/v1/users/me/chat-history`, `/community-history`, `/activity-history` đã đăng ký.
  - `/api/v1/stats/recent-activities` vẫn tồn tại.
  - `/api/v1/admin/reviews/pending` và `/api/v1/admin/reviews/:id/approve|reject` vẫn tồn tại.

## 9. Những gì chưa test được và lý do

Chưa chạy live API bằng curl/supertest được trong sandbox vì:

- Project ZIP không kèm `backend-api/node_modules`, nên `require('./app')` để chạy Express báo thiếu module `express`.
- Môi trường sandbox không có SQL Server `SmartBusDB` live, nên các API cần database thật không thể kiểm tra dữ liệu thực.
- Không có môi trường Render thật trong sandbox để test deploy production.
- Không có trình duyệt/mobile thật trong sandbox để bấm UI, cấp quyền GPS và test Leaflet tương tác trực tiếp.

Tuy vậy, phần syntax/static check đã pass và frontend/docs đã được đồng bộ đúng quy tắc deploy.

## 10. Hướng dẫn sau khi nhận ZIP

1. Giải nén ZIP mới.
2. Mở SQL Server, chọn `SmartBusDB`.
3. Chạy file:
   `database/09_FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION.sql`
4. Vào `backend-api`:

```bash
npm ci --no-audit --no-fund
npm run check
npm start
```

5. Test nhanh API local hoặc Render:

```bash
GET /api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5
GET /api/v1/tourism/places?limit=12
GET /api/v1/stats/recent-activities
GET /api/v1/admin/reviews/pending
```

6. Nếu backend thay đổi đã push GitHub:
   - Vào Render.
   - Chọn service backend SmartBus.
   - Chọn Manual Deploy.
   - Deploy latest commit.

7. Vì frontend GitHub Pages dùng `docs/`, sau khi push GitHub, kiểm tra link GitHub Pages. File `docs/script.js`, `docs/style.css`, `docs/index.html` đã được đồng bộ từ `frontend/`.

## 11. Ghi chú trung thực

- Không xóa chức năng hiện có.
- Không đổi công nghệ.
- Không viết lại project từ đầu.
- Không xóa dữ liệu cũ.
- Không hardcode dữ liệu giả để che lỗi.
- Không sửa riêng frontend mà bỏ quên `docs/`.
- Không đụng phá Leaflet/mobile menu; phần map chỉ dùng lại `MapModule.focusStop`, `focusPlace`, `markUserLocation` hiện có.
