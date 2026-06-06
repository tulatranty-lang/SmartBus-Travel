# Frontend Run Guide

1. Chạy backend trước: `cd backend-api && npm start`.
2. Mở `frontend/index.html` bằng VS Code Live Server.
3. Backend mặc định: `http://localhost:5000/api/v1`.
4. Nếu CORS lỗi, thêm origin Live Server vào `backend-api/.env` dòng `CORS_ORIGIN`.
5. Nếu bản đồ không hiện, kiểm tra internet/Leaflet CDN/tile map.
6. Nếu chatbot báo backend chưa kết nối, kiểm tra `npm start` và SQL Server.
7. Bật GPS Chrome: biểu tượng ổ khóa trên thanh địa chỉ > Site settings > Location > Allow.
8. Test mobile bằng DevTools Toggle Device Toolbar.
9. Kiểm tra Console/Network không có JS error hoặc asset 404 quan trọng.
