# CHANGELOG_MOBILE_GPS_UPDATE

## Mục tiêu sửa
Sửa trực tiếp các lỗi mobile theo yêu cầu: menu/sidebar bị Leaflet đè, click/chạm ngoài menu để đóng, chatbot bị lỗi kích thước/z-index trên điện thoại, layout mobile bị tràn/khó nhìn, GPS mobile không lấy được vị trí ổn định và đồng bộ frontend/ sang docs/ cho GitHub Pages.

## File đã sửa
- `frontend/script.js`
- `frontend/style.css`
- `frontend/css/responsive.css`
- `frontend/js/config.js`
- `frontend/js/api.js`
- `docs/index.html`
- `docs/script.js`
- `docs/style.css`
- `docs/css/responsive.css`
- `docs/js/config.js`
- `docs/js/api.js`
- Đồng bộ thêm `frontend/assets`, `frontend/css`, `frontend/js`, `frontend/modules` sang `docs/` để GitHub Pages dùng đúng bản frontend đã sửa.

## 1. Menu/sidebar mobile và Leaflet
- Nâng z-index sidebar mobile lên `9999`.
- Nâng overlay `#overlay` lên `9998` trên mobile.
- Khi menu mở, thêm trạng thái `body.sidebar-open`.
- Khi `body.sidebar-open`, hạ z-index các lớp Leaflet xuống và khóa `pointer-events` để map không nhận chạm/click phía sau menu.
- Bổ sung xử lý các lớp Leaflet: `.leaflet-container`, `.leaflet-pane`, `.leaflet-map-pane`, `.leaflet-tile-pane`, `.leaflet-overlay-pane`, `.leaflet-marker-pane`, `.leaflet-tooltip-pane`, `.leaflet-popup-pane`, `.leaflet-control-container`, `.leaflet-top`, `.leaflet-bottom`, `.leaflet-control`.

## 2. Click/chạm ngoài menu để đóng
- Sửa `Nav.bind`, `Nav._openSidebar`, `Nav._closeSidebar`.
- Click `#overlay` sẽ đóng sidebar.
- `touchstart` trên overlay cũng đóng sidebar cho điện thoại.
- Bấm `Escape` đóng sidebar.
- Click bên trong sidebar không lan ra overlay.
- Khi mở sidebar, body bị khóa scroll bằng `body.style.overflow = "hidden"`.
- Khi đóng sidebar, scroll được khôi phục.
- Khi mở sidebar, chatbot panel tự đóng/ẩn để không đè menu.

## 3. Chatbot mobile
- Sửa kích thước chatbot trên mobile: panel dùng `position: fixed`, `left/right: 12px`, `max-height: 72dvh`.
- Button chatbot nằm gọn ở góc phải dưới, có safe-area cho điện thoại.
- Khi sidebar mở, chatbot button/panel bị ẩn bằng CSS để không đè menu.
- Thêm body class `chat-open` khi mở chatbot và remove khi đóng.
- Bỏ hành vi tự xin GPS khi vừa bind chatbot để tránh spam quyền vị trí trên mobile.

## 4. Layout responsive tổng quan
- Thêm bộ CSS mobile hardening ở `style.css` và `css/responsive.css`.
- Khóa tràn ngang bằng `overflow-x: hidden` cho `html`, `body`, `#app`, `.main`, `.main-body`, `.view`, `.landing-page`, `.landing-main`.
- Ép card/panel/button/input/map không vượt quá 100% viewport.
- Điều chỉnh `#map`, `.map-wrap`, `.leaflet-container` để không phá layout mobile.

## 5. GPS mobile
- Thêm helper `SmartBusGeo` xử lý GPS tập trung.
- Kiểm tra HTTPS/secure context trước khi gọi GPS.
- Xử lý `navigator.geolocation` không tồn tại.
- Xử lý permission denied, position unavailable, timeout với thông báo tiếng Việt rõ ràng.
- Dùng `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 30000`.
- Có loading state cho nút GPS.
- Không spam request GPS nếu đang lấy vị trí.
- Đồng bộ logic GPS cho:
  - Nút `#gis-gps-btn` trên bản đồ.
  - Nút `#place-near-me` và `#nearby-gps-btn` trong du lịch/bến gần tôi.
  - Nút `#chat-gps-btn` của chatbot.
- Khi lấy GPS thành công, gọi `MapModule.markUserLocation` và cập nhật `State.userLocation`.

## 6. API Render
- Đổi API fallback trong frontend từ `localhost:5000` sang:
  `https://smartbus-backend-xr34.onrender.com/api/v1`
- Kiểm tra không còn `localhost:5000`, `http://localhost`, `192.168`, `http://192.168` trong các file JS/HTML public của `frontend/` và `docs/`.

## Chưa làm được trong sandbox
- Không thể test GPS thật trên điện thoại vì sandbox không có trình duyệt mobile và quyền location thực.
- Không thể kiểm tra trực quan hoàn toàn bằng Chrome DevTools responsive trong sandbox. Đã kiểm tra bằng static code, syntax check và logic CSS/JS.
