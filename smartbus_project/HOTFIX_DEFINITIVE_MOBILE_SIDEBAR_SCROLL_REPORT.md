# HOTFIX DEFINITIVE MOBILE SIDEBAR SCROLL

Ngày: 2026-06-07

## Lỗi xử lý
- Sidebar mobile mở được nhưng không cuộn được bằng chuột hoặc cảm ứng.
- Các bản trước còn để nhiều block CSS mobile ghi đè nhau: lúc thì sidebar `display:block`, lúc `.sb-nav` `overflow:visible`, lúc body/map/overlay chặn thao tác.

## Cách sửa cuối cùng
- Tạo vùng cuộn thật sự `.sb-mobile-scroll-region` bằng JavaScript.
- Di chuyển `.sb-nav` và `.sb-footer` vào vùng cuộn này, giữ nguyên event listener của các nút.
- CSS mobile ép sidebar về cấu trúc chuẩn:
  - `.sb-header` cố định phía trên.
  - `.sb-mobile-scroll-region` chiếm phần còn lại và `overflow-y: scroll`.
  - `overlay` chỉ nằm ngoài sidebar và chỉ để đóng menu.
- Bắt sự kiện `wheel`, `touchstart`, `touchmove` ở `document` theo capture phase để không bị Leaflet map/body/overlay chặn.
- Click/chạm ngoài sidebar sẽ đóng menu.

## File đã sửa
- frontend/style.css
- frontend/css/responsive.css
- frontend/script.js
- docs/style.css
- docs/css/responsive.css
- docs/script.js

## Kiểm tra đã chạy
- `node --check frontend/script.js`
- `node --check docs/script.js`
- `cd backend-api && npm run check`

Kết quả: pass.
