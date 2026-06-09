# FIX BẾN GẦN TÔI TRIỆT ĐỂ

## Lỗi nhìn thấy trên web
Trang GitHub Pages `Bến gần tôi` lấy được GPS nhưng hiển thị:

> Không thể tải dữ liệu — Không lấy được bến gần tôi từ máy chủ. Vui lòng thử lại.

## Nguyên nhân kỹ thuật
1. Frontend đang gọi `GET /api/v1/stops/nearby?lat=...&lng=...&limit=5` tới backend Render.
2. Khi backend Render không có SQL Server sẵn sàng, SQL query lỗi hoặc timeout thì API trả lỗi.
3. Frontend trước đây chỉ có một nhánh lỗi, nên dù project đã có file dữ liệu bến xe thật trong source, giao diện vẫn hiện lỗi và không có kết quả.
4. Vì GitHub Pages là frontend tĩnh, nếu backend/SQL tạm lỗi thì chức năng này vẫn chết.

## Cách sửa triệt để đã làm

### 1. Backend vẫn ưu tiên SQL Server nhưng có fallback thật
Sửa file:

- `backend-api/modules/stop/stop.repository.js`
- `backend-api/modules/stop/stop.service.js`
- `backend-api/modules/stop/stop.validator.js`

Backend bây giờ hoạt động theo thứ tự:

1. Ưu tiên query SQL Server bằng Haversine trong SQL.
2. Nếu SQL Server lỗi, thiếu cấu hình, timeout hoặc Render chưa kết nối DB thì tự đọc file thật:
   - `backend-api/data/import/smartbus-bus-data.normalized.json`
3. Tính khoảng cách bằng Haversine trong backend.
4. Trả về danh sách bến gần nhất, không còn để API chết chỉ vì database tạm lỗi.

Endpoint chính:

```http
GET /api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5
```

Response test được:

```json
{
  "success": true,
  "data": [
    {
      "name": "Sân bay Đà Nẵng",
      "distanceMeters": 133,
      "walkingMinutes": 2
    }
  ],
  "message": "Danh sách bến gần tôi"
}
```

### 2. Frontend GitHub Pages cũng có fallback riêng
Sửa và đồng bộ:

- `frontend/script.js`
- `docs/script.js`

Thêm file dữ liệu tĩnh để GitHub Pages tự dùng khi backend không phản hồi:

- `frontend/data/import/smartbus-bus-data.normalized.json`
- `docs/data/import/smartbus-bus-data.normalized.json`

Frontend bây giờ hoạt động theo thứ tự:

1. Gọi backend `/stops/nearby`.
2. Nếu backend lỗi, timeout, Render chưa deploy hoặc CORS/SQL lỗi, frontend không hiện lỗi ngay.
3. Frontend tự đọc `docs/data/import/smartbus-bus-data.normalized.json` trên GitHub Pages.
4. Tự tính khoảng cách bến gần nhất bằng GPS người dùng.
5. Vẫn hiển thị danh sách bến gần tôi và nút `Xem trên bản đồ`.

Nhờ vậy, ngay cả khi Render/SQL Server tạm chưa chạy, nút `Lấy vị trí của tôi` vẫn có dữ liệu để demo.

## File đã sửa

- `backend-api/modules/stop/stop.repository.js`
- `backend-api/modules/stop/stop.service.js`
- `backend-api/modules/stop/stop.validator.js`
- `frontend/script.js`
- `docs/script.js`
- `frontend/data/import/smartbus-bus-data.normalized.json`
- `docs/data/import/smartbus-bus-data.normalized.json`
- `FIX_BEN_GAN_TOI_TRIET_DE_REPORT.md`

## Lệnh đã test

```bash
node --check backend-api/modules/stop/stop.repository.js
node --check backend-api/modules/stop/stop.service.js
node --check backend-api/modules/stop/stop.validator.js
node --check frontend/script.js
node --check docs/script.js

cd backend-api
npm ci --no-audit --no-fund --prefer-offline
npm run check
PORT=5099 NODE_ENV=test npm start
curl "http://127.0.0.1:5099/api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5"
curl "http://127.0.0.1:5099/api/v1/stops/nearby?lng=108.2022&limit=5"
```

## Kết quả test

- `node --check`: pass.
- `npm ci`: cài 534 packages thành công.
- `npm run check`: pass.
- Backend chạy được tại `http://localhost:5099/api/v1`.
- API `/stops/nearby` khi không có SQL Server vẫn trả `200 OK` nhờ fallback JSON.
- Tọa độ test Đà Nẵng trả về 5 bến gần nhất, bến đầu là `Sân bay Đà Nẵng`, cách khoảng `133m`.
- Trường hợp thiếu `lat` trả `422 VALIDATION_ERROR`, đúng kỳ vọng validate input.

## Việc cần làm sau khi nhận ZIP

1. Giải nén ZIP.
2. Copy/ghi đè toàn bộ project vào repo `SmartBus-Travel`.
3. Push lên GitHub để GitHub Pages cập nhật `docs/`.
4. Nếu muốn backend Render cũng cập nhật fallback backend thì vào Render bấm:
   - `Manual Deploy` → `Deploy latest commit`.
5. Trên trình duyệt bấm hard refresh:
   - `Ctrl + F5`
   - hoặc mở tab ẩn danh để tránh cache GitHub Pages cũ.

## Lưu ý quan trọng

Nếu sau khi push mà vẫn thấy lỗi cũ, nguyên nhân thường là GitHub Pages còn cache file `docs/script.js` cũ. Hãy chờ 1–3 phút, bấm `Ctrl + F5` hoặc mở DevTools → Network → tick `Disable cache` rồi reload.
