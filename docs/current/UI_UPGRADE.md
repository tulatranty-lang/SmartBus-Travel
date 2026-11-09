# SmartBus 3 — giao diện mới đang triển khai

Yêu cầu hiện hành: nâng cấp thị giác và tương tác bằng công nghệ mã nguồn mở, miễn phí, không giới hạn stack. Chọn React 19 + TypeScript + Vite, TanStack Query, Radix UI, Motion, MapLibre và OpenFreeMap; giữ API Express/SQL Server đã đạt CI ở PR #1.

Hướng thiết kế: nền trắng ngà, xanh ngọc/xanh mực, ảnh miền Trung có giấy phép mở, bản đồ WebGL, tìm nhanh Ctrl/⌘ K, responsive và điều hướng dùng được bằng bàn phím. Không sinh dữ liệu giả để trang đẹp hơn. Nguồn web/src build vào frontend/app và phục vụ qua backend hiện tại; không tạo một sản phẩm tách rời.

Nghiệm thu: tổng quan → tìm tuyến/địa điểm → bản đồ/chi tiết → lịch trình/cancel/collapse → yêu thích/review/profile/history → admin. Loading/empty/error/retry, request hủy, quyền truy cập, 390px/desktop, production build và API/SQL regression. Bằng chứng UI cũ không chứng minh UI mới đã đạt; cập nhật báo cáo riêng sau khi chạy.
