# FIX STATS ACTIVITY _esc ERROR

## 1. Đã sửa gì
- Sửa lỗi console: `TypeError: this._esc is not a function` trong `AnalyticsUI._renderActivityLog()`.
- Nguyên nhân trực tiếp: `_renderActivityLog()` dùng `this._esc(...)` để render Hoạt động gần đây, nhưng object `AnalyticsUI` chưa có hàm `_esc`.
- Bổ sung hàm `_esc(v)` trực tiếp vào `AnalyticsUI` để escape HTML an toàn khi render tiêu đề hoạt động, thời gian và nguồn dữ liệu.
- Sau sửa, phần `Hoạt động gần đây` không còn bị kẹt ở trạng thái `Đang tải hoạt động gần đây từ backend...` do lỗi JavaScript này.

## 2. File đã sửa
- `docs/script.js`
- `frontend/script.js`

## 3. Test đã chạy
```bash
node --check docs/script.js
node --check frontend/script.js
```

Kết quả:
- `docs/script.js`: OK, 0 syntax error.
- `frontend/script.js`: OK, 0 syntax error.

## 4. Ghi chú
- Không sửa HTML/CSS/layout.
- Không đổi framework.
- Không xóa chức năng hiện có.
- Lỗi extension Chrome `Unchecked runtime.lastError: Could not establish connection...` không thuộc code SmartBus.
