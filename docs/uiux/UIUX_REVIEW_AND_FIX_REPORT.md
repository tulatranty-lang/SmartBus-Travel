# UI/UX Review and Fix Report

## Vấn đề ban đầu

- Trang chính chưa nhấn mạnh đủ 3 hành động chính.
- Bản đồ/chatbot/du lịch cần thêm trạng thái lỗi và responsive.
- CSS legacy có màu tối mạnh, spacing/card cần lớp chuẩn hóa nhẹ.

## Đã sửa

- Hero nói rõ SmartBus giúp tìm tuyến, bến gần bạn, địa điểm du lịch và chatbot.
- Thêm CTA: “Tôi muốn đi đâu?”, “Tìm bến gần tôi”, “Khám phá du lịch”.
- Thêm CSS polish cho button/card/popup/chatbot/mobile.
- Cập nhật chatbot fallback, hạn chế lỗi đứng UI.
- Thêm docs design system, usability, consistency, responsive.

## Test thủ công cần chạy

Mở Chrome + Live Server, kiểm tra hero, login/logout, map, layer, popup, tourism, chatbot, review/community, 390px/768px/1366px.

## Lỗi còn lại

Chưa chạy được usability test với người dùng thật trong môi trường này.

## Kết quả kiểm tra cuối

- Đã kiểm tra cú pháp HTML/JS liên quan qua lệnh backend `npm run check`.
- Chưa thể chạy usability test với người dùng thật hoặc ảnh chụp trước/sau trong môi trường này.
