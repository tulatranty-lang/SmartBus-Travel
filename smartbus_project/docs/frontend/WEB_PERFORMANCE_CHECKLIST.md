# Web Performance Checklist

## Cách kiểm tra Lighthouse

Chrome DevTools > Lighthouse > chọn Desktop/Mobile > Analyze page load.

## Chỉ số cần xem

- Performance.
- Accessibility.
- Best Practices.
- First Contentful Paint.
- Largest Contentful Paint.
- Total Blocking Time.
- Cumulative Layout Shift.

## Điểm đã tối ưu

- Thêm debounce/helper module.
- Chatbot chống double submit.
- CSS responsive nhẹ, không animation nặng mới.
- Popup map giới hạn chiều rộng.
- Ảnh/card có hướng dẫn lazy loading.

## Phụ thuộc mạng ngoài

- Tile map và Leaflet CDN cần internet nếu chưa có bản local.
- OSRM public có thể chậm; UI cần fallback polyline.

## Mục tiêu

Không có console error nghiêm trọng, không 404 asset quan trọng, mobile không vỡ layout, map có thông báo khi lỗi.
