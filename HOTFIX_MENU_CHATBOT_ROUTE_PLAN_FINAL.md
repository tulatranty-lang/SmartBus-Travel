# HOTFIX MENU + CHATBOT ROUTE PLAN FINAL

Đã sửa:

1. Mobile sidebar
   - Chạm/click ngoài sidebar sẽ thu menu.
   - Toàn bộ sidebar là vùng cuộn dọc, dùng được cả lăn chuột và kéo tay.
   - Overlay chỉ đóng menu, không chặn thao tác cuộn trong sidebar.

2. Chatbot gợi ý tuyến
   - Không còn dùng điểm xuống/điểm đến làm nhầm thành điểm đón.
   - Backend trả riêng `pickupStop`, `destinationStop`, `destinationPlace`.
   - Chat card hiển thị rõ: Điểm đón, Điểm xuống, Điểm đến, Lộ trình.
   - Có `routePlan.legs` để mô tả các chặng kết hợp: đi bộ → tuyến xe → đi bộ tới đích.

3. Map sau gợi ý chatbot
   - Hiện marker riêng cho điểm đón, điểm xuống, điểm đến.
   - Khi người dùng đổi bộ lọc tuyến/tỉnh/chế độ hiển thị, trạng thái gợi ý chatbot được xóa để bản đồ chạy theo tính năng vừa chọn.

Đồng bộ:
- frontend/script.js -> docs/script.js
- frontend/style.css -> docs/style.css
- frontend/css/responsive.css -> docs/css/responsive.css
- backend-api/modules/chat/chat.service.js
