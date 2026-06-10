# Đồng bộ bản sửa Mobile/GPS vào SmartBus Travel

Đã đồng bộ các bản sửa từ `SmartBV6_MOBILE_GPS_FIXED.zip` vào project `SmartBus Travel.zip`.

## Nhóm lỗi đã đồng bộ

- Sidebar/menu mobile bị bản đồ Leaflet đè.
- Click/chạm bên ngoài sidebar để đóng menu.
- ESC đóng menu.
- Chatbot mobile bị tràn/đè/z-index sai.
- Layout mobile bị scroll ngang/kích thước khó chịu.
- GPS mobile: kiểm tra HTTPS, permission, timeout, loading state, lỗi vị trí.
- Đồng bộ `frontend/` và `docs/` để GitHub Pages chạy đúng.

## File đã thay thế/đồng bộ

- `frontend/style.css`
- `frontend/css/responsive.css`
- `frontend/script.js`
- `frontend/js/config.js`
- `frontend/js/api.js`
- `docs/style.css`
- `docs/css/responsive.css`
- `docs/script.js`
- `docs/js/config.js`
- `docs/js/api.js`

## Ghi chú

- Giữ nguyên `.git/` trong project người dùng để có thể tiếp tục `git status`, `git add`, `git commit`, `git push`.
- Không đổi backend/API Render.
- API public vẫn là `https://smartbus-backend-xr34.onrender.com/api/v1`.
