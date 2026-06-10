# HOTFIX: Khôi phục bản đồ mobile giống desktop

## Mục tiêu
Bản hotfix này ưu tiên giữ cách hiển thị bản đồ/marker giống bản desktop, chỉ sửa đúng các lỗi mobile gây khó thao tác:

- Menu mobile không cuộn được.
- Overlay làm tối/mờ khó chịu.
- Lớp Leaflet bị ép z-index làm tuyến/bến có thể mất.
- Bounds GPS quá hẹp làm rơi bến/tuyến hợp lệ của Quảng Ngãi và Quảng Trị.

## Điều chỉnh chính

### 1. Không đổi kiểu marker bến xe
Giữ nguyên marker dạng pin desktop:

- `html: <div class="stop-marker"><span class="stop-emoji">...</span>{label}</div>`
- `iconSize: [28, 28]`
- `iconAnchor: [14, 28]`
- `popupAnchor: [0, -28]`

Lý do: bản mobile phải giống bản máy tính, không đổi sang marker tròn vì dễ tạo cảm giác vị trí bị lệch so với bản desktop.

### 2. Mở rộng bounds GPS
Sửa trong:

- `frontend/script.js`
- `docs/script.js`

Bounds mới:

```js
minLat: 14.55,
maxLat: 17.35,
minLng: 106.70,
maxLng: 109.35,
```

### 3. Sửa menu mobile cuộn được
Sửa bằng CSS override cuối file trong:

- `frontend/style.css`
- `frontend/css/responsive.css`
- `docs/style.css`
- `docs/css/responsive.css`

Các điểm chính:

- `.sidebar` có `overflow-y: auto`, `touch-action: pan-y`, `-webkit-overflow-scrolling: touch`.
- Không khóa toàn bộ thao tác chạm của body bằng `touch-action: none`.
- Overlay giảm độ tối xuống `rgba(0,0,0,0.28)`.
- Sidebar có z-index cao hơn overlay.

### 4. Khôi phục thứ tự lớp Leaflet
Không ép toàn bộ Leaflet pane về `z-index: 1` nữa. Override lại theo logic Leaflet:

- tile: 200
- route/polyline overlay: 400
- marker: 600
- popup/control: cao hơn

## Test đã chạy

```bash
cd backend-api
npm run check
```

Kết quả:

```text
✅ SmartBus static check passed: SQL Server config, frontend auth, no fake DB fallback.
```

## Cách kiểm tra lại trên điện thoại

1. Push bản này lên GitHub.
2. Mở GitHub Pages bằng tab ẩn danh hoặc xóa cache trình duyệt.
3. Vào bản đồ.
4. So sánh vị trí bến với bản desktop.
5. Bấm menu và thử kéo sidebar lên/xuống.
6. Đổi tỉnh Đà Nẵng, Quảng Nam cũ, Quảng Ngãi, Quảng Trị để kiểm tra tuyến/bến.
