# Memory Leak Test Guide

## Công cụ

Chrome DevTools > Performance và Memory Heap Snapshot.

## Kịch bản

1. Mở dashboard bản đồ.
2. Chuyển tỉnh/filter 20 lần.
3. Bật/tắt layer tuyến/bến/xe/du lịch 20 lần.
4. Mở/đóng popup marker nhiều lần.
5. Gửi chatbot 30 câu.
6. Login/logout nhiều lần.
7. Chuyển tab nhiều lần.

## Dấu hiệu đạt

- Marker không tăng vô hạn.
- Event listener không tăng liên tục.
- Interval/polling được clear khi không cần.
- Heap không tăng liên tục sau GC.

## Hàm/chỗ đã cải thiện

- Chatbot `busy` chống double submit.
- `frontend/js/state.js` có `cleanup()` để gom timer.
- CSS/UX giảm render giật và overflow.

## Còn lại

Cần tiếp tục tách sâu `frontend/script.js` để quản lý lifecycle rõ hơn nếu dữ liệu marker tăng lớn.
