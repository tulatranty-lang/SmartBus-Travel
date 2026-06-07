# Changelog - Mobile Map/Menu/GPS Final Fix

## Changed

- Đồng bộ `frontend/` và `docs/` cho GitHub Pages.
- Củng cố logic render Leaflet route, stop, vehicle marker.
- Thêm normalize/validate tọa độ GIS trước khi render.
- Thêm fallback đặt xe bus theo route path nếu API location sai hoặc quá xa tuyến.
- Thêm `safeInvalidateSmartBusMap()` để xử lý resize mobile, orientation, sidebar toggle.
- Cải thiện menu mobile: nút mở/đóng cố định, toggle bằng cùng một nút, click outside, ESC.
- Cải thiện z-index sidebar/overlay/Leaflet/chatbot trên mobile.
- Cải thiện GPS mobile: secure context, loading state, permission/timeout error handling.

## Not changed

- Không đổi backend/API Render.
- Không đổi database.
- Không xóa Leaflet.
- Không xóa chức năng hiện có.
