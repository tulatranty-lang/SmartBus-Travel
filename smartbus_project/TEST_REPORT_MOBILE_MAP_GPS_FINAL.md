# Test Report - Mobile Map/Menu/GPS Final Fix

## Static checks đã chạy

```bash
node --check frontend/script.js
node --check docs/script.js
cd backend-api && npm run check
```

Kết quả:

```text
✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.
```

## API local/IP check

Đã kiểm tra trong file public JS/HTML/CSS của `frontend/` và `docs/` không còn:

- `localhost:5000`
- `192.168`
- `http://localhost`
- `http://192.168`

API vẫn dùng:

```text
https://smartbus-backend-xr34.onrender.com/api/v1
```

## Test đã xác nhận bằng code

- `frontend/script.js` không lỗi cú pháp.
- `docs/script.js` không lỗi cú pháp.
- Backend static check vẫn pass.
- `frontend/` và `docs/` đã được đồng bộ.
- Route/stop/bus render đều đi qua logic normalize/validate tọa độ.
- Có logic clear/update marker khi đổi filter.
- Có logic invalidate Leaflet khi load/resize/sidebar/filter/GPS.

## Test chưa thể làm trong sandbox

- Không thể test GPS thật bằng Android Chrome/iPhone Safari vì sandbox không có thiết bị thật và không có quyền Location thật.
- Không thể xác nhận hình ảnh trực tiếp trên GitHub Pages sau khi bạn push vì sandbox không deploy thay tài khoản GitHub của bạn.

## Hướng test sau khi push

1. Mở web trên điện thoại bằng HTTPS GitHub Pages.
2. Bấm nút menu:
   - mở được sidebar;
   - bấm lại nút menu đóng sidebar;
   - click/chạm ngoài sidebar đóng sidebar;
   - Leaflet không đè menu.
3. Kiểm tra bản đồ:
   - tuyến không nối lung tung;
   - bến và xe bus nằm trong khu vực miền Trung;
   - đổi tỉnh/tuyến/filter không để marker cũ chồng lên.
4. Bấm “Lấy vị trí của tôi”:
   - trình duyệt hỏi quyền Location;
   - cho phép thì hiện marker vị trí;
   - từ chối thì hiện thông báo hướng dẫn.
