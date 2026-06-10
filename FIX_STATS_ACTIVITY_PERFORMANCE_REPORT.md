# FIX STATS ACTIVITY PERFORMANCE REPORT

## 1. Đã sửa gì

- Sửa chức năng **Thống kê & Phân tích / Hoạt động gần đây** để ưu tiên gọi backend thật `/api/v1/stats/recent-activities?limit=8` với timeout dài hơn cho Render cold start.
- Sửa frontend không còn chỉ báo lỗi `Không tải được hoạt động gần đây từ backend`; nếu backend chậm thì dùng dữ liệu hoạt động tạm từ `State.activityLog`, báo cáo localStorage và dữ liệu đã đồng bộ trên frontend để UI vẫn cập nhật được.
- Thêm cache 30 giây cho API GET và riêng hoạt động gần đây để không gọi backend lặp khi đổi tab.
- Thêm cache 60 giây cho dữ liệu bản đồ theo tỉnh trong `DynamicData.load()` để thao tác chuyển tab/tỉnh nhanh hơn, giảm gọi lại `/bus/routes`, `/bus/stops`, `/bus/vehicle-locations`, `/map/routes`.
- Sửa backend `stats.repository.js`:
  - `/stats/overview` đếm dữ liệu thật từ SQL Server nếu có.
  - Nếu SQL Server chưa sẵn sàng hoặc bảng chưa có dữ liệu, backend trả số liệu từ file import thật trong project: `smartbus-bus-data.normalized.json` và `smartbus-tourism-data.normalized.json`.
  - `/stats/recent-activities` lấy dữ liệu từ `activity_logs`; nếu chưa có thì tổng hợp thêm từ `reports`, `community_reviews`, `chatbot_logs`; nếu SQL Server chưa sẵn sàng thì trả activity đồng bộ dữ liệu import.
- Sửa tiếp helper Leaflet `safeMapFlyTo()` và `safeMarkerSetLatLng()` để không nhận `LatLng` có `NaN`, giảm lỗi/warning lặp trong console.
- Thêm migration `database/11_FIX_STATS_ACTIVITY_PERFORMANCE.sql` để đảm bảo bảng `activity_logs` và index phục vụ thống kê hoạt động.

## 2. File đã sửa

- `docs/script.js`
- `frontend/script.js`
- `backend-api/modules/stats/stats.repository.js`
- `database/11_FIX_STATS_ACTIVITY_PERFORMANCE.sql`

## 3. Test đã chạy

```bash
node --check docs/script.js
node --check frontend/script.js
node --check backend-api/modules/stats/stats.repository.js
cd backend-api && npm ci --no-audit --no-fund --prefer-offline
cd backend-api && npm run check
cd backend-api && npm start
GET /api/v1/stats/overview
GET /api/v1/stats/recent-activities?limit=8
```

Kết quả:

- `node --check`: 0 syntax error.
- `npm ci`: cài dependency thành công.
- `npm run check`: passed.
- `npm start`: backend chạy tại `http://localhost:5000/api/v1`.
- `GET /api/v1/stats/overview`: trả `success=true`, có số liệu từ bộ import khi sandbox không có SQL Server.
- `GET /api/v1/stats/recent-activities?limit=8`: trả `success=true`, có activity `Đã sẵn sàng 39 tuyến, 243 bến và 60 địa điểm từ bộ dữ liệu import`.

## 4. Chưa test được

- Chưa test với SQL Server live `SmartBusDB` thật trong máy bạn/Render vì sandbox không có database đó.
- Sau khi nhận ZIP, bạn cần chạy `database/11_FIX_STATS_ACTIVITY_PERFORMANCE.sql` trong `SmartBusDB`, push code lên GitHub và redeploy Render để backend production dùng logic mới.
