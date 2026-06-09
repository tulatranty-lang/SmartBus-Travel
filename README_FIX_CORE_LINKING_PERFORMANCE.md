# README – Chạy bản SmartBus đã fix core linking/performance

## 1. Chạy SQL migration mới

Mở SQL Server Management Studio, chọn database `SmartBusDB`, rồi chạy:

```text
database/10_FIX_CORE_LINKING_PERFORMANCE.sql
```

File này an toàn, dùng `IF NOT EXISTS`, không xóa bảng và không xóa dữ liệu.

## 2. Chạy backend local

```bash
cd backend-api
npm ci
npm run check
npm start
```

Nếu thiếu file `.env`, copy từ `.env.example` rồi điền SQL Server:

```env
DB_SERVER=localhost
DB_NAME=SmartBusDB
DB_USER=SmartBusUser
DB_PASSWORD=SmartBus@123456
API_PREFIX=/api/v1
```

## 3. Test nhanh API

```bash
curl http://localhost:4000/api/v1/health/readiness
curl "http://localhost:4000/api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5"
curl "http://localhost:4000/api/v1/tourism/places?page=1&limit=12"
curl "http://localhost:4000/api/v1/stats/overview"
curl "http://localhost:4000/api/v1/stats/recent-activities?limit=8"
```

Các API cần token:

```text
POST /api/v1/tourism/places/:id/save
DELETE /api/v1/tourism/places/:id/save
GET /api/v1/users/me/favorite-places
GET /api/v1/users/me/chat-history
GET /api/v1/users/me/activity-history
GET /api/v1/admin/reviews?status=pending
POST /api/v1/admin/reviews/:id/approve
POST /api/v1/admin/reviews/:id/reject
```

## 4. Deploy

Sau khi push GitHub:

```text
Render -> Manual Deploy -> Deploy latest commit
```

Frontend GitHub Pages vẫn dùng `docs/`, vì `frontend/script.js` đã được đồng bộ sang `docs/script.js`.
