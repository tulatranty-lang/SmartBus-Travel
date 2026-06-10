# README_MOBILE_GPS_UPDATE

## Nội dung bản cập nhật
Bản này sửa frontend/mobile cho SmartBus Travel:
- Menu mobile không bị Leaflet map đè.
- Click/chạm ngoài menu để đóng menu.
- Chatbot hiển thị gọn hơn trên điện thoại.
- Layout mobile chống tràn ngang.
- GPS mobile xử lý permission/timeout/HTTPS tốt hơn.
- Đồng bộ frontend sang docs để GitHub Pages chạy đúng bản mới.

## Cách đưa lên GitHub Pages
Sau khi giải nén bản ZIP này, mở terminal tại thư mục project và chạy:

```powershell
git add .
git commit -m "Fix mobile menu chatbot layout and GPS"
git push
```

Đợi GitHub Pages cập nhật 1-3 phút, sau đó mở:

```text
https://tulatranty-lang.github.io/SmartBus-Travel/?v=mobile-gps-fix
```

Dùng `Ctrl + F5` trên máy tính hoặc xóa cache trên điện thoại nếu vẫn thấy bản cũ.

## Kiểm tra nhanh sau khi deploy
1. Mở web trên điện thoại.
2. Đăng nhập.
3. Vào bản đồ.
4. Bấm nút menu.
5. Kiểm tra sidebar không bị map/zoom control đè.
6. Chạm ngoài sidebar để đóng menu.
7. Mở chatbot, kiểm tra không tràn màn hình.
8. Bấm nút GPS/Lấy vị trí, cấp quyền location.

## Lưu ý GPS
GPS chỉ hoạt động tốt khi:
- Web chạy HTTPS, ví dụ GitHub Pages.
- Người dùng cấp quyền Location cho trình duyệt.
- Điện thoại bật dịch vụ định vị.
- Nếu đã chặn quyền, cần vào cài đặt trình duyệt/site để bật lại.
