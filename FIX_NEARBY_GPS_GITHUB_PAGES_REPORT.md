# FIX NEARBY GPS GITHUB PAGES REPORT

## 1. Đã sửa gì

- Sửa `Bến gần tôi` không còn fail toàn bộ khi backend Render cold start hoặc API `/stops/nearby` timeout.
- Tăng timeout API backend từ `9000ms` lên `25000ms` trong `_getNearbyStopsTrietDe`.
- Sửa fallback `_nearbyFromStaticBusJson` thử đúng đường dẫn GitHub Pages trước:
  - `/SmartBus-Travel/data/import/smartbus-bus-data.normalized.json`
  - `./SmartBus-Travel/data/import/smartbus-bus-data.normalized.json`
  - Sau đó mới thử các đường dẫn cũ.
- Bọc toàn bộ fallback static JSON bằng `try/catch`; nếu tất cả URL fail thì trả `[]`, không throw làm sập chức năng.
- Bọc riêng fallback static trong `_getNearbyStopsTrietDe`; nếu lỗi ngoài dự kiến thì trả `{ stops: [], source: 'Không tìm thấy dữ liệu bến' }`.
- Sửa empty state khi không có bến: hiển thị thông báo dễ hiểu và có nút `Thử lại` gọi `TravelUI.renderNearestStop(true)`.
- Sửa error message không còn ghi “kiểm tra file docs/...”; thay bằng “Không kết nối được backend. Hãy thử lại sau vài giây.”
- Sửa `MapModule.markUserLocation`: sau khi lấy GPS, map `flyTo` về đúng vị trí user và tự mở popup vị trí.
- Sửa `_renderNearbyStops`: sau khi mark vị trí user, delay `1500ms` rồi mới focus bến gần nhất để người dùng thấy vị trí thật của mình trước.
- Nút GPS trên dashboard map không tự focus bến; chỉ mark và pan đến vị trí user thông qua `SmartBusGeo.get` + `MapModule.markUserLocation`.

## 2. File nào đã sửa

- `docs/script.js`
- `frontend/script.js`

## 3. Test gì đã chạy

```bash
node --check /mnt/data/s11work/smartbus_project/docs/script.js
node --check /mnt/data/s11work/smartbus_project/frontend/script.js
```

Kết quả: cả hai file đều không có lỗi cú pháp JavaScript.
