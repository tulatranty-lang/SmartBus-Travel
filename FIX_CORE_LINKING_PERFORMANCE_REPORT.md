# FIX CORE LINKING PERFORMANCE REPORT – SmartBus Travel

## 1. Tổng quan đã sửa

Đã rà soát lại project SmartBus theo luồng `Frontend -> Backend API -> SQL Server` và sửa trực tiếp các nhóm lỗi trọng tâm:

- Tối ưu load chậm bằng cách đẩy lọc/phân trang về SQL Server, giảm xử lý danh sách nặng ở frontend.
- Sửa `Bến gần tôi` để backend có truy vấn SQL tính khoảng cách Haversine, có validate `lat/lng/limit`, có fallback an toàn.
- Sửa `Địa điểm du lịch` để danh sách có pagination thật, lọc `province/category/q/routeId` ở SQL, trả `isSaved`, dùng bảng chuẩn `favorite_places`.
- Sửa lưu/bỏ lưu địa điểm yêu thích để dùng bảng chuẩn `favorite_places`, vẫn mirror sang bảng cũ nếu còn tồn tại để không làm lệch dữ liệu cũ.
- Sửa `Gợi ý lịch trình` để GPS không làm treo lâu ở frontend và backend lưu plan/items bằng transaction.
- Sửa `Lịch sử chat / Cộng đồng review / Hoạt động gần đây` tiếp tục dùng API cá nhân `/users/me/*` và activity log thật.
- Sửa `Thống kê` để đếm trực tiếp từ SQL, bổ sung `pendingReviews` và `totalTripPlans`.
- Sửa `Quản trị nội dung` tập trung duyệt review cộng đồng từ `community_reviews`, hỗ trợ cột moderation nếu đã chạy migration.
- Tạo migration mới `database/10_FIX_CORE_LINKING_PERFORMANCE.sql` an toàn, không `DROP TABLE`, không `DELETE` dữ liệu.
- Đồng bộ `frontend/script.js` sang `docs/script.js` để GitHub Pages không lệch bản deploy.

## 2. Danh sách file đã sửa / thêm

### Backend

- `backend-api/modules/stop/stop.repository.js`
- `backend-api/modules/stop/stop.service.js`
- `backend-api/modules/stop/stop.validator.js`
- `backend-api/modules/tourism/tourism.repository.js`
- `backend-api/modules/tourism/tourism.service.js`
- `backend-api/modules/tourism/tourism.controller.js`
- `backend-api/modules/trip/trip.repository.js`
- `backend-api/modules/trip/trip.service.js`
- `backend-api/modules/review/review.repository.js`
- `backend-api/modules/admin/admin.service.js`
- `backend-api/modules/stats/stats.repository.js`

### Frontend deploy source

- `frontend/script.js`
- `docs/script.js`

### Database / report / test

- `database/10_FIX_CORE_LINKING_PERFORMANCE.sql`
- `FIX_CORE_LINKING_PERFORMANCE_REPORT.md`
- `README_FIX_CORE_LINKING_PERFORMANCE.md`
- `TEST_OUTPUT_CORE_LINKING_PERFORMANCE.txt`

## 3. Chi tiết theo 7 nhóm lỗi

### Nhóm 1 — Load chậm

Đã sửa:

- `tourism.repository.findPlacesPage()` dùng SQL `OFFSET/FETCH` và `COUNT(1) OVER()` để phân trang thật.
- Lọc `province`, `category`, `q/search`, `routeId` được đưa vào `WHERE` SQL trước khi phân trang.
- Danh sách tourism trả card data ngắn hơn: `shortDescription`, description rút gọn, tọa độ, rating, imageUrl.
- Frontend tiếp tục cache địa điểm theo filter bằng `_placesCache`, debounce 450ms, chỉ load tab khi người dùng mở.
- `stats.repository.overview()` đếm trực tiếp bằng `COUNT` từ SQL thay vì lấy danh sách rồi đếm.

Chưa test benchmark tốc độ live vì sandbox không có SQL Server thật.

### Nhóm 2 — Bến gần tôi

Đã sửa:

- Endpoint giữ chuẩn: `GET /api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5`.
- `stop.repository.findNearby()` tính khoảng cách bằng công thức Haversine ngay trong SQL Server.
- Backend chỉ lấy bến có `latitude/longitude`, lọc theo `province`, `routeId`, `q` nếu có.
- `limit` được validate tối đa 20.
- Response có `distanceMeters`, `distanceKm`, `walkingMinutes`, `routes`, `routeCode`, `routeName`, `latitude`, `longitude`.
- Service vẫn có fallback JS nếu môi trường SQL chưa đủ bảng/index, nhưng luồng chính là SQL.
- Frontend `renderNearestStop()` đã có loading, thông báo GPS, render card bến, nút “Xem trên bản đồ”.

### Nhóm 3 — Địa điểm du lịch

Đã sửa:

- `GET /api/v1/tourism/places?page=1&limit=12&province=DN&routeId=...&q=...` trả `pagination` gồm `page`, `limit`, `offset`, `total`, `totalPages`, `hasMore`.
- Lọc routeId được đưa vào SQL bằng `EXISTS` trên `place_nearby_stops` trước phân trang.
- `favorite_places` là bảng chuẩn cho lưu địa điểm.
- `POST /api/v1/tourism/places/:id/save` kiểm tra place tồn tại, lưu chuẩn vào `favorite_places`, mirror sang bảng cũ nếu còn.
- `DELETE /api/v1/tourism/places/:id/save` xóa khỏi `favorite_places` và các bảng cũ nếu có.
- `GET /api/v1/tourism/favorites/places` và `/users/me/favorite-places` đọc danh sách yêu thích của đúng user.
- Frontend không dùng `skipAuth` khi load tourism nữa, nên nếu user đã đăng nhập thì gửi token và backend có thể trả `isSaved`.
- Nút `Hiện trên bản đồ` vẫn gọi detail rồi focus Leaflet bằng `latitude/longitude`.

### Nhóm 4 — Gợi ý lịch trình

Đã sửa:

- Frontend lấy GPS cho lịch trình với timeout 3 giây thay vì chờ 15 giây, nếu không có GPS vẫn gửi theo tỉnh mặc định.
- Payload frontend hỗ trợ dạng mới: `duration`, `startLocation`, `useBus`, đồng thời giữ `timeAvailable`, `lat`, `lng` để tương thích backend cũ.
- Backend `trip.service.generate()` đọc được `startLocation.latitude/longitude` hoặc `lat/lng`.
- `trip.repository.savePlan()` dùng SQL transaction: nếu insert item lỗi thì rollback toàn bộ plan.

### Nhóm 5 — Lịch sử chat / Cộng đồng review

Đã kiểm tra và giữ/sửa luồng:

- Chatbot dùng token qua API wrapper nếu user đã đăng nhập.
- Backend đang lưu chat qua `data.addChatLog()` vào `chatbot_logs`, mirror sang `chat_logs`/`chat_history` nếu bảng tồn tại.
- `GET /api/v1/users/me/chat-history` chỉ lấy lịch sử của `req.user.id`.
- `GET /api/v1/users/me/community-history` đọc `community_reviews` theo `user_id`.
- `GET /api/v1/users/me/activity-history` đọc `activity_logs` theo `user_id`.
- Frontend `renderChatHistory()` có 3 tab: `Chatbot`, `Cộng đồng review`, `Hoạt động gần đây`.

### Nhóm 6 — Thống kê / Hoạt động gần đây

Đã sửa:

- `stats.repository.overview()` trả thêm `pendingReviews` và `totalTripPlans`.
- `totalReviews` chỉ đếm review công khai `approved/approved_seed`, không tính pending vào public count.
- `GET /api/v1/stats/recent-activities?limit=8` lấy từ `activity_logs`.
- Migration 10 bổ sung cột/index cho `activity_logs` để truy vấn theo user/time nhanh hơn.

### Nhóm 7 — Quản trị nội dung / Duyệt review cộng đồng

Đã sửa/giữ đúng hướng:

- UI admin chỉ hiển thị tab chính `Duyệt review cộng đồng` và `Quản lý địa điểm du lịch`; không đưa “Duyệt bài cộng đồng” làm tab chính.
- Backend admin `/api/v1/admin/reviews` dùng bảng `community_reviews` mặc định.
- `/api/v1/admin/reviews/:id/approve` set `status='approved'`.
- `/api/v1/admin/reviews/:id/reject` set `status='rejected'`.
- `review.repository.adminSetCommunityStatus()` cập nhật thêm `moderated_by`, `moderated_at`, `moderation_note` nếu migration đã có cột.
- Public `/api/v1/reviews` chỉ trả `approved/approved_seed`, nên pending/rejected không hiện công khai.
- Admin API vẫn được bảo vệ bằng `requireAuth + requireRole('admin')`.

## 4. API endpoint chính sau khi sửa

- `GET /api/v1/health/readiness`
- `GET /api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5`
- `GET /api/v1/tourism/places?page=1&limit=12&province=DN&q=...&category=...&routeId=...`
- `GET /api/v1/tourism/places/:id`
- `POST /api/v1/tourism/places/:id/save`
- `DELETE /api/v1/tourism/places/:id/save`
- `GET /api/v1/tourism/favorites/places`
- `GET /api/v1/users/me/favorite-places`
- `POST /api/v1/trip-plans/generate`
- `GET /api/v1/users/me/chat-history`
- `GET /api/v1/users/me/community-history`
- `GET /api/v1/users/me/activity-history`
- `GET /api/v1/stats/overview`
- `GET /api/v1/stats/recent-activities?limit=8`
- `GET /api/v1/admin/reviews?status=pending`
- `POST /api/v1/admin/reviews/:id/approve`
- `POST /api/v1/admin/reviews/:id/reject`

## 5. Database đã thêm/sửa

Tạo mới file:

- `database/10_FIX_CORE_LINKING_PERFORMANCE.sql`

Nội dung chính:

- Tạo/chỉnh bảng chuẩn `favorite_places`.
- Migration mềm dữ liệu từ `favorites_places` và `place_favorites` sang `favorite_places`.
- Bổ sung `activity_logs` nếu thiếu và thêm cột mở rộng.
- Bổ sung `chatbot_logs` nếu thiếu cột.
- Bổ sung `trip_plans`, `trip_plan_items` nếu thiếu.
- Bổ sung moderation columns cho `community_reviews`: `moderated_by`, `moderated_at`, `moderation_note`.
- Bổ sung index:
  - `IX_bus_stops_location_core10`
  - `IX_bus_stops_province_core10`
  - `IX_tourism_places_location_core10`
  - `IX_tourism_places_province_category_core10`
  - `IX_favorite_places_user_place_core10`
  - `IX_activity_logs_user_created_core10`
  - `IX_activity_logs_created_core10`
  - `IX_community_reviews_status_created_core10`
  - `IX_chatbot_logs_user_created_core10`

Không dùng `DROP TABLE`, không `DELETE` dữ liệu.

## 6. Lệnh đã chạy

```bash
cd backend-api
npm ci --no-audit --no-fund --prefer-offline
npm start
curl http://127.0.0.1:5000/api/v1/health/liveness
curl http://127.0.0.1:5000/api/v1/health/readiness
node --check frontend/script.js
node --check docs/script.js
node --check backend-api/modules/stop/stop.repository.js
node --check backend-api/modules/stop/stop.service.js
node --check backend-api/modules/stop/stop.validator.js
node --check backend-api/modules/tourism/tourism.repository.js
node --check backend-api/modules/tourism/tourism.service.js
node --check backend-api/modules/tourism/tourism.controller.js
node --check backend-api/modules/trip/trip.repository.js
node --check backend-api/modules/trip/trip.service.js
node --check backend-api/modules/review/review.repository.js
node --check backend-api/modules/admin/admin.service.js
node --check backend-api/modules/stats/stats.repository.js
cd backend-api && npm run check
```

Kết quả:

```text
npm ci: installed 534 packages successfully.
npm start: backend started at http://localhost:5000/api/v1.
GET /health/liveness: success=true, status=ok.
GET /health/readiness: success=false, status=not_ready because sandbox has no local SQL Server on localhost:1433.
✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.
npm run check exit=0
```

Chi tiết nằm trong:

- `TEST_OUTPUT_CORE_LINKING_PERFORMANCE.txt`

## 7. Những gì chưa test live được trong sandbox

Không test được các phần sau trong sandbox vì thiếu môi trường thật:

- API nghiệp vụ thật qua HTTP như `/stops/nearby`, `/tourism/places`, `/admin/reviews`: backend đã start được, nhưng sandbox không có SQL Server `SmartBusDB` live nên các endpoint cần DB sẽ không truy vấn được dữ liệu thật.
- Render deploy thật: sandbox không truy cập tài khoản Render của bạn.
- GPS/browser/mobile thật: sandbox không có trình duyệt mobile và quyền vị trí.
- SQL migration chạy thật: sandbox không có SQL Server để execute file `.sql`.

Các phần này cần test trên máy bạn sau khi chạy SQL migration và deploy backend.

## 8. Hướng dẫn sau khi nhận ZIP

1. Giải nén ZIP.
2. Mở SQL Server Management Studio.
3. Chọn database `SmartBusDB`.
4. Chạy file:

```text
database/10_FIX_CORE_LINKING_PERFORMANCE.sql
```

5. Mở terminal tại project:

```bash
cd backend-api
npm ci
npm run check
npm start
```

6. Push lên GitHub:

```bash
git add .
git commit -m "fix core backend linking performance"
git push -u origin main
```

7. Vào Render:

```text
Render -> backend SmartBus -> Manual Deploy -> Deploy latest commit
```

8. Nếu GitHub Pages dùng `docs/`, kiểm tra lại repo Settings -> Pages -> Deploy from branch -> `main` / `docs`.

## 9. Tài khoản seed có sẵn nếu chạy file database đầy đủ

Trong `database/00_CHAY_DAU_TIEN_TAO_DATABASE_DAY_DU.sql` có seed admin:

```text
Email: admin@smartbus.vn
Password: Admin123456
```

SQL login local theo script:

```text
Login: SmartBusUser
Password: SmartBus@123456
Database: SmartBusDB
```

## 10. API base URL frontend đang dùng

Frontend đang lấy API base từ:

```js
window.SMARTBUS_API_BASE || "https://smartbus-backend-xr34.onrender.com/api/v1"
```

Nghĩa là nếu muốn đổi backend Render, chỉ cần cấu hình `window.SMARTBUS_API_BASE` hoặc chỉnh URL mặc định trong `frontend/script.js` và đồng bộ sang `docs/script.js`.
