# SmartBus 3 — giao diện đã tích hợp

Yêu cầu hiện hành: nâng cấp thị giác và tương tác bằng công nghệ mã nguồn mở, miễn phí, không giới hạn stack. Chọn React 19 + TypeScript + Vite, TanStack Query, Radix UI, Motion, MapLibre và OpenFreeMap; giữ API Express/SQL Server đã đạt CI ở PR #1.

Hướng thiết kế: nền trắng ngà, xanh ngọc/xanh mực, ảnh miền Trung có giấy phép mở, bản đồ WebGL, tìm nhanh Ctrl/⌘ K, responsive và điều hướng dùng được bằng bàn phím. Không sinh dữ liệu giả để trang đẹp hơn. Nguồn web/src build vào frontend/app và phục vụ qua backend hiện tại; không tạo một sản phẩm tách rời.

Giao diện mới là trang mặc định của Express và bản dựng GitHub Pages. `npm run setup` cài cả hai phần và dựng React; `npm run build` dựng lại rồi đồng bộ `docs`. Các bundle được tách cho bản đồ, lịch trình, không gian cá nhân và quản trị; bản đồ thu nhỏ ở trang chủ chỉ mở khi cuộn đến. Runtime API vẫn do Express cung cấp, không nhúng bí mật trong bundle. Vite dùng đường dẫn tương đối và HashRouter cho static host có đường dẫn con.

Đã nối tổng quan, tìm nhanh Ctrl/⌘ K, danh sách/chi tiết tuyến và điểm đến, tìm bến theo GPS hoặc tọa độ, lịch trình hủy chờ/thu gọn/mở lại, yêu thích, trải nghiệm chờ duyệt, hồ sơ/lịch sử và quản trị. Quyền được kiểm tra lại tại API, không dựa riêng vào nút hiển thị.

Đợt hoàn tất này sửa bản đồ trắng do CSS MapLibre ghi đè kích thước vùng vẽ; mở các điểm trong lịch trình đúng lớp và tự bao khung; xóa lựa chọn tuyến cũ khi đổi khu vực; cho phép tải OpenFreeMap và worker cùng origin qua CSP; sửa chữ nhạt trên nền sáng. Tệp seed SQL lớn có timeout migration riêng, không thay SQL lịch sử hoặc timeout API.

Đã nghiệm thu trên Windows, Edge thật và SQL Server 17.0: 51 kiểm thử giao diện, 72 unit/API, 28 nhóm SQL thật, 5 nâng cấp, 12 nhóm trình duyệt. Xem [kết quả và giới hạn](UI_VERIFICATION.md). Không coi bản chụp UI đời trước là bằng chứng cho giao diện mới.

Tài liệu triển khai bản đồ: [OpenFreeMap + Vite](https://openfreemap.org/quick_start/), [MapLibre v6 và CSP](https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/). Không cần tài khoản hay khóa API cho các nguồn bản đồ đang dùng; vẫn cần Internet và tuân thủ ghi nguồn trên bản đồ/ảnh.
