# TEST_REPORT_MOBILE_GPS_UPDATE

## Lệnh đã chạy

### 1. Kiểm tra cú pháp frontend
```bash
node --check frontend/script.js
node --check frontend/js/config.js
node --check frontend/js/api.js
node --check docs/script.js
node --check docs/js/config.js
node --check docs/js/api.js
```
Kết quả: chạy thành công, không báo lỗi cú pháp JS.

### 2. Kiểm tra backend static check
```bash
cd backend-api
npm run check
```
Kết quả:
```text
✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.
```

### 3. Kiểm tra backend start
```bash
cd backend-api
timeout 6s npm start
```
Kết quả: backend khởi động được và log:
```text
SmartBus Travel Connect API running at http://localhost:5000/api/v1
```
Lệnh bị dừng bằng timeout có chủ đích để không treo phiên làm việc.

### 4. Kiểm tra test script
```bash
cd backend-api
npm test
```
Kết quả: chưa chạy được trong sandbox vì `jest: not found`. Cần chạy `npm install` trên máy thật trước khi dùng `npm test`.

### 5. Kiểm tra API cũ trong file public
```bash
grep -RInE 'localhost:5000|192\\.168|http://localhost|http://192\\.168' frontend docs --include='*.js' --include='*.html'
```
Kết quả: không còn URL local/IP LAN trong JS/HTML public.

## Checklist theo yêu cầu

### Mobile menu/sidebar
- Đã thêm trạng thái `body.sidebar-open`.
- Đã tăng z-index sidebar/overlay.
- Đã hạ z-index Leaflet khi menu mở.
- Đã khóa pointer-events của Leaflet khi menu mở.
- Đã thêm click/touch ngoài sidebar để đóng menu.
- Đã thêm ESC để đóng menu.

### Chatbot mobile
- Đã sửa CSS panel/button cho mobile.
- Đã ẩn chatbot khi sidebar mở.
- Đã thêm `chat-open` state khi mở chatbot.
- Đã bỏ request GPS tự động khi chatbot bind.

### Layout mobile
- Đã thêm overflow-x hardening.
- Đã ép card/map/button/input không vượt viewport.
- Đã tối ưu map height và width trên mobile.

### GPS mobile
- Đã thêm `SmartBusGeo` helper.
- Đã xử lý HTTPS, permission denied, unavailable, timeout.
- Đã thêm loading state nút GPS.
- Đã đồng bộ với map/chatbot/tourism/nearby stop.

## Chưa test được trực tiếp
- GPS thực tế trên iPhone/Android.
- Render visual bằng Chrome DevTools ở 360px/390px/414px/768px.
- Click/chạm vật lý trên màn hình cảm ứng.

Lý do: sandbox không có trình duyệt mobile/thiết bị GPS thật. Các phần trên cần test lại sau khi bạn push lên GitHub Pages và mở bằng điện thoại.
