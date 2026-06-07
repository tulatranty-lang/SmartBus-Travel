# HOTFIX ROUTE + MOBILE MENU SCROLL

## Lỗi người dùng báo
- Mobile hiện bến và xe bus nhưng không hiện tuyến đường/polyline.
- Mở menu mobile chỉ bấm chọn được, không kéo/lăn xuống để chọn các tính năng phía dưới.

## Sửa chính
1. `frontend/script.js` và `docs/script.js`
   - Tắt `preferCanvas` cho Leaflet route để polyline SVG ổn định hơn trên mobile.
   - Tạo Leaflet pane riêng:
     - `routePane` cho tuyến đường.
     - `stopPane` cho bến xe.
     - `vehiclePane` cho xe bus.
     - `focusPane` cho GPS/điểm focus.
   - Vẽ tuyến bằng `pane: "routePane"`, `renderer: L.svg(...)`, class `smartbus-route-line`.
   - Tăng độ rõ tuyến: weight 5, opacity 0.95.
   - Hỗ trợ đọc route path từ nhiều kiểu dữ liệu: `path[]`, `geometry`, `coordinates`, GeoJSON `Feature`, `LineString`, `MultiLineString`.
   - Gọi thêm `/api/v1/map/routes` làm fallback nếu `/bus/routes` thiếu path.

2. `frontend/css/responsive.css`, `docs/css/responsive.css`, `frontend/style.css`, `docs/style.css`
   - Thêm override cuối file để khôi phục thứ tự pane Leaflet.
   - Ép route pane nằm trên tile map: `.leaflet-route-pane { z-index: 430 }`.
   - Cho `.sb-nav` trong sidebar mobile cuộn được bằng touch và mouse wheel.
   - Không để overlay/menu khóa scroll trong sidebar.

## Kiểm tra đã chạy
```bash
cd backend-api
npm run check
```
Kết quả: pass.
