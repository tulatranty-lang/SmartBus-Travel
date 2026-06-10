# Postman API Test Guide

## Environment variables

- `baseUrl`: `http://localhost:5000/api/v1`
- `accessToken`: token user thường
- `refreshToken`: refresh token user thường
- `adminAccessToken`: token admin
- `userAccessToken`: token user thường

## Smoke requests

1. `GET {{baseUrl}}/health` phải 200.
2. `GET {{baseUrl}}/health/db` trả 200 nếu DB OK, 503 nếu DB chưa cấu hình.
3. `POST {{baseUrl}}/auth/login` với user thường, lưu `accessToken` và `refreshToken`.
4. `POST {{baseUrl}}/auth/refresh-token` với refresh token hợp lệ.
5. `GET {{baseUrl}}/routes?page=1&limit=20`.
6. `GET {{baseUrl}}/stops?page=1&limit=20`.
7. `GET {{baseUrl}}/stops/nearest?lat=16.047&lng=108.206`.
8. `GET {{baseUrl}}/tourism/places?page=1&limit=20`.
9. `POST {{baseUrl}}/chatbot/ask` body `{ "question": "Tôi muốn đến Hội An" }`.
10. `GET {{baseUrl}}/chat/history` không token phải 401.
11. `GET {{baseUrl}}/chat/history` với token user phải 200 và chỉ lịch sử của user đó.
12. `GET {{baseUrl}}/reports` với user thường phải 403.
13. `GET {{baseUrl}}/reports` với admin/moderator phải 200.
14. `GET {{baseUrl}}/analytics/summary` với user thường phải 403.
15. `GET {{baseUrl}}/import/history` với user thường phải 403.
16. `POST {{baseUrl}}/import/bus-data` với admin mới được phép.

## Lưu ý

Không paste token vào tài liệu public. Khi test lỗi 401/403, đó là kết quả đúng nếu thiếu quyền.
