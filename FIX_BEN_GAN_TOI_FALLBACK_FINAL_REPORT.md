# Báo cáo sửa lỗi Bến gần tôi - GitHub Pages fallback final

## 1. Đã sửa gì

- Sửa `TravelUI._getNearbyStopsTrietDe`:
  - Tăng timeout backend Render từ ngưỡng cũ lên `25000ms`.
  - Backend lỗi/cold start chỉ `console.warn`, không làm sập chức năng.
  - Bọc riêng fallback `State.stops` bằng `try/catch`.
  - Bọc riêng fallback JSON tĩnh bằng `try/catch`.
  - Thêm tầng fallback cuối `_getHardcodedStops()` với 20 bến Đà Nẵng/Hội An offline.
  - Cuối hàm luôn trả `{ stops, source }`, không throw ra UI.

- Thêm `TravelUI._getHardcodedStops`:
  - Danh sách 20 bến/điểm dừng Đà Nẵng và Hội An để chức năng vẫn chạy nếu backend, dữ liệu đã load và JSON tĩnh đều lỗi.

- Sửa `TravelUI._nearbyFromStaticBusJson`:
  - Thêm path GitHub Pages `/SmartBus-Travel/data/import/smartbus-bus-data.normalized.json` lên đầu danh sách thử.
  - Giữ thêm các path tương đối cũ.
  - Thêm `lastError` để log lỗi cuối.
  - Nếu tất cả JSON path fail thì `return []`, không throw.

- Sửa `TravelUI.renderNearestStop`:
  - Không còn show lỗi backend kỹ thuật khi fallback vẫn còn khả năng chạy.
  - Empty state thân thiện: “Không tìm thấy bến gần vị trí hiện tại. Dữ liệu bến đang được cập nhật. Vui lòng thử lại sau.”
  - Có nút `🔄 Thử lại` gọi `TravelUI.renderNearestStop(true)`.
  - Catch cuối thử fallback `_getHardcodedStops()` thêm một lần nữa trước khi render empty state.

- Sửa `TravelUI._renderNearbyStops`:
  - Giữ `MapModule.markUserLocation(gps.lat, gps.lng)` chạy trước.
  - `focusStop(stops[0])` chạy sau `1500ms`, để người dùng thấy vị trí GPS thật trước khi map chuyển sang bến gần nhất.

- Sửa `MapModule.markUserLocation`:
  - Sau khi đặt marker/circle GPS, map gọi `map.flyTo(ll, 15, { duration: 1.0 })`.
  - Tự mở popup “Vị trí hiện tại của bạn” sau 800ms.

- Sửa nút GPS bản đồ `#gis-gps-btn`:
  - Sau khi GPS thành công chỉ gọi `MapModule.markUserLocation(gps.lat, gps.lng)`.
  - Không tự động focus bến gần nhất ở nút GPS bản đồ.

## 2. File nào đã sửa

- `docs/script.js`
- `frontend/script.js`

Không sửa HTML, CSS, layout, framework, backend hoặc database.

## 3. Test gì đã chạy

```bash
node --check docs/script.js
node --check frontend/script.js
```

Kết quả:

- `docs/script.js`: OK, 0 syntax error.
- `frontend/script.js`: OK, 0 syntax error.

Log test kèm theo: `TEST_BEN_GAN_TOI_FINAL.txt`.

## Ghi chú trung thực

- Đã kiểm tra cú pháp JavaScript bằng `node --check`.
- Chưa test trực tiếp trên GitHub Pages thật trong sandbox vì môi trường này không điều khiển được repo GitHub Pages/deploy/cache trình duyệt của bạn.
- Sau khi push lên GitHub, cần mở web bằng `Ctrl + F5` hoặc tab ẩn danh để tránh cache `docs/script.js` cũ.
