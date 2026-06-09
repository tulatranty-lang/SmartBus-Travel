# FIX BẾN GẦN TÔI - BACKEND FALLBACK

## Lỗi ban đầu
Frontend hiển thị: "Không thể tải dữ liệu - Không lấy được bến gần tôi từ máy chủ. Vui lòng thử lại."

## Nguyên nhân kỹ thuật
API `/api/v1/stops/nearby` đã có route, nhưng khi SQL Server/Render chưa kết nối được hoặc bảng dữ liệu chưa sẵn sàng, backend rơi vào lỗi khi gọi repository lấy bến xe. Frontend nhận lỗi network/API nên hiển thị thông báo không tải được dữ liệu.

## File đã sửa
- `backend-api/modules/stop/stop.repository.js`

## Nội dung sửa
- Thêm fallback đọc dữ liệu bến xe thật từ file import chuẩn của project:
  `backend-api/data/import/smartbus-bus-data.normalized.json`
- Không tạo dữ liệu giả.
- Không đổi endpoint frontend.
- Không đổi giao diện.
- Khi SQL Server hoạt động, backend vẫn ưu tiên query SQL Server.
- Khi SQL Server lỗi/tạm mất kết nối, `/stops/nearby` vẫn trả danh sách bến gần nhất từ dữ liệu import thật.
- Fallback có đủ route liên quan, tọa độ, tỉnh, khoảng cách, thời gian đi bộ.

## API đã test
```bash
GET /api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5
```

Kết quả: `200 OK`, trả về danh sách 5 bến gần vị trí Đà Nẵng, gồm Sân bay Đà Nẵng và các bến lân cận.

## Lệnh đã chạy
```bash
cd backend-api
npm ci --no-audit --no-fund --prefer-offline
npm start
curl -i "http://localhost:5010/api/v1/stops/nearby?lat=16.0544&lng=108.2022&limit=5"
node --check backend-api/modules/stop/stop.repository.js
node --check frontend/script.js
node --check docs/script.js
cd backend-api && npm run check
```

## Kết quả test
- `node --check`: passed.
- `npm run check`: passed.
- API nearby: trả `200 OK` trong môi trường không có SQL Server live nhờ fallback dữ liệu import thật.

## Cần làm sau khi nhận ZIP
1. Giải nén ZIP.
2. Push code lên GitHub.
3. Vào Render → Manual Deploy → Deploy latest commit.
4. Sau khi Render deploy xong, mở lại web và thử nút "Lấy vị trí của tôi".
