# SmartBus Travel - Mobile Map/Menu/GPS Final Fix

Bản cập nhật này tập trung vào lỗi mobile nghiêm trọng trên SmartBus Travel:

- Bản đồ Leaflet trên mobile bị tuyến/bến/marker hiển thị rối hoặc lệch.
- Menu mobile cần nút bấm mở/thu gọn rõ ràng.
- Click/chạm ngoài menu phải đóng menu.
- GPS mobile phải được gọi từ thao tác người dùng, có loading và báo lỗi rõ.
- GitHub Pages đang dùng thư mục `docs/`, nên các thay đổi đã được đồng bộ giữa `frontend/` và `docs/`.

## File quan trọng đã sửa

- `frontend/script.js`
- `frontend/style.css`
- `docs/script.js`
- `docs/style.css`
- `frontend/css/responsive.css`
- `docs/css/responsive.css`
- `frontend/js/api.js`
- `docs/js/api.js`
- `frontend/js/config.js`
- `docs/js/config.js`

## Nội dung sửa chính

### 1. Chuẩn hóa tọa độ GIS

Đã thêm một lớp xử lý tọa độ dùng chung:

- `toSmartBusNumber()`
- `normalizeLatLng()`
- `normalizePathPoints()`
- `isCoordinateInCentralVietnam()`
- `distanceFromPathMeters()`

Tất cả dữ liệu chính khi render map được chuẩn hóa về `[lat, lng]` của Leaflet. Code cũng tự nhận diện trường hợp mảng tọa độ giống GeoJSON `[lng, lat]` để đảo lại trước khi render.

### 2. Sửa tuyến/polyline

- Route path được validate trước khi vẽ.
- Nếu route không có path hợp lệ, code fallback sang danh sách stop theo đúng `routeId/routeCode/displayCode`.
- Không nối bến của nhiều tuyến vào một polyline.
- Khi vẽ lại tuyến, layer cũ được xóa trước.

### 3. Sửa marker xe bus

- Tọa độ xe bus từ API được validate.
- Nếu xe có tọa độ ngoài vùng miền Trung hoặc quá xa path tuyến, code không dùng tọa độ sai đó mà đặt xe theo progress trên route path.
- Tránh xe bus demo/random nhảy ra biển hoặc lệch khỏi tuyến.

### 4. Sửa marker bến xe

- Bến xe được validate tọa độ trước khi render.
- Stop marker được xóa/cập nhật theo filter hiện tại.
- Không giữ marker cũ sau khi đổi tỉnh/tuyến/filter.

### 5. Sửa Leaflet resize trên mobile

Đã thêm `safeInvalidateSmartBusMap()` và gọi lại khi:

- load trang;
- resize/orientationchange;
- mở/đóng sidebar;
- đổi filter bản đồ;
- render route/stop/bus;
- GPS thành công.

### 6. Sửa menu mobile

- Nút menu mobile bây giờ cố định, rõ ràng ở góc trái.
- Bấm một lần mở sidebar.
- Bấm lại chính nút đó thu sidebar.
- Click/chạm overlay bên ngoài sidebar sẽ đóng menu.
- ESC đóng menu.
- Khi menu mở, Leaflet và chatbot không đè lên menu.

### 7. Sửa GPS mobile

- GPS được gọi qua `navigator.geolocation.getCurrentPosition()` từ thao tác người dùng.
- Có kiểm tra HTTPS/security context.
- Có loading state cho nút GPS.
- Có xử lý lỗi permission denied, position unavailable, timeout.
- Khi GPS thành công: lưu vị trí, vẽ marker user, center map và invalidate map.

## Cách deploy

Sau khi giải nén đúng thư mục có `.git`, chạy:

```powershell
git status
git add .
git commit -m "Fix mobile map menu and GPS"
git push
```

Sau đó mở GitHub Pages bằng link chống cache:

```text
https://tulatranty-lang.github.io/SmartBus-Travel/?v=mobile-map-gps-final
```

## Lưu ý

GPS thật chỉ có thể test đầy đủ trên điện thoại thật với link HTTPS. Nếu đã từng chặn Location, cần bật lại quyền vị trí trong trình duyệt.
