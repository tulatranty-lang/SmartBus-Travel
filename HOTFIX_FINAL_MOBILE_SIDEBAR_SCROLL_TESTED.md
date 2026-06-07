# Hotfix cuối: Mobile sidebar scroll/select

## Vấn đề
Các bản vá trước thêm nhiều block CSS/JS chồng nhau trong `style.css`, `responsive.css`, `script.js`. Trên mobile, menu mở được nhưng vùng menu không nhận wheel/touch ổn định, dẫn đến không cuộn xuống được và khó chọn các tính năng bên dưới.

## Cách sửa
Tạo 2 file riêng được load cuối cùng để thắng toàn bộ CSS/JS cũ:

- `frontend/css/mobile-sidebar-final.css`
- `frontend/js/mobile-sidebar-final.js`
- `docs/css/mobile-sidebar-final.css`
- `docs/js/mobile-sidebar-final.js`

Đã thêm link/script vào cuối `frontend/index.html` và `docs/index.html`.

## Logic mới
- Sidebar mobile là `position: fixed`, z-index cao hơn overlay.
- Header logo đứng yên.
- Nav + footer được đưa vào `.sb-mobile-scroll-region`.
- `.sb-mobile-scroll-region` là vùng cuộn thật sự với `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `touch-action: pan-y`.
- Bắt `wheel`, `touchstart`, `touchmove`, `click`, `pointerdown` ở `window capture` để chạy trước các handler cũ/Leaflet.
- Wheel/touch bên trong sidebar sẽ cuộn menu.
- Click/touch bên ngoài sidebar sẽ đóng menu.
- Click vào `.sb-link[data-view]` gọi trực tiếp `Nav.go(view)` để không bị mất thao tác chọn tính năng.

## Kiểm tra đã chạy
```bash
node --check frontend/script.js
node --check docs/script.js
node --check frontend/js/mobile-sidebar-final.js
node --check docs/js/mobile-sidebar-final.js
cd backend-api && npm run check
```

Kết quả: pass.

## Ghi chú deploy
Bản này có thêm file frontend/docs nên sau khi push GitHub Pages cần mở link với cache-buster, ví dụ:

`?v=final-sidebar-scroll-tested`
