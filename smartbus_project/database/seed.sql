/*
  SmartBusDB sample data.
  Chạy sau database/schema.sql. Tài khoản admin nên tạo bằng: cd backend-api && npm run seed:admin
*/
USE SmartBusDB;
GO

IF NOT EXISTS (SELECT 1 FROM tourist_categories WHERE code='beach')
INSERT INTO tourist_categories(code, name, icon, sort_order) VALUES
('beach', N'Biển', N'🏖️', 1),
('culture', N'Văn hóa', N'🏛️', 2),
('shopping', N'Mua sắm', N'🛍️', 3),
('checkin', N'Check-in', N'📸', 4),
('spiritual', N'Tâm linh', N'🙏', 5),
('entertainment', N'Vui chơi', N'🎡', 6),
('nature', N'Thiên nhiên', N'🌿', 7),
('food', N'Ẩm thực', N'🍜', 8);
GO

IF NOT EXISTS (SELECT 1 FROM bus_stops WHERE name=N'Bến xe Trung tâm')
INSERT INTO bus_stops(name, address, latitude, longitude) VALUES
(N'Bến xe Trung tâm', N'Tôn Đức Thắng, Đà Nẵng', 16.0718, 108.1487),
(N'Chợ Cồn', N'Hùng Vương, Đà Nẵng', 16.0678, 108.2148),
(N'Cầu Rồng / Bảo tàng Chăm', N'Đường 2 Tháng 9, Đà Nẵng', 16.0608, 108.2249),
(N'Bến Hội An', N'Phố cổ Hội An, Quảng Nam', 15.8794, 108.3380),
(N'Sân bay Đà Nẵng', N'Duy Tân, Đà Nẵng', 16.0439, 108.1998),
(N'Bà Nà Hills', N'Hòa Ninh, Hòa Vang, Đà Nẵng', 15.9975, 107.9975),
(N'Công viên Biển Đông', N'Võ Nguyên Giáp, Đà Nẵng', 16.0555, 108.2473),
(N'Ngũ Hành Sơn / Non Nước', N'Huyền Trân Công Chúa, Đà Nẵng', 16.0036, 108.2640),
(N'Chợ Hàn', N'Trần Phú, Đà Nẵng', 16.0680, 108.2243),
(N'Asia Park / Helio', N'2 Tháng 9, Đà Nẵng', 16.0382, 108.2265);
GO

DECLARE @BenXe INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bến xe Trung tâm');
DECLARE @ChoCon INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Chợ Cồn');
DECLARE @CauRong INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Cầu Rồng / Bảo tàng Chăm');
DECLARE @HoiAnStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bến Hội An');
DECLARE @SanBay INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Sân bay Đà Nẵng');
DECLARE @BaNaStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bà Nà Hills');
DECLARE @BienDong INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Công viên Biển Đông');
DECLARE @NguHanhSonStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Ngũ Hành Sơn / Non Nước');
DECLARE @ChoHanStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Chợ Hàn');
DECLARE @AsiaParkStop INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Asia Park / Helio');

IF NOT EXISTS (SELECT 1 FROM bus_routes WHERE route_code='02')
INSERT INTO bus_routes(route_code, name, description, start_stop_id, end_stop_id, type, fare, color, operating_time, interval_text)
VALUES
('02', N'Bến xe Trung tâm – Hội An', N'Tuyến kết nối Đà Nẵng với Hội An.', @BenXe, @HoiAnStop, N'Không trợ giá', N'6.000đ', '#e4008a', N'05:30 – 18:00', N'20 phút'),
('03', N'Sân bay – Bà Nà Hills', N'Tuyến gợi ý đi Bà Nà từ khu vực sân bay.', @SanBay, @BaNaStop, N'Trợ giá', N'6.000đ', '#7b61ff', N'05:30 – 18:00', N'30 phút'),
('05', N'Trung tâm – Biển Mỹ Khê', N'Tuyến phù hợp đi biển và Công viên Biển Đông.', @ChoCon, @BienDong, N'Trợ giá', N'5.000đ', '#00b0ff', N'05:30 – 21:00', N'15 phút'),
('06', N'Sân bay – Ngũ Hành Sơn', N'Tuyến phù hợp đi Non Nước và Ngũ Hành Sơn.', @SanBay, @NguHanhSonStop, N'Trợ giá', N'6.000đ', '#ff9800', N'05:30 – 20:00', N'20 phút'),
('07', N'Chợ Hàn – Asia Park', N'Tuyến nội đô đi mua sắm và vui chơi.', @ChoHanStop, @AsiaParkStop, N'Trợ giá', N'5.000đ', '#4caf50', N'06:00 – 21:00', N'15 phút');
GO

IF NOT EXISTS (SELECT 1 FROM buses WHERE bus_code='BUS-02-01')
INSERT INTO buses(bus_code, plate, route_code, status, capacity, speed_kmh, progress, crowding, latitude, longitude) VALUES
('BUS-02-01', '43B-020.01', '02', 'active', 40, 28, 0.20, 'moderate', 16.0608, 108.2249),
('BUS-02-02', '43B-020.02', '02', 'active', 40, 24, 0.60, 'quiet', 16.0308, 108.2449),
('BUS-03-01', '43B-030.01', '03', 'active', 40, 32, 0.35, 'busy', 16.0439, 108.1998),
('BUS-05-01', '43B-050.01', '05', 'active', 40, 22, 0.70, 'moderate', 16.0555, 108.2473),
('BUS-06-01', '43B-060.01', '06', 'active', 40, 26, 0.44, 'quiet', 16.0036, 108.2640),
('BUS-07-01', '43B-070.01', '07', 'active', 40, 20, 0.28, 'quiet', 16.0382, 108.2265);
GO

DECLARE @Beach INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='beach');
DECLARE @Culture INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='culture');
DECLARE @Shopping INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='shopping');
DECLARE @Checkin INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='checkin');
DECLARE @Spiritual INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='spiritual');
DECLARE @Entertainment INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='entertainment');
DECLARE @Nature INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='nature');
DECLARE @Food INT = (SELECT TOP 1 id FROM tourist_categories WHERE code='food');

IF NOT EXISTS (SELECT 1 FROM tourist_places WHERE slug='hoi-an')
INSERT INTO tourist_places(name, slug, description, category_id, address, latitude, longitude, image_url, opening_hours, suggested_duration_minutes, min_budget, max_budget, average_rating, review_count, is_active)
VALUES
(N'Hội An', 'hoi-an', N'Phố cổ, đèn lồng, ẩm thực và văn hóa di sản. Phù hợp đi tuyến 02 từ Đà Nẵng.', @Culture, N'Phố cổ Hội An, Quảng Nam', 15.8794, 108.3380, 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b', N'Cả ngày', 180, 100000, 450000, 4.8, 128, 1),
(N'Bà Nà Hills', 'ba-na-hills', N'Khu du lịch núi nổi tiếng với Cầu Vàng, khí hậu mát và nhiều điểm check-in.', @Nature, N'Hòa Ninh, Hòa Vang, Đà Nẵng', 15.9975, 107.9975, 'https://images.unsplash.com/photo-1583417319070-4a69db38a482', N'07:00 - 17:00', 300, 900000, 1500000, 4.7, 96, 1),
(N'Ngũ Hành Sơn', 'ngu-hanh-son', N'Danh thắng núi đá vôi, hang động, chùa chiền và làng đá mỹ nghệ Non Nước.', @Spiritual, N'81 Huyền Trân Công Chúa, Ngũ Hành Sơn', 16.0036, 108.2640, 'https://images.unsplash.com/photo-1528127269322-539801943592', N'07:00 - 17:30', 120, 50000, 200000, 4.5, 76, 1),
(N'Biển Mỹ Khê', 'bien-my-khe', N'Bãi biển trung tâm đẹp, dễ tiếp cận bằng xe buýt.', @Beach, N'Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', 16.0597, 108.2476, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', N'Cả ngày', 120, 0, 250000, 4.6, 155, 1),
(N'Cầu Rồng', 'cau-rong', N'Biểu tượng Đà Nẵng, đẹp nhất buổi tối.', @Checkin, N'Nguyễn Văn Linh, Hải Châu', 16.0612, 108.2278, 'https://images.unsplash.com/photo-1528127269322-539801943592', N'Cả ngày', 60, 0, 120000, 4.7, 210, 1),
(N'Chợ Hàn', 'cho-han', N'Chợ trung tâm tiện mua quà, đặc sản và trải nghiệm ẩm thực địa phương.', @Shopping, N'119 Trần Phú, Hải Châu', 16.0680, 108.2243, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5', N'06:00 - 19:00', 90, 50000, 600000, 4.3, 88, 1),
(N'Asia Park / Da Nang Downtown', 'asia-park-da-nang-downtown', N'Khu vui chơi giải trí, vòng quay Sun Wheel và hoạt động buổi tối.', @Entertainment, N'01 Phan Đăng Lưu, Hải Châu', 16.0382, 108.2265, 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9', N'15:00 - 22:00', 180, 150000, 500000, 4.3, 69, 1);
GO

DECLARE @HoiAn INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='hoi-an');
DECLARE @BaNa INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='ba-na-hills');
DECLARE @NguHanhSon INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='ngu-hanh-son');
DECLARE @MyKhe INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='bien-my-khe');
DECLARE @CauRongPlace INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='cau-rong');
DECLARE @ChoHanPlace INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='cho-han');
DECLARE @AsiaPark INT = (SELECT TOP 1 id FROM tourist_places WHERE slug='asia-park-da-nang-downtown');
DECLARE @HoiAnStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bến Hội An');
DECLARE @BaNaStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Bà Nà Hills');
DECLARE @NguHanhSonStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Ngũ Hành Sơn / Non Nước');
DECLARE @BienDong2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Công viên Biển Đông');
DECLARE @CauRong2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Cầu Rồng / Bảo tàng Chăm');
DECLARE @ChoHan2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Chợ Hàn');
DECLARE @AsiaParkStop2 INT = (SELECT TOP 1 id FROM bus_stops WHERE name=N'Asia Park / Helio');

IF NOT EXISTS (SELECT 1 FROM place_nearby_stops WHERE place_id=@HoiAn AND route_code='02')
INSERT INTO place_nearby_stops(place_id, stop_id, route_code, distance_meters, walking_minutes, note) VALUES
(@HoiAn, @HoiAnStop2, '02', 350, 5, N'Xuống gần khu phố cổ, đi bộ vào trung tâm.'),
(@BaNa, @BaNaStop2, '03', 500, 7, N'Tuyến 03 kết nối sân bay và khu Bà Nà.'),
(@NguHanhSon, @NguHanhSonStop2, '06', 650, 9, N'Phù hợp kết hợp Non Nước.'),
(@MyKhe, @BienDong2, '05', 220, 3, N'Bến gần biển, dễ tìm.'),
(@CauRongPlace, @CauRong2, '02', 300, 4, N'Có thể đi các tuyến qua trung tâm.'),
(@ChoHanPlace, @ChoHan2, '07', 240, 3, N'Bến trung tâm gần chợ.'),
(@AsiaPark, @AsiaParkStop2, '07', 450, 6, N'Dễ đi buổi chiều/tối.');
GO

IF NOT EXISTS (SELECT 1 FROM notifications WHERE title=N'Ra mắt SmartBus Travel Connect')
INSERT INTO notifications(user_id, title, content, type) VALUES
(NULL, N'Ra mắt SmartBus Travel Connect', N'Dữ liệu đang lấy từ SQL Server SmartBusDB.', 'info'),
(NULL, N'Bật GPS để tìm bến gần nhất', N'GPS giúp chatbot và trang bến gần tôi tính khoảng cách đi bộ chính xác hơn.', 'gps');
GO

PRINT 'SmartBusDB sample data is ready. Run backend-api npm run seed:admin to create admin login.';
GO
