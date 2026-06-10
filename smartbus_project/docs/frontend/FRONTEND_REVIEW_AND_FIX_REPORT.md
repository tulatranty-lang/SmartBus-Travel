# Frontend Review and Fix Report

## Vấn đề phát hiện

- Chatbot fallback có lỗi runtime do `payload` khai báo trong `try` nhưng dùng trong `catch`.
- Nhiều popup/card dùng HTML template nên cần escape dữ liệu.
- CSS/JS legacy còn lớn; đã thêm module/helper mới nhưng giữ entry cũ để không phá demo.
- Mobile cần thêm lớp responsive cho chatbot, popup map, CTA.
- Cần trạng thái lỗi thân thiện khi backend/map/GPS lỗi.

## Đã sửa

- Sửa `payload is not defined` trong `frontend/script.js`.
- Giới hạn câu hỏi chatbot 1000 ký tự, chống double submit qua `busy`.
- Loại bỏ log raw lỗi dài, không log token.
- Xóa CTA chatbot bị render trùng.
- Thêm CSS responsive/polish trong `frontend/css/*`.
- Thêm `frontend/js/api.js`, `utils.js`, `state.js`, `performance.js` để chuẩn hóa module mới.
- Cập nhật hero/CTA: “Tôi muốn đi đâu?”, “Tìm bến gần tôi”, “Khám phá du lịch”.
- Thêm handler lỗi frontend nhẹ trong `performance.js`.

## File thay đổi

- `frontend/index.html`
- `frontend/script.js`
- `frontend/css/base.css`
- `frontend/css/layout.css`
- `frontend/css/components.css`
- `frontend/css/map.css`
- `frontend/css/tourism.css`
- `frontend/css/chatbot.css`
- `frontend/css/responsive.css`
- `frontend/js/api.js`
- `frontend/js/utils.js`
- `frontend/js/state.js`
- `frontend/js/performance.js`

## Test đã chạy

- `node --check ../frontend/script.js`
- `node --check ../frontend/js/performance.js`
- `node --check ../frontend/js/api.js`

## Chưa test được trong môi trường này

- Chưa mở Chrome/Edge/Firefox thật bằng UI vì môi trường hiện tại không có trình duyệt đồ họa tương tác.
- Cần người dùng test bằng Live Server theo `FRONTEND_RUN_GUIDE.md`.

## Kết quả kiểm tra cuối

- Frontend syntax trong `frontend/script.js`, `frontend/js/performance.js`, `frontend/js/api.js` đã được kiểm tra qua `npm run check` của backend.
- Chưa chạy browser manual bằng Chrome/Edge/Firefox thật trong môi trường này; cần test theo `CROSS_BROWSER_TEST_PLAN.md`.
