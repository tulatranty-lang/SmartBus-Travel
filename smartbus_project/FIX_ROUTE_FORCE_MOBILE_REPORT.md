# SmartBus Mobile Route Force Hotfix

Đã sửa tiếp lỗi mobile chỉ hiện xe/bến nhưng không hiện tuyến:

- Không vẽ tuyến trong custom `routePane` nữa, chuyển về `overlayPane` mặc định của Leaflet để tránh bị ẩn trên mobile.
- `drawRoutes()` luôn fallback dựng tuyến từ danh sách bến theo route nếu API thiếu path.
- So khớp tuyến/bến không phân biệt hoa thường và hỗ trợ route aliases.
- Tăng độ dày/opacity của polyline trên mobile.
- Sidebar mobile chuyển sang scroll toàn bộ sidebar để kéo/lăn chuột được.
- Đồng bộ `frontend/` và `docs/`.
