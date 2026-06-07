# Báo cáo sửa lỗi mobile menu và bản đồ SmartBus

## Các lỗi đã xử lý

1. **Menu mobile làm mờ/kẹt toàn bộ web**
   - Chuẩn hóa lại `#overlay`, `#sidebar`, `#menu-btn` cho mobile.
   - Overlay nằm dưới sidebar, chỉ dim nhẹ nội dung phía sau.
   - Đóng menu được bằng overlay, Escape, resize desktop và khi chuyển view.
   - Reset đầy đủ `body.style.overflow` và các class trạng thái khi đóng menu.

2. **Tuyến đường Leaflet bị mất trên mobile**
   - Xóa các block CSS mobile ép toàn bộ `.leaflet-*` về `z-index: 1`.
   - Không phá z-index nội bộ của Leaflet nữa.
   - Tạo custom panes trong `MapModule.init()`:
     - `smartbusRoutePane`: tuyến đường/polyline.
     - `smartbusStopPane`: bến/điểm dừng.
     - `smartbusVehiclePane`: xe bus.
     - `smartbusFocusPane`: GPS, điểm được focus.

3. **Bounds tọa độ quá hẹp làm rơi tuyến/bến**
   - Mở rộng `CENTRAL_VIETNAM_BOUNDS` thành:
     - `minLat: 14.55`
     - `maxLat: 17.35`
     - `minLng: 106.70`
     - `maxLng: 109.35`
   - Bao phủ được Quảng Trị, Huế, Đà Nẵng, Quảng Nam cũ/Hội An, Quảng Ngãi, Sa Huỳnh, Ba Tơ, Cam Lộ và cả khu Khe Sanh/Tà Cơn.

4. **Marker bến xe bị lệch vị trí GPS**
   - Bỏ marker dạng pin xoay `rotate(-45deg)`.
   - Chuyển sang marker tròn, anchor đúng tâm `[15, 15]`.
   - Label tên bến nằm ngoài icon, không xoay theo marker.

5. **Fallback path khi API route.path thiếu**
   - `getPath(routeId)` giờ có fallback dựng tuyến từ `State.stops` theo `sequence`.
   - Nếu route path thiếu nhưng bến còn đủ từ 2 điểm trở lên thì tuyến vẫn vẽ được.

6. **Đồng bộ frontend và docs**
   - Đã đồng bộ các file sửa từ `frontend/` sang `docs/` để bản GitHub Pages không còn lỗi cũ.

## File đã sửa chính

- `frontend/script.js`
- `frontend/style.css`
- `frontend/css/responsive.css`
- `frontend/css/map.css` được giữ nguyên và đồng bộ sang docs.
- `docs/script.js`
- `docs/style.css`
- `docs/css/responsive.css`
- `docs/css/map.css`
- `backend-api/modules/map/map.repository.js`

## Kiểm tra đã chạy

```bash
cd backend-api
npm run check
```

Kết quả:

```text
✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.
```

## Cách test nhanh trên điện thoại

1. Mở DevTools hoặc điện thoại thật ở width 390px hoặc 430px.
2. Bấm nút menu:
   - Sidebar phải hiện rõ.
   - Nền phía sau chỉ mờ nhẹ.
   - Bấm overlay đóng được.
   - Đóng xong web không còn mờ/kẹt.
3. Vào dashboard bản đồ:
   - Chọn Đà Nẵng, Quảng Nam cũ/Hội An, Quảng Trị, Quảng Ngãi.
   - Tuyến đường phải hiện.
   - Bến/điểm dừng phải đúng vị trí và nằm trên/gần tuyến.
   - Bật/tắt “Hiện điểm dừng” và “Hiện tên bến” phải hoạt động.
4. Test các tuyến/điểm nhạy cảm:
   - QNG/Sa Huỳnh/Ba Tơ không bị mất do `minLat`.
   - QT/Cam Lộ/Khe Sanh không bị mất do `minLng`.
