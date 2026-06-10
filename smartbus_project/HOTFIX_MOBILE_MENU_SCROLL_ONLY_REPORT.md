# HOTFIX MENU MOBILE SCROLL

Ngày sửa: 2026-06-07

## Lỗi
Menu mobile mở được nhưng không cuộn lên/xuống được bằng cảm ứng hoặc lăn chuột, làm các chức năng phía dưới bị kẹt.

## Cách sửa
- Ép sidebar mobile dùng `display:flex`, `height:100dvh/100svh/100vh`, `overflow:hidden`.
- Cho riêng `.sb-nav` là vùng cuộn thật bằng `overflow-y:scroll`.
- Thêm JS bắt `wheel` và `touchmove` trực tiếp trên `#sidebar` để tránh map/body/overlay chặn sự kiện cuộn.
- Không sửa tọa độ bến, xe, tuyến.

## File đã sửa
- frontend/css/responsive.css
- docs/css/responsive.css
- frontend/style.css
- docs/style.css
- frontend/script.js
- docs/script.js
