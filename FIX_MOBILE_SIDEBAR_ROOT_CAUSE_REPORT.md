# SmartBus Mobile Sidebar Root Fix

## Lỗi gốc đã tìm được
Menu mobile bị mở nhưng không cuộn/không bấm được ổn định vì `#overlay` nằm ngoài `#app`, còn `#app` có `z-index: 900`. Dù `.sidebar` có đặt `z-index` rất cao, nó vẫn bị giới hạn trong stacking context của `#app`; vì vậy overlay ở ngoài có thể nằm trên toàn bộ app và chặn thao tác trong sidebar.

Ngoài ra source có nhiều block hotfix mobile chồng nhau trong `style.css`, `responsive.css`, `script.js` và file `mobile-sidebar-final.*`, khiến CSS/JS tự ghi đè lẫn nhau.

## Cách sửa tận gốc
- Chuyển `#overlay` vào bên trong `#app`, đặt giữa `</aside>` và `.main` để overlay và sidebar cùng stacking context.
- Đặt sidebar `z-index: 10020`, overlay `z-index: 10010`; sidebar luôn nằm trên overlay.
- Thêm vùng cuộn thật trong HTML: `#sidebar-scroll.sb-scroll` chứa cả `.sb-nav` và `.sb-footer`.
- Xóa các file vá chồng `mobile-sidebar-final.css/js` khỏi HTML và khỏi project.
- Xóa các block hotfix/definitive/final cũ trong CSS/JS.
- Viết lại mobile sidebar bằng một bộ CSS duy nhất trong `style.css` và một logic JS duy nhất trong `Nav`.
- Click/chạm ngoài menu đóng sidebar bằng overlay và `pointerdown` document capture.
- Click tính năng trong menu gọi `Nav.go(view)` và đóng menu.
- Lăn chuột/kéo tay trong `#sidebar-scroll` cập nhật `scrollTop` trực tiếp.

## File đã sửa
- `frontend/index.html`
- `frontend/style.css`
- `frontend/css/responsive.css`
- `frontend/script.js`
- `docs/index.html`
- `docs/style.css`
- `docs/css/responsive.css`
- `docs/script.js`

## Đã kiểm tra
- `node --check frontend/script.js`
- `node --check docs/script.js`
- `cd backend-api && npm run check`
- Kiểm tra tĩnh: overlay chỉ còn 1 bản, nằm trong `#app`, sau sidebar và trước `.main`.
- Kiểm tra tĩnh: không còn `mobile-sidebar-final`, `HOTFIX`, `DEFINITIVE`, `FINAL FIX`, `sb-mobile-scroll-region` trong frontend/docs.

## Lưu ý deploy
Bản này chỉ sửa frontend/docs. Nếu dùng GitHub Pages từ thư mục `docs`, chỉ cần push GitHub, không cần redeploy Render.
