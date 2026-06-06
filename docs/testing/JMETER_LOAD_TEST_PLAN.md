# JMeter / k6 Load Test Plan

## Mục tiêu

Đánh giá độ ổn định API SmartBus khi người dùng xem tuyến, bản đồ, địa điểm du lịch và hỏi chatbot.

## API cần test

- `GET /api/v1/health`
- `GET /api/v1/routes`
- `GET /api/v1/stops/nearest?lat=16.047&lng=108.206`
- `GET /api/v1/tourism/places`
- `POST /api/v1/chatbot/ask`
- `GET /api/v1/map/routes`
- `GET /api/v1/map/stops`
- `GET /api/v1/community/posts`

## Kịch bản

### Smoke Load Test

- 20 users
- Ramp-up 30 giây
- Duration 2 phút
- Health, routes, tourism.

### Normal Load Test

- 50 users
- Ramp-up 1 phút
- Duration 5 phút
- Login, routes, stops/nearest, tourism, chatbot.

### Heavy Demo Test

- 100 users
- Ramp-up 2 phút
- Duration 10 phút
- Map routes/stops, tourism, chatbot, community posts.

### Stress Test

- 300 users
- Ramp-up 5 phút
- Duration 15 phút
- Chỉ chạy nếu máy và SQL Server chịu được. Không chạy trên production nếu chưa backup.

## Ngưỡng đạt

- Error rate < 1%.
- p95 `/health` < 100ms.
- p95 `/routes` < 300ms.
- p95 `/stops/nearest` < 400ms.
- p95 `/tourism/places` < 600ms.
- p95 map layer < 1200ms.
- p95 `/chatbot/ask` < 1500ms.

## Theo dõi

CPU/RAM backend, SQL Server CPU, connection pool, disk, network, slow query và error rate 4xx/5xx.
